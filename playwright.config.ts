import { defineConfig } from '@playwright/test';

/*
  Playwright.

  Contra `next start` y NO contra `next dev`: en esta máquina el servidor de
  desarrollo devuelve 403 en los chunks y la página no llega a hidratar (ver
  docs/STATE.md). Una prueba de interfaz sobre una página sin hidratar mide otra
  cosa, y además el build de producción es lo que de verdad se despliega.

  Por eso hace falta `npm run build` antes. `reuseExistingServer` deja
  reaprovechar uno que ya esté levantado mientras se trabaja.
*/

const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
