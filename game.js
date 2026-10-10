// Venture Bomb — game logic. Every test outcome is drawn from pools.json, which
// holds real Qiskit shots (see generate_pools.py). The browser never decides
// an outcome itself; animation only illustrates the outcome it was handed.
(() => {
'use strict';

// ---------- levels ----------
const LEVELS = {
  1: { name: 'Classical', mode: 'zeno', pool: 'zeno', minN: 1, maxN: 1, defN: 1, budget: null,
       learn: 'Only one step is allowed: the photon goes straight onto the bomb path. Every live bomb explodes. That is the problem.' },
  2: { name: 'Interferometer', mode: 'basic', pool: 'basic', budget: null,
       learn: 'H splits the photon, the bomb checks, H recombines. A dud always reads 0, so reading 1 proves a live bomb without touching it. Retest anything that reads 0.' },
  3: { name: 'Patience', mode: 'zeno', pool: 'zeno', minN: 2, maxN: 15, defN: 5, budget: 40,
       learn: 'Split the test into N small steps. More checks freeze the photon on the safe path (the Zeno effect), but each step costs energy.' },
  4: { name: 'Real lab', mode: 'zeno', pool: 'noisy', noisy: true, minN: 2, maxN: 50, defN: 10, budget: 120,
       learn: 'Noise is on: every step can nudge the photon. Too many steps let noise in, so there is a best N. Labels can now be wrong, and wrong labels cost 20.' },
};
const CRATE_SIZE = 5;
const PTS = { live: 10, dud: 3, boom: -15, wrong: -20 };

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tween = (ms, fn) => new Promise(res => {
  if (reduce) { fn(1); return res(); }
  const t0 = performance.now();
  const step = now => { const t = Math.min(1, (now - t0) / ms); fn(t); t < 1 ? requestAnimationFrame(step) : res(); };
  requestAnimationFrame(step);
});
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
const pad = n => String(n).padStart(2, '0');
const theorySafe = N => N === 'basic' ? 0.25 : Math.pow(Math.cos(Math.PI / (2 * N)), 2 * N);
const announce = text => { $('status').textContent = text; };

// ---------- shot pools ----------
let data = null;
const cursor = {};
function poolFor(level, n, isLive) {
  const L = LEVELS[level], kind = isLive ? 'live' : 'dud';
  return L.pool === 'basic' ? data.pools.basic[kind] : data.pools[L.pool][String(n)][kind];
}
function drawShot(level, n, isLive) {
  const pool = poolFor(level, n, isLive);
  const key = `${LEVELS[level].pool}-${n}-${isLive ? 'live' : 'dud'}`;
  // Start at a random point, then walk the pool in order: real shots, real statistics
  const i = cursor[key] ?? Math.floor(Math.random() * pool.length);
  cursor[key] = (i + 1) % pool.length;
  return pool[i];
}
const poolRate = (level, n) => { const p = poolFor(level, n, true); return [...p].filter(c => c === 'L').length / p.length; };

// ---------- state ----------
let state;
function newCrate(level, no = 1) {
  const L = LEVELS[level];
  return {
    level, no, pts: 0, cur: 0, N: L.defN ?? 2, energy: L.budget, tests: 0, log: [], done: false,
    bombs: Array.from({ length: CRATE_SIZE }, () => ({ live: Math.random() < 0.5, status: 'sealed', label: null, tests: [] })),
  };
}
const isOpen = b => b.status === 'sealed' || b.status === 'unknown';

// ---------- tabs ----------
document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
function showView(v) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  $('view-play').hidden = v !== 'play';
  $('view-about').hidden = v !== 'about';
}
if (location.hash === '#about') showView('about');

// ---------- crate ----------
function bombIcon(b, reveal) {
  const look = {
    sealed: ['#2b3440', '?', '#e4eaf1'], unknown: ['#3a3220', '?', '#ffb547'],
    live: ['#1f3a2e', '✓', '#62d49e'], dud: ['#222a33', '∅', '#9aa7b8'],
    boom: ['#4a2412', '✸', '#ff8a1f'], aside: ['#222a33', '–', '#9aa7b8'],
  }[b.status];
  let [body, mark, col] = look;
  if (reveal && b.status !== 'boom' && b.label !== null && b.label !== b.live) { col = '#ff8a1f'; mark = '!'; }
  return `<svg viewBox="-20 -24 40 44" aria-hidden="true"><path d="M5 -12 q6 -8 12 -5" fill="none" stroke="#b7a37a" stroke-width="2"/><rect x="1" y="-16" width="8" height="6" rx="1.5" fill="#56626f"/><circle r="14" fill="${body}" stroke="#56626f" stroke-width="2"/><text y="5" text-anchor="middle" style="font:700 14px ui-monospace,monospace;fill:${col}">${mark}</text></svg>`;
}
function bombLabel(b, reveal) {
  const base = { sealed: 'untested', unknown: 'inconclusive', live: 'live', dud: 'dud', boom: 'boom', aside: 'set aside' }[b.status];
  if (!reveal || b.status === 'boom') return base;
  if (b.label !== null && b.label !== b.live) return `${base}: wrong`;
  if (b.status === 'aside' || b.status === 'unknown') return `${base} · was ${b.live ? 'live' : 'dud'}`;
  return base;
}
function renderCrate() {
  const el = $('crate');
  const focusedBomb = el.contains(document.activeElement) ? document.activeElement.id : null;
  el.innerHTML = '';
  state.bombs.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.id = 'bomb-' + i;
    btn.setAttribute('aria-current', String(i === state.cur));
    const lab = bombLabel(b, state.done);
    btn.setAttribute('aria-label', `Bomb ${i + 1}: ${lab}`);
    btn.innerHTML = bombIcon(b, state.done) + `<span>№${pad(i + 1)}</span><span class="st st-${b.status}">${lab}</span>`;
    btn.addEventListener('click', () => { if (busy) return; state.cur = i; msg = null; render(); });
    el.appendChild(btn);
  });
  if (focusedBomb) $(focusedBomb)?.focus();
  const left = state.bombs.filter(isOpen).length;
  $('crateTitle').textContent = `Crate ${state.no}`;
  $('crateLeft').textContent = state.done ? 'crate closed' : `${left} of ${CRATE_SIZE} still open`;
}

