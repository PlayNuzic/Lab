// Slide definitions — PDF-driven layout model.
//
// Each slide declares which *blocks* it has (title, text, image, iframe, tips)
// and a named `layout` that maps them onto a CSS grid via `grid-template-areas`.
// This mirrors the PDF precisely: each slide fits exactly one viewport, and the
// positioning of each piece within the slide varies per paso.
//
// Currently wired: pasos 1-29 (reescriptura 2026-08-31 des del document
// "NUZIC Textos SI"). El paso 1 és la intro GLOBAL amb parallax (secció
// pròpia 'intro', fora de capítol) i el paso 29 la CODA de tancament,
// també parallax. Els capítols es diuen Posiciones / Intervalos /
// Módulos / Fracciones / Escalas.
//
// Correspondència amb el document: DIAPO n ↔ paso n per a n = 3..28. La
// DIAPO 1 queda substituïda pel text nou del paso 1; la DIAPO 2 sencera
// (teoria + tips) viu al paso 2, que és l'intro parallax de Posiciones —
// l'antic paso 2, que només en repetia la segona meitat, s'ha eliminat.

export const sections = [
  { id:'intro',        title:'Introducción',  slides:[1,1.5] },
  { id:'descubriendo', title:'Posiciones',    slides:[2,3,4,5,6] },
  { id:'intervalos',   title:'Intervalos',    slides:[7,8,9,10] },
  { id:'ampliando',    title:'Módulos',       slides:[11,12,13,14,15,16] },
  { id:'fraccionando', title:'Fracciones',    slides:[17,18,18.5,19,19.5,20,20.5,21,21.5] },
  { id:'escalas',      title:'Escalas',       slides:[22,23,24,25,26,27,28,28.5,28.7] },
  { id:'coda',         title:'Coda',          slides:[29] },
];
// Grid layouts — the skeleton shared across pasos. Each defines the grid areas
// and the row template. Inline `grid-template-*` is applied per-slide from
// these values. Keep the area names ('image', 'title', 'text', 'app', 'tips')
// stable: the renderer maps block types to area names by convention.
// Each layout declares its own `cols`, `rows`, and `areas`. The renderer
// applies them inline to the slide's grid. The default is a 3-column
// grid (1fr 1fr 1fr); intro slides override to 50/50.
//
// Cas especial: els layouts 'P-parallax' i 'P-parallax-lab' (passos intro
// de capítol) NO són un grid — el renderer hi fa branch i pinta un slide
// full-bleed amb capes de fons en parallax i les frases del text com a
// blocs que s'activen amb el mouse. No necessiten entrada en aquest
// objecte. Els passos intro reals (1, 7, 11, 17, 22) usen el motor del
// lab ('P-parallax-lab'): mateix moviment per defecte que l'antic
// wireParallax (scroll-depth amb els valors de sempre) + les tècniques
// del constructor de parallax via ?tweaks=1.
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
//
// Camp opcional `density: 'compact'|'cozy'|'loose'` — densitat editorial
// del pas (espaiat del contingut). Si s'omet, el sistema usa 'compact'.
// És la font de veritat de producció; el panell tweaks pot sobreescriure-la
// localment (localStorage) per previsualitzar, però no es desplega.
export const slideMatrix = [
  // Paso 1 — intro GLOBAL del Sistema (no és intro de capítol): secció
  // pròpia 'intro'. Mateix motor parallax que les intros de capítol.
  { paso:1,    section:'intro',        title:'Música en movimiento',                                 layout:'P-parallax-lab', density:'compact', parallax:{ symbols:['0 1 2 3', 'P', 'N', 'iT', 'iS'] } },
  // 1·B — l'antiga intro amb vídeo, oculta rere el flag individual
  // `intro1b` (5 clicks al badge del paso 1, secció "Introducción").
  { paso:1.5,  section:'intro',        title:'¿Sabías que los números son el adn de la música?', layout:'A-intro', density:'loose', hidden:true, flag:'intro1b' },
  // Paso 2 — intro parallax de Posiciones amb la DIAPO 2 sencera (teoria
  // + la crida a l'app, que apareix a l'última frase via `app-reveal`).
  { paso:2,    section:'descubriendo', title:'Las posiciones',                                       layout:'P-parallax-lab', apps:['App11A'], aspect:'4/3', parallax:{ symbols:['0 1 2 3', 'N', 'P', 'BPM'] } },
  { paso:3,  section:'descubriendo', title:'Línea Temporal',                                              layout:'E-app-text-left', apps:['App9'],   aspect:'2/1', group:'timeline-simple', density:'compact' },
  { paso:4,  section:'descubriendo', title:'Línea Sonora',                                                layout:'D-app-narrow',apps:['App10'],  aspect:'5/9', group:'timeline-vertical' },
  { paso:5,  section:'descubriendo', title:'El Plano Musical',                                            layout:'B-app-left', apps:['App11'],  aspect:'4/3', group:'plano-simple', density:'compact' },
  { paso:6,  section:'descubriendo', title:'El par Pulso - Nota',                                      layout:'B-app-left', apps:['App12'],  aspect:'4/3', group:'plano-simple', density:'compact' },
  { paso:7,  section:'intervalos',   title:'Los Intervalos',                                              layout:'P-parallax-lab', apps:['App15'], aspect:'4/3', parallax:{ symbols:['iT', 'iS', 'P', 'N', '+3', '−2'] } },
  { paso:8,  section:'intervalos',   title:'El intervalo temporal',                                       layout:'E-app-text-left', apps:['App13'], aspect:'2/1', group:'timeline-simple', density:'compact' },
  { paso:9,  section:'intervalos',   title:'El intervalo sonoro',                                         layout:'B-app-left', apps:['App14'],  aspect:'2/3', group:'timeline-vertical', density:'compact' },
  { paso:10, section:'intervalos',   title:'Intervalos en el Plano Musical',                              layout:'B-app-left', apps:['App15'],  aspect:'4/3', group:'plano-simple' },
  { paso:11, section:'ampliando',    title:'Ampliando el plano: Círculos y Módulos',                      layout:'P-parallax-lab', parallax:{ symbols:['0 1 2', 'P(3¹)', 'r4', '0 1 2 3'] } },
  { paso:12, section:'ampliando',    title:'El compás: el módulo temporal',                               layout:'E-app-text-left', apps:['App16'],  aspect:'2/1', group:'timeline-complex', density:'compact' },
  { paso:13, section:'ampliando',    title:'La línea temporal con compás',                                layout:'B-app-left', apps:['App17'],  aspect:'2/1', group:'timeline-complex' },
  { paso:14, section:'ampliando',    title:'El registro de octava: el módulo de las notas',               layout:'B-app-left', apps:['App18'],  aspect:'6/5', group:'timeline-vertical', density:'compact' },
  { paso:15, section:'ampliando',    title:'El Plano Modular',                                            layout:'B-app-left', apps:['App19'],  aspect:'4/3', group:'plano-multi-pill' },
  { paso:16, section:'ampliando',    title:'El par N-iT en el Plano Modular',                             layout:'B-app-left', apps:['App20'],  aspect:'4/3', group:'plano-multi-pill', density:'compact' },
  { paso:17,   section:'fraccionando', title:'Fraccionando el tiempo',                                      layout:'P-parallax-lab', apps:['App32'], aspect:'3/4', parallax:{ symbols:['1/2', '1/3', '0.1', '1.2', 'Pfr'] } },
  { paso:18,   section:'fraccionando', title:'Los Pulsos Fraccionados en la línea temporal',                layout:'E-app-text-left', apps:['App26'],  aspect:'5/2', group:'timeline-simple', density:'compact' },
  { paso:18.5, section:'fraccionando', title:'Ciclos en la Línea Temporal',                                  layout:'E-app-text-left', apps:['App27'],  aspect:'5/2', group:'timeline-simple', hidden:true, flag:'complex', density:'compact' },
  { paso:19,   section:'fraccionando', title:'Secuencia de Pulsos Fraccionados',                             layout:'E-app-text-left', apps:['App28'],  aspect:'2/1', group:'timeline-simple' },
  { paso:19.5, section:'fraccionando', title:'Secuencia de Pfr en ciclos polirrítmicos',                      layout:'E-app-text-left', apps:['App29'],  aspect:'2/1', group:'timeline-simple', hidden:true, flag:'complex' },
  { paso:20,   section:'fraccionando', title:'iT Fraccionados',                                             layout:'E-app-text-left', apps:['App30'],  aspect:'5/3', group:'timeline-simple', density:'compact' },
  { paso:20.5, section:'fraccionando', title:'Secuencia de iTfr en ciclos polirrítmicos',                     layout:'E-app-text-left', apps:['App31'],  aspect:'5/3', group:'timeline-simple', hidden:true, flag:'complex', density:'compact' },
  { paso:21,   section:'fraccionando', title:'Plano fraccionado con secuencia N-iTfr',                      layout:'B-app-left',      apps:['App34'],  aspect:'3/4', group:'plano-simple', density:'compact' },
  { paso:21.5, section:'fraccionando', title:'Plano con fracciones complejas',                              layout:'B-app-left',      apps:['App35'],  aspect:'3/4', group:'plano-simple', hidden:true, flag:'complex', density:'compact' },
  { paso:22, section:'escalas',      title:'Las Escalas',                                                 layout:'P-parallax-lab', apps:['App22'], aspect:'2/3', parallax:{ symbols:['Nº', 'eE', 'iSº', '0 2 4 5 7 9 11'] } },
  { paso:23, section:'escalas',      title:'Los grados: la Escala Mayor',                                 layout:'B-app-left', apps:['App21'],  aspect:'2/3', group:'scale', density:'compact' },
  { paso:24, section:'escalas',      title:'La Estructura Escalar',                                       layout:'B-app-left', apps:['App22'],  aspect:'2/3', group:'scale', density:'loose' },
  { paso:25, section:'escalas',      title:'Transposición',                                               layout:'B-app-left', apps:['App23'],  aspect:'2/3', group:'scale', density:'loose' },
  { paso:26, section:'escalas',      title:'Probando diferentes Escalas',                                 layout:'B-app-left', apps:['App24'],  aspect:'2/3', group:'scale', density:'compact' },
  { paso:27, section:'escalas',      title:'Melodías con Nº en el plano',                                 layout:'B-app-left', apps:['App25'],  aspect:'4/3', group:'scale' },
  { paso:28, section:'escalas',      title:'Intervalo Sonoro de grado',                                   layout:'B-app-left', apps:['App25B'], aspect:'4/3', group:'scale' },
  // Parallax Lab — banc de proves del constructor de tècniques parallax
  // (parallax-lab.js + parallax-builder.js). Slides ocultes rere el flag
  // 'lab': s'obren amb ?paso=28.5 a l'URL o amb 5 clics al badge d'un pas
  // d'Escalas. NO són contingut del curs i no toquen les slides reals.
  { paso:28.5, section:'escalas', title:'Parallax Lab · A', layout:'P-parallax-lab', hidden:true, flag:'lab', parallax:{ symbols:['N', 'P', 'iT', 'iS', '0 1 2 3', 'BPM'] } },
  { paso:28.7, section:'escalas', title:'Parallax Lab · B', layout:'P-parallax-lab', hidden:true, flag:'lab', apps:['App11'], aspect:'4/3', parallax:{ symbols:['Nº', 'eE', '1/2', 'r4'] } },
  // Paso 29 — CODA: tancament del recorregut, secció pròpia 'coda'.
  { paso:29,   section:'coda',    title:'Coda',            layout:'P-parallax-lab', parallax:{ symbols:['P', 'N', 'iT', 'iS', 'Nº', 'eE', '1/3', 'r4'] } },
];

