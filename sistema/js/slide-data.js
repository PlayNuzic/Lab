// Slide definitions — PDF-driven layout model.
//
// Each slide declares which *blocks* it has (title, text, image, iframe, tips)
// and a named `layout` that maps them onto a CSS grid via `grid-template-areas`.
// This mirrors the PDF precisely: each slide fits exactly one viewport, and the
// positioning of each piece within the slide varies per paso.
//
// Currently wired: pasos 1-7 with real PDF content, 8-9 as filler, 10-26 as
// generic filler (future batches).

export const sections = [
  { id:'introduccion', title:'Introducción',                       slides:[1,1.5] },
  { id:'descubriendo', title:'Descubriendo la Música',              slides:[2,3,4,5,6] },
  { id:'intervalos',   title:'Midiendo el movimiento: Los intervalos', slides:[7,8,9,10] },
  { id:'ampliando',    title:'Ampliando',                          slides:[11,12,13,14,15,16] },
  { id:'fraccionando', title:'Fraccionando',                       slides:[17,17.5,18,18.5,19,19.5,20,20.5] },
  { id:'escalas',      title:'Escalas',                            slides:[21,22,23,24,25,26] },
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
  { paso:1,    section:'introduccion', title:'¿Te gustaría saber cómo se mueve la música?', layout:'A-intro' },
  { paso:1.5,  section:'introduccion', title:'¿Te gustaría saber cómo se mueve la música?', layout:'A-intro', hidden:true, intro:true },
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
  { paso:15, section:'ampliando',    title:'Plano Modular',                                               layout:'B-app-left', apps:['App19'],  aspect:'4/3', group:'plano-multi-pill', requiresLandscape:true },
  { paso:16, section:'ampliando',    title:'Sucesión N-iT en Plano Modular',                              layout:'B-app-left', apps:['App20'],  aspect:'4/3', group:'plano-multi-pill', requiresLandscape:true },
  { paso:17,   section:'fraccionando', title:'Fraccionando la Línea Temporal',                              layout:'E-app-text-left', apps:['App26'],  aspect:'5/2', group:'timeline-simple' },
  { paso:17.5, section:'fraccionando', title:'Ciclos en la Línea Temporal',                                  layout:'E-app-text-left', apps:['App27'],  aspect:'5/2', group:'timeline-simple', hidden:true, complex:true },
  { paso:18,   section:'fraccionando', title:'Sucesión de Pulsos Fraccionados',                             layout:'E-app-text-left', apps:['App28'],  aspect:'5/2', group:'timeline-simple' },
  { paso:18.5, section:'fraccionando', title:'Sucesión de Pfr en ciclos polirrítmicos',                      layout:'E-app-text-left', apps:['App29'],  aspect:'5/2', group:'timeline-simple', hidden:true, complex:true },
  { paso:19,   section:'fraccionando', title:'Sucesión de iT Fraccionados',                                 layout:'E-app-text-left', apps:['App30'],  aspect:'2/1', group:'timeline-simple' },
  { paso:19.5, section:'fraccionando', title:'Sucesión de iTfr en ciclos polirrítmicos',                     layout:'E-app-text-left', apps:['App31'],  aspect:'2/1', group:'timeline-simple', hidden:true, complex:true },
  { paso:20,   section:'fraccionando', title:'Plano fraccionado con sucesión N-iTfr',                      layout:'B-app-left',      apps:['App34'],  aspect:'3/4', group:'plano-simple' },
  { paso:20.5, section:'fraccionando', title:'Plano con fracciones complejas',                              layout:'B-app-left',      apps:['App35'],  aspect:'3/4', group:'plano-simple', hidden:true, complex:true },
  { paso:21, section:'escalas',      title:'Escalas: Escogiendo Notas',                                   layout:'B-app-left', apps:['App21'],  aspect:'2/3', group:'scale' },
  { paso:22, section:'escalas',      title:'Estructura Escalar',                                          layout:'B-app-left', apps:['App22'],  aspect:'2/3', group:'scale' },
  { paso:23, section:'escalas',      title:'Transposición',                                               layout:'B-app-left', apps:['App23'],  aspect:'2/3', group:'scale' },
  { paso:24, section:'escalas',      title:'Probando diferentes Escalas',                                 layout:'B-app-left', apps:['App24'],  aspect:'2/3', group:'scale' },
  { paso:25, section:'escalas',      title:'Melodías con Escalas',                                        layout:'B-app-left', apps:['App25'],  aspect:'4/3', group:'scale' },
  { paso:26, section:'escalas',      title:'Intervalos con Escalas: el iSº',                              layout:'B-app-left', apps:['App25B'], aspect:'4/3', group:'scale' },
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
    text: `<p>Imaginemos el seguimiento de una persona durante un día. Para conocer sus movimientos hay que saber en qué puntos ha estado, en qué momento y cuánto tiempo se ha quedado. A partir de esa información puedes deducir y trazar en un mapa cómo se ha movido la persona.</p>
<p>Las coordenadas de los puntos donde ha estado, la hora y el tiempo, incluso la velocidad para ir de un punto a otro, se pueden describir con <strong>números</strong>.</p>
<h3>Contar y Medir</h3>
<p><strong>Contar</strong> es calcular con números cuántas cosas hay. Empezamos a contar unidades con el 1; a continuación le siguen el 2, el 3, el 4, el 5…hasta el infinito.</p>
<p><strong>Medir</strong> es usar números para calcular la magnitud de algo. Puede ser una longitud, un peso, una temperatura, un intervalo de tiempo…</p>
<p>Para <b>medir</b> usamos herramientas con escalas numéricas. Estos instrumentos tienen una línea con las unidades de medida marcadas y numeradas. La marca inicial es el <b>número 0</b>, el punto de partida de la medición. Los números que siguen nos permiten contar a cuantos pasos está cada punto del inicio.</p>
<h3>¿Todo esto es aplicable a la música?</h3>`,
  },
  // Capítol amagat — versió animada del pas 1 amb vídeo introductori
  // en lloc de la foto. Mateix text. Es desbloqueja amb 5 clicks al
  // badge del pas 1 (vegeu state.introUnlocked a slides.js).
  1.5: {
    video: {
      alt: 'Vídeo introductori animat — el seguiment d\'una persona',
      src: 'videos/paso-1.mp4',
    },
    text: `<p>Imaginemos el seguimiento de una persona durante un día. Para conocer sus movimientos hay que saber en qué puntos ha estado, en qué momento y cuánto tiempo se ha quedado. A partir de esa información puedes deducir y trazar en un mapa cómo se ha movido la persona.</p>
<p>Las coordenadas de los puntos donde ha estado, la hora y el tiempo, incluso la velocidad para ir de un punto a otro, se pueden describir con <strong>números</strong>.</p>
<h3>Contar y Medir</h3>
<p><strong>Contar</strong> es calcular con números cuántas cosas hay. Empezamos a contar unidades con el 1; a continuación le siguen el 2, el 3, el 4, el 5…hasta el infinito.</p>
<p><strong>Medir</strong> es usar números para calcular la magnitud de algo. Puede ser una longitud, un peso, una temperatura, un intervalo de tiempo…</p>
<p>Para <b>medir</b> usamos herramientas con escalas numéricas. Estos instrumentos tienen una línea con las unidades de medida marcadas y numeradas. La marca inicial es el <b>número 0</b>, el punto de partida de la medición. Los números que siguen nos permiten contar a cuantos pasos está cada punto del inicio.</p>
<h3>¿Todo esto es aplicable a la música?</h3>`,
  },
  2: {
    text: `<p>La música, como los movimientos de una persona en un día, podemos describirla y medirla con números.</p>
<p>Si vas por una calle, escuchas unos pasos, un coche que pasa, una puerta que se cierra y, al fondo, alguien silbando una melodía. Todo esto se mueve en un tiempo y un espacio determinados, en un orden concreto.</p>
<h3>¿Qué se mueve en la música?</h3>
<p>Para empezar partimos de dos líneas numéricas donde poder visualizar la música. Una línea vertical para los sonidos y otra línea horizontal para el paso del tiempo, sincronizadas para describir lo que suena y plasmarlo en el plano musical. </p>
<p>Las dos líneas tienen marcas numeradas; la marca de inicio es el número <strong>0</strong>.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Haz clic en <strong>Play</strong> para generar una secuencia aleatoria.</p>
<p><strong>Tip:</strong> El plano revela que la música tiene dos dimensiones inseparables: el sonido y el tiempo.</p>`,
  },
  3: {
    text: `<p>La línea temporal es horizontal y sirve para medir el tiempo en la música . <br>En ella marcamos unos puntos equidistantes que representan una velocidad constante, como si fueran los segundos de un reloj. <br>Definimos esta velocidad con un número, que se conoce como <b>BPM</b> (Beats Per Minute).</p>
<p>A los puntos de la línea temporal los llamamos <strong>pulsos</strong>. Como buen instrumento de medición el pulso de partida <b>es el 0</b>.</p>
<p>Los <b>pulsos</b> nos permiten marcar exactamente en qué instante se producen los sonidos. </p>
<p>Como la pulsación del corazón, un <strong>paso</strong> temporal es el tiempo que pasa entre dos pulsos consecutivos. Este paso es la unidad temporal que usaremos para medir cuánto dura un sonido.<br></p>
<p>Cuando contamos <strong>pasos</strong>, es natural hacerlo desde el 1: El paso 1 va del pulso 0 al 1, el paso 2 va del 1 al 2 etc…</p>`,
    tipsTitle: 'Prueba la Línea Temporal',
    tips: `<p>Haz clic en ▶️ y escucha dos notas aleatorias en posiciones distintas de la línea temporal.</p>
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
<p><strong>Uso básico:</strong> En la primera interacción, suena la escala cromática completa como introducción. A partir de la segunda, pulsa ▶️ para reproducir melodías aleatorias de 6 notas.</p>
<p><strong>Tip:</strong> La primera escucha es siempre la escala cromática ascendente; sirve para mostrar las 12 notas antes de escucharlas en melodías aleatorias.</p>`,
  },
  5: {
    text: `<p>Si colocamos la línea temporal en horizontal y la línea sonora en vertical creamos un <strong>plano</strong> que representa el espacio donde va a sonar la música.</p>
<p>Es un mapa donde podemos ver cómo las notas van ocurriendo en el tiempo, cada una en su instante preciso.</p>
<p>A cada nota le corresponde un punto en el mapa. Cada punto tiene <strong>dos números</strong> que lo definen, como las coordenadas de un lugar en el mapa.</p>
<p>El primer número es la <em>nota</em> escogida y el segundo es el <em>pulso</em> donde está ubicada. Un pulso no puede tener más de una nota, igual que al cantar solo podemos cantar una nota a la vez.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Haz clic en cualquier celda del plano para escuchar su nota y ver sus coordenadas (nota · pulso).</p>
<p>Pulsa ▶️ para escuchar de 4 a 8 notas aleatorias distribuidas en 8 pulsos.</p>
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
<p>Pulsa ▶️ para reproducir, 🎲 para generar una sucesión aleatoria, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> Pasar del azar a la intención es el salto creativo fundamental. Es el primer paso hacia la composición consciente: decides tú qué nota suena en qué momento.</p>`,
  },
  7: {
    image: {
      alt: 'Foto introductoria — Midiendo el movimiento de la Música: Los Intervalos',
      src: 'images/paso-7.png',
    },
    text: `<p>Ya sabemos dónde están situadas las notas y los pulsos. Vamos a fijarnos ahora en sus <b>movimientos</b>, usando, de nuevo, números para medirlos.</p>
<p>Los números que miden los movimientos se llaman <strong>intervalos</strong>.</p>
<p>Cada línea del plano tiene su intervalo característico. Los de la línea temporal (<b>iT</b>) miden las duraciones, los de la línea sonora (<b>iS</b>) los saltos de las notas. Son mundos diferentes pero la idea es la misma: <b>medir movimientos</b>.</p>
<p>Los intervalos nos muestran los espacios entre las notas que muestran cómo se teje la estructura una melodía, y permiten entender la esencia de su expresión.</p>`,
  },
  8: {
    text: `<h3>El intervalo temporal iT(n) mide la distancia entre dos pulsos escogidos.</h3>
<p>La unidad que usamos para medir el tiempo que dura cada sonido es el paso temporal entre dos pulsos adyacentes. </p><p>En el caso del iT(1) le corresponde una unidad de paso. El número del iT nos dice cuantas unidades, o sea, cuantos pasos dura un sonido.</p>
<p>Para calcular el iT que hay entre dos pulsos cualquiera solo hay que restar el número del primer pulso del número del segundo pulso. <b>iT= P2 - P1</b>. El resultado es siempre positivo ya que el P2 es siempre mayor que el P1.</p>
<p>Cada iT puede contener un sonido o un silencio; los silencios son muy importantes en la música.</p>
<p>Los iT dividen el tiempo total en partes, la suma de todos los iT da la duración total, o sea, la longitud.</p>
<p>Para definir un ritmo creamos una sucesión de iT.</p>`,
    tipsTitle: 'Prueba los iT en la línea',
    tips: `<p>Introduce tamaños de iT en los cuadros. La suma no puede superar 8.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una sucesión aleatoria, y 🗑 para reiniciar.</p>
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
<p>Pulsa ▶️ para reproducir, 🎲 para generar una sucesión aleatoria, 🗑 para reiniciar.</p>
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
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
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
<p>Entra un número en "Pulsos por Compás". Observa cómo la numeración de la línea temporal se repite mostrando la estructura del compás.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> La app muestra que el compás es un ciclo de números que se repiten. Usa + y − para cambiar el número de pulsos y observa como se adapta la línea sonora.</p>`,
  },
  13: {
    text: `<p>La visualización como círculo es muy útil para entender la <b>línea temporal con compás</b>.</p>
<p>La longitud total de la línea dependerá de cuántos pulsos tenga el compás y de cuantas repeticiones del compás definamos.</p>
<p>Al multiplicar los dos números se obtiene la <b>Longitud Total.</b> Por ejemplo, con compás de 3 Pulsos y 5 repeticiones nos da una <b>Longitud total</b> de 15 pulsos.</p>
<p>Además, organizar los Pulsos en un compás y repetirlo produce un carácter en la organización. Por ejemplo, el P(0) suele sonar más fuerte que el resto, indicando el principio del ciclo.</p>
<p>También es muy útil para definir un estilo rítmico: si acentuamos los Pulsos 1 i 3 en un compás de 4 creamos un ritmo popular.</p>`,
    tipsTitle: 'Prueba la Línea Temporal Circular',
    tips: `<p>Entra un número en "Pulsos por Compás" y otro en "Nº de Compases". La app reproduce el ejemplo. Observa como cambia el superíndice en los mismos pulsos.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
<p><b>Tips:</b> Compara esta representación circular con la lineal del paso 12. Mismo concepto, dos visualizaciones. El círculo hace evidente lo que la línea sugiere. La música no avanza solo en línea sino que <b>gira</b> para volver al siguiente <b>punto de partida</b>, creando espirales en el tiempo.</p>`,
  },
  14: {
    text: `<h2>El <b>módulo</b> de las notas</h2>
<p>La totalidad de las notas usadas se organizan en módulos de 12 notas que se repiten. Se numeran del 0 al 11. El 0 corresponde a la nota Do.</p>
<p>Esta estructura de 12 notas es fija, y se llama <strong>registro de octava</strong>.</p>
<p>Hay ocho registros básicos numerados del 0 al 7. Del 0 al 2 son los registros graves, del 3 al 5 registros medios y el 6 y 7 los registros agudos.</p>
<p>El registro en el que está una nota se puede escribir de dos maneras: como superíndice N(6^2) o después de la letra r N(6r2).</p>`,
    tipsTitle: 'Prueba el registro sonoro',
    tips: `<p>Introduce un número de registro o cambialo con las flechas. La app reproduce una secuencia aleatoria de 6 notas.</p>
<p>Clica en las notas de la línea sonora para reproducirlas individualmente.</p>
<p>Pulsa ▶️ para reproducir la secuencia otra vez, 🎲 para generar melodías y registro aleatoriamente, 🗑 para reiniciar.</p>
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
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p>Usa el scroll vertical para moverte entre registros y el horizontal para moverte por los compases.</p>`,
  },
  16: {
    text: `<p>Podemos crear melodías desde las <b>posiciones</b> (par N-P), como en el paso 6, o desde los <b>movimientos</b> (par iS-iT), como en el paso 10. Ahora vamos a crear melodías usando <strong>posiciones</strong> y <strong>distancias</strong>: escogiendo directamente la nota y asignándole una duración con el par <b>N-iT</b>.</p>
<p>La <strong>sucesión N-iT</strong> define cada nota y cuánto tiempo suena. El número de la <strong>N</strong> nos dice qué nota es, y el número del <strong>iT</strong> nos dice cuánto dura. Juntos crean el par usado en la notación tradicional.</p>
<p>Observa cómo la misma sucesión de N suena muy diferente si cambias los iT: alargar o acortar las duraciones transforma completamente el carácter de la melodía sin cambiar ninguna nota.</p>
<p>En el plano modular, las notas llevan su <strong>registro</strong> y los pulsos su <strong>compás</strong>. Así podemos crear melodías que se extiendan por varios registros y varios compases, acercándonos a una composición real.</p>`,
    tipsTitle: 'Prueba la Sucesión N-iT',
    tips: `<p>Ajusta Compás, Nº y Compases. El plano se adapta. Usa el editor para crear sucesiones N-iT. O haz clic y arrastra en las celdas del plano.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> Esta app combina el par N-iT, que es conceptualmente el par usado al escribir con notación musical.</p>`,
  },
  17: {
    text: `<p>Hasta ahora hemos medido el tiempo en pulsos enteros: P(1 2 3...). Pero también hay música <strong>entre</strong> los pulsos. Para representar los sonidos que ocurren dentro de un pulso entero, debemos añadir otra velocidad, relativa al BPM. Lo hacemos subdividiendo el pulso en partes iguales. Para este fin usamos <b>fracciones</b> sobre los pulsos enteros.</p><p>Estas <b>fracciones simples</b> tienen siempre un <b>1</b> en el <b>numerador</b> y un <b>número entero </b>que escojamos en el <b>denominador</b>. El resultado serán pulsos "más pequeños" que irán más rápido que los pulsos enteros. Cuánto <b>mayor</b> sea el denominador, <b>más rápido</b> irán los nuevos pulsos. La fracción 1/1 representa un pulso entero. La fracción 1/2 divide el pulso en dos partes, 1/3 lo divide en tres partes, etc.</p><p>Para numerar los pulsos fraccionados (<b>Pfr</b>), escribimos un punto después del pulso entero y seguidamente el número que corresponde a cada uno de los Pfr. Cada pulso fraccionado (<b>Pfr</b>) se identifica con un punto decimal. Por ejemplo, dentro del pulso entero <b>0</b> con fracción 1/3 tenemos <strong>0.1</strong> y <strong>0.2</strong> antes de llegar al pulso 1; dentro del pulso 1 tenemos <strong>1.1</strong> y <strong>1.2</strong>; y así sucesivamente. </p><p>Las fracciones simples siempre tienen el numerador fijado en 1. Son la manera más directa, pero no la única, de subdividir el tiempo.</p>`,
    tipsTitle: 'Prueba las fracciones',
    tips: `<p>Visualiza fracciones simples (1/d) en una sección de 6 pulsos de la línea temporal.</p><p>Cambia el denominador de la fracción (1-8) con los botones <strong>+</strong> y <strong>-</strong> y observa cómo se divide cada pulso entero en más o menos partes. </p><p>Pulsa ▶️ para reproducir la sucesión, 🎲 para generar una sucesión aleatoriamente, 🗑 para reiniciar.</p><p><b>Tip:</b> Esta app revela la subdivisión de los pulsos: entre un pulso y el siguiente cabe un tejido fino de tiempo. 1/1 = solo pulsos enteros sin subdivisión. 1/2 = divide cada pulso en 2. 1/3 = los tresillos tradicionales. Escucha cómo la subdivisión se acelera al aumentar el denominador.</p>`,
  },
  18: {
    text: `<p>Podemos crear ritmos seleccionando pulsos enteros y fraccionados. Los pulsos fraccionados usan una velocidad más rápida que permite crear sutilezas en los ritmos.</p><p>Para ello escogemos una fracción y a continuación creamos la sucesión: P ⅓( 1.2 3.1 4 ...). </p><p>Los <b>pulsos fraccionados (Pfr)</b> resultantes nos permiten realizar y componer ritmos muy variados con gran precisión.</p><p>Por ejemplo, podemos crear una sucesión de Pfr(0.3 1.2 2.1) e ir cambiando la fracción para observar que efecto provoca en el ritmo. O mantener la fracción e ir cambiando de posición los Pfr escogidos.</p>`,
    tipsTitle: 'Prueba la sucesión de Pfr',
    tips: `<p>Crea una sucesión de pulsos fraccionados (Pfr) sobre fracciones simples. </p><p>Edita en el <b>denominador</b> de la fracción. </p><p>Crea la sucesión de Pfr escribiendo 2 dígitos. El pulso entero + la posición del Pfr o selecciona qué Pfr suenan en la línea temporal fraccionada.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b><strong>Tips:</strong> </b>Prueba a usar distintas sucesiones de Pfr para crear diferentes ritmos. O una misma sucesión de PFr cambiando el denominador de la fracción. Por ejemplo: la sucesión Pfr(0.3 1.2 2.1) en fracciones de ¼ a ⅛ .</p>`,
  },
  19: {
    text: `<p>Así como el intervalo temporal (<b>iT</b>) mide la distancia entre dos pulsos escogidos, el iT fraccionado (<b>iTfr</b>) mide la distancia entre dos pulsos fraccionados (Pfr).</p><p>Los iTFr dividen el tiempo total en partes fraccionadas. La suma de todos los iTFr equivale al número de pulsos totales, es decir, la longitud del lienzo. </p><p>Con una sucesión de iTFr, así como una de PFr, se pueden crear ritmos con mayor precisión y detalle. La diferencia está en pasar de pensar en <b>posiciones</b> en el tiempo (PFr) para pensar en la <b>distancia</b> entre ellos (iTFr).</p>`,
    tipsTitle: 'Prueba los iTfr',
    tips: `<p>Combina fracciones simples con intervalos temporales fraccionados. </p><p>Edita el denominador en la fracción. Crea la sucesión de <b>iTfr</b> introduciendo en el editor las duracines O arrastra sobre la línea temporal para crear intervalos temporales.</p><p>El display de suma de iT y iT disponibles se actualiza para mostrar cuantos iT hay en cada momento. Cada iT suena como una nota melódica. La primera nota de cada ciclo es Do4, las demás Sol4. Haz clic en un intervalo para eliminarlo. Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Pasar de seleccionar puntos a trazar duraciones cambia la forma de pensar el ritmo: ya no son momentos aislados sino bloques de tiempo con peso y presencia. </p>`,
  },
  20: {
    text: `<p>Si repartimos los <b>iTfr</b> por el plano musical se pueden crear fácilmente melodías con un <b>caracter rítmico própio</b>, que podemos tratar como ideas, repetir y variar. Es una manera de dar coherencia interna a melodías sin caer en la monotonía. </p><p>Usar <b>iTfr</b> nos permite crear movimiento entre pulsos, desde doblar la velocidad (1/2), a más rápido cuanto más alto sea el denominador de la fracción.</p><p>Cada melodía tiene disonible dos velocidades, la de los pulsos enteros (BPM) y también una pulsación más rápida que encaja a cada pulso entero. </p><p>En el editor <b>N-iT</b> cada par define una nota y su duración en iTFr.</p><p>Una misma sucesión N-iT cambia de carácter al pasar de 1/3 a 1/4 o a 1/5, aunque las notas y las duraciones se mantienen proporcionalmente.</p>`,
    tipsTitle: 'Prueba el Plano N-iTfr',
    tips: `<p>Combina el plano fraccionado con un editor <b>N-iT</b> para crear melodías en el plano.</p><p>Edita el denominador. Usa el editor para introducir pares <b>N-iT</b>. O arrastra sobre el plano para crear notas.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips: </b>El editor permite pensar la melodía como una sucesión numérica de posiciones y distancias, mientras el plano muestra el resultado visual global. \nVer ambas representaciones a la vez conecta el pensamiento numérico con la visión espacial y las formas geométricas.</p>`,
  },
  // Capítol amagat — Fracciones complejas. Textos propis (revisats al
  // draft sistema/textos-fracciones-complejas-DRAFT.md). L'usuari farà
  // retocs des del Sistema (edit-mode → localStorage).
  17.5: {
    text: `<p>En el paso anterior subdividimos cada pulso entero con fracciones simples (1/d): el numerador era siempre <b>1</b> y el ciclo encajaba dentro de un solo pulso. Ahora ampliamos el lenguaje a las <b>fracciones complejas</b>, donde el numerador es <b>mayor que 1</b>. La fracción ya no sucede dentro de un pulso, sino que define un <b>ciclo </b>de<b> varios pulsos</b>.</p><p>El numerador <b>n</b> dice cuántos pulsos enteros abarca el ciclo; el denominador <b>d</b> dice en cuántas partes iguales se divide ese ciclo. Por ejemplo, con 2/3, cada <b>dos</b> pulsos enteros se reparten en <b>tres</b> partes iguales; con 3/4, cada tres pulsos se reparten en cuatro. Los nuevos pulsos fraccionados (<b>PFr</b>) ya no van de pulso entero a pulso entero, sino que crean pulsos a una <b>velocidad propia</b> en un <b>ciclo</b> que se repite <b>cada pulsos</b> del numerador.</p><p>La nueva velocidad de los PFr se calcula con la fórmula <b>(d × BPM) / n</b>. Si <b>n &lt; d</b> los PFr van <b>más rápidos</b> que los pulsos enteros; si <b>n &gt; d</b> van <b>más lentos</b>; si <b>n = d</b>, coinciden con el pulso entero. Por eso 2/3 acelera la velocidad (3 PFr en el espacio de 2 pulsos enteros) mientras que 3/2 reduce la velocidad (2 PFr en el espacio de 3 pulsos enteros).</p><p>Para que un ciclo encaje exactamente en la línea temporal, la <b>Longitud fraccionada (LgFr)</b> debe ser divisible por el numerador. Si la fracción es <b>reducible</b> (p.ej. 2/4 = 1/2) la velocidad es la misma que la fracción simple equivalente, pero el ciclo es más largo. Si <b>n y d son primos entre sí</b> (p.ej. 2/3, 3/4, 3/5) la fracción tiene una <b>pulsación propia</b> que no se reduce a ninguna simple.</p>`,
    tipsTitle: 'Prueba las fracciones complejas',
    tips: `<p>Reproduce fracciones complejas (numerador mayor que 1) sobre una sección de la línea temporal. El ciclo abarca <b>n pulsos enteros</b> divididos en <b>d pulsos fraccionados (Pfr)</b>.</p><p>Cambia <b>numerador</b> y <b>denominador</b> de forma independiente con los botones <strong>+</strong> y <strong>-</strong>. Observa cómo cambia la velocidad de los PFr respecto a los pulsos enteros. La app funciona en bucle.</p><p>Si la fracción se puede reducir (p.ej. 4/6 = 2/3), la velocidad es la misma pero el ciclo dura el doble.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar una fracción aleatoriamente, 🗑 para reiniciar.</p><p><b>Tip:</b> Las fracciones complejas abren un nivel rítmico que las simples no alcanzan: el <b>ciclo polirrítmico</b>. Compara 2/3, 3/4 y 3/2 con el mismo BPM; son tres relaciones temporales distintas. </p>`,
  },
  18.5: {
    text: `<p>Igual que con las fracciones simples, también podemos crear ritmos seleccionando <b>pulsos fraccionados (PFr)</b> sobre el <b>ciclo</b> de una <b>fracción compleja</b>. La diferencia es que ahora el ciclo abarca <b>varios pulsos enteros</b>.</p><p>Por ejemplo, escogemos la fracción 5/4 y construimos la sucesión: P 5/4( 0.1 0.3). Como un ciclo abarca varios pulsos, la numeración de los PFr <b>se reinicia cada n pulsos</b>, no a cada pulso entero.</p><p>Los <b>PFr complejos</b> permiten componer ritmos con una pulsación independiente que no encaja dentro de un solo pulso entero. Es la base de las <b>polirritmias</b>: dos velocidades simultáneas que comparten un mismo BPM pero recorren el ciclo de manera distinta.</p>`,
    tipsTitle: 'Prueba la sucesión de PFr en ciclos',
    tips: `<p>Crea una sucesión de pulsos fraccionados (PFr) sobre fracciones complejas (n/d, n &gt; 1).</p><p>Edita <b>numerador</b> y <b>denominador</b> independientemente. Crea la sucesión escribiendo en el editor la posición del PFr (p.ej. <b>0.2</b>), o selecciona directamente los PFr en la línea temporal fraccionada. La app funciona en bucle.</p><p>Las fracciones reducibles (p.ej. 4/6) suenan igual que su forma simple equivalente (2/3) pero alargan el ciclo audible.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Una misma sucesión de PFr cambia radicalmente al alterar la fracción. Por ejemplo, prueba PFr(0.1 0.3) en 3/4 y 3/5 — los números son los mismos, la sensación rítmica es distinta. </p>`,
  },
  19.5: {
    text: `<p>El <b>intervalo temporal fraccionado</b> (<b>iTFr</b>) mide la <b>distancia</b> entre dos<b> </b>PFr <b>consecutivos</b>, igual que el iT mide la distancia entre dos pulsos enteros. Con fracciones, simples o complejas, esa distancia se cuenta en unidades del nuevo ciclo (Pfr): cada <b>iTFr </b>abarca uno o más <b>Pfr</b> del ciclo de la fracción n/d.</p><p>Como el ciclo abarca varios pulsos enteros, el <b>total de iTFr disponibles</b> es <b>Lg × d / n</b>: la longitud de la línea por el denominador, dividida por el numerador. La suma de todos los iTFr de una sucesión equivale a este total.</p><p>Con una sucesión de iTFr podemos pensar en ritmos como bloques de tiempo con identidad.</p>`,
    tipsTitle: 'Prueba los iTFr complejos',
    tips: `<p>Combina fracciones complejas (n/d, n &gt; 1) con intervalos temporales fraccionados (iTfr).</p><p>Edita <b>numerador</b> y <b>denominador</b>. Crea la sucesión de <b>iTFr</b> introduciendo duraciones en el editor o arrastrando sobre la línea temporal fraccionada para crear intervalos.</p><p>El display de suma de iT y iT disponibles se actualiza para mostrar cuántos iTFr hay en cada momento. Cada iTFr suena como una nota melódica: la primera nota de cada ciclo es Do4, las demás Sol4. Haz clic en un intervalo para eliminarlo. La app funciona en bucle.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Pensar las polirritmias como duraciones (iTFr) y no como posiciones (PFr) cambia la sensación de movimiento: cada sucesión tiene peso propio dentro del ciclo. Prueba la misma sucesión de iTFr en 2/3 y 3/4 — los bloques se mantienen, pero la velocidad relativa al pulso entero cambia por completo.</p>`,
  },
  20.5: {
    text: `<p>Si llevamos los <b>iTFr</b> al plano 2D y los repartimos por la línea sonora, podemos crear melodías con una <b>identidad polirrítmica propia</b>. Cada melodía tiene disponible dos velocidades; la que sigue el pulso y también una pulsación que encaja cada <b>n </b>(numerador) pulsos enteros. Esta combinación rítmica solo se consigue con las fracciones compuestas.</p><p>El editor <b>N-iT</b> funciona igual que con fracciones simples: cada par define una nota y su duración en iTFr. Pero ahora la duración se mide dentro del ciclo n/d. Una misma sucesión N-iT cambia de carácter al pasar de 2/3 a 3/4 o a 3/5, aunque las notas y las duraciones se mantienen proporcionalmente.</p>`,
    tipsTitle: 'Prueba el Plano N-iT con fracciones complejas',
    tips: `<p>Combina el plano fraccionado complejo con el editor zigzag para crear sucesiones N-iT polirrítmicas.</p><p>Edita <b>numerador</b> y <b>denominador</b> de la fracción. Usa el editor para introducir pares N-iT o arrastra sobre el plano para crear notas con duración.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Mantén una sucesión N-iT y ve cambiando la fracción: la misma melodía aparece en versiones polirrítmicas distintas. Es una forma directa de descubrir cómo una idea musical se transforma al cambiar la pulsación subyacente sin tocar ni las notas ni los números de duración. El plano muestra el resultado visual, el editor las relaciones numéricas — pensar ambas a la vez conecta el lenguaje rítmico con la forma geométrica.</p>`,
  },
  21: {
    text: `<p>Históricamente la música se ha estudiado a partir de las siete notas de la escala Mayor Diatónica. La escala cromática llega después, como resultado de siglos de desarrollo. </p>
<p>El sistema Nuzic parte con la escala cromática <b>como módulo</b> para el resto de escalas.</p>
<p>Entonces, una <b>escala</b> es un grupo de <b>notas</b> que escogemos entre las 12 disponibles de la escala cromática.</p>
<p>Estas <b>notas</b> escogidas las llamamos <strong>Notas de Grado</strong> (<strong>Nº</strong>), y les damos su propia numeración, empezando siempre desde el número 0:<strong> Nº(0).</strong></p>
<p>A cada <b>Nº</b> le corresponde una <b>N</b> de la escala cromática. En la app ejemplo vemos el caso de la escala mayor y cómo las N escogidas de la escala cromática se enumeran en Nº en orden ascendente en la escala Mayor.</p>`,
    tipsTitle: 'Prueba la Numeración de grado',
    tips: `<p>Prueba en el ejemplo con la escala mayor: la más usada y un buen punto de partida.<br></p>
<p>Pulsa ▶️ en la escala cromática para escuchar la escala cromática. </p>
<p>Pulsa ▶️ en la escala mayor para escuchar la escala mayor.<br></p>
<p><b><strong>Tips:</strong> </b>Fíjate en cómo cambia la numeración para la misma nota en la escala mayor o en la cromática. Observa las líneas de conexión entre ambas escalas — las 12 notas de la escala cromática son el conjunto base para el resto de escalas.</p>`,
  },
  22: {
    text: `<p>Como acabamos de ver en el paso anterior, las distancias entre las Nº de una escala no son siempre las mismas. Este hecho es precisamente lo que le da carácter sonoro a una escala.</p>
<p>Si ordenamos estas distancias, obtenemos la <strong>estructura escalar (eE)</strong>, es decir, las distancias entre notas de una escala en orden ascendente y medidas en <strong>iS</strong> (intervalos Sonoros).</p>
<p>Cada escala tiene su <b>eE</b> propia. En la app ejemplo se muestra la de la escala Mayor.</p>`,
    tipsTitle: 'Prueba la Estructura Escalar',
    tips: `<p>Visualiza la estructura Escalar (eE) de la escala Mayor mediante barras de intervalos que muestran los <b>iS</b> entre cada grado de la escala.</p>
<p>Pulsa ▶️ para escuchar la escala mayor con una animación que destaca la eE.</p>
<p><strong>Tips:</strong> En la linea sonora, a la izquierda, se muestran los grados de la escala mayor (Nº). A la derecha se muestra la estructura Escalar de la escala mayor: <b>eE(2 2 1 2 2 2 1)</b>.</p>`,
  },
  23: {
    text: `<p>Las escalas pueden empezar en cualquiera de las doce notas del registro. Decimos entonces que la escala se <b>transporta</b>. Es decir, la eE se mantiene pero la Nº(0) cambia.</p>
<p>Cuando transportamos una escala cambiamos la Nota de salida correspondiente a la Nº(0). Toda la estructura escalar se desplaza y a las mismas Nº le corresponden otras N.</p>`,
    tipsTitle: 'Prueba el cambio de escala',
    tips: `<p>Permite transportar la escala mayor a cualquiera de las 12 notas del registro. Incluye visualización en pentagrama y líneas de conexión entre la escala cromática y la escala transportada.</p>
<p>Selecciona una nota de salida. Pulsa ▶️ en la escala cromática o ▶️ en la escala escogida para escuchar. Verás que el pentagrama se actualiza automáticamente.</p>
<p><strong>Tips: </strong>Transportar es aplicar la misma receta (eE) desde un punto de partida diferente. La escala suena "igual pero distinta" — conserva su carácter pero cambia de altura. Es como cantar la misma canción más aguda o más grave.</p>`,
  },
  24: {
    text: `<p>Hay muchas escalas posibles combinando 12 notas. Cada <b>escala</b> tiene su propia <strong>eE</strong> y se puede <b>transportar</b> a cualquiera de las N del registro (escala cromática).</p>
<p>Hemos visto en el paso anterior que cuando transportamos una escala cambiamos la Nota de salida correspondiente a la Nº(0).</p>
<p>Y cuando cambiamos de escala cambiamos las distancias entre las notas, es decir, la <b>eE</b>. La misma Nota de salida pero distintas distancias entre <b>Nº</b>.</p>
<p>Hay eE simétricas y eE asimétricas. Puedes observarlo en el cuadro de escalas.</p>
<p>Las posibilidades creativas se expanden al combinar diferentes escalas con diferente transposición.</p>
<p>En la teoría tradicional cada combinación de escala y transposición tiene su propia <b>armadura</b>. La app acompañante las muestra en el pentagrama, junto con las Nº escogidas.</p>`,
    tipsTitle: 'Prueba las escalas',
    tips: `<p>Selecciona una escala del cuadro y una nota de salida en el selector.</p>
<p>Pulsa ▶️ en la escala cromática o ▶️ en la escala mayor para escuchar.</p>
<p><strong>Tips:</strong> Al elegir escala y nota de salida, las líneas de conexión, el pentagrama y la estructura escalar (eE) se actualizan en tiempo real.</p>
<p>Compara la eE de diferentes escalas para entender sus diferentes distancias. Cada escala es un mundo sonoro distinto. Tómate tiempo para descubrirlas.</p>`,
  },
  25: {
    text: `<p>Podemos definir una melodía creando una sucesión de <b>Nº</b>.</p>
<p>Entonces, cambiar de escala y escuchar la diferencia. Las Notas de la melodía pueden cambiar, aunque las Nº son las mismas. Comprobamos así como la <b>eE</b> cambia el carácter de la melodía.</p>
<p>También podemos cambiar la <b>transposición</b> y escuchar la melodía en diferentes tonos.</p>
<p>Combinar las dos técnicas anteriores abre un abanico de posibilidades compositivas.</p>`,
    tipsTitle: 'Prueba tus melodías en diferentes escalas',
    tips: `<p>Plano basado en grados de escala. Las melodías se adaptan sonoramente al cambiar de escala: los grados se mantienen, las notas cambian.</p>
<p>Selecciona una escala y una transposición.</p>
<p>Usa el editor de Nº para entrar una sucesión. O haz clic en celdas del plano para los grados de la melodía.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p><b>Tips</b>: Esta app demuestra que la melodía no son las notas concretas sino las relaciones entre Nº de la escala. Por ejemplo, crea una melodía en una escala "mayor" y después cambia a una "menor" — los grados se mantienen pero el carácter cambia completamente.<br>Si una escala tiene menos grados que la anterior, los grados "perdidos" se recuerdan internamente y reaparecen al volver a una escala más larga.</p>`,
  },
  26: {
    text: `<p>Como ya hemos visto, el <strong>intervalo sonoro de grado</strong> (<b>iSº</b>) mide la distancia entre dos Nº de una escala.</p>
<p>En el paso anterior hemos definido una melodía con Nº. Proponemos ahora definir una melodía creando una sucesión de iSº.</p>
<p>Al cambiar de escala los <b>iSº</b> de la melodía se mantienen, pero al usar una estructura escalar (<b>eE</b>) diferente, las distancias reales de la melodía cambian.</p>
<p>Además podemos cambiar la <b>transposición</b> y escuchar la melodía en diferentes tonos.</p>`,
    tipsTitle: 'Piensa melodías desde distancias',
    tips: `<p>Muestra una melodía hecha con iSº. El primer iSº determina la primera nota de la sucesión.</p>
<p>Permite cambiar de escala. Las melodías se adaptan sonoramente: las distancias de grados se mantienen, algunas notas cambian.</p>
<p>Selecciona una escala y transposición. Introduce una sucesión de iSº para crear una melodía. También puedes hacer clic en los puntos del plano.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p><b>Tips:</b> Crea una sucesión en una escala "mayor" y después cambia a una "menor" — los intervalos de grado se mantienen pero el carácter cambia completamente.<br>Si una escala tiene menos grados que la anterior, los grados "perdidos" se recuerdan internamente y reaparecen al volver a una escala más larga.</p>`,
  },
};

// Default filler for pasos without explicit content yet.
export const fillerContent = {
  text: `<p>Este paso está pendiente de redactar. El esqueleto del Sistema está listo; cuando tengamos el texto teórico final del PDF o el material equivalente, se integrará aquí sustituyendo este marcador.</p>
<p>La densidad aquí será similar a la de los pasos ya redactados: 3 a 5 párrafos de 40–70 palabras, con términos clave en <strong>negrita</strong> y referencias cruzadas a apps vecinas cuando aplique.</p>`,
  tipsTitle: 'Tips de práctica',
  tips: `<p>Un consejo concreto aparecerá aquí cuando se redacte el contenido — una pista para usar la app y una observación sobre lo que se está aprendiendo.</p>`,
};