// ---------- render ----------
let msg = null, busy = false;
function render() {
  const L = LEVELS[state.level];
  for (let k = 1; k <= 4; k++) $('lvl-' + k).setAttribute('aria-pressed', String(k === state.level));
  $('levelName').textContent = `Level ${state.level} · ${L.name}`;
  $('learn').textContent = L.learn;
  const basic = L.mode === 'basic';
  $('mzi').toggleAttribute('hidden', !basic);
  $('zeno').toggleAttribute('hidden', basic);
  $('rigTitle').textContent = basic ? 'Basic tester: H, check, H' : 'Zeno tester: photon state dial';
  $('rigSub').textContent = basic ? 'bomb on path 1' : `N = ${state.N} · ${(90 / state.N).toFixed(1)}° per step`;

  // N slider and energy
  $('nField').hidden = basic || L.maxN === L.minN;
  if (!basic) {
    const s = $('nSlider');
    s.min = L.minN; s.max = L.maxN; s.value = state.N; s.disabled = busy;
    $('nVal').textContent = state.N;
    $('nCost').textContent = L.budget ? state.N : 0;
    $('nTheory').textContent = data && L.noisy ? `${pct(poolRate(state.level, state.N), 0)} in noisy pool` : pct(theorySafe(state.N));
  }
  $('energy').hidden = !L.budget;
  if (L.budget) {
    $('energyVal').textContent = `${state.energy} / ${L.budget}`;
    $('energyBar').style.width = (100 * state.energy / L.budget) + '%';
  }

  renderCrate();
  const b = state.bombs[state.cur];
  const cost = L.budget ? state.N : 0;
  $('testBtn').disabled = !data || busy || state.done || !isOpen(b) || (L.budget && cost > state.energy);
  $('asideBtn').disabled = busy || state.done || !isOpen(b);
  $('testBtn').textContent = L.budget && cost > state.energy && !state.done ? `Needs ${cost} energy` : `Test bomb №${pad(state.cur + 1)}`;

  const m = msg || defaultMsg(b);
  $('msg').className = 'msg ' + (m.cls || '');
  $('msg').innerHTML = `<b>${m.title}</b>${m.text}`;

  $('sPts').textContent = state.pts;
  $('sLive').textContent = state.bombs.filter(x => x.status === 'live').length;
  $('sBoom').textContent = state.bombs.filter(x => x.status === 'boom').length;
  $('sTests').textContent = state.tests;
  $('log').innerHTML = state.log.slice().reverse().map(e => `<li><span>${e.at}</span><span>${e.text}</span></li>`).join('');
  renderExplain();
  renderSummary();
}
function defaultMsg(b) {
  if (state.done) return { title: 'Crate closed', text: 'See the summary under the score.' };
  const n = state.cur + 1;
  switch (b.status) {
    case 'live': return { cls: 'ok', title: 'Live, proven safely', text: `Bomb №${pad(n)} is labelled live.` };
    case 'dud': return { title: 'Dud', text: `Bomb №${pad(n)} is labelled a dud and cleared.` };
    case 'boom': return { cls: 'boom', title: 'Lost', text: `Bomb №${pad(n)} exploded during its test.` };
    case 'aside': return { title: 'Set aside', text: `Bomb №${pad(n)} was set aside untested. It scores nothing either way.` };
    case 'unknown': return { cls: 'click', title: 'Inconclusive', text: 'Test again, or set it aside.' };
  }
  return { title: 'Ready', text: `Bomb №${pad(n)} is sealed. Press Test to send one photon through.` };
}

