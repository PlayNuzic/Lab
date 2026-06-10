# Textos teóricos — Capítulo oculto "Fracciones Complejas"

> **Borrador para revisión.** Estos textos están pensados para sustituir los placeholders actuales de los pasos `17.5`, `18.5`, `19.5` y `20.5` del Sistema (que ahora heredan literalmente del texto del paso simple correspondiente). No tocan el `slide-data.js`; cuando los apruebes, los aplico.
>
> **Apps implicadas:** App27 (17.5), App29 (18.5), App31 (19.5), App35 (20.5).
>
> **Criterios de estilo** (mirando 17/18/19/20):
> - 3-5 párrafos de 40-70 palabras. Densidad similar a los pasos previos.
> - Términos clave en **negrita** (`<b>` o `<strong>`).
> - Notación coherente: P, Pfr, iT, iTfr, **PFr** (mayúsculas en N grande, minúsculas para subdivisión). En la documentación de origen aparece **PFr** y **iTFr** — uso esa convención.
> - "Caja verde" (tips) = 3-4 párrafos: instrucciones operativas + último párrafo con `<b>Tip:</b>` o `<b>Tips:</b>` con la moraleja conceptual.
> - Cada complejo es la versión "n/d con n>1" del simple. El gancho narrativo: pasar de "una velocidad relativa" a "un ciclo que abarca varios pulsos".

---

## Paso 17.5 — Fraccionando la Línea Temporal · Complejas

**App:** App27 — Visualiza fracciones complejas (n/d, n>1) en una sección de la línea temporal.

### `title`

```
Fraccionando la Línea Temporal · Complejas
```

(sin cambios respecto al actual)

### `text`

```html
<p>En el paso anterior subdividimos cada pulso entero con <b>fracciones simples</b> (1/d): el numerador era siempre 1 y el ciclo encajaba dentro de un solo pulso. Ahora ampliamos el lenguaje a las <b>fracciones complejas</b>, donde el numerador es <b>mayor que 1</b>. La fracción n/d ya no se agota dentro de un pulso, sino que define un <b>ciclo de varios pulsos</b>.</p>
<p>El numerador <b>n</b> dice cuántos pulsos enteros abarca el ciclo; el denominador <b>d</b> dice en cuántas partes iguales se divide ese ciclo. Por ejemplo, con 2/3 cada dos pulsos enteros se reparten en tres partes iguales; con 3/4, cada tres pulsos se reparten en cuatro. Los nuevos pulsos fraccionados (<b>PFr</b>) ya no van de pulso entero a pulso entero, sino que crean pulsos a una velocidad propia en un ciclo que se repite cada pulsos del numerador.</p>
<p>La nueva velocidad de los PFr se calcula con la relación <b>(d × BPM) / n</b>. Si <b>n &lt; d</b> los PFr van <b>más rápidos</b> que los pulsos enteros; si <b>n &gt; d</b> van <b>más lentos</b>; si <b>n = d</b> coinciden con el pulso entero. Por eso 2/3 acelera la velocidad (3 PFr en el espacio de 2 pulsos) mientras que 3/2 reduce la velocidad (2 PFr en el espacio de 3 pulsos).</p>
<p>Para que un ciclo complejo encaje exactamente en la línea temporal, la <b>Longitud fraccionada (LgFr)</b> debe ser divisible por el numerador. Si la fracción es <b>reducible</b> (p.ej. 2/4 = 1/2) la velocidad es la misma que la simple equivalente pero el ciclo es más largo. Si <b>n y d son primos entre sí</b> (p.ej. 2/3, 3/4, 3/5) la fracción tiene una pulsación propia que no se reduce a ninguna simple.</p>
```

### `tipsTitle`

```
Prueba las fracciones complejas
```

### `tips`

```html
<p>Visualiza fracciones complejas (n/d, n &gt; 1) sobre una sección de la línea temporal. El ciclo abarca <b>n pulsos enteros</b> divididos en <b>d partes iguales</b>.</p>
<p>Cambia <b>numerador</b> y <b>denominador</b> de forma independiente con los botones <strong>+</strong> y <strong>-</strong>. Observa cómo cambia la velocidad de los PFr respecto a los pulsos enteros.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una fracción aleatoriamente, 🗑 para reiniciar.</p>
<p><b>Tip:</b> Las fracciones complejas abren un nivel rítmico que las simples no alcanzan: el ciclo polirrítmico. Compara 2/3 (tresillo sobre dos pulsos), 3/4 (cuatro sobre tres) y 3/2 (dos sobre tres) — el mismo BPM, tres relaciones temporales distintas. Si la fracción se puede reducir (p.ej. 4/6 = 2/3), la velocidad es la misma pero el ciclo dura el doble.</p>
```

