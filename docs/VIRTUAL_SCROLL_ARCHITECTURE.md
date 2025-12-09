# Virtual Scroll Architecture for Musical Grids

## Contexto

Este documento describe la arquitectura para escalar grids musicales con grandes cantidades de datos (ej: 500 compases × 8 registros = 192K celdas).

## Problema de Escalabilidad

### Límites del DOM
| Celdas | Memoria DOM | Render inicial | Performance |
|--------|-------------|----------------|-------------|
| ~500 | ~50KB | <100ms | ✅ Excelente |
| ~5,000 | ~500KB | ~500ms | ✅ Buena |
| ~50,000 | ~5MB | ~2-3s | ⚠️ Aceptable |
| ~200,000 | ~20MB | ~10s+ | ❌ Inaceptable |

### Escenario App19 Actual
- 3 registros × 12 notas × 16 pulsos = **576 celdas** ✅
- Con scroll suave: 36 filas × 16 columnas = **576 celdas** ✅

### Escenario Escalado Futuro
- 8 registros × 12 notas × 2000 pulsos = **192,000 celdas** ❌

---

## Solución: Virtual Scrolling

### Principio
Solo renderizar las celdas **visibles en viewport** + un buffer pequeño. Reciclar elementos DOM al hacer scroll.

### Arquitectura

```
┌─────────────────────────────────────────────┐
│                VIEWPORT                      │
│  ┌─────────────────────────────────────┐    │
│  │   Celdas visibles (~200-500)        │    │
│  │   Buffer superior (~50 celdas)      │    │
│  │   Buffer inferior (~50 celdas)      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Scroll indicator ───────────────────────   │
│                                             │
│  [═══════■═══════════════════════════════]  │
│          ↑                                  │
│    Posición actual en datos virtuales       │
└─────────────────────────────────────────────┘

Total celdas en DOM: ~300-600
Total celdas virtuales: 192,000
```

### Componentes

#### 1. VirtualScrollContainer
```javascript
class VirtualScrollContainer {
  constructor({
    totalRows,
    totalCols,
    rowHeight,
    colWidth,
    visibleRows,
    visibleCols,
    renderCell,
    onScroll
  }) {
    this.pool = new CellPool(visibleRows * visibleCols * 1.5);
    this.viewport = { startRow: 0, startCol: 0 };
  }

  // Calcula qué celdas son visibles
  getVisibleRange(scrollTop, scrollLeft) {
    return {
      startRow: Math.floor(scrollTop / this.rowHeight),
      endRow: Math.ceil((scrollTop + this.viewportHeight) / this.rowHeight),
      startCol: Math.floor(scrollLeft / this.colWidth),
      endCol: Math.ceil((scrollLeft + this.viewportWidth) / this.colWidth)
    };
  }

  // Actualiza DOM solo con celdas visibles
  updateVisibleCells() {
    const range = this.getVisibleRange();

    // Reciclar celdas fuera de rango
    this.pool.recycle(cell => !this.isInRange(cell, range));

    // Crear/reusar celdas en rango
    for (let row = range.startRow; row < range.endRow; row++) {
      for (let col = range.startCol; col < range.endCol; col++) {
        const cell = this.pool.acquire();
        this.renderCell(cell, row, col);
        this.positionCell(cell, row, col);
      }
    }
  }
}
```

#### 2. CellPool (Object Pooling)
```javascript
class CellPool {
  constructor(maxSize) {
    this.available = [];
    this.inUse = new Set();
    this.maxSize = maxSize;
  }

  acquire() {
    if (this.available.length > 0) {
      const cell = this.available.pop();
      this.inUse.add(cell);
      return cell;
    }

    if (this.inUse.size < this.maxSize) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      this.inUse.add(cell);
      return cell;
    }

    throw new Error('Pool exhausted');
  }

  release(cell) {
    cell.className = 'grid-cell';
    cell.textContent = '';
    this.inUse.delete(cell);
    this.available.push(cell);
  }
}
```

#### 3. ScrollSyncManager
```javascript
class ScrollSyncManager {
  constructor(containers) {
    this.containers = containers;
    this.isScrolling = false;
  }

  sync(source, axis) {
    if (this.isScrolling) return;
    this.isScrolling = true;

    const value = axis === 'x' ? source.scrollLeft : source.scrollTop;

    this.containers.forEach(container => {
      if (container !== source) {
        container[axis === 'x' ? 'scrollLeft' : 'scrollTop'] = value;
      }
    });

    requestAnimationFrame(() => {
      this.isScrolling = false;
    });
  }
}
```

---

## Implementación Incremental

### Fase 1: App19 Actual (Completada)
- Grid pequeño con scroll suave
- No requiere virtualización
- ~600 celdas máximo

### Fase 2: Grid Mediano (Futuro)
- Hasta 50,000 celdas
- Virtual scroll horizontal (pulsos)
- DOM vertical completo (notas)

### Fase 3: Grid Grande (Futuro)
- 200,000+ celdas
- Virtual scroll bidireccional
- Object pooling completo
- Canvas para minimap/overview

---

## Bibliotecas de Referencia

Si se necesita implementación rápida:

| Biblioteca | Tamaño | Características |
|------------|--------|-----------------|
| `react-window` | 6KB | Solo React, muy rápido |
| `tanstack-virtual` | 12KB | Framework-agnostic |
| `clusterize.js` | 4KB | Vanilla JS, simple |

Para PlayNuzic Lab, recomiendo implementación custom para:
1. Control total sobre animaciones musicales
2. Integración con sistema de audio
3. Sin dependencias externas

---

## Métricas de Performance

### Objetivos
- **FPS durante scroll**: ≥55 fps
- **Tiempo de render inicial**: <500ms
- **Memoria máxima**: <50MB
- **Latencia de interacción**: <16ms

### Cómo medir
```javascript
// En desarrollo
const scrollPerfObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16) {
      console.warn('Frame drop:', entry.duration.toFixed(2), 'ms');
    }
  }
});
scrollPerfObserver.observe({ entryTypes: ['longtask'] });
```

---

## Conclusión

Para App19 con límites actuales (3 registros, pocos compases), **no se necesita virtual scrolling**. La implementación de scroll suave con DOM completo es suficiente.

Este documento sirve como referencia cuando se necesite escalar a grids más grandes en futuras aplicaciones.
