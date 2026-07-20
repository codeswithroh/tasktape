import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/site',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4188',
    headless: false,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    }
  ],
  webServer: {
    command: 'python3 -m http.server 4188 --directory site',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false
  },
  outputDir: 'test-results/site'
})
