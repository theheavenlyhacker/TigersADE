import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium' },
  webServer: [
    {
      command: 'pnpm --filter @tigers/api dev',
      url: 'http://127.0.0.1:4000/docs-json',
      env: { DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://tigers:tigers@localhost:5434/tigers_test', PORT: '4000', NODE_ENV: 'development' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @tigers/web exec next dev --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
