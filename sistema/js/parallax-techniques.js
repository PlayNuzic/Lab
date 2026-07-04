// Parallax Lab — registre de tècniques.
//
// Cada tècnica és un mòdul autodescriptiu: el panell (parallax-builder.js)
// es dibuixa sol a partir d'aquest array. Afegir una tècnica = afegir un
// objecte aquí (i, si cal, la seva secció CSS a parallax-lab.css).
//
// ── CONTRACTE ────────────────────────────────────────────────────────────
// {
//   id: 'kebab-case',            // únic; prefix dels seus canals --px-*
//   nom: 'Nom curt (ES)',        // etiqueta del panell (castellà, com el panell)
//   descripcio: 'Una frase (ES)',// tooltip del panell
//   moviment: true|false,        // true → NO s'aplica amb prefers-reduced-motion
//   params: [{ key, label, min, max, step, def, unit? }],  // tots numèrics
//   apply(slideEl, cfg, ctx),    // activa/actualitza l'efecte. IDEMPOTENT:
//                                // es re-crida amb cada canvi de slider.
//   cleanup(slideEl),            // desfà TOT: rAF cancel·lats, listeners de
//                                // window/document fora, vars pròpies netes,
//                                // elements propis (.px-overlay) eliminats.
//                                // Ha de ser segur encara que slideEl ja no
//                                // sigui al DOM, i no fer res si apply no
//                                // s'havia cridat.
// }
// ctx = {
//   progress(): number,          // progrés actual 0..1 (frase activa)
//   onProgress(cb): unsub,       // cb(t, {t, active, total}) a cada canvi
//   reduced: boolean,            // prefers-reduced-motion en el moment del wire
// }
//
// ── REGLES DURES (les verifica un agent adversari) ──────────────────────
// 1. Mai escriure style.transform ni style.filter: només variables CSS del
//    canal propi (--px-<prefix>-*, vegeu la taula a parallax-lab.css) via
//    el.style.setProperty()/removeProperty().
// 2. Mai tocar .parallax-frases ni els seus <p> (coreografia intocable).
//    Àmbit permès: .parallax-bg i les seves capes, l'arrel del slide,
//    .parallax-app-slot, i overlays propis .px-overlay.
// 3. Mai animar `filter` de forma contínua (LP-07: re-rasteritza el text a
//    cada frame). Els canvis de filter salten al valor final.
// 4. cfg arriba sempre complet (defaults + overrides), però apply ha de
//    sobreviure a un cfg buit ({}), fent servir els seus defaults.
// 5. L'estat intern viu en un WeakMap local keyed per slideEl (vegeu
//    scroll-depth com a model). Doble apply no pot duplicar listeners.
// ─────────────────────────────────────────────────────────────────────────

// Estat local de scroll-depth: un registre per slide actiu.
const estatSD = new WeakMap();

// Tècnica de referència — el moviment de fons del parallax real (slides.js
// setActive, bloc de capes), portat al compositor de vars. Amb els valors
// per defecte el resultat visual és idèntic al de les slides reals.
const scrollDepth = {
  id: 'scroll-depth',
  nom: 'Profundidad de scroll',
  descripcio: 'Las capas del fondo se desplazan, rotan y escalan según el progreso de las frases — el movimiento base del sistema, ahora con parámetros.',
  moviment: true,
  params: [
    { key: 'amplX',   label: 'Amplitud horizontal', min: 0, max: 120, step: 5,   def: 60, unit: 'vw' },
    { key: 'amplY',   label: 'Amplitud vertical',   min: 0, max: 180, step: 5,   def: 90, unit: 'vh' },
    { key: 'rotacio', label: 'Rotación máx.',       min: 0, max: 60,  step: 2,   def: 24, unit: '°' },
    { key: 'zoom',    label: 'Zoom por profundidad', min: 0, max: 2,  step: 0.1, def: 0.8 },
  ],
  apply(slideEl, cfg, ctx) {
    scrollDepth.cleanup(slideEl);
    const amplX = cfg.amplX ?? 60;
    const amplY = cfg.amplY ?? 90;
    const rotacio = cfg.rotacio ?? 24;
    const zoom = cfg.zoom ?? 0.8;
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    // Mateixa fórmula que el bloc de capes de wireParallax: direcció
    // alternada per índex, y sense direcció, escala creixent amb t.
    const pinta = (t) => {
      capes.forEach((l, k) => {
        const depth = parseFloat(l.dataset.depth) || 0.2;
        const dir = k % 2 === 0 ? 1 : -1;
        l.style.setProperty('--px-sd-x', `${(dir * (t - 0.5) * depth * amplX).toFixed(1)}vw`);
        l.style.setProperty('--px-sd-y', `${((0.5 - t) * depth * amplY).toFixed(1)}vh`);
        l.style.setProperty('--px-sd-rot', `${(dir * (t - 0.5) * depth * rotacio).toFixed(1)}deg`);
        l.style.setProperty('--px-sd-scale', (1 + t * depth * zoom).toFixed(3));
      });
    };
    const unsub = ctx.onProgress(pinta);
    estatSD.set(slideEl, { unsub, capes });
    pinta(ctx.progress());
  },
  cleanup(slideEl) {
    const st = estatSD.get(slideEl);
    if (!st) return;
    try { st.unsub?.(); } catch {}
    st.capes.forEach(l => {
      ['--px-sd-x', '--px-sd-y', '--px-sd-rot', '--px-sd-scale']
        .forEach(v => l.style.removeProperty(v));
    });
    estatSD.delete(slideEl);
  },
};

// ── multi-speed (workflow verificada, model sonnet) ──
// Estat local de multi-speed: quines capes de profunditat s'han tocat al
// darrer apply, per poder-les netejar sense tornar a consultar el DOM.
const estatMS = new WeakMap();

// Multiplicador de velocitat per capa: tècnica ESTÀTICA (no anima res pel
// seu compte, no es subscriu a progrés) — només escala el moviment que ja
// aporta --px-sd-* (scroll-depth) via el compositor de parallax-lab.css,
// que multiplica --px-ms contra els translate (mai contra rotate/scale).
const multiSpeed = {
  id: 'multi-speed',
  nom: 'Multi-velocidad',
  descripcio: 'Multiplica la velocidad de cada capa según su profundidad — con dispersión en cero todas van al mismo ritmo, al subirla las capas cercanas y lejanas divergen en velocidad.',
  moviment: true,
  params: [
    { key: 'factor',    label: 'Factor de velocidad',        min: 0, max: 3, step: 0.1, def: 1 },
    { key: 'dispersio', label: 'Dispersión por profundidad', min: 0, max: 2, step: 0.1, def: 0 },
  ],
  apply(slideEl, cfg, ctx) {
    multiSpeed.cleanup(slideEl);
    const factor = cfg.factor ?? 1;
    const dispersio = cfg.dispersio ?? 0;
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    // Regla 8: sense capes de profunditat al slide, no hi ha res a
    // multiplicar — no-op net (cap var, cap listener, cap element).
    if (!capes.length) return;
    // Mateix fallback de profunditat que scroll-depth (0.2 per defecte),
    // perquè dMax quedi coherent amb el que ja pinta aquella tècnica.
    const depths = capes.map(l => parseFloat(l.dataset.depth) || 0.2);
    const dMax = Math.max(...depths) || 1; // guarda contra divisió per zero
    capes.forEach((l, k) => {
      // dispersio=0 → Math.pow(_, 0) === 1 sempre (fins i tot amb base 0):
      // totes les capes reben exactament `factor`, tal com exigeix l'spec.
      const ms = factor * Math.pow(depths[k] / dMax, dispersio);
      l.style.setProperty('--px-ms', ms.toFixed(3));
    });
    estatMS.set(slideEl, { capes });
  },
  cleanup(slideEl) {
    const st = estatMS.get(slideEl);
    if (!st) return;
    st.capes.forEach(l => l.style.removeProperty('--px-ms'));
    estatMS.delete(slideEl);
  },
};

// ── mouse-tilt (workflow verificada, model opus) ──
// Estat local de mouse-tilt: rAF, listeners i objectius de lerp per slide.
const estatMT = new WeakMap();

