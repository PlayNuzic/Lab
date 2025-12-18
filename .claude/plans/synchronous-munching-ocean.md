# Plan: Correcciones Pendientes

## Tareas Pendientes

### 1. Desactivar FX por defecto
- `libs/sound/index.js:481` → cambiar `true` a `false`
- `libs/sound/index.js:709-713` → añadir condicional para conectar directo a destination si FX desactivados
- `libs/app-common/mixer-menu.js:287` → quitar clase `active` del botón FX

### 2. Volumen faders al 75%
- `libs/app-common/mixer-menu.js:239` → cambiar `'1'` a `'0.75'`

### 3. Canal melodic para piano/violin
- `libs/sound/index.js` → añadir `getMelodicChannel()` y `setMelodicVolume()`
- `libs/sound/piano.js:44-48` → conectar a canal melodic en lugar de toDestination
- `libs/sound/violin.js:58-62` → ídem

### 4. Z-index sliders mixer
- `libs/app-common/styles.css` → añadir z-index a `.mixer-channel__slider-wrapper` y `.mixer-channel__slider`
