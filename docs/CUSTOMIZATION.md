# Personalización

Cómo se plantea el apartado de personalización de Volumine: qué se puede tocar,
cómo se le presenta a la gente y qué reglas lo mantienen coherente.

Complementa `docs/chart-config-schema.md` (el contrato) y `docs/DESIGN.md` (el
listón visual). Aquí va el **criterio**, no la lista de campos.

## El problema real

"Mucha personalización" hecha mal produce siempre lo mismo: un panel con
cuarenta controles donde el usuario toca tres, deja el resto por defecto, y
consigue una gráfica peor que la que le dimos al empezar. Y a nosotros nos deja
un espacio de configuración imposible de testear.

Lo que la gente quiere no es tocar cuarenta cosas. Es **que se parezca a lo
suyo** en dos minutos, y poder afinar un detalle concreto si le apetece.

## Los cuatro principios

**1. Bonito por defecto, no neutro por defecto.**
El estado inicial de cualquier gráfica ya tiene que ser presentable. Nada de
gris con bordes de 1px esperando a que el usuario lo arregle. Si alguien publica
sin tocar nada, el resultado nos representa igual.

**2. Tres niveles de profundidad, y cada uno completo por sí solo.**

| Nivel        | Quién         | Qué toca                                       | Cuántos controles |
| ------------ | ------------- | ---------------------------------------------- | ----------------- |
| **Tema**     | todo el mundo | un preset entero de una vez                    | 1                 |
| **Ajustes**  | la mayoría    | color, grosor, canto, fondo, movimiento        | ~10               |
| **Avanzado** | minoría       | material, luz, cámara, post-proceso, etiquetas | el resto          |

Nadie debería tener que bajar de nivel para conseguir algo razonable. El nivel 1
solo tiene que ser suficiente para publicar.

**3. Nada de estados inválidos alcanzables.**
Si una combinación produce una gráfica fea o rota, no se ofrece. Los rangos de
los controles son los rangos **seguros**, calculados: el slider de canto va de 0
al máximo que la geometría admite sin que las piezas se toquen (ver las cuatro
restricciones de `geometry/donut.ts`), no de 0 a 1 con la esperanza de que el
usuario no llegue al final.

Esto es lo contrario de lo habitual y es deliberado: **preferimos un control con
menos recorrido que un control que puede romper el resultado.**

**4. Todo lo que se puede tocar tiene que ser inspeccionable y compartible.**
Cualquier ajuste vive en el `ChartConfig`, viaja en la URL y se puede leer. Si
algo solo existe en el estado del editor, no existe.

## Los ejes de personalización

Ordenados por cuánto cambian la percepción del resultado. Es también el orden en
que deben aparecer en la interfaz.

### 1. Color — el que más importa

- **Paleta**: presets curados + paleta propia + generación desde un color de
  marca (armonías: análoga, complementaria, monocroma).
- **Por segmento**: override puntual, porque siempre hay un "este tiene que ser
  el rojo de la empresa".
- **Modo**: `cycle` (colores discretos) o `gradient` (interpolación entre dos
  extremos), que es lo que hace que una gráfica con 12 categorías no parezca un
  arcoíris.

Regla dura: **las paletas se validan renderizadas en 3D, no como muestras
planas.** Dos colores que se distinguen bien en un cuadradito pueden fundirse
bajo luz IBL sobre una superficie curva. Ya pasó con menta y cian en `aurora`.

Además, contraste comprobado contra el fondo y ninguna información transmitida
solo por color (`docs/DESIGN.md`).

### 2. Fondo

`transparent` es el valor más importante de todos y tiene que estar el primero:
es lo que permite que el embed se funda con la página anfitriona. Luego sólido,
degradado, y tramas (rejilla, puntos).

### 3. Forma

Canto (`bevel`), grosor, radio interior, separación, separación radial
(`explode`). Es la identidad visual del producto, así que los rangos son
generosos **dentro de lo seguro**.

### 4. Material y luz

