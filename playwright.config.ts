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
  /*
    EN SERIE, y no es pereza.

    Cada prueba de `/crear` levanta un contexto WebGL de verdad y reconstruye la
    escena seis veces, una por tipo de gráfica. En paralelo son ocho contextos
    peleándose por una sola GPU: un navegador aguanta del orden de 8-16 a la
    vez, y mucho antes de ese tope ya se ponen a la cola y se comen el tiempo
    límite. Medido aquí: en paralelo tres pruebas pasaban de 30 s y fallaban por
    tiempo; en serie, las ocho en 26 s.

    Un fallo por contención no dice nada del código y cuesta media hora
    averiguar que no era el código. Prefiero una suite un poco más lenta que una
    que miente.
  */
  fullyParallel: false,
  workers: 1,
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
