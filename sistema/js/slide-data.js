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
  { id:'introduccion', title:'Introducción',       slides:[1,2,3,4,5,6] },
  { id:'descubriendo', title:'Descubriendo',       slides:[7,8,9] },
  { id:'intervalos',   title:'Intervalos',         slides:[10] },
  { id:'ampliando',    title:'Ampliando',          slides:[11,12,13,14,15,16] },
  { id:'fraccionando', title:'Fraccionando',       slides:[17,18,19,20,21] },
  { id:'escalas',      title:'Escalas',            slides:[22,23,24,25,26,27] },
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
  'B-app-left': {
    cols:  '1fr 1fr 1fr',
    areas: '"app app title" "app app text" "app app tips"',
    rows:  'auto 1fr auto',
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
  // Title + text + app stacked on the left (2 cols), tips alone on the right
  // (1 col spanning full height). Matches the PDF for Paso 4 (Línea Temporal).
  // The app row is clamped (min 180px, 32vh ideal, 340px max) so the text row
  // (1fr) retains most of the vertical space.
  'E-app-text-left': {
    cols:  '1fr 1fr 1fr',
    areas: '"title title tips" "text text tips" "app app tips"',
    rows:  'auto 1fr clamp(180px, 32vh, 340px)',
  },
};

// Minimum useful viewport (CSS pixels) per app group.
// Below `minW × minH` the slot triggers vertical fallback — the app is
// stacked above the text/tips at full slot width. Values come from a CSS
// audit + visual validation by the user (2026-04-27 session).
//   timeline-simple : timeline horitzontal amb 3 pills (app9, app13, App26-30)
//   timeline-vertical : soundline vertical (app10, App18)
//   timeline-complex : amb measure-header o iS editor (App14, App16)
//   plano-simple : grid 2D estàndard (app11/A, App12, App15, App32, App34, App35)
//   plano-multi-pill : grid 2D amb 4-5 pills al header (App19, App20)
//   scale : múltiples soundlines en paral·lel (App21–25B)
//   circular : timeline circular (App17)
export const groupMinSize = {
  'timeline-simple':   { minW: 340, minH: 320 },
  'timeline-vertical': { minW: 320, minH: 420 },
  'timeline-complex':  { minW: 380, minH: 400 },
  'plano-simple':      { minW: 420, minH: 380 },
  'plano-multi-pill':  { minW: 450, minH: 380 },
  'scale':             { minW: 480, minH: 512 },
  'circular':          { minW: 380, minH: 380 },
};

// Slide matrix — one entry per paso. Blocks are referenced in `slideContent`
// below; this matrix carries only structural info (section, layout, apps,
// group). `group` references `groupMinSize` for the per-slot vertical
// breakpoint. Slides without `group` (intro slides 1, 2, 11) never trigger
// vertical fallback — they fit at any viewport.
export const slideMatrix = [
  { paso:1,  section:'introduccion', title:'¿Te gustaría saber qué movimientos se producen en la música?', layout:'A-intro' },
  { paso:2,  section:'introduccion', title:'Contar y Medir',                                               layout:'A-intro' },
  { paso:3,  section:'introduccion', title:'Contar y Medir la Música',                                    layout:'B-app-left', apps:['App11A'], aspect:'4/3', group:'plano-simple' },
  { paso:4,  section:'introduccion', title:'Línea Temporal',                                              layout:'E-app-text-left', apps:['app9'],   aspect:'2/1', group:'timeline-simple' },
  { paso:5,  section:'introduccion', title:'Línea Sonora',                                                layout:'D-app-narrow',apps:['app10'],  aspect:'2/3', group:'timeline-vertical' },
  { paso:6,  section:'introduccion', title:'El Plano Musical',                                            layout:'B-app-left', apps:['app11'],  aspect:'4/3', group:'plano-simple' },
  { paso:7,  section:'descubriendo', title:'Descubriendo la Música',                                      layout:'B-app-left', apps:['App12'],  aspect:'4/3', group:'plano-simple' },
  { paso:8,  section:'descubriendo', title:'Midiendo el movimiento: Los Intervalos',                      layout:'B-app-left', apps:['app13'],  aspect:'2/1', group:'timeline-simple' },
  { paso:9,  section:'descubriendo', title:'Intervalo Sonoro',                                            layout:'B-app-left', apps:['App14'],  aspect:'3/2', group:'timeline-complex' },
  { paso:10, section:'intervalos',   title:'Intervalos en el Plano Musical',                              layout:'B-app-left', apps:['App15'],  aspect:'4/3', group:'plano-simple' },
  { paso:11, section:'ampliando',    title:'Ampliando el Mapa: Patrones, Ciclos y Módulos',               layout:'A-intro' },
  { paso:12, section:'ampliando',    title:'El compás: el módulo temporal',                               layout:'B-app-left', apps:['App16'],  aspect:'2/1', group:'timeline-complex' },
  { paso:13, section:'ampliando',    title:'Línea temporal en círculo',                                   layout:'B-app-left', apps:['App17'],  aspect:'1/1', group:'circular' },
  { paso:14, section:'ampliando',    title:'El registro de octava',                                       layout:'B-app-left', apps:['App18'],  aspect:'3/2', group:'timeline-vertical' },
  { paso:15, section:'ampliando',    title:'Plano Modular',                                               layout:'B-app-left', apps:['App19'],  aspect:'4/3', group:'plano-multi-pill' },
  { paso:16, section:'ampliando',    title:'Plano y Sucesión N-iT',                                       layout:'B-app-left', apps:['App20'],  aspect:'4/3', group:'plano-multi-pill' },
  { paso:17, section:'fraccionando', title:'Fraccionando la Línea Temporal',                              layout:'B-app-left', apps:['App26'],  aspect:'2/1', group:'timeline-simple' },
  { paso:18, section:'fraccionando', title:'Sucesión de Pulsos Fraccionados',                             layout:'B-app-left', apps:['App28'],  aspect:'2/1', group:'timeline-simple' },
  { paso:19, section:'fraccionando', title:'Sucesión de iT Fraccionados Simples',                         layout:'B-app-left', apps:['App30'],  aspect:'2/1', group:'timeline-simple' },
  { paso:20, section:'fraccionando', title:'Sucesión en Plano de Fracciones Simples',                     layout:'B-app-left', apps:['App32'],  aspect:'4/3', group:'plano-simple' },
  { paso:21, section:'fraccionando', title:'Fracciones Complejas',                                        layout:'B-app-left', apps:['App34','App35'], aspect:'4/3', variantLabels:['App34 · principal','App35 · extra'], group:'plano-simple' },
  { paso:22, section:'escalas',      title:'Escalas: Escogiendo Notas',                                   layout:'B-app-left', apps:['App21'],  aspect:'3/2', group:'scale' },
  { paso:23, section:'escalas',      title:'Estructura Escalar',                                          layout:'B-app-left', apps:['App22'],  aspect:'3/2', group:'scale' },
  { paso:24, section:'escalas',      title:'Transposición',                                               layout:'B-app-left', apps:['App23'],  aspect:'3/2', group:'scale' },
  { paso:25, section:'escalas',      title:'Probando diferentes Escalas',                                 layout:'B-app-left', apps:['App24'],  aspect:'3/2', group:'scale' },
  { paso:26, section:'escalas',      title:'Melodías con Escalas',                                        layout:'B-app-left', apps:['App25','App25B'], aspect:'4/3', variantLabels:['App25 · principal','App25B · iS'], group:'scale' },
  { paso:27, section:'escalas',      title:'Intervalos con Escalas',                                      layout:'B-app-left', apps:['App25B'], aspect:'4/3', group:'scale' },
];

