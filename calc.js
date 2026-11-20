"use strict";

/* ================================================================
   WuWa Pull Planner – probability engine (no page code in here,
   so tests/check.js can run it with Node).
   ================================================================ */

const PULL = 160;                 // Astrite per pull
/* Pull model. Kuro publishes base rate and hard pity; the soft pity curve is a community estimate. */
const DEFAULT_MODEL = { base: 0.8, soft: 65, step: 5, hard: 80 }; // base and step in percent

let HARD = 80, SOFT = 65, BASE = 0.008, STEP = 0.05;
let MODEL = null;                 // distribution of the pull number of one 5★
const fpCache = new Map();

function normModel(m) {
  const d = DEFAULT_MODEL;
  m = m || {};
  const num = (v, def, lo, hi) => { v = +v; return Number.isFinite(v) && v >= lo && v <= hi ? v : def; };
  const hard = Math.round(num(m.hard, d.hard, 10, 200));
  const soft = Math.round(num(m.soft, d.soft, 0, hard - 1));
  return { base: num(m.base, d.base, 0.01, 100), soft, step: num(m.step, d.step, 0, 100), hard };
}

function setModel(m) {
  m = normModel(m);
  HARD = m.hard; SOFT = m.soft; BASE = m.base / 100; STEP = m.step / 100;
  fpCache.clear();
  MODEL = buildModel();
  return m;
}

function rate(n) {
  if (n >= HARD) return 1;
  if (n <= SOFT) return BASE;
  return Math.min(1, BASE + STEP * (n - SOFT));
}

function buildModel() {
  const f = new Float64Array(HARD + 1), F = new Float64Array(HARD + 1);
  let surv = 1, cum = 0, mean = 0;
  for (let n = 1; n <= HARD; n++) {
    const r = rate(n);
    f[n] = surv * r; surv *= 1 - r;
    cum += f[n]; F[n] = cum; mean += n * f[n];
  }
  return { f, F, mean };
}

/* P[t] = probability that the N-th featured copy arrives exactly at pull t. */
function firstPassage(N, pity, guaranteed, fiftyFifty) {
  if (N <= 0) return Float64Array.of(1);
  pity = Math.max(0, Math.min(HARD - 1, pity | 0));
  const key = `${N}|${pity}|${guaranteed ? 1 : 0}|${fiftyFifty ? 1 : 0}`;
  if (fpCache.has(key)) return fpCache.get(key);
  const maxT = (HARD - pity) + (fiftyFifty && !guaranteed ? HARD : 0) + (N - 1) * (fiftyFifty ? 2 * HARD : HARD);
  const P = new Float64Array(maxT + 1);
  const size = 2 * N * HARD;
  const idx = (g, w, p) => (g * N + w) * HARD + p;
  let cur = new Float64Array(size);
  cur[idx(guaranteed && fiftyFifty ? 1 : 0, 0, pity)] = 1;
  for (let t = 1; t <= maxT; t++) {
    const next = new Float64Array(size);
    for (let g = 0; g < 2; g++) for (let w = 0; w < N; w++) for (let p = 0; p < HARD; p++) {
      const m = cur[idx(g, w, p)];
      if (m === 0) continue;
      const r = rate(p + 1);
      if (r < 1) next[idx(g, w, p + 1)] += m * (1 - r);
      const hit = m * r;
      let win = hit;
      if (fiftyFifty && g === 0) {
        win = hit * 0.5;
        next[idx(1, w, 0)] += hit * 0.5;
      }
      if (w + 1 === N) P[t] += win;
      else next[idx(0, w + 1, 0)] += win;
    }
    cur = next;
  }
  fpCache.set(key, P);
  return P;
}

function cumulative(P) {
  const C = new Float64Array(P.length);
  let s = 0;
  for (let i = 0; i < P.length; i++) { s += P[i]; C[i] = Math.min(1, s); }
  return C;
}

const meanOf = (P) => P.reduce((s, v, i) => s + v * i, 0);

/* Success probability with A Astrite pulls, R Radiant and F Forging Tides (one deadline for everything). */
function successProb(Pc, Cw, A, R, F) {
  let total = 0;
  for (let tc = 0; tc < Pc.length; tc++) {
    const m = Pc[tc];
    if (m === 0) continue;
    const rest = A - Math.max(0, tc - R);
    if (rest < 0) continue;
    const allowW = Math.min(Cw.length - 1, F + rest);
    total += m * Cw[allowW];
  }
  return Math.min(1, total);
}

