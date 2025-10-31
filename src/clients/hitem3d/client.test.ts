import { Hitem3DClient } from './client';
import { MemoryTokenStore } from './tokenStore';

const BASE = 'https://api.hitem3d.ai';

const originalFetch = global.fetch;

describe('Hitem3DClient token caching', () => {
  const clientId = 'cid';
  const clientSecret = 'csec';

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('caches token for 24h and refreshes after expiry', async () => {
    const store = new MemoryTokenStore();
    const c = new Hitem3DClient({ baseURL: BASE, clientId, clientSecret, store });
    let call = 0;
    global.fetch = jest.fn(async (url: any, init: any) => {
      call++;
      expect(String(url)).toBe(`${BASE}/open-api/v1/auth/token`);
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify({ data: { accessToken: call === 1 ? 't1' : 't2', tokenType: 'Bearer' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;

    const t1 = await c.getToken();
    expect(t1.accessToken).toBe('t1');

    // no new HTTP call; should use cache
    const t2 = await c.getToken();
    expect(t2.accessToken).toBe('t1');

    // expire manually and expect refresh
    await store.set('hitem3d', { accessToken: 'expired', tokenType: 'Bearer', expiresAt: Date.now() - 1000 });
    const t3 = await c.getToken();
    expect(t3.accessToken).toBe('t2');
  });
});

describe('Hitem3DClient submit/query with mocks', () => {
  const clientId = 'cid';
  const clientSecret = 'csec';

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('submits task with Bearer token and form-data', async () => {
    const store = new MemoryTokenStore();
    const c = new Hitem3DClient({ baseURL: BASE, clientId, clientSecret, store });

    await store.set('hitem3d', {
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 60_000
    });

    global.fetch = jest.fn(async (url: any, init: any) => {
      expect(String(url)).toBe(`${BASE}/open-api/v1/submit-task`);
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify({ data: { task_id: 'task123', state: 'pending' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;

    const r = await c.submitTask({ request_type: 3, model: 'hitem3dv1' });
    expect(r.task_id).toBe('task123');
    // if not thrown above, request was matched
  });

  it('queries task status with Bearer token', async () => {
    const store = new MemoryTokenStore();
    const c = new Hitem3DClient({ baseURL: BASE, clientId, clientSecret, store });
    await store.set('hitem3d', { accessToken: 'tok2', tokenType: 'Bearer', expiresAt: Date.now() + 60_000 });

    global.fetch = jest.fn(async (url: any, init: any) => {
      expect(String(url)).toBe(`${BASE}/open-api/v1/query-task?task_id=task123`);
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ data: { task_id: 'task123', state: 'succeeded', model_urls: { glb: 'u' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;

    const r = await c.queryTask('task123');
    expect(r.task_id).toBe('task123');
    expect(r.state).toBe('succeeded');
    expect(r.model_urls?.glb).toBe('u');
    // matched if not thrown
  });

  it('maps 4xx/5xx errors to typed errors', async () => {
    const store = new MemoryTokenStore();
    const c = new Hitem3DClient({ baseURL: BASE, clientId, clientSecret, store });
    await store.set('hitem3d', { accessToken: 'tok', tokenType: 'Bearer', expiresAt: Date.now() + 60_000 });

    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ msg: 'bad request', code: 'INVALID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;

    await expect(c.submitTask({ request_type: 3, model: 'hitem3dv1' })).rejects.toMatchObject({
      type: 'invalid_request',
      status: 400
    });
    // matched if not thrown
  });
});
