// libs/app-common/scale-pill.js
//
// Cableja la pastilla "Escala" — pobla un <select> nadiu amb una llista
// d'escales i lliga el `change` a un callback de l'app. La fan servir
// App25 i App25B; preparat per a futures apps que vulguin un dropdown
// d'escales senzill (no la llista completa amb miniatures eE de
// `libs/scale-selector/`).
//
// L'estil visual viu a `libs/shared-ui/scale-pill.css`.
//
// Ús:
//   const pill = createScalePill({
//     selectId: 'escalaSelect',
//     scales: APP25_SCALES, // [{ value, name, id, rotation, ... }]
//     initial: 'DIAT-0',
//     onChange: (scale) => handleScaleChange({
//       scaleId: scale.id, rotation: scale.rotation, value: scale.value
//     }),
//   });
//   pill.set('ARMme-0');     // canvi programàtic
//   pill.get();              // → 'ARMme-0'
//   pill.getScale();         // → { value: 'ARMme-0', name: 'Menor Harmónica', ... }

/**
 * @typedef {Object} ScalePillScale
 * @property {string} value - Valor únic (ex: 'DIAT-0')
 * @property {string} name - Nom visible al desplegable (ex: 'Mayor')
 * @property {string} [id] - ID de l'escala mare (passat al callback)
 * @property {number} [rotation] - Rotació/mode (passat al callback)
 */

/**
 * @typedef {Object} ScalePillOptions
 * @property {string} [selectId='escalaSelect'] - id de l'<select>
 * @property {ScalePillScale[]} scales - Llista d'escales a mostrar
 * @property {string} [initial] - Valor inicial; si no es dóna, usa el primer
 * @property {(scale: ScalePillScale)=>void} [onChange] - Callback en canviar
 */

/**
 * @param {ScalePillOptions} options
 */
export function createScalePill({
  selectId = 'escalaSelect',
  scales = [],
  initial,
  onChange = () => {},
} = {}) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl) {
    return {
      get: () => initial ?? scales[0]?.value ?? '',
      set: () => {},
      getScale: () => null,
      getSelectElement: () => null,
    };
  }

  // Buidem opcions existents (per si l'app ja n'havia posat alguna).
  selectEl.innerHTML = '';

  // Poblem amb les escales rebudes.
  scales.forEach((sc) => {
    const opt = document.createElement('option');
    opt.value = sc.value;
    opt.textContent = sc.name;
    selectEl.appendChild(opt);
  });

  let currentValue = initial ?? scales[0]?.value ?? '';
  if (currentValue) selectEl.value = currentValue;

  function findScale(value) {
    return scales.find((sc) => sc.value === value) || null;
  }

  function set(value, { silent = false } = {}) {
    if (!findScale(value)) return;
    currentValue = value;
    selectEl.value = value;
    if (!silent) onChange(findScale(value));
  }

  selectEl.addEventListener('change', () => {
    const next = selectEl.value;
    currentValue = next;
    const scale = findScale(next);
    if (scale) onChange(scale);
  });

  return {
    get: () => currentValue,
    set,
    getScale: () => findScale(currentValue),
    /** Retorna l'element <select> (per cas que l'app necessiti enfocar/seleccionar). */
    getSelectElement: () => selectEl,
  };
}