// Inclinació 3D del fons seguint el cursor. Escriu NOMÉS els seus canals
// (--px-persp al slide, --px-mt-rx/ry a .parallax-bg, --px-mt-x/y per capa);
// el compositor de parallax-lab.css ja els consumeix. Un bucle rAF amb lerp
// suavitza cap a l'objectiu i S'ATURA en repòs (no és un bucle permanent);
// cada gest del punter el rearma. pointerleave torna suaument a pla.
const mouseTilt = {
  id: 'mouse-tilt',
  nom: 'Inclinación 3D (ratón)',
  descripcio: 'El fondo se inclina en 3D siguiendo el cursor, con suavizado y una ligera paralaje por profundidad; al salir el puntero vuelve al plano.',
  moviment: true,
  params: [
    { key: 'intensitat',  label: 'Intensidad',  min: 0,    max: 30,   step: 1,    def: 12,  unit: '°' },
    { key: 'suavitat',    label: 'Suavizado',   min: 0.02, max: 0.3,  step: 0.01, def: 0.1 },
    { key: 'paralaxi',    label: 'Paralaje',    min: 0,    max: 40,   step: 2,    def: 16,  unit: 'px' },
    { key: 'perspectiva', label: 'Perspectiva', min: 400,  max: 2000, step: 50,   def: 900, unit: 'px' },
  ],
  apply(slideEl, cfg, ctx) {
    mouseTilt.cleanup(slideEl);                 // idempotent: neteja abans de re-armar
    const bg = slideEl.querySelector('.parallax-bg');
    if (!bg) return;                            // sense fons → no-op net (regla 8)

    const intensitat = cfg.intensitat ?? 12;
    // Suavitat = factor de lerp per frame; clampat a [0.02, 1] per no divergir.
    const suavitat = Math.min(1, Math.max(0.02, cfg.suavitat ?? 0.1));
    const paralaxi = cfg.paralaxi ?? 16;
    const perspectiva = cfg.perspectiva ?? 900;

    // Perspectiva 3D a l'arrel del slide (estàtica; no entra al rAF).
    slideEl.style.setProperty('--px-persp', `${perspectiva}px`);

    const capes = [...bg.querySelectorAll('[data-depth]')];
    const st = { rafId: null, cur: { x: 0, y: 0 }, target: { x: 0, y: 0 }, bg, capes, onMove: null, onLeave: null };

    // Escriu els canals a partir de la posició normalitzada (x, y) ∈ [-1, 1].
    // Inclinació "cap al cursor": la vora dreta/inferior s'acosta a la vista.
    const pinta = (x, y) => {
      bg.style.setProperty('--px-mt-rx', `${(y * intensitat).toFixed(2)}deg`);
      bg.style.setProperty('--px-mt-ry', `${(-x * intensitat).toFixed(2)}deg`);
      // Paral·laxi extra per capa, proporcional al depth (0.2 per defecte).
      for (const l of capes) {
        const depth = parseFloat(l.dataset.depth) || 0.2;
        l.style.setProperty('--px-mt-x', `${(x * paralaxi * depth).toFixed(2)}px`);
        l.style.setProperty('--px-mt-y', `${(y * paralaxi * depth).toFixed(2)}px`);
      }
    };

    const REST = 0.001;                          // llindar de repòs (unitats normalitzades)
    const frame = () => {
      const dx = st.target.x - st.cur.x;
      const dy = st.target.y - st.cur.y;
      if (Math.abs(dx) < REST && Math.abs(dy) < REST) {
        st.cur.x = st.target.x; st.cur.y = st.target.y;
        pinta(st.cur.x, st.cur.y);
        st.rafId = null;                         // repòs → atura el bucle (no infinit)
        return;
      }
      st.cur.x += dx * suavitat;
      st.cur.y += dy * suavitat;
      pinta(st.cur.x, st.cur.y);
      st.rafId = requestAnimationFrame(frame);
    };
    const ensureRaf = () => { if (st.rafId == null) st.rafId = requestAnimationFrame(frame); };

    st.onMove = (e) => {
      const r = slideEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      st.target.x = Math.max(-1, Math.min(1, nx));
      st.target.y = Math.max(-1, Math.min(1, ny));
      ensureRaf();
    };
    st.onLeave = () => { st.target.x = 0; st.target.y = 0; ensureRaf(); }; // torna a pla

    // Listeners al slideEl (moren amb el slide); igualment desfets al cleanup.
    slideEl.addEventListener('pointermove', st.onMove);
    slideEl.addEventListener('pointerleave', st.onLeave);
    estatMT.set(slideEl, st);
  },
  cleanup(slideEl) {
    const st = estatMT.get(slideEl);
    if (!st) return;                             // apply mai cridat → no-op segur
    if (st.rafId != null) cancelAnimationFrame(st.rafId);
    if (st.onMove) slideEl.removeEventListener('pointermove', st.onMove);
    if (st.onLeave) slideEl.removeEventListener('pointerleave', st.onLeave);
    slideEl.style.removeProperty('--px-persp');
    st.bg.style.removeProperty('--px-mt-rx');
    st.bg.style.removeProperty('--px-mt-ry');
    for (const l of st.capes) {
      l.style.removeProperty('--px-mt-x');
      l.style.removeProperty('--px-mt-y');
    }
    estatMT.delete(slideEl);
  },
};

// ── float-drift (workflow verificada, model sonnet) ──
// Estat local de float-drift: guarda, per slide, les capes on s'ha aplicat
// la tècnica (per poder-ne fer un cleanup exacte, sense re-consultar el DOM).
const estatFD = new WeakMap();

// Deriva flotant contínua i purament CSS (zero rAF, zero listeners): el
// vaivé el fa el navegador interpolant --px-fd-x/--px-fd-y (registrades amb
// @property a parallax-lab.css) via les @keyframes de cssExtra. Aquí només
// es fixen els paràmetres per capa —amplitud i durada— i un retard negatiu
// esglaonat per índex perquè les capes "respirin" fora de fase entre elles.
const floatDrift = {
  id: 'float-drift',
  nom: 'Deriva flotante',
  descripcio: 'Las capas del fondo derivan de forma continua y suave, como si la escena respirase, sin depender del scroll.',
  moviment: true,
  params: [
    { key: 'amplitud', label: 'Amplitud',  min: 0, max: 40, step: 2,   def: 14, unit: 'px' },
    { key: 'durada',   label: 'Duración',  min: 2, max: 15, step: 0.5, def: 7,  unit: 's' },
  ],
  apply(slideEl, cfg, ctx) {
    floatDrift.cleanup(slideEl);
    const amplitud = cfg.amplitud ?? 14;
    const durada = cfg.durada ?? 7;
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    capes.forEach((l, k) => {
      l.classList.add('px-fd');
      l.style.setProperty('--px-fd-amp', `${amplitud}px`);
      l.style.setProperty('--px-fd-dur', `${durada}s`);
      // Cada capa arrenca com si ja portés una fracció del cicle feta
      // (retard negatiu), repartides uniformement entre 0 i -durada.
      const fraccio = capes.length > 1 ? k / capes.length : 0;
      l.style.setProperty('--px-fd-delay', `${(-fraccio * durada).toFixed(2)}s`);
    });
    estatFD.set(slideEl, { capes });
  },
  cleanup(slideEl) {
    const st = estatFD.get(slideEl);
    if (!st) return;
    st.capes.forEach(l => {
      l.classList.remove('px-fd');
      ['--px-fd-amp', '--px-fd-dur', '--px-fd-delay', '--px-fd-x', '--px-fd-y']
        .forEach(v => l.style.removeProperty(v));
    });
    estatFD.delete(slideEl);
  },
};

// ── depth-blur (workflow verificada, model sonnet) ──
// Estat local de depth-blur: capes on hem escrit --px-bl, per poder-les
// netejar exactament (mateix patró que scroll-depth: WeakMap keyed per slideEl).
const estatDB = new WeakMap();

