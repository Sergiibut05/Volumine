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
  "show": true,
  "mode": "outside", // "none" | "outside" | "inside" | "legend"
  "showValues": true,
  "showPercent": false,
  "font": "inter", // fuente del set local; NUNCA una URL remota
  "size": 1,
  "color": "auto", // "auto" = contraste calculado contra el fondo
  "title": { "show": true, "position": "top" },
}
```

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
