import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const nodeProcess = (globalThis as typeof globalThis & {
  process: { env: Record<string, string | undefined>; cwd: () => string }
}).process

type ApiHandler = (request: { method?: string; body?: unknown }, response: {
  status: (code: number) => unknown
  json: (payload: unknown) => void
}) => Promise<void>

function sendJson(response: any, status: number, payload: unknown) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function localApiRoute(loadHandler: () => Promise<{ default: ApiHandler }>) {
  return (request: any, response: any) => {
    let rawBody = ''
    let tooLarge = false
    request.on('data', (chunk: unknown) => {
      if (tooLarge) return
      rawBody += typeof chunk === 'string' ? chunk : String(chunk)
      if (rawBody.length > 6_500_000) tooLarge = true
    })
    request.on('error', () => sendJson(response, 400, { error: 'Unable to read request body' }))
    request.on('end', async () => {
      if (tooLarge) return sendJson(response, 413, { error: 'Request body is too large' })
      let body: unknown
      try {
        body = rawBody ? JSON.parse(rawBody) : undefined
      } catch {
        return sendJson(response, 400, { error: 'Request body must be valid JSON' })
      }
      let sent = false
      const apiResponse = {
        status(code: number) {
          response.statusCode = code
          return apiResponse
        },
        json(payload: unknown) {
          if (sent) return
          sent = true
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(payload))
        },
      }
      try {
        const handler = (await loadHandler()).default
        await handler({ method: request.method, body }, apiResponse)
        if (!sent && !response.writableEnded) sendJson(response, 500, { error: 'Local API handler returned no response' })
      } catch (error) {
        if (!response.writableEnded) sendJson(response, 500, { error: error instanceof Error ? error.message : 'Local API request failed' })
      }
    })
  }
}

function aetherLocalApi(): Plugin {
  const apiModule = (file: 'design' | 'render') => () => import(new URL(`./api/${file}.mjs`, import.meta.url).href) as Promise<{ default: ApiHandler }>
  return {
    name: 'aether-local-api',
    config(_, { mode }) {
      // Server-only keys stay in Node. Vite only exposes variables prefixed VITE_.
      Object.assign(nodeProcess.env, loadEnv(mode, nodeProcess.cwd(), ''))
    },
    configureServer(server) {
      server.middlewares.use('/api/design', localApiRoute(apiModule('design')))
      server.middlewares.use('/api/render', localApiRoute(apiModule('render')))
      server.middlewares.use('/api/visual-critic', localApiRoute(() => import(new URL('./api/visual-critic.mjs', import.meta.url).href) as Promise<{ default: ApiHandler }>))
    },
  }
}

export default defineConfig({
  plugins: [react(), aetherLocalApi()],
  server: { port: 5173 },
})