---

## Paso 18.5 — Sucesión de Pulsos Fraccionados · Complejas

**App:** App29 — Crea sucesiones de PFr sobre fracciones complejas (editor Pfr cell-based).

### `title`

```
Sucesión de Pulsos Fraccionados · Complejas
```

### `text`

```html
<p>Igual que con las fracciones simples, también podemos crear ritmos seleccionando <b>pulsos fraccionados (PFr)</b> sobre una <b>fracción compleja</b>. La diferencia es que ahora el ciclo abarca varios pulsos enteros, así que la sucesión se mueve sobre un espacio rítmico más amplio antes de repetirse.</p>
<p>Escogemos una fracción n/d y construimos la sucesión: P ⅔( 0.2 1.1 3.2 ...). El primer dígito sigue siendo el pulso entero; el segundo, la posición del PFr dentro del ciclo. Como un ciclo complejo abarca varios pulsos, la numeración de los PFr <b>se reinicia cada n pulsos</b>, no cada pulso.</p>
<p>Los <b>PFr complejos</b> permiten componer ritmos con una pulsación independiente que no encaja dentro de un solo pulso entero. Es la base de las <b>polirritmias</b>: dos velocidades simultáneas que comparten un mismo BPM pero recorren el ciclo de manera distinta.</p>
<p>Mantén la sucesión y prueba a cambiar el numerador o el denominador para escuchar cómo el mismo patrón de números suena con una pulsación diferente. O mantén la fracción y desplaza los PFr para variar el ritmo dentro del mismo ciclo polirrítmico.</p>
```

### `tipsTitle`

```
Prueba la sucesión de PFr complejos
```

### `tips`

```html
<p>Crea una sucesión de pulsos fraccionados (PFr) sobre fracciones complejas (n/d, n &gt; 1).</p>
<p>Edita <b>numerador</b> y <b>denominador</b> independientemente. Crea la sucesión escribiendo en el editor el pulso entero + la posición del PFr (p.ej. <b>1.2</b>), o selecciona directamente los PFr en la línea temporal fraccionada.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p>
<p><b>Tips:</b> Una misma sucesión de PFr cambia radicalmente al alterar la fracción. Por ejemplo, prueba PFr(0.1 1.2 2.1) en 2/3, 3/4 y 3/5 — los números son los mismos, la pulsación es completamente distinta. Las fracciones reducibles (p.ej. 4/6) suenan igual que su forma simple equivalente (2/3) pero alargan el ciclo audible.</p>
```

---

## Paso 19.5 — Sucesión de iT Fraccionados · Complejas

**App:** App31 — Editor iTfr cell-based sobre fracciones complejas.

### `title`

```
Sucesión de iT Fraccionados · Complejas
```

### `text`

```html
<p>El intervalo temporal fraccionado (<b>iTFr</b>) mide la <b>distancia entre dos PFr</b> consecutivos, igual que el iT mide la distancia entre dos pulsos enteros. Con fracciones complejas, esa distancia se cuenta en unidades del nuevo ciclo: cada iTFr abarca una o más subdivisiones del ciclo n/d.</p>
<p>Como el ciclo complejo abarca varios pulsos enteros, el <b>total de iTFr disponibles</b> es <b>Lg × d / n</b>: la longitud de la línea por el denominador, dividida por el numerador. La suma de todos los iTFr de una sucesión equivale a este total — son las piezas en las que repartimos el ciclo entero.</p>
<p>Con una sucesión de iTFr complejos podemos pensar los ritmos como <b>duraciones dentro de una polirritmia</b>: ya no son sólo puntos en el ciclo (PFr), sino bloques de tiempo con peso y presencia, cada uno con su propia longitud relativa al ciclo n/d.</p>
```

### `tipsTitle`

```
Prueba los iTFr complejos
```

### `tips`

