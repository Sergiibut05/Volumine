import type { ResolvedChartConfig } from '@/lib/config/defaults';
import { createChartRenderer, type HoverInfo } from '@/renderer/core/chart-renderer';

/*
  Punto de entrada de /embed. Bundle independiente: no pasa por el App Router,
  así que no lleva React ni el runtime de Next (ADR 0006).

  El servidor ya validó, migró y resolvió el config, y lo deja en la página como
  JSON. Aquí no hace falta Zod: solo leerlo y pintar. Son ~14 KB gz menos.

  Prohibido en este archivo: cookies, storage, peticiones a terceros,
  navegación al top (ADR 0005).
*/

const OUT_OF_VIEW_GRACE_MS = 10_000;

function readConfig(): ResolvedChartConfig | null {
  const node = document.getElementById('voluma-config');
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as ResolvedChartConfig;
  } catch {
    return null;
  }
}

function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function post(payload: Record<string, unknown>) {
  if (window.parent === window) return;
  // targetOrigin '*': no sabemos quién nos incrusta, y no enviamos nada
  // sensible — solo dimensiones y avisos del propio config del usuario.
  window.parent.postMessage({ source: 'voluma', ...payload }, '*');
}

function main() {
  const stage = document.querySelector<HTMLElement>('.stage');
  const canvas = document.querySelector<HTMLCanvasElement>('#voluma-canvas');
  const tooltip = document.querySelector<HTMLElement>('#voluma-tooltip');
  const config = readConfig();

  if (!stage || !canvas || !config) return;

  if (!hasWebGL()) {
    // La tabla de datos ya está en el DOM: esa es la versión que ve esta gente.
    stage.dataset.fallback = 'no-webgl';
    return;
  }

  const format = new Intl.NumberFormat(config.data.format.locale, {
    minimumFractionDigits: config.data.format.decimals,
    maximumFractionDigits: config.data.format.decimals,
  });

  let handle: ReturnType<typeof createChartRenderer> | null = null;

  function mount() {
    if (handle) return;
    handle = createChartRenderer(canvas!, config!);
    handle.onHover((info: HoverInfo) => {
      if (!tooltip) return;
      if (!info || !config!.interaction.tooltip) {
        tooltip.hidden = true;
        return;
      }
      tooltip.hidden = false;
      const value = `${format.format(info.value)}${config!.data.format.unit}`;
      /* El porcentaje solo si el tipo reparte un total, y la serie solo si hay
         más de una: en una barra suelta, "100%" no dice nada. */
      const detail = [
        value,
        info.fraction === null ? null : `${(info.fraction * 100).toFixed(1)}%`,
        info.series,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
      // Las etiquetas son del usuario y llegan por URL: se escapan siempre.
      tooltip.innerHTML =
        `<b>${escapeHtml(info.label)}</b><span>${escapeHtml(detail)}</span>`;
    });
  }

  function unmount() {
    handle?.dispose();
    handle = null;
  }

  /* El canvas no se monta hasta entrar en viewport y se desmonta al salir. Un
     navegador aguanta ~8-16 contextos WebGL: una página de Notion con seis
     gráficas nuestras tiene que funcionar. */
  if (typeof IntersectionObserver === 'undefined') {
    mount();
  } else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          clearTimeout(timer);
          mount();
        } else {
          // Margen de gracia: destruir y recrear el contexto en cada scroll
          // sería peor que mantenerlo un rato de más.
          timer = setTimeout(unmount, OUT_OF_VIEW_GRACE_MS);
        }
      },
      { rootMargin: '200px' },
    ).observe(stage);
  }

  post({ type: 'ready', height: document.documentElement.scrollHeight });
  new ResizeObserver(() => {
    post({ type: 'resize', height: document.documentElement.scrollHeight });
  }).observe(document.documentElement);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

main();
