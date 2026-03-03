# Guía Elementor Free — Sistema Interactivo Paso a Paso

## Objetivo
Actualizar la página `Sistema Interactivo - Paso a Paso` con la nueva estructura de contenido, manteniendo el flujo pedagógico y la navegación clara en Elementor Free (sin depender de CSS/JS globales ni funciones Pro).

## Alcance acordado
- Estructura final de **27 pasos**.
- CTA estándar en pasos con app: **`Prueba con el ejemplo interactivo`**.
- En el paso 21 se añade un extra opcional con App35 bajo toggle: **`Experimentar en profundidad`**.
- El extra de paso 21 **no interrumpe** el flujo principal hacia el paso 22.

## Criterios usados
1. Compatibilidad total con Elementor Free.
2. Flujo guiado principal siempre visible: el usuario debe saber qué hacer después.
3. Evitar texto largo en bloque único: dividir ideas en módulos cortos.
4. Navegación redundante y robusta:
   - botón `Siguiente paso`,
   - anclas por paso,
   - mini-menú/índice rápido.
5. Priorizar claridad didáctica sobre efectos visuales avanzados.
6. Sin tooltip técnico dependiente de CSS: usar copy visible dentro del toggle en el paso 21.

## Plantillas reutilizables

### Plantilla A — Paso solo texto
Usar cuando el paso no tenga app.

Estructura:
1. `Encabezado` (título del paso).
2. `Editor de texto` dividido en 2-4 bloques por idea.
3. `Botón` (`Siguiente paso`) con ancla al siguiente.
4. `Texto enlace` opcional: `Volver al índice`.

### Plantilla B — Paso texto + app
Usar en pasos con ejemplo interactivo.

Estructura:
1. `Encabezado` (título del paso).
2. `Editor de texto` dividido por ideas.
3. Línea de puente:
   - `Encabezado pequeño` o `Editor de texto`:
   - **`Prueba con el ejemplo interactivo`**
4. `HTML` (embed de la app).
5. `Botón` (`Siguiente paso`) con ancla al siguiente.
6. `Texto enlace` opcional: `Volver al índice`.

### Plantilla C — Paso 21 especial (App27 + extra App35)
Estructura:
1. Contenido principal del paso (texto + App27) como Plantilla B.
2. `Botón` principal: `Continuar al punto 22`.
3. Widget `Toggle` (cerrado por defecto):
   - Título: `Experimentar en profundidad`
   - Primera línea dentro del contenido:
     - `Si quieres experimentar en profundidad, prueba este ejemplo plano de pares N-iT con fracciones complejas`
   - Debajo: `HTML` con embed de App35.

## Zoom por ideas en texto explicativo (paso a paso)
Objetivo: que cada idea se perciba como un bloque independiente y gane protagonismo al interactuar.

### Ruta 1 — Zoom real con hover (si aparece `Hover Animation`)
Aplicar cuando Elementor permita animación hover en el contenedor/widget.

1. En cada paso, divide el texto en 2-4 ideas.
2. Crea una `Sección interior` (o contenedor) por idea.
3. Dentro de cada bloque, usa un `Editor de texto` breve (3-6 líneas máximo).
4. Estiliza cada bloque:
   - `Estilo > Fondo`: color muy suave.
   - `Estilo > Borde`: 1px muy tenue.
   - `Estilo > Radio`: 8-12.
   - `Avanzado > Padding`: 12-16.
5. En cada bloque, prueba:
   - `Avanzado > Hover Animation` -> `Grow` (o `Float` si queda más limpio).
6. Repite en los bloques del paso.
7. Comprueba desktop:
   - al pasar por encima, el bloque crece ligeramente y se distingue del resto.
8. Comprueba móvil:
   - si no hay hover, debe seguir legible sin depender del efecto.

Notas:
- Mantener efecto suave para evitar “saltos”.
- El zoom es apoyo visual, no debe romper el ritmo de lectura.

### Ruta 2 — Sin hover disponible (fallback 100% Free)
Aplicar cuando no aparece `Hover Animation` o está bloqueado.

1. En cada paso, divide el texto en bloques cortos (igual que en Ruta 1).
2. Usa `Toggle` o `Acordeón` con 1 idea por ítem.
3. Título del ítem = idea clave; contenido = explicación breve.
4. Deja abierto solo el primer ítem por defecto (si el widget lo permite).
5. Añade separación entre ítems para respirar visualmente.
6. Mantén al final del paso:
   - `Prueba con el ejemplo interactivo`
   - app embebida (si aplica)
   - `Siguiente paso`

Resultado:
- No hay zoom literal, pero sí foco progresivo y reducción de ruido visual.
- Funciona muy bien en móvil.

### Regla práctica de uso
1. Primero intenta Ruta 1.
2. Si no hay opción de hover, usa Ruta 2 sin bloquear el avance.
3. No mezclar demasiados efectos en una misma página.

