// Browser tests (e2e/): the production build served by `vite preview` with the real security
// headers, against a stand-in for the Supabase API (e2e/mock-api.ts). Run: npm run test:e2e
import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'mn-MN',
    timezoneId: 'Asia/Ulaanbaatar',
    trace: 'retain-on-failure',
    // a Chromium already on the machine instead of Playwright's own download (optional)
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // must match API_URL in e2e/mock-api.ts; the key is never checked
    env: {
      VITE_SUPABASE_URL: 'https://e2e-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_e2e',
    },
  },
})
