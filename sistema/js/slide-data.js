// Slide definitions — PDF-driven layout model.
//
// Each slide declares which *blocks* it has (title, text, image, iframe, tips)
// and a named `layout` that maps them onto a CSS grid via `grid-template-areas`.
// This mirrors the PDF precisely: each slide fits exactly one viewport, and the
// positioning of each piece within the slide varies per paso.
//
// Currently wired: pasos 1-7 with real PDF content, 8-9 as filler, 10-27 as
// generic filler (future batches).

export const sections = [
  { id:'introduccion', title:'Introducción',                       slides:[1] },
  { id:'descubriendo', title:'Descubriendo la Música',              slides:[2,3,4,5,6] },
  { id:'intervalos',   title:'Midiendo el movimiento: Los intervalos', slides:[7,8,9,10] },
  { id:'ampliando',    title:'Ampliando',                          slides:[11,12,13,14,15,16] },
  { id:'fraccionando', title:'Fraccionando',                       slides:[17,18,19,20,21] },
  { id:'escalas',      title:'Escalas',                            slides:[22,23,24,25,26,27] },
];

// Grid layouts — the skeleton shared across pasos. Each defines the grid areas
// and the row template. Inline `grid-template-*` is applied per-slide from
// these values. Keep the area names ('image', 'title', 'text', 'app', 'tips')
// stable: the renderer maps block types to area names by convention.
// Each layout declares its own `cols`, `rows`, and `areas`. The renderer
// applies them inline to the slide's grid. The default is a 3-column
// grid (1fr 1fr 1fr); intro slides override to 50/50.
export const layouts = {
  // Intro slides (1, 2, 11): image left 50% + title/text right 50%.
  // 2-column grid (PDF pages 1-2): the image and the text area share the
  // canvas equally.
  'A-intro': {
    cols:  '1fr 1fr',
    areas: '"image title" "image text"',
    rows:  'auto 1fr',
  },
  // App left (2 cols) + title/text/tips stacked on right (1 col).
  // Used by the majority of pasos (3, 6, 7, 8, ...).
  // Rows: title=auto, text=auto, tips=1fr — el row de tips absorbeix
  // l'espai vertical sobrant quan l'app és més alta que title+text+tips,
  // i amb `align-self: start` (regla específica B-app-left a grid.css)
  // la caixa verda queda enganxada just sota el text teòric, no al fons.
  'B-app-left': {
    cols:  '1fr 1fr 1fr',
    areas: '"app app title" "app app text" "app app tips"',
    rows:  'auto auto 1fr',
  },
  // App narrow left (1 col) + title/text on cols 2-3, tips confined to col 2.
  // Used by Paso 5 (Línea Sonora) — the vertical soundline is naturally
  // narrow, and the text block benefits from the wider right side while
  // the tips box stays in the middle column only (PDF behaviour).
  'D-app-narrow': {
    cols:  '1fr 1fr 1fr',
    areas: '"app title title" "app text text" "app tips ."',
    rows:  'auto 1fr auto',
  },
  // Title + text + app stacked on the left (2 cols), tips on the right
  // (1 col spanning all 3 rows). Tips is anchored to the top via the
  // layout-specific rule in grid.css (`.slide[data-layout="E-app-text-left"]
  // .slot-tips { align-self: start }`), so the green box sits at top-right
  // matching the PDF design.
  'E-app-text-left': {
    cols:  '1fr 1fr 1fr',
    areas: '"title title tips" "text text tips" "app app tips"',
    rows:  'auto 1fr auto',
  },
};

