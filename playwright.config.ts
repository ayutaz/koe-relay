import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.artifacts/browser',
  workers: 1,
  timeout: 30_000,
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:4173/koe-relay/', headless: true },
  globalSetup: './tests/browser/server.ts',
});
