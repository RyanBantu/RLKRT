import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

// Server-only secrets read from .env.local. They are copied into process.env for the local
// /api functions and are never exposed to client code (no VITE_ prefix).
const SERVER_ENV = ['EBIRD_API_KEY']
const API_ROUTES = new Set(['ebird'])

// Runs the Vercel-style functions in /api inside the Vite dev and preview servers,
// so /api/* behaves the same locally as it does once deployed.
function localApi(): Plugin {
  const handle = (load: (id: string) => Promise<Record<string, unknown>>) =>
    async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const m = req.url?.match(/^\/api\/([a-z]+)(?:\?|$)/)
      if (!m || !API_ROUTES.has(m[1])) return next()
      try {
        const mod = await load(`/api/${m[1]}.ts`)
        const fn = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
        if (!fn) { res.statusCode = 405; return res.end() }
        const r = await fn(new Request(`http://localhost${req.url}`, { method: req.method }))
        res.statusCode = r.status
        r.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await r.arrayBuffer()))
      } catch {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'local_api_failed' }))
      }
    }
  let dev: ViteDevServer | null = null
  return {
    name: 'local-api',
    configureServer(server) {
      dev = server
      server.middlewares.use(handle((id) => server.ssrLoadModule(id)))
    },
    configurePreviewServer(server) {
      // Preview has no module graph of its own; borrow a throwaway dev server's SSR loader.
      server.middlewares.use(handle(async (id) => {
        if (!dev) {
          const { createServer } = await import('vite')
          dev = await createServer({ server: { middlewareMode: true }, appType: 'custom', configFile: false })
        }
        return dev.ssrLoadModule(id)
      }))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of SERVER_ENV) if (env[k] && !process.env[k]) process.env[k] = env[k]
  return {
    plugins: [react(), localApi()],
  }
})