// Desenfoque de profundidad — DoF de cinema ESTÀTIC: cada capa de fons rep
// un blur fix segons la seva distància respecte a la capa més propera
// (depth màxim = nítida). LP-07: el filter es fixa a l'apply i mai s'anima;
// per això aquesta tècnica no fa cap subscripció a ctx.onProgress ni rAF.
const depthBlur = {
  id: 'depth-blur',
  nom: 'Desenfoque de profundidad',
  descripcio: 'Las capas del fondo se desenfocan según su profundidad, como el enfoque selectivo de una cámara de cine; el desenfoque queda fijo y no varía con el scroll.',
  moviment: false,
  params: [
    { key: 'maxBlur', label: 'Desenfoque máx.', min: 0, max: 8, step: 0.5, def: 3, unit: 'px' },
    { key: 'corba',   label: 'Curva de caída',  min: 0.3, max: 3, step: 0.1, def: 1 },
  ],
  apply(slideEl, cfg, ctx) {
    depthBlur.cleanup(slideEl);
    const maxBlur = cfg.maxBlur ?? 3;
    const corba = cfg.corba ?? 1;
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    if (!capes.length) return; // no-op net: Lab sense capes de profunditat (sense símbols ni imatge)
    // Mateix fallback que scroll-depth per a data-depth absent/invàlid (0 es tracta com a falsy).
    const depths = capes.map(l => parseFloat(l.dataset.depth) || 0.2);
    // Floor petit: evita divisió per zero si totes les capes comparteixen el mateix depth.
    const dMax = Math.max(...depths, 1e-6);
    capes.forEach((l, i) => {
      // ratio 1 = capa més llunyana (menys depth) → més borrosa; ratio 0 = capa a dMax → nítida.
      const ratio = Math.max(0, Math.min(1, 1 - depths[i] / dMax));
      const bl = maxBlur * Math.pow(ratio, corba);
      l.style.setProperty('--px-bl', `${bl.toFixed(2)}px`);
    });
    estatDB.set(slideEl, { capes });
  },
  cleanup(slideEl) {
    const st = estatDB.get(slideEl);
    if (!st) return;
    st.capes.forEach(l => l.style.removeProperty('--px-bl'));
    estatDB.delete(slideEl);
  },
};

// ── color-shift (workflow verificada, model sonnet) ──
// Estat local de color-shift: un registre per slide actiu.
const estatCS = new WeakMap();

// Viratge de color: matís/saturació/brillantor deriven linealment del
// progrés de frases. Les vars es fixen a l'ARREL del slide (slideEl), no
// per capa: com --px-cs-* no estan registrades amb @property, hereten per
// defecte cap a .parallax-layer i .parallax-img, que ja les consumeixen al
// compositor de filter (parallax-lab.css). Cap regla hi defineix una
// transició de filter, així que el canvi salta sense animar-se (LP-07).
const colorShift = {
  id: 'color-shift',
  nom: 'Viraje de color',
  descripcio: 'El matiz, la saturación y el brillo del fondo cambian según el progreso de las frases, en saltos discretos sin transición de filtro.',
  moviment: false,
  params: [
    { key: 'graus',      label: 'Giro de matiz', min: 0,   max: 180, step: 5,    def: 40,  unit: '°' },
    { key: 'saturacio',  label: 'Saturación',    min: 0.2, max: 2,   step: 0.1,  def: 1.2 },
    { key: 'brillantor', label: 'Brillo',        min: 0.5, max: 1.5, step: 0.05, def: 1 },
  ],
  apply(slideEl, cfg, ctx) {
    colorShift.cleanup(slideEl);
    const graus = cfg.graus ?? 40;
    const saturacio = cfg.saturacio ?? 1.2;
    const brillantor = cfg.brillantor ?? 1;
    const pinta = (t) => {
      slideEl.style.setProperty('--px-cs-hue', `${(graus * t).toFixed(1)}deg`);
      slideEl.style.setProperty('--px-cs-sat', (1 + (saturacio - 1) * t).toFixed(3));
      slideEl.style.setProperty('--px-cs-bri', (1 + (brillantor - 1) * t).toFixed(3));
    };
    const unsub = ctx.onProgress(pinta);
    estatCS.set(slideEl, { unsub });
    pinta(ctx.progress());
  },
  cleanup(slideEl) {
    const st = estatCS.get(slideEl);
    if (!st) return;
    try { st.unsub?.(); } catch {}
    ['--px-cs-hue', '--px-cs-sat', '--px-cs-bri'].forEach(v => slideEl.style.removeProperty(v));
    estatCS.delete(slideEl);
  },
};

// ── rotate-progress (workflow verificada, model sonnet) ──
// Estat local de rotate-progress: un registre per slide actiu.
const estatRP = new WeakMap();

// Rotació addicional de les capes de fons segons el progrés de les frases.
// El compositor (parallax-lab.css) ja suma aquest canal al de rotació de
// scroll-depth dins el mateix rotate(calc(...)), així que aquesta tècnica
// només aporta un terme addicional, mai sobreescriu l'altre. Direcció
// alternada per índex (mateix criteri que scroll-depth: parells +1,
// senars -1) si alternat=1; amb alternat=0 totes giren amb el mateix signe.
const rotateProgress = {
  id: 'rotate-progress',
  nom: 'Rotación por progreso',
  descripcio: 'Las capas del fondo giran un poco más a medida que avanza el progreso de las frases, sumándose a la rotación de profundidad; con la dirección alternada, las capas pares e impares giran en sentidos opuestos.',
  moviment: true,
  params: [
    { key: 'graus',    label: 'Grados de giro',      min: 0, max: 90, step: 5, def: 30, unit: '°' },
    { key: 'alternat', label: 'Alternar dirección',  min: 0, max: 1,  step: 1, def: 1 },
  ],
  apply(slideEl, cfg, ctx) {
    rotateProgress.cleanup(slideEl);
    const graus = cfg.graus ?? 30;
    const alternat = (cfg.alternat ?? 1) !== 0;
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    if (!capes.length) return; // no-op net: sense capes de fons, res a rotar
    const pinta = (t) => {
      capes.forEach((l, k) => {
        const dir = alternat ? (k % 2 === 0 ? 1 : -1) : 1;
        l.style.setProperty('--px-rp-rot', `${(graus * (t - 0.5) * dir).toFixed(1)}deg`);
      });
    };
    const unsub = ctx.onProgress(pinta);
    estatRP.set(slideEl, { unsub, capes });
    pinta(ctx.progress());
  },
  cleanup(slideEl) {
    const st = estatRP.get(slideEl);
    if (!st) return;
    try { st.unsub?.(); } catch {}
    st.capes.forEach(l => l.style.removeProperty('--px-rp-rot'));
    estatRP.delete(slideEl);
  },
};

// ── zoom-drift (workflow verificada, model sonnet) ──
// Estat local de zoom-drift: un registre per slide actiu (mateix patró
// que scroll-depth: WeakMap keyed per slideEl).
const estatZM = new WeakMap();

// zoom-drift — efecte Ken Burns: cada capa de fons (.parallax-bg
// [data-depth]) s'escala progressivament amb el progrés de les frases,
// des d'un origen (transform-origin) propi i determinista. El compositor
// (parallax-lab.css) MULTIPLICA --px-zm-scale pel --px-sd-scale de
// scroll-depth: les dues tècniques combinen sense trepitjar-se.
const zoomDrift = {
  id: 'zoom-drift',
  nom: 'Zoom deriva (Ken Burns)',
  descripcio: 'Cada capa se escala progresivamente desde un origen propio, como el clásico efecto Ken Burns; si hay una imagen de fondo, es ella la protagonista del zoom.',
  moviment: true,
  params: [
    { key: 'intensitat', label: 'Intensidad', min: 0, max: 1.5, step: 0.05, def: 0.35 },
  ],
  apply(slideEl, cfg, ctx) {
    zoomDrift.cleanup(slideEl);
    const intensitat = cfg.intensitat ?? 0.35;
    // Llista fixa d'origens (Ken Burns): es rota per índex, mai a
    // l'atzar, perquè el resultat sigui idèntic entre renders.
    const origens = ['30% 30%', '70% 40%', '40% 70%', '65% 65%'];
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    // La .parallax-img, si existeix, és la protagonista: sempre rep
    // l'origen [0] (el més "centrat"), encara que no sigui la primera
    // capa al DOM (cerca explícita, no assumeix ordre). La resta de
    // capes reben els origens restants rotant pel seu ordre relatiu
    // dins `capes`.
    const img = slideEl.querySelector('.parallax-bg .parallax-img[data-depth]');
    const origenDe = new Map();
    if (img) origenDe.set(img, origens[0]);
    let k = img ? 1 : 0;
    capes.forEach((l) => {
      if (l === img) return;
      origenDe.set(l, origens[k % origens.length]);
      k += 1;
    });
    const pinta = (t) => {
      capes.forEach((l) => {
        const depth = parseFloat(l.dataset.depth) || 0.2;
        l.style.setProperty('--px-zm-scale', (1 + t * intensitat * depth).toFixed(3));
        l.style.setProperty('--px-zm-origin', origenDe.get(l));
      });
    };
    const unsub = ctx.onProgress(pinta);
    estatZM.set(slideEl, { unsub, capes });
    pinta(ctx.progress());
  },
  cleanup(slideEl) {
    const st = estatZM.get(slideEl);
    if (!st) return;
    try { st.unsub?.(); } catch {}
    st.capes.forEach(l => {
      ['--px-zm-scale', '--px-zm-origin'].forEach(v => l.style.removeProperty(v));
    });
    estatZM.delete(slideEl);
  },
};

