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
