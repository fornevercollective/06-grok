import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function pagesBase(): string {
  const raw = (process.env.VITE_BASE_URL || '').trim()
  if (!raw || raw === '/') return '/'
  const withSlash = raw.endsWith('/') ? raw : `${raw}/`
  return withSlash
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const baseRaw = (process.env.VITE_BASE_URL || env.VITE_BASE_URL || '/').trim()
  const base = baseRaw === '/' || !baseRaw ? '/' : baseRaw.endsWith('/') ? baseRaw : `${baseRaw}/`
  return {
    base,
    plugins: [react()],
    server: {
      port: 5178,
    },
    // simple-peer / randombytes expect Node's `global` in the browser bundle
    define: {
      global: 'globalThis',
      'process.env.VITE_UVSPEED_WEB_BASE': JSON.stringify(env.VITE_UVSPEED_WEB_BASE ?? ''),
      'process.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL ?? ''),
    },
  }
})
