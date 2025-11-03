import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../setup/msw'

import { getToken, submitTask, queryTask, Hitem3DClientError, resetHitem3DTokenCacheForTest } from '@/services/hitem3d'

const BASE = 'https://api.hitem3d.ai'

beforeEach(() => {
  resetHitem3DTokenCacheForTest()
  process.env.HITEM3D_API_BASE = BASE
  process.env.HITEM3D_CLIENT_ID = 'id'
  process.env.HITEM3D_CLIENT_SECRET = 'secret'
  process.env.HITEM3D_TOKEN_TTL_SECONDS = '10' // TTL for caching tests
  process.env.HITEM3D_CALLBACK_URL = 'https://example.com/callback'
})

describe('hitem3D client - getToken', () => {
  it('sends correct Basic header and caches until TTL expiry', async () => {
    let hits = 0
    server.use(
      http.post(`${BASE}/open-api/v1/auth/token`, async ({ request }) => {
        hits++
        const auth = request.headers.get('authorization')
        expect(auth).toBe('Basic ' + Buffer.from('id:secret').toString('base64'))
        return HttpResponse.json({
          code: 200,
          data: { accessToken: 'mock-token', tokenType: 'Bearer', nonce: 'n' },
          msg: 'success',
        })
      }),
    )

    // first call -> network
    const t1 = await getToken()
    expect(t1).toBe('mock-token')
    expect(hits).toBe(1)

    // second call, within TTL -> cached
    const t2 = await getToken()
    expect(t2).toBe('mock-token')
    expect(hits).toBe(1)

    // advance time close to expiry (TTL - 1s), cache still valid
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 4000)
    const tCache = await getToken()
    expect(tCache).toBe('mock-token')
    expect(hits).toBe(1)

    // advance time beyond TTL-5s skew (e.g. +9s) and call again -> refresh
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 9000)
    const t3 = await getToken()
    expect(t3).toBe('mock-token')
    expect(hits).toBe(2)
    vi.useRealTimers()
  })

  it('maps error when vendor returns non-200', async () => {
    server.use(
      http.post(`${BASE}/open-api/v1/auth/token`, async () => {
        return HttpResponse.json({ code: 40010000, data: {}, msg: 'client credentials are invalid' }, { status: 200 })
      }),
    )
    await expect(getToken()).rejects.toMatchObject({
      name: 'Hitem3DClientError',
      vendorCode: 40010000,
      message: expect.stringContaining('第三方服务调用失败（hitem3D）：client credentials are invalid'),
    })
  })
})

describe('hitem3D client - submitTask', () => {
  it('submits single-image multipart with required fields and returns task_id', async () => {
    // token
    let tokenHits = 0
    let submitHits = 0
    server.use(
      http.post(`${BASE}/open-api/v1/auth/token`, async () => {
        tokenHits++
        return HttpResponse.json({ code: 200, data: { accessToken: 'tok' } })
      }),
      // submit
      http.post(`${BASE}/open-api/v1/submit-task`, async ({ request }) => {
        submitHits++
        const auth = request.headers.get('authorization')
        expect(auth).toBe('Bearer tok')
        const fd = await request.formData()
        expect(fd.get('request_type')).toBe('3')
        expect(fd.get('model')).toBe('hitem3dv1')
        // optional params present
        expect(fd.get('callback_url')).toBe('https://example.com/callback')
        // files
        const imgs = fd.getAll('images')
        expect(imgs.length).toBe(1)
        // multi_images should be empty
        expect(fd.getAll('multi_images').length).toBe(0)
        return HttpResponse.json({ code: 200, data: { task_id: 'task123' } })
      }),
    )

    const res = await submitTask({
      request_type: 3,
      model: 'hitem3dv1',
      images: [
        { filename: 'a.jpg', content: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' },
      ],
    })
    expect(res.task_id).toBe('task123')
    expect(tokenHits).toBe(1)
    expect(submitHits).toBe(1)
  })

  it('submits multi-image multipart and returns task_id', async () => {
    server.use(
      http.post(`${BASE}/open-api/v1/auth/token`, async () => {
        return HttpResponse.json({ code: 200, data: { accessToken: 'tok' } })
      }),
      http.post(`${BASE}/open-api/v1/submit-task`, async ({ request }) => {
        const fd = await request.formData()
        expect(fd.get('request_type')).toBe('1')
        const list = fd.getAll('multi_images')
        expect(list.length).toBe(2)
        return HttpResponse.json({ code: 200, data: { task_id: 'task456' } })
      }),
    )

    const res = await submitTask({
      request_type: 1,
      model: 'hitem3dv1.5',
      multi_images: [
        { filename: '1.jpg', content: new Uint8Array([1]) },
        { filename: '2.jpg', content: new Uint8Array([2]) },
      ],
    })
    expect(res.task_id).toBe('task456')
  })

  it('throws on missing mesh_url when request_type=2', async () => {
    await expect(
      submitTask({
        request_type: 2,
        model: 'hitem3dv1',
        images: [{ filename: 'a.jpg', content: new Uint8Array([1]) }],
      }),
    ).rejects.toBeInstanceOf(Hitem3DClientError)
  })
})

describe('hitem3D client - queryTask', () => {
  it('queries task and parses result fields', async () => {
    server.use(
      http.post(`${BASE}/open-api/v1/auth/token`, async () => {
        return HttpResponse.json({ code: 200, data: { accessToken: 'tok' } })
      }),
      http.get(`${BASE}/open-api/v1/query-task`, async ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('task_id')).toBe('abc')
        return HttpResponse.json({
          code: 200,
          data: {
            task_id: 'abc',
            state: 'success',
            id: 'abc_0',
            cover_url: 'https://cover',
            url: 'https://model',
          },
        })
      }),
    )
    const res = await queryTask('abc')
    expect(res.state).toBe('success')
    expect(res.cover_url).toBe('https://cover')
    expect(res.url).toBe('https://model')
  })
})