// Slide matrix — one entry per paso. Blocks are referenced in `slideContent`
// below; this matrix carries only structural info (section, layout, apps).
// Vertical fallback is now a pure CSS media query (`max-width: 900px`); no
// JS measurement is needed.
export const slideMatrix = [
  { paso:1,  section:'introduccion', title:'¿Te gustaría saber qué movimientos se producen en la música?', layout:'A-intro' },
  { paso:2,  section:'descubriendo', title:'Contar y Medir Música',                                       layout:'B-app-left', apps:['App11A'], aspect:'4/3', group:'plano-simple' },
  { paso:3,  section:'descubriendo', title:'Línea Temporal',                                              layout:'E-app-text-left', apps:['app9'],   aspect:'2/1', group:'timeline-simple' },
  { paso:4,  section:'descubriendo', title:'Línea Sonora',                                                layout:'D-app-narrow',apps:['app10'],  aspect:'2/3', group:'timeline-vertical' },
  { paso:5,  section:'descubriendo', title:'El Plano Musical',                                            layout:'B-app-left', apps:['app11'],  aspect:'4/3', group:'plano-simple' },
  { paso:6,  section:'descubriendo', title:'El par Nota - Pulso',                                      layout:'B-app-left', apps:['App12'],  aspect:'4/3', group:'plano-simple' },
  { paso:7,  section:'intervalos',   title:'Midiendo el movimiento de la Música: Los Intervalos',         layout:'A-intro' },
  { paso:8,  section:'intervalos',   title:'El Intervalo Temporal',                                       layout:'E-app-text-left', apps:['app13'], aspect:'2/1', group:'timeline-simple' },
  { paso:9,  section:'intervalos',   title:'El Intervalo Sonoro',                                         layout:'B-app-left', apps:['App14'],  aspect:'2/3', group:'timeline-vertical' },
  { paso:10, section:'intervalos',   title:'Intervalos en el Plano Musical',                              layout:'B-app-left', apps:['App15'],  aspect:'4/3', group:'plano-simple' },
  { paso:11, section:'ampliando',    title:'Ampliando el Mapa: Patrones, Ciclos y Módulos',               layout:'A-intro' },
  { paso:12, section:'ampliando',    title:'El compás: el módulo temporal',                               layout:'E-app-text-left', apps:['App16'],  aspect:'2/1', group:'timeline-complex' },
  { paso:13, section:'ampliando',    title:'Línea temporal en círculo',                                   layout:'B-app-left', apps:['App17'],  aspect:'1/1', group:'circular' },
  { paso:14, section:'ampliando',    title:'El registro de octava',                                       layout:'B-app-left', apps:['App18'],  aspect:'6/5', group:'timeline-vertical' },
  { paso:15, section:'ampliando',    title:'Plano Modular',                                               layout:'B-app-left', apps:['App19'],  aspect:'4/3', group:'plano-multi-pill' },
  { paso:16, section:'ampliando',    title:'Sucesión N-iT en Plano Modular',                              layout:'B-app-left', apps:['App20'],  aspect:'4/3', group:'plano-multi-pill' },
  { paso:17, section:'fraccionando', title:'Fraccionando la Línea Temporal',                              layout:'B-app-left', apps:['App26'],  aspect:'2/1', group:'timeline-simple' },
  { paso:18, section:'fraccionando', title:'Sucesión de Pulsos Fraccionados',                             layout:'B-app-left', apps:['App28'],  aspect:'2/1', group:'timeline-simple' },
  { paso:19, section:'fraccionando', title:'Sucesión de iT Fraccionados Simples',                         layout:'B-app-left', apps:['App30'],  aspect:'2/1', group:'timeline-simple' },
  { paso:20, section:'fraccionando', title:'Sucesión en Plano de Fracciones Simples',                     layout:'B-app-left', apps:['App32'],  aspect:'4/3', group:'plano-simple' },
  { paso:21, section:'fraccionando', title:'Fracciones Complejas',                                        layout:'B-app-left', apps:['App34','App35'], aspect:'4/3', variantLabels:['App34 · principal','App35 · extra'], group:'plano-simple' },
  { paso:22, section:'escalas',      title:'Escalas: Escogiendo Notas',                                   layout:'B-app-left', apps:['App21'],  aspect:'2/3', group:'scale' },
  { paso:23, section:'escalas',      title:'Estructura Escalar',                                          layout:'B-app-left', apps:['App22'],  aspect:'2/3', group:'scale' },
  { paso:24, section:'escalas',      title:'Transposición',                                               layout:'B-app-left', apps:['App23'],  aspect:'3/2', group:'scale' },
  { paso:25, section:'escalas',      title:'Probando diferentes Escalas',                                 layout:'B-app-left', apps:['App24'],  aspect:'3/2', group:'scale' },
  { paso:26, section:'escalas',      title:'Melodías con Escalas',                                        layout:'B-app-left', apps:['App25','App25B'], aspect:'4/3', variantLabels:['App25 · principal','App25B · iS'], group:'scale' },
  { paso:27, section:'escalas',      title:'Intervalos con Escalas',                                      layout:'B-app-left', apps:['App25B'], aspect:'4/3', group:'scale' },
];

