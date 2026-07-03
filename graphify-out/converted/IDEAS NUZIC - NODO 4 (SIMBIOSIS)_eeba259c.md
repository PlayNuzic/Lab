<!-- converted from IDEAS NUZIC - NODO 4 (SIMBIOSIS).docx -->

Nodo 4 - Simbiosis.3
Simbiosis
# Representaciones de la Simbiosis
Representamos la simbiosis de las dos dimensiones en el cuadro y el PMC.
Todos los valores numéricos de los elementos están relacionados (sincronizados). Por ejemplo, si cambias un pulso de posición, cambiará también la nota asociada con el pulso.
Cuando añades un elemento de distancia o posición se genera un elemento complementario (de distancia para posición y viceversa).
Los elementos de posición (P, N) modifican los elementos de distancia relacionados.
Los elementos de distancia (iT, iS) modifican los elementos de posición posteriores.

## El Cuadro
El cuadro combina información numérica y conceptual, haciendo visible la relación entre tiempo y sonido dentro de un sistema organizado y estructurado.
Es una matriz que organiza los elementos de las dimensiones sonora y temporal en columnas.
Las columnas son las unidades mínimas del cuadro, representan la sincronización entre los elementos temporales y los elementos sonoros asociados.
Hay tres elementos sonoros y tres temporales en el cuadro de la app con sus numeraciones:
Sonoros:
Nota. Con numeraciones absoluta (Na), modular (Nm) y de grado (Nº).
intervalo Sonoro. Con numeraciones absoluta (iSa), modular (iSm) y de grado (iSº)
intervalo Armónico: Con numeraciones absoluta (iAa), modular (iAm) y de grado (iAº).
Temporales:
Pulso: Con numeraciones absoluta (Pa), modular (Pm), y del segmento (Psg).
intervalo Temporal absoluto (iTa).
Fracción (Fr): División del Pulso por una fracción.
Los elementos de las dimensiones sonora y temporal están entrelazados, creando pares y combinaciones de elementos conectados. En estos pares el orden no es relevante:
Posibles entrelazamientos:
P - N: El primer P siempre es 0, la N de salida, en cambio, hay que definirla.
iT - N: Se define la duración de la nota. El iT define dos pulsos.
iS - 2 N: Hay que definir una 1a N para crear el iS que definirá la 2a N.
iS - 2 iT: La duración de las dos notas quedan definidas.
2 N - iA: Las voces superpuestas crean el iA.
2 iT - 2 iA: La N de la voz grave crea el 1r iA. El 2o iT crea el 2o iA.
Estas combinaciones son una entidad en sí, unidades de elementos entrelazados.
En la app, si creamos un P en la d. temporal, se creará en la misma columna un elemento indefinido (e) en la línea de N de la d. sonora, ya que aún no habrá sido escogida aún una nota o silencio para ese pulso.
## El PMC (Plano Musical de Coordenadas)
El PMC es una representación visual del cuadro Nuzic que organiza los elementos sonoros en una línea vertical y los elementos temporales en una línea horizontal, que interseccionan en el número 0 de cada línea para visualizar la relación entre dimensiones.
Representa la música en segmentos, delimitados entre 2 barras verticales negras, que contienen los elementos.
Puedes modificar la longitud del segmento arrastrando a izquierda o derecha el punto que está debajo del signo positivo al final del segmento.
El eje horizontal representa los Pulsos y iT definidos en cada segmento, mientras que el eje vertical representa la colección de Notas y iS.
## El Segmento
El segmento es una longitud que contiene una idea musical. Es el punto de partida.
El segmento es la unidad mínima sobre la que se dispondrán los elementos (P, N, iT, iS) para construir una idea musical.
El segmento contiene sucesiones de elementos de las dos dimensiones (sonora y temporal) sincronizadas.
Los segmentos se pueden crear, borrar, unir, dividir, copiar, pegar, limpiar y nombrar.
Se pueden crear segmentos antes y después del actual.
# Creación de un segmento
Hay numerosas maneras de crear un segmento. Explicamos a continuación un posible camino a partir de una duración: LgSg.
El punto de partida: La Longitud del segmento (LgSg):
Define el marco de referencia temporal (DT) sobre el cual se va a trabajar. La duración del segmento dependerá del BPM (Beats por minuto), que indica la velocidad en que se medirá la música: S = (Lg / BPM) * 60. La duración es a la vez objetiva (medida en cantidad de pulsaciones) y subjetiva, ya que depende del momento y percepción de cada individuo.
A su vez se decide cómo se organizarán las notas en el marco de referencia  sonoro (DS). Es decir, en que tipo de afinación se trabajará, definiendo el TET (cantidad de notas equidistantes entre sí por octava). Lo más usual es escoger TET:12.
Después de definir los conjuntos de referencia, podemos elegir los conjuntos modulares.
Podemos elegir si usar un compás de referencia o trabajar sin compás.
Si se opta por usar compases, se puede trabajar con Pulsos modulares (Pm) y la numeración modular del compás.
Si se escoge no usar compases, se trabaja con Pulsos del segmento (PSg) y la numeración del segmento.
Adicionalmente podemos usar una fracción (Fr) y su numeración de pulsos fraccionados (PFr).
Paralelamente podemos elegir usar una escala específica o trabajar sin escala, .
Si se opta por usar una escala, se puede aplicar la numeración de grado a las notas e intervalos (Nº, iSº, iAº).
En caso de no usar una escala específica, se trabaja con la numeración modular del TET escogido (Nm, iSm, iAm).
El último paso es tomar el control creativo con los conjuntos expresivos. Esto es creando sucesiones de Pulsos (P) y colecciones y sucesiones de intervalos del resto de elementos.
En el momento en que creemos una segunda voz, aparece el intervalo armónico (iA) y la posibilidad de crear ciclos rítmicos.

