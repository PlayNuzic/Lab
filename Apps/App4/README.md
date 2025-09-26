# App4 · Pulsos Fraccionados

App4 explora la generación de secuencias de pulsos fraccionarios sobre la timeline compartida del Lab. Permite fijar un número de pulsos (`Lg`), una velocidad (`V`) y una fracción personalizada (`n/d`) que se proyecta tanto en el grid lineal como en la vista circular. Toda la interacción está pensada para ratón y pantallas táctiles mediante _drag_, _long press_ y accesos rápidos desde teclado.

## Flujo general de la UI

1. El `template` común (`renderApp`) genera la cabecera compartida, los selectores de sonido y el área de edición (`pulseSeq`).
2. Al arrancar se aplican los `led` y unidades (`unitLg`, `unitV`, `unitT`) para guiar la edición de parámetros.
3. El editor de fracciones (`inlineFractionSlot`) expone campos `n` y `d` con placeholders fantasma que ayudan a visualizar la fracción incluso cuando los inputs están vacíos.
4. El menú aleatorio (`randomMenu`) puede habilitar rangos independientes para Lg, V, número de pulsos aleatorios y fracciones completas con la opción "Permitir fracciones complejas".
5. Cada cambio re-calcula el layout (`layoutTimeline`) y sincroniza la vista circular/lineal, incluidos los números de pulso (`updatePulseNumbers`).

## Audio y sincronización

- `createSchedulingBridge` escucha `sharedui:scheduling` desde la cabecera y aplica _lookAhead_ / _updateInterval_ tan pronto como `TimelineAudio` está disponible.
- `bindSharedSoundEvents` enruta eventos `sharedui:sound` para actualizar `setBase`, `setAccent` y `setStart` en el motor de audio.
- `initAudio()` instancia `TimelineAudio`, espera a `ready()`, registra el canal `accent` en el mixer y sincroniza _loop_, _pulse_ y _cycle_ según el estado actual de la UI.
- El menú de rendimiento (`performance-audio-menu.js`) queda inyectado en `index.html` para comprobar la latencia real del motor.
- `initSoundDropdown` reutiliza el dropdown compartido que llama a `ensureAudio()` y pre-escucha el sample al cambiarlo.

## Estructura de datos

- `pulseMemory` conserva las selecciones activas por índice y se restablece al aplicar aleatoriedad en Pulsos.
- Las fracciones se almacenan con `persistFractionField` en `localStorage` (`app4:n`, `app4:d`).
- La configuración del menú aleatorio se serializa en `app4:random` y utiliza `toRange`/`toIntRange` para normalizar los límites.
- El estado del tema, color de selección y toggles de audio se guarda con `storeKey()` bajo el prefijo `app4:`.

## Importes relevantes

| Módulo | Propósito |
| --- | --- |
| `../../libs/app-common/audio.js` | `createSchedulingBridge` y `bindSharedSoundEvents` (scheduling global + eventos de sonido). |
| `../../libs/app-common/random-menu.js` | Animación y persistencia del menú aleatorio. |
| `../../libs/app-common/mixer-menu.js` y `../../libs/app-common/mixer-longpress.js` | Entrada al mixer global desde la UI y gesto de _long press_. |
| `../../libs/app-common/subdivision.js` | Conversión entre Lg/V/T y grid para pintar la timeline. |
| `../../libs/sound/index.js` | Motor `TimelineAudio`, mixer global y utilidades `ensureAudio`, `setBase`, `setAccent`, `setStart`. |
| `../../libs/shared-ui/performance-audio-menu.js` | Menú flotante que expone _lookAhead_ y _updateInterval_ efectivos. |

## Atajos y gestos

- **Click / tap**: alterna la selección del pulso bajo el cursor.
- **Arrastre** sobre `pulseSeq`: activa/desactiva múltiples pulsos en bloque.
- **Shift + Click**: invierte el estado del rango entre la última selección y el pulso actual.
- **Long press** sobre el botón de mute: abre el mixer global (canales `pulse`, `subdivision`, `accent`).

## Tests

App4 comparte la suite de Jest común. Después de instalar dependencias con `./setup.sh`, ejecuta:

```bash
npm test
```

Esto cubre tanto los módulos compartidos (`libs/app-common`, `libs/sound`) como los _helpers_ utilizados por la app.
