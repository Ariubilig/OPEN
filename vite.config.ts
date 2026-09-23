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

// index.html is static; fill the name and description from config.ts / copy.ts
// so APP_NAME stays defined in one place.
function appMeta(): Plugin {
  const values: Record<string, string> = {
    __APP_NAME__: APP_NAME,
    __APP_TAGLINE__: copy.tagline,
    __APP_DESCRIPTION__: copy.feed.intro,
  }
  return {
    name: 'app-meta',
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
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