## Otros caminos
Anteriormente hemos seguido un camino con un orden determinado, pero es igualmente válido iniciar el proceso con cualquier idea. Además, es posible cambiar de idea de un segmento (Sg) a otro, o incluso dentro del mismo, según las necesidades creativas. ¡La decisión es completamente tuya!
De los tres tipos de conjuntos en Nuzic, definir un conjunto de referencia es el inicio de cualquier composición→(TET:12)
Los dos otros tipos de conjunto, junto con sus correspondientes elementos, ofrecen diferentes vías para iniciar el proceso creativo. Proponemos algunos ejemplos a continuación:
Podemos optar por trabajar únicamente con colecciones de elementos de distancia (iT, iS) o de posición (N, P) y posponer la definición de los conjuntos estructurales hasta el final del proceso. Con esta estrategia, se organizan y combinan distancias o posiciones de manera libre antes de darles un conjunto estructural.
Otra alternativa consistiría en establecer primero los elementos de una de las dos dimensiones (temporal o sonora) y, posteriormente, complementar la otra dimensión siguiendo las restricciones que haya impuesto la primera. Durante el proceso, se puede decidir en qué momento —o si en absoluto— se recurre a los conjuntos estructurales.
También se podría iniciar la composición mediante colecciones o sucesiones de un único tipo de elemento, utilizándolas como punto de partida para después integrarlas con otros tipos de elemento. Así, se garantiza una construcción musical flexible y adaptada a las necesidades creativas del momento.
# Creación de sucesiones de Números
Los números, como herramienta principal de Nuzic, nos sirven para crear estructuras numéricas abstractas sin tener que definir los elementos sobre los que aplicarlos.
Podemos escoger libremente los números a partir de un criterio personal. En este caso no hay límites para crear.
Podemos usar la calculadora para generar unos números aleatorios a partir de un rango o de una colección.
Rango:
Definimos un rango mediante un número inferior y un número superior.
Definimos la cantidad de números que queremos.
Colección:
Definimos la colección.
Definimos la cantidad de números que queremos.
Podemos usar la pestaña calculadora para crear una nueva sucesión de números que es resultado de una operación predefinida aplicada a una sucesión previa.
Hay dos grandes grupos de operaciones numéricas. Las operaciones que cambian el valor de los números (aritméticas o de desplazamiento) y las que cambian el orden de los números (permutaciones):
Operaciones aritméticas: cambian el valor de los números, lo que implica un desplazamiento de los elementos:
Suma, resta.
Reflejo vertical: Los números cambian de signo (si el eje está en el 0).
Estas operaciones pueden ser homogéneas si actúan sobre todos los números de la sucesión, o heterogéneas si solo actúan sobre algunos.
Permutaciones: cambia el orden de los números dentro de la sucesión. 
Son homogéneas:
Rotación: El primer número (o grupo de números) se mueve al final de la sucesión. Es equivalente a cambiar la posición de salida en un círculo de números.
Reflejo horizontal: El orden de los números se invierte.
Permutaciones Aleatorias: El orden se cambia al azar.
Las permutaciones no cambian la colección de números.
Podemos crear una sucesión de números que siguen una o varias reglas predefinidas, que actúan como un mecanismo automático que genera unos patrones repetitivos. Ejemplos:
Regla: n’ = {n + 3}. Suc (0 3 6 9)
Reglas: n’ = {n + 3}, n’’ = {n’ - 1}. Suc (0 3 2 5 4 7 6)
Regla: iSm (1 -7 3) aplicada sobre Nm(0 4 2 5) → Nm(0 1 6 9)(4 5 10 1)...
Regla iT(1 2)
Al crear sucesiones de números de un elemento, estas tienen que seguir las características concretas del propio elemento:
Los P, iT y N son números naturales (siempre positivos).
Los iS son números enteros (pueden ser positivos o negativos).
## Conversión de elementos
Una sucesión de un tipo de elemento se puede convertir a otro tipo de elemento:
De Posición a Distancia y viceversa:
La sucesión P(0 1 3 4) crea una sucesión iT(1 2 1).
La sucesión Nm(0 4 5 2) crea una sucesión iSm(4 1 -3).
Si las características entre elementos son diferentes, podemos forzar la conversión:
Podemos forzar estos elementos entre sí: Nº, iSº, P, iT.
Al forzar, escogemos si eliminar o cambiar los signos negativos en el elemento convertido.
También se eliminan los elementos que están fuera del rango del elemento convertido.
# Creación de la Composición: Sucesiones de Segmentos
En Nuzic, la composición es una sucesión de segmentos en un orden concreto.
Podemos usar el Pulso absoluto (Pa) para medir y señalar segmentos dentro de la composición, ya que nos da una visión global y indexada de la composición.
Podemos escoger la sucesión de segmentos de una colección de segmentos ya definida, ordenándolos en el orden que creamos oportuno.
### Una sucesión de segmentos puede organizarse de distintas maneras:
Libre: Se crean los segmentos y se ordenan como apetezca.
Repetición: Repetir un segmento existente de manera idéntica las veces que se quiera.
Repetición con Transformación:
La transformación es un ajuste fino y subjetivo de un segmento.
Las repeticiones tendrán una alteración de uno o varios elementos del segmento.
La nueva unidad tendrá algunos o muchos elementos distintos dependiendo del grado de contraste.
Repetición con Operación:
La operación es una alteración predefinida de un tipo de elemento concreto del segmento.
Las repeticiones con operación son un cambio organizado de antemano, que permite desarrollar ideas de forma controlada.
Se pueden combinar varias operaciones en un orden definido.
Tipos de operaciones por elemento:


Variaciones y grado de contraste:
Las operaciones y transformaciones crean variaciones de un segmento original que dan lugar a nuevos segmentos con características distintas.
El grado de contraste representa el nivel de diferencia entre el segmento transformado y el original. Es una herramienta para definir cómo se perciben las variaciones dentro de la composición.
Los parámetros son una herramienta para controlar el grado de contraste.
Para percibir que la transformaciones se reconozcan en el original, deben realizarse con cierta moderación. Si se intensifican las transformaciones, se pierde semblanza con el original.
Una vez creadas las variaciones, podemos ordenar los segmentos como elijamos. Ejemplo: A partir de 3 sucesiones diferentes (A B C) puedes crear variaciones y ordenarlas por un criterio escogido: A A’ A’’ B C C’ B’ A A’’
# La Forma y la Unidad
### La Unidad
La unidad es cualquier conjunto de elementos que se perciben como una entidad unificada (al menos para el compositor!).
Las unidades que estructuran la forma deberían ser perceptibles claramente.
La definición de ciertos parámetros o la exclusión de otros ayudan a clarificar la percepción de las unidades.
Una unidad puede estar formada por unidades más pequeñas.
Y a su vez formar parte de una unidad más grande.
La unidad puede estar contenida en un segmento o varios. Es un concepto abstracto y flexible que nos permite organizar la música en niveles.
### La Forma
Para Nuzic el concepto de forma no es estricto. Es un flujo donde se organizan las diferentes unidades.
Es la manera como las unidades se organizan y así estructuran la totalidad de la obra. La forma surge de las características de las unidades más pequeñas, que evolucionan a través de transformaciones y operaciones.
Cada composición origina su propia forma que está enteramente ligada al contenido de sus unidades y cómo se estructuran.
Hay infinitas maneras de estructurar una forma, los parámetros que entran en juego exceden por mucho los definidos en el sistema Nuzic. En este aspecto, la forma se asemeja a la estructura de un libro.
### Los Niveles de la forma
Definimos a continuación un posible modelo para estructurar la forma, con cuatro niveles de unidades ordenadas por tamaño.
A medida que las unidades aumentan en complejidad y tamaño, avanzan hacia niveles superiores, integrándose en estructuras más amplias, que a su vez se perciben como una unidad:
Nivel 1:
Las unidades más pequeñas creadas espontáneamente mediante criterios de inspiración.
Este nivel se puede comparar al de las células de un ser vivo o las palabras de una frase.
Nivel 2:
Unidades de medida intermedia formadas por sucesiones de las unidades más pequeñas, ordenadas con un criterio de repetición y transformación (grado de contraste).
Este nivel se puede comparar al del tejido de un ser vivo o las frases de un texto.
Lo ideal en estas unidades es conseguir coherencia con las unidades más pequeñas, basándose en procesos de deducción y transformación.
Nivel 3
Unidades grandes que se forman colocando las unidades intermedias en un orden concreto.
Se pueden comparar a los párrafos de un texto o los miembros anatómicos de un ser vivo.
Lo ideal en este nivel es conseguir flujo narrativo y claridad de percepción.
Nivel 4
La totalidad de la composición es la unidad final.
Puede estar formado por distintos niveles o por uno solo.
Lo ideal en este nivel es que se perciba una coherencia que integre todas las unidades de los diferentes niveles.
El sistema permite un movimiento flexible e interactivo de ideas entre niveles, facilitando procesos creativos y analíticos adaptados a las necesidades específicas del compositor.
# Conclusiones finales
La metodología Nuzic unifica y identifica con precisión conceptos musicales.
La notación numérica que integra con claridad elementos de posición y distancia, así como las dimensiones temporal y sonora en un único sistema.
Sintetiza principios fundamentales de la teoría clásica, popular y contemporánea, junto con enfoques avanzados de organización rítmica y estructural.
Nuzic empodera al músico. Al combinar la precisión numérica con la sensibilidad artística, el sistema facilita la generación de ideas creativas y la comprensión profunda de relaciones musicales.
Destaca por la flexibilidad que le otorgan sus algoritmos para transformar cualquier tipo de música.
Fomenta una autonomía creativa que permite transitar entre conceptos musicales abstractos y concretos.
### Control creativo y autonomía
A través de sus apps, Nuzic ofrece una representación interconectada y dinámica de la música, donde cualquier modificación de un elemento afecta automáticamente a sus elementos relacionados. Este comportamiento automático de las aplicaciones constituye tanto una ayuda práctica, facilitando la comprensión y la aplicación inmediata de las relaciones entre elementos, como una restricción, ya que limita las posibilidades creativas al imponer reglas estrictas de funcionamiento.
La verdadera esencia del método Nuzic se manifiesta cuando el sujeto asimila la lógica interna del sistema y puede prescindir de las herramientas digitales, liberándose de las restricciones de las apps y adaptando el sistema a necesidades y contextos específicos.
Nodo 3 - Simbiosis.2
Simbiosis
# Representaciones de la Simbiosis
## El Cuadro
Es una matriz que organiza los elementos de las dimensiones sonora y temporal en columnas.
Las columnas son las unidades mínimas del cuadro, representan la sincronización entre los elementos temporales y los elementos sonoros asociados.
Cada celda representa un fragmento de información interrelacionada:
Los elementos representados de la dimensión sonora son las N y los iS.
Los elementos representados de la dimensión temporal son los P y los iT.
Si creamos un P en la d. temporal, se creará en la misma columna un elemento indefinido (e) en la línea de N de la d. sonora, ya que aún no habrá sido escogida aún una nota o silencio para ese pulso.
Hay cuatro elementos sonoros y cinco temporales en el cuadro de la app:
Sonoros:
Nota Modular (Nm)
Nota de grado (Nº)
intervalo Sonoro Modular (iSm)
intervalo Sonoro de grado (iSº)
Temporales:
Pulso absoluto (Pa)
Pulso modular (Pm)
Pulso del segmento (Psg)
intervalo Temporal absoluto (iTa)
Fracción (Fr)
El cuadro combina información numérica y conceptual, haciendo visible la relación entre tiempo y sonido dentro de un sistema organizado y estructurado.
## El PMC (Plano Musical de Coordenadas)
El PMC es una representación visual del cuadro Nuzic que organiza los elementos sonoros en una línea vertical y los elementos temporales en una línea horizontal, que interseccionan en el número 0 de cada línea para visualizar la relación entre dimensiones.
Representa la música en segmentos, delimitados entre 2 barras verticales negras, que contienen los elementos.
Puedes modificar la longitud del segmento arrastrando a izquierda o derecha el punto que está debajo del signo positivo al final del segmento.
El eje horizontal representa los Pulsos y iT definidos en cada segmento, mientras que el eje vertical representa la colección de Notas y iS.
## El Segmento
El segmento es una longitud que contiene una idea musical. Es el punto de partida.
El segmento es la unidad mínima sobre la que se dispondrán los elementos (P, N, iT, iS) para construir una idea musical.
El segmento contiene sucesiones de elementos de las dos dimensiones (sonora y temporal) sincronizadas.
Los segmentos se pueden crear, borrar, unir, dividir, copiar, pegar, limpiar y nombrar.
Se pueden crear segmentos antes y después del actual.
# Creación de un segmento
## Elementos entrelazados
En la simbiosis, los elementos de las dimensiones sonora y temporal están entrelazados, creando pares y combinaciones de elementos. En estos pares el orden no es relevante. Los clasificamos por:
Entrelazamiento Horizontal:
P - N: El primer P siempre es 0, la N de salida, en cambio, hay que definirla.
iT - N: Se define la duración de la nota. El iT define dos pulsos.
iS - 2 N: Hay que definir una 1a N para crear el iS que definirá la 2a N.
iS - 2 iT: La duración de las dos notas quedan definidas.
Entrelazamiento vertical, al superponer dos voces:
2 N - iA: Las voces superpuestas crean el iA.
2 iT - 2 iA: La N de la voz grave permite el 1r iA. El 2o iT permite el 2o iA.
Estas combinaciones son una entidad en sí, unidades de elementos entrelazados.
## El Trayecto iniciático (P→iT→N→iS)
Uno de ellos, hay muchos más. Escogemos uno
### Etapa 1 (P→iT)
Longitud: El segmento crea una longitud (Lg) determinada para la idea.
La duración en tiempo del segmento dependerá del PPM.
Para obtener los Segundos: S = (Lg / PPM) * 60
El tiempo objetivo: Pulsaciones: Representan el tiempo cuantificado.
Puedes definir el compás
El tiempo subjetivo: Depende de la percepción individual y del momento.
Pulso:
Creamos un pulso que divide la longitud del segmento en dos partes.
Se crea una relación con el pulso 0. El P(0) es la salida de la primera parte. El nuevo P es la salida de la parte relacionada.
A partir de aquí, podemos crear una sucesión de Pulsos dentro del segmento.
A estos Pulsos se les asigna un elemento indefinido (e).
El sonido de (e) sirve para escuchar el ritmo definido por los P escogidos.
iT:
La sucesión de Pulsos crea a su vez una sucesión de iT (distancia entre P).
Para modificar la sucesión de P:
podemos añadir P entre los ya creados → nuevos iT
o cambiar el valor de los iT → modifica P
Esta modificación produce que se adapten al iT todos los Pulsos posteriores.
### Etapa 2 (N→iS)
Nota:
Sobre los Pulsos definidos aparece un elemento indefinido (e).
Podemos poner un sonido escogido. Ese sonido puede ser:
una nota (N)
un sonido percusivo
un silencio (s)
Su duración será la del iT correspondiente al pulso. (opción: la Nota dura iT(1). El resto de la duración inicial del P se rellena con un silencio).
Si añadimos una nota (N) entre los Pulsos ya definidos, se creará un nuevo Pulso a un iT(1) de distancia de la nota previa.
iS:
La sucesión de Notas crea una sucesión de iS.
Los iS definen la distancia entre dos notas, independientemente de que entre ellas haya un silencio o elemento indefinido.
Si cambiamos el valor de una Nota, cambia el iS correspondiente.
Si cambiamos el valor de un iS, todas las Notas siguientes se adaptarán al nuevo iS, ya que los iS posteriores se mantienen.
## Otros trayectos
Empezar con elementos de Distancia: Ej: iT→P→N→iS.
La sucesión sugerida es: iT → P → N → iS.
Los iT generan los Pulsos que, a su vez, definen el ritmo.
Puedes continuar añadiendo Notas (N) sobre los Pulsos
Finalmente, modificar los iS para modificar la melodía.
Empezar por elementos de Posición. Ej: P→N→iS→iT
El recorrido sería: P → N → iS → iT.
A partir de una sucesión de P, asignas Notas
y ajustas los Intervalos Sonoros (iS)
y Temporales (iT) según necesites.
Empezar por la dimensión Sonora:
La sucesión sugerida es: N → iT → P → iS.
Notas: Cada nota se asignará al Pulso siguiente.
Para crear un ritmo hay que modificar los iT(1) que crean los P por defecto.
La sucesión sugerida es: iS → N → P → iT.
El 1r iS se considera el intervalo 0, que corresponde a la primera Nota.
A partir de la sucesión de N→P, asignas iT.
Empezar por la dimensión Temporal:
Pulsos: El trayecto iniciático ( iT→P→N→iS)
iT:
Los iT crean Pulsos que generan un ritmo (iT→P→N→iS).
Poniendo N a los iT generamos una melodía que podemos modificar al cambiar los iS.
Empezar a partir de un elemento e ir combinando con otros elementos.
Ejs: N→ iS. iT→ P, etc.
## Observaciones
Todos los valores numéricos de los elementos están relacionados (sincronizados). Por ejemplo, si cambias un pulso de posición, cambiará también la nota asociada con el pulso.
Cuando añades un elemento de distancia o posición se genera un elemento complementario (de distancia para posición y viceversa).
Los elementos de posición (P, N) modifican los elementos de distancia relacionados.
Los elementos de distancia (iT, iS) modifican los elementos de posición posteriores.
## Etapa 3: Desarrollos
Podemos desarrollar los segmentos de muchas maneras. Hacemos referencia a algunas de esas maneras aquí, que abordamos en profundidad en los capítulos referidos.
Fraccionamiento: Dividir los Pulsos de un segmento por una fracción.
iA entre dos voces: Crear melodías en la voz superior usando iA en referencia a la voz inferior.
Voz armónica: Crear acordes dentro de la misma voz.
Escalas: Biblioteca con las principales escalas madre y sus rotaciones.
# Creación de sucesiones de Números
Podemos escoger libremente los números a partir de un criterio personal. En este caso no es necesario usar límites para crear.
Podemos usar la calculadora para generar unos números aleatorios a partir de un rango o de una colección.
Rango:
Definimos un rango mediante un número inferior y un número superior.
Definimos la cantidad de números que queremos.
Colección:
Definimos la colección.
Definimos la cantidad de números que queremos.
Podemos crear una sucesión de números que siguen una o varias reglas predefinidas, que actúan como un mecanismo automático que genera unos patrones repetitivos. Ejemplos:
Regla: n’ = {n + 3}. Suc (0 3 6 9)
Reglas: n’ = {n + 3}, n’’ = {n’ - 1}. Suc (0 3 2 5 4 7 6)
Regla: iSm (1 -7 3) aplicada sobre Nm(0 4 2 5) → Nm(0 1 6 9)(4 5 10 1)...
Regla iT(1 2)
Al aplicar sucesiones de números a un elemento, estas tienen que seguir las características concretas de cada elemento:
Los P, iT y N son números naturales (siempre positivos).
Los iS son números enteros (pueden ser positivos o negativos).
## Conversión de elementos
Una sucesión de un tipo de elemento se puede convertir a otro tipo de elemento:
De Posición a Distancia y viceversa:
La sucesión P(0 1 3 4) crea una sucesión iT(1 2 1).
La sucesión Nm(0 4 5 2) crea una sucesión iSm(4 1 -3).
Si las características entre elementos son diferentes, podemos forzar la conversión:
Podemos forzar estos elementos entre sí: Nº, iSº, P, iT.
Al forzar, escogemos si eliminar o cambiar los signos negativos en el elemento convertido.
También se eliminan los elementos que están fuera del rango del elemento convertido.
## La Composición: Sucesiones de Segmentos
### Una sucesión de segmentos puede organizarse de distintas maneras:
Libre: Creas los segmentos y los ordenas como te apetezca.
Repetición: Repetir un segmento anterior de manera idéntica las veces que quieras.
Transformación:
Es una repetición con alteración o cambio de uno o varios elementos.
La nueva unidad tendrá algunos elementos distintos.
La transformación es un ajuste fino y subjetivo.
Operaciones:
Son alteraciones o cambios predefinidos de todos los elementos de un tipo.
En el nuevo segmento habrá cambiado un tipo de elemento concreto.
La operación es un cambio automático y organizado de antemano.
Se pueden combinar varias operaciones en un orden definido.
### Variación: combinaciones de repetición,transformación y operaciones
Cambios en el segmento que crean un segmento con otras características.
Los cambios los define el criterio del compositor.
Hay muchas combinaciones posibles. Aquí enumeramos algunas:
Añadir o quitar elementos de posición: N o P (si quitas uno desaparece también el otro). Puedes decidir si cambia la longitud o no.
Añadir o quitar elementos de distancia: iS cambian las N posteriores (pueden ser positivos o negativos). iT
Repetir un segmento cambiando uno o varios parámetros.
### Grado de Contraste
Representa el nivel de diferencia entre el segmento transformado y el original.
Las transformaciones deben ser limitadas para asegurar que la transformación se reconoce en el original.
Si se intensifican las transformaciones se pierde semblanza con el original.
Ejemplo: A partir de 3 sucesiones diferentes (A B C) puedes crear variaciones y ordenarlas por el criterio escogido: A A’ A’’ B C C’ B’ A A’’
# La Forma
### La Unidad
La unidad es cualquier conjunto de elementos que se percibe como una entidad unificada (al menos para el compositor!).
Las unidades que estructuran la forma deberían ser perceptibles claramente.
La definición de ciertos parámetros o la exclusión de otros ayudan a clarificar la percepción de las estructuras.
Una unidad puede estar formada por unidades más pequeñas.
Y a su vez formar parte de una unidad más grande.
La unidad puede estar contenida en un segmento o varios. Es un concepto abstracto y flexible que nos permite organizar la música en niveles.
### La Forma
Para Nuzic el concepto de forma no es estricto. Es un flujo donde se organizan diferentes unidades.
La forma es la manera en la que las unidades se organizan y estructuran la totalidad de la obra, con el fin de interrelacionar todas sus partes.
Hay infinitas maneras de estructurar una forma, los parámetros que entran en juego exceden por mucho los definidos en el sistema Nuzic.
Se puede comparar con la estructura de un libro.
La forma surge de las características de las unidades más pequeñas, que evolucionan a través de transformaciones y operaciones.
Cada composición origina su propia forma que está enteramente ligada al contenido de sus partes.
### Los Niveles estructurales
A medida que las unidades aumentan en complejidad, van transitando entre niveles ( a un nivel superior que a su vez se percibe como una unidad.)
Es posible para las unidades transitar libremente entre niveles.
Definimos un modelo de estructura de referencia con cuatro niveles de unidades cada vez mayores:
Nivel 1
Las unidades más pequeñas creadas espontáneamente mediante criterios de inspiración.
Este nivel se puede comparar al de las células de un ser vivo o las palabras de una frase.
Nivel 2
Unidades de medida intermedia formadas por sucesiones de las unidades más pequeñas y ordenadas con un criterio de repetición (grado de contraste).
Este nivel se puede comparar al del tejido de un ser vivo o las frases de un texto.
La prioridad de estas unidades  es la coherencia con las más pequeñas basada en procesos de deducción y transformación.
Nivel 3
Unidades grandes que se forman colocando las unidades intermedias en un orden concreto.
Se pueden comparar a los párrafos de un texto o los miembros anatómicos de un ser vivo.
La prioridad en este nivel es la narrativa y la calidad de percepción.
Nivel 4
La totalidad de la composición es la unidad final.
Puede estar formado por distintos niveles de unidad o por uno solo.
La prioridad en este nivel es que se perciba coherencia en la unidad que integra todas las estructuras de los diferentes niveles.
# Sistema sin la App
Una vez conoces el sistema, puedes trabajar sin la app.
La asimilación final del sistema.
Escritura abstracta en papel: Reexplicar todo, rápido y mostrar ejemplos sobre papel
Esto te lleva a interiorizar. A oir sucesiones, crear con las ideas del sistema (interiorizado)
Desaparecen las restricciones de la app. Eres libre de crear sin límites.
### Precisión y unificación conceptual
El sistema Nuzic, basado en la aplicación de números para analizar y componer música, ofrece ventajas significativas incluso sin recurrir a la app, gracias a su marco conceptual robusto y versátil, sintetizando principios fundamentales de la teoría clásica y contemporánea, junto con enfoques avanzados de organización rítmica y estructural.
Mediante los diferentes elementos y numeraciones, Nuzic permite una representación exacta de las relaciones temporales y sonoras, unificando ambos aspectos en un único sistema analítico que traduce conceptos abstractos en elementos musicales concretos y viceversa.
### Control creativo y autonomía
Sin depender de herramientas digitales, el usuario puede utilizar el sistema Nuzic como un marco teórico y práctico para desarrollar composiciones y análisis de manera independiente. Esto permite recuperar el control total del proceso creativo, trabajando a su propio ritmo y adaptando el sistema a necesidades y contextos específicos.
Las reglas y operaciones del sistema están diseñadas de forma clara y estructurada, lo que permite que se puedan aplicar fácilmente sobre papel y lápiz. Esto facilita que cualquiera pueda experimentar con los conceptos del sistema sin necesidad de usar dispositivos digitales.
### Flexibilidad y fertilidad creativa
El sistema habilita la aplicación de operaciones aritméticas—como desplazamientos, permutaciones, reflejos y cálculos de proporciones—sobre los elementos musicales.
Esta capacidad de generar nuevos números abre un espacio para experimentar, donde el creador pone el límite de las reglas. Puede jugar con los elementos, conjuntos y las estructuras musicales  de manera creativa, sin los límites de la app, o sistematizable, ajustando el sistema a restricciones.
Usar el sistema Nuzic sin la app brinda la posibilidad de trabajar con un modelo que es preciso, flexible, interdisciplinario y universal, ofreciendo al compositor y analista musical una plataforma teórica que potencia la creatividad y el rigor en la representación y transformación de la música.







