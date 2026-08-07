# ChartConfig — contrato v1

El documento más importante del repo. Es lo que se guarda en BBDD, lo que viaja
en la URL, lo que consume el renderer y lo que un desarrollador externo escribe
a mano. **Un link publicado debe seguir funcionando para siempre.**

## Reglas del contrato

1. `v` es obligatorio y es el primer campo. v1 es esta versión.
2. **Todo campo salvo `v`, `type` y `data` es opcional.** El renderer aplica
   defaults. Un config mínimo tiene que producir una gráfica bonita.
3. Solo se pueden **añadir** campos opcionales dentro de una versión. Renombrar,
   borrar o cambiar el significado de un campo → nueva versión + migración en
   `src/lib/config/migrations/`.
4. El renderer es **puro**: mismo `ChartConfig` → mismos píxeles. Sin
   aleatoriedad no sembrada, sin lectura de reloj fuera de la animación, sin
   dependencia de tamaño de ventana salvo por `layout.fit`.
5. Validación con Zod en `src/lib/config/schema.ts`. Un config inválido nunca
   revienta el embed: se sanea, se avisa por `postMessage` y se renderiza lo que
   se pueda.

## Forma

```jsonc
{
  "v": 1,
  "type": "donut",           // donut | pie | bar | bar-race | globe | gauge  (v1)
  "title": "Reparto de ingresos",   // opcional
  "data": { ... },
  "theme": "aurora",         // preset; lo de abajo lo sobreescribe punto a punto
  "style": { ... },
  "scene": { ... },
  "camera": { ... },
  "motion": { ... },
  "labels": { ... },
  "interaction": { ... },
  "layout": { ... }
}
```

### `data`

```jsonc
{
  "labels": ["Suscripciones", "Servicios", "Licencias"],
  // Solo para `globe`. Misma longitud que `labels`.
  "coords": [
    [40.4, -3.7],
    [51.5, -0.1],
    [35.7, 139.7],
  ],
  "series": [{ "name": "2026", "values": [45, 30, 25], "colors": ["#ff4d6d", null, null] }],
  "format": {
    "unit": "€", // sufijo/prefijo según locale
    "decimals": 0,
    "locale": "es-ES",
    "as": "value", // "value" | "percent"
  },
}
```

- `donut`/`pie`/`globe`/`gauge` usan **solo `series[0]`**. `bar` admite N series (eje Z).
- **`bar-race` lee las series como PERIODOS**, no como filas: cada serie es un
  instante y su `name` es la etiqueta que se muestra ("2021", "Ene"). Es la
  misma forma leída en otro eje, y por eso el tiempo no obligó a subir de
  versión. Se ordenan de mayor a menor en cada instante.
- **`coords` solo lo usa `globe`.** Es `[latitud, longitud]` en grados, alineado
  con `labels`. Una etiqueta sin coordenada no se dibuja: poner un dato en el
  sitio equivocado de un mapa es peor que no ponerlo.
- `colors` es un override puntual por segmento; `null` = usar la paleta.
- **`gauge` lee `series[0]` como TRAMOS DE UN MISMO ARCO**, no como categorías
  que se reparten un total: cada valor ocupa su parte de la escala `0..max` y lo
  que sobra queda sin llenar. Con un solo valor es un progreso simple; con
  varios, un progreso con desglose.
- Los valores negativos se ignoran en `donut`/`pie`/`gauge` (documentado, no
  silencioso: se reporta por `postMessage`).
- **Todo a cero es un ERROR en `donut`/`pie` y un valor VÁLIDO en `gauge`.** Un
  anillo sin nada que repartir no se puede dibujar; un medidor a cero vale «0 de
  100», que es una lectura buena y frecuente. Es la diferencia de fondo entre los
  dos: el total del anillo lo pone la suma, y el del medidor lo pone `max`.

### `style` — la piel