```html
<p>Combina fracciones complejas (n/d, n &gt; 1) con intervalos temporales fraccionados.</p>
<p>Edita <b>numerador</b> y <b>denominador</b>. Crea la sucesión de <b>iTFr</b> introduciendo duraciones en el editor o arrastrando sobre la línea temporal fraccionada para crear intervalos.</p>
<p>El display de suma de iT y iT disponibles se actualiza para mostrar cuántos iTFr hay en cada momento. Cada iTFr suena como una nota melódica: la primera nota de cada ciclo es Do4, las demás Sol4. Haz clic en un intervalo para eliminarlo.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p>
<p><b>Tips:</b> Pensar las polirritmias como duraciones (iTFr) y no como posiciones (PFr) cambia la sensación de movimiento: cada bloque tiene peso propio dentro del ciclo. Prueba la misma sucesión de iTFr en 2/3 y 3/4 — los bloques se mantienen, pero la velocidad relativa al pulso entero cambia por completo.</p>
```

---

## Paso 20.5 — Plano 2D · Sucesión N-iT con Fracciones Complejas

**App:** App35 — Plano 2D + editor N-iT zigzag + fracción compleja.

### `title`

```
Plano 2D · Sucesión N-iT con Fracciones Complejas
```

### `text`

```html
<p>Si llevamos los <b>iTFr complejos</b> al plano 2D y los repartimos por la línea sonora, podemos crear melodías con una <b>identidad polirrítmica propia</b>. Cada melodía no sólo tiene un perfil de notas, sino también una pulsación que no encaja dentro del pulso entero — un carácter rítmico que las fracciones simples no podían dar.</p>
<p>El editor N-iT funciona igual que con fracciones simples: cada par define una nota y su duración en iTFr. Pero ahora la duración se mide dentro del ciclo n/d, no del pulso entero. Una misma sucesión N-iT cambia completamente de carácter al pasar de 2/3 a 3/4 o a 3/5, aunque las notas y las duraciones numéricas sean las mismas.</p>
<p>Es la herramienta más expresiva del capítulo: combina el plano (notas + tiempo a la vez), las fracciones complejas (pulsación polirrítmica propia) y los iTFr (duraciones con peso). Permite componer melodías que respiran a un ritmo distinto del pulso entero conservando coherencia interna.</p>
```

### `tipsTitle`

```
Prueba el Plano N-iT con fracciones complejas
```

### `tips`

```html
<p>Combina el plano fraccionado complejo con el editor zigzag para crear sucesiones N-iT polirrítmicas.</p>
<p>Edita <b>numerador</b> y <b>denominador</b> de la fracción. Usa el editor para introducir pares N-iT o arrastra sobre el plano para crear notas con duración.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p>
<p><b>Tips:</b> Mantén una sucesión N-iT y ve cambiando la fracción: la misma melodía aparece en versiones polirrítmicas distintas. Es una forma directa de descubrir cómo una idea musical se transforma al cambiar la pulsación subyacente sin tocar ni las notas ni los números de duración. El plano muestra el resultado visual, el editor las relaciones numéricas — pensar ambas a la vez conecta el lenguaje rítmico con la forma geométrica.</p>
```

---

## Notas sobre las decisiones

1. **PFr vs Pfr**: en el texto que me has dado aparece como `PFr` (mayúsculas). En la documentación interna mezcla `Pfr` y `PFr`. He usado **PFr** en los textos teóricos (más visible para la "F") pero los placeholders actuales del Sistema usan `Pfr`. Si prefieres mantener `Pfr` para no romper la coherencia con los pasos simples, lo cambio.
2. **iTFr vs iTfr**: misma decisión. He usado `iTFr` en los textos nuevos. Los pasos simples actuales usan `iTfr`. Te dejo elegir.
3. **Velocidad (d × BPM) / n**: he convertido las fórmulas de tu apunte ("N×BPM/D" etc.) a la convención n/d coherente con el código existente (donde `n` = numerador, `d` = denominador). Si tu apunte usa N=numerador, D=denominador, la fórmula correcta es **(d × BPM) / n** — más lento cuando n > d, más rápido cuando n < d. Está revisado para coincidir con tu apunte.
4. **Tip pedagógico del 17.5**: he añadido el dato de **fracciones reducibles** que mencionas en tu apunte ("Reducibles → misma velocidad, diferente longitud de ciclo") porque me ha parecido la sutileza clave que diferencia el complejo. Si te resulta denso, lo simplifico.
5. **Longitud (LgFr)**: la nota "LgFr debe ser divisible por numerador" la he integrado en el texto del 17.5 como condición de encaje. Si prefieres que sea una tip operativa en lugar de teoría, la muevo a la caja verde.

¿Procedo con cambios o quieres que ajuste algo antes de tocar `slide-data.js`?