Presets con nombre (`physical`, `matte`, `glass`, `metal`, `toon`) antes que
sliders de `roughness`/`metalness`. La gente sabe si quiere que parezca plástico
o metal; no sabe qué es la rugosidad. Los sliders existen debajo, en avanzado.

Igual con la luz: entornos con nombre (`studio`, `sunset`, `night`…) y solo
después intensidad. Y con el techo puesto: por encima de ~0.7 el IBL lava el
color y todo parece plastilina, así que el slider **no llega ahí**.

### 5. Movimiento

Rotación, velocidad, animación de entrada, comportamiento al pasar el ratón.
`prefers-reduced-motion` se respeta siempre y la alternativa es digna, no rota.

### 6. Etiquetas y tipografía

Dentro/fuera/leyenda, valores, porcentajes, tamaño. Fuentes **del set local**,
nunca una URL remota (ADR 0005).

## Temas

Un tema es un `Partial<ChartConfig>` con nombre: paleta + fondo + material +
entorno + movimiento, coherentes entre sí.

- Viven en `src/lib/themes/`, versionados con el código.
- Aplicar un tema **rellena** campos, no los bloquea: cualquier ajuste posterior
  del usuario gana. En el config se guarda `theme` más los overrides, no el
  resultado aplanado — así, si mejoramos un tema, las gráficas que lo usan
  mejoran solas.
- Cada tema entra con captura renderizada de los tres tipos de gráfica, en claro
  y oscuro. Un tema que no se ha mirado no entra.

## Los datos van primero

El panel empieza por los datos y no por el aspecto. Ordenarlo al revés convierte
la herramienta en un juguete de estilo con unos números de ejemplo pegados.

Reglas que se derivan de cómo llega la gente aquí, con su hoja de cálculo ya
abierta:

- **Pegar es la vía principal.** Nadie teclea veinte celdas teniendo el Excel al
  lado. La tabla acepta un pegado completo en cualquier celda.
- **Se traga el formato de su hoja**, incluido el español con coma decimal y
  punto de miles. Pedirle a alguien que "limpie los datos antes" es pedirle que
  se vaya.
- **Cambiar de tipo no borra sus datos.** Solo se sustituyen los de ejemplo.
- Lo que el sistema adivina —si hay cabecera— se dice y se puede cambiar.

## Reglas de la interfaz

- **Vista previa en vivo, siempre.** Cada control se refleja al instante. Es la
  única forma de que la gente explore sin miedo.
- **Deshacer/rehacer sobre el config completo.** Barato de implementar (el
  config es la única fuente de verdad) y cambia por completo la disposición a
  experimentar.
- **Un control = un campo del esquema.** Nada de controles que tocan tres cosas
  a la vez; eso hace imposible razonar sobre el resultado y sobre los tests.
- **Valores con su unidad y cifras tabulares.** Un slider sin número es un
  slider que no se puede reproducir ni comunicar.
- **Restablecer por sección**, no solo global.

## Lo que NO se personaliza, y por qué

- **La marca de agua del plan gratuito.** La decide el servidor al servir la
  config. Si la decidiera el cliente sería trivial quitarla (ADR 0005).
- **El presupuesto de rendimiento.** No hay un "modo alta calidad" que se salte
  `docs/PERFORMANCE-BUDGET.md`. Los ajustes caros (post-proceso, sombras) son
  opt-in y se cargan aparte, pero el suelo no se toca.
- **`prefers-reduced-motion`.** Se puede forzar el movimiento a _apagado_, nunca
  a _encendido_ por encima de la preferencia del usuario.
- **Fuentes remotas y CSS arbitrario en el embed.** Es la puerta de entrada a
  romper las tres reglas duras de un tirón.

## Cómo se prueba

- Cada campo nuevo entra con su control en `/dev/renderer`.
- Regresión visual con Playwright sobre configs mínima, completa y límite.
- Cada tema, contra los tres tipos de gráfica, en claro y oscuro.
- Los rangos seguros son **tests unitarios**, no comentarios: si el máximo del
  canto se calcula mal, salta un test, no un usuario.
