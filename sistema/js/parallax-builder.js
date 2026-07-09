// Parallax Lab — secció del panell tweaks (constructor de tècniques).
//
// Es dibuixa AUTOMÀTICAMENT a partir del registre (parallax-techniques.js):
// un toggle per tècnica + sliders pels seus params, amb preview instantani
// (cada input muta el DOM viu via __parallaxLab.setConfig — P-26: mai
// re-render). Només és visible quan el slide actual és un P-parallax-lab
// (pasos 28.5/28.7); a la resta del Sistema la secció queda amagada.
//
// Botons: 🎲 Aleatorio (combinacions a l'atzar), Restaurar (config per
// defecte del paso) i Copiar config (JSON al porta-retalls, per endurir
// combinacions guanyadores com a defaults al codi).

import { TECNIQUES, paramsPerDefecte } from './parallax-techniques.js';

const PANEL_BODY = document.querySelector('#tweaks .tweaks__body');
const lab = window.__parallaxLab;

if (PANEL_BODY && lab) {
  // ── Esquelet de la secció (creat un sol cop) ──
  const root = document.createElement('div');
  root.className = 'pxlab';
  root.hidden = true;
  root.innerHTML = `
    <div class="pxlab-head"><span>Parallax Lab</span><span class="pxlab-paso"></span></div>
    <div class="pxlab-actions">
      <button type="button" class="tweaks__btn" data-accio="aleatori" title="Combina técnicas y valores al azar">🎲 Aleatorio</button>
      <button type="button" class="tweaks__btn" data-accio="restaurar" title="Vuelve a la configuración por defecto de este paso">Restaurar</button>
      <button type="button" class="tweaks__btn" data-accio="copiar" title="Copia la configuración actual como JSON">Copiar config</button>
    </div>
    <div class="pxlab-techs"></div>
    <p class="pxlab-note" hidden></p>`;
  PANEL_BODY.appendChild(root);

  const techsHost = root.querySelector('.pxlab-techs');
  const pasoLabel = root.querySelector('.pxlab-paso');
  const nota = root.querySelector('.pxlab-note');

  let pasoActual = null;

  // Format del valor d'un slider segons el step (0.1 → 1 decimal) i unitat.
  function formata(p, valor) {
    const decimals = p.step < 1 ? String(p.step).split('.')[1]?.length ?? 1 : 0;
    return `${Number(valor).toFixed(decimals)}${p.unit ?? ''}`;
  }

  // ── Files de tècnica (creades un sol cop; es re-sincronitzen per paso) ──
  TECNIQUES.forEach(tech => {
    const bloc = document.createElement('div');
    bloc.className = 'pxlab-tech';
    bloc.dataset.tech = tech.id;

    const head = document.createElement('label');
    head.className = 'tweaks__row pxlab-tech__head';
    head.title = tech.descripcio;
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    const nom = document.createElement('span');
    nom.textContent = tech.nom;
    head.append(nom, chk);
    bloc.appendChild(head);

    const paramsHost = document.createElement('div');
    paramsHost.className = 'pxlab-params';
    paramsHost.hidden = true;
    (tech.params || []).forEach(p => {
      const fila = document.createElement('label');
      fila.className = 'pxlab-param';
      const etiqueta = document.createElement('span');
      etiqueta.textContent = p.label;
      const sortida = document.createElement('output');
      const rang = document.createElement('input');
      rang.type = 'range';
      rang.min = String(p.min);
      rang.max = String(p.max);
      rang.step = String(p.step);
      rang.dataset.key = p.key;
      // Preview instantani: cada moviment del slider aplica en viu SENSE
      // desar (P-04: persist=false — evita escriure a localStorage desenes
      // de cops/s durant l'arrossegament).
      rang.addEventListener('input', () => {
        const valor = Number(rang.value);
        sortida.textContent = formata(p, valor);
        if (pasoActual != null) lab.setConfig(pasoActual, tech.id, { params: { [p.key]: valor } }, false);
      });
      // En deixar anar el slider, desa un sol cop (P-04).
      rang.addEventListener('change', () => {
        if (pasoActual != null) lab.setConfig(pasoActual, tech.id, { params: { [p.key]: Number(rang.value) } });
      });
      fila.append(etiqueta, sortida, rang);
      paramsHost.appendChild(fila);
    });
    bloc.appendChild(paramsHost);

    chk.addEventListener('change', () => {
      paramsHost.hidden = !chk.checked;
      if (pasoActual != null) lab.setConfig(pasoActual, tech.id, { on: chk.checked });
    });

    techsHost.appendChild(bloc);
  });

  // Reflecteix la config persistida del paso als controls.
  function pintaConfig() {
    if (pasoActual == null) return;
    const cfg = lab.getConfig(pasoActual);
    TECNIQUES.forEach(tech => {
      const bloc = techsHost.querySelector(`[data-tech="${tech.id}"]`);
      if (!bloc) return;
      const chk = bloc.querySelector('input[type="checkbox"]');
      const paramsHost = bloc.querySelector('.pxlab-params');
      const bloquejada = tech.moviment && lab.reduced;
      const entrada = cfg[tech.id];
      const valors = { ...paramsPerDefecte(tech), ...(entrada?.params || {}) };
      chk.checked = !!entrada?.on && !bloquejada;
      chk.disabled = bloquejada;
      bloc.title = bloquejada
        ? `${tech.descripcio} (desactivada: el sistema tiene "reducir movimiento" activo)`
        : tech.descripcio;
      paramsHost.hidden = !chk.checked;
      (tech.params || []).forEach(p => {
        const rang = paramsHost.querySelector(`input[data-key="${p.key}"]`);
        if (!rang) return;
        rang.value = String(valors[p.key]);
        rang.previousElementSibling.textContent = formata(p, valors[p.key]);
      });
    });
    nota.hidden = !lab.reduced;
    if (lab.reduced) {
      nota.textContent = 'Preferencia "reducir movimiento" detectada: las técnicas de movimiento están desactivadas.';
    }
  }

  // ── Accions ──
  root.querySelector('.pxlab-actions').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-accio]');
    if (!btn || pasoActual == null) return;
    if (btn.dataset.accio === 'aleatori') {
      lab.aleatori(pasoActual);
      pintaConfig();
    } else if (btn.dataset.accio === 'restaurar') {
      lab.resetConfig(pasoActual);
      pintaConfig();
    } else if (btn.dataset.accio === 'copiar') {
      const json = JSON.stringify({ paso: pasoActual, parallaxFx: lab.getConfig(pasoActual) }, null, 2);
      const original = btn.textContent;
      try {
        await navigator.clipboard.writeText(json);
        btn.textContent = '¡Copiado!';
      } catch {
        console.log('[parallax-lab] config JSON:\n', json);
        btn.textContent = 'En consola';
      }
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  });

  // ── Visibilitat: només als slides P-parallax-lab ──
  function sync() {
    const slideLab = document.querySelector('.slide--parallax-lab');
    if (!slideLab) {
      root.hidden = true;
      pasoActual = null;
      return;
    }
    pasoActual = Number(slideLab.dataset.paso);
    pasoLabel.textContent = `paso ${slideLab.dataset.paso}`;
    root.hidden = false;
    pintaConfig();
  }

  document.addEventListener('sistema:render', sync);
  sync();  // el render inicial ja ha passat quan aquest mòdul s'executa
}
