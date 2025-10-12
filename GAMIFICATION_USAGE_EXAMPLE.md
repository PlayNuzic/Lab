# Guía de Uso del Sistema de Gamificación

## Cómo Empezar

El sistema de gamificación ya está integrado y funcionando en las Apps 2-5. No requiere configuración adicional por parte del usuario.

## Verificar que está Funcionando

### 1. Abrir la Consola del Navegador
- Chrome/Edge: `F12` o `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Firefox: `F12` o `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

### 2. Activar Modo Debug
En la consola, ejecuta:
```javascript
// Activar modo debug
window.GAMIFICATION_DEBUG = true;
```

O añade a la URL: `?gamification_debug=true`

### 3. Ver Mensajes de Inicialización
Al cargar cualquier App (2-5), deberías ver:
```
Inicializando gamificación para App2...
Gamificación de App2 inicializada correctamente
```

## Comandos Útiles en la Consola

### Ver Estadísticas Actuales
```javascript
// Ver todas las estadísticas
window.__GAMIFICATION.getStats();

// Resultado ejemplo:
{
  session: {
    total_events: 45,
    total_points: 320,
    duration_seconds: 180
  },
  scoring: {
    session_score: 320,
    total_score: 1250,
    current_streak: 5,
    complexity_level: "MEDIUM"
  },
  achievements: {
    total_achievements: 20,
    unlocked_achievements: 3,
    completion_percentage: 15
  }
}
```

### Ver Nivel del Usuario
```javascript
window.__GAMIFICATION.getUserLevel();

// Resultado:
{
  level: 3,
  title: "Estudiante",
  current_score: 1250,
  next_level_score: 1500,
  progress_percentage: 50
}
```

### Ver Logros
```javascript
// Ver todos los logros
window.__GAMIFICATION.getAchievements();

// Ver solo logros desbloqueados
window.__GAMIFICATION.getAchievements()
  .filter(a => a.unlocked);

// Ver progreso de un logro específico
window.__GAMIFICATION.getAchievementProgress('rhythm_novice');
```

### Ver Datos Específicos por App

#### App2 - Sucesión de Pulsos
```javascript
// Estadísticas específicas
window.__APP2_GAMIFICATION.getStats();

// Ver parámetros actuales
window.__APP2_GAMIFICATION.lastLgValue;  // Último valor de Lg
window.__APP2_GAMIFICATION.lastVValue;   // Último valor de V
```

#### App3 - Fracciones Temporales
```javascript
// Ver fracciones creadas
window.__APP3_GAMIFICATION.fractionsCreated;

// Última fracción usada
window.__APP3_GAMIFICATION.lastFraction;
```

#### App4 - Pulsos Fraccionados
```javascript
// Ver patrones creados
window.__APP4_GAMIFICATION.patternsCreated;

// Estado de características avanzadas
window.__APP4_GAMIFICATION.cycleActivated;
window.__APP4_GAMIFICATION.subdivisionActivated;
```

#### App5 - Pulsaciones
```javascript
// Ver intervalos creados
window.__APP5_GAMIFICATION.intervalsCreated;

// Complejidad actual
window.__APP5_GAMIFICATION.patternComplexity;
```

## Flujo de Uso Típico

### 1. Práctica Básica (App2)
1. Abre App2
2. Configura Lg=8, V=120
3. Selecciona algunos pulsos
4. Haz clic en Play
5. Deja que complete el patrón
6. Para la reproducción

**Eventos generados:**
- `PRACTICE_STARTED` - 5 puntos
- `PULSE_PATTERN_CREATED` - 8 puntos
- `PRACTICE_COMPLETED` - 20 puntos
- **Total:** 33 puntos

### 2. Crear Fracciones (App3)
1. Abre App3
2. Configura una fracción (ej: 3/4)
3. Reproduce el patrón
4. Experimenta con diferentes fracciones

**Eventos generados:**
- `FRACTION_CREATED` - 5 puntos por fracción única
- `PATTERN_PLAYED` - 3 puntos
- Bonus por complejidad si la fracción es compleja

### 3. Usar Tap Tempo con Precisión
1. En cualquier app, haz clic en Tap Tempo
2. Toca un ritmo constante (mínimo 3 clicks)
3. Si tu precisión es > 85%, obtienes bonus

