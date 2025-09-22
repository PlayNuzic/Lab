# Pulsos Fraccionados — Build Notes

## Iteración 1
- Estructura base creada reutilizando el template compartido.
- Tarjeta añadida en la landing principal para abrir App4.
- Bootstrap inicial con placeholder visual y preparación para inicializar audio tras Play.

## Iteración 2
- Integrado el motor híbrido de audio con instancia propia y menú de sonidos basado en los 10 samples.
- Configurado el mixer global con canales Pulso/Pulso 0, Seleccionados y Master accesibles vía long-press.
- Sincronizado el canal "Seleccionados" del mixer con el bus interno de acentos del motor.

## Próximos pasos
- Iteración 3: maquetar los inputs Lg, fracción n/d y V con sus spinners reutilizando la lógica compartida.