// ── gradient-drift (workflow verificada, model sonnet) ──
// Estat local de gradient-drift: overlay propi (.px-overlay.px-gd) + unsub
// del progrés, un registre per slide actiu (mateix patró que scroll-depth).
const estatGD = new WeakMap();

// El glow radial de fons viatja pel slide amb el progrés de les frases: un
// overlay propi desplaça el centre del seu radial-gradient de cantonada
// superior-dreta cap avall-esquerra. "recorregut" escala quant d'aquest
// trajecte s'arriba a fer (a 0, el centre queda fix al punt de partida).
// "intensitat" és només l'opacitat de l'overlay: no varia amb el progrés.
const gradientDrift = {
  id: 'gradient-drift',
  nom: 'Gradiente viajero',
  descripcio: 'El resplandor radial del fondo se desplaza por el slide a medida que avanzan las frases.',
  moviment: true,
  params: [
    { key: 'recorregut', label: 'Recorrido',  min: 0, max: 100, step: 5,    def: 70, unit: '%' },
    { key: 'intensitat', label: 'Intensidad', min: 0, max: 1,   step: 0.05, def: 0.5 },
  ],
  apply(slideEl, cfg, ctx) {
    gradientDrift.cleanup(slideEl);
    // No-op net si el slide no té capa de fons: res a crear, res a
    // subscriure (mateixa guarda que l'exemple de .parallax-img absent).
    const bg = slideEl.querySelector('.parallax-bg');
    if (!bg) return;
    const recorregut = cfg.recorregut ?? 70;
    const intensitat = cfg.intensitat ?? 0.5;
    const factor = recorregut / 100;
    const overlay = document.createElement('div');
    overlay.className = 'px-overlay px-gd';
    // Opacitat fixa (no depèn de t): es fixa un sol cop, aquí.
    overlay.style.setProperty('--px-gd-op', intensitat.toFixed(2));
    bg.appendChild(overlay);
    // Interpolació del centre del gradient: 85%→15% (x) i 10%→80% (y),
    // escalades pel factor de recorregut. A t=0 coincideix amb els
    // defaults del CSS (85%/10%): el primer frame no fa salt visual.
    const pinta = (t) => {
      const x = 85 + (15 - 85) * t * factor;
      const y = 10 + (80 - 10) * t * factor;
      overlay.style.setProperty('--px-gd-x', `${x.toFixed(1)}%`);
      overlay.style.setProperty('--px-gd-y', `${y.toFixed(1)}%`);
    };
    const unsub = ctx.onProgress(pinta);
    estatGD.set(slideEl, { unsub, overlay });
    pinta(ctx.progress());
  },
  cleanup(slideEl) {
    const st = estatGD.get(slideEl);
    if (!st) return;
    try { st.unsub?.(); } catch {}
    // Treu l'overlay sencer: com les vars només viuen en ell mateix,
    // eliminar-lo ja les neteja totes (cap altre element les usa).
    st.overlay.remove();
    estatGD.delete(slideEl);
  },
};

// ── inertia (workflow verificada, model sonnet) ──
// Estat local de inertia: guarda les capes tocades per poder netejar-les.
const estatInertia = new WeakMap();

// Persecució elàstica sense rAF: la tècnica només fixa els canals de
// TEMPORITZACIÓ (durada/corba/retard) que el compositor ja aplica a la
// transition de .parallax-layer/.parallax-img (parallax-lab.css, bloc
// "Timing"). El moviment en si el fan altres tècniques (p.ex. scroll-depth)
// canviant el transform per progrés; inertia només en retemporitza la
// transició perquè es vegi com una persecució elàstica amb rebot. No cal
// escoltar ctx.onProgress ni fer cap retiming manual frame a frame: només
// re-fixar les vars a cada apply (idempotent, com scroll-depth).
const inertia = {
  id: 'inertia',
  nom: 'Inercia elástica',
  descripcio: 'Las capas persiguen el movimiento con retardo y rebote elástico, escalonados capa a capa: sin animación por fotogramas, solo temporización CSS.',
  moviment: true,
  params: [
    { key: 'durada',    label: 'Duración',   min: 0.2, max: 2.5, step: 0.1,  def: 1.1,  unit: 's' },
    { key: 'rebot',     label: 'Rebote',     min: 0,   max: 2,   step: 0.1,  def: 1 },
    { key: 'esglaonat', label: 'Escalonado', min: 0,   max: 0.4, step: 0.02, def: 0.12, unit: 's' },
  ],
  apply(slideEl, cfg, ctx) {
    inertia.cleanup(slideEl);
    const durada = cfg.durada ?? 1.1;
    const rebot = cfg.rebot ?? 1;
    const esglaonat = cfg.esglaonat ?? 0.12;
    // Overshoot de la corba: rebot=0 → arriba a 1 sense passar-se'n;
    // rebot alt → sobrepassa el 100% i torna (sensació de molla/Lenis).
    const ease = `cubic-bezier(0.34, ${(1 + rebot * 0.56).toFixed(3)}, 0.64, 1)`;
    const capes = [...slideEl.querySelectorAll('.parallax-bg [data-depth]')];
    capes.forEach((l, k) => {
      l.style.setProperty('--px-tr-dur', `${durada.toFixed(2)}s`);
      l.style.setProperty('--px-tr-ease', ease);
      l.style.setProperty('--px-tr-delay', `${(k * esglaonat).toFixed(3)}s`);
    });
    estatInertia.set(slideEl, { capes });
  },
  cleanup(slideEl) {
    const st = estatInertia.get(slideEl);
    if (!st) return;
    st.capes.forEach(l => {
      ['--px-tr-dur', '--px-tr-ease', '--px-tr-delay'].forEach(v => l.style.removeProperty(v));
    });
    estatInertia.delete(slideEl);
  },
};

// ── mask-zoom (workflow verificada, model opus) ──
// Estat local de mask-zoom: un registre per slideEl amb l'unsub del progrés i
// la referència a la .parallax-img emmascarada (per poder netejar-la encara
// que el slide ja hagi sortit del DOM).
const estatMZ = new WeakMap();