// Content — real text for pasos 1-7 (from the PDF), filler for 8+.
// Each entry declares the blocks present in the slide. The renderer picks
// them up and places them into the layout's grid areas.
export const slideContent = {
  1: {
    image: { alt: 'Calle con peatones y coches — foto placeholder' },
    text: `<p>Imaginemos el seguimiento de una persona en un día. Para conocer sus movimientos hay que saber en qué puntos ha estado, en qué momento y cuánto tiempo se ha quedado. A partir de esa información puedes deducir y trazar en un mapa cómo se ha movido la persona.</p>
<p>Las coordenadas de los puntos donde ha estado, la hora y el tiempo, incluso la velocidad para ir de un punto a otro, se pueden describir con <strong>números</strong>.</p>
<p>¿Es aplicable a la música? <em>SÍ!…</em></p>`,
  },
  2: {
    image: { alt: 'Cintas métricas — foto placeholder' },
    text: `<p><strong>Contar</strong> es calcular con números cuántas cosas hay. Empezamos a contar unidades con el 1; a continuación le siguen el 2, el 3, el 4, el 5… hasta el infinito.</p>
<p><strong>Medir</strong> es usar números para calcular la magnitud de algo. Puede ser una longitud, un peso, una temperatura, un intervalo de tiempo…</p>
<p>Para medir usamos herramientas con escalas numéricas: cintas métricas para medir longitudes, termómetros para medir temperaturas, balanzas para medir pesos, etc.</p>
<p>Los instrumentos de medida tienen una línea con las unidades de medida marcadas y numeradas. La marca inicial es el número <strong>0</strong>, el punto de partida. Cada número marca el punto donde está y mide a qué distancia está del principio.</p>
<p>Por ejemplo, en una cinta métrica, el número 15 indica que está a 15 unidades de distancia del principio.</p>`,
  },
  3: {
    text: `<p>La música, como los movimientos de una persona en un día, podemos describirla y medirla con números.</p>
<p>Si vas por una calle, escuchas unos pasos, un coche que pasa, una puerta que se cierra y, al fondo, alguien silbando una melodía. Todo esto se mueve en un tiempo y un espacio determinados, en un orden concreto.</p>
<p><strong>¿Qué se mueve en la música?</strong></p>
<p>Para empezar partimos de dos líneas numéricas donde poder visualizar la música. Una línea para los sonidos y otra línea para el paso del tiempo, sincronizadas para describir lo que suena y plasmarlo en un plano musical. Las dos líneas tienen marcas numeradas; la marca de inicio es el número <strong>0</strong>.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Haz clic en <strong>Play</strong> para generar una secuencia aleatoria.</p>
<p><strong>Tip:</strong> El plano revela que la música tiene dos dimensiones inseparables: el sonido y el tiempo.</p>`,
  },
  4: {
    text: `<p>La <strong>línea temporal</strong> es horizontal y representa el movimiento en el tiempo. En ella marcamos unos puntos equidistantes que representan una velocidad constante, como si fueran los segundos de un reloj.</p>
<p>Definimos esta velocidad con un número, que se conoce como <strong>BPM</strong> (Beats Per Minute).</p>
<p>A los puntos de la línea temporal los llamamos <strong>pulsos</strong>, y los numeramos. Como buen instrumento de medición, el pulso de partida es el <strong>0</strong>. Los pulsos nos permiten marcar exactamente en qué instante se producen los sonidos.</p>
<p>Como la pulsación del corazón, un <strong>paso temporal</strong> es el tiempo que pasa entre dos pulsos consecutivos. Este paso es la unidad temporal que usaremos para medir cuánto dura un sonido.</p>
<p>Cuando contamos pasos, es natural hacerlo desde el 1: el paso 1 va del pulso 0 al 1, el paso 2 va del 1 al 2, etc.</p>`,
    tipsTitle: 'Prueba la Línea Temporal',
    tips: `<p><strong>Uso básico:</strong> Pulsa ▶ y escucha. La app genera dos notas aleatorias en posiciones distintas de la línea temporal. Ajusta el BPM entre 50 y 150 para escuchar la línea más rápido o más lento.</p>
<p><strong>Tip:</strong> En la línea temporal podemos visualizar el paso del tiempo marcado por los pulsos y oír un sonido que ocurre en un pulso y que dura una pulsación o paso.</p>`,
  },
  5: {
    text: `<p>La <strong>línea sonora</strong> representa los sonidos que crean la música. Los sonidos que usamos para empezar son las notas musicales. Cada punto de la línea es una nota de la escala cromática con su sonido característico.</p>
<p>A la primera nota le damos el número <strong>0</strong>. Es la nota de salida de la escala. Cada nota tiene su propio número para poder identificarla.</p>
<p>La línea sonora la colocamos en <em>vertical</em> para formar el plano con la línea temporal, así se ve muy bien la altura de cada nota. Las notas están organizadas en orden ascendente, de más grave a más aguda.</p>
<p>Las notas pueden seguir cualquier orden, pueden subir y bajar libremente creando así una <strong>melodía</strong>. El paso entre dos notas consecutivas es la unidad de medida que nos permite medir los movimientos de una melodía.</p>`,
    tipsTitle: 'Prueba Práctica',
    tips: `<p>La app muestra la línea sonora con 12 notas (0–11) donde puedes escuchar melodías.</p>
<p><strong>Uso básico:</strong> En la primera interacción, suena la escala cromática completa como introducción. A partir de la segunda, pulsa ▶ para reproducir melodías aleatorias de 6 notas.</p>
<p><strong>Tip:</strong> La primera escucha es siempre la escala cromática ascendente; sirve para mostrar las 12 notas antes de escucharlas en melodías aleatorias.</p>`,
  },
  6: {
    text: `<p>Si colocamos la línea temporal en horizontal y la línea sonora en vertical creamos un <strong>plano</strong> que representa el espacio donde va a sonar la música.</p>
<p>Es un mapa donde podemos ver cómo las notas van ocurriendo en el tiempo, cada una en su instante preciso.</p>
<p>A cada nota le corresponde un punto en el mapa. Cada punto tiene <strong>dos números</strong> que lo definen, como las coordenadas de un lugar en el mapa.</p>
<p>El primer número es la <em>nota</em> escogida y el segundo es el <em>pulso</em> donde está ubicada. Un pulso no puede tener más de una nota, igual que al cantar solo podemos cantar una nota a la vez.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Haz clic en cualquier celda del plano para escuchar su nota y ver sus coordenadas (nota · pulso).</p>
<p>Pulsa ▶ para escuchar de 4 a 8 notas aleatorias distribuidas en 8 pulsos.</p>
<p><strong>Tip:</strong> Prueba a hacer clic en varias celdas seguidas para explorar la relación entre posición en el plano y sonido. Las coordenadas de las notas desaparecen suavemente tras 1 segundo.</p>`,
  },
  7: {
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
};

// Default filler for pasos without explicit content yet (8–27).
export const fillerContent = {
  text: `<p>Este paso está pendiente de redactar. El esqueleto del Sistema está listo; cuando tengamos el texto teórico final del PDF o el material equivalente, se integrará aquí sustituyendo este marcador.</p>
<p>La densidad aquí será similar a la de los pasos ya redactados: 3 a 5 párrafos de 40–70 palabras, con términos clave en <strong>negrita</strong> y referencias cruzadas a apps vecinas cuando aplique.</p>`,
  tipsTitle: 'Tips de práctica',
  tips: `<p>Un consejo concreto aparecerá aquí cuando se redacte el contenido — una pista para usar la app y una observación sobre lo que se está aprendiendo.</p>`,
};