/* Targets with their own deadlines.
   steps: [{kind: "char" | "weapon", dist, budget}] in pull order. budget = Astrite pulls available by that target's deadline.
   Tides are used first (Radiant on the resonator banner, Forging on the weapon banner).
   Returns probs[i] = chance to have targets 0..i in time, and dist = final Astrite pulls used (only meaningful without cuts). */
function planDP(steps, R, F, cap) {
  R = Math.max(0, R | 0); F = Math.max(0, F | 0);
  if (!steps.length) return { probs: [], dist: Float64Array.of(1) };
  let A = 0;
  for (const s of steps) A = Math.max(A, s.budget);
  if (cap != null) A = Math.min(A, cap);
  A = Math.max(0, A);
  const W = A + 1, FF = F + 1, size = (R + 1) * FF * W;
  let cur = new Float64Array(size);
  cur[(R * FF + F) * W] = 1;
  const probs = [];
  for (const s of steps) {
    const next = new Float64Array(size);
    const D = s.dist, isChar = s.kind !== "weapon", B = s.budget;
    if (B >= 0) {
      for (let r = 0; r <= R; r++) for (let f = 0; f <= F; f++) {
        const base = (r * FF + f) * W;
        for (let a = 0; a <= A; a++) {
          const m = cur[base + a];
          if (m === 0) continue;
          for (let t = 1; t < D.length; t++) {
            const p = D[t];
            if (p === 0) continue;
            let r2 = r, f2 = f, u;
            if (isChar) { u = t < r ? t : r; r2 = r - u; } else { u = t < f ? t : f; f2 = f - u; }
            const a2 = a + t - u;
            if (a2 > B || a2 > A) break; // a2 only grows with t
            next[(r2 * FF + f2) * W + a2] += m * p;
          }
        }
      }
    }
    cur = next;
    let s2 = 0;
    for (let i = 0; i < size; i++) s2 += cur[i];
    probs.push(Math.min(1, s2));
  }
  const dist = new Float64Array(W);
  for (let i = 0; i < size; i++) dist[i % W] += cur[i];
  return { probs, dist };
}

/* Distribution of featured resonator copies for B pulls (everything on the resonator banner). */
function copiesDist(B, pity, guaranteed, K) {
  const size = 2 * (K + 1) * HARD;
  const idx = (g, w, p) => (g * (K + 1) + w) * HARD + p;
  let cur = new Float64Array(size);
  cur[idx(guaranteed ? 1 : 0, 0, Math.min(HARD - 1, pity | 0))] = 1;
  for (let t = 0; t < B; t++) {
    const next = new Float64Array(size);
    for (let g = 0; g < 2; g++) for (let w = 0; w <= K; w++) for (let p = 0; p < HARD; p++) {
      const m = cur[idx(g, w, p)];
      if (m === 0) continue;
      if (w === K) { next[idx(g, w, p)] += m; continue; }
      const r = rate(p + 1);
      if (r < 1) next[idx(g, w, p + 1)] += m * (1 - r);
      const hit = m * r;
      if (g === 0) {
        next[idx(1, w, 0)] += hit * 0.5;
        next[idx(0, w + 1, 0)] += hit * 0.5;
      } else {
        next[idx(0, w + 1, 0)] += hit;
      }
    }
    cur = next;
  }
  const out = new Float64Array(K + 1);
  for (let g = 0; g < 2; g++) for (let w = 0; w <= K; w++) for (let p = 0; p < HARD; p++) out[w] += cur[idx(g, w, p)];
  return out;
}

/* Decoding for the obfuscated game log (newer game versions). */
function xorLog(bytes) {
  const o = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) { const b = bytes[i]; o[i] = b ^ ((b & 1) ? 0xA5 : 0xEF); }
  return o;
}
const CONVENE_URL_RE = /https:\/\/aki-gm-resources(?:-oversea)?\.aki-game\.(?:net|com)\/aki\/gacha\/index\.html#\/record[^"\s]*/g;
function findConveneUrl(bytes) {
  const dec = new TextDecoder("utf-8");
  for (const b of [bytes, xorLog(bytes)]) {
    const m = dec.decode(b).match(CONVENE_URL_RE);
    if (m && m.length) return m[m.length - 1];
  }
  return null;
}

setModel(DEFAULT_MODEL);
