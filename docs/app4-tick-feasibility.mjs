// Verificació de viabilitat d'alineació temporal (F6.scroll, App4).
// Model: una fracció n/d posa marques a temps t_k = k·n/d base-pulsos.
// El pentagrama BASE (pols) té marques a cada pols enter (0..Lg-1).
// Pregunta: hi ha prou punts COINCIDENTS perquè un formatter compartit
// "tanqui" l'alineació entre pentagrames? I el factor de tick comú és petit?

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;
const reduce = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };

// Cicle gran = mcm dels numeradors reduïts (model F3).
function bigCycle(fracs) {
  return fracs.map(([n, d]) => reduce(n, d)[0]).reduce(lcm, 1);
}

// Marques d'una fracció sobre Lg pulsos, en ticks enters (escala D = mcm de
// tots els denominadors → cada marca cau en tick enter; t_k·D = k·n·D/d).
function markTicks(n, d, Lg, D) {
  const count = Math.round((Lg * d) / n); // Lg·d/n marques (0..Lg-n/d)
  const out = new Set();
  for (let k = 0; k < count; k++) out.add((k * n * D) / d);
  return out;
}

// Base (pols): marques a cada enter 0..Lg-1 → ticks múltiples de D.
function baseTicks(Lg, D) {
  const out = new Set();
  for (let i = 0; i < Lg; i++) out.add(i * D);
  return out;
}

function analyze(label, fracs) {
  const bc = bigCycle(fracs);
  const Lg = bc; // m=1: una volta de cicle gran (cas representatiu)
  const D = fracs.map(([, d]) => d).reduce(lcm, 1); // ticks/pols comú
  const base = baseTicks(Lg, D);
  const sets = fracs.map(([n, d]) => markTicks(n, d, Lg, D));

  // Coincidència amb la BASE (l'àncora): quantes marques de cada fracció
  // cauen sobre un pols enter.
  const withBase = sets.map((s, i) => {
    let c = 0; for (const t of s) if (base.has(t)) c++;
    return { frac: fracs[i], coincBase: c, total: s.size };
  });

  // Coincidència fracció↔fracció (parelles).
  const pairCoinc = [];
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      let c = 0; for (const t of sets[i]) if (sets[j].has(t)) c++;
      pairCoinc.push({ a: fracs[i], b: fracs[j], coinc: c });
    }

  // Tots els pentagrames (base + fraccions) comparteixen el tick 0 i els
  // múltiples de cicle gran? (punts on TOT coincideix)
  const allSets = [base, ...sets];
  let universal = 0;
  for (const t of base) if (allSets.every((s) => s.has(t))) universal++;

  console.log(`\n=== ${label}  [${fracs.map(f => f.join('/')).join(', ')}] ===`);
  console.log(`  cicle gran=${bc}  Lg(m=1)=${Lg}  D(ticks/pols)=${D}  distinct-ticks≈${new Set([...base, ...sets.flatMap(s => [...s])]).size}`);
  withBase.forEach(w => console.log(`  ${w.frac.join('/')}: ${w.coincBase}/${w.total} marques sobre pols enter (àncora amb base)`));
  pairCoinc.forEach(p => console.log(`  ${p.a.join('/')} ∩ ${p.b.join('/')} = ${p.coinc} marques coincidents`));
  console.log(`  punts on coincideixen TOTS (base+fraccions) = ${universal}`);
}

// Casos representatius (incloent els "difícils" amb pocs punts compartits).
analyze('simple+lenta', [[1, 4], [3, 2]]);
analyze('2 contra 3', [[3, 2], [2, 3]]);
analyze('septuplet sol', [[1, 7]]);
analyze('5 i 6 (cicle gran 30 — fora límit si m≥1? 30≤210 ok)', [[5, 4], [6, 5]]);
analyze('5,6,7 PITJOR CAS (cicle gran 210)', [[5, 2], [6, 5], [7, 3]]);
analyze('triple compatible', [[1, 4], [3, 2], [2, 3]]);
analyze('coprimers durs', [[5, 7], [6, 7]]);
analyze('1/12 dens + 1/2', [[1, 12], [1, 2]]);
