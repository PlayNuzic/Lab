// Slide definitions — placeholders with realistic Spanish text density.
// Only a few slides are filled out for the skeleton review (Priority: Paso 4, 5, 21).
// Other slides show as stubs so nav works end-to-end.

export const sections = [
  { id:'introduccion', title:'Introducción', slides:[1,2,3,4,5,6] },
  { id:'descubriendo', title:'Descubriendo', slides:[7,8,9] },
  { id:'intervalos',   title:'Intervalos',   slides:[10] },
  { id:'ampliando',    title:'Ampliando',    slides:[11,12,13,14,15,16] },
  { id:'fraccionando', title:'Fraccionando', slides:[17,18,19,20,21] },
  { id:'escalas',      title:'Escalas',      slides:[22,23,24,25,26,27] },
];

// Condensed matrix: paso, title, template, layout, aspect, apps (array for toggle)
export const slideMatrix = [
  { paso:1, section:'introduccion', title:'¿Te gustaría saber qué movimientos se producen en la música?', template:'2-col' },
  { paso:2, section:'introduccion', title:'Contar y Medir', template:'2-col' },
  { paso:3, section:'introduccion', title:'Contar y Medir la Música', template:'3-col', layout:'span-left', aspect:'4/3', apps:['app11'] },
  { paso:4, section:'introduccion', title:'Línea Temporal', template:'3-col', layout:'span-left', aspect:'2/1', apps:['app9'] },
  { paso:5, section:'introduccion', title:'Línea Sonora', template:'3-col', layout:'col-right', aspect:'2/3', apps:['app10'] },
  { paso:6, section:'introduccion', title:'El Plano Musical', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App11A'] },
  { paso:7, section:'descubriendo', title:'Descubriendo la Música', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App12'] },
  { paso:8, section:'descubriendo', title:'Midiendo el movimiento: Los Intervalos', template:'3-col', layout:'span-left', aspect:'2/1', apps:['app13'] },
  { paso:9, section:'descubriendo', title:'Intervalo Sonoro', template:'3-col', layout:'span-left', aspect:'3/2', apps:['App14'] },
  { paso:10, section:'intervalos', title:'Intervalos en el Plano Musical', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App15'] },
  { paso:11, section:'ampliando', title:'Ampliando el Mapa: Patrones, Ciclos y Módulos', template:'2-col' },
  { paso:12, section:'ampliando', title:'El compás: el módulo temporal', template:'3-col', layout:'span-left', aspect:'2/1', apps:['App16'] },
  { paso:13, section:'ampliando', title:'Línea temporal en círculo', template:'3-col', layout:'span-left', aspect:'1/1', apps:['App17'] },
  { paso:14, section:'ampliando', title:'El registro de octava', template:'3-col', layout:'span-left', aspect:'3/2', apps:['App18'] },
  { paso:15, section:'ampliando', title:'Plano Modular', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App19'] },
  { paso:16, section:'ampliando', title:'Plano y Sucesión N-iT', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App20'] },
  { paso:17, section:'fraccionando', title:'Fraccionando la Línea Temporal', template:'3-col', layout:'span-left', aspect:'2/1', apps:['App26'] },
  { paso:18, section:'fraccionando', title:'Sucesión de Pulsos Fraccionados', template:'3-col', layout:'span-left', aspect:'2/1', apps:['App28'] },
  { paso:19, section:'fraccionando', title:'Sucesión de iT Fraccionados Simples', template:'3-col', layout:'span-left', aspect:'2/1', apps:['App30'] },
  { paso:20, section:'fraccionando', title:'Sucesión en Plano de Fracciones Simples', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App32'] },
  { paso:21, section:'fraccionando', title:'Fracciones Complejas', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App34','App35'], variantLabels:['App34 · principal','App35 · extra'] },
  { paso:22, section:'escalas', title:'Escalas: Escogiendo Notas', template:'3-col', layout:'span-left', aspect:'3/2', apps:['App21'] },
  { paso:23, section:'escalas', title:'Estructura Escalar', template:'3-col', layout:'span-left', aspect:'3/2', apps:['App22'] },
  { paso:24, section:'escalas', title:'Transposición', template:'3-col', layout:'span-left', aspect:'3/2', apps:['App23'] },
  { paso:25, section:'escalas', title:'Probando diferentes Escalas', template:'3-col', layout:'span-left', aspect:'3/2', apps:['App24'] },
  { paso:26, section:'escalas', title:'Melodías con Escalas', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App25','App25B'], variantLabels:['App25 · principal','App25B · iS'] },
  { paso:27, section:'escalas', title:'Intervalos con Escalas', template:'3-col', layout:'span-left', aspect:'4/3', apps:['App25B'] },
];

// Full content for the three priority slides (Paso 4, 5, 21) + representative fillers
// for pasos 1 and 22 so the user can see intro + scale layouts too.
export const slideContent = {
  1: {
    image: { alt: 'Calle con peatones y coches — placeholder' },
    text: `<p><strong>Imaginemos el seguimiento de una persona en un día.</strong> Para conocer sus movimientos hay que saber en qué puntos ha estado, en qué momento y cuánto tiempo se ha quedado. A partir de esa información puedes deducir y trazar en un mapa cómo se ha movido la persona.</p>
<p>Las coordenadas de los puntos donde ha estado, la hora y el tiempo, incluso la velocidad para ir de un punto a otro, se pueden describir con números.</p>
<p>¿Es aplicable a la música? <em>SI!…</em></p>`
  },
  4: {
    text: `<p>La <strong>línea temporal</strong> es horizontal y representa el movimiento en el tiempo. En ella marcamos unos puntos equidistantes que representan una velocidad constante, como si fueran los segundos de un reloj.</p>
<p>Definimos esta velocidad con un número, que se conoce como <strong>BPM</strong> (Beats Per Minute).</p>
<p>A los puntos de la línea temporal los llamamos <strong>pulsos</strong>, y los numeramos. Como buen instrumento de medición el pulso de partida es el 0.</p>
<p>Los pulsos nos permiten marcar exactamente en qué instante se producen los sonidos. El tiempo en la música se tiene que medir con gran precisión.</p>
<p>Como la pulsación del corazón, un <strong>paso temporal</strong> es el tiempo que pasa entre dos pulsos consecutivos. Este paso es la unidad temporal que usaremos para medir cuánto dura un sonido.</p>`,
    tipsTitle: 'Prueba la Línea Temporal',
    tips: `<p><strong>Uso básico:</strong> Pulsa ▶ y escucha. La app genera dos notas aleatorias en posiciones distintas de la línea temporal. Ajusta el BPM entre 50 y 150 para escuchar la línea más rápido o más lento.</p>
<p><strong>Tip:</strong> En la línea temporal podemos visualizar el paso del tiempo marcado por los pulsos y oír un sonido que ocurre en un pulso y que dura una pulsación o paso.</p>`
  },
  5: {
    text: `<p>La <strong>línea sonora</strong> representa los sonidos que crean la música. Los sonidos que usamos para empezar son las notas musicales. Cada punto de la línea es una nota de la escala cromática con su sonido característico.</p>
<p>A la primera nota le damos el número <strong>0</strong>. Es la nota de salida de la escala. Cada nota tiene su propio número para poder identificarla.</p>
<p>La línea sonora la colocamos en <em>vertical</em> para formar el plano con la línea temporal, así se ve muy bien la altura de cada nota. Las notas están organizadas en orden ascendente, de más grave a más aguda.</p>
<p>Las notas pueden seguir cualquier orden, pueden subir y bajar libremente creando así una <strong>melodía</strong>.</p>`,
    tipsTitle: 'Prueba Práctica',
    tips: `<p>La app muestra la línea sonora con 12 notas (0–11) donde puedes escuchar melodías.</p>
<p><strong>Uso:</strong> En la primera interacción, suena la escala cromática completa. A partir de la segunda, pulsa ▶ para reproducir melodías aleatorias de 6 notas.</p>`
  },
  21: {
    text: `<p>Las <strong>fracciones complejas</strong> permiten dividir un paso temporal en partes desiguales. Mientras las fracciones simples dividen el pulso en partes iguales (en mitades, tercios, cuartos…), las complejas admiten relaciones como <strong>3:2</strong> o <strong>5:4</strong> sobre un mismo grupo de pulsos.</p>
<p>Escribimos la fracción como <em>numerador / denominador</em>: el numerador indica cuántas divisiones hacemos y el denominador sobre cuántos pulsos. Así podemos notar tresillos, cinquillos, polirritmias y toda la familia de ritmos irracionales que aparece en la música contemporánea.</p>
<p>Combina App34 para explorar el <strong>pulso fraccionado complejo</strong> y App35 para ver la <strong>sucesión iT</strong> equivalente — son dos ventanas sobre el mismo fenómeno rítmico.</p>`,
    tipsTitle: 'Cómo practicar',
    tips: `<p><strong>App34 (principal):</strong> Introduce una fracción (p.ej. 3/2) y pulsa ▶. Escucharás el pulso original y la división compleja a la vez.</p>
<p><strong>App35 (extra):</strong> Misma fracción, ahora vista como sucesión de intervalos temporales (iT). Compara cómo se percibe la regularidad.</p>
<p><strong>Tip:</strong> Empieza con 3:2 a 80 BPM; sube a 5:4 cuando el oído esté cómodo.</p>`
  },
  22: {
    text: `<p>Hasta ahora hemos trabajado con la <strong>escala cromática</strong> completa (12 notas). Una <strong>escala</strong> es un subconjunto ordenado de notas que da carácter a una melodía.</p>
<p>Escogiendo menos notas de las 12 disponibles y repitiéndolas en octavas sucesivas, creamos el material melódico de una pieza. La escala mayor usa 7 notas; la pentatónica, 5.</p>
<p>La app te permite activar o desactivar notas y escuchar cómo cambia el color de una melodía aleatoria con el mismo contorno.</p>`,
    tipsTitle: 'Explora las escalas',
    tips: `<p>Activa/desactiva notas y pulsa ▶. La melodía usa solo las notas activas.</p>
<p><strong>Tip:</strong> Compara <em>Cromática</em> vs. <em>Mayor</em> — notarás la estabilidad tonal al restringir el material.</p>`
  },
};

// Default filler for slides without explicit content
export const fillerContent = {
  text: `<p>Este paso está pendiente de redactar. El esqueleto de la web está listo; solo falta el texto teórico específico de este apartado.</p>
<p>La densidad aquí será similar a la de los pasos ya redactados: 3 a 5 párrafos de unos 40–70 palabras, con términos clave en <strong>negrita</strong> y referencias cruzadas a apps vecinas cuando aplique.</p>`,
  tipsTitle: 'Tips de práctica',
  tips: `<p>Un consejo concreto aparecerá aquí cuando se redacte el contenido — una pista para usar la app y una observación sobre lo que se está aprendiendo.</p>`
};
