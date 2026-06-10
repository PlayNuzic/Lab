# App13: Intervalos Temporales

## Descripción

**Intervalos Temporales** es una aplicación de metrónomo visual educativo que presenta un único intervalo sonoro de duración variable (2-6 pulsos) en una línea temporal de 9 pulsos. Una característica distintiva es que las barras de duración permanecen visibles después de su aparición, y los silencios (pulsos sin sonido) muestran números con la suma acumulada de pulsos silenciosos.

Esta app es una variación de App9 pero con un enfoque diferente en la visualización y conteo de intervalos.

## Características

### Sistema de Intervalo Único
- **Un solo intervalo** sonoro por reproducción
- **Duración variable**: 2-6 pulsos aleatorios
- **Posición aleatoria**: El intervalo puede aparecer en cualquier posición válida
- **BPM aleatorio**: Entre 75 y 200 BPM

### Visualización
- **Línea temporal horizontal** con 9 pulsos (0-8)
- **Barras azules de intervalo** entre pulsos
- **Barras naranjas de duración** que crecen durante el intervalo sonoro
- **Barras persistentes**: Una vez dibujadas, permanecen visibles
- **Números de pulso** posicionados debajo de la línea
- **Sin números de intervalo** (a diferencia de App9)

### Suma de Silencios
- **Conteo automático** de pulsos silenciosos consecutivos
- **Números de suma** mostrados encima de la línea temporal
- **Posicionamiento dinámico** al final de cada secuencia de silencios

## Diferencias con App9

| Característica | App9 | App13 |
|---------------|------|-------|
| **Intervalos sonoros** | 2 intervalos (1 y 2 pulsos) | 1 intervalo (2-6 pulsos) |
| **Números de intervalo** | Visibles encima | Ocultos |
| **Barras de duración** | Desaparecen al terminar | Persistentes |
| **Indicación de silencios** | Sin indicación | Números con suma |
| **Nombre** | Línea Temporal | Intervalos Temporales |

## Controles

- **Botón Play** (▶): Inicia la reproducción con parámetros aleatorios

## Funcionamiento

1. **Al presionar Play**:
   - Se genera un BPM aleatorio (75-200)
   - Se crea un intervalo con duración aleatoria (2-6 pulsos)
   - Se elige una posición inicial aleatoria válida

2. **Durante la reproducción**:
   - Todos los pulsos suenan con el click base
   - Los pulsos del intervalo suenan además con ruido rosa
   - La barra naranja crece progresivamente durante el intervalo
   - La barra permanece visible después de completarse

3. **Conteo de silencios**:
   - Se acumulan los pulsos sin sonido consecutivos
   - Al encontrar un pulso con sonido o al finalizar, se muestra la suma
   - Los números aparecen encima de la línea temporal

## Audio

- **Pulso base**: Click para todos los pulsos
- **Pulso acentuado**: Ruido rosa adicional durante el intervalo
- **Sincronización**: 60 FPS con highlights visuales

## Objetivo Pedagógico

Esta aplicación ayuda a:
- **Reconocer intervalos** de duración variable
- **Contar silencios** entre eventos sonoros
- **Visualizar persistencia** de eventos temporales
- **Entender agrupaciones** de pulsos silenciosos

## Componentes Compartidos

La aplicación utiliza varios módulos del sistema compartido:
- `visual-sync.js` - Sincronización visual a 60fps
- `simple-highlight-controller.js` - Control de highlights
- `timeline-intervals.js` - Sistema de barras de intervalo
- `audio-init.js` - Inicialización de audio sin warnings
- `preferences.js` - Almacenamiento de preferencias

## Desarrollo

### Archivos principales
- `index.html` - Estructura HTML
- `main.js` - Lógica principal
- `styles.css` - Estilos específicos
- `README.md` - Esta documentación

### LocalStorage
- Clave de preferencias: `app13-preferences`
- Sonidos por defecto: click1 (base), click11 (acento)

## Responsive

La aplicación se adapta a diferentes tamaños de pantalla:
- **Desktop**: Visualización completa
- **Tablet** (≤768px): Elementos reducidos, mantiene funcionalidad
- **Móvil** (≤480px): Tamaños mínimos, optimizado para touch

## Notas Técnicas

- Timeline renderizado con posicionamiento absoluto
- Animaciones CSS con transiciones lineales
- Sin loop de reproducción (single-shot)
- Factory reset disponible vía header compartido