Nodo 3 - Simbiosis.1
Simbiosis
# Representaciones de la Simbiosis
## El Cuadro
Es una matriz que organiza los elementos de las dimensiones sonora y temporal en columnas.
Las columnas son las unidades mínimas del cuadro, representan la sincronización entre los elementos temporales y los elementos sonoros asociados.
Cada celda representa un fragmento de información interrelacionada:
Los elementos representados de la dimensión sonora son las N y los iS.
Los elementos representados de la dimensión temporal son los P y los iT.
Si creamos un P en la d. temporal, se creará en la misma columna un elemento indefinido (e) en la línea de N de la d. sonora, ya que aún no habrá sido escogida aún una nota o silencio para ese pulso.
Hay cuatro elementos sonoros y cinco temporales en el cuadro de la app:
Sonoros:
Nota Modular (Nm)
Nota de grado (Nº)
intervalo Sonoro Modular (iSm)
intervalo Sonoro de grado (iSº)
Temporales:
Pulso absoluto (Pa)
Pulso modular (Pm)
Pulso del segmento (Psg)
intervalo Temporal absoluto (iTa)
Fracción (Fr)
El cuadro combina información numérica y conceptual, haciendo visible la relación entre tiempo y sonido dentro de un sistema organizado y estructurado.
## El PMC (Plano Musical de Coordenadas)
El PMC es una representación visual del cuadro Nuzic que organiza los elementos sonoros en una línea vertical y los elementos temporales en una línea horizontal, que interseccionan en el número 0 de cada línea para visualizar la relación entre dimensiones.
Representa la música en segmentos, delimitados entre 2 barras verticales negras, que contienen los elementos.
Puedes modificar la longitud del segmento arrastrando a izquierda o derecha el punto que está debajo del signo positivo al final del segmento.
El eje horizontal representa los Pulsos y iT definidos en cada segmento, mientras que el eje vertical representa la colección de Notas y iS.
## El Segmento
El segmento es una longitud que contiene una idea musical. Es el punto de partida.
El segmento es la unidad mínima sobre la que se dispondrán los elementos (P, N, iT, iS) para construir una idea musical.
El segmento contiene sucesiones de elementos de las dos dimensiones (sonora y temporal) sincronizadas.
Los segmentos se pueden crear, borrar, unir, dividir, copiar, pegar, limpiar y nombrar.
Se pueden crear segmentos antes y después del actual.
# Creación de un segmento
## Elementos entrelazados
En la simbiosis, los elementos de las dimensiones sonora y temporal están entrelazados, creando pares y combinaciones de elementos. En estos pares el orden no es relevante. Los clasificamos por:
Entrelazamiento Horizontal:
P - N: El primer P siempre es 0, la N de salida, en cambio, hay que definirla.
iT - N: Se define la duración de la nota. El iT define dos pulsos.
iS - 2 N: Hay que definir una 1a N para crear el iS que definirá la 2a N.
iS - 2 iT: La duración de las dos notas quedan definidas.
Entrelazamiento vertical, al superponer dos voces:
2 N - iA: Las voces superpuestas crean el iA.
2 iT - 2 iA: La N de la voz grave permite el 1r iA. El 2o iT permite el 2o iA.
Estas combinaciones son una entidad en sí, unidades de elementos entrelazados.
## El Trayecto iniciático (P→iT→N→iS)
Uno de ellos, hay muchos más. Escogemos uno
### Etapa 1 (P→iT)
Longitud: El segmento crea una longitud (Lg) determinada para la idea.
La duración en tiempo del segmento dependerá del PPM.
Para obtener los Segundos: S = (Lg / PPM) * 60
El tiempo objetivo: Pulsaciones: Representan el tiempo cuantificado.
Puedes definir el compás
El tiempo subjetivo: Depende de la percepción individual y del momento.
Pulso:
Creamos un pulso que divide la longitud del segmento en dos partes.
Se crea una relación con el pulso 0. El P(0) es la salida de la primera parte. El nuevo P es la salida de la parte relacionada.
A partir de aquí, podemos crear una sucesión de Pulsos dentro del segmento.
A estos Pulsos se les asigna un elemento indefinido (e).
El sonido de (e) sirve para escuchar el ritmo definido por los P escogidos.
iT:
La sucesión de Pulsos crea a su vez una sucesión de iT (distancia entre P).
Para modificar la sucesión de P:
podemos añadir P entre los ya creados → nuevos iT
o cambiar el valor de los iT → modifica P
Esta modificación produce que se adapten al iT todos los Pulsos posteriores.
### Etapa 2 (N→iS)
Nota:
Sobre los Pulsos definidos aparece un elemento indefinido (e).
Podemos poner un sonido escogido. Ese sonido puede ser:
una nota (N)
un sonido percusivo
un silencio (s)
Su duración será la del iT correspondiente al pulso. (opción: la Nota dura iT(1). El resto de la duración inicial del P se rellena con un silencio).
Si añadimos una nota (N) entre los Pulsos ya definidos, se creará un nuevo Pulso a un iT(1) de distancia de la nota previa.
iS:
La sucesión de Notas crea una sucesión de iS.
Los iS definen la distancia entre dos notas, independientemente de que entre ellas haya un silencio o elemento indefinido.
Si cambiamos el valor de una Nota, cambia el iS correspondiente.
Si cambiamos el valor de un iS, todas las Notas siguientes se adaptarán al nuevo iS, ya que los iS posteriores se mantienen.
## Otros trayectos
Empezar con elementos de Distancia: Ej: iT→P→N→iS.
La sucesión sugerida es: iT → P → N → iS.
Los iT generan los Pulsos que, a su vez, definen el ritmo.
Puedes continuar añadiendo Notas (N) sobre los Pulsos
Finalmente, modificar los iS para modificar la melodía.
Empezar por elementos de Posición. Ej: P→N→iS→iT
El recorrido sería: P → N → iS → iT.
A partir de una sucesión de P, asignas Notas
y ajustas los Intervalos Sonoros (iS)
y Temporales (iT) según necesites.
Empezar por la dimensión Sonora:
La sucesión sugerida es: N → iT → P → iS.
Notas: Cada nota se asignará al Pulso siguiente.
Para crear un ritmo hay que modificar los iT(1) que crean los P por defecto.
La sucesión sugerida es: iS → N → P → iT.
El 1r iS se considera el intervalo 0, que corresponde a la primera Nota.
A partir de la sucesión de N→P, asignas iT.
Empezar por la dimensión Temporal:
Pulsos: El trayecto iniciático ( iT→P→N→iS)
iT:
Los iT crean Pulsos que generan un ritmo (iT→P→N→iS).
Poniendo N a los iT generamos una melodía que podemos modificar al cambiar los iS.
Empezar a partir de un elemento e ir combinando con otros elementos.
Ejs: N→ iS. iT→ P, etc.
## Observaciones
Todos los valores numéricos de los elementos están relacionados (sincronizados). Por ejemplo, si cambias un pulso de posición, cambiará también la nota asociada con el pulso.
Cuando añades un elemento de distancia o posición se genera un elemento complementario (de distancia para posición y viceversa).
Los elementos de posición (P, N) modifican los elementos de distancia relacionados.
Los elementos de distancia (iT, iS) modifican los elementos de posición posteriores.
## Etapa 3: Desarrollos
Podemos desarrollar los segmentos de muchas maneras. Hacemos referencia a algunas de esas maneras aquí, que abordamos en profundidad en los capítulos referidos.
Fraccionamiento: Dividir los Pulsos de un segmento por una fracción.
iA entre dos voces: Crear melodías en la voz superior usando iA en referencia a la voz inferior.
Voz armónica: Crear acordes dentro de la misma voz.
Escalas: Biblioteca con las principales escalas madre y sus rotaciones.
# Creación de sucesiones de Números
Podemos escoger libremente los números a partir de un criterio personal. En este caso no es necesario usar límites para crear.
Podemos usar la calculadora para generar unos números aleatorios a partir de un rango o de una colección.
Rango:
Definimos un rango mediante un número inferior y un número superior.
Definimos la cantidad de números que queremos.
Colección:
Definimos la colección.
Definimos la cantidad de números que queremos.
Podemos crear una sucesión de números que siguen una o varias reglas predefinidas, que actúan como un mecanismo automático que genera unos patrones repetitivos. Ejemplos:
Regla: n’ = {n + 3}. Suc (0 3 6 9)
Reglas: n’ = {n + 3}, n’’ = {n’ - 1}. Suc (0 3 2 5 4 7 6)
Regla: iSm (1 -7 3) aplicada sobre Nm(0 4 2 5) → Nm(0 1 6 9)(4 5 10 1)...
Regla iT(1 2)
Al aplicar sucesiones de números a un elemento, estas tienen que seguir las características concretas de cada elemento:
Los P, iT y N son números naturales (siempre positivos).
Los iS son números enteros (pueden ser positivos o negativos).
## Conversión de elementos
Una sucesión de un tipo de elemento se puede convertir a otro tipo de elemento:
De Posición a Distancia y viceversa:
La sucesión P(0 1 3 4) crea una sucesión iT(1 2 1).
La sucesión Nm(0 4 5 2) crea una sucesión iSm(4 1 -3).
Si las características entre elementos son diferentes, podemos forzar la conversión:
Podemos forzar estos elementos entre sí: Nº, iSº, P, iT.
Al forzar, escogemos si eliminar o cambiar los signos negativos en el elemento convertido.
También se eliminan los elementos que están fuera del rango del elemento convertido.
## La Composición: Sucesiones de Segmentos
### Una sucesión de segmentos puede organizarse de distintas maneras:
Libre: Creas los segmentos y los ordenas como te apetezca.
Repetición: Repetir un segmento anterior de manera idéntica las veces que quieras.
Transformación:
Es una repetición con alteración o cambio de uno o varios elementos.
La nueva unidad tendrá algunos elementos distintos.
La transformación es un ajuste fino y subjetivo.
Operaciones:
Son alteraciones o cambios predefinidos de todos los elementos de un tipo.
En el nuevo segmento habrá cambiado un tipo de elemento concreto.
La operación es un cambio automático y organizado de antemano.
Se pueden combinar varias operaciones en un orden definido.
### Variación: combinaciones de repetición,transformación y operaciones
Cambios en el segmento que crean un segmento con otras características.
Los cambios los define el criterio del compositor.
Hay muchas combinaciones posibles. Aquí enumeramos algunas:
Añadir o quitar elementos de posición: N o P (si quitas uno desaparece también el otro). Puedes decidir si cambia la longitud o no.
Añadir o quitar elementos de distancia: iS cambian las N posteriores (pueden ser positivos o negativos). iT
Repetir un segmento cambiando uno o varios parámetros.
### Grado de Contraste
Representa el nivel de diferencia entre el segmento transformado y el original.
Las transformaciones deben ser limitadas para asegurar que la transformación se reconoce en el original.
Si se intensifican las transformaciones se pierde semblanza con el original.
Ejemplo: A partir de 3 sucesiones diferentes (A B C) puedes crear variaciones y ordenarlas por el criterio escogido: A A’ A’’ B C C’ B’ A A’’
# La Forma
### La Unidad
La unidad es cualquier conjunto de elementos que se percibe como una entidad unificada (al menos para el compositor!).
Las unidades que estructuran la forma deberían ser perceptibles claramente.
La definición de ciertos parámetros o la exclusión de otros ayudan a clarificar la percepción de las estructuras.
Una unidad puede estar formada por unidades más pequeñas.
Y a su vez formar parte de una unidad más grande.
La unidad puede estar contenida en un segmento o varios. Es un concepto abstracto y flexible que nos permite organizar la música en niveles.
### La Forma
Para Nuzic el concepto de forma no es estricto. Es un flujo donde se organizan diferentes unidades.
La forma es la manera en la que las unidades se organizan y estructuran la totalidad de la obra, con el fin de interrelacionar todas sus partes.
Hay infinitas maneras de estructurar una forma, los parámetros que entran en juego exceden por mucho los definidos en el sistema Nuzic.
Se puede comparar con la estructura de un libro.
La forma surge de las características de las unidades más pequeñas, que evolucionan a través de transformaciones y operaciones.
Cada composición origina su propia forma que está enteramente ligada al contenido de sus partes.
### Los Niveles estructurales
A medida que las unidades aumentan en complejidad, van transitando entre niveles ( a un nivel superior que a su vez se percibe como una unidad.)
Es posible para las unidades transitar libremente entre niveles.
Definimos un modelo de estructura de referencia con cuatro niveles de unidades cada vez mayores:
Nivel 1
Las unidades más pequeñas creadas espontáneamente mediante criterios de inspiración.
Este nivel se puede comparar al de las células de un ser vivo o las palabras de una frase.
Nivel 2
Unidades de medida intermedia formadas por sucesiones de las unidades más pequeñas y ordenadas con un criterio de repetición (grado de contraste).
Este nivel se puede comparar al del tejido de un ser vivo o las frases de un texto.
La prioridad de estas unidades  es la coherencia con las más pequeñas basada en procesos de deducción y transformación.
Nivel 3
Unidades grandes que se forman colocando las unidades intermedias en un orden concreto.
Se pueden comparar a los párrafos de un texto o los miembros anatómicos de un ser vivo.
La prioridad en este nivel es la narrativa y la calidad de percepción.
Nivel 4
La totalidad de la composición es la unidad final.
Puede estar formado por distintos niveles de unidad o por uno solo.
La prioridad en este nivel es que se perciba coherencia en la unidad que integra todas las estructuras de los diferentes niveles.
# Sistema sin la App
Una vez conoces el sistema, puedes trabajar sin la app.
La asimilación final del sistema.
Escritura abstracta en papel: Reexplicar todo, rápido y mostrar ejemplos sobre papel
Esto te lleva a interiorizar. A oir sucesiones, crear con las ideas del sistema (interiorizado)
Desaparecen las restricciones de la app. Eres libre de crear sin límites.
### Precisión y unificación conceptual
El sistema Nuzic, basado en la aplicación de números para analizar y componer música, ofrece ventajas significativas incluso sin recurrir a la app, gracias a su marco conceptual robusto y versátil, sintetizando principios fundamentales de la teoría clásica y contemporánea, junto con enfoques avanzados de organización rítmica y estructural.
Mediante los diferentes elementos y numeraciones, Nuzic permite una representación exacta de las relaciones temporales y sonoras, unificando ambos aspectos en un único sistema analítico que traduce conceptos abstractos en elementos musicales concretos y viceversa.
### Control creativo y autonomía
Sin depender de herramientas digitales, el usuario puede utilizar el sistema Nuzic como un marco teórico y práctico para desarrollar composiciones y análisis de manera independiente. Esto permite recuperar el control total del proceso creativo, trabajando a su propio ritmo y adaptando el sistema a necesidades y contextos específicos.
Las reglas y operaciones del sistema están diseñadas de forma clara y estructurada, lo que permite que se puedan aplicar fácilmente sobre papel y lápiz. Esto facilita que cualquiera pueda experimentar con los conceptos del sistema sin necesidad de usar dispositivos digitales.
### Flexibilidad y fertilidad creativa
El sistema habilita la aplicación de operaciones aritméticas—como desplazamientos, permutaciones, reflejos y cálculos de proporciones—sobre los elementos musicales.
Esta capacidad de generar nuevos números abre un espacio para experimentar, donde el creador pone el límite de las reglas. Puede jugar con los elementos, conjuntos y las estructuras musicales  de manera creativa, sin los límites de la app, o sistematizable, ajustando el sistema a restricciones.
Usar el sistema Nuzic sin la app brinda la posibilidad de trabajar con un modelo que es preciso, flexible, interdisciplinario y universal, ofreciendo al compositor y analista musical una plataforma teórica que potencia la creatividad y el rigor en la representación y transformación de la música.