// Efecte "logo GTA VI": la .parallax-img només es veu DINS d'un glyph gegant
// que fa de finestra; amb el progrés la màscara s'escala (easeInQuad) fins que
// la imatge omple el slide. ATENCIÓ: mask-* NO és transform ni filter — és un
// canal NOU autoritzat per aquesta tècnica: s'escriu inline sobre .parallax-img
// i es neteja SENCER al cleanup. Sense .parallax-img → no-op net.
const maskZoom = {
  id: 'mask-zoom',
  nom: 'Máscara zoom (GTA)',
  descripcio: 'La imagen solo se ve dentro de un símbolo gigante que actúa de ventana; al avanzar, la máscara se agranda hasta que la imagen llena todo el slide.',
  moviment: true,
  params: [
    { key: 'escalaInicial', label: 'Escala inicial de la máscara', min: 10,  max: 100, step: 5,  def: 40,  unit: '%' },
    { key: 'escalaFinal',   label: 'Escala final de la máscara',   min: 150, max: 800, step: 25, def: 400, unit: '%' },
  ],
  apply(slideEl, cfg, ctx) {
    // IDEMPOTENT: primera línia = cleanup propi (desarma l'unsub i les vars
    // velles; un re-apply per canvi de slider no duplica res).
    maskZoom.cleanup(slideEl);
    const img = slideEl.querySelector('.parallax-img');
    if (!img) return;  // Lab A sense imatge → no-op net (el cleanup ja ha corregut).

    const escalaInicial = cfg.escalaInicial ?? 40;
    const escalaFinal = cfg.escalaFinal ?? 400;

    // El glyph de la finestra surt del textContent de la 1a .parallax-layer;
    // primer code point (robust amb surrogates), fallback nota musical.
    const capa = slideEl.querySelector('.parallax-layer');
    const brut = (capa?.textContent ?? '').trim();
    const glyph = brut ? [...brut][0] : '♪';

    // Màscara = SVG data-URI amb <text> centrat, blanc opac (val tant per a
    // màscara alpha com per luminància). XML-escapem el glyph i després
    // encodeURIComponent de tot l'SVG; l'embolcallem en url("...") (les cometes
    // simples de l'SVG no trenquen les dobles del wrapper).
    const escapaXML = (s) => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
      + "<text x='50' y='50' text-anchor='middle' dominant-baseline='central' "
      + "font-family='Helvetica, Arial, sans-serif' font-weight='700' font-size='94' "
      + "fill='#fff'>" + escapaXML(glyph) + "</text></svg>";
    const uri = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';

    // Props estàtiques de la màscara (una sola vegada; -webkit-* per a Safari).
    img.style.setProperty('-webkit-mask-image', uri);
    img.style.setProperty('mask-image', uri);
    img.style.setProperty('-webkit-mask-repeat', 'no-repeat');
    img.style.setProperty('mask-repeat', 'no-repeat');
    img.style.setProperty('-webkit-mask-position', 'center');
    img.style.setProperty('mask-position', 'center');
    // Puja l'opacitat base (0.10 a parallax.css) perquè la finestra es vegi;
    // classe pròpia que la cssExtra estilitza i que el cleanup treu.
    img.classList.add('px-mz-on');

    // El progrés només mou mask-size: d'escalaInicial% a escalaFinal% amb
    // easeInQuad (t·t) → arrenca lent (finestra petita) i accelera fins omplir.
    const pinta = (t) => {
      const tt = t < 0 ? 0 : t > 1 ? 1 : t;
      const eased = tt * tt;
      const mida = (escalaInicial + (escalaFinal - escalaInicial) * eased).toFixed(1) + '%';
      img.style.setProperty('-webkit-mask-size', mida);
      img.style.setProperty('mask-size', mida);
    };

    const unsub = ctx.onProgress(pinta);
    estatMZ.set(slideEl, { unsub, img });
    pinta(ctx.progress());
  },
  cleanup(slideEl) {
    const st = estatMZ.get(slideEl);
    if (!st) return;  // segur si apply mai s'ha cridat.
    try { st.unsub?.(); } catch {}
    const img = st.img;
    if (img) {
      // Neteja TOTES les mask-props pròpies (canal nou) + la classe d'opacitat.
      ['-webkit-mask-image', 'mask-image', '-webkit-mask-repeat', 'mask-repeat',
       '-webkit-mask-position', 'mask-position', '-webkit-mask-size', 'mask-size']
        .forEach(v => img.style.removeProperty(v));
      img.classList.remove('px-mz-on');
    }
    estatMZ.delete(slideEl);
  },
};

// ── spotlight (workflow verificada, model opus) ──
// Estat local de spotlight: overlay propi (.px-overlay.px-sp), rAF (throttle
// del seguiment + recentrat suau) i listeners de punter, un registre per slideEl.
const estatSP = new WeakMap();

// Foco de llum que segueix el ratolí: un vel fosc amb un forat radial
// transparent sota el cursor. L'overlay .px-sp (dins .parallax-bg, per sobre
// de les capes) porta el radial-gradient definit a cssExtra; aquí només movem
// el seu centre (--px-sp-x/y en %), fixem el radi (--px-sp-r) i la força del
// vel (--px-sp-f). El pointermove va throttlejat a un sol paint per frame (rAF)
// i el pointerleave recentra el focus amb un lerp suau que s'atura en repòs.
// No toca mai transform ni filter (regla 1/3): només els seus canals --px-sp-*.
const spotlight = {
  id: 'spotlight',
  nom: 'Foco (ratón)',
  descripcio: 'Un velo oscuro con un hueco de luz que sigue al cursor, como un foco; al salir el puntero, el foco vuelve suavemente al centro.',
  moviment: true,
  params: [
    { key: 'radi',  label: 'Radio',  min: 10, max: 60,  step: 2,    def: 30,   unit: 'vw' },
    { key: 'forca', label: 'Fuerza', min: 0,  max: 0.8, step: 0.05, def: 0.35 },
  ],
  apply(slideEl, cfg, ctx) {
    spotlight.cleanup(slideEl);                 // idempotent: neteja abans de re-armar
    const bg = slideEl.querySelector('.parallax-bg');
    if (!bg) return;                            // sense fons → no-op net (regla 8)

    const radi = cfg.radi ?? 30;
    const forca = cfg.forca ?? 0.35;

    const overlay = document.createElement('div');
    overlay.className = 'px-overlay px-sp';
    // Radi constant (no varia amb el gest ni el tema): es fixa un sol cop.
    overlay.style.setProperty('--px-sp-r', `${radi}vw`);
    bg.appendChild(overlay);

    // Estat: posició pintada (x, y) i objectiu (tx, ty) en %, flag de centrat
    // i id de rAF. Arrenca al centre del slide.
    const st = { overlay, rafId: null, x: 50, y: 50, tx: 50, ty: 50, centering: false, onMove: null, onLeave: null };

    // Pinta l'estat actual als canals de l'overlay. El TEMA es llegeix al
    // moment de pintar (mai cachejat): en dark el vel és ×1.15 més fort,
    // clampat a 1 (màxim vàlid d'un alfa; 0.8×1.15=0.92 ja no el supera).
    const pinta = () => {
      const dark = document.body.dataset.theme === 'dark';
      const f = Math.min(1, forca * (dark ? 1.15 : 1));
      overlay.style.setProperty('--px-sp-x', `${st.x.toFixed(2)}%`);
      overlay.style.setProperty('--px-sp-y', `${st.y.toFixed(2)}%`);
      overlay.style.setProperty('--px-sp-f', f.toFixed(3));
    };

    const REST = 0.1;                            // llindar de repòs del centrat (en %)
    const frame = () => {
      st.rafId = null;
      if (st.centering) {
        const dx = st.tx - st.x, dy = st.ty - st.y;
        if (Math.abs(dx) < REST && Math.abs(dy) < REST) {
          st.x = st.tx; st.y = st.ty;
          st.centering = false;                  // arribat al centre → atura el bucle
          pinta();
          return;
        }
        st.x += dx * 0.15;                       // ease suau cap al centre
        st.y += dy * 0.15;
        pinta();
        ensureFrame();                           // continua el lerp el proper frame
      } else {
        st.x = st.tx; st.y = st.ty;              // seguiment directe: snap a l'objectiu
        pinta();                                 // un sol paint per frame; no re-arma (para si el ratolí no es mou)
      }
    };
    const ensureFrame = () => { if (st.rafId == null) st.rafId = requestAnimationFrame(frame); };

    st.onMove = (e) => {
      // LP-06: el rect es llegeix FRESC a cada gest; mai es cacheja a l'apply
      // (un slide pot canviar de mida i el rect quedaria ranci).
      const r = slideEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      st.tx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      st.ty = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      st.centering = false;                      // un moviment cancel·la qualsevol centrat en curs
      ensureFrame();
    };
    st.onLeave = () => {
      st.tx = 50; st.ty = 50;                    // objectiu = centre
      st.centering = true;                       // recentrat suau (lerp)
      ensureFrame();
    };

    // Listeners al slideEl (moren amb el slide); igualment desfets al cleanup.
    slideEl.addEventListener('pointermove', st.onMove);
    slideEl.addEventListener('pointerleave', st.onLeave);
    estatSP.set(slideEl, st);

    pinta();                                     // estat inicial: focus centrat, ja visible
  },
  cleanup(slideEl) {
    const st = estatSP.get(slideEl);
    if (!st) return;                             // apply mai cridat → no-op segur
    if (st.rafId != null) cancelAnimationFrame(st.rafId);
    if (st.onMove) slideEl.removeEventListener('pointermove', st.onMove);
    if (st.onLeave) slideEl.removeEventListener('pointerleave', st.onLeave);
    // Treu l'overlay sencer: com els canals --px-sp-* només viuen en ell,
    // eliminar-lo ja els neteja tots (cap altre element els consumeix).
    // remove() sobre un node ja despenjat del DOM és un no-op segur.
    st.overlay.remove();
    estatSP.delete(slideEl);
  },
};