```jsonc
{
  "palette": ["#7c5cff", "#00d4ff", "#ff4d6d", "#ffd166", "#06d6a0"],
  "paletteMode": "cycle", // "cycle" | "gradient" (interpola entre extremos)
  "material": "physical", // "physical" | "matte" | "glass" | "metal" | "toon"
  "roughness": 0.35,
  "metalness": 0.1,
  "bevel": 0.35, // 0..1 → redondeo de bordes. EL rasgo de marca.
  "gap": 0.02, // separación entre segmentos, en radianes normalizados
  "innerRadius": 0.55, // donut; 0 = pie
  "height": 0.35, // extrusión (grosor)
  "explode": 0, // 0..1 desplazamiento radial de segmentos
  "cornerRadius": 0.2, // barras: redondeo de las esquinas superiores
  "shadow": true,
  // Solo `globe`. Va agrupado porque no significa nada en los otros tipos.
  "globe": {
    "base": "#111634", // el planeta, bajo los puntos
    "land": "#8b7dff", // los puntos de tierra
    "glow": "#5b3ce6", // halo atmosférico
    "density": 0.72, // cuántos puntos
    "dotSize": 0.7,
    "markerSize": 0.62,
    "marker": "dot"    // "dot" | "pin" (chincheta) | "pulse" (late)
  },
  // Solo `gauge`. Agrupado por lo mismo que `globe`.
  "gauge": {
    "max": 100,          // tope de la escala. El arco se llena al llegar aquí
    "sweep": 270,        // grados que abarca el arco, centrado abajo. 360 = anillo
    "track": true,       // pintar lo que falta para llegar al tope
    "trackColor": "auto" // "auto" = derivado del fondo
  },
}
```

Sobre `gauge.max`: es el único campo de `style` que cambia lo que un número
SIGNIFICA y no solo cómo se ve — «48» no dice nada hasta saber si es sobre 60 o
sobre 1000. Vive aquí de todas formas para que la tabla de datos siga siendo la
misma para todos los tipos: es una escala, como un eje, no un dato más. Si el
tope no es mayor que 0 se avisa y se cae a 100, en vez de dejar el hueco en
blanco en la página de alguien.

El arco se **llena en sentido horario desde abajo a la izquierda**, y el hueco
queda centrado abajo. Esa esquina vacía es la que dice dónde está el cero: por
eso un medidor no gira nunca, aunque `motion.autoRotate` esté puesto.

Si la suma se pasa de `max`, el arco se reparte entero en proporción —no se
desborda ni se recorta el último tramo— y se avisa. La cifra del centro sigue
siendo la de verdad.

### `scene` — el entorno

```jsonc
{
  "background": {
    "kind": "gradient", // "transparent" | "solid" | "gradient" | "grid" | "dots"
    "from": "#0b0b12",
    "to": "#1a1030",
    "angle": 135,
  },
  "environment": "studio", // preset de iluminación IBL: studio|sunset|city|night|soft
  "lightIntensity": 1,
  "ambient": 0.4,
  "fog": 0,
  "bloom": 0.25, // 0 = sin post-proceso (más barato: preferido en móvil)
  "vignette": 0,
}
```

`background.kind: "transparent"` es importante: permite que el embed se funda
con la página anfitriona.

### `camera`

```jsonc
{
  "preset": "hero", // "hero" | "top" | "front" | "isometric" | "custom"
  "polar": 62, // grados desde el eje Y (solo custom)
  "azimuth": -35,
  "distance": 1, // multiplicador sobre el encuadre automático
  "fov": 35,
  "orthographic": false,
}
```

### `motion`

```jsonc
{
  "autoRotate": true,
  "speed": 0.35, // vueltas por minuto
  "entrance": "grow", // "none" | "grow" | "sweep" | "stagger"
  "entranceDuration": 900, // ms
  "frameDuration": 1400, // ms por periodo; solo `bar-race`
  "hover": "lift", // "none" | "lift" | "glow" | "explode"
  "reducedMotion": "respect", // "respect" | "force-off" | "ignore"
}
```

`reducedMotion: "respect"` es el default y **no es negociable como default**:
`prefers-reduced-motion` desactiva `autoRotate` y la animación de entrada.

### `labels`

```jsonc
{
  "show": false,
  "mode": "outside", // "none" | "outside" | "inside" | "legend"
  "showValues": true,
  "showPercent": false,
  "font": "inter", // "inter" | "display" | "mono" — SIEMPRE del sistema
  "size": 1,
  "color": "auto", // "auto" = blanco roto; o un hex propio
  "finish": "glass", // "glass" | "solid" | "plain"
  "boxPadding": 1, // 0..2, multiplica el hueco interior de la caja
  "boxRadius": 1, // 0..2, multiplica el redondeo de la esquina
  "title": { "show": true, "position": "top" },
}
```

#### `font` — por qué las tres son fuentes DEL SISTEMA

Las etiquetas se dibujan en HTML sobre el canvas, no dentro de WebGL, así que
la fuente la elige CSS. Y en `/embed` **no se puede descargar ninguna**: la
regla 1 permite una sola petición y prohíbe fuentes remotas (ADR 0005). Una
fuente propia costaría entre 15 y 40 KB por peso, en la página de otra persona,
para escribir cuatro etiquetas.

Así que los tres valores son familias del sistema, y son tres VOCES, no tres
ficheros:

| valor | qué sale | para qué |
|-----------|-------------|--------------------------------------------------|
| `inter` | palo seco | lo neutro. El de por defecto. |
| `display` | serifa | voz editorial, para una gráfica dentro de un texto |
| `mono` | monoespaciada | cifras que se comparan en columna |

El id `inter` viene de la v1 y **no se puede renombrar**: viaja dentro de links
ya publicados. Lo que nombra es el papel, no el fichero.

Lo mismo se aplica en el editor y en el embed a propósito: si el editor usara
la tipografía de la aplicación y el embed la del sistema, la misma config daría
píxeles distintos en cada sitio, que es lo único que este proyecto promete que
no pasa.

#### `color`

`"auto"` es un blanco roto, que es lo que funciona sobre la píldora oscura. Un
hex lo sustituye. Con `finish: "plain"` el color va acompañado de un halo
calculado —claro si el texto es oscuro y al revés— para que siga leyéndose
encima de cualquier página.

#### `finish` — el envoltorio de la etiqueta

Añadido después de la v1, **opcional y con default `glass`**: una config vieja
sin este campo se ve exactamente igual que antes.

| valor | qué es | cuándo |
|---------|--------------------------------------|--------------------------------|
| `glass` | píldora translúcida con desenfoque | por defecto. Se lee sobre cualquier fondo |
| `solid` | píldora opaca, sin desenfoque | cuando el desenfoque distrae o el equipo es flojo |
| `plain` | sin caja: texto con halo de contraste | cuando la caja compite con el dibujo |

Los tres son legibles sobre blanco, sobre negro y sobre una foto, y eso no es
casualidad: **el embed corre dentro de la página de otra persona y no sabemos
qué hay detrás.** Por eso `plain` no es «texto suelto» sino texto con halo, y
por eso no existe un color libre para la caja — sería la forma más rápida de
que alguien publique una gráfica ilegible en la web de un cliente.

#### `boxPadding` y `boxRadius` — el ajuste fino de la caja

Los dos son MULTIPLICADORES sobre lo que ya hay, de 0 a 2, con 1 por defecto.
No son medidas absolutas a propósito: la caja se dimensiona en `em`, así que
crece con `size` y con la escala de la página anfitriona. Un padding en píxeles
se vería enorme en una etiqueta pequeña y ridículo en una grande.

`boxRadius` a 0 da esquina viva; a 2, píldora. `boxPadding` a 0 deja el texto
pegado al borde de la caja, que es feo pero no ilegible — por eso se permite.

Solo hacen algo con `glass` y `solid`. Con `plain` no hay caja que ajustar, y el
editor ni siquiera enseña los controles.

### `interaction`

```jsonc
{
  "orbit": true, // arrastrar para rotar
  "zoom": false, // desactivado por defecto: roba el scroll de la página
  "tooltip": true,
  "clickAction": "none", // "none" | "isolate" | "link"
  "links": [null, null, "https://..."], // por segmento, si clickAction="link"
}
```

`zoom: false` por defecto es deliberado: un embed que secuestra la rueda del
ratón dentro de una página ajena es un embed que la gente quita.

### `layout`

```jsonc
{
  "aspect": "16:9", // "16:9" | "4:3" | "1:1" | "auto"
  "padding": 0.1,
  "fit": "contain", // "contain" | "cover"
  "watermark": true, // free = true; el renderer NO decide esto, lo decide el servidor
}
```

## Config en URL

Las gráficas de config-en-URL **se pueden incrustar igual que las guardadas**:
llevan enlace de oEmbed (`/api/oembed`) y etiquetas de reproductor, así que
pegar el link en Notion o Canva enseña la gráfica viva. Es la promesa de «no
hace falta cuenta» llevada hasta el final. Lo único que no tienen es póster —
nadie ha capturado nunca esa gráfica— así que no dan tarjeta con imagen.


```
/embed?c=<lz-string compressed base64url del JSON>
/embed/{id}                      # config desde BBDD
/embed/{id}?theme=dark           # overrides puntuales permitidos por query
```

- Compresión: `lz-string` `compressToEncodedURIComponent`.
- **Límite duro: 6000 caracteres** de URL total. Por encima se exige guardar en
  BBDD. Motivo: hay proxies y CMS que cortan por debajo de 8k.
- Overrides por query permitidos (whitelist, nada más): `theme`, `bg`,
  `transparent`, `autorotate`, `static`.
- `?static=1` fuerza el render de imagen sin WebGL.

## Defaults

Viven en un único sitio: `src/lib/config/defaults.ts`. Ningún componente puede
inventarse un default propio. Si el renderer necesita un valor que no está en el
config, sale de ahí — y de ningún otro lado.