| ELEMENTO | OPERACIÓN | DESCRIPCIÓN |
| --- | --- | --- |
| Nm y Nº | Nm y Nº | Las operaciones son las mismas, cambia la numeración de las notas. |
|  | Suma y Resta | Equivale a la transposición de notas. |
|  | Rotación | Hay que especificar las veces que rota la sucesión. |
|  | Reflejo vertical | Hay que definir el eje de rotación (nota elegida, más aguda, más grave o nota central). 
Equivale a la inversión vertical de las notas de la sucesión. |
|  | Reflejo horizontal | El orden de las notas se invierte en el eje temporal. 
Se puede elegir si reflejar los silencios y elementos indefinidos. |
| iSm y iSº | iSm y iSº | Las operaciones son las mismas, cambia la numeración de los intervalos. |
|  | Suma y Resta | Se hace la operación aritméticamente correcta (se tienen en cuenta los signos). |
|  | Ampliación y reducción | Suma o resta del valor sobre números absolutos (sin tener en cuenta el signo). 
Se mantiene el signo original después de la operación. Musicalmente, se produce una expansión de la sucesión. |
|  | Rotación | Hay que especificar las veces que rota la sucesión. |
|  | Reflejo vertical | Se invierten los signos de los intervalos. |
|  | Reflejo horizontal | El orden de los intervalos se invierte en el eje temporal. 
Se puede elegir si reflejar los silencios y elementos indefinidos. |
| iT | iT | Las operaciones se realizan en numeración absoluta. |
|  | Suma y Resta | Equivalen a estirar o encoger el tiempo. 
Se puede escoger mantener la Lg del segmento o adaptar el segmento al resultado de la operación. 
La numeración resultante se adapta al iT original (se muestra un decimal en caso de iT fraccionados). 
No se permiten las restas que resultan en iT(0). |
|  | Rotación | Hay que especificar cuántas posiciones rotan los iT. 
Se puede escoger rotar los iT o los iT y sus notas asociadas. |
|  | Reflejo horizontal | Se invierte el orden de la sucesión de iT. 
Se puede escoger rotar los iT o los iT y sus notas asociadas. |
| P | P | En la app no se pueden realizar operaciones con Pulsos, porque el P(0) es inamovible. |
|  | Suma y Resta | Con libreta y lápiz, podemos realizar sumas y restas sobre sucesiones de P excluyendo el P(0). |