// Content — one entry per paso. Each entry declares the blocks present in
// the slide; the renderer places them into the layout's grid areas. En els
// passos parallax (1, 2, 7, 11, 17, 22 i 29), `text` conté una frase per
// <p> — el renderer les converteix en blocs que s'activen amb el mouse.
//
export const slideContent = {
  // Paso 1 — intro GLOBAL del Sistema (parallax, sense app). Text cuinat
  // des de l'export del panell: fon la DIAPO 1 del document amb el text
  // propi de l'usuari.
  1: {
    text: `<p>¿Te gustaría saber cómo se relacionan los números con la música?</p>
<p>El <b>Sistema Nuzic</b> usa los números para explicar, crear y transformar la música.</p>
<p>No reducimos la música a unos números. Utilizamos los números para descubrir las relaciones que hacen que la música se mueva y se transforme.</p>
<p>Parte de una idea muy bella: que la música es movimiento, y, por lo tanto, cada melodía, cada ritmo se pueden contar y medir. </p>
<p>¿Y cómo se describe un movimiento? </p>
<p>Contestando dos preguntas: <b>dónde</b> ocurre y <b>cuándo</b> ocurre.</p>
<p>Piensa en una persona a lo largo de un día. Para reconstruir su recorrido bastan tres datos: los lugares por donde ha pasado, el camino que ha recorrido para llegar de un lugar a otro y un mapa donde dibujarlo todo. Con la música ocurre lo mismo.</p>
<p>Cada sonido es un punto. La música es un viaje de un punto a otro. Recorrer la distancia entre estos puntos produce el <b>movimiento</b> de la música.</p>
<p>A lo largo de este recorrido aprenderemos a situar los sonidos mediante <b>posiciones</b>; a describir su movimiento mediante <b>intervalos</b>; a organizar estructuras mediante <b>módulos</b>; a explorar el interior del pulso mediante <b>fracciones</b>, y a escoger distintos universos sonoros mediante <b>escalas</b>.</p>
<p>Escucha, observa y prueba. El recorrido empieza en un punto. </p>`,
  },
  // 1·B — contingut original del pas 1 (vídeo + text complet).
  1.5: {
    video: {
      alt: 'Vídeo introductori animat — el seguiment d\'una persona',
      src: 'videos/paso-1.mp4',
    },
    text: `<p>Bienvenido al Sistema Interactivo Nuzic, un método pedagógico que te ayudará a comprender la música a partir de los números. Estás a punto de recorrer la música desde cero: empezarás descubriendo que todo lo que suena se puede contar y medir.</p><p>Asociamos los números a elementos de la música como notas, pulsos o intervalos, y así podemos describir y analizar cualquier música. </p><p>Podemos unir estos números en secuencias y crear ritmos y melodías.</p>`,
  },
  // Paso 2 — DIAPO 2, segona part (els dos eixos) + tips.
  // Paso 2 — intro parallax de Posiciones: la DIAPO 2 sencera, cuinada
  // des de l'export del panell. L'app no necessita cap <p> buit: el driver
  // afegeix la cel·la d'app després de l'última frase (app-reveal actiu al
  // PRESET), així la crida a l'acció es llegeix sencera i al scroll
  // següent entra el plano.
  2: {
    text: `<p>Para que la música se mueva, debe haber un <b>punto de partida</b>.</p>
<p>Antes de avanzar, saltar o repetirse, cada sonido ocupa una <b>posición</b>.</p>
<p>Y una posición se define con dos datos: qué suena y cuándo suena; es decir, una <mark class="hl-pink">nota</mark> y un <mark class="hl-yellow">pulso</mark>, el sonido y el tiempo.</p>
<p>Empecemos por poner cada sonido en su sitio. Para hacerlo, construiremos un<strong> </strong><b>plano</b><strong>.</strong></p>
<p>Partimos de dos ejes que son dos líneas numéricas: una línea horizontal que representa el paso del <mark class="hl-yellow">tiempo</mark> y otra línea vertical que representa los <mark class="hl-pink">sonidos</mark>.</p>
<p>Ambas se encuentran en el punto de inicio, formando así el plano musical: el lugar donde se describe la música que suena.<br></p>
<p><b>Tienes ese plano a un scroll: dale al play y escucha moverse la música.</b></p>`,
  },
  3: {
    text: `<p>La <mark class="hl-yellow">línea temporal</mark> es el eje horizontal y nos permite <mark class="hl-yellow">medir el tiempo</mark> en la música.</p>
<p>Cada una de las marcas equidistantes en la línea temporal representa una <b>pulsación</b> constante, como los segundos de un reloj o los latidos de un corazón.</p>
<p>La velocidad de esa pulsación se expresa con un número: los <b>BPM</b> (<em>beats per minute</em>), es decir, pulsos por minuto.</p>
<p>A cada marca de la línea temporal la llamamos <b>pulso</b>. El pulso de partida es el <b>0</b>, porque funciona como el inicio de la medición.</p>
<p>Los pulsos nos permiten situar con precisión en qué instante aparece cada sonido.</p>
<p>Entre un pulso y el siguiente hay un <b>paso temporal</b>. El <em>paso temporal</em> es la unidad de medición de la duración de un sonido.</p>
<p>Cuando contamos pasos, es natural empezar desde el 1: el paso 1 va del pulso 0 al pulso 1; el paso 2 va del pulso 1 al pulso 2, y así sucesivamente.</p>
<p><mark class="hl-box"><b>Pulso</b> = un punto en la línea temporal.<br><b>Pulsación</b> = repetición constante de los pulsos.<br><b>Paso</b> = distancia entre dos pulsos consecutivos. Se usa como unidad de medida.</mark></p>`,
    tipsTitle: 'Prueba la Línea Temporal',
    tips: `<p>Haz clic en ▶️ y escucha dos notas aleatorias en posiciones distintas de la línea temporal.</p>
<p>Ajusta el <b>BPM</b> para cambiar la velocidad de las pulsaciones.</p>`,
  },
  4: {
    text: `<p>La <mark class="hl-pink">línea sonora</mark> es el eje vertical y representa los sonidos que usamos para crear música.</p>
<p>Para empezar, trabajamos con las <b>notas musicales</b>. Cada punto de esta línea corresponde a una nota de la escala cromática.</p>
<p>A la nota de salida le damos el número <b>0</b>. A partir de ahí, cada nota recibe un número que nos permite identificarla.</p>
<p>Colocamos la <mark class="hl-pink">línea sonora</mark> como eje vertical para formar un plano junto con la <mark class="hl-yellow">línea temporal</mark>. Así podemos ver fácilmente la <b>altura</b> de cada nota: las notas más graves quedan abajo y las más agudas, arriba.</p>
<p>Una melodía aparece cuando las notas se ordenan en el tiempo. Pueden subir y bajar de una altura a otra, o repetirse.</p>
<p><mark class="hl-box">La <b>línea temporal</b> (horizontal) nos dice <b>cuándo</b> suena una nota.<br>La <b>línea sonora</b> (vertical) nos dice <b>qué</b> nota suena.<br>Juntas forman el <b>plano musical</b>.</mark></p>`,
    tipsTitle: 'Prueba Práctica',
    tips: `<p>La app muestra la línea sonora con 12 notas (0–11). En ella puedes escuchar melodías.</p>
<p><strong>Uso básico:</strong> En la primera interacción, suena la escala cromática completa. A partir de la segunda, pulsa ▶️ para reproducir melodías de 6 notas aleatorias.<br>Pulsa sobre los números de la línea sonora para reproducir su nota.</p>`,
  },
  5: {
    text: `<p>Hemos colocado la <mark class="hl-yellow">línea temporal</mark> en horizontal y la <mark class="hl-pink">línea sonora</mark> en vertical, y así hemos creado un plano: el espacio donde podemos representar la música.</p>
<p>Este plano funciona como un mapa. Nos permite ver qué notas suenan, en qué momento aparecen y cuánto dura cada una.</p>
<p>A cada nota le corresponde una <b>posición</b> en el plano. Esta posición se define con dos números, como si fueran las coordenadas de un lugar. Lo llamamos el <b>par Pulso-Nota</b>.</p>
<p>El primer número indica el <mark class="hl-yellow">pulso</mark> donde la nota suena (eje horizontal).</p>
<p>El segundo número indica la <mark class="hl-pink">nota</mark> escogida (eje vertical).</p>
<p>En esta primera representación, a cada pulso solo puede corresponderle una nota, igual que cuando cantamos una melodía solo cantamos una nota a la vez.</p>
<p><mark class="hl-box"><b>Par P-N</b>: representa una intersección Pulso-Nota en el plano musical.</mark></p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Si haces clic en cualquier punto del plano escucharás una nota y verás sus coordenadas correspondientes (Pulso - Nota).</p>
<p>Pulsa ▶️ para escuchar de 4 a 8 notas aleatorias distribuidas en 8 pulsos.</p>
<p><strong>Tip:</strong> Prueba a hacer clic en varias celdas seguidas para explorar la relación entre posición y sonido.</p>`,
  },
  6: {
    text: `<p>Ya tenemos el mapa para crear música.</p>
<p>Como hemos visto, cada sonido musical (cada par Pulso-Nota) viene marcado por dos parámetros: uno sitúa el sonido en el tiempo; el otro define la nota. Un parámetro lo elegimos en la <mark class="hl-yellow">línea temporal</mark>; el otro en la <mark class="hl-pink">línea sonora</mark>.</p>
<p>El <mark class="hl-yellow">pulso</mark> (tiempo) lo escribimos con una <b>P</b> delante del número: <code>P(n)</code>. La <mark class="hl-pink">nota</mark> la escribimos con una <b>N</b> delante del número: <code>N(n)</code>. También podemos usar un silencio en vez de una nota. El silencio lo escribimos con una <code>S</code>.</p>
<p>Los pulsos solo pueden ir hacia adelante y no se pueden repetir, como sucede con el tiempo.</p>
<p>Y ya estamos listos para empezar a crear. De hecho, cuando te sientas al piano a componer una melodía, estás escogiendo y ordenando secuencias de números. Estás ordenando sonidos en el tiempo.</p>`,
    tipsTitle: 'Prueba el Plano Nuzic',
    tips: `<p>Usa el <strong>editor N-P</strong> para introducir pares y crear una secuencia. También puedes hacer clic en puntos del plano para añadir o quitar notas.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>`,
  },
  // Pas intro parallax — Intervalos.
  7: {
    text: `<p>Ya sabemos situar los sonidos en un mapa.</p>
<p>Pero una melodía no se reconoce solo por los lugares que ocupa, sino por las <b>distancias</b> que recorren sus notas.</p>
<p>Ahora vamos a medir cómo se mueven esas notas. Para eso, usamos <b>intervalos</b>.</p>
<p>El intervalo temporal (<b>iT</b>) mide la duración de un sonido.</p>
<p>El intervalo sonoro (<b>iS</b>) mide la distancia entre dos sonidos.</p>
<p>La <b>duración</b> y la <b>distancia</b> nos permiten oír el movimiento de la música y ver el contorno de la melodía.</p>`,
  },
  8: {
    text: `<p>¿Recordáis que llamábamos <b>paso temporal</b> a la distancia entre dos pulsos consecutivos? Pues el <b>intervalo temporal</b> (<b>iT</b>) mide la cantidad de pasos temporales que dura un sonido, es decir, la distancia que hay entre dos pulsos.</p>
<p>Se escribe así: <code>iT(n)</code>. El número del iT nos dice cuántas unidades hay, es decir, cuántos pasos dura un sonido. Un <code>iT(1)</code> es un paso temporal. Un <code>iT(5)</code> son 5 pasos temporales.</p>
<p>Una secuencia de iT, por ejemplo <code>iT(3 1 2)</code>, crea un <b>ritmo</b>. Si quieres saber cómo suena, prueba esta secuencia de iT en la app.</p>
<p>Los iT dividen el tiempo total en partes. La suma de todos los iT da la <b>longitud</b> del ritmo. Por ejemplo, la longitud del ritmo anterior es de 6 (3+1+2).</p>
<p>Para calcular el iT entre dos pulsos solo hay que restar el pulso de origen del pulso de destino: <b>iT = P2 − P1</b>. El resultado del iT es siempre positivo, ya que el tiempo no puede detenerse ni tampoco ir hacia atrás.</p>
<p>En la notación tradicional, se usan diferentes figuras para definir los intervalos temporales: negras, blancas, redondas…</p>`,
    tipsTitle: 'Prueba los iT en la línea',
    tips: `<p>Introduce números de iT en los cuadros. En la app, el resultado de la suma no puede superar 8.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, y 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> Descubre cómo la distancia entre los sonidos crea el movimiento. Cambiar el orden de los iT modifica significativamente el ritmo.</p>`,
  },
  9: {
    text: `<p>El <b>intervalo sonoro</b> <code>iS(n)</code> mide la distancia entre dos notas.</p>
<p>La unidad de medida es la distancia entre dos notas contiguas y le corresponde el <code>iS(1)</code>.</p>
<p>Si se repite la misma nota, la distancia es <code>iS(0)</code>. En el <code>iS(1)</code> la distancia es de una nota, como por ejemplo entre el <em>do</em> y el <em>do sostenido</em>. En el <code>iS(5)</code> el salto es de 5 notas, como sucede, por ejemplo, entre el <em>do</em> y el <em>fa</em>.</p>
<p>Para calcular el iS que hay entre dos notas solo hay que restar el número de la primera nota del número de la segunda nota: <b>iS = N2 − N1</b>.</p>
<p>El resultado puede ser positivo o negativo, dependiendo del movimiento de las dos notas. Si N2 es mayor que N1 (es decir, N2 es más aguda) el resultado es positivo y el movimiento es <b>ascendente</b>. Si N2 es menor que N1 (es decir, N2 es más grave) el resultado es negativo y el movimiento es <b>descendente</b>.</p>`,
    tipsTitle: 'Prueba los iS en la línea',
    tips: `<p>Escribe valores positivos o negativos de iS en el editor.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> El iS enseña que una melodía es movimiento: no solo importa dónde empieces, sino cuánto te mueves.</p>
<p>El primer iS define la distancia entre la nota 0 y la primera nota de la melodía.</p>
<p>Observa cómo la línea sonora destaca los iS con flechas durante la reproducción. Los valores positivos suben y los negativos bajan.</p>`,
  },
  10: {
    text: `<p>Si nos fijamos sobre todo en el movimiento, componer una melodía implica combinar una secuencia de <b>iS</b> sincronizados con <b>iT</b>.</p>
<p>Los pares iS-iT van dibujando la melodía. El primer iS sitúa la primera nota en el plano y el primer iT empieza en el <code>P(0)</code>.</p>
<p>Podemos escoger silencios en vez de notas escribiendo una <code>s</code> en los iS y darle a ese silencio la duración que queramos en la línea de iT.</p>`,
    tipsTitle: 'Prueba el Plano iS-iT',
    tips: `<p>Introduce un número de iS para definir la primera nota. A continuación introduce el número del iT para definir su duración.</p>
<p>Introduce parejas iS-iT hasta acabar la secuencia. Escribe <code>s</code> en la línea iS para introducir un silencio.</p>
<p>También puedes introducir notas clicando en los puntos del plano y arrastrando el cursor para marcar la duración (el iT) de la nota.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> En esta App se juega con distancias, en lugar de posiciones fijas. Es la diferencia entre decir "ve a la casilla 5" y "avanza 3 casillas desde la casilla 2" — el mismo destino, dos formas de pensarlo.</p>`,
  },
  // Pas intro parallax — Módulos. La imatge es fa servir com a capa
  // suau de fons darrere les frases (no com a bloc d'imatge del grid).
  11: {
    image: {
      alt: 'Ilustración — Patrones, ciclos y módulos',
      src: 'images/paso-11.jpg',
    },
    text: `<p>Ya podemos describir pequeños movimientos en la música.</p>
<p>Para movimientos más <b>extensos</b> necesitamos organizar el tiempo y el sonido en estructuras que se repiten.</p>
<p>La realidad está llena de ciclos: las estaciones, las fases lunares, los meses, días y horas… Lo que se repite ordena el mundo.</p>
<p>También en matemáticas la idea de <b>"ciclo"</b> es muy importante. Por ejemplo, en un <b>módulo</b> matemático los números vuelven a empezar después de alcanzar un cierto valor, como ocurre al llegar a las 12 en un reloj.</p>
<p>La música también usa módulos: el <b>compás</b> agrupa los pulsos y el <b>registro de octava</b> agrupa las notas.</p>
<p>Con estos <b>módulos</b> puedes construir y manejar grandes estructuras musicales.</p>`,
  },
  12: {
    text: `<p>El módulo temporal es el <b>compás</b>.</p>
<p>El compás organiza los pulsos de la <mark class="hl-yellow">línea temporal</mark> en grupos que se repiten. Sirve como una nueva unidad de medida que agrupa pulsos en su interior.</p>
<p>La cantidad de pulsos por compás hay que escogerla a priori. Se suelen usar números pequeños para percibir mejor la sensación de repetición.</p>
<p>El primer pulso del compás siempre es el <code>P(0)</code>.</p>
<p>Para indicar en qué compás está un pulso, le añadimos el número de compás como superíndice. Por ejemplo, para el Pulso 3 del compás 1, escribimos: <code>P(3<sup>1</sup>)</code>.</p>
<p>El compás ordena los pulsos. De manera natural, el primer pulso del compás suena más fuerte, lo que nos permite reconocer auditivamente cada inicio de compás. Además, le da un carácter rítmico propio y facilita ordenar estructuras mayores.</p>`,
    tipsTitle: 'Prueba los Intervalos Temporales',
    tips: `<p>Esta app representa la línea de tiempo organizada en compases. Verás un compás completo, que se repite en bucle.</p>
<p>Introduce un número en "Pulsos por Compás". Observa cómo la numeración de la línea temporal se repite mostrando la estructura del compás.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> La app muestra que el compás es un ciclo de números que se repiten. Usa + y − para cambiar el número de pulsos y observa cómo se adapta la línea sonora.</p>`,
  },
  13: {
    text: `<p>Una vez definido qué compás usaremos, hay que decidir la <b>cantidad de compases</b> que queremos.</p>
<p>Podemos repetir el compás las veces que queramos. La <b>longitud</b> de la <mark class="hl-yellow">línea temporal</mark> dependerá del número de pulsos del compás y de la cantidad de repeticiones del compás. Por ejemplo, un compás de 3 Pulsos y 5 repeticiones nos da una longitud de 15 pulsos.</p>
<p>Para definir un pulso dentro del compás en la línea temporal, escribimos el número de pulso y como <b>superíndice</b> el número de compás en el que está.</p>`,
    tipsTitle: 'Prueba la línea temporal con compás',
    tips: `<p>Introduce un número en "Pulsos por Compás" y otro en "Nº de Compases". Puedes ver la longitud total encima de la línea. Observa cómo cambia el superíndice en los mismos pulsos.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar una secuencia aleatoria, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> La longitud de la línea depende del tipo de compás y el número de compases. Si cambias uno de los números, cambia la longitud de la línea.</p>`,
  },
  14: {
    text: `<p>En Nuzic usamos <b>96 notas</b>, ordenadas de la más grave a la más aguda.</p>
<p>Para manejarlas mejor las agrupamos en módulos de 12 notas, a los que llamamos <b>registro de octava</b>.</p>
<p>Las doce notas de cada registro se numeran del 0 al 11, donde el <b>0</b> corresponde siempre a la nota <em>Do</em>.</p>
<p>Hay ocho registros, numerados del 0 al 7. Del 0 al 2 son los registros graves, del 3 al 5 registros medios y el 6 y 7 los registros agudos.</p>
<p>El registro en el que está una nota se puede escribir de dos maneras: como superíndice <code>N(6<sup>2</sup>)</code> o después de la letra r: <code>N(6r2)</code>.</p>`,
    tipsTitle: 'Prueba el registro sonoro',
    tips: `<p>Introduce un número de registro o cámbialo con las flechas. La app reproduce una secuencia aleatoria de 6 notas.</p>
<p>Clica en las notas de la línea sonora para reproducirlas individualmente.</p>
<p>Pulsa ▶️ para reproducir la secuencia otra vez, 🎲 para generar melodías y registro aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> La nota 0 está resaltada en rosa para marcar el inicio de cada registro. El registro 4 corresponde al Do central del piano (nota C4).</p>`,
  },
  15: {
    text: `<p>Volvemos al plano para añadir los módulos <b>compás</b> y <b>registro</b> juntos. Representamos el compás en la <mark class="hl-yellow">línea temporal</mark> y el registro en la <mark class="hl-pink">línea sonora</mark>. A la hora de componer, contar con más registros nos permite ampliar la sonoridad.</p>
<p>En la app, cada rectángulo del plano equivale a una nota. Verás representado el compás de cada pulso y el registro de cada nota en los superíndices del par Pulso-Nota.</p>
<p>Al cambiar de registro una misma idea melódica, esta cambia su altura sonora. Si modificas el número de compás de un pulso, cambias también su posición en el tiempo.</p>`,
    tipsTitle: 'Prueba el Plano Modular',
    tips: `<p>Introduce un compás y un número de compases para modificar el plano modular, que calcula automáticamente la longitud total de pulsos. El registro de salida inicial es el 4.</p>
<p>Haz clic en las celdas del plano para crear notas. Usa el scroll o los spinners para moverte entre los registros.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p>Usa el scroll vertical para moverte entre registros; usa el scroll horizontal para moverte entre compases.</p>
<p><strong>Tips:</strong> El registro nos da la posibilidad de sonar grave o agudo, y el compás nos permite desplazar melodías.</p>`,
  },
  16: {
    text: `<p>Ya hemos creado melodías a partir de dos posiciones (par <b>P-N</b>) y a partir de dos distancias (par <b>iS-iT</b>). Ahora vamos a crear melodías a partir de una posición y una distancia (par <b>N-iT</b>). Es decir, escogiendo una nota y asignándole una duración.</p>
<p>El par N-iT define qué nota suena y cuánto tiempo dura. Juntos equivalen a la notación de una nota en el pentagrama tradicional. Por ejemplo, un <em>do negra</em> equivale al par (0-1).</p>
<p>En el par N-iT las notas llevan su <b>registro</b> en superíndice. Los iT, por naturaleza, no tienen módulo, ya que son distancias.</p>
<p>Esto facilita crear melodías que se extiendan por varios registros y variaciones rítmicas estructuradas.</p>`,
    tipsTitle: 'Prueba la Secuencia N-iT',
    tips: `<p>Ajusta compás y número de compases. El plano se adapta. Usa el editor para crear secuencias N-iT. O haz clic y arrastra las notas por el plano.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> Esta app combina el par N-iT. Esta es la notación de una nota en el pentagrama tradicional.</p>`,
  },
  // Pas intro parallax — Fracciones.
  17: {
    text: `<p>Acabamos de ver cómo los <b>módulos</b> amplían el plano.</p>
<p>Ahora vamos a <b>acercarnos</b> al plano para observar lo que ocurre dentro de cada pulso.</p>
<p>Igual que entre el 1 y el 2 hay infinitos números, entre un pulso y el siguiente hay infinitas posibilidades rítmicas.</p>
<p>Acércate: divide el pulso y las descubrirás.</p>
<p>Verás que <b>fraccionar</b> la pulsación crea nuevas velocidades.</p>
<p>Prueba ritmos con los pulsos fraccionados. Aquí es donde el tiempo se pone interesante. ¿Lo fraccionamos?</p>`,
  },
  18: {
    text: `<p>Hasta ahora hemos medido el tiempo en pulsos enteros: <code>P(0 1 2...)</code>. En este capítulo vamos a fijarnos en la música que hay <b>entre</b> los pulsos.</p>
<p>Para representar los sonidos que ocurren entre pulsos, lo hacemos fraccionando la pulsación en partes iguales. Esto crea una nueva velocidad, relacionada con la velocidad original a través de la fracción.</p>
<p>La fracción que usaremos tendrá siempre un <b>1</b> en el numerador y un número entero en el denominador. El resultado sonoro son pulsaciones más cortas que irán más rápido que los pulsos enteros. Los llamamos <b>Pulsos Fraccionados</b> (<b>PFr</b>).</p>
<p>Cuanto mayor sea el denominador de la fracción, más rápido sonarán los pulsos. La fracción 1/2 divide el pulso en dos PFr, 1/3 lo divide en tres PFr, etc. La fracción 1/1 representa la unidad, y por lo tanto un pulso entero, así que no crea pulsos fraccionados.</p>
<p>Numeramos los pulsos fraccionados (<b>Pfr</b>) con un punto después del pulso entero y el número que corresponde a cada Pfr. Por ejemplo, dentro del pulso entero 0 con fracción 1/3 tenemos <b>0</b>, <b>0.1</b> y <b>0.2</b> antes de llegar al pulso 1; dentro del pulso 1 tenemos <b>1</b>, <b>1.1</b> y <b>1.2</b>; y así sucesivamente.</p>`,
    tipsTitle: 'Prueba las fracciones',
    tips: `<p>Visualiza fracciones simples (1/d) en una sección de 6 pulsos de la línea temporal.</p>
<p>Cambia el denominador de la fracción entre 1 y 8 (es decir, entre la negra y la fusa del solfeo tradicional) con los botones <strong>+</strong> y <strong>−</strong>.</p>
<p>Pulsa ▶️ para reproducir la secuencia, 🎲 para generar una secuencia aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tip:</strong> Esta app revela la subdivisión de los pulsos: entre un pulso y el siguiente cabe un tejido fino de tiempo. 1/1 = solo pulsos enteros, sin subdivisión. 1/2 = divide cada pulso en 2. 1/3 = los tresillos tradicionales. Escucha cómo la subdivisión se acelera al aumentar el denominador.</p>`,
  },
  19: {
    text: `<p>Ahora ya podemos escoger PFr para crear un ritmo con dos velocidades. Los pulsos enteros son los pilares básicos; los fraccionados, más veloces, son las sutilezas del ritmo.</p>
<p>Para escribir una secuencia de PFr primero escogemos el denominador de la fracción y a continuación apuntamos la secuencia. Podemos escoger pulsos enteros y fraccionados. Por ejemplo: <code>P⅓(1.2 2.1 3 ...)</code>.</p>
<p>Podemos crear una secuencia de <code>Pfr(0.3 1.2 2.1)</code> e ir cambiando la fracción para observar qué efecto provoca en el ritmo. O al revés: mantener la fracción e ir cambiando los Pfr escogidos y escuchar el resultado.</p>`,
    tipsTitle: 'Prueba la secuencia de Pfr',
    tips: `<p>Crea una secuencia de pulsos fraccionados (Pfr) sobre fracciones simples.</p>
<p>Edita el denominador de la fracción.</p>
<p>Crea la secuencia de Pfr escribiendo parejas de dígitos separados por un punto: el primer dígito de la pareja corresponde al pulso entero y el segundo a la posición del Pfr. También puedes seleccionar qué Pfr suenan en la línea temporal fraccionada.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> La app combina los pulsos enteros que coinciden con el BPM y los fraccionados, más veloces, que permiten sutilezas rítmicas.</p>
<p>Prueba a usar distintas secuencias de Pfr para crear diferentes ritmos. O una misma secuencia de PFr cambiando el denominador de la fracción. Por ejemplo: la secuencia <code>Pfr(0.3 1.2 2.1)</code> en fracciones de ¼ a ⅛.</p>`,
  },
  20: {
    text: `<p>¿Recuerdas que el intervalo temporal (<b>iT</b>) mide la distancia entre dos pulsos? Pues de igual manera, el <b>iT fraccionado</b> (<b>iTfr</b>) mide la distancia entre dos pulsos fraccionados (Pfr).</p>
<p>Si el iTfr es más grande que el denominador de la fracción, la duración será mayor que un pulso entero.</p>
<p>Los iTfr que son múltiplos del denominador de la fracción tendrán una duración equivalente a pulsos enteros.</p>
<p>Para escribir una secuencia de iTFr primero escogemos el denominador de la fracción y a continuación apuntamos la secuencia. Por ejemplo: <code>iT⅓(1 3 2 5 7 ...)</code>.</p>`,
    tipsTitle: 'Prueba los iTfr',
    tips: `<p>Combina fracciones simples con intervalos temporales fraccionados.</p>
<p>Edita el denominador en la fracción. Crea la secuencia de iTfr introduciendo en el editor las duraciones. También puedes arrastrar el iTfr sobre la línea temporal para crear intervalos temporales.</p>
<p>El display de "suma de iT" e "iT disponibles" se actualiza para mostrar cuántos iT hay en cada momento. Cada iT suena como una nota melódica. La primera nota de cada ciclo es Do4, las demás Sol4. Haz clic en un intervalo para eliminarlo.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> Pasar de seleccionar puntos a trazar duraciones cambia la forma de pensar el ritmo: ya no son momentos aislados, sino bloques de tiempo con peso y presencia.</p>`,
  },
  21: {
    text: `<p>En la app se puede componer con el par <b>N-iTfr</b>, que es como el par N-iT que vimos en el paso 16, pero con más variedad rítmica. Los iTfr demuestran su versatilidad cuando se combinan con notas para crear melodías.</p>
<p>Escoge una fracción, define una N y asígnale un iTfr. Puedes ir creando pares hasta completar una melodía.</p>
<p>Prueba a cambiar la fracción de una secuencia de N-iTFr y observa cómo cambia el <em>groove</em> (el carácter de la melodía) al pasar, por ejemplo, de 1/3 a 1/4 o a 1/5. Las notas y duraciones se mantienen proporcionalmente, pero suenan a más o menos velocidad según la fracción.</p>`,
    tipsTitle: 'Prueba el Plano N-iTfr',
    tips: `<p>Combina el plano fraccionado con un editor N-iTfr para crear melodías en el plano.</p>
<p>Edita el denominador. Usa el editor para introducir pares N-iTfr. También puedes arrastrar el par sobre el plano para crear notas.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> El plano N-iTfr combina las posiciones (N) con las distancias (iTfr). Aumenta la fracción para tener disponibles más iTfr.</p>`,
  },
  // Capítol amagat — Fracciones complejas. Textos propis (revisats al
  // draft sistema/textos-fracciones-complejas-DRAFT.md). L'usuari farà
  // retocs des del Sistema (edit-mode → localStorage).
  18.5: {
    text: `<p>En el paso anterior subdividimos cada pulso entero con fracciones simples (1/d): el numerador era siempre <b>1</b> y el ciclo encajaba dentro de un solo pulso. Ahora ampliamos el lenguaje a las <b>fracciones complejas</b>, donde el numerador es <b>mayor que 1</b>. La fracción ya no sucede dentro de un pulso, sino que define un <b>ciclo </b>de<b> varios pulsos</b>.</p><p>El numerador <b>n</b> dice cuántos pulsos enteros abarca el ciclo; el denominador <b>d</b> dice en cuántas partes iguales se divide ese ciclo. Por ejemplo, con 2/3, cada <b>dos</b> pulsos enteros se reparten en <b>tres</b> partes iguales; con 3/4, cada tres pulsos se reparten en cuatro. Los nuevos pulsos fraccionados (<b>PFr</b>) ya no van de pulso entero a pulso entero, sino que crean pulsos a una <b>velocidad propia</b> en un <b>ciclo</b> que se repite <b>cada pulsos</b> del numerador.</p><p>La nueva velocidad de los PFr se calcula con la fórmula <b>(d × BPM) / n</b>. Si <b>n &lt; d</b> los PFr van <b>más rápidos</b> que los pulsos enteros; si <b>n &gt; d</b> van <b>más lentos</b>; si <b>n = d</b>, coinciden con el pulso entero. Por eso 2/3 acelera la velocidad (3 PFr en el espacio de 2 pulsos enteros) mientras que 3/2 reduce la velocidad (2 PFr en el espacio de 3 pulsos enteros).</p><p>Para que un ciclo encaje exactamente en la línea temporal, la <b>Longitud fraccionada (LgFr)</b> debe ser divisible por el numerador. Si la fracción es <b>reducible</b> (p.ej. 2/4 = 1/2) la velocidad es la misma que la fracción simple equivalente, pero el ciclo es más largo. Si <b>n y d son primos entre sí</b> (p.ej. 2/3, 3/4, 3/5) la fracción tiene una <b>pulsación propia</b> que no se reduce a ninguna simple.</p>`,
    tipsTitle: 'Prueba las fracciones complejas',
    tips: `<p>Reproduce fracciones complejas (numerador mayor que 1) sobre una sección de la línea temporal. El ciclo abarca <b>n pulsos enteros</b> divididos en <b>d pulsos fraccionados (Pfr)</b>.</p><p>Cambia <b>numerador</b> y <b>denominador</b> de forma independiente con los botones <strong>+</strong> y <strong>-</strong>. Observa cómo cambia la velocidad de los PFr respecto a los pulsos enteros. La app funciona en bucle.</p><p>Si la fracción se puede reducir (p.ej. 4/6 = 2/3), la velocidad es la misma pero el ciclo dura el doble.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar una fracción aleatoriamente, 🗑 para reiniciar.</p><p><b>Tip:</b> Las fracciones complejas abren un nivel rítmico que las simples no alcanzan: el <b>ciclo polirrítmico</b>. Compara 2/3, 3/4 y 3/2 con el mismo BPM; son tres relaciones temporales distintas. </p>`,
  },
  19.5: {
    text: `<p>Igual que con las fracciones simples, también podemos crear ritmos seleccionando <b>pulsos fraccionados (PFr)</b> sobre el <b>ciclo</b> de una <b>fracción compleja</b>. La diferencia es que ahora el ciclo abarca <b>varios pulsos enteros</b>.</p><p>Por ejemplo, escogemos la fracción 5/4 y construimos la secuencia: P 5/4( 0.1 0.3). Como un ciclo abarca varios pulsos, la numeración de los PFr <b>se reinicia cada n pulsos</b>, no a cada pulso entero.</p><p>Los <b>PFr complejos</b> permiten componer ritmos con una pulsación independiente que no encaja dentro de un solo pulso entero. Es la base de las <b>polirritmias</b>: dos velocidades simultáneas que comparten un mismo BPM pero recorren el ciclo de manera distinta.</p>`,
    tipsTitle: 'Prueba la secuencia de PFr en ciclos',
    tips: `<p>Crea una secuencia de pulsos fraccionados (PFr) sobre fracciones complejas (n/d, n &gt; 1).</p><p>Edita <b>numerador</b> y <b>denominador</b> independientemente. Crea la secuencia escribiendo en el editor la posición del PFr (p.ej. <b>0.2</b>), o selecciona directamente los PFr en la línea temporal fraccionada. La app funciona en bucle.</p><p>Las fracciones reducibles (p.ej. 4/6) suenan igual que su forma simple equivalente (2/3) pero alargan el ciclo audible.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Una misma secuencia de PFr cambia radicalmente al alterar la fracción. Por ejemplo, prueba PFr(0.1 0.3) en 3/4 y 3/5 — los números son los mismos, la sensación rítmica es distinta. </p>`,
  },
  20.5: {
    text: `<p>El <b>intervalo temporal fraccionado</b> (<b>iTFr</b>) mide la <b>distancia</b> entre dos<b> </b>PFr <b>consecutivos</b>, igual que el iT mide la distancia entre dos pulsos enteros. Con fracciones, simples o complejas, esa distancia se cuenta en unidades del nuevo ciclo (Pfr): cada <b>iTFr </b>abarca uno o más <b>Pfr</b> del ciclo de la fracción n/d.</p><p>Como el ciclo abarca varios pulsos enteros, el <b>total de iTFr disponibles</b> es <b>Lg × d / n</b>: la longitud de la línea por el denominador, dividida por el numerador. La suma de todos los iTFr de una secuencia equivale a este total.</p><p>Con una secuencia de iTFr podemos pensar en ritmos como bloques de tiempo con identidad.</p>`,
    tipsTitle: 'Prueba los iTFr complejos',
    tips: `<p>Combina fracciones complejas (n/d, n &gt; 1) con intervalos temporales fraccionados (iTfr).</p><p>Edita <b>numerador</b> y <b>denominador</b>. Crea la secuencia de <b>iTFr</b> introduciendo duraciones en el editor o arrastrando sobre la línea temporal fraccionada para crear intervalos.</p><p>El display de suma de iT y iT disponibles se actualiza para mostrar cuántos iTFr hay en cada momento. Cada iTFr suena como una nota melódica: la primera nota de cada ciclo es Do4, las demás Sol4. Haz clic en un intervalo para eliminarlo. La app funciona en bucle.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Pensar las polirritmias como duraciones (iTFr) y no como posiciones (PFr) cambia la sensación de movimiento: cada secuencia tiene peso propio dentro del ciclo. Prueba la misma secuencia de iTFr en 2/3 y 3/4 — los bloques se mantienen, pero la velocidad relativa al pulso entero cambia por completo.</p>`,
  },
  21.5: {
    text: `<p>Si llevamos los <b>iTFr</b> al plano 2D y los repartimos por la línea sonora, podemos crear melodías con una <b>identidad polirrítmica propia</b>. Cada melodía tiene disponible dos velocidades; la que sigue el pulso y también una pulsación que encaja cada <b>n </b>(numerador) pulsos enteros. Esta combinación rítmica solo se consigue con las fracciones compuestas.</p><p>El editor <b>N-iT</b> funciona igual que con fracciones simples: cada par define una nota y su duración en iTFr. Pero ahora la duración se mide dentro del ciclo n/d. Una misma secuencia N-iT cambia de carácter al pasar de 2/3 a 3/4 o a 3/5, aunque las notas y las duraciones se mantienen proporcionalmente.</p>`,
    tipsTitle: 'Prueba el Plano N-iT con fracciones complejas',
    tips: `<p>Combina el plano fraccionado complejo con el editor zigzag para crear secuencias N-iT polirrítmicas.</p><p>Edita <b>numerador</b> y <b>denominador</b> de la fracción. Usa el editor para introducir pares N-iT o arrastra sobre el plano para crear notas con duración.</p><p>Pulsa ▶️ para reproducir, 🎲 para generar aleatoriamente, 🗑 para reiniciar.</p><p><b>Tips:</b> Mantén una secuencia N-iT y ve cambiando la fracción: la misma melodía aparece en versiones polirrítmicas distintas. Es una forma directa de descubrir cómo una idea musical se transforma al cambiar la pulsación subyacente sin tocar ni las notas ni los números de duración. El plano muestra el resultado visual, el editor las relaciones numéricas — pensar ambas a la vez conecta el lenguaje rítmico con la forma geométrica.</p>`,
  },
  // Pas intro parallax — Escalas.
  22: {
    text: `<p>Hasta ahora hemos tenido todas las notas disponibles.</p>
<p>Pero componer también consiste en <b>escoger</b> qué notas queremos utilizar.</p>
<p>En cada registro contamos con doce notas, pero a lo largo de la historia los músicos han seleccionado distintos grupos de notas por su manera de combinarse. Así nacieron las <b>escalas</b>.</p>
<p>Las <b>escalas</b> nos dan paletas de colores sonoros, cada una con su propio carácter.</p>
<p>Cambia la escala de una melodía y verás cómo su carácter también cambia: se vuelve más alegre o misterioso; más luminoso u oscuro.</p>
<p>Elegir una escala (por ejemplo, la escala mayor) es elegir un universo sonoro. Entra y escúchalas.</p>`,
  },
  23: {
    text: `<p>En buena parte de la tradición musical occidental, la escala diatónica de siete notas ha sido el punto de partida habitual. Nuzic, en cambio, toma las doce notas de la <b>escala cromática</b> como conjunto base.</p>
<p>Así, una <b>escala</b> es un grupo de notas escogidas entre las 12 disponibles de la escala cromática. A estas notas las llamamos <b>Notas de Grado</b> (<b>Nº</b>), y les asignamos una nueva numeración, empezando siempre desde el 0: <code>Nº(0)</code> y respetando el orden ascendente original de la escala cromática.</p>
<p>En la app vemos la escala mayor en la columna izquierda y la escala cromática en la columna derecha. Las N escogidas en la escala cromática se numeran en orden ascendente como Nº en la escala mayor.</p>`,
    tipsTitle: 'Prueba la Numeración de grado',
    tips: `<p>Escucha en la app la escala mayor: la más usada y un buen punto de partida.</p>
<p>Pulsa ▶️ en la escala cromática para escucharla.</p>
<p>Pulsa ▶️ en la escala mayor para escuchar las notas elegidas.</p>
<p><strong>Tips:</strong> Fíjate en cómo cambia la numeración de la misma nota en la escala mayor o en la cromática. Observa las líneas de conexión entre ambas escalas. Las 12 notas de la escala cromática son el conjunto base para la escala mayor y el resto de escalas.</p>`,
  },
  24: {
    text: `<p>Acabamos de ver que las distancias entre las Nº contiguas de una escala no son siempre las mismas. Este hecho es precisamente lo que da identidad sonora a una escala.</p>
<p>Si observamos estas distancias, podemos ver la <b>estructura escalar</b> (<b>eE</b>), es decir, las distancias entre notas contiguas de una escala, en orden ascendente y medidas en <b>iS</b> (intervalos Sonoros).</p>
<p>Cada escala tiene su propia eE. Sobre el papel la escribimos así: <code>eE(2 2 1 2 2 2 1)</code>. Cada número de la eE es un iS que revela la distancia entre dos notas contiguas de la escala. En la app ejemplo se muestra la eE de la escala Mayor.</p>`,
    tipsTitle: 'Prueba la Estructura Escalar',
    tips: `<p>Visualiza la estructura Escalar (eE) de la escala Mayor. Las barras de intervalos sonoros muestran los iS entre cada grado de la escala.</p>
<p>Pulsa ▶️ para escuchar la escala mayor con una animación que destaca la eE.</p>
<p><strong>Tips:</strong> En la línea sonora, a la izquierda, se muestran los grados de la escala mayor (Nº). A la derecha se muestra la estructura Escalar de la escala mayor: <code>eE(2 2 1 2 2 2 1)</code>.</p>`,
  },
  25: {
    text: `<p>Hasta ahora hemos visto la escala mayor empezando siempre en la <code>N(0)</code>. Pero una escala puede empezar en cualquier nota del registro de octava.</p>
<p>Decimos entonces que la escala se <b>transporta</b>. Es decir, la <code>Nº(0)</code> se mueve a cualquiera de las doce notas disponibles. La distancia entre notas, es decir, la <b>eE</b>, se mantiene. El resultado es la misma paleta sonora pero con diferentes notas (N).</p>`,
    tipsTitle: 'Prueba la transposición',
    tips: `<p>La app permite transportar la escala mayor a cualquiera de las 12 notas del registro. Incluye visualización en pentagrama y líneas de conexión entre la escala cromática y la escala transportada.</p>
<p>Selecciona una nota de salida. Pulsa ▶️ en la escala cromática o ▶️ en la escala escogida para escucharlas. Verás que el pentagrama se actualiza automáticamente.</p>
<p><strong>Tips:</strong> Transportar es aplicar la misma paleta sonora (la eE) desde un punto de partida diferente. La escala conserva su carácter pero cambia de altura. Es como cantar la misma canción más aguda o más grave.</p>`,
  },
  26: {
    text: `<p>En este capítulo hemos usado la escala mayor como ejemplo para entender qué es una escala.</p>
<p>Ahora podemos empezar a explorar las distintas sonoridades que propone el resto de escalas.</p>
<p>¿Sabías que hay <b>4096 escalas</b> posibles combinando las 12 notas? Para la app hemos escogido 10 entre las escalas más utilizadas.</p>
<p>Cada escala tiene su propia <b>eE</b> y se puede transportar a cualquiera de las N del registro de octava. Puedes ver y escuchar cada escala en la columna izquierda y compararla con la escala cromática en la columna derecha.</p>
<p>También hay un pentagrama que muestra la escala escogida en notación musical, junto con la <b>armadura</b> (los sostenidos y bemoles de la escala) de su transposición.</p>
<p>Las posibilidades se expanden al combinar diferentes escalas con distinta transposición. Por ejemplo, puedes cambiar de escala manteniendo la transposición, o mantener la escala e ir cambiando de transposición. O cambiar las dos variables. Fíjate que los resultados son muy diferentes.</p>`,
    tipsTitle: 'Prueba las escalas',
    tips: `<p>Selecciona una escala de la lista y una transposición en el selector.</p>
<p>Pulsa ▶️ en la escala cromática o ▶️ en la escala mayor para escucharlas.</p>
<p><strong>Tips:</strong> Al elegir escala y transposición, las líneas de conexión, el pentagrama y la estructura escalar (eE) se actualizan en tiempo real.</p>
<p>Compara la eE de diferentes escalas para entender sus distancias. Cada escala es un mundo sonoro distinto. Tómate tiempo para descubrirlas.</p>`,
  },
  27: {
    text: `<p>Ya hemos visto cómo crear secuencias de <b>N</b>. De la misma manera, también podemos definir una melodía creando una secuencia de <b>Nº</b>, es decir, una secuencia de notas de una escala. Simplemente ponemos los grados de la escala en el orden que queramos para la melodía. Por ejemplo, <code>Nº(4 0 2 3 1 5 6)</code>.</p>
<p>La melodía creada por una secuencia de Nº tiene la sonoridad y carácter propios de la escala de la que proviene.</p>
<p>La ventaja es que podemos cambiar de escala (y por tanto, de <b>eE</b>) y escuchar la diferencia. Algunas N de la melodía cambian y las Nº se mantienen.</p>
<p>También podemos cambiar la <b>transposición</b> y escuchar la melodía en diferentes tonos.</p>
<p>Combinar las dos técnicas anteriores abre un enorme abanico de posibilidades compositivas. Pruébalo en la app.</p>`,
    tipsTitle: 'Prueba tus melodías en diferentes escalas',
    tips: `<p>La app es un plano basado en Nº de las escalas. Las melodías se adaptan sonoramente al cambiar de escala: los grados se mantienen (misma Nº), las notas cambian.</p>
<p>Selecciona una escala y una transposición.</p>
<p>Usa el editor de Nº para entrar una secuencia. O haz clic en celdas del plano.</p>
<p>Si una escala tiene menos grados que la anterior, los grados "perdidos" se recuerdan internamente y reaparecen al volver a una escala más larga.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> Esta app demuestra que una melodía que está en una escala depende de las relaciones entre las Nº. Por ejemplo, crea una melodía en una escala mayor y después cambia a una menor: los grados se mantienen pero el carácter cambia completamente.</p>`,
  },
  28: {
    text: `<p>El <b>intervalo Sonoro de grado</b> (<b>iSº</b>) mide la distancia entre dos notas de grado (Nº). La unidad de medida o paso usado es el <code>iSº(1)</code>.</p>
<p>El iSº es como el iS, pero aplicado al contexto escalar. El iS mide la distancia entre dos N y el iSº mide la distancia entre dos Nº. Por tanto, el iSº, como la Nº, se usa solamente en escalas.</p>
<p>Igual que los iS, los iSº también pueden ser positivos o negativos, según si son ascendentes o descendentes. Por ejemplo, <code>iSº(4)</code> o <code>iSº(-5)</code>.</p>
<p>Las secuencias de iSº se escriben así: <code>iSº(4 -2 9 -1)</code>. La Nº para calcular el primer iSº es la <code>Nº(0)</code>.</p>
<p>En el paso anterior, la app permitía crear una melodía con Nº. En este paso podemos definir una melodía con distancias entre las Nº, es decir una secuencia de iSº.</p>
<p>Al cambiar de escala, los iSº de la melodía se mantienen, pero al usar una estructura escalar (eE) diferente, las distancias reales de la melodía cambian, por tanto también su carácter.</p>
<p>Además, podemos cambiar la <b>transposición</b> y escuchar la melodía en diferentes alturas sonoras.</p>`,
    tipsTitle: 'Prueba los iSº',
    tips: `<p>La app muestra una melodía hecha con iSº. El primer iSº determina la primera nota de la secuencia.</p>
<p>Puedes cambiar de escala en el selector. Las melodías se adaptan sonoramente: las distancias de grados se mantienen, algunas notas cambian. Puedes seleccionar una transposición para cambiar la altura sonora.</p>
<p>Introduce una secuencia de iSº para crear una melodía. También puedes hacer clic en las celdas del plano.</p>
<p>Pulsa ▶️ para reproducir, 🎲 para generar melodías aleatoriamente, 🗑 para reiniciar.</p>
<p><strong>Tips:</strong> Las secuencias de Nº e iSº dan la posibilidad de reutilizar ideas y variar plantillas sonoras de manera rápida y controlada, para así desarrollar una composición.</p>`,
  },
  // Parallax Lab — frases de prova (no són contingut del curs).
  28.5: {
    text: `<p>Bienvenido al <b>Parallax Lab</b>: el banco de pruebas de técnicas visuales del Sistema.</p>
<p>Abre el panel <b>Tweaks</b> y busca la sección <b>Parallax Lab</b>: cada técnica es un interruptor con sus parámetros.</p>
<p>Actívalas, combínalas y mueve los deslizadores: el efecto cambia <b>al instante</b> mientras navegas estas frases.</p>
<p>Prueba el botón <b>🎲 Aleatorio</b> para descubrir combinaciones inesperadas.</p>
<p>Cuando una combinación te guste, <b>Copiar config</b> la guarda como JSON para fijarla en el código.</p>`,
  },
  28.7: {
    image: {
      alt: 'Imagen de fondo para probar técnicas de máscara y zoom',
      src: 'images/paso-11.jpg',
    },
    text: `<p>Este es el laboratorio <b>B</b>: igual que el A, pero con una <b>imagen de fondo</b> y una <b>app</b> disponibles.</p>
<p>Las técnicas de máscara y zoom (<b>mask-zoom</b>, <b>zoom-drift</b>) lucen especialmente aquí.</p>
<p>La técnica <b>app-reveal</b> hace aparecer la app en una frase concreta, como un momento interactivo del relato.</p>
<p>Sigue avanzando: si app-reveal está activa, la app entrará en escena.</p>
<p>Todo lo que configures aquí queda guardado en este navegador, sin tocar las slides reales.</p>`,
  },
  // Paso 29 — CODA (parallax). Text de tancament del document.
  29: {
    text: `<p>Llegados a este punto hemos definido los espacios por donde se mueve la música: los <b>puntos</b> por los que pasa, las <b>distancias</b> que recorre, los <b>ciclos</b> que la organizan, las <b>fracciones</b> que multiplican el tiempo y las <b>escalas</b> que le dan color.</p>
<p>Con estas herramientas puedes ver una melodía, medirla, transformarla y crear otras nuevas.</p>
<p>Porque entender la <b>música en movimiento</b> no consiste solo en ponerle números: consiste en descubrir las relaciones que hacen que suene.</p>
<p>Este es el punto de partida. El sistema Nuzic continúa con nuevas formas de organizar, combinar y transformar la música.</p>
<p>Si practicas estos procesos de abstracción mentalmente, se amplía tu intuición musical. Se expande tu imaginación auditiva.</p>
<p>Profundiza en el <a href="https://www.nuzic.org/sistema/" target="_blank" rel="noopener">sistema de Nodos</a>: cada dimensión —el tiempo, el sonido y la simbiosis entre ambos— desplegada a fondo.</p>
<p>Compón con la app <a href="https://www.nuzic.org/App/" target="_blank" rel="noopener">Nuzic</a>: empieza con <em>Lite</em> y llega más lejos con <em>Pro</em>.</p>
<p>Y ponlo en práctica con otros en <a href="https://playnuzic.com/" target="_blank" rel="noopener">PlayNuzic</a>, donde el sistema se aprende creando.</p>`,
  },
};

// Default filler for pasos without explicit content yet.
export const fillerContent = {
  text: `<p>Este paso está pendiente de redactar. El esqueleto del Sistema está listo; cuando tengamos el texto teórico final del PDF o el material equivalente, se integrará aquí sustituyendo este marcador.</p>
<p>La densidad aquí será similar a la de los pasos ya redactados: 3 a 5 párrafos de 40–70 palabras, con términos clave en <strong>negrita</strong> y referencias cruzadas a apps vecinas cuando aplique.</p>`,
  tipsTitle: 'Tips de práctica',
  tips: `<p>Un consejo concreto aparecerá aquí cuando se redacte el contenido — una pista para usar la app y una observación sobre lo que se está aprendiendo.</p>`,
};
