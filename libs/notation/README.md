# Notation helpers

Aquest directori conté les fàbriques de renderitzat utilitzades per les apps de ritme del Lab. A continuació es descriu la nova API `createRhythmStaff`.

## `createRhythmStaff({ container })`

Crea un renderer SVG basat en VexFlow que mostra un pentagrama en clau de sol amb figures rítmiques. El mètode retorna un objecte amb dues funcions:

- `render(state)` – Re-pinta el pentagrama segons l'estat rebut.
- `destroy()` – Elimina l'SVG i allibera la instància del renderer.

### Estat esperat

La crida a `render` admet un objecte amb les següents propietats:

| Propietat | Tipus | Descripció |
|-----------|-------|------------|
| `lg` | `number` | Longitud del cicle (nombre de polsos). Determina l'amplada aproximada del pentagrama i la posició de la barra final. |
| `selectedIndices` | `number[]` | Índexs de pols seleccionats; les notes corresponents es dibuixen a `C4`. |
| `fraction` | `{ numerator: number, denominator: number }` | Informació del tuplet actiu. Quan el quocient és complex (`numerator/denominator` no enter) es mostra la proporció `n:d` damunt del grup. |
| `positions` | `number[]` | Posició dels esdeveniments dins el cicle. Serveix per associar cada figura amb el seu pols original (0 es dibuixa a `D3`). |
| `rhythm` | `object` | Resultat del helper de ritme. Pot ser un array o un objecte amb `events`, `notes` o `figures`. Cada element ha de tenir `duration`, opcionalment `pulseIndex`, `rest` o `type: 'rest'` i, si s'escau, `tuplet`/`noteIndices` per agrupar figures. També es poden passar `tuplets` explícits (`{ noteIndices: number[], numerator, denominator }`). |

Cada figura utilitza les durades `blanca`, `negra`, `corchea`, `fusa` i `semifusa` (equivalents a `h`, `q`, `8`, `32` i `64`). El helper pot retornar-les com a noms (`"blanca"`, `"quarter"`…), denominadors (`"1/8"`), valors numèrics (p. ex. `0.25`) o objectes amb `duration` o `denominator`.

### Integració amb les apps

1. Crear la instància un cop, passant-hi el `container` on cal incrustar el pentagrama.
2. Quan canviï la selecció, la fracció o les figures retornades pel helper de ritme, invocar `render` amb el nou estat complet.
3. Si l'app destrueix la vista (p. ex. canvi de pantalla), cridar `destroy()` per netejar l'SVG.

El renderer fa servir `D3` per al pols `0`, `C4` per als pols seleccionats i `B3` per a la resta, i pinta les pauses proporcionades pel helper conservant les mateixes durades i agrupacions.
