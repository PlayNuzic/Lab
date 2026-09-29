// Test de fum al navegador: carrega cada pàgina del Lab en Chromium headless i falla
// si hi ha errors de JS, errors de consola o recursos locals que no carreguen.
// Cobreix el que Jest no veu: els main.js de les apps, imports trencats, HTML que
// apunta a fitxers que no existeixen.
//
//   npm run smoke                 # totes les pàgines
//   npm run smoke -- App15 App32  # només les que continguin aquests noms
//
// Primera vegada en local: npx playwright install chromium
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};
// Temps perquè els imports dinàmics i els setTimeout d'inicialització acabin.
const SETTLE_MS = 400;

function pages() {
  const apps = fs.readdirSync(path.join(ROOT, 'Apps'))
    .filter((d) => fs.existsSync(path.join(ROOT, 'Apps', d, 'index.html')))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((d) => `/Apps/${d}/`);
  const all = ['/', '/Apps/', '/sistema/', ...apps];
  const filters = process.argv.slice(2);
  return filters.length ? all.filter((p) => filters.some((f) => p.includes(f))) : all;
}

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function check(browser, origin, route) {
  const page = await browser.newPage();
  const errors = [];
  const local = (url) => url.startsWith(origin);
  const short = (url) => url.replace(origin, '');
  // Fora de xarxa: resultats deterministes (analítica, fonts externes…).
  await page.route((url) => !local(url.href), (r) => r.abort());
  page.on('pageerror', (e) => errors.push(`error JS: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Les peticions externes avortades per nosaltres surten com a errors de xarxa.
    if (/net::ERR_FAILED|ERR_BLOCKED/.test(text) && !text.includes(origin)) return;
    errors.push(`consola: ${text}`);
  });
  page.on('response', (r) => { if (local(r.url()) && r.status() >= 400) errors.push(`${r.status()}: ${short(r.url())}`); });
  page.on('requestfailed', (r) => { if (local(r.url())) errors.push(`no carrega: ${short(r.url())}`); });
  try {
    await page.goto(origin + route, { waitUntil: 'load', timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);
  } catch (e) {
    errors.push(`goto: ${e.message.split('\n')[0]}`);
  }
  await page.close();
  return [...new Set(errors)];
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const routes = pages();
const t0 = Date.now();
let failed = 0;
try {
  for (const route of routes) {
    const errors = await check(browser, origin, route);
    if (!errors.length) continue;
    failed++;
    console.log(`✗ ${route}`);
    for (const e of errors.slice(0, 8)) console.log(`    ${e}`);
  }
} finally {
  await browser.close();
  server.close();
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n${routes.length - failed}/${routes.length} pàgines sense errors (${secs} s)`);
process.exit(failed ? 1 : 0);
