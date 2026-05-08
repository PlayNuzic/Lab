// libs/app-common/output-note-pill.js
//
// Cableja la pastilla "Transposición" / "Registro" amb la seva lògica:
// input numèric 0-11 amb behaviour cíclic + spinners + arrows. La fan
// servir App18 ("Registro"), App23, App24, App25, App25B
// ("Transposición").
//
// L'estil visual viu a `libs/shared-ui/output-note-pill.css`.
//
// Ús:
//   const pill = createOutputNotePill({
//     inputId: 'inputOutputNote',
//     upId: 'outputNoteUp',
//     downId: 'outputNoteDown',
//     initial: 0,
//     onChange: (value) => updateForTransposeChange(),
//     range: { min: 0, max: 11, cyclic: true }, // cyclic per defecte
//   });
//   pill.set(5);   // sense disparar onChange
//   pill.get();    // → 5

/**
 * @typedef {Object} OutputNotePillOptions
 * @property {string} [inputId='inputOutputNote'] - id de l'<input>
 * @property {string} [upId='outputNoteUp'] - id del botó .spin.up
 * @property {string} [downId='outputNoteDown'] - id del botó .spin.down
 * @property {number} [initial=0] - valor inicial
 * @property {{min:number,max:number,cyclic:boolean}} [range] - rang del valor
 * @property {(value:number)=>void} [onChange] - callback en canviar
 */

/**
 * @param {OutputNotePillOptions} options
 */
export function createOutputNotePill({
  inputId = 'inputOutputNote',
  upId = 'outputNoteUp',
  downId = 'outputNoteDown',
  initial = 0,
  range = { min: 0, max: 11, cyclic: true },
  onChange = () => {},
} = {}) {
  const inputEl = document.getElementById(inputId);
  const upEl = document.getElementById(upId);
  const downEl = document.getElementById(downId);

  let value = clamp(initial);

  function clamp(v) {
    const span = range.max - range.min + 1;
    if (range.cyclic) {
      return ((((v - range.min) % span) + span) % span) + range.min;
    }
    return Math.min(range.max, Math.max(range.min, v));
  }

  function set(next, { silent = false } = {}) {
    const clamped = clamp(next);
    if (clamped === value) {
      // Sincronitzem la UI igualment per si l'input té valor brut diferent
      if (inputEl && inputEl.value !== String(clamped)) inputEl.value = clamped;
      return;
    }
    value = clamped;
    if (inputEl) inputEl.value = value;
    if (!silent) onChange(value);
  }

  if (inputEl) {
    inputEl.value = value;
    inputEl.addEventListener('input', () => {
      const raw = inputEl.value.trim();
      if (raw === '') return;
      const num = parseInt(raw, 10);
      if (!Number.isNaN(num)) set(num);
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        set(value + 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        set(value - 1);
      }
    });
  }
  if (upEl) upEl.addEventListener('click', () => set(value + 1));
  if (downEl) downEl.addEventListener('click', () => set(value - 1));

  return {
    get: () => value,
    set,
    /** Retorna l'element input (per cas que l'app necessiti enfocar/seleccionar). */
    getInputElement: () => inputEl,
  };
}