// ── text-reveal (workflow reparada+verificada, model sonnet) ──
// Estat local de text-reveal: guarda la referència real al <h1> del títol
// desada a l'apply (mateix patró que estatSD: WeakMap keyed per slideEl,
// mai es re-consulta el DOM al cleanup). No es guarda cap "text original":
// cleanup aplana el contingut ACTUAL en lloc de restaurar un snapshot antic
// (vegeu el comentari de cleanup més avall — evita perdre edicions en viu).
const estatTXR = new WeakMap();

// El títol del pas —únic element fora de .parallax-frases que aquesta
// tècnica té autoritzat a tocar— entra lletra a lletra: cada grafema no
// blanc es converteix en un <span class="px-txr-char"> que parallax-lab.css
// anima amb una transició d'opacity/translateY, amb un retard esglaonat per
// índex (--px-txr-delay). Cap listener ni rAF: l'entrada és un sol canvi de
// classe (amb un reflow forçat pel mig perquè la transició es disparí).
//
// Canals PROPIS: --px-txr-dur / --px-txr-delay (prefix "txr", no "tr"). El
// prefix "tr" ja està RESERVAT a inertia per als canals de temporització del
// compositor compartit (.parallax-layer/.parallax-img, bloc "Timing" de
// parallax-lab.css: durada/corba/retard de la transition de transform).
// Reutilitzar-lo aquí violaria la regla 1 (canal propi del prefix declarat a
// la taula) i l'invariant un-canal-un-escriptor: quan totes dues s'activin
// alhora (p.ex. via Aleatori, que en combina 2-4), escriurien/netejarien els
// mateixos noms amb semàntiques diferents (0.8s de títol vs 0.7s de capes).
const textReveal = {
  id: 'text-reveal',
  nom: 'Título letra a letra',
  descripcio: 'El título del paso aparece letra a letra, con una entrada escalonada de opacidad y desplazamiento vertical.',
  moviment: true,
  params: [
    { key: 'durada',    label: 'Duración',   min: 0.2, max: 2,  step: 0.1, def: 0.8, unit: 's' },
    { key: 'esglaonat', label: 'Escalonado', min: 0,   max: 80, step: 5,   def: 30,  unit: 'ms' },
  ],
  apply(slideEl, cfg, ctx) {
    textReveal.cleanup(slideEl);
    // reduced: es deixa el títol tal qual (text pla, ja "col·locat" i
    // completament visible) en lloc d'esbocinar-lo ja revelat — cap lletra
    // no passa mai per opacity:0, i el mode edició hi treballa exactament
    // igual que sense la tècnica activa. (L'engine ja no crida apply() amb
    // moviment:true + reduced actiu, però ens defensem igualment si algú
    // crida la tècnica directament, p.ex. un test.)
    if (ctx.reduced) return;
    // Únic element autoritzat fora de .parallax-frases (spec de la
    // tècnica). Si el layout no en té —p.ex. un harness de test mínim
    // com el de scroll-depth—, no-op net.
    const titleEl = slideEl.querySelector('.slide__title');
    if (!titleEl) return;
    // Llegit DESPRÉS de cleanup() (primera línia): si ja hi havia un apply
    // previ, cleanup ja ha aplanat el títol (spans fora); si l'usuari
    // l'havia editat en mode edició mentre hi havia spans, aquí es recull
    // el text ja editat, mai un original ranci (vegeu cleanup).
    const original = titleEl.textContent;
    const durada = cfg.durada ?? 0.8;
    const esglaonat = cfg.esglaonat ?? 30;
    const frag = document.createDocumentFragment();
    // Segmentació per grafema (Intl.Segmenter), no per punt de codi: un
    // accent combinant (e + U+0301) o un emoji amb ZWJ es partirien en spans
    // separats amb for...of/.split(''), trencant visualment el clúster (un
    // diacrític combinant sol en un inline-block es renderitza penjat).
    // Sense suport d'Intl.Segmenter (Safari vell), cau a punts de codi —
    // encara protegeix parells subrogats (un emoji no es talla per la
    // meitat), pitjor només amb clústers rars: degradació acceptable, mai
    // un error.
    const grafemes = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(original)].map(s => s.segment)
      : [...original];
    let idx = 0;
    for (const gra of grafemes) {
      if (/^\s+$/.test(gra)) {
        // Els espais NO es fiquen dins d'un span: un span inline-block amb
        // un únic espai pot col·lapsar a amplada 0 en alguns navegadors
        // (retallat de whitespace a la vora de la caixa). Com a node de
        // text solt es comporten exactament com al text pla original i no
        // consumeixen cap pas de l'esglaonat (l'índex només avança amb
        // grafemes no blancs). Test ancorat ^...$ perquè només compti com a
        // "espai" un grafema fet ÍNTEGRAMENT d'espai en blanc.
        frag.appendChild(document.createTextNode(gra));
        continue;
      }
      const span = document.createElement('span');
      span.className = 'px-txr-char';
      span.textContent = gra;
      span.style.setProperty('--px-txr-delay', `${Math.round(idx * esglaonat)}ms`);
      frag.appendChild(span);
      idx += 1;
    }
    titleEl.textContent = '';
    titleEl.appendChild(frag);
    titleEl.style.setProperty('--px-txr-dur', `${durada.toFixed(2)}s`);
    // Força un reflow abans d'afegir la classe que revela: sense aquest
    // punt de sincronització el navegador col·lapsa l'estat inicial i el
    // final en el mateix frame i la transició CSS no arriba a disparar-se.
    void titleEl.offsetWidth;
    titleEl.classList.add('px-txr-in');
    estatTXR.set(slideEl, { titleEl });
  },
  cleanup(slideEl) {
    const st = estatTXR.get(slideEl);
    if (!st) return;
    // Aplana el contingut ACTUAL de l'element (mai un snapshot desat): si el
    // títol no s'ha tocat des de l'apply, .textContent ja és l'original i el
    // resultat és idèntic a "restaurar-lo"; si l'usuari l'ha editat en mode
    // edició mentre encara hi havia spans (contenteditable directe sobre
    // .slide__title), aquesta línia preserva l'edició en lloc de
    // sobreescriure-la amb l'estat vell. Segueix sent crític per la spec:
    // garanteix zero spans residuals, perquè persistField (slides.js) desa
    // .textContent com a text pla al blur. Restaurar un snapshot antic aquí
    // faria retrocedir visualment una edició ja desada (l'storage tindria la
    // nova, el DOM ensenyaria la vella) i, si després hi hagués un
    // focus+blur sense reescriure, persistField tornaria a desar la vella
    // al damunt de la nova: edició perduda de veritat, no només visual.
    st.titleEl.textContent = st.titleEl.textContent;
    st.titleEl.classList.remove('px-txr-in');
    st.titleEl.style.removeProperty('--px-txr-dur');
    estatTXR.delete(slideEl);
  },
};

