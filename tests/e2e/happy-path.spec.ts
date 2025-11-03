import { test, expect } from '@playwright/test'

const E2E_TEST_TOKEN = process.env.E2E_TEST_TOKEN || ''

test.skip(!E2E_TEST_TOKEN, 'E2E_TEST_TOKEN not set', async () => {})

test('register -> create order -> complete -> create gen -> simulate success -> download presigned json', async ({ request, baseURL }) => {
  const base = baseURL || 'http://localhost:3000'
  const rand = Math.random().toString(36).slice(2, 8)
  const email = `e2e_${rand}@example.com`
  const password = 'P@ssw0rd123'

  // 1) register (auto login via cookie forwarding)
  const reg = await request.post(base + '/api/auth/register', { data: { email, password } })
  expect(reg.ok()).toBeTruthy()
  const regJson = await reg.json()
  const user_uuid = regJson.user_uuid as string
  expect(user_uuid).toBeTruthy()

  // 2) create a fake order directly (avoid Stripe in E2E)
  const order_no = 'e2e-' + Date.now()
  const oc = await request.post(base + '/api/test/order/create', {
    headers: { 'x-e2e-test-token': E2E_TEST_TOKEN },
    data: { order_no, user_uuid, credits: 400, amount: 1000, currency: 'usd', product_id: 'basic', product_name: 'Basic Plan', valid_months: 12 },
  })
  expect(oc.ok()).toBeTruthy()

  // 3) complete payment (simulate webhook)
  const complete = await request.post(base + '/api/test/stripe/complete', {
    headers: { 'x-e2e-test-token': E2E_TEST_TOKEN },
    data: { order_no, paid_email: email },
  })
  expect(complete.ok()).toBeTruthy()

  // 4) create generation task record
  const task_id = 'task_' + Date.now()
  const gc = await request.post(base + '/api/test/generation/create', {
    headers: { 'x-e2e-test-token': E2E_TEST_TOKEN },
    data: { task_id, user_uuid, request_type: 3, model_version: 'hitem3dv1', resolution: '1024', credits_charged: 100 },
  })
  expect(gc.ok()).toBeTruthy()

  // 5) simulate callback success with inline assets
  const dummyCover = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64') // small PNG header as placeholder
  const dummyFile = Buffer.from('glbdata', 'utf8').toString('base64')
  const sim = await request.post(base + '/api/test/hitem3d/simulate', {
    headers: { 'x-e2e-test-token': E2E_TEST_TOKEN },
    data: { task_id, state: 'success', cover_data: dummyCover, file_data: dummyFile, file_ext: 'glb' },
  })
  expect(sim.ok()).toBeTruthy()
  const simJson = await sim.json()
  const asset_uuid = simJson.asset_uuid as string
  expect(asset_uuid).toBeTruthy()

  // 6) download asset via presigned json (if presigned) else proxy
  const dl = await request.get(base + `/api/assets/${asset_uuid}/download?format=json`)
  expect(dl.ok()).toBeTruthy()
  const headers = dl.headers()
  const ct = headers['content-type'] || ''
  if (ct.includes('application/json')) {
    const js = await dl.json()
    expect(js && js.data && js.data.url).toBeTruthy()
  } else {
    // proxy mode: should be an attachment stream
    const cd = headers['content-disposition'] || ''
    expect(cd.toLowerCase()).toContain('attachment')
  }
})
