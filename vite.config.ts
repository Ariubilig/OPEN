/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { APP_NAME } from './src/config.ts'
import { copy } from './src/copy.ts'

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Favicon: a lettermark from the first letter of APP_NAME on the highlighter (no emblem, no logo).
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#E4FA4B"/><text x="32" y="45" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="38" fill="#121318">${escapeHtml([...APP_NAME][0] ?? '')}</text></svg>`

// index.html is static; fill the name and description from config.ts / copy.ts
// so APP_NAME stays defined in one place. Also serves / emits the favicon.
function appMeta(): Plugin {
  const values: Record<string, string> = {
    __APP_NAME__: APP_NAME,
    __APP_TAGLINE__: copy.tagline,
    __APP_DESCRIPTION__: copy.feed.intro,
  }
  return {
    name: 'app-meta',
    configureServer(server) {
      server.middlewares.use('/favicon.svg', (_req, res) => {
        res.setHeader('Content-Type', 'image/svg+xml')
        res.end(faviconSvg)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'favicon.svg',
        source: faviconSvg,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/__APP_[A-Z]+__/g, (key) =>
          key in values ? escapeHtml(values[key]) : key,
        ),
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), appMeta()],
  // One bundle on purpose: the site works offline once loaded (stories, zod and React together).
  build: { chunkSizeWarningLimit: 700 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