// ── marquee (workflow reparada+verificada, model sonnet) ──
// Estat local de marquee: cap rAF ni listener — només cal recordar
// l'overlay creat per poder-lo eliminar sencer al cleanup (mateix patró
// que gradient-drift: com les tres vars només viuen dins d'ell, esborrar-lo
// ja les neteja totes). Tampoc hi ha listener de `resize`: si la finestra
// canvia d'amplada després de l'apply, `copies` no es recalcula fins al
// següent re-apply (canvi de slider). Decisió acceptada perquè el marge de
// seguretat del càlcul d'`amplUnitat` (vegeu apply: factor de caràcter
// deliberadament per sota de la mitjana real) ja cobreix eixamplaments
// raonables sense deixar un buit visible.
const estatMQ = new WeakMap();

// Marquesina de símbols — teletip gegant estil Delassus: una fila dels
// símbols del capítol (es LLEGEIX el textContent de .parallax-layer, mai
// se n'escriu res) llisca contínuament pel fons. Estructura de dos nivells,
// com qualsevol marquee CSS clàssic: l'overlay (.px-overlay, ja porta
// position:absolute + inset:0 de la regla compartida) fa de finestra
// retallada per .parallax-bg (overflow:hidden); a dins, .px-mq-track és un
// element PROPI —no [data-depth] ni .parallax-layer— que es deixa créixer
// amb width:max-content fins a la seva amplada real de contingut i és ell
// qui s'anima via @keyframes (cssExtra) amb un translateX(0 → -50%). En
// quedar fora del compositor de transform/filter de parallax-lab.css, no
// hi ha cap risc de xoc amb cap altra tècnica.
const marquee = {
  id: 'marquee',
  nom: 'Marquesina de símbolos',
  descripcio: 'Los símbolos del capítulo se deslizan sin parar por el fondo en una franja continua, como un teletipo publicitario.',
  moviment: true,
  params: [
    { key: 'velocitat', label: 'Velocidad', min: 10,   max: 120, step: 5,    def: 40,   unit: 's' },
    { key: 'mida',      label: 'Tamaño',    min: 40,   max: 200, step: 10,   def: 90,   unit: 'px' },
    { key: 'opacitat',  label: 'Opacidad',  min: 0.02, max: 0.3, step: 0.01, def: 0.08 },
  ],
  apply(slideEl, cfg, ctx) {
    marquee.cleanup(slideEl);
    const bg = slideEl.querySelector('.parallax-bg');
    if (!bg) return; // no-op net (regla 8): sense fons, res on penjar la banda
    // Símbols del capítol: cada .parallax-layer existent hi aporta el seu
    // textContent; no se n'escriu ni se'n toca res (viuen a .parallax-bg,
    // àmbit permès per la regla 2, però aquesta tècnica només els llegeix).
    const simbols = [...bg.querySelectorAll('.parallax-layer')]
      .map(l => l.textContent.trim())
      .filter(Boolean);
    if (!simbols.length) return; // no-op net (regla 8): capítol sense símbols
    const velocitat = cfg.velocitat ?? 40;
    const mida = cfg.mida ?? 90;
    const opacitat = cfg.opacitat ?? 0.08;

    // Unitat = tots els símbols amb el separador ' · ' de l'spec, MÉS un
    // separador final: així en repetir-la la cadència de punts queda
    // uniforme (mai dos símbols enganxats a la costura entre còpies). El
    // darrer caràcter es construeix amb String.fromCharCode(160) — un
    // NBSP (Unicode U+00A0), no un espai normal — perquè amb
    // width:max-content un espai normal que cau exactament al final
    // absolut de la cadena es col·lapsa a amplada 0 (whitespace "penjant"
    // de fi de línia; els espais interiors, seguits de més text, compten
    // sencers). Sense això, l'ÚLTIMA còpia de `unitat` dins el track
    // pesaria mig espai MENYS que totes les altres i, com translateX(-50%)
    // es mou sempre exactament la meitat de l'amplada renderitzada, el
    // punt de tancament del bucle quedaria mig espai desplaçat (micro-salt
    // a cada volta). El NBSP no es col·lapsa mai, ni a l'interior ni al
    // final: totes les còpies pesen exactament igual i el bucle tanca net.
    const NBSP = String.fromCharCode(160);
    const unitat = `${simbols.join(' · ')} ·${NBSP}`;
    // Nombre de còpies: heurística determinista (sense mesurar el DOM —
    // getBoundingClientRect val 0 sense layout real, p.ex. sota jsdom)
    // basada en una amplada mitjana de caràcter i window.innerWidth com a
    // proxy senzill de l'amplada del slide. El factor (0.33x la mida de
    // font) és deliberadament BAIX: als símbols reals dels capítols
    // (slide-data.js, pasos 28.5/28.7) la mitjana surt ~0.39em/caràcter,
    // perquè quasi la meitat dels caràcters de `unitat` són el separador
    // estret ' · ' (espai + punt, molt més prims que una lletra). Un
    // factor per SOTA de la mitjana real és la direcció segura: fa que
    // `amplUnitat` quedi per sota de l'amplada real, de manera que
    // `copies` surt per DAMUNT del mínim necessari perquè el track
    // cobreixi les 2 amplades que exigeix l'spec (mai per sota — un factor
    // massa ALT, com el 0.6 anterior, fa exactament el contrari i deixa el
    // track curt amb contingut real, i pitjor com més gran és el
    // viewport). S'arrodoneix sempre a PARELL: repetir la mateixa unitat N
    // vegades (N parell) fa que la primera meitat i la segona (N/2 còpies
    // cadascuna) siguin cadenes IDÈNTIQUES per construcció, així
    // translateX(-50%) tanca el bucle sense cap salt visible. El topall de
    // 400 és només xarxa de seguretat: amb els rangs de l'spec i qualsevol
    // viewport real mai s'hauria d'arribar a tocar.
    const amplada = window.innerWidth || 1024;
    const amplUnitat = Math.max(1, unitat.length * mida * 0.33);
    let copies = Math.ceil((amplada * 2) / amplUnitat);
    copies = Math.min(400, Math.max(2, copies));
    if (copies % 2 !== 0) copies += 1;

    const overlay = document.createElement('div');
    overlay.className = 'px-overlay px-mq';
    overlay.style.setProperty('--px-mq-dur', `${velocitat}s`);
    overlay.style.setProperty('--px-mq-size', `${mida}px`);
    overlay.style.setProperty('--px-mq-op', opacitat.toFixed(2));

    const track = document.createElement('div');
    track.className = 'px-mq-track';
    track.textContent = unitat.repeat(copies);
    overlay.appendChild(track);
    bg.appendChild(overlay);

    estatMQ.set(slideEl, { overlay });
  },
  cleanup(slideEl) {
    const st = estatMQ.get(slideEl);
    if (!st) return;
    // Treure l'overlay sencer ja s'endu el track i les tres vars alhora
    // (només viuen dins seu, com gradient-drift).
    st.overlay.remove();
    estatMQ.delete(slideEl);
  },
};

// ── app-reveal (workflow verificada, model opus) ──
// Estat local d'app-reveal: unsub del progrés, la ranura i el seu iframe
// (creat un sol cop — P-26) i si ara mateix està revelada. Un SEGON WeakMap
// recorda l'últim {active, total} vist per slide: el cleanup NO el neteja,
// així un re-apply (canvi de slider) pot restaurar l'estat de revelació amb
// el nou llindar sense esperar el pròxim gest de scroll. És GC-segur (clau
// = slideEl: quan el slide mor, l'entrada s'allibera sola).
const estatAR = new WeakMap();
const ultimProgresAR = new WeakMap();

