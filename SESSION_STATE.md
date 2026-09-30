# SESSION_STATE

## Tasca activa (no és codi del Lab)

**Mapa arquitectònic global de Nuzic/PlayNuzic** (encàrrec de direcció, 2026-09-21).
No toca cap fitxer del repo. L'estat de represa, les fases i els dossiers de recerca
viuen FORA del repo (és públic): `~/Documents/Nuzic/Mapa Nuzic/ESTAT.md` — llegeix-lo
primer i continua per la primera fase no tancada.
Estat a 28/09/2026 (vespre): versió breu (v2) feta i corregida; la v1 és la versió completa. Pendent de més comentaris de l'Albert i de la publicació.

## Codi del Lab

Tasca activa: **Retocs a les apps del SI** (2026-09-30), en curs. Acta que es va
omplint: `docs/session-history/2026-09-30-retocs-apps-si.md`. Fet: App9 (paso 3),
pastilla de BPM visible; App11A (paso 2), tempo aleatori 80-150.

Última tasca completada: **Arnès de Claude Code** (2026-09-29), tancada del tot: Lab
(https://github.com/PlayNuzic/Lab/pull/1, i `9eb3905` des del Mac per un `.DS_Store` a
`.claude/skills/`) i Alberton-projects
(https://github.com/Alberton-projects/alberton_devices-for-live/pull/1,
https://github.com/Alberton-projects/alberton_mcp-for-live/pull/1), totes fusionades amb la
CI en verd. Acta: `docs/session-history/2026-09-29-arnes-p1-hooks.md`.

Anterior: **Pre-test del test d'usuari: guia, Zoom, Google Forms (script),
segments de Clarity, guions v5 per passos i guió del pre-test PP-01** (2026-09-23), sense
canvis de codi. Acta:
`docs/session-history/2026-09-23-pretest-zoom-forms-clarity.md`.
Anteriors, amb codi: el mateix dia, imatges lligades a frases
(`docs/session-history/2026-09-23-imatges-lligades-a-frases.md`) i intro, coda i presets
unificats (`docs/session-history/2026-09-23-intro-coda-i-presets-unificats.md`); el
2026-09-21, imatge com a frase (`docs/session-history/2026-09-21-imatge-com-a-frase.md`) i
coda amb CTA (`docs/session-history/2026-09-21-coda-cta-enllacos.md`). Test d'usuari v3
(2026-09-15): `docs/session-history/2026-09-15-test-usuari-v3-embut-continuacio.md`.

## Pendent

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
