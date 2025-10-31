import { Buffer } from 'node:buffer';
import type { SubmitTaskParams, SubmitTaskResult, QueryTaskResult, Hitem3DError, HToken } from './types';
import { getDefaultTokenStore, TokenStore } from './tokenStore';

export class Hitem3DClient {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  private store: TokenStore;

  constructor(opts?: { baseURL?: string; clientId?: string; clientSecret?: string; store?: TokenStore }) {
    this.baseURL = opts?.baseURL || process.env.HITEM3D_BASE_URL || 'https://api.hitem3d.ai';
    this.clientId = opts?.clientId || process.env.HITEM3D_CLIENT_ID || '';
    this.clientSecret = opts?.clientSecret || process.env.HITEM3D_CLIENT_SECRET || '';
    this.store = opts?.store || getDefaultTokenStore();
  }

  private async fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<Response> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url, init);
        if (res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status}`);
        } else {
          return res;
        }
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 100 * (i + 1)));
    }
    throw lastErr;
  }

  private mapError(status: number, body?: any): Hitem3DError {
    const type: Hitem3DError['type'] =
      status === 400
        ? 'invalid_request'
        : status === 401
        ? 'unauthorized'
        : status === 429
        ? 'rate_limited'
        : status >= 500
        ? 'server_error'
        : 'hitem3d_error';
    return { type, status, message: body?.msg || body?.message || `HTTP ${status}`, h_code: body?.code };
  }

  private buildBasicAuth(): string {
    const raw = `${this.clientId}:${this.clientSecret}`;
    const enc = Buffer.from(raw, 'utf8').toString('base64');
    return `Basic ${enc}`;
  }

  async getToken(): Promise<HToken> {
    const cached = await this.store.get('hitem3d');
    if (cached) return cached;
    const url = `${this.baseURL}/open-api/v1/auth/token`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { Authorization: this.buildBasicAuth(), 'Content-Type': 'application/json' }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw this.mapError(res.status, body);

    const accessToken = body?.data?.accessToken || body?.accessToken;
    const tokenType = body?.data?.tokenType || body?.tokenType || 'Bearer';
    if (!accessToken) throw this.mapError(500, { message: 'missing accessToken' });
    const ttlMs = 24 * 60 * 60 * 1000; // 24h
    const token: HToken = { accessToken, tokenType, expiresAt: Date.now() + ttlMs };
    await this.store.set('hitem3d', token);
    return token;
  }

  async submitTask(params: SubmitTaskParams): Promise<SubmitTaskResult> {
    const token = await this.getToken();
    const url = `${this.baseURL}/open-api/v1/submit-task`;

    // form-data request
    const form = new FormData();
    form.set('request_type', String(params.request_type));
    form.set('model', params.model);
    if (params.resolution) form.set('resolution', String(params.resolution));
    if (params.mesh_url) form.set('mesh_url', params.mesh_url);
    if (typeof params.face === 'number') form.set('face', String(params.face));
    if (typeof params.format === 'number') form.set('format', String(params.format));
    if (params.callback_url) form.set('callback_url', params.callback_url);
    if (params.images && params.images.length > 0) {
      const img = params.images[0];
      form.set('images', new Blob([img.content]), img.filename);
    }
    if (params.multi_images && params.multi_images.length > 0) {
      for (const f of params.multi_images) {
        form.append('multi_images', new Blob([f.content]), f.filename);
      }
    }

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { Authorization: `${token.tokenType} ${token.accessToken}` },
      body: form as any
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw this.mapError(res.status, body);
    const task_id = body?.data?.task_id || body?.task_id;
    const state = body?.data?.state || body?.state || 'pending';
    if (!task_id) throw this.mapError(500, { message: 'missing task_id' });
    return { task_id, state };
  }

  async queryTask(taskId: string): Promise<QueryTaskResult> {
    const token = await this.getToken();
    const url = `${this.baseURL}/open-api/v1/query-task?task_id=${encodeURIComponent(taskId)}`;
    const res = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `${token.tokenType} ${token.accessToken}` }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw this.mapError(res.status, body);
    const data = body?.data || body;
    return {
      task_id: data?.task_id || taskId,
      state: data?.state || 'pending',
      model_urls: data?.model_urls,
      error_code: data?.error_code,
      error_message: body?.msg || data?.error_message
    };
  }
}