// L'app entra en escena en arribar a una frase concreta (el "moment vídeo"
// de GTA portat a Nuzic). El motor ja crea .parallax-app-slot[data-app]
// [hidden] (només Lab B); aquí ens subscrivim al progrés i, segons l'índex
// de frase actiu (detail.active) i el total (detail.total), mostrem o
// amaguem la ranura. La PRIMERA revelació crea l'iframe UNA sola vegada
// (mateix patró que renderIframe de slides.js); les següents només mostren/
// amaguen el contenidor — l'iframe no es recrea mai (P-26). L'entrada s'anima
// per CSS (opacitat + escala SOBRE la ranura, que NO és una capa del
// compositor): la tècnica només escriu els seus canals --px-ar-* i canvia
// classes, mai style.transform. Amb reduced-motion apareix sense transició.
const appReveal = {
  id: 'app-reveal',
  nom: 'Aparición de app',
  descripcio: 'La app entra en escena al alcanzar una frase concreta: el iframe se crea una sola vez y a partir de ahí solo se muestra u oculta, con una animación de aparición (escala y opacidad) que respeta reduce-motion.',
  moviment: false,
  params: [
    { key: 'fraseAparicio', label: 'Frase de aparición', min: 1,   max: 8,   step: 1,    def: 3 },
    { key: 'escalaInicial', label: 'Escala inicial',      min: 0.6, max: 1,   step: 0.05, def: 0.85 },
    { key: 'durada',        label: 'Duración',            min: 0.2, max: 1.5, step: 0.1,  def: 0.6, unit: 's' },
  ],
  apply(slideEl, cfg, ctx) {
    appReveal.cleanup(slideEl);                        // idempotent: neteja abans de re-armar (regla 4)
    const slot = slideEl.querySelector('.parallax-app-slot');
    if (!slot) return;                                 // sense ranura (Lab A) → no-op net (regla 8)

    const fraseAparicio = cfg.fraseAparicio ?? 3;
    const escalaInicial = cfg.escalaInicial ?? 0.85;
    const durada = cfg.durada ?? 0.6;
    const dataApp = slot.dataset.app || '';

    // Canals propis a la ranura (no és capa del compositor: el transform amb
    // l'escala es recompon al CSS de la tècnica). NO toquem --px-ar-aspect,
    // que el fixa el motor a la creació de la ranura.
    slot.style.setProperty('--px-ar-scale', escalaInicial.toFixed(3));
    slot.style.setProperty('--px-ar-dur', `${durada}s`);
    slot.classList.add('px-ar-armed');                 // marca la ranura com a gestionada (estat base d'entrada)

    // La ranura pot dur ja un iframe d'un apply anterior (P-26: no es recrea).
    // El DOM és la font de veritat perquè un re-apply no en dupliqui cap.
    const st = { unsub: null, slot, iframe: slot.querySelector('iframe') || null, revelat: false };

    const revela = (animar) => {
      if (st.revelat) return;                          // ja visible → res a re-animar
      st.revelat = true;
      if (!st.iframe && dataApp) {                     // PRIMERA revelació: crea l'iframe un sol cop
        const iframe = document.createElement('iframe');
        iframe.src = `../Apps/${dataApp}/index.html?embed=true`;  // mateix patró que renderIframe (slides.js)
        iframe.title = dataApp;
        iframe.loading = 'lazy';
        slot.appendChild(iframe);
        st.iframe = iframe;
      }
      slot.hidden = false;
      // Un reflow entre mostrar la ranura i afegir .px-ar-on fa arrencar la
      // transició des de l'estat base (opac 0, escala inicial). Sense reflow
      // —restauració per re-apply o reduced-motion— la classe s'aplica en sec
      // (no es pot transicionar des de display:none): apareix sense animar.
      if (animar && !ctx.reduced) void slot.offsetWidth;
      slot.classList.add('px-ar-on');
    };
    const amaga = () => {
      if (!st.revelat) return;
      st.revelat = false;
      slot.classList.remove('px-ar-on');
      slot.hidden = true;                              // amaga en sec; l'iframe queda dins (P-26)
    };
    // Llindar tal com marca l'spec: min(fraseAparicio, última frase) perquè
    // l'app aparegui encara que fraseAparicio superi el nombre de frases.
    const avalua = (active, total, animar) => {
      if (active >= Math.min(fraseAparicio, total - 1)) revela(animar);
      else amaga();
    };

    st.unsub = ctx.onProgress((t, d) => {
      // Actuem només amb un detail complet (active/total): el motor sempre el
      // passa; una crida sense detail (arnès mínim) queda com a no-op segur.
      if (!d || typeof d.active !== 'number' || typeof d.total !== 'number') return;
      ultimProgresAR.set(slideEl, { active: d.active, total: d.total });
      avalua(d.active, d.total, true);                 // revelació per gest → animada
    });
    estatAR.set(slideEl, st);

    // Restauració: si ja s'havia navegat (re-apply per canvi de slider),
    // recupera l'estat de revelació amb el NOU llindar SENSE re-animar
    // (animar=false), perquè tocar un slider no re-dispari l'entrada. Al
    // primer wire no hi ha progrés recordat → la ranura queda amagada fins
    // al primer gest, i és aleshores quan s'anima.
    const last = ultimProgresAR.get(slideEl);
    if (last) avalua(last.active, last.total, false);
  },
  cleanup(slideEl) {
    const st = estatAR.get(slideEl);
    if (!st) return;                                   // apply mai cridat → no-op segur
    try { st.unsub?.(); } catch {}
    const { slot } = st;
    if (slot) {                                        // segur encara que el slide ja no sigui al DOM
      slot.classList.remove('px-ar-on', 'px-ar-armed');
      slot.hidden = true;                              // amaga la ranura (l'iframe hi pot quedar dins)
      slot.style.removeProperty('--px-ar-scale');
      slot.style.removeProperty('--px-ar-dur');
    }
    estatAR.delete(slideEl);
  },
};

// L'array que llegeixen el motor i el panell — les 15 tècniques completes,
// en l'ordre canònic que fixa l'ordre d'aplicació (i de pintat dels overlays).
export const TECNIQUES = [
  scrollDepth,
  multiSpeed,
  mouseTilt,
  floatDrift,
  depthBlur,
  colorShift,
  rotateProgress,
  zoomDrift,
  inertia,
  gradientDrift,
  maskZoom,
  textReveal,
  marquee,
  spotlight,
  appReveal,
];

// ── Validació del contracte ──────────────────────────────────────────────
// Usada pel test de contracte i disponible per a la verificació manual.
// Retorna una llista d'errors (buida si la tècnica és vàlida).
export function validaTecnica(t) {
  const errors = [];
  const err = (m) => errors.push(`${t?.id ?? '(sense id)'}: ${m}`);
  if (!t || typeof t !== 'object') return ['tècnica no és un objecte'];
  if (typeof t.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) err('id ha de ser kebab-case');
  if (typeof t.nom !== 'string' || !t.nom.trim()) err('nom buit');
  if (typeof t.descripcio !== 'string' || !t.descripcio.trim()) err('descripcio buida');
  if (typeof t.moviment !== 'boolean') err('moviment ha de ser boolean');
  if (!Array.isArray(t.params)) err('params ha de ser un array');
  else t.params.forEach((p, i) => {
    const pe = (m) => err(`params[${i}] (${p?.key ?? '?'}): ${m}`);
    if (typeof p.key !== 'string' || !p.key) pe('key buida');
    if (typeof p.label !== 'string' || !p.label) pe('label buida');
    for (const camp of ['min', 'max', 'step', 'def']) {
      if (typeof p[camp] !== 'number' || !Number.isFinite(p[camp])) pe(`${camp} no és un número`);
    }
    if (typeof p.min === 'number' && typeof p.max === 'number' && p.min >= p.max) pe('min >= max');
    if (typeof p.step === 'number' && p.step <= 0) pe('step <= 0');
    if (typeof p.def === 'number' && typeof p.min === 'number' && typeof p.max === 'number'
        && (p.def < p.min || p.def > p.max)) pe('def fora de [min, max]');
  });
  if (typeof t.apply !== 'function') err('apply ha de ser una funció');
  if (typeof t.cleanup !== 'function') err('cleanup ha de ser una funció');
  return errors;
}

// Valida el registre sencer: contracte de cada tècnica + ids únics.
export function validaRegistre(llista = TECNIQUES) {
  const errors = llista.flatMap(validaTecnica);
  const ids = llista.map(t => t.id);
  const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
  dups.forEach(id => errors.push(`id duplicat: ${id}`));
  return errors;
}

// Valors per defecte d'una tècnica: { key: def }.
export function paramsPerDefecte(tech) {
  return Object.fromEntries((tech.params || []).map(p => [p.key, p.def]));
}
