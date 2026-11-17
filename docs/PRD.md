# Volumine — PRD

## Una frase

Crea una gráfica 3D preciosa e incrústala en cualquier sitio con un link.

## El problema real

Hay decenas de generadores de gráficas online. Casi todos escupen un PNG. Los
pocos que dan embed dan un embed feo, pesado o de pago. Nadie ofrece un widget
3D **vivo** que se vea bien en una landing, en Notion y en Confluence.

Insight central: **el link es el producto.** dbdiagram no ganó dibujando cajas,
ganó porque el link se pega en cualquier parte. La gráfica bonita es el gancho;
el embed es el negocio.

## Para quién

**Sí:** marketing y growth, gente montando landings, product designers, indie
hackers, gente que hace decks y páginas de Notion que quiere que se vean bien.
Compran **estética y facilidad**, no rigor estadístico.

**No:** analistas de datos, BI serio, dashboards operativos. Una gráfica 3D
distorsiona proporciones por perspectiva — es una decisión estética consciente,
no un descuido. No competimos con Metabase y no fingimos hacerlo.

## Principios de producto

1. **Cero fricción para empezar.** Se puede crear y compartir una gráfica sin
   registrarse. La cuenta sirve para _guardar y editar después_, no para probar.
2. **El embed nunca molesta.** Carga rápido, no pide permisos, no rompe la
   página anfitriona, degrada con elegancia si no hay WebGL.
3. **Personalización de verdad.** No 5 temas y 3 colores: temas + control fino
   de color, material, luz, fondo, tipografía, movimiento y cámara.
4. **Bonito por defecto.** El estado inicial de cualquier gráfica ya es
   presentable. Los presets son opinionados, no neutros.

## Alcance v1 (gratis, sin límites artificiales)

- Tipos de gráfica: **donut/pie 3D** y **barras 3D**.
- Editor visual con vista previa en vivo.
- Temas predefinidos + personalización (colores, fondo, materiales, luz,
  rotación, cámara, etiquetas).
- Publicar → URL de embed (`/embed/{id}`) + snippet `<iframe>`.
- Config-en-URL sin cuenta (`/embed?c=<config comprimida>`) — también sirve como
  API para desarrolladores.
- Imagen estática (OG image + fallback sin WebGL) y tabla de datos accesible.
- Auto-altura y herencia de tema vía `postMessage`.

## Fuera de alcance v1 (a propósito)

Mapas/globos 3D, colaboración en tiempo real, datos en vivo, dominios propios,
equipos, exportación a vídeo, más de 2 tipos de gráfica.

## Monetización — no ahora, pero preparada

Hoy todo es gratis, y lo único que se cobra es una invitación voluntaria en
`/cafe` (ADR 0008; hubo un plan Pro de pago único y se quitó). El esquema de
datos incluye plan y cuotas desde el día 1 para no migrar nada cuando toque. Si
llega tracción, el corte natural es:

- **Free**: gráficas públicas, marca de agua discreta en el embed.
- **Pro**: sin marca de agua, gráficas privadas/no listadas, más tipos, temas
  guardados.
- **El upsell de verdad**: **datos vivos** (Google Sheets / CSV / endpoint que
  se refresca solo). Un gráfico estático lo copia cualquiera; uno que se
  actualiza solo, no.

## Cómo sabemos si funciona

Métrica norte: **embeds activos** (dominios únicos distintos de volumine.* que
cargan `/embed` en 7 días). No usuarios registrados, no gráficas creadas.

Secundarias: creada→publicada (%), p75 de LCP del embed, dominios anfitriones
únicos.

## Riesgos conocidos y respuesta

| Riesgo                                                   | Respuesta                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Confluence sandboxea iframes y exige allowlist del admin | El embed funciona bajo `sandbox` sin excepciones; documentar el allowlist; snippet alternativo |
| Notion/Canva pasan embeds por Iframely                   | Darse de alta en Iframely pronto; mientras tanto el bloque "Embed" genérico funciona           |
| Límite de ~8-16 contextos WebGL por pestaña              | `IntersectionObserver`: póster estático hasta entrar en viewport, liberar contexto al salir    |
| WebGL lento o ausente en gama baja                       | Fallback a imagen estática automático; detección antes de montar el canvas                     |
| Gráfica 3D = mala accesibilidad                          | `<table>` con los datos siempre presente en el DOM del embed                                   |
| Mercado saturado de "chart makers"                       | No competimos ahí: competimos en embed vivo + calidad visual                                   |
