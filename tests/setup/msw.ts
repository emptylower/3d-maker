import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Default handlers for tests. Can be overridden per-test via server.use(...)
export const server = setupServer(
  http.post('https://api.hitem3d.ai/open-api/v1/get-token', async () => {
    return HttpResponse.json({ access_token: 'mocked-token', expires_in: 86400 })
  }),
)

export function startMsw() {
  server.listen({ onUnhandledRequest: 'bypass' })
}

export function stopMsw() {
  server.close()
}

export function resetMsw() {
  server.resetHandlers()
}