// ---------- explain panel ----------
function renderExplain() {
  const L = LEVELS[state.level];
  if (data) {
    const m = data.meta;
    $('source').textContent = L.noisy
      ? `Results from ${m.shots_per_pool} Qiskit shots per pool on ${m.noisy_backend}. Generated ${m.generated}.`
      : `Results from ${m.shots_per_pool} Qiskit shots per pool on ${m.backend}. Generated ${m.generated}.`;
  }
  $('circuit').innerHTML = L.mode === 'basic' ? circuitBasic() : L.noisy ? circuitMid(state.N) : circuitZeno(state.N);

  let dud, live, labels;
  if (L.mode === 'basic') {
    labels = ['after H', 'after check', 'after H'];
    dud = [0.5, 0.5, 0];
    live = [0.5, 0, 0.5];
  } else {
    const N = state.N, s2 = Math.sin(Math.PI / (2 * N)) ** 2;
    labels = Array.from({ length: N }, (_, k) => `step ${k + 1}`);
    dud = labels.map((_, k) => Math.sin((k + 1) * Math.PI / (2 * N)) ** 2);
    live = labels.map(() => s2);
  }
  const bars = arr => arr.map((p, k) => `<div title="${labels[k]}: ${pct(p, 1)} on path 1"><i style="height:${p * 100}%"></i></div>`).join('');
  const liveLabel = L.mode === 'basic' ? 'Live bomb, no explosion' : 'Live bomb, before each check';
  $('probs').innerHTML =
    `<div class="row"><span>Dud</span><div class="bars" role="img" aria-label="Dud: chance on bomb path ${dud.map(p => pct(p, 0)).join(', ')}">${bars(dud)}</div></div>` +
    `<div class="row"><span>${liveLabel}</span><div class="bars" role="img" aria-label="Live: chance on bomb path ${live.map(p => pct(p, 0)).join(', ')}">${bars(live)}</div></div>`;

  if (L.mode === 'basic') {
    $('theory').textContent = 'A dud ends on path 0 every time, so it always reads 0. A live bomb explodes half the time; otherwise the photon is on path 0 and the last H gives a coin flip. Safe proof: 25% per test, about 33% with retests.';
  } else {
    const p = theorySafe(state.N);
    $('theory').textContent = `Each live check finds the bomb path with chance sin²(π/2N) = ${pct(Math.sin(Math.PI / (2 * state.N)) ** 2, 2)}. Surviving all ${state.N} gives cos^${2 * state.N}(π/${2 * state.N}) = ${pct(p)} safe proofs.` +
      (L.noisy && data ? ` The noisy pool gives ${pct(poolRate(state.level, state.N))}.` : '');
  }
}
const W = (x1, y, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#3a4a5e"/>`;
const gate = (x, y, t, w = 30) => `<rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="22" rx="3" fill="#1d2733" stroke="#9fb4c9"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="fill:#e4eaf1">${t}</text>`;
const meas = (x, y, dashed) => `<rect x="${x - 12}" y="${y - 11}" width="24" height="22" rx="3" fill="#1d2733" stroke="#ffb547" ${dashed ? 'stroke-dasharray="3 2"' : ''}/><path d="M${x - 7} ${y + 5} a7 7 0 0 1 14 0" fill="none" stroke="#ffb547"/><line x1="${x}" y1="${y + 5}" x2="${x + 6}" y2="${y - 5}" stroke="#ffb547"/>`;
const cnot = (x, y1, y2) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#ff4a3d" stroke-dasharray="4 3"/><circle cx="${x}" cy="${y1}" r="4" fill="#ff4a3d"/><circle cx="${x}" cy="${y2}" r="8" fill="none" stroke="#ff4a3d"/><line x1="${x - 8}" y1="${y2}" x2="${x + 8}" y2="${y2}" stroke="#ff4a3d"/><line x1="${x}" y1="${y2 - 8}" x2="${x}" y2="${y2 + 8}" stroke="#ff4a3d"/>`;
const svgWrap = (w, h, body, cap) => `<svg width="${w}" height="${h + 22}" viewBox="0 0 ${w} ${h + 22}" role="img" aria-label="${cap}">${body}<text x="10" y="${h + 14}">${cap}</text></svg>`;
function circuitBasic() {
  const y0 = 26, y1 = 62, w = 340;
  let s = W(70, y0, w - 20) + W(70, y1, w - 20);
  s += `<text x="10" y="${y0 + 4}">q0 photon</text><text x="10" y="${y1 + 4}">q1 bomb</text>`;
  s += gate(110, y0, 'H') + cnot(170, y0, y1) + gate(230, y0, 'H') + meas(295, y0) + meas(295, y1);
  return svgWrap(w, 80, s, 'Red CNOT only if the bomb is live');
}
function circuitZeno(N) {
  const dy = 22, top = 22, step = 54, x0 = 96, w = x0 + N * step + 50, h = top + N * dy + 14;
  let s = '';
  for (let q = 0; q <= N; q++) { s += W(70, top + q * dy, w - 14); s += `<text x="10" y="${top + q * dy + 4}">${q ? 'q' + q + ' check' : 'q0 photon'}</text>`; }
  for (let k = 0; k < N; k++) { const x = x0 + k * step; s += gate(x, top, 'ry') + cnot(x + 26, top, top + (k + 1) * dy); }
  for (let q = 0; q <= N; q++) s += meas(w - 30, top + q * dy);
  return svgWrap(w, h, s, `ry(π/${N}) on q0, N times. Red CNOTs only if the bomb is live. ${N + 1} qubits.`);
}
function circuitMid(N) {
  const y = 28, step = 62, x0 = 96, w = x0 + N * step + 50;
  let s = W(70, y, w - 14) + `<text x="10" y="${y + 4}">q0 photon</text>`;
  for (let k = 0; k < N; k++) { const x = x0 + k * step; s += gate(x, y, 'ry') + meas(x + 30, y, true) + `<text x="${x + 30}" y="${y + 26}" text-anchor="middle">c${k}</text>`; }
  s += meas(w - 30, y) + `<text x="${w - 30}" y="${y + 26}" text-anchor="middle">c${N}</text>`;
  return svgWrap(w, 52, s, `One qubit, mid-circuit checks (dashed: only if live), noise after each ry. Scroll for all ${N} steps.`);
}

// ---------- animation ----------
const UP = [[150, 80], [450, 80], [450, 250]], LOW = [[150, 80], [150, 250], [450, 250]];
const BOMB_F = 320 / 470;
function along(pts, f) {
  const segs = [], total = pts.slice(1).reduce((t, p, i) => { const d = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); segs.push(d); return t + d; }, 0);
  let t = f * total;
  for (let i = 0; i < segs.length; i++) {
    if (t <= segs[i] || i === segs.length - 1) { const u = Math.min(1, t / segs[i]); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
    t -= segs[i];
  }
}
const dot = (id, x, y, o) => { const e = $(id); e.setAttribute('cx', x); e.setAttribute('cy', y); e.setAttribute('opacity', o); };
function resetRig() {
  ['phA', 'phB', 'burst', 'zBurst'].forEach(id => $(id).setAttribute('opacity', 0));
  $('detC').classList.remove('click'); $('detD').classList.remove('click');
  $('bombBody').setAttribute('fill', '#2b3440'); $('zBombBody').setAttribute('fill', '#2b3440');
  setArrow(0); $('zCycle').textContent = `0 / ${state.N}`;
}
async function burst(id, bodyId) {
  $(bodyId).setAttribute('fill', '#4a2412');
  const e = $(id);
  if (reduce) { e.setAttribute('r', 60); e.setAttribute('opacity', 0.6); return; }
  // one slow expanding burst, no strobing
  await tween(900, t => { e.setAttribute('r', 10 + 90 * t); e.setAttribute('opacity', 1 - t * 0.85); });
  e.setAttribute('opacity', 0);
}
async function animateBasic(outcome) {
  resetRig();
  await tween(350, t => dot('phA', 100 + 50 * t, 80, 1));
  await tween(850, t => { const f = t * BOMB_F; const a = along(UP, f), b = along(LOW, f); dot('phA', a[0], a[1], 0.55); dot('phB', b[0], b[1], 0.55); });
  if (outcome === 'B') { dot('phA', 0, 0, 0); dot('phB', 0, 0, 0); await burst('burst', 'bombBody'); return; }
  if (outcome === 'L') { $('phB').setAttribute('opacity', 0); await tween(150, t => $('phA').setAttribute('opacity', 0.55 + 0.45 * t)); }
  await tween(420, t => {
    const f = BOMB_F + t * (1 - BOMB_F), a = along(UP, f);
    dot('phA', a[0], a[1], outcome === 'L' ? 1 : 0.55);
    if (outcome !== 'L') { const b = along(LOW, f); dot('phB', b[0], b[1], 0.55); }
  });
  // outcome U: interference sends everything to the bright port. L: coin flip, landed on the dark port.
  await tween(420, t => {
    if (outcome === 'U') { dot('phA', 0, 0, 0); dot('phB', 450 + 110 * t, 250, 1); }
    else { dot('phB', 0, 0, 0); dot('phA', 450, 250 + 70 * t, 1); }
  });
  dot('phA', 0, 0, 0); dot('phB', 0, 0, 0);
  $(outcome === 'U' ? 'detC' : 'detD').classList.add('click');
}
function setArrow(ang) {
  const a = $('zArrow');
  a.setAttribute('x2', (130 * Math.cos(ang)).toFixed(2)); a.setAttribute('y2', (-130 * Math.sin(ang)).toFixed(2));
  $('zAngle').textContent = (ang * 180 / Math.PI).toFixed(1) + '°';
}
function drawTicks(N) {
  let s = '';
  for (let k = 1; k < N; k++) { const a = k * Math.PI / (2 * N); s += `<line x1="${(134 * Math.cos(a)).toFixed(1)}" y1="${(-134 * Math.sin(a)).toFixed(1)}" x2="${(146 * Math.cos(a)).toFixed(1)}" y2="${(-146 * Math.sin(a)).toFixed(1)}" stroke="#3a4a5e"/>`; }
  $('zTicks').innerHTML = s;
}
async function animateZeno(outcome, N) {
  resetRig();
  const th = Math.PI / (2 * N), per = Math.max(50, Math.min(320, 2400 / N));
  // For an explosion, pick which check caught it (illustration only; the outcome itself came from the pool).
  let boomAt = N;
  if (outcome === 'B') {
    const s2 = Math.sin(th) ** 2, w = Array.from({ length: N }, (_, k) => (1 - s2) ** k * s2), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; boomAt = 1;
    for (let k = 0; k < N; k++) { r -= w[k]; if (r <= 0) { boomAt = k + 1; break; } }
  }
  let ang = 0;
  for (let k = 1; k <= N; k++) {
    $('zCycle').textContent = `${k} / ${N}`;
    const from = ang, to = outcome === 'D' ? k * th : th;
    await tween(per * 0.6, t => setArrow(from + (to - from) * t));
    ang = to;
    if (outcome === 'B' && k === boomAt) { await burst('zBurst', 'zBombBody'); return; }
    if (outcome !== 'D') { await tween(per * 0.4, t => setArrow(ang * (1 - t))); ang = 0; }
  }
}

// ---------- testing ----------
function addLog(text) { state.log.push({ at: `№${pad(state.cur + 1)}`, text }); }
async function test() {
  const L = LEVELS[state.level], b = state.bombs[state.cur];
  if (busy || state.done || !isOpen(b)) return;
  const N = L.mode === 'basic' ? 'basic' : state.N;
  if (L.budget && state.N > state.energy) return;
  busy = true; msg = null; render();
  const shot = drawShot(state.level, N, b.live);
  if (L.budget) state.energy -= state.N;
  state.tests++;
  b.tests.push({ N, outcome: shot });
  if (L.mode === 'basic') await animateBasic(shot); else await animateZeno(shot, state.N);

  const n = pad(state.cur + 1), tag = L.mode === 'basic' ? 'basic' : `N=${state.N}`;
  const deferred = !!L.noisy;
  if (shot === 'B') {
    b.status = 'boom'; b.label = true; state.pts += PTS.boom;
    msg = { cls: 'boom', title: 'Boom', text: state.level === 1
      ? `With one step the photon goes straight onto the bomb path, so a live bomb always catches it. Classically, every test of a live bomb is an explosion (${PTS.boom}).`
      : `The bomb's check found the photon on its path. Bomb №${n} is lost (${PTS.boom}).` };
    addLog(`${tag} · boom ${PTS.boom}`);
  } else if (shot === 'L') {
    b.status = 'live'; b.label = true;
    if (!deferred) state.pts += PTS.live;
    msg = { cls: 'ok', title: L.mode === 'basic' ? 'Reads 1: live, proven safely' : 'Reads 0: live, proven safely', text: L.mode === 'basic'
      ? `A dud's two paths cancel at the dark port, so a 1 is impossible without a bomb. The photon took the safe path and never touched it (+${PTS.live}).`
      : `Every check found the safe path and snapped the photon back. A dud would have let it reach path 1.` + (deferred ? ' Noise can fake this, so the label is scored when the crate closes.' : ` (+${PTS.live})`) };
    addLog(`${tag} · live, proven safely` + (deferred ? ' (scored at end)' : ` +${PTS.live}`));
  } else if (shot === 'D') {
    b.status = 'dud'; b.label = false;
    if (!deferred) state.pts += PTS.dud;
    msg = { title: 'Reads 1: dud', text: `Nothing stopped the photon, so the steps added up to path 1. Cleared as a dud` + (deferred ? '. Noise can fake this too; scored when the crate closes.' : ` (+${PTS.dud}).`) };
    addLog(`${tag} · dud` + (deferred ? ' (scored at end)' : ` +${PTS.dud}`));
  } else {
    b.status = 'unknown';
    msg = { cls: 'click', title: 'Reads 0: inconclusive', text: 'Duds always read 0, and so do a quarter of live-bomb tests. Test again, or set it aside.' };
    addLog(`${tag} · reads 0, inconclusive`);
  }
  busy = false;
  afterAction(b, `Bomb ${state.cur + 1}: ${msg.title}. ${msg.text}`, true);
}
function setAside() {
  const b = state.bombs[state.cur];
  if (busy || state.done || !isOpen(b)) return;
  b.status = 'aside';
  addLog('set aside');
  msg = null;
  afterAction(b, `Bomb ${state.cur + 1} set aside.`);
}
function afterAction(b, said, fromTest = false) {
  const L = LEVELS[state.level], parts = [said];
  if (L.budget && state.energy < L.minN && state.bombs.some(isOpen)) {
    const n = state.bombs.filter(isOpen).length;
    state.bombs.filter(isOpen).forEach(x => { x.status = 'aside'; });
    state.log.push({ at: 'crate', text: 'Out of energy. Remaining bombs set aside.' });
    parts.push(`Out of energy: ${n} remaining bomb${n === 1 ? '' : 's'} set aside.`);
  }
  if (!state.bombs.some(isOpen)) parts.push(closeCrate());
  else if (!isOpen(b)) {
    const nxt = state.bombs.findIndex((x, i) => i > state.cur && isOpen(x));
    state.cur = nxt >= 0 ? nxt : state.bombs.findIndex(isOpen);
  }
  announce(parts.join(' '));
  render();
  // The Test button was disabled during the animation, which drops keyboard focus; put it back.
  if (fromTest && document.activeElement === document.body) {
    const t = $('testBtn');
    (t.disabled ? (state.done ? $('summary').querySelector('button') : $('bomb-' + state.cur)) : t)?.focus();
  }
}
function closeCrate() {
  state.done = true;
  if (LEVELS[state.level].noisy) {
    state.bombs.forEach(b => {
      if (b.status === 'live') state.pts += b.live ? PTS.live : PTS.wrong;
      if (b.status === 'dud') state.pts += b.live ? PTS.wrong : PTS.dud;
    });
  }
  const live = state.bombs.filter(b => b.live).length, proven = state.bombs.filter(b => b.status === 'live' && b.live).length;
  return `Crate closed with ${state.pts} points. ${proven} of ${live} live bombs proven safely.`;
}
function renderSummary() {
  const el = $('summary');
  if (!state.done) { el.hidden = true; return; }
  const liveTotal = state.bombs.filter(b => b.live).length;
  const proven = state.bombs.filter(b => b.status === 'live' && b.live).length;
  const boom = state.bombs.filter(b => b.status === 'boom').length;
  const wrong = state.bombs.filter(b => (b.status === 'live' || b.status === 'dud') && b.label !== b.live).length;
  // safe-proof rate per N on live bombs
  const byN = {};
  state.bombs.filter(b => b.live).forEach(b => b.tests.forEach(t => {
    const r = byN[t.N] ??= { tests: 0, safe: 0 };
    r.tests++; if (t.outcome === 'L') r.safe++;
  }));
  const keys = Object.keys(byN).sort((a, b) => (a === 'basic' ? 0 : +a) - (b === 'basic' ? 0 : +b));
  const noisy = !!LEVELS[state.level].noisy && !!data;
  const rows = keys.map(k => {
    const r = byN[k], N = k === 'basic' ? 'basic' : +k;
    return `<tr><td>${k === 'basic' ? 'basic' : 'N = ' + k}</td><td>${r.tests}</td><td>${r.safe}</td><td>${pct(r.safe / r.tests, 0)}</td><td>${pct(theorySafe(N))}</td>${noisy ? `<td>${pct(poolRate(state.level, N))}</td>` : ''}</tr>`;
  }).join('');
  el.hidden = false;
  el.innerHTML = `<h3>Crate ${state.no} closed · ${state.pts} pts</h3>
    <p>You proved ${proven} of ${liveTotal} live bomb${liveTotal === 1 ? '' : 's'} safely and ${boom} exploded.${LEVELS[state.level].noisy ? ` Noise put the wrong label on ${wrong} bomb${wrong === 1 ? '' : 's'}.` : ''} A classical tester proves 0 of ${liveTotal}.</p>
    ${keys.length ? `<div class="tablewrap"><table class="data"><thead><tr><th>Setting</th><th>live tests</th><th>safe</th><th>yours</th><th>theory</th>${noisy ? '<th>noisy pool</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
    <p style="color:var(--muted);font-size:13px">Theory is cos<sup>2N</sup>(π/2N) for an ideal simulator (25% for the basic tester). Five bombs is a small sample, so expect your rate to wander around it.</p>` : '<p style="color:var(--muted)">No live bombs were tested in this crate.</p>'}
    <div class="actions"><button class="btn fire" id="againBtn">New crate</button>${state.level < 4 ? `<button class="btn" id="nextBtn">Level ${state.level + 1}: ${LEVELS[state.level + 1].name}</button>` : ''}</div>`;
  $('againBtn').addEventListener('click', () => { startLevel(state.level, state.no + 1); });
  $('nextBtn')?.addEventListener('click', () => startLevel(state.level + 1));
}
function startLevel(level, no = 1) {
  state = newCrate(level, no);
  msg = null; drawTicks(state.N); resetRig(); render();
  announce(`Level ${level}: ${LEVELS[level].name}. ${LEVELS[level].learn}`);
}

$('testBtn').addEventListener('click', test);
$('asideBtn').addEventListener('click', setAside);
for (let k = 1; k <= 4; k++) $('lvl-' + k).addEventListener('click', () => { if (!busy) startLevel(k); });
$('nSlider').addEventListener('input', e => { if (busy) return; state.N = +e.target.value; drawTicks(state.N); resetRig(); render(); });

// ---------- project page: noise chart and results table ----------
function renderResults(res) {
  const W0 = 640, H0 = 330, L = 52, R = 150, T = 18, B = 44;
  const lx = n => L + Math.log(n / 2) / Math.log(50) * (W0 - L - R);
  const y = p => T + (1 - p) * (H0 - T - B);
  let s = '';
  [0, .25, .5, .75, 1].forEach(p => { s += `<line x1="${L}" x2="${W0 - R}" y1="${y(p)}" y2="${y(p)}" stroke="#263242"/><text x="${L - 8}" y="${y(p) + 4}" text-anchor="end">${p * 100}%</text>`; });
  [2, 5, 10, 25, 50, 100].forEach(n => { s += `<text x="${lx(n)}" y="${H0 - B + 18}" text-anchor="middle">${n}</text>`; });
  s += `<text x="${(L + W0 - R) / 2}" y="${H0 - 6}" text-anchor="middle">steps N (log scale)</text>`;
  const colors = ['#e4eaf1', '#62d49e', '#ffb547', '#ff4a3d'];
  const labelY = [];
  res.curves.forEach((c, i) => {
    const pts = res.steps.map((n, j) => [lx(n), y(c.safe[j])]);
    s += `<polyline fill="none" stroke="${colors[i]}" stroke-width="2.2" ${c.p === 0 ? 'stroke-dasharray="6 4"' : ''} points="${pts.map(p => p.join(',')).join(' ')}"/>`;
    pts.forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="${colors[i]}"/>`; });
    if (c.p) { const j = res.steps.indexOf(c.best_n); s += `<circle cx="${pts[j][0]}" cy="${pts[j][1]}" r="7" fill="none" stroke="${colors[i]}" stroke-width="1.6"/>`; }
    let ly = pts[pts.length - 1][1];
    labelY.forEach(o => { if (Math.abs(o - ly) < 28) ly = o + 28; });
    labelY.push(ly);
    const j = res.steps.indexOf(c.best_n);
    s += `<text x="${W0 - R + 10}" y="${ly}" style="fill:${colors[i]}" class="lbl-strong">${c.p ? (c.p * 100) + '% noise' : 'ideal'}</text><text x="${W0 - R + 10}" y="${ly + 14}">best N ≈ ${c.best_n}, ${pct(c.safe[j], 0)}</text>`;
  });
  $('noiseChart').innerHTML = s;

  const show = [2, 5, 10, 15, 20, 25, 30, 50, 100];
  const head = `<thead><tr><th>Steps N</th>${res.curves.map(c => `<th>${c.p ? (c.p * 100) + '% noise' : 'ideal'}</th>`).join('')}</tr></thead>`;
  const body = show.map(n => { const j = res.steps.indexOf(n); return `<tr><td>${n}</td>${res.curves.map(c => `<td>${pct(c.safe[j])}</td>`).join('')}</tr>`; }).join('');
  const best = `<tr><td>best N</td>${res.curves.map(c => `<td>${c.best_n}</td>`).join('')}</tr>`;
  const bestRate = `<tr><td>safe at best N</td>${res.curves.map(c => `<td>${pct(c.safe[res.steps.indexOf(c.best_n)])}</td>`).join('')}</tr>`;
  const wrong = `<tr><td>duds labelled live at best N</td>${res.curves.map(c => `<td>${pct(c.dud_wrong[res.steps.indexOf(c.best_n)])}</td>`).join('')}</tr>`;
  const classical = `<tr><td>classical tester</td>${res.curves.map(() => '<td>0%</td>').join('')}</tr>`;
  $('resultsTable').innerHTML = head + `<tbody>${body}${best}${bestRate}${wrong}${classical}</tbody>`;
}

// ---------- boot ----------
const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); });
startLevel(1);
getJSON('pools.json')
  .then(pools => { data = pools; })
  .catch(err => {
    console.error(err);
    $('source').textContent = 'Could not load pools.json. Run "python generate_pools.py", then serve this folder with "python -m http.server" and open localhost:8000.';
    msg = { cls: 'boom', title: 'No shot pools', text: 'The game needs pools.json to draw real Qiskit shots. Run it from a local web server, not from file://.' };
  })
  .then(() => render());
getJSON('noise_results.json')
  .then(renderResults)
  .catch(err => {
    console.error(err);
    $('noiseChart').innerHTML = '<text x="20" y="40">Run "python noise_study.py" to create noise_results.json.</text>';
  });
})();
