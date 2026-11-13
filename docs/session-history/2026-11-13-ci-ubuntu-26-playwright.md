# 2026-11-13 — CI: Playwright 1.65.0 i actions v7 per tornar a `ubuntu-latest`

Solució definitiva per al job `smoke` que es va trencar quan `ubuntu-latest` va
passar a Ubuntu 26.04. Commit `d838700e`, a main.

## Context

- El 13/11 el job `smoke` va fallar (run de `e8e21817`): Playwright 1.56.1 no
  instal·la Chromium a Ubuntu 26.04 («Playwright does not support chromium on
  ubuntu26.04-x64»).
- Pedaç ràpid el mateix matí: `d56ced5d` fixava els dos jobs a `ubuntu-24.04`.
- GitHub també avisava que `actions/checkout@v4` i `actions/setup-node@v4`
  corren amb Node 20, que està deprecat.

## Què s'ha fet

- `package.json`: `playwright` 1.56.1 → **1.65.0** (fixat exacte, com abans).
  És l'última estable (5/11/2026). Ho he comprovat al codi de `playwright-core`:
  la 1.65.0 té les descàrregues de Chromium i els paquets apt per a
  `ubuntu26.04-x64`, i la 1.56.1 només arribava a `ubuntu24.04-x64`.
- `package-lock.json` regenerat amb `npm install`. Diff petit: només canvien
  `playwright` i `playwright-core`. Ara demanen Node ≥ 20 i ja no porten
  `fsevents` opcional.
- `.github/workflows/test.yml`:
  - `actions/checkout@v7` i `actions/setup-node@v7`, les dues amb `node24`.
    Els canvis trencadors de les v7 no ens afecten: checkout bloqueja els PR de
    forks amb `pull_request_target`/`workflow_run`, i setup-node canvia
    `NODE_AUTH_TOKEN`. No fem servir cap de les dues coses.
  - Els dos jobs tornen a `runs-on: ubuntu-latest`. Fora el comentari del fixat
    a 24.04.

## Validació

- Local (Mac, Node 24): `npm run smoke:setup` instal·la el Chromium 1254.
  `npm run smoke` dona 42/42 pàgines sense errors (20,5 s). `npm test` passa
  sencer: 100 suites i 1620 tests.
- CI: https://github.com/PlayNuzic/Lab/actions/runs/43434959947 en verd. Tots
  dos jobs corren a la imatge `ubuntu-26.04`. `smoke` baixa Chrome for Testing
  158.0.8127.18 (chromium v1254). `jest` passa 1620/1620.
- Ja no surt l'avís de Node 20. Només queda la nota informativa de GitHub que
  diu que `ubuntu-latest` migra a Ubuntu 26, i no cal fer-hi res.

## Per recordar

- Per trobar el run d'un commit, `gh run list --commit <sha curt>` no va trobar
  res. Cal el SHA sencer, o bé `gh run list --workflow test` i agafar el
  `databaseId`.

## Risc obert: el Chromium de les sessions al núvol

La 1.56.1 es va triar el 29/09 perquè coincidia amb el Chromium que porten
instal·lat les sessions de Claude Code al núvol (commit `ef94d881`; acta
`2026-09-29-arnes-p1-hooks.md`, P2). Amb la 1.65.0, `npm run smoke` al núvol
necessita el Chromium 1254. Si aquell entorn no el té i no el pot baixar,
`tests/smoke.mjs` sortirà amb «Falta el Chromium de la versió de Playwright
del projecte». No ho he pogut comprovar des del Mac. La CI i el Mac no es veuen
afectats, perquè tots dos l'instal·len.

Possible solució, sense fer: que `.claude/hooks/session-start.sh` també executi
`npx playwright install chromium` quan `CLAUDE_CODE_REMOTE=true`. Només
funcionarà si la xarxa del núvol deixa baixar de `cdn.playwright.dev`. Cal
provar-ho en una sessió al núvol.
