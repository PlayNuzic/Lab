# Pulsos Fraccionados — Build Notes

## Iteración 1
- Creada la tarjeta de App4 en la landing principal y enlazada a la nueva app.
- Se reutiliza el template compartido con cabecera común y menú lateral.

## Iteración 2
- Instanciado el motor híbrido `TimelineAudio` al pulsar Play con política de autoplay estándar.
- Configurado el mixer global con canales `pulse`, `selected` y `master`, accesibles mediante long-press en Play.
- Menús de sonido conectados a los 10 samples del sample-map y sincronizados con el motor.

## Iteración 3
- Maquetación de los controles principales: Lg, fracción `n/d` y tempo `V` con spinners reutilizables.
- Persistencia y restauración automática de los parámetros desde `localStorage` (`app4::*`).

## Iteración 4
- Editor de pulsos fraccionados similar al de App2 con soporte para fracciones (`k.f` y `.f`).
- Validación contextual cuando el numerador supera el denominador y orden estable con deduplicación.
- Los valores confirmados quedan sincronizados con almacenamiento local y preparados para etapas posteriores.

## Próximos pasos
- Iteración 5: timeline y selección visual de pulsos enteros/fraccionados.
