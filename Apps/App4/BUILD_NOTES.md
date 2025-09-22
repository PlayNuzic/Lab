# Pulsos Fraccionados — Build Notes

## Iteración 1
- Estructura base creada reutilizando el template compartido.
- Tarjeta añadida en la landing principal para abrir App4.
- Bootstrap inicial con placeholder visual y preparación para inicializar audio tras Play.

## Iteración 2
- Integrado el motor híbrido de audio con instancia propia y menú de sonidos basado en los 10 samples.
- Configurado el mixer global con canales Pulso/Pulso 0, Seleccionados y Master accesibles vía long-press.
- Sincronizado el canal "Seleccionados" del mixer con el bus interno de acentos del motor.

## Iteración 3
- Añadidos los controles principales para Lg, fracción n/d y V con maquetación propia y spinners reutilizables.
- Normalización básica de los campos numéricos asegurando valores positivos y repetición en pulsadores.

## Próximos pasos
- Iteración 4: conectar los parámetros maquetados con el estado interno y el motor de audio.
