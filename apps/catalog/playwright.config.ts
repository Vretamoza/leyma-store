import { defineConfig } from '@playwright/test';

// Las pruebas corren contra la compilación de producción (`pnpm build` antes).
// En Windows algunas navegaciones se quedan colgadas al azar (el servidor no llega
// a recibir la petición), por eso hay un tiempo de navegación corto y reintentos.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: 2,
  use: { baseURL: 'http://127.0.0.1:4400', navigationTimeout: 10_000, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve-build.mjs', url: 'http://127.0.0.1:4400', reuseExistingServer: true },
});