## Mini-menú (índice rápido)
Crear al inicio de la página una sección con ancla `indice`.

Contenido recomendado (Editor de texto o Lista de iconos):
- `Introducción` -> `#paso-01`
- `Descubriendo la música` -> `#paso-07`
- `Intervalos` -> `#paso-08`
- `Ampliando el mapa` -> `#paso-11`
- `Fraccionando` -> `#paso-17`
- `Escalas` -> `#paso-22`

Enlace de retorno al índice al final de cada paso:
- `Volver al índice` -> `#indice`

## Paso a paso de implementación en Elementor

1. Entra al editor Elementor de la página y abre `Navegador`.
2. Asegura que todas las secciones están renombradas como `Paso 01`, `Paso 02`, etc.
3. Crea (o confirma) una sección inicial `Índice rápido` y añade ancla `indice`.
4. En cada paso, añade un widget `Ancla de menú` con id `paso-XX`.
5. Aplica la plantilla adecuada:
   - A: paso solo texto
   - B: paso texto + app
   - C: paso 21 especial
6. Divide cada texto explicativo en ideas cortas (2-4 bloques).
7. En pasos con app, añade siempre la línea:
   - `Prueba con el ejemplo interactivo`
8. Configura cada botón `Siguiente paso` a su ancla `#paso-XX`.
9. En el paso 21:
   - App27 en flujo principal,
   - botón a paso 22,
   - toggle opcional con App35.
10. Revisa la navegación completa desde paso 1 a 27.
11. Revisa versión móvil (botones, orden visual, carga de apps).
12. Publica.

## Mapa final de pasos (27)

| Paso | Título corto | Tipo | App | Ancla |
|---|---|---|---|---|
| 01 | Introducción | Texto | - | `paso-01` |
| 02 | Contar y Medir | Texto | - | `paso-02` |
| 03 | Contar y Medir la Música | Texto + App | App11A | `paso-03` |
| 04 | Línea Temporal | Texto + App | App9 | `paso-04` |
| 05 | Línea Sonora | Texto + App | App10 | `paso-05` |
| 06 | El Plano Musical | Texto + App | App11 | `paso-06` |
| 07 | Descubriendo la Música | Texto + App | App12 | `paso-07` |
| 08 | Midiendo movimiento + iT | Texto + App | App13 | `paso-08` |
| 09 | Intervalo Sonoro | Texto + App | App14 | `paso-09` |
| 10 | Intervalos en el Plano | Texto + App | App15 | `paso-10` |
| 11 | Ampliando el Mapa | Texto | - | `paso-11` |
| 12 | Compás | Texto + App | App16 | `paso-12` |
| 13 | Línea temporal en círculo | Texto + App | App17 | `paso-13` |
| 14 | Registro de octava | Texto + App | App18 | `paso-14` |
| 15 | Plano Modular | Texto + App | App19 | `paso-15` |
| 16 | Plano y Sucesión N-iT | Texto + App | App20 | `paso-16` |
| 17 | Fraccionando la línea temporal | Texto + App | App26 | `paso-17` |
| 18 | Sucesión de Pfr | Texto + App | App28 | `paso-18` |
| 19 | Sucesión de iTFr simples | Texto + App | App30 | `paso-19` |
| 20 | Plano de fracciones simples | Texto + App | App34 | `paso-20` |
| 21 | Fracciones complejas | Texto + App + Extra | App27 (+App35 extra) | `paso-21` |
| 22 | Escalas | Texto + App | App21 | `paso-22` |
| 23 | Estructura escalar | Texto + App | App22 | `paso-23` |
| 24 | Transposición | Texto + App | App23 | `paso-24` |
| 25 | Probando escalas | Texto + App | App24 | `paso-25` |
| 26 | Melodías con escalas | Texto + App | App25 | `paso-26` |
| 27 | Intervalos con escalas | Texto + App | App25B | `paso-27` |

## Checklist de validación
1. No queda ningún `#next` en el contenido final.
2. Los 27 pasos existen y están en orden.
3. Todos los botones `Siguiente paso` llevan al ancla correcta.
4. El mini-menú apunta a anclas válidas.
5. En todos los pasos con app aparece `Prueba con el ejemplo interactivo`.
6. Paso 21:
   - App27 en flujo principal,
   - botón a paso 22 antes del extra,
   - toggle extra con texto justificativo + App35.
7. Revisión móvil completada.
8. Bloques de idea implementados en todos los pasos de texto explicativo.
9. Estrategia de foco aplicada:
   - Ruta 1 (hover zoom) o
   - Ruta 2 (toggle/acordeón por idea).

## Nota operativa
Si más adelante habilitáis CSS global, se puede afinar el zoom por bloques de idea. En estado Free sin CSS global/inline, mantener el enfoque modular (bloques cortos y/o toggle) garantiza consistencia y mantenimiento fácil.