// Content — real text for pasos 1-6 (from the PDF), filler for 7+.
// Each entry declares the blocks present in the slide. The renderer picks
// them up and places them into the layout's grid areas.
//
// Image source for paso 1: posa el fitxer a `sistema/images/paso-1.jpg`
// (o el nom que vulguis) i descomenta la línia `src` de sota.
export const slideContent = {
  1: {
    image: {
      alt: 'Foto introductoria — Imaginemos el seguimiento de una persona',
      src: 'images/paso-1.jpg',
    },
    text: `<p>Imaginemos el seguimiento de una persona en un día. Para conocer sus movimientos hay que saber en qué puntos ha estado, en qué momento y cuánto tiempo se ha quedado. A partir de esa información puedes deducir y trazar en un mapa cómo se ha movido la persona.</p>
<p>Las coordenadas de los puntos donde ha estado, la hora y el tiempo, incluso la velocidad para ir de un punto a otro, se pueden describir con <strong>números</strong>.</p>
<p>¿Es aplicable a la música? <em>SÍ!…</em></p>
<h3>Contar y Medir</h3>
<p><strong>Contar</strong> es calcular con números cuántas cosas hay. Empezamos a contar unidades con el 1; a continuación le siguen el 2, el 3, el 4, el 5…hasta el infinito.</p>
<p><strong>Medir</strong> es usar números para calcular la magnitud de algo. Puede ser una longitud, un peso, una temperatura, un intervalo de tiempo…</p>
<p>Para medir usamos herramientas con escalas numéricas: cintas métricas para medir longitudes, termómetros para medir temperaturas, balanzas para medir pesos y etc.</p>
<p>Los instrumentos de medida tienen una línea con las unidades de medida marcadas y numeradas.</p>
<p>La marca inicial es el número 0, el punto de partida de la medición. Los números que siguen nos permiten contar a cuantos pasos está cada punto del inicio.</p>
<p>Cada número marca el punto donde está y mide a qué distancia está del principio.</p>
<p>Por ejemplo, en una cinta métrica, el número 15 indica que está a 15 unidades de distancia del principio.</p>`,
  },
  2: {
    text: `<p>La música, como los movimientos de una persona en un día, podemos describirla y medirla con números.</p>
<p>Si vas por una calle, escuchas unos pasos, un coche que pasa, una puerta que se cierra y, al fondo, alguien silbando una melodía. Todo esto se mueve en un tiempo y un espacio determinados, en un orden concreto.</p>
<p><strong>¿Qué se mueve en la música?</strong></p>
<p>Para empezar partimos de dos líneas numéricas donde poder visualizar la música. Una línea para los sonidos y otra línea para el paso del tiempo, sincronizadas para describir lo que suena y plasmarlo en un plano musical. Las dos líneas tienen marcas numeradas; la marca de inicio es el número <strong>0</strong>.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Haz clic en <strong>Play</strong> para generar una secuencia aleatoria.</p>
<p><strong>Tip:</strong> El plano revela que la música tiene dos dimensiones inseparables: el sonido y el tiempo.</p>`,
  },
  3: {
    text: `<p>La línea temporal es horizontal y representa el movimiento en el tiempo. <br>En ella marcamos unos puntos equidistantes que representan una velocidad constante, como si fueran los segundos de un reloj. <br>Definimos esta velocidad con un número, que se conoce como BPM (Beats Per Minute).</p>
<p>A los puntos de la línea temporal los llamamos <strong>pulsos,</strong> y los numeramos. Como buen instrumento de medición el pulso de partida es el 0.</p>
<p>Los pulsos nos permiten marcar exactamente en qué instante se producen los sonidos. El tiempo en la música se tiene que medir con gran precisión.</p>
<p>Como la pulsación del corazón, un <strong>paso</strong> temporal es el tiempo que pasa entre dos pulsos consecutivos. Este paso es la unidad temporal que usaremos para medir cuánto dura un sonido.<br></p>
<p>Cuando contamos <strong>pasos</strong>, es natural hacerlo desde el 1: El paso 1 va del pulso 0 al 1, el paso 2 va del 1 al 2 etc…</p>`,
    tipsTitle: 'Prueba la Línea Temporal',
    tips: `<p>Haz clic en <strong>Play</strong> y escucha dos notas aleatorias en posiciones distintas de la línea temporal.</p>
<p>Ajusta el BPM entre 50 y 150 para escuchar la línea más rápido o más lento.</p>
<p><strong>Tip:</strong> En la línea temporal podemos visualizar el paso del tiempo marcado por los pulsos y oír un sonido que ocurre en un pulso y que dura una pulsación o paso.</p>`,
  },
  4: {
    text: `<p>La <strong>línea sonora</strong> representa los sonidos que crean la música. Los sonidos que usamos para empezar son las notas musicales. Cada punto de la línea es una nota de la escala cromática con su sonido característico.</p>
<p>A la primera nota le damos el número <strong>0</strong>. Es la nota de salida de la escala. Cada nota tiene su propio número para poder identificarla.</p>
<p>La línea sonora la colocamos en <em>vertical</em> para formar el plano con la línea temporal, así se ve muy bien la altura de cada nota. Las notas están organizadas en orden ascendente, de más grave a más aguda.</p>
<p>Las notas pueden seguir cualquier orden, pueden subir y bajar libremente creando así una <strong>melodía</strong>. El paso entre dos notas consecutivas es la unidad de medida que nos permite medir los movimientos de una melodía.</p>`,
    tipsTitle: 'Prueba Práctica',
    tips: `<p>La app muestra la línea sonora con 12 notas (0–11) donde puedes escuchar melodías.</p>
<p><strong>Uso básico:</strong> En la primera interacción, suena la escala cromática completa como introducción. A partir de la segunda, pulsa ▶ para reproducir melodías aleatorias de 6 notas.</p>
<p><strong>Tip:</strong> La primera escucha es siempre la escala cromática ascendente; sirve para mostrar las 12 notas antes de escucharlas en melodías aleatorias.</p>`,
  },
  5: {
    text: `<p>Si colocamos la línea temporal en horizontal y la línea sonora en vertical creamos un <strong>plano</strong> que representa el espacio donde va a sonar la música.</p>
<p>Es un mapa donde podemos ver cómo las notas van ocurriendo en el tiempo, cada una en su instante preciso.</p>
<p>A cada nota le corresponde un punto en el mapa. Cada punto tiene <strong>dos números</strong> que lo definen, como las coordenadas de un lugar en el mapa.</p>
<p>El primer número es la <em>nota</em> escogida y el segundo es el <em>pulso</em> donde está ubicada. Un pulso no puede tener más de una nota, igual que al cantar solo podemos cantar una nota a la vez.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Haz clic en cualquier celda del plano para escuchar su nota y ver sus coordenadas (nota · pulso).</p>
<p>Pulsa ▶ para escuchar de 4 a 8 notas aleatorias distribuidas en 8 pulsos.</p>
<p><strong>Tip:</strong> Prueba a hacer clic en varias celdas seguidas para explorar la relación entre posición en el plano y sonido. Las coordenadas de las notas desaparecen suavemente tras 1 segundo.</p>`,
  },
  6: {
    text: `<p>Ya tenemos el mapa para crear música moviéndonos a través de números.</p>
<p>Cada nota tendrá dos números distintos, sincronizados e interdependientes: uno define la nota y otro la sitúa en el tiempo; uno lo elegimos en la línea sonora, otro en la línea temporal.</p>
<p>Para distinguir los dos números les ponemos una letra delante, una <strong>N</strong> para la nota, <code>N(x)</code>, y una <strong>P</strong> para el pulso, <code>P(y)</code>.</p>
<p>Para crear una melodía, escogemos y ordenamos sucesiones de números. A cada número de una nota le corresponderá un número de pulso. Estamos ordenando sonidos en el tiempo.</p>
<p>Los números de la línea sonora pueden subir y bajar y se pueden repetir. También podemos usar un silencio en vez de una nota, escribiéndolo con <code>s</code>. Los números de la línea temporal solo pueden ir en una dirección y no se pueden repetir, como el paso del tiempo.</p>
<p>Nos regimos por la estructura del plano: 12 números para las notas (0–11) y 8 para los pulsos (0–7).</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Usa el <strong>editor N-P</strong> para introducir pares y crear una sucesión. O haz clic en celdas del plano para añadir o quitar notas.</p>
<p>Pulsa ▶ para reproducir, 🎲 para generar una sucesión aleatoria, 🗑 para borrar.</p>
<p><strong>Tip:</strong> Pasar del azar a la intención es el salto creativo fundamental. Es el primer paso hacia la composición consciente: decides tú qué nota suena en qué momento.</p>`,
  },
  7: {
    image: {
      alt: 'Foto introductoria — Midiendo el movimiento de la Música: Los Intervalos',
      src: 'images/paso-7.png',
    },
    text: `<p>Ya sabemos dónde están situadas las notas y los pulsos. Vamos a fijarnos ahora en sus movimientos, usando nuevos números para medirlos.</p>
<p>Los números que miden los movimientos se llaman <strong>intervalos</strong>.</p>
<p>Cada línea del plano tiene su intervalo característico. Los de la línea temporal miden las duraciones, los de la línea sonora los saltos de las notas. Son muy diferentes pero la idea es la misma: medir movimientos.</p>
<p>Los intervalos muestran los espacios que se van formando entre las notas, cómo se construye una melodía y permiten entender la esencia de su expresión.</p>`,
  },
  8: {
    text: `<h3>El intervalo temporal iT(n) mide la distancia entre dos pulsos escogidos.</h3>
<p>La unidad que usaremos para medir el tiempo que dura cada sonido es el paso temporal entre dos pulsos adyacentes. En el caso del iT(1) le corresponde una unidad de paso. El número del iT nos dice cuantas unidades, o sea, cuantos pasos dura un sonido.</p>
<p>Para calcular el iT que hay entre dos pulsos cualquiera solo hay que restar el número del primer pulso del número del segundo pulso. iT= P2 - P1. El resultado es siempre positivo ya que el P2 es siempre mayor que el P1.</p>
<p>Cada iT puede contener un sonido o un silencio; los silencios son muy importantes en la música.</p>
<p>Los iT dividen el tiempo total en partes, la suma de todos los iT da la duración total, o sea, la longitud.</p>
<p>Para definir un ritmo creamos una sucesión de iT.</p>`,
    tipsTitle: 'Prueba los iT en la línea',
    tips: `<p>Introduce tamaños de iT en los cuadros. La suma no puede superar 8.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una sucesión aleatoria, y 🗑 para borrar.</p>
<p><strong>Tip:</strong> Descubre cómo la distancia entre los sonidos crea el movimiento. Cambiar el orden de los iT cambia completamente el ritmo.</p>`,
  },
  9: {
    text: `<h3>El intervalo sonoro iS(n) mide la distancia entre dos notas consecutivas.</h3>
<p>Cada distancia define un salto melódico.</p>
<p>Usamos como unidad de medida una sola nota. Es el caso del iS(1). En el caso del iS(0) no hay salto y se repite la misma nota.</p>
<p>Para calcular el iS que hay entre dos notas solo hay que restar el número de la primera nota del número de la segunda nota. iS= N2 - N1.</p>
<p>El resultado puede ser positivo o negativo dependiendo del movimiento de las dos notas. Si N2 es mayor que N1 el resultado es positivo y el movimiento es ascendente. Si N2 es menor que N1 el resultado es negativo y el movimiento descendente.</p>
<p>El primer iS define la distancia entre la nota 0 y la primera nota de la melodía. De esta manera queda definida la primera nota de la sucesión.</p>
<p>La nota final de una sucesión es el resultado de ir sumando o restando los números de los iS consecutivos.</p>`,
    tipsTitle: 'Prueba los iS en la línea',
    tips: `<p>Escribe valores positivos o negativos de iS en el editor.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una sucesión aleatoria, 🗑 para borrar.</p>
<p><strong>Tip:</strong> El iS enseña que una melodía es movimiento: no solo importa dónde empieces, sino cuánto te mueves.</p>
<p>Observa cómo la línea sonora destaca los iS con flechas durante la reproducción. Los valores positivos suben y los negativos bajan.</p>`,
  },
  10: {
    text: `<p>Para componer una pequeña melodía desde el punto de vista del movimiento, combinamos una sucesión de iS sincronizados con iT.</p>
<p>El punto de salida es una nota situada en el par N(0)-P(0).</p>
<p>Los pares iS-iT van dibujando la melodía. El primer iS situa la primera nota en el plano.</p>
<p>Podemos escoger silencios en vez de notas escribiendo una "s" en los iS y darle la duración que queramos con el iT asociado.</p>`,
    tipsTitle: 'Prueba el Plano iS-iT',
    tips: `<p>Entra un número de iS para definir la primera nota. A continuación entra el número del iT para definir su duración.</p>
<p>Entra pares iS-iT hasta acabar la sucesión. Escribe "s" en la línea iS para introducir un silencio en el editor.</p>
<p>También puedes introducir notas clicando en los puntos (en la esquina inferior de las celdas) del plano y arrastrarlas para crear el iT.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para borrar.</p>
<p><strong>Tip:</strong> En esta App se juega con distancias en lugar de posiciones fijas. Es como la diferencia entre decir "ve a la calle 5" y "avanza 3 calles" — el mismo destino, dos formas de pensarlo.</p>`,
  },
  11: {
    image: {
      alt: 'Ilustración — Patrones, ciclos y módulos',
      src: 'images/paso-11.jpg',
    },
    text: `<p>La realidad está llena de ciclos: patrones que se repiten infinitamente o un cierto número de veces. Están en todas partes. En la naturaleza (estaciones del año, ciclos lunares, órbitas planetarias) y en la cultura humana, que crea los suyos propios (horas, días, meses, años, etapas de la vida, etc).</p>
<p>En matemáticas estos ciclos se llaman <b>módulos</b> y crean la aritmética modular, que es la base de muchas técnicas de cálculo.</p>
<p>En la música los <b>módulos</b> estructuran tanto el tiempo como el sonido. Ayudan a pensar en estructuras y a ordenar ideas musicales.</p>
<p>Por ejemplo, para contar todos los pulsos de una pieza, es más útil usar un módulo como el <b>compás</b>. Decimos que una canción tiene 40 compases de 4 en vez de 160 pulsos.</p>
<p>Los módulos nos permiten trabajar con una cantidad reducida de números que se repiten. Esto es muy útil para entender y analizar estructuras musicales.</p>`,
  },
  12: {
    text: `<p>El módulo temporal es el <strong>compás</strong>. El compás se repite las veces que queramos. Organiza los pulsos de la línea temporal en grupos.</p>
<p>El compás es una nueva "unidad de medida" que agrupa varios números en su interior, añadiendo estructura al grupo de números y facilitando ordenar estructuras mayores.</p>
<p>La cantidad de pulsos por compás es libre y hay que <b>decidirla a priori</b>. Aunque a partir de un cierto número de pulsos, la idea de compás no se percibe claramente y deja de tener sentido.</p>
<p>Cuando usamos compás, la numeración de los pulsos en la línea temporal es <b>modular</b>, o sea que vuelve a empezar en el <b>número 0</b> de cada nuevo compás.</p>
<p>Para indicar en qué compás está un pulso, le añadimos el número de compás como superíndice. Por ejemplo, para el Pulso 3 del compás 1, escribimos: P(3<sup>1</sup>).</p>`,
    tipsTitle: 'Prueba los Intervalos Temporales',
    tips: `<p>Esta app representa la línea de tiempo organizada con compases. Muestra 2 compases completos con un efecto para visualizar la repetición.</p>
<p>Entra un número en "Pulsos por Compás" y pulsa ▶️. Observa cómo la numeración de la línea temporal se repite mostrando la estructura del compás.</p>
<p><strong>Tip:</strong> La app muestra que el compás es un ciclo de números que se repiten. Usa + y − para cambiar el número de pulsos y observa como se adapta la línea sonora.</p>`,
  },
  13: {
    text: `<p>La visualización como círculo es muy útil para entender la <b>línea temporal con compás</b>.</p>
<p>La longitud total de la línea dependerá de cuántos pulsos tenga el compás y de cuantas repeticiones del compás definamos.</p>
<p>Al multiplicar los dos números se obtiene la <em>Longitud Total</em>. Por ejemplo, con compás de 3 Pulsos y 5 repeticiones nos da una <em>Longitud total</em> de 15 pulsos.</p>
<p>Además, organizar los Pulsos en un compás y repetirlo produce un carácter en la organización. Por ejemplo, el P(0) suele sonar más fuerte que el resto, indicando el principio del ciclo.</p>
<p>También es muy útil para definir un estilo rítmico: si acentuamos los Pulsos 1 i 3 en un compás de 4 creamos un ritmo popular.</p>`,
    tipsTitle: 'Prueba la Línea Temporal Circular',
    tips: `<p>Entra un número en "Pulsos por Compás" y otro en "Nº de Compases". La app reproduce el ejemplo. Observa como cambia el superíndice en los mismos pulsos.</p>
<p>Compara esta representación circular con la lineal del paso 12. Mismo concepto, dos visualizaciones. El círculo hace evidente lo que la línea sugiere. La música no avanza solo en línea sino que <b>gira</b> para volver al siguiente <b>punto de partida</b>, creando espirales en el tiempo.</p>`,
  },
  14: {
    text: `<h2>El <b>módulo</b> de las notas</h2>
<p>La totalidad de las notas usadas se organizan en módulos de 12 notas que se repiten. Se numeran del 0 al 11. El 0 corresponde a la nota Do.</p>
<p>Esta estructura de 12 notas es fija, y se llama <strong>registro de octava</strong>.</p>
<p>Hay ocho registros básicos numerados del 0 al 7. Del 0 al 2 son los registros graves, del 3 al 5 registros medios y el 6 y 7 los registros agudos.</p>
<p>El registro en el que está una nota se puede escribir de dos maneras: como superíndice N(6^2) o después de la letra r N(6r2).</p>`,
    tipsTitle: 'Prueba el registro sonoro',
    tips: `<p>Introduce un número de registro o cambialo con las flechas. La app reproduce una secuencia aleatoria de 6 notas.</p>
<p>Clica en las notas de la línea sonora para reproducirlas individualmente. Pulsa ▶️ para reproducir la secuencia otra vez.</p>
<p>La nota 0 está resaltada en rosa para marcar el inicio de cada registro. El registro 4 corresponde al Do central del piano (nota C4).</p>`,
  },
  15: {
    text: `<p>Al plano musical podemos añadirle los módulos registro y compás en las líneas para crear música más variada o compleja.</p>
<p>En el plano queda representado el registro de cada nota y el compás de cada pulso.</p>
<p>Cada par Nota-Pulso lleva los superíndices que especifican el registro y el compás.</p>
<p>Podemos repetir una misma idea melódica en diferentes registros y/o modificar las repeticiones cambiando el pulso en que suenan.</p>`,
    tipsTitle: 'Prueba el Plano Modular',
    tips: `<p>Introduce un Compás y Nº Compases para modificar el plano modular, que calcula automáticamente la longitud total de pulsos. Los registros de salida inicial son 3 y 4.</p>
<p>Haz clic en las celdas del plano para crear notas. Usa el scroll o los spinners para moverte entre los registros.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para borrar.</p>
<p>Usa el scroll vertical para moverte entre registros y el horizontal para moverte por los compases.</p>`,
  },
  16: {
    text: `<p>Podemos crear melodías desde las <b>posiciones</b> (par N-P), como en el paso 6, o desde los <b>movimientos</b> (par iS-iT), como en el paso 10. Ahora vamos a crear melodías usando <strong>posiciones</strong> y <strong>distancias</strong>: escogiendo directamente la nota y asignándole una duración.</p>
<p>La <strong>sucesión N-iT</strong> define cada nota y cuánto tiempo suena. El número de la <strong>N</strong> nos dice qué nota es, y el número del <strong>iT</strong> nos dice cuántos pasos dura. Juntos crean el par usado en la notación tradicional.</p>
<p>Observa cómo la misma sucesión de N suena muy diferente si cambias los iT: alargar o acortar las duraciones transforma completamente el carácter de la melodía sin cambiar ninguna nota.</p>
<p>En el plano modular, las notas llevan su <strong>registro</strong> y los pulsos su <strong>compás</strong>. Así podemos crear melodías que se extiendan por varios registros y varios compases, acercándonos a una composición real.</p>`,
    tipsTitle: 'Prueba la Sucesión N-iT',
    tips: `<p>Ajusta Compás, Nº y Compases. El plano se adapta. Usa el editor para crear sucesiones N-iT. O haz clic y arrastra en las celdas del plano.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para borrar.</p>
<p><strong>Tip:</strong> Esta app combina el par N-iT, que es conceptualmente el par usado al escribir con notación musical.</p>`,
  },
};

// Default filler for pasos without explicit content yet.
export const fillerContent = {
  text: `<p>Este paso está pendiente de redactar. El esqueleto del Sistema está listo; cuando tengamos el texto teórico final del PDF o el material equivalente, se integrará aquí sustituyendo este marcador.</p>
<p>La densidad aquí será similar a la de los pasos ya redactados: 3 a 5 párrafos de 40–70 palabras, con términos clave en <strong>negrita</strong> y referencias cruzadas a apps vecinas cuando aplique.</p>`,
  tipsTitle: 'Tips de práctica',
  tips: `<p>Un consejo concreto aparecerá aquí cuando se redacte el contenido — una pista para usar la app y una observación sobre lo que se está aprendiendo.</p>`,
};
