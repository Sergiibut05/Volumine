# ADR 0005 — El embed es anónimo, sin estado y a prueba de sandbox

**Fecha:** 2026-08-04 · **Estado:** aceptada

## Contexto

El embed se va a cargar dentro de páginas que no controlamos. En concreto:

- **Confluence Cloud** aplica el atributo `sandbox` a los iframes por defecto y
  el administrador debe meter el dominio en una allowlist.
- **Notion y Canva** pasan los embeds enriquecidos por Iframely.
- Los navegadores bloquean cookies de terceros de forma cada vez más agresiva.

Un iframe con `sandbox` no tiene acceso a cookies ni a almacenamiento
particionado en muchos casos, no puede navegar al top y a veces ni ejecuta
scripts si falta `allow-scripts`.

## Decisión

`/embed` no depende de **ningún** estado del navegador:

- Sin cookies, sin `localStorage`, sin `sessionStorage`, sin `IndexedDB`.
- Sin autenticación. Solo renderiza gráficas con `visibility = 'public'`.
- Sin navegación al top; los links de segmento abren con `target="_blank"` y
  `rel="noopener"`, y se degradan sin romper si el sandbox lo impide.
- Sin peticiones a terceros de ningún tipo.
- Cabeceras: **no** enviar `X-Frame-Options`; `Content-Security-Policy:
  frame-ancestors *` explícito en esa ruta y solo en esa ruta.
- Toda la comunicación con la página anfitriona es por `postMessage`:
  altura para auto-resize, tema heredado, evento de click en segmento.

Consecuencia práctica: **cualquier feature que necesite saber quién eres no
puede vivir en el embed.** Personalización por usuario, borradores, historial:
todo eso es del editor.

## Consecuencias

- La analítica de embeds se hace del lado servidor (log de petición), no con un
  script de cliente. Encaja además con el presupuesto de rendimiento.
- La marca de agua del plan gratuito la decide el **servidor** al servir la
  config, no el cliente: si la decidiera el cliente sería trivial quitarla.
- Hay que darse de alta en Iframely pronto para desbloquear Notion, Canva y el
  resto de su red.
- Documentar para usuarios de Confluence cómo pedir el allowlist a su admin.
