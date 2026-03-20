import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:8081',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:8081/builder-react/dist/index.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
