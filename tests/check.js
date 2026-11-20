// Checks the probability engine in calc.js against a Monte-Carlo simulation.
// Run: node tests/check.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { TextDecoder, Uint8Array, Float64Array, Map, Math, Number };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "calc.js"), "utf8") +
  "\nthis.api = { rate, firstPassage, cumulative, successProb, planDP, setModel, findConveneUrl, xorLog, get HARD() { return HARD; } };", ctx);
const C = ctx.api;
let fails = 0;
const check = (name, ok, info) => { console.log((ok ? "ok   " : "FAIL ") + name + (info ? "  " + info : "")); if (!ok) fails++; };

let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

// one featured copy; returns pulls used and the new state
function pullChar(st) { let n = 0; for (;;) { n++; st.cp++; if (rnd() < C.rate(st.cp)) { st.cp = 0; if (st.g) { st.g = false; return n; } if (rnd() < 0.5) return n; st.g = true; } } }
function pullWeap(st) { let n = 0; for (;;) { n++; st.wp++; if (rnd() < C.rate(st.wp)) { st.wp = 0; return n; } } }

// goals: [{kind, budget}] in order; returns success share after each goal
function simulate(goals, cp, g, wp, R, F, T) {
  const ok = new Array(goals.length).fill(0);
  for (let i = 0; i < T; i++) {
    const st = { cp, g, wp }; let r = R, f = F, a = 0;
    for (let k = 0; k < goals.length; k++) {
      const s = goals[k];
      const t = s.kind === "char" ? pullChar(st) : pullWeap(st);
      let u;
      if (s.kind === "char") { u = Math.min(t, r); r -= u; } else { u = Math.min(t, f); f -= u; }
      a += t - u;
      if (a > s.budget) break;
      ok[k]++;
    }
  }
  return ok.map((x) => x / T);
}

function stepsFor(goals, cp, g, wp) {
  let nc = 0, nw = 0;
  return goals.map((s) => {
    const dist = s.kind === "char" ? C.firstPassage(1, nc ? 0 : cp, nc ? false : g, true) : C.firstPassage(1, nw ? 0 : wp, false, false);
    if (s.kind === "char") nc++; else nw++;
    return { kind: s.kind, dist, budget: s.budget };
  });
}

// 1) one deadline: new engine == old engine
const one = [
  { N: 2, M: 0, cp: 50, g: false, wp: 0, A: 60, R: 5, F: 0 },
  { N: 1, M: 1, cp: 30, g: true, wp: 10, A: 90, R: 0, F: 3 },
  { N: 2, M: 2, cp: 0, g: false, wp: 0, A: 250, R: 5, F: 0 },
  { N: 3, M: 0, cp: 70, g: true, wp: 0, A: 200, R: 12, F: 0 },
];
for (const c of one) {
  const old = C.successProb(C.firstPassage(c.N, c.cp, c.g, true), C.cumulative(C.firstPassage(c.M, c.wp, false, false)), c.A, c.R, c.F);
  const goals = [...Array(c.N).fill({ kind: "char", budget: c.A }), ...Array(c.M).fill({ kind: "weapon", budget: c.A })];
  const nu = C.planDP(stepsFor(goals, c.cp, c.g, c.wp), c.R, c.F).probs.at(-1);
  check(`one deadline N${c.N} M${c.M} A${c.A}`, Math.abs(old - nu) < 1e-9, `old ${old.toFixed(5)} new ${nu.toFixed(5)}`);
}

// 2) several deadlines: engine vs simulation
const multi = [
  { cp: 50, g: false, wp: 0, R: 5, F: 0, goals: [{ kind: "char", budget: 30 }, { kind: "char", budget: 110 }] },
  { cp: 20, g: true, wp: 0, R: 0, F: 2, goals: [{ kind: "char", budget: 40 }, { kind: "weapon", budget: 70 }, { kind: "char", budget: 200 }] },
  { cp: 0, g: false, wp: 40, R: 10, F: 0, goals: [{ kind: "weapon", budget: 20 }, { kind: "char", budget: 60 }, { kind: "char", budget: 150 }, { kind: "weapon", budget: 190 }] },
];
for (const c of multi) {
  const dp = C.planDP(stepsFor(c.goals, c.cp, c.g, c.wp), c.R, c.F).probs;
  const mc = simulate(c.goals, c.cp, c.g, c.wp, c.R, c.F, 200000);
  const diff = Math.max(...dp.map((v, i) => Math.abs(v - mc[i])));
  check(`deadlines ${c.goals.map((x) => x.kind[0] + x.budget).join(" ")}`, diff < 0.006, `engine ${dp.map((v) => v.toFixed(3)).join("/")} sim ${mc.map((v) => v.toFixed(3)).join("/")}`);
}

// 3) distributions sum to 1
for (const [cp, g] of [[0, false], [79, false], [40, true]]) {
  const s = C.firstPassage(1, cp, g, true).reduce((a, b) => a + b, 0);
  check(`distribution sums to 1 (pity ${cp}${g ? ", guarantee" : ""})`, Math.abs(s - 1) < 1e-12);
}

// 4) other pull model
C.setModel({ base: 0.6, soft: 73, step: 6, hard: 90 });
check("hard pity changes with the model", C.HARD === 90 && C.rate(90) === 1 && C.rate(73) === 0.006);
C.setModel({});

// 5) log decoding
const url = "https://aki-gm-resources-oversea.aki-game.net/aki/gacha/index.html#/record?svr_id=abc&player_id=123&record_id=xyz&resources_id=1";
const plain = new TextEncoder().encode("junk\n" + url + "\" more");
check("finds link in plain log", C.findConveneUrl(plain) === url);
// how the game obfuscates (the inverse of xorLog)
const enc = plain.map((x) => x ^ ((x & 1) ? 0xEF : 0xA5));
check("decoding undoes the game's obfuscation", C.xorLog(enc).every((v, i) => v === plain[i]));
check("finds link in obfuscated log", C.findConveneUrl(enc) === url);

console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
