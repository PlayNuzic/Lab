/**
 * @jest-environment jsdom
 */
// Parallax Lab — test de contracte del registre de tècniques.
//
// Dues capes: (1) validació estructural de TOTES les tècniques del registre
// (el panell es dibuixa sol a partir d'elles: un camp malformat = UI trencada),
// i (2) el comportament de la tècnica de referència scroll-depth, que fixa el
// patró que les altres han de seguir (idempotència, cleanup total, només
// canals propis --px-*, mai transform/filter inline).

import {
  TECNIQUES,
  validaTecnica,
  validaRegistre,
  paramsPerDefecte,
} from '../parallax-techniques.js';

const maskZoom = TECNIQUES.find(t => t.id === 'mask-zoom');
const appReveal = TECNIQUES.find(t => t.id === 'app-reveal');
const depthBlur = TECNIQUES.find(t => t.id === 'depth-blur');
const colorShift = TECNIQUES.find(t => t.id === 'color-shift');

describe('Parallax Lab — contracte del registre', () => {
  test('el registre no és buit i valida sencer', () => {
    expect(TECNIQUES.length).toBeGreaterThan(0);
    expect(validaRegistre(TECNIQUES)).toEqual([]);
  });

  test('ids únics', () => {
    const ids = TECNIQUES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('cada def queda dins [min, max] i els steps són positius', () => {
    TECNIQUES.forEach(t => {
      t.params.forEach(p => {
        expect(p.def).toBeGreaterThanOrEqual(p.min);
        expect(p.def).toBeLessThanOrEqual(p.max);
        expect(p.step).toBeGreaterThan(0);
      });
    });
  });

  test('validaTecnica detecta una tècnica malformada', () => {
    const errors = validaTecnica({ id: 'Mal_Id', params: [{ key: 'x', label: 'x', min: 5, max: 1, step: 0, def: 9 }] });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('scroll-depth — tècnica de referència', () => {
  const sd = TECNIQUES.find(t => t.id === 'scroll-depth');

  // Slide lab mínim: fons amb una imatge + dues capes, i frases (que la
  // tècnica NO pot tocar).
  function harness() {
    document.body.innerHTML = '';
    const slideEl = document.createElement('article');
    slideEl.className = 'slide slide--parallax slide--parallax-lab';
    slideEl.innerHTML = `
      <div class="parallax-bg" aria-hidden="true">
        <div class="parallax-img" data-depth="0.12"></div>
        <span class="parallax-layer" data-depth="0.25">N</span>
        <span class="parallax-layer" data-depth="0.45">P</span>
      </div>
      <div class="parallax-content">
        <div class="parallax-frases prose"><p>una</p><p>dues</p></div>
      </div>`;
    document.body.appendChild(slideEl);
    let subs = [];
    const ctx = {
      reduced: false,
      progress: () => 0.5,
      onProgress(cb) {
        subs.push(cb);
        return () => { subs = subs.filter(s => s !== cb); };
      },
      _subs: () => subs,
    };
    return { slideEl, ctx };
  }

  test('existeix i és moviment:true (gate de reduced-motion)', () => {
    expect(sd).toBeDefined();
    expect(sd.moviment).toBe(true);
  });

  test('apply escriu només els seus canals --px-sd-*, mai transform/filter inline', () => {
    const { slideEl, ctx } = harness();
    sd.apply(slideEl, paramsPerDefecte(sd), ctx);
    const capa = slideEl.querySelector('.parallax-layer');
    expect(capa.style.getPropertyValue('--px-sd-x')).not.toBe('');
    expect(capa.style.getPropertyValue('--px-sd-y')).not.toBe('');
    expect(capa.style.getPropertyValue('--px-sd-rot')).not.toBe('');
    expect(capa.style.getPropertyValue('--px-sd-scale')).not.toBe('');
    expect(capa.style.transform).toBe('');
    expect(capa.style.filter).toBe('');
    // Les frases queden intactes (frontera dura del contracte).
    slideEl.querySelectorAll('.parallax-frases > p').forEach(p => {
      expect(p.getAttribute('style')).toBeNull();
    });
  });

  test('doble apply no duplica subscripcions (idempotència)', () => {
    const { slideEl, ctx } = harness();
    sd.apply(slideEl, {}, ctx);  // cfg buit → defaults interns
    sd.apply(slideEl, {}, ctx);
    expect(ctx._subs().length).toBe(1);
  });

  test('reacciona al progrés publicat via onProgress', () => {
    const { slideEl, ctx } = harness();
    sd.apply(slideEl, paramsPerDefecte(sd), ctx);
    const capa = slideEl.querySelectorAll('.parallax-bg [data-depth]')[1];
    const abans = capa.style.getPropertyValue('--px-sd-x');
    ctx._subs().forEach(cb => cb(1));
    expect(capa.style.getPropertyValue('--px-sd-x')).not.toBe(abans);
  });

  test('cleanup desfà tot: unsub, vars fora, i és segur sense apply previ', () => {
    const { slideEl, ctx } = harness();
    sd.apply(slideEl, paramsPerDefecte(sd), ctx);
    sd.cleanup(slideEl);
    expect(ctx._subs().length).toBe(0);
    const capa = slideEl.querySelector('.parallax-layer');
    ['--px-sd-x', '--px-sd-y', '--px-sd-rot', '--px-sd-scale'].forEach(v => {
      expect(capa.style.getPropertyValue(v)).toBe('');
    });
    expect(() => sd.cleanup(slideEl)).not.toThrow();
  });
});

describe('mask-zoom + app-reveal — ranura d\'app compartida (A-02)', () => {
  // Slide lab amb ranura d'app (Lab B): .parallax-app-slot[data-app], més
  // .parallax-img (fallback d'imatge) i una .parallax-layer per al glyph.
  function harness({ slotHidden = true } = {}) {
    document.body.innerHTML = '';
    const slideEl = document.createElement('article');
    slideEl.className = 'slide slide--parallax slide--parallax-lab';
    slideEl.innerHTML = `
      <div class="parallax-bg" aria-hidden="true">
        <div class="parallax-img" data-depth="0.12"></div>
        <span class="parallax-layer" data-depth="0.25">N</span>
      </div>
      <div class="parallax-content">
        <div class="parallax-frases prose"><p>una</p><p>dues</p></div>
      </div>
      <div class="parallax-app-slot" data-app="App1"></div>`;
    const slot = slideEl.querySelector('.parallax-app-slot');
    slot.hidden = slotHidden;
    document.body.appendChild(slideEl);
    // ctx compartit: onProgress(cb) accepta cb(t) (mask-zoom) i cb(t, detail)
    // (app-reveal, que necessita {active, total}); _emit dispara totes dues.
    let subs = [];
    const ctx = {
      reduced: false,
      progress: () => 0,
      onProgress(cb) {
        subs.push(cb);
        return () => { subs = subs.filter(s => s !== cb); };
      },
      _emit(t, detail) { subs.forEach(cb => cb(t, detail)); },
    };
    return { slideEl, slot, ctx };
  }

  test('Fondo=1 crea un únic iframe compartit a la ranura i el reutilitza en re-apply', () => {
    const { slideEl, slot, ctx } = harness();
    maskZoom.apply(slideEl, { ...paramsPerDefecte(maskZoom), fons: 1 }, ctx);
    expect(slot.querySelectorAll('iframe').length).toBe(1);
    expect(slot.hidden).toBe(false);
    expect(slot.classList.contains('px-mz-fons')).toBe(true);
    // Re-apply (canvi de slider): idempotent, no en crea un segon.
    maskZoom.apply(slideEl, { ...paramsPerDefecte(maskZoom), fons: 1, escalaInicial: 50 }, ctx);
    expect(slot.querySelectorAll('iframe').length).toBe(1);
  });

  test('regressió A-02: desactivar mask-zoom no torna a amagar una app que app-reveal ja havia revelat', () => {
    const { slideEl, slot, ctx } = harness({ slotHidden: true });
    const ctxAR = { ...ctx, reduced: false };

    // 1) mask-zoom Fondo=1 amb la ranura encara amagada: fotografia
    //    hiddenAbans=true i força slot.hidden=false per mostrar l'efecte.
    maskZoom.apply(slideEl, { ...paramsPerDefecte(maskZoom), fons: 1 }, ctx);
    expect(slot.hidden).toBe(false);

    // 2) app-reveal s'arma i revela l'app (el seu propi flag, independent
    //    de mask-zoom) en arribar a la frase d'aparició.
    appReveal.apply(slideEl, paramsPerDefecte(appReveal), ctxAR);
    ctxAR._emit(0.75, { active: 3, total: 4 }); // fraseAparicio per defecte = 3
    expect(slot.classList.contains('px-ar-on')).toBe(true);
    expect(slot.hidden).toBe(false);

    // 3) Desactivar mask-zoom des del panell: el cleanup NO pot restaurar
    //    la foto obsoleta (hiddenAbans=true) sobre una app que ara ja és
    //    visible per app-reveal.
    maskZoom.cleanup(slideEl);
    expect(slot.classList.contains('px-mz-fons')).toBe(false);
    expect(slot.hidden).toBe(false);
    // app-reveal segueix intacte: mask-zoom no li ha tocat les classes.
    expect(slot.classList.contains('px-ar-on')).toBe(true);
  });

  test('cleanup en mode imatge (fons=0) no toca el hidden de la ranura d\'app', () => {
    const { slideEl, slot, ctx } = harness({ slotHidden: true });
    maskZoom.apply(slideEl, { ...paramsPerDefecte(maskZoom), fons: 0 }, ctx);
    // fons=0 → l'element emmascarat és .parallax-img, no la ranura.
    const img = slideEl.querySelector('.parallax-img');
    expect(img.style.getPropertyValue('mask-image')).not.toBe('');
    expect(slot.hidden).toBe(true); // intacta: mask-zoom ni l'ha mirada
    maskZoom.cleanup(slideEl);
    expect(slot.hidden).toBe(true); // segueix intacta després del cleanup
    expect(img.style.getPropertyValue('mask-image')).toBe('');
  });
});

describe('P-06 — compositor de filter escopat a .px-filter', () => {
  // Mateixa forma que el harness de scroll-depth: fons amb imatge + dues capes.
  function harness() {
    document.body.innerHTML = '';
    const slideEl = document.createElement('article');
    slideEl.className = 'slide slide--parallax slide--parallax-lab';
    slideEl.innerHTML = `
      <div class="parallax-bg" aria-hidden="true">
        <div class="parallax-img" data-depth="0.12"></div>
        <span class="parallax-layer" data-depth="0.25">N</span>
        <span class="parallax-layer" data-depth="0.45">P</span>
      </div>
      <div class="parallax-content">
        <div class="parallax-frases prose"><p>una</p><p>dues</p></div>
      </div>`;
    document.body.appendChild(slideEl);
    let subs = [];
    const ctx = {
      reduced: false,
      progress: () => 0.5,
      onProgress(cb) {
        subs.push(cb);
        return () => { subs = subs.filter(s => s !== cb); };
      },
    };
    const capes = () => [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    return { slideEl, ctx, capes };
  }

  test('sense cap tècnica de filter activa, cap capa porta .px-filter', () => {
    const { capes } = harness();
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(false));
  });

  test('depth-blur marca totes les capes amb .px-filter i el treu al cleanup', () => {
    const { slideEl, ctx, capes } = harness();
    depthBlur.apply(slideEl, paramsPerDefecte(depthBlur), ctx);
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(true));
    depthBlur.cleanup(slideEl);
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(false));
  });

  test('color-shift segueix afectant totes les capes esperades (herència de vars + .px-filter per capa)', () => {
    const { slideEl, ctx, capes } = harness();
    colorShift.apply(slideEl, paramsPerDefecte(colorShift), ctx);
    // Les vars viuen a l'arrel (herència), però CADA capa consumidora ha de
    // portar .px-filter perquè el compositor (parallax-lab.css) l'evalui.
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(true));
    expect(slideEl.style.getPropertyValue('--px-cs-hue')).not.toBe('');
    colorShift.cleanup(slideEl);
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(false));
    expect(slideEl.style.getPropertyValue('--px-cs-hue')).toBe('');
  });

  test('depth-blur i color-shift alhora sobre la mateixa capa: desactivar-ne una no li treu .px-filter a l\'altra', () => {
    const { slideEl, ctx, capes } = harness();
    depthBlur.apply(slideEl, paramsPerDefecte(depthBlur), ctx);
    colorShift.apply(slideEl, paramsPerDefecte(colorShift), ctx);
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(true));
    // Desactivem depth-blur: color-shift encara necessita el compositor actiu.
    depthBlur.cleanup(slideEl);
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(true));
    // Ara desactivem color-shift: ja no queda cap tècnica de filter activa.
    colorShift.cleanup(slideEl);
    capes().forEach(l => expect(l.classList.contains('px-filter')).toBe(false));
  });
});
