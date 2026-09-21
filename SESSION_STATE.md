# SESSION_STATE

Cap tasca activa.

Última tasca completada: **Intro (paso 1) i coda (paso 29) reescrites, amb les
3 CTA enllaçades; els textos desats al navegador deixen de tapar-les
(OVERRIDES_VERSION 8)** (2026-09-21). Acta:
`docs/session-history/2026-09-21-coda-cta-enllacos.md`.
Anterior: test d'usuari v3 — documents i embut «Continuacion en frio» a Clarity
(2026-09-15), sense canvis de codi, acta
`docs/session-history/2026-09-15-test-usuari-v3-embut-continuacio.md`.
Suite: 92/1536.

## Pendent

- **Push**: main va per davant d'origin (intro i coda noves, CTA amb enllaços,
  i la migració v8 que descarta els textos desats al navegador).
- **Tips del paso 12**: el títol «Prueba los Intervalos Temporales» és heretat
  del paso 8 (detectat a la revisió del 2026-09-16, acta del test v3).

Tancats el 2026-08-31 amb la prova a l'altre ordinador: ratolí amb
cremallera i tàctil ("prou bé"), paso 2 i el seu títol, `mida: 1` de l'app
del paso 2 (es manté), App11 al 700 (els plànols queden semblants: App11 no
té editor), coda tal com està. Fets després: "sucesión" → "secuencia" a
`Apps/` i `libs/` (51 llocs, 29 fitxers: títols d'app, catàleg
Apps/index.html, comentaris) i paso 11 sense app (fora `apps`/`aspect` de
la matriu i l'entrada app-reveal del PRESET).

Pendents del motor de so (auditoria 2026-07-06), decidits el 2026-08-31:
- **A-03 + T-04** (ear-training, dorment): es deixa com està.
- **A-10** (`align: 'cycle'`): **RETIRAT** — cap app el passava (les 9-35 van
  per `updateTransport` amb `'nextPulse'`) i tenia dues semàntiques
  divergents entre fils. Qualsevol `align` que no sigui `'immediate'` cau a
  `'nextPulse'`. Nivell 1, diff aprovat per l'usuari.
- **A-05 risc 2** (comptabilitat melòdica): revisat, **no tocar**. L'únic
  efecte és que, després d'un final natural + `play()` immediat + canvi de
  tempo dins la primera finestra, es tallen notes residuals de la seqüència
  anterior que encara no havien començat — cas estretíssim i defensable;
  arreglar-ho vol etiquetar veus per sessió al hot path del SamplerPool.
- **A-08** (instruments melòdics post context 'closed'): **no tocar ara**.
  El rítmic ja es recupera i `setInstrument()` ja re-alinea piano/flauta
  quan torna a cridar-se; el forat és només si l'app no el torna a cridar.
  'closed' només el provoca un WebView Android (escriptori mai; iOS fa
  suspended/interrupted, gestionat): no es pot provar, i el fix toca el
  camí de reproducció de 16 apps. Reobrir si un dispositiu real mostra
  "Play visible però mut".
