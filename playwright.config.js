import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'rm -f $PWD/e2e.db && DB_PATH=$PWD/e2e.db PORT=3100 npm start -w server',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
  },
})