**Eventos:**
- `TAP_TEMPO_USED` - 2 puntos
- `TAP_TEMPO_ACCURATE` - 10 puntos (si precisión > 85%)

## Logros para Desbloquear

### Fáciles (Primeros pasos)
- **Primeros Pasos**: Completa tu primera práctica
- **Explorador**: Cambia 10 parámetros diferentes
- **Dedicado**: Practica 5 minutos continuos

### Intermedios
- **Novato Rítmico**: Reproduce 10 patrones
- **Creador de Patrones**: Crea 20 patrones diferentes
- **Maestro del Tap**: 10 tap tempos precisos

### Avanzados
- **Maestro del Ritmo**: 200 patrones reproducidos
- **Timing Perfecto**: 100% precisión en 5 patrones seguidos
- **Maratonista**: 30 minutos de práctica continua

### Expertos
- **Práctica Diaria**: 7 días consecutivos
- **Gran Maestro**: Alcanza 10,000 puntos totales

## Troubleshooting

### El sistema no está registrando eventos
1. Verifica que el sistema esté habilitado:
```javascript
window.__GAMIFICATION.getConfig().enabled; // Debe ser true
```

2. Verifica la configuración de la app:
```javascript
window.__GAMIFICATION.getConfig().apps.app2.enabled; // Debe ser true
```

### Resetear el Sistema (Testing)
```javascript
// Resetear todo (¡CUIDADO! Borra todos los datos)
window.__GAMIFICATION.resetAll();

// Resetear solo la sesión actual
window.__GAMIFICATION.resetSession();
```

### Exportar/Importar Datos
```javascript
// Exportar todos tus datos
const backup = window.__GAMIFICATION.exportUserData();
console.log(JSON.stringify(backup));

// Importar datos
window.__GAMIFICATION.importUserData(backup);
```

## Configuración Avanzada

### Cambiar Multiplicador de Puntos
```javascript
// Duplicar todos los puntos (para testing)
window.__GAMIFICATION_CONFIG.updateConfig({
  scoring: { pointsMultiplier: 2.0 }
});
```

### Desactivar Temporalmente
```javascript
// Desactivar gamificación
window.__GAMIFICATION_CONFIG.updateConfig({
  enabled: false
});

// Reactivar
window.__GAMIFICATION_CONFIG.updateConfig({
  enabled: true
});
```

## Métricas de Rendimiento

El sistema está diseñado para ser ligero:
- **Overhead por evento:** < 5ms
- **Memoria utilizada:** < 1MB
- **Almacenamiento local:** < 5MB máximo

## Próximas Características (Fase 2)

En el futuro se añadirán:
- Dashboard visual con gráficas de progreso
- Notificaciones visuales de logros
- Tabla de clasificación global
- Compartir logros en redes sociales
- Desafíos diarios y semanales
- Recompensas y contenido desbloqueable

---

## Ejemplo Completo de Sesión

```javascript
// 1. Iniciar con debug
window.GAMIFICATION_DEBUG = true;

// 2. Practicar en App2
// - Configurar Lg=16, V=120
// - Seleccionar pulsos alternos
// - Reproducir durante 1 minuto

// 3. Ver estadísticas
const stats = window.__GAMIFICATION.getStats();
console.log(`Puntos ganados: ${stats.scoring.session_score}`);
console.log(`Racha actual: ${stats.scoring.current_streak}`);

// 4. Verificar logros desbloqueados
const newAchievements = window.__GAMIFICATION.getAchievements()
  .filter(a => a.unlocked && !a.notified);

newAchievements.forEach(achievement => {
  console.log(`🏆 ¡Logro desbloqueado! ${achievement.name}`);
  console.log(`   ${achievement.description}`);
});

// 5. Ver nivel actual
const level = window.__GAMIFICATION.getUserLevel();
console.log(`Nivel ${level.level}: ${level.title}`);
console.log(`Progreso al siguiente nivel: ${level.progress_percentage}%`);
```

## Contacto y Soporte

Si encuentras algún problema o tienes sugerencias:
1. Abre la consola del navegador
2. Ejecuta el comando problemático
3. Copia cualquier error que aparezca
4. Reporta el issue con los detalles

¡Disfruta del sistema de gamificación y mejora tus habilidades rítmicas! 🎵🏆