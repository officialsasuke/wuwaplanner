"use strict";

/* ================================================================
   WuWa Pull Planner – interface and calculator
   ================================================================ */

/* ---------------------------------------------------------------- Dates and server time */
const isoOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const dayNum = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const serverOf = (p) => SERVERS.find((s) => s.k === p.server) || SERVERS[1];

/* Today's game day on the chosen server (the day changes at 04:00 server time). */
function serverToday(p = plan) {
  const ms = Date.now() + serverOf(p).utc * 3600000 - RESET_HOUR * 3600000;
  return Math.floor(ms / 86400000);
}

/* Default banner end: the last phase that is still running, otherwise three weeks from today. */
function defaultEnd() {
  const today = isoOf(Math.floor((Date.now() + 3600000 - RESET_HOUR * 3600000) / 86400000));
  const open = BANNERS.filter((b) => b.end >= today).map((b) => b.end).sort();
  return open.length ? open[open.length - 1] : isoOf(dayNum(today) + 21);
}

/* Neutral start. Every visitor fills in their own account (Quick setup or the Resources page). */
const DEFAULT_PLAN = {
  astrite: 0, lunite: 0, useLunite: false, radiant: 0, forging: 0,
  endDate: defaultEnd(), dailies: true, sub: false,
  server: "europe", todayClaimed: true,
  model: { ...DEFAULT_MODEL },
  goals: [],
  charPity: 0, guaranteed: false, weaponPity: 0,
  dayTarget: 0.5, scenarios: [],
  sources: [],
  roster: {},
  teamBuild: "solid", usePlanned: true, setSize: 2,
  myTeams: [],
  weapons: {},
};

const PAGES = {
  overview: ["Overview", "Convene Planner"],
  resources: ["Resources", "Inventory and income"],
  analysis: ["Analysis", "Daily goal and chances"],
  scenarios: ["Scenarios", "What if"],
  teams: ["Teams", "Roster and team builder"],
  builds: ["Characters", "Builds, weapons, echoes and teams"],
  history: ["History", "Convene Record"],
  images: ["Images", "Your images and import"],
  settings: ["Settings", "Performance and display"],
};

let plan = structuredClone(DEFAULT_PLAN);
let history = null;
let images = null;
let online = false;
let hasUrl = false;
let activeTab = "1";
let page = "overview";
let goalType = "char";
let teamTab = "roster";
let rosterEl = "All";
let pickEl = "All";
let autoShown = 8;
let pickTarget = null;
let editGoal = -1;        // index in plan.goals while the target dialog edits one, -1 = new target
let sessionUrl = "";      // Convene link for this visit only (not stored unless the visitor agrees)

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const fix1 = (n) => n.toFixed(1);
const pct = (p) => {
  if (p >= 0.9995) return "100%";
  if (p > 0.995) return ">99%";
  if (p > 0 && p < 0.005) return "<1%";
  return Math.round(p * 100) + "%";
};

/* ---------------------------------------------------------------- Images */
const CUR_BUILTIN = { astrite: "assets/ic_astrite.png", lunite: "assets/ic_lunite.png", radiant: "assets/ic_radiant.png", forging: "assets/ic_forging.png" };
const CUR_ALIASES = {
  astrite: ["astrite"],
  lunite: ["lunite", "lunitefragment", "lunitefragments"],
  radiant: ["radiant", "radianttide", "radianttides"],
  forging: ["forging", "forgingtide", "forgingtides"],
};

function normKey(s) {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Without the local server (GitHub Pages) images are looked up by name:
   images/<folder>/<name in lower case, letters and digits only>.png, e.g. images/resonators/yangyangxuanling.png */
const WEB_IMG_EXT = "png";
function webImg(cat, name) {
  const k = normKey(name);
  return k ? `images/${cat}/${k}.${WEB_IMG_EXT}` : null;
}

function findImg(cat, name) {
  if (!online) return webImg(cat, name);
  const files = images?.cats?.[cat]?.files || [];
  const key = normKey(name);
  if (!key || !files.length) return null;
  const v = (f) => f.url + "?v=" + f.mtime;
  const exact = files.find((f) => f.key === key);
  if (exact) return v(exact);
  let best = null;
  for (const f of files) {
    if (f.key.length < 3) continue;
    if (key.includes(f.key) || f.key.includes(key)) {
      if (!best || f.key.length > best.key.length) best = f;
    }
  }
  return best ? v(best) : null;
}

function curImg(k) {
  for (const a of CUR_ALIASES[k]) {
    const u = findImg("currency", a);
    if (u) return u;
  }
  return CUR_BUILTIN[k];
}

function applyCurrencyImages() {
  $$("[data-cur]").forEach((el) => {
    const k = el.dataset.cur;
    el.onerror = () => { el.onerror = null; el.src = CUR_BUILTIN[k]; };
    el.src = online ? curImg(k) : webImg("currency", k);
  });
}

function portrait(cat, name) {
  const ph = `assets/${cat === "weapons" ? "ph_weapon" : "ph_char"}.png`;
  const key = normKey(name);
  // All four Rovers can share one picture: images/resonators/rover.png (the element badge tells them apart).
  const shared = cat === "resonators" && key.startsWith("rover") && key !== "rover" ? webImg(cat, "rover") : null;
  const u = findImg(cat, name);
  if (u) {
    const own = u.includes("/" + key + ".");
    const toPh = `this.onerror=null;this.className='art ph';this.src='${ph}'`;
    const onerr = shared && own
      ? `this.onerror=function(){${toPh}};this.className='art shared';this.src='${shared}'`
      : toPh;
    return `<img class="${shared && !own ? "art shared" : "art"}" src="${u}" alt="" loading="lazy" onerror="${onerr}">`;
  }
  return `<img class="art ph" src="${ph}" alt="">`;
}

async function loadImages() {
  if (!online) return;
  try { images = await (await fetch("/api/images")).json(); } catch (e) { images = null; }
  applyCurrencyImages();
}

/* ---------------------------------------------------------------- Browser import (GitHub Pages) */
const URL_RE = /https:\/\/aki-gm-resources(?:-oversea)?\.aki-game\.(?:net|com)\/aki\/gacha\/index\.html#\/record[^"\s]*/;
const POOL_LABELS = { 1: "Featured Resonator", 2: "Featured Weapon", 3: "Standard Resonator", 4: "Standard Weapon" };
const STANDARD5 = STANDARD_5.map((x) => x.n.toLowerCase());
const STANDARD5_IDS = STANDARD_5.map((x) => x.id);

function parseConveneUrl(url) {
  const m = String(url).match(URL_RE);
  if (!m) throw new Error("That is not a Convene history link. It starts with https://aki-gm-resources...");
  url = m[0];
  const frag = url.split("#")[1] || "";
  const q = new URLSearchParams(frag.split("?")[1] || "");
  const p = {
    url,
    api: url.includes("aki-game.net") ? "https://gmserver-api.aki-game2.net" : "https://gmserver-api.aki-game2.com",
    serverId: q.get("svr_id") || "", playerId: q.get("player_id") || "", recordId: q.get("record_id") || "",
    cardPoolId: q.get("resources_id") || "",
  };
  if (!p.playerId || !p.recordId) throw new Error("The link has no player_id/record_id. Copy it again from the game log.");
  return p;
}

async function fetchPool(p, type) {
  const res = await fetch(p.api + "/gacha/record/query", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardPoolId: p.cardPoolId, cardPoolType: type, languageCode: "en", playerId: p.playerId, recordId: p.recordId, serverId: p.serverId }),
  });
  const j = await res.json();
  if (j.code !== 0) throw new Error(`Kuro API reports error ${j.code}: ${j.message}. Usually the link has expired: open the Convene history in the game again and copy a new link.`);
  return j.data || [];
}

function loadRawHistory() {
  try { return JSON.parse(localStorage.getItem("wuwaHistoryRaw") || "null") || { pools: {} }; } catch (e) { return { pools: {} }; }
}

/* old/new are chronological (old -> new); the overlapping range is replaced by the new data. */
function mergeRecords(old, neu) {
  if (!neu.length) return old;
  if (!old.length) return neu;
  const cutoff = neu[0].time;
  return old.filter((r) => r.time < cutoff).concat(neu);
}

async function browserSync(url) {
  const p = parseConveneUrl(url);
  const raw = loadRawHistory();
  raw.pools = raw.pools || {};
  if (raw.playerId && raw.playerId !== p.playerId) raw.pools = {}; // different account
  const counts = {};
  for (const type of [1, 2, 3, 4]) {
    const data = await fetchPool(p, type);
    const recs = data.slice().reverse().map((r) => ({ name: r.name, id: r.resourceId, q: +r.qualityLevel || 3, type: r.resourceType, time: r.time }));
    raw.pools[type] = mergeRecords(raw.pools[type] || [], recs);
    counts[type] = data.length;
  }
  const d = new Date();
  raw.playerId = p.playerId;
  raw.updated = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  localStorage.setItem("wuwaHistoryRaw", JSON.stringify(raw));
  sessionUrl = p.url;
  // The link is only kept if the visitor ticked "Remember the link".
  if ($("#rememberLink") && $("#rememberLink").checked) localStorage.setItem("wuwaConveneUrl", p.url);
  else localStorage.removeItem("wuwaConveneUrl");
  return { counts, history: analyzeHistory(raw) };
}

/* Same analysis as the local server: pity, 50/50 results, copies per name. */
function analyzeHistory(raw) {
  const out = { updated: raw.updated, playerId: raw.playerId, pools: {}, counts: {} };
  for (const recs of Object.values(raw.pools || {})) for (const r of recs) {
    if ((r.q || 3) >= 4 && r.name) out.counts[r.name] = (out.counts[r.name] || 0) + 1;
  }
  for (const [key, recs] of Object.entries(raw.pools || {})) {
    let pity5 = 0, pity4 = 0, lostLast = false;
    const fives = [];
    for (const r of recs) {
      pity5++; pity4++;
      if (r.q === 4) pity4 = 0;
      if (r.q === 5) {
        const isStd = STANDARD5_IDS.includes(r.id) || STANDARD5.includes(String(r.name || "").toLowerCase());
        let result = null;
        if (key === "1") {
          result = isStd ? "lost" : lostLast ? "guarantee" : "won";
          lostLast = isStd;
        }
        // The oldest 5★ in the record: older pulls may be missing, so pity and 50/50 can be off.
        fives.push({ name: r.name, pity: pity5, time: r.time, result, unsure: !fives.length });
        pity5 = 0; pity4 = 0;
      }
    }
    out.pools[key] = {
      name: POOL_LABELS[key] || key, total: recs.length, pity5, pity4,
      guaranteed: key === "1" && lostLast, fives: fives.reverse(),
      avg: fives.length ? Math.round((fives.reduce((s, f) => s + f.pity, 0) / fives.length) * 10) / 10 : null,
      won: fives.filter((f) => f.result === "won").length, lost: fives.filter((f) => f.result === "lost").length,
      astrite: recs.length * 160,
    };
  }
  return out;
}

/* Backup of everything kept in this browser. */
function exportData() {
  const data = { app: "wuwa-pull-planner", version: 2, plan, historyRaw: loadRawHistory() };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wuwa-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.app !== "wuwa-pull-planner") throw new Error("This is not a planner backup.");
      plan = migrate({ ...structuredClone(DEFAULT_PLAN), ...d.plan });
      if (d.historyRaw && !online) {
        localStorage.setItem("wuwaHistoryRaw", JSON.stringify(d.historyRaw));
        history = analyzeHistory(d.historyRaw);
      }
      plan.model = setModel(plan.model); fillModel(); $("#serverSel").value = plan.server;
      save(); fillInputs(); renderSources(); renderHistory(); setStatus(); pityNote(); calculate();
      msg("Backup restored.", true);
    } catch (e) { msg("Could not read the backup: " + e.message, false); }
  };
  r.readAsText(file);
}

/* ---------------------------------------------------------------- Resources and targets */
function goalCounts(goals) {
  let N = 0, M = 0;
  for (const g of goals || []) { if (g.type === "weapon") M++; else N++; }
  return { N, M };
}

const dailyRate = (p) => (p.dailies ? 60 : 0) + (p.sub ? 90 : 0);
const goalEnd = (p, g) => (isoOk(g.end) ? g.end : p.endDate);
const clampPity = (v) => Math.max(0, Math.min(HARD - 1, +v || 0));

/* Pull order: earliest banner end first; within one banner resonators before weapons, then the order you set. */
function orderedGoals(p = plan) {
  return (p.goals || []).map((g, i) => ({ g, i, end: goalEnd(p, g) }))
    .sort((x, y) => (x.end < y.end ? -1 : x.end > y.end ? 1 : 0) || ((x.g.type === "weapon") - (y.g.type === "weapon")) || x.i - y.i);
}

/* Last banner end of all targets (or the default end without targets). */
function horizon(p = plan) {
  let h = p.endDate;
  for (const g of p.goals || []) { const e = goalEnd(p, g); if (isoOk(e) && (!isoOk(h) || e > h)) h = e; }
  return h;
}

/* Days on which you still collect daily Astrite until (and including) the end day. */
function incomeDays(p, end) {
  if (!isoOk(end)) return 0;
  return Math.max(0, dayNum(end) - serverToday(p) + (p.todayClaimed ? 0 : 1));
}
const daysLeft = (p = plan, end = horizon(p)) => (isoOk(end) ? Math.max(0, dayNum(end) - serverToday(p)) : 0);
const sourceCounts = (s, end) => s.on && (!isoOk(s.date) || s.date <= end);

/* Astrite you have by the end of a banner. daily overrides the daily income. */
function astriteBy(p, end, daily) {
  let a = (+p.astrite || 0) + (p.useLunite ? (+p.lunite || 0) : 0);
  for (const s of p.sources || []) if (sourceCounts(s, end)) a += +s.astrite || 0;
  return a + incomeDays(p, end) * (daily ?? dailyRate(p));
}
const budgetPulls = (p, end, daily) => Math.floor(astriteBy(p, end, daily) / PULL);

function resources(p = plan, dailyOverride) {
  const end = horizon(p);
  const days = incomeDays(p, end);
  const daily = dailyOverride ?? dailyRate(p);
  let srcA = 0, srcT = 0;
  for (const s of p.sources || []) {
    if (s.on) srcT += +s.tides || 0;
    if (sourceCounts(s, end)) srcA += +s.astrite || 0;
  }
  const lun = p.useLunite ? (+p.lunite || 0) : 0;
  const now = (+p.astrite || 0) + lun;
  const total = now + srcA + days * daily;
  return {
    end, days, daily, srcA, srcT, now, lun,
    income: days * daily,
    totalAstrite: total,
    A: Math.floor(total / PULL),
    R: (+p.radiant || 0) + srcT,
    F: +p.forging || 0,
  };
}

/* Small cache: the same plan is evaluated many times per render. */
const evalCache = new Map();
function planKey(p) {
  return JSON.stringify([p.astrite, p.lunite, p.useLunite, p.radiant, p.forging, p.endDate, p.dailies, p.sub,
    p.goals, p.charPity, p.guaranteed, p.weaponPity, p.sources, p.server, p.todayClaimed, p.model, serverToday(p)]);
}

/* Full evaluation. opt.daily replaces the daily income, opt.extra adds pulls to every deadline. */
function evalPlan(p, opt = {}) {
  const key = planKey(p) + "|" + (opt.daily ?? "") + "|" + (opt.extra || 0);
  if (evalCache.has(key)) return evalCache.get(key);
  const r = resources(p, opt.daily);
  const og = orderedGoals(p);
  const cp = clampPity(p.charPity), wp = clampPity(p.weaponPity), g = !!p.guaranteed;
  let nc = 0, nw = 0, wc = 0, ww = 0, miss = -Infinity, slack = Infinity;
  const steps = [], per = [];
  for (const x of og) {
    const isW = x.g.type === "weapon";
    let dist;
    if (isW) { dist = firstPassage(1, nw ? 0 : wp, false, false); ww += nw ? HARD : HARD - wp; nw++; }
    else { dist = firstPassage(1, nc ? 0 : cp, nc ? false : g, true); wc += nc ? 2 * HARD : (HARD - cp) + (g ? 0 : HARD); nc++; }
    const budget = budgetPulls(p, x.end, opt.daily) + (opt.extra || 0);
    const need = Math.max(0, wc - r.R) + Math.max(0, ww - r.F); // Astrite pulls for the worst case so far
    miss = Math.max(miss, need - budget);
    slack = Math.min(slack, budget - need);
    steps.push({ kind: isW ? "weapon" : "char", dist, budget });
    per.push({ goal: x.g, idx: x.i, end: x.end, need, budget, worst: wc + ww, miss });
  }
  const worstA = Math.max(0, wc - r.R) + Math.max(0, ww - r.F);
  const dp = planDP(steps, r.R, r.F, worstA);
  per.forEach((x, i) => { x.prob = dp.probs[i]; x.guaranteed = x.miss <= 0; x.missPulls = Math.max(0, x.miss); });
  const last = per[per.length - 1];
  // the deadline where the worst case is furthest away
  let tight = null;
  for (const x of per) if (!tight || x.need - x.budget > tight.need - tight.budget) tight = x;
  const ev = {
    r, N: nc, M: nw, per, steps, worstA, Wc: wc, Ww: ww,
    prob: last ? last.prob : 1,
    worst: wc + ww, needPulls: worstA,
    guaranteed: last ? last.guaranteed : true,
    missPulls: last ? last.missPulls : 0,
    slack: per.length ? slack : 0, tight,
    totalPulls: r.A + r.R + r.F,
    groups: new Set(og.map((x) => x.end)).size,
  };
  if (evalCache.size > 400) evalCache.clear();
  evalCache.set(key, ev);
  return ev;
}

/* Chance to have every target up to and including each one (in pull order). */
function goalChances(p = plan) {
  return evalPlan(p).per.map((x, i) => ({ goal: x.goal, idx: i, ev: x }));
}

/* Chance by total pulls. With one banner end this is exact for every pull count;
   with several ends the extra (or missing) pulls are added to every deadline. */
function buildCurve(p, ev) {
  const r = ev.r, base = r.R + r.F;
  if (!ev.steps.length) return [];
  const maxA = Math.max(r.A, ev.worstA) + 5;
  const pts = [];
  if (ev.groups === 1) {
    const d = planDP(ev.steps.map((s) => ({ ...s, budget: ev.worstA })), r.R, r.F, ev.worstA).dist;
    const C = cumulative(d);
    for (let a = 0; a <= maxA; a++) pts.push({ x: a + base, y: C[Math.min(a, C.length - 1)] });
  } else {
    const step = Math.max(1, Math.ceil(maxA / 48));
    const xs = new Set([r.A, maxA]);
    for (let a = 0; a <= maxA; a += step) xs.add(a);
    for (const a of [...xs].sort((u, v) => u - v)) pts.push({ x: a + base, y: a === r.A ? ev.prob : evalPlan(p, { extra: a - r.A }).prob });
  }
  return pts;
}

/* Lowest total Astrite per day so that the chance reaches target. 0 = already reached, Infinity = not possible in time. */
const dailyCache = new Map();
function dailyFor(p, target) {
  if (!(p.goals || []).length) return 0;
  const key = planKey(p) + "|" + target;
  if (dailyCache.has(key)) return dailyCache.get(key);
  let res;
  if (target >= 1) {
    res = 0;
    for (const x of evalPlan(p, { daily: 0 }).per) {
      const gap = x.need * PULL - astriteBy(p, x.end, 0);
      if (gap <= 0) continue;
      const d = incomeDays(p, x.end);
      if (d <= 0) { res = Infinity; break; }
      res = Math.max(res, Math.ceil(gap / d));
    }
  } else {
    const ok = (d) => evalPlan(p, { daily: d }).prob >= target - 1e-9;
    if (ok(0)) res = 0;
    else {
      let lo = 0, hi = 500;
      while (!ok(hi) && hi < 100000) { lo = hi; hi *= 2; }
      if (!ok(hi)) res = Infinity;
      else {
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid; }
        res = hi;
      }
    }
  }
  if (dailyCache.size > 200) dailyCache.clear();
  dailyCache.set(key, res);
  return res;
}

/* ---------------------------------------------------------------- Frame */
let calcTimer = null;
function scheduleCalc() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(calculate, 60);
}

/* Pages that share one entry in the side bar. The first page of a group is the entry; the others are reached with the small tabs on top. */
const PAGE_GROUPS = [["analysis", "scenarios"], ["settings", "images"]];
const SUB_LABEL = { analysis: "Analysis", scenarios: "Scenarios", settings: "Settings", images: "Images" };
const groupHead = (p) => (PAGE_GROUPS.find((g) => g.includes(p)) || [p])[0];
PAGE_GROUPS.forEach((g) => g.forEach((id) => {
  const sec = document.getElementById("page-" + id);
  if (sec) sec.insertAdjacentHTML("afterbegin", `<div class="seg subnav">${g.map((x) => `<button class="btn" data-sub="${x}">${SUB_LABEL[x]}</button>`).join("")}</div>`);
}));
document.addEventListener("click", (e) => { const b = e.target.closest("[data-sub]"); if (b) showPage(b.dataset.sub); });

function showPage(p) {
  if (!PAGES[p]) p = "overview";
  page = p;
  $$(".page").forEach((s) => s.classList.toggle("hidden", s.id !== "page-" + p));
  $$(".subnav .btn").forEach((b) => b.classList.toggle("on", b.dataset.sub === p));
  $$(".nav").forEach((b) => {
    const on = b.dataset.page === groupHead(p);
    b.classList.toggle("on", on);
    const img = b.querySelector("img");
    if (!img.dataset.light) img.dataset.light = img.getAttribute("src");
    img.src = on ? img.dataset.dark : img.dataset.light;
  });
  $("#pageTitle").textContent = PAGES[p][0];
  $("#pageSub").textContent = PAGES[p][1];
  try { localStorage.setItem("wuwaPage", p); } catch (e) { /* ignore */ }
  if (p === "images") renderImagesPage();
  if (p === "builds") renderBuilds();
  if (p === "settings" && window.wuwaBg) window.wuwaBg.stat();
  calculate();
  window.scrollTo({ top: 0 });
}

function calculate() {
  const ev = evalPlan(plan);
  const r = ev.r;
  const g = !!plan.guaranteed;
  const cp = clampPity(plan.charPity), wp = clampPity(plan.weaponPity);

  $("#pAstrite").textContent = fmt(+plan.astrite || 0);
  $("#pLunite").textContent = fmt(+plan.lunite || 0);
  $("#pRadiant").textContent = fmt(+plan.radiant || 0);
  $("#pForging").textContent = fmt(+plan.forging || 0);

  // Resources page
  $("#incomeNote").innerHTML = r.days > 0
    ? `<b>${r.days}</b> days × ${r.daily} Astrite = <b>${fmt(r.income)}</b> Astrite (${fmt(r.income / PULL)} pulls) until <b>${fmtDate(r.end)}</b>`
    : "The last banner end is not in the future.";
  $("#serverNote").innerHTML = serverText();
  const later = (plan.sources || []).filter((s) => s.on && isoOk(s.date) && s.date > r.end).length;
  $("#sourceNote").innerHTML = `Counted until ${fmtDate(r.end)}: <b>${fmt(r.srcA)}</b> Astrite` + (r.srcT ? ` + <b>${r.srcT}</b> Radiant Tides` : "") +
    (later ? `. ${later} source${later > 1 ? "s come" : " comes"} after your last banner end.` : "");

  renderOverview(ev, r, cp, wp, g);
  if (page === "analysis") renderAnalysis(ev, r, cp, g);
  if (page === "scenarios") renderScenarios(ev);
  if (page === "history") renderLuck();
  const typing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("tnamein");
  if (page === "teams" && !typing) renderTeamsPage();   // rebuilding would drop the focus and close the keyboard
}

function serverText() {
  const s = serverOf(plan);
  const now = Date.now() + s.utc * 3600000;
  const toReset = 86400000 - ((now - RESET_HOUR * 3600000) % 86400000 + 86400000) % 86400000;
  const h = Math.floor(toReset / 3600000), m = Math.floor((toReset % 3600000) / 60000);
  const t = new Date(now).toISOString().slice(11, 16);
  return `Server time ${t} (UTC${s.utc >= 0 ? "+" : ""}${s.utc}). Next daily reset in <b>${h} h ${m} min</b>.`;
}

/* ---------------------------------------------------------------- Overview */
const bannerOf = (end) => BANNERS.find((b) => b.end === end);
function endLabel(end) {
  const b = bannerOf(end);
  return b ? `${esc(b.label)} · ${fmtShort(end)}` : `until ${fmtShort(end)}`;
}

function renderOverview(ev, r, cp, wp, g) {
  renderGoals(ev);
  renderCountdown();

  const has = ev.N + ev.M > 0;
  $("#oChance").textContent = has ? pct(ev.prob) : "–";
  $("#oChance").className = "sbig gold";
  $("#oChanceBar").style.width = (has ? ev.prob * 100 : 0) + "%";
  $("#oChanceSub").innerHTML = has
    ? `with <b>${ev.totalPulls}</b> pulls until <b>${fmtDate(r.end)}</b>` + (ev.groups > 1 ? ", each target by its own banner end" : "")
    : "Add a target on the left.";

  const gEl = $("#oGuar");
  if (!has) { gEl.textContent = "–"; gEl.className = "sbig"; $("#oGuarSub").textContent = ""; $("#oGuarBar").style.width = "0%"; }
  else if (ev.guaranteed) {
    gEl.textContent = "Safe"; gEl.className = "sbig good";
    $("#oGuarSub").innerHTML = `Even in the worst case (<b>${ev.worst}</b> pulls) at least <b>${ev.slack}</b> pulls are left over.`;
    $("#oGuarBar").style.width = "100%";
  } else {
    gEl.innerHTML = `${ev.missPulls}<small>pulls short</small>`; gEl.className = "sbig";
    const d = dailyFor(plan, 1);
    const t = ev.tight && ev.groups > 1 ? ` The tightest end is <b>${fmtDate(ev.tight.end)}</b>.` : "";
    $("#oGuarSub").innerHTML = `Worst case: <b>${ev.worst}</b> pulls.${t} ` +
      (isFinite(d) ? `Safe with <b>${fmt(d)}</b> Astrite per day.` : "Not reachable in time with daily income.");
    $("#oGuarBar").style.width = Math.min(100, (ev.totalPulls / Math.max(1, ev.worst)) * 100) + "%";
  }

  const t = DAY_TARGETS.find((x) => x.k === +plan.dayTarget) || DAY_TARGETS[0];
  $("#oFarmTarget").textContent = t.label;
  const fEl = $("#oFarm");
  if (!has) { fEl.textContent = "–"; fEl.className = "sbig"; $("#oFarmSub").textContent = ""; }
  else {
    const d = dailyFor(plan, t.k);
    if (d === 0) { fEl.innerHTML = `0<small>Astrite / day</small>`; fEl.className = "sbig good"; $("#oFarmSub").innerHTML = "Already reached with your inventory and one-time sources."; }
    else if (!isFinite(d)) { fEl.textContent = "–"; fEl.className = "sbig bad"; $("#oFarmSub").textContent = "Not reachable in time: a banner ends before enough Astrite comes in."; }
    else {
      const ok = d <= r.daily;
      fEl.innerHTML = `${fmt(d)}<small>Astrite / day</small>`; fEl.className = "sbig" + (ok ? " good" : "");
      $("#oFarmSub").innerHTML = ok ? `Your income (${r.daily} / day) is enough.` : `<b>${fmt(d - r.daily)}</b> more than your ${r.daily} from dailies and subscription.`;
    }
  }

  drawRing($("#ringChar"), cp); $("#rcVal").textContent = cp;
  drawRing($("#ringWeap"), wp); $("#rwVal").textContent = wp;
  $$(".rv small").forEach((x) => { x.textContent = "/ " + HARD; });
  $("#rcTag").textContent = g ? "Guarantee active" : "50/50";
  $("#rwTag").textContent = "100% featured";

  // Where the pulls come from
  const parts = [
    ["Inventory", Math.floor((+plan.astrite || 0) / PULL), "#f0c86e"],
    ["Lunite", Math.floor(r.lun / PULL), "#b98cff"],
    ["Dailies + subscription", Math.floor(r.income / PULL), "#f2efe6"],
    ["Other sources", Math.floor(r.srcA / PULL), "#7ed6ce"],
    ["Tides", r.R + r.F, "#c48e3a"],
  ].filter((p) => p[1] > 0);
  const sum = parts.reduce((s, p) => s + p[1], 0) || 1;
  $("#oPulls").textContent = ev.totalPulls;
  $("#oStack").innerHTML = parts.map((p) => `<i style="width:${(p[1] / sum) * 100}%;background:${p[2]}"></i>`).join("");
  $("#oLegend").innerHTML = parts.map((p) => `<span style="--c:${p[2]}">${p[0]}</span><b>${p[1]}</b>`).join("");

  $("#oDays").textContent = daysLeft(plan, r.end);
  const b = bannerOf(r.end);
  $("#oDate").innerHTML = `until <b>${fmtDate(r.end)}</b>` + (b ? ` · ${esc(b.label)}` : "");
  $("#oDayKv").innerHTML = [
    ["Per day", `${r.daily} Astrite`],
    ["Until the end", `${fmt(r.income)} Astrite`],
    ["Total Astrite", fmt(r.totalAstrite)],
  ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("");
}

function fmtDate(iso) {
  if (!iso) return "–";
  const d = iso instanceof Date ? iso : new Date(iso + "T00:00:00");
  return isNaN(d) ? "–" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? "–" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const isDefaultWeapon = (n) => !n || /^(signature weapon|weapon)$/i.test(String(n).trim());
/* Signature weapon name for a resonator (data.js SIGNATURE), or "" */
function signatureOf(resName) {
  const c = resName && findResonator(resName);
  return (c && SIGNATURE[c.n]) || "";
}

function renderGoals(ev) {
  const box = $("#goals");
  const og = orderedGoals(plan);
  const html = ev.per.map((x, i) => {
    const gl = x.goal, idx = x.idx, isW = gl.type === "weapon";
    const prev = og[i - 1];
    const canMove = prev && prev.end === x.end && (prev.g.type === "weapon") === isW;
    const gtxt = x.guaranteed ? `<span class="good">guaranteed</span>` : `${x.missPulls} pulls short of a guarantee`;
    const sig = isW && gl.for && isDefaultWeapon(gl.name) ? signatureOf(gl.for) : "";
    const img = isW && gl.for && isDefaultWeapon(gl.name) ? (sig || gl.for) : gl.name;
    const rc = findResonator(isW ? gl.for : gl.name);
    return `<div class="goal">
      <div class="card"${rc ? ` style="--el:${EL_COLOR[rc.e]}"` : ""}>
        ${portrait(isW ? "weapons" : "resonators", img)}
        ${rc ? `<img class="el" src="${elIcon(rc.e)}" alt="${rc.e}" title="${rc.e}">` : ""}
        <div class="num">${i + 1}</div>
        <img class="type" src="assets/${isW ? "ic_sword" : "ic_person"}.png" alt="">
        <div class="tools">${canMove ? `<button class="mv" data-mv="${idx}" title="Pull earlier" aria-label="Pull earlier"></button>` : ""}<button class="rm" data-rm="${idx}" title="Remove" aria-label="Remove"></button></div>
        <div class="nm">${esc(sig || gl.name || (isW ? "Weapon" : "Resonator"))}${isW && gl.for ? `<small>for ${esc(gl.for)}</small>` : ""}${(() => { const rc = !isW && findResonator(gl.name); return rc && rc.soon ? `<small class="soon">Not released yet</small>` : ""; })()}</div>
      </div>
      <button class="gend" data-edit="${idx}" title="Change target or banner end">${isoOk(gl.end) ? endLabel(x.end) : `no date yet · ${fmtShort(x.end)}`}</button>
      <div class="gfoot">
        <div class="gp"><span>${i === 0 ? "Chance" : "up to here"}</span><b>${pct(x.prob)}</b></div>
        <div class="bar"><div class="fill${i === ev.per.length - 1 ? "" : " cyanfill"}" style="width:${x.prob * 100}%"></div></div>
        <div class="gg">${gtxt}</div>
      </div>
    </div>`;
  }).join("");
  box.innerHTML = html + `<button class="addcard" id="btnAddGoal">Add target</button>`;
  box.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { plan.goals.splice(+b.dataset.rm, 1); save(); calculate(); });
  box.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => moveGoal(+b.dataset.mv));
  box.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openGoalModal(+b.dataset.edit));
  $("#btnAddGoal").onclick = () => openGoalModal(-1);
}

/* Pull a target one step earlier (only within the same banner end and type). */
function moveGoal(idx) {
  const og = orderedGoals(plan);
  const pos = og.findIndex((x) => x.i === idx);
  const prev = og[pos - 1];
  if (!prev || prev.end !== og[pos].end) return;
  const j = prev.i;
  [plan.goals[idx], plan.goals[j]] = [plan.goals[j], plan.goals[idx]];
  save(); calculate();
}

function openGoalModal(idx = -1) {
  editGoal = idx;
  const gl = idx >= 0 ? plan.goals[idx] : null;
  $("#resList").innerHTML = RESONATORS.filter((c) => c.r === 5).map((c) => `<option value="${esc(c.n)}"${c.soon ? ` label="not released"` : ""}>`).join("");
  $("#goalName").value = gl ? gl.name : "";
  $("#goalFor").value = gl?.for || "";
  $("#goalMsg").textContent = "";
  setGoalType(gl && gl.type === "weapon" ? "weapon" : "char");
  fillBannerSelect(gl ? gl.end : null);
  $("#goalTitle").textContent = gl ? "Edit target" : "Add target";
  $("#goalOkTxt").textContent = gl ? "Save" : "Add";
  $("#goalModal").classList.remove("hidden");
  setTimeout(() => $("#goalName").focus(), 30);
}

function fillBannerSelect(end) {
  const today = isoOf(serverToday());
  const sel = $("#goalBanner");
  sel.innerHTML = [`<option value="">Date not known yet</option>`]
    .concat(BANNERS.filter((b) => b.end >= today).map((b) => `<option value="${b.end}">${esc(b.label)} (until ${fmtDate(b.end)})</option>`))
    .concat([`<option value="custom">Other date …</option>`]).join("");
  if (!isoOk(end)) sel.value = "";
  else if (BANNERS.some((b) => b.end === end && b.end >= today)) sel.value = end;
  else { sel.value = "custom"; $("#goalEnd").value = end; }
  $("#goalEndWrap").classList.toggle("hidden", sel.value !== "custom");
  updateGoalHint();
}

/* Explains what happens without a date (resonators that are not announced yet have no banner end). */
function updateGoalHint() {
  const v = $("#goalBanner").value, box = $("#goalHint");
  if (v === "custom") { box.textContent = "The date is optional. Leave it empty if you do not know it yet."; return; }
  if (v !== "") { box.textContent = ""; return; }
  const c = (goalType === "weapon" && findResonator($("#goalFor").value)) || findResonator($("#goalName").value);
  const today = isoOf(serverToday());
  const known = c && BANNERS.some((x) => x.end >= today && x.resonators.includes(c.n));
  box.innerHTML = `Without a date your pulls are counted until the default end (<b>${fmtDate(plan.endDate)}</b>). ` +
    (c && !known ? `${esc(c.n)} has no announced banner yet. ` : "") + `Change the default end on the Resources page, or set the date here once it is announced.`;
}

/* Pick the banner of a resonator automatically while typing. */
function suggestBanner() {
  const sel = $("#goalBanner");
  if (sel.value !== "") return;
  updateGoalHint();
  const c = (goalType === "weapon" && findResonator($("#goalFor").value)) || findResonator($("#goalName").value);
  if (!c) return;
  const today = isoOf(serverToday());
  const b = BANNERS.find((x) => x.end >= today && x.resonators.includes(c.n));
  if (b) sel.value = b.end;
  updateGoalHint();
}

/* Suggestions for the name field: resonator names for resonator targets, weapon names for weapon targets. */
function fillNameList(t) {
  const isW = t === "weapon";
  const names = new Set();
  if (isW) {
    for (const f of images?.cats?.weapons?.files || []) names.add(f.file.replace(/\.[^.]+$/, ""));
    for (const k of ["2", "4"]) for (const f of history?.pools?.[k]?.fives || []) names.add(f.name);
    for (const g of plan.goals || []) if (g.type === "weapon" && !isDefaultWeapon(g.name)) names.add(g.name);
    for (const n of WEAPON_NAMES) names.add(n);
    for (const n of Object.values(SIGNATURE)) names.add(n);
  } else {
    for (const c of RESONATORS) if (c.r === 5) names.add(c.n);
    for (const f of images?.cats?.resonators?.files || []) names.add(f.file.replace(/\.[^.]+$/, ""));
    for (const k of ["1", "3"]) for (const f of history?.pools?.[k]?.fives || []) names.add(f.name);
  }
  $("#nameList").innerHTML = [...names].sort().map((n) => `<option value="${esc(n)}">`).join("");
}

function setGoalType(t) {
  goalType = t;
  fillNameList(t);
  $$("#goalType .btn").forEach((b) => b.classList.toggle("on", b.dataset.type === t));
  $("#goalForWrap").classList.toggle("hidden", t !== "weapon");
  $("#goalName").placeholder = t === "weapon" ? "Weapon name (optional)" : "e.g. Hiyuki";
}

function addGoal() {
  const isW = goalType === "weapon";
  let name = $("#goalName").value.trim();
  let forN = $("#goalFor").value.trim();
  if (isW) {
    const fc = findResonator(forN);
    if (fc) forN = fc.n;
    if (!name) name = "Signature weapon";
  } else {
    const c = findResonator(name);
    if (c) name = c.n;
    if (!name) name = "Resonator";
  }
  const sel = $("#goalBanner").value;
  const end = sel === "custom" ? $("#goalEnd").value : sel;   // empty custom date = not known yet = default end
  const g = { type: isW ? "weapon" : "char", name: name.slice(0, 40) };
  if (isW && forN) g.for = forN.slice(0, 40);
  if (isoOk(end)) g.end = end;
  if (!Array.isArray(plan.goals)) plan.goals = [];
  if (editGoal >= 0 && plan.goals[editGoal]) plan.goals[editGoal] = g; else plan.goals.push(g);
  $("#goalModal").classList.add("hidden");
  save(); calculate();
}

/* ---------------------------------------------------------------- Analysis */
const DAY_TARGETS = [
  { k: 0.5, label: "50%" },
  { k: 0.75, label: "75%" },
  { k: 0.9, label: "90%" },
  { k: 1, label: "Guarantee" },
];

const curveCache = new Map();
function curveFor(ev) {
  const key = planKey(plan);
  if (!curveCache.has(key)) { curveCache.clear(); curveCache.set(key, buildCurve(plan, ev)); }
  return curveCache.get(key);
}

function renderAnalysis(ev, r, cp, g) {
  renderDayGoal(ev);
  const has = ev.N + ev.M > 0;
  const curve = has ? curveFor(ev) : [];
  drawChart(curve, ev.totalPulls, ev.worst, ev.prob, has);
  $("#chartNote").textContent = ev.groups > 1
    ? "Your targets have different banner ends. Each point adds or removes the same number of pulls at every banner end."
    : "";
  const at = (x) => { const c = curve.find((p) => p.y >= x - 1e-9); return c ? c.x : ev.worst; };
  const avg = ev.steps.reduce((s, st) => s + meanOf(st.dist), 0);
  $("#cKv").innerHTML = [
    ["Chance with your pulls", has ? pct(ev.prob) : "–"],
    ["Needed on average", has ? `${Math.round(avg)} pulls` : "–"],
    ["50% chance from", has ? `${at(0.5)} pulls` : "–"],
    ["90% chance from", has ? `${at(0.9)} pulls` : "–"],
    ["Guarantee from", has ? `${ev.worst} pulls` : "–"],
    ["Your pulls (Astrite / Tides)", `${ev.totalPulls} (${r.A} / ${r.R + r.F})`],
  ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("");

  const K = Math.min(8, Math.max(3, ev.N + 1));
  const dist = copiesDist(r.A + r.R, cp, g, K);
  let rows = "";
  for (let k = 1; k <= K; k++) {
    let p = 0;
    for (let w = k; w <= K; w++) p += dist[w];
    rows += `<div class="krow${k === ev.N ? " goal" : ""}"><span>at least ${k}</span><div class="bar"><div class="fill${k === ev.N ? "" : " cyanfill"}" style="width:${p * 100}%"></div></div><b>${pct(p)}</b></div>`;
  }
  $("#kTable").innerHTML = rows;
}

function renderDayGoal(ev) {
  const seg = $("#daySeg");
  seg.innerHTML = DAY_TARGETS.map((t) => `<button class="btn${+plan.dayTarget === t.k ? " on" : ""}" data-t="${t.k}">${t.label}</button>`).join("");
  seg.querySelectorAll("button").forEach((b) => {
    b.onclick = () => { plan.dayTarget = +b.dataset.t; save(); calculate(); };
  });
  const big = $("#dBig"), cap = $("#dCap"), bar = $("#dBar"), kv = $("#dKv"), tab = $("#dTable");
  if (ev.N + ev.M === 0) {
    big.className = "sbig"; big.textContent = "–"; cap.textContent = "Add a target on the Overview.";
    bar.style.width = "0%"; kv.innerHTML = ""; tab.innerHTML = "";
    return;
  }
  const t = DAY_TARGETS.find((x) => x.k === +plan.dayTarget) || DAY_TARGETS[0];
  const d = dailyFor(plan, t.k);
  const daily = ev.r.daily, end = ev.r.end;
  if (d === 0) {
    big.className = "sbig good"; big.innerHTML = `0<small>Astrite / day</small>`;
    cap.innerHTML = `For <b>${t.label}</b> your inventory and one-time sources are already enough.`;
    bar.style.width = "100%";
  } else if (!isFinite(d)) {
    big.className = "sbig bad"; big.textContent = "–";
    cap.textContent = "Not reachable in time: a banner ends before enough Astrite comes in.";
    bar.style.width = "0%";
  } else {
    const ok = d <= daily;
    big.className = "sbig" + (ok ? " good" : " gold");
    big.innerHTML = `${fmt(d)}<small>Astrite / day</small>`;
    cap.innerHTML = `For <b>${t.label}</b> you need <b>${fix1(d / PULL)}</b> pulls per day. You get <b>${daily}</b> Astrite from dailies and subscription.`;
    bar.style.width = Math.min(100, (daily / d) * 100) + "%";
  }
  const diff = d - daily;
  kv.innerHTML = [
    ["Already there (without daily income)", `<b>${fmt(astriteBy(plan, end, 0))} Astrite</b>`],
    ["Days with income until " + fmtDate(end), `<b>${incomeDays(plan, end)}</b>`],
    ["Astrite at the end with this goal", `<b>${isFinite(d) ? fmt(astriteBy(plan, end, Math.max(d, 0))) : "–"}</b>`],
    [diff > 0 ? "On top of your income" : "Buffer over your income",
      d === 0 || !isFinite(d) ? "<b>–</b>" : diff > 0 ? `<b class="bad">+${fmt(diff)} / day</b>` : `<b class="good">${fmt(-diff)} / day</b>`],
  ].map(([k, v]) => `<span>${k}</span>${v}`).join("");

  tab.innerHTML = `<div class="dt head"><span>Target</span><span>Pulls</span><span>Astrite / day</span><span>Status</span></div>` +
    DAY_TARGETS.map((x) => {
      const dd = dailyFor(plan, x.k);
      const pulls = isFinite(dd) ? budgetPulls(plan, end, dd) + ev.r.R + ev.r.F : "–";
      const per = dd === 0 || !isFinite(dd) ? "–" : fmt(dd);
      let st;
      if (dd === 0) st = `<b class="good">reached</b>`;
      else if (!isFinite(dd)) st = `<b class="bad">too late</b>`;
      else if (dd <= daily) st = `<b class="good">enough</b>`;
      else st = `<b class="bad">+${fmt(dd - daily)}</b>`;
      return `<div class="dt${x.k === t.k ? " sel" : ""}"><span>${x.label}</span><span>${pulls}</span><span>${per}</span>${st}</div>`;
    }).join("");
}

/* ---------------------------------------------------------------- Scenarios */
function cloneBase(p) {
  const c = structuredClone(p);
  delete c.scenarios; delete c.roster; delete c.myTeams;
  return c;
}

function variantsOf(p) {
  const out = [];
  const add = (name, mut) => { const c = cloneBase(p); mut(c); out.push({ name, plan: c }); };
  const src = p.sources || [];
  if (src.some((s) => !s.on)) add("With all sources", (c) => c.sources.forEach((s) => { s.on = true; }));
  if (src.some((s) => s.on)) add("Without other sources", (c) => c.sources.forEach((s) => { s.on = false; }));
  if (+p.lunite > 0) add(p.useLunite ? "Without Lunite" : "With Lunite", (c) => { c.useLunite = !p.useLunite; });
  add(p.sub ? "Without Lunite subscription" : "With Lunite subscription", (c) => { c.sub = !p.sub; });
  add(p.guaranteed ? "50/50 instead of guarantee" : "Guarantee instead of 50/50", (c) => { c.guaranteed = !p.guaranteed; });
  const { N, M } = goalCounts(p.goals);
  const chars = orderedGoals(p).filter((x) => x.g.type !== "weapon");
  if (M > 0) add("Without weapons", (c) => { c.goals = c.goals.filter((g) => g.type !== "weapon"); });
  else if (N > 0) {
    const lc = chars[chars.length - 1].g;
    add(`Plus ${lc.name}'s signature weapon`, (c) => { c.goals.push({ type: "weapon", name: "Signature weapon", for: lc.name, ...(lc.end ? { end: lc.end } : {}) }); });
  }
  if (N > 1) {
    const last = chars[chars.length - 1];
    add(`Without ${last.g.name}`, (c) => { c.goals.splice(last.i, 1); });
  }
  if (new Set(orderedGoals(p).map((x) => x.end)).size > 1) {
    const h = horizon(p);
    add("Everything by the last banner end", (c) => c.goals.forEach((g) => { g.end = h; }));
  }
  return out;
}

function scenRow(name, ev, base, extra = "", cls = "") {
  const d = Math.round((ev.prob - base.prob) * 100);
  const delta = cls === "base" ? "" : d === 0 ? "±0" : d > 0 ? "+" + d : "−" + Math.abs(d);
  const dcls = d > 0 ? "good" : d < 0 ? "bad" : "";
  const gar = ev.N + ev.M === 0 ? "–" : ev.guaranteed ? `<b class="good">yes</b>` : `<b class="bad">−${ev.missPulls}</b>`;
  return `<div class="sc ${cls}">
    <span class="nm">${esc(name)}</span>
    <span class="num">${ev.totalPulls}</span>
    <span class="barcell"><span class="bar"><span class="fill${cls === "base" ? "" : " cyanfill"}" style="width:${ev.prob * 100}%"></span></span></span>
    <b class="pc">${ev.N + ev.M ? pct(ev.prob) : "–"}</b>
    <span class="dl ${dcls}">${delta}</span>
    <span class="num">${gar}</span>
    <span class="act">${extra}</span>
  </div>`;
}

function renderScenarios(evNow) {
  const head = `<div class="sc head"><span>Scenario</span><span>Pulls</span><span></span><span>Chance</span><span>Δ</span><span>Guarantee</span><span></span></div>`;
  let html = head + scenRow("Current plan", evNow, evNow, "", "base");
  const vars = variantsOf(plan);
  if (vars.length) html += `<div class="sc sect"><span>What if</span></div>`;
  for (const v of vars) html += scenRow(v.name, evalPlan(v.plan), evNow);
  const saved = plan.scenarios || [];
  if (saved.length) html += `<div class="sc sect"><span>Saved</span></div>`;
  saved.forEach((s, i) => {
    html += scenRow(s.name, evalPlan(s.plan), evNow,
      `<button class="mini" data-load="${i}">Load</button><button class="mini del" data-del="${i}" title="Delete" aria-label="Delete"></button>`);
  });
  const box = $("#scenTable");
  box.innerHTML = html;
  box.querySelectorAll("[data-load]").forEach((b) => b.onclick = () => loadScenario(+b.dataset.load));
  box.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { plan.scenarios.splice(+b.dataset.del, 1); save(); calculate(); });
}

function loadScenario(i) {
  const s = (plan.scenarios || [])[i];
  if (!s) return;
  plan = migrate({
    ...structuredClone(s.plan), scenarios: plan.scenarios, dayTarget: plan.dayTarget,
    roster: plan.roster, myTeams: plan.myTeams, teamBuild: plan.teamBuild, usePlanned: plan.usePlanned, setSize: plan.setSize,
  });
  plan.model = setModel(plan.model); fillModel(); $("#serverSel").value = plan.server;
  fillInputs(); renderSources(); save(); calculate(); pityNote();
}

function saveScenario() {
  if (!Array.isArray(plan.scenarios)) plan.scenarios = [];
  if (plan.scenarios.length >= 8) { $("#scenMsg").textContent = "8 scenarios at most. Delete one to make room."; return; }
  const inp = $("#scenName");
  const name = inp.value.trim() || `Scenario ${plan.scenarios.length + 1}`;
  plan.scenarios.push({ name: name.slice(0, 40), plan: cloneBase(plan) });
  inp.value = ""; $("#scenMsg").textContent = "";
  save(); calculate();
}

/* ---------------------------------------------------------------- Roster & Teams */
const BUILDS = [
  { k: "casual", label: "Casual", tip: "Echoes partly built, some skills not maxed" },
  { k: "solid", label: "Solid", tip: "Good echoes, main skills leveled" },
  { k: "optimised", label: "Optimised", tip: "Tuned echoes and substats, everything maxed" },
];
const elIcon = (e) => `assets/el_${String(e).toLowerCase()}.png`;
const seqTxt = (x) => `S${x.s | 0}`;
const weapTxt = (x) => (x.w > 0 ? `R${x.w}` : "No sig.");

/* Owned resonators as a Map name -> {s, w, planned, goalIdx}. Optionally adds pull targets. */
/* Signature weapon level of a resonator: the value on the roster card or the weapon set in Teams > Weapons, whichever is higher. */
function sigRank(name, rosterW, ow) {
  const sig = SIGNATURE[name], o = sig && (ow || ownedWeapons()).get(sig);
  return Math.max(rosterW | 0, o ? o.r | 0 : 0);
}
function ownedMap(withPlanned = !!plan.usePlanned) {
  const m = new Map();
  const ow = ownedWeapons();
  for (const [n, v] of Object.entries(plan.roster || {})) {
    if (RES_BY_NAME.has(n)) m.set(n, { s: v.s | 0, w: sigRank(n, v.w, ow) });
  }
  if (withPlanned) {
    // Pull order: resonators first, then weapons (so a weapon target finds its planned resonator).
    for (const gc of goalChances()) {
      const g = gc.goal;
      const mark = (x) => { x.planned = true; x.goalIdx = gc.idx; x.prob = gc.ev.prob; };
      if (g.type === "weapon") {
        const k = normKey(g.name);
        const c = (g.for && findResonator(g.for)) ||
          RESONATORS.find((r) => { const rk = normKey(r.n.replace(/\s*\(.*\)/, "")); return rk.length >= 3 && k.includes(rk); });
        const x = c && m.get(c.n);
        if (x) { x.w = Math.min(5, x.w + 1); mark(x); }
        continue;
      }
      const c = findResonator(g.name);
      if (!c) continue;
      const x = m.get(c.n);
      if (x) { x.s = Math.min(6, x.s + 1); mark(x); }
      else { const y = { s: 0, w: 0, newFromGoal: true }; mark(y); m.set(c.n, y); }
    }
  }
  return m;
}

/* Probability that you own every planned member by banner end. */
function teamPullChance(t, owned) {
  let worst = -1, prob = 1;
  for (const n of t.members) {
    const x = owned.get(n);
    if (x && x.planned && x.goalIdx > worst) { worst = x.goalIdx; prob = x.prob; }
  }
  return worst < 0 ? 1 : prob;
}

function setTeamTab(t) {
  teamTab = t;
  $$("#teamTabs .btn").forEach((b) => {
    const on = b.dataset.ttab === t;
    b.classList.toggle("on", on);
    const img = b.querySelector("img");
    if (img) img.src = on ? img.dataset.dark : img.dataset.light;
  });
  ["roster", "weapons", "meta", "best", "mine"].forEach((k) => $("#tt-" + k).classList.toggle("hidden", k !== t));
  try { localStorage.setItem("wuwaTeamTab", t); } catch (e) { /* ignore */ }
  renderTeamsPage();
}

function renderTeamsPage() {
  if (teamTab === "roster") renderRoster();
  else if (teamTab === "weapons") renderWeapons();
  else if (teamTab === "meta") renderMetaTeams();
  else if (teamTab === "best") renderBestTeams();
  else renderMyTeams();
}

function elSegHtml(active, withAll = true) {
  return (withAll ? [`<button class="btn${active === "All" ? " on" : ""}" data-el="All">All</button>`] : []).concat(
    ELEMENTS.map((e) => `<button class="btn${active === e ? " on" : ""}" data-el="${e}" title="${e}"><img src="${elIcon(e)}" alt="">${e}</button>`)).join("");
}

function renderRoster() {
  const roster = plan.roster || {};
  const owned = Object.keys(roster).filter((n) => RES_BY_NAME.has(n));
  const fives = owned.filter((n) => RES_BY_NAME.get(n).r === 5);
  const sigs = owned.filter((n) => (roster[n].w | 0) > 0);
  const teams = buildTeams(ownedMap(false), plan.teamBuild);
  const set = bestTeamSet(teams, 2);
  $("#rosterSum").innerHTML = [
    ["Resonators", `${owned.length}<small>/ ${RESONATORS.filter((c) => !c.soon).length}</small>`],
    ["5★ resonators", String(fives.length)],
    ["Signature weapons", String(sigs.length)],
    ["Teams you can build", String(teams.length)],
    ["Best 2-team lineup", set ? `${pct(set.reduce((p, t) => p * t.chance, 1))}<small>clear</small>` : "–"],
  ].map(([k, v], i) => `<div class="hs${i === 4 ? " hl" : ""}"><span>${k}</span><b>${v}</b></div>`).join("");

  const seg = $("#elSeg");
  seg.innerHTML = elSegHtml(rosterEl);
  seg.querySelectorAll("[data-el]").forEach((b) => b.onclick = () => { rosterEl = b.dataset.el; renderRoster(); });

  const q = normKey($("#rosterSearch").value);
  const only = $("#ownedOnly").checked, favOnly = $("#favOnly").checked;
  const list = RESONATORS
    .filter((c) => rosterEl === "All" || c.e === rosterEl)
    .filter((c) => !q || normKey(c.n).includes(q))
    .filter((c) => !only || roster[c.n])
    .filter((c) => !favOnly || isFav("r", c.n))
    .sort((a, b) => (!!a.soon - !!b.soon) || (isFav("r", b.n) - isFav("r", a.n)) || (!!roster[b.n] - !!roster[a.n]) || (b.r - a.r) || ELEMENTS.indexOf(a.e) - ELEMENTS.indexOf(b.e) || a.n.localeCompare(b.n));
  const ow = ownedWeapons();
  $("#rosterGrid").innerHTML = list.length ? list.map((c) => {
    const x0 = roster[c.n], x = x0 && { ...x0, w: sigRank(c.n, x0.w, ow) };
    return `<div class="rc r${c.r}${x ? " owned" : ""}${c.soon ? " soon" : ""}" data-n="${esc(c.n)}" style="--el:${EL_COLOR[c.e]}">
      <button class="rimg" data-toggle title="${c.soon ? "Not released yet" : x ? "Owned. Click to remove" : "Click to mark as owned"}">
        ${portrait("resonators", c.n)}
        <img class="el" src="${elIcon(c.e)}" alt="${c.e}">
        ${c.soon ? `<span class="role soon">Not released</span>` : `<span class="role">${ROLE_LABEL[c.role]}</span>`}
        <span class="own"></span>
        <span class="rname">${esc(c.n)}</span>
      </button>
      ${favBtn("r", c.n)}${c.soon || !CHAR_BUILDS.has(c.n) ? "" : `<button class="rcopen" data-open="${esc(c.n)}" title="Open the character page" aria-label="Open the character page"></button>`}
      <div class="rctl">${x ? `
        <div class="stp" title="Sequence"><button data-d="s-1" aria-label="Lower sequence"></button><b>${seqTxt(x)}</b><button data-d="s1" aria-label="Raise sequence"></button></div>
        <div class="stp" title="Signature weapon (none or R1 to R5)"><button data-d="w-1" aria-label="Lower refinement"></button><b class="${x.w > 0 ? "" : "dim"}">${x.w > 0 ? "R" + x.w : "None"}</b><button data-d="w1" aria-label="Raise refinement"></button></div>`
      : `<span class="nown">${c.soon ? "Announced" : "Not owned"}</span>`}</div>
    </div>`;
  }).join("") : `<div class="empty">No resonator matches.</div>`;
  $$("#rosterGrid .rc").forEach((card) => {
    const n = card.dataset.n;
    card.querySelector("[data-toggle]").onclick = () => {
      if (RES_BY_NAME.get(n) && RES_BY_NAME.get(n).soon) return;   // cannot own a resonator that is not released
      if (!plan.roster) plan.roster = {};
      if (plan.roster[n]) delete plan.roster[n]; else plan.roster[n] = { s: 0, w: 0 };
      save(); renderRoster();
    };
    card.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => {
      const d = b.dataset.d, x = plan.roster[n];
      const k = d[0], step = +d.slice(1);
      if (k === "s") x.s = Math.max(0, Math.min(6, (x.s | 0) + step));
      else {
        // the weapon list (Teams > Weapons) and this card describe the same signature weapon: keep them in step
        const nw = Math.max(0, Math.min(5, sigRank(n, x.w) + step));
        x.w = nw;
        const sg = SIGNATURE[n], key = sg && Object.keys(plan.weapons || {}).find((k) => findWeapon(k) && findWeapon(k).n === sg);
        if (key) { if (nw > 0) plan.weapons[key].r = nw; else delete plan.weapons[key]; }
      }
      save(); renderRoster();
    });
  });
}

function importRosterFromHistory() {
  const box = $("#rosterMsg");
  const counts = history?.counts;
  if (!counts || !Object.keys(counts).length) {
    box.className = "msg err";
    box.textContent = "No history loaded yet. Click Fetch history first.";
    return;
  }
  if (!plan.roster) plan.roster = {};
  let added = 0, raised = 0;
  for (const [name, n] of Object.entries(counts)) {
    const c = findResonator(name);
    if (!c) continue;
    const s = Math.min(6, Math.max(0, n - 1));
    const cur = plan.roster[c.n];
    if (!cur) { plan.roster[c.n] = { s, w: 0 }; added++; }
    else if (s > (cur.s | 0)) { cur.s = s; raised++; }
  }
  save(); renderRoster();
  box.className = "msg ok";
  box.textContent = added || raised ? `Done: ${added} added, ${raised} sequences raised.` : "Your roster already matches your history.";
}

/* ---------------------------------------------------------------- weapons you own */
/* Inventory plus the signature weapons set on the roster cards (R1 to R5). Map name -> {r, n} */
function ownedWeapons() {
  const m = new Map();
  for (const [n, v] of Object.entries(plan.weapons || {})) if (findWeapon(n)) m.set(findWeapon(n).n, { r: v.r || 1, n: v.n || 1 });
  for (const [c, v] of Object.entries(plan.roster || {})) {
    const sig = SIGNATURE[c];
    if (!sig || !(v.w > 0) || !findWeapon(sig)) continue;
    const o = m.get(sig);
    if (!o) m.set(sig, { r: v.w, n: 1 });
    else o.r = Math.max(o.r, v.w);
  }
  return m;
}
function wImg(name) { return webImg("weapons", name); }
const WPH = "assets/ph_weapon.png";
function weaponSquare(charName, a) {
  if (!CHAR_BUILDS.has(charName)) return "";
  if (!a) return `<span class="wsq none" title="No ${esc(CHAR_BUILDS.get(charName).wt.toLowerCase())} in your weapon list (Teams > Weapons)">?</span>`;
  const best = CHAR_BUILDS.get(charName).w[0] === a.w;
  return `<span class="wsq${best ? " bis" : ""}" title="${esc(a.w)} R${a.r}${best ? " (best weapon)" : ""}"><img src="${wImg(a.w)}" alt="" onerror="this.onerror=null;this.src='${WPH}'"><b>R${a.r}</b></span>`;
}

let wType = "All", wShowAll = false;
function renderWeapons() {
  const inv = plan.weapons || (plan.weapons = {});
  const owned = ownedWeapons();
  const fives = [...owned.keys()].filter((n) => findWeapon(n).r === 5).length;
  $("#wSum").innerHTML = [
    ["Weapons", String(owned.size)],
    ["5★ weapons", String(fives)],
    ["Signature weapons", String([...owned.keys()].filter((n) => Object.values(SIGNATURE).includes(n)).length)],
  ].map(([k, v]) => `<div class="hs"><span>${k}</span><b>${v}</b></div>`).join("");
  const seg = $("#wTypeSeg");
  seg.innerHTML = ["All", ...WEAPON_TYPES].map((t) => `<button class="btn${wType === t ? " on" : ""}" data-wt="${t}">${t}</button>`).join("");
  seg.querySelectorAll("[data-wt]").forEach((b) => b.onclick = () => { wType = b.dataset.wt; renderWeapons(); });
  const q = normKey($("#wSearch").value), only = $("#wOwnedOnly").checked;
  const low = $("#wLow").checked;
  const sigOf = new Map(Object.entries(SIGNATURE).map(([c, w]) => [w, c]));
  const list = [...WEAPONS.values()]
    .filter((w) => wType === "All" || w.t === wType)
    .filter((w) => !q || normKey(w.n).includes(q) || normKey(sigOf.get(w.n) || "").includes(q))
    .filter((w) => !only || owned.has(w.n))
    .filter((w) => low || w.r >= 4 || owned.has(w.n))
    .sort((a, b) => (isFav("w", b.n) - isFav("w", a.n)) || (owned.has(b.n) - owned.has(a.n)) || (b.r - a.r) || WEAPON_TYPES.indexOf(a.t) - WEAPON_TYPES.indexOf(b.t) || a.n.localeCompare(b.n));
  $("#wGrid").innerHTML = list.length ? list.map((w) => {
    const o = owned.get(w.n), fromRoster = o && !inv[w.n];
    return `<div class="wc r${w.r}${o ? " owned" : ""}" data-w="${esc(w.n)}">
      <button class="wimg" data-toggle title="${o ? (fromRoster ? "Set on the roster card of " + esc(sigOf.get(w.n)) : "Owned. Click to remove") : "Click to mark as owned"}">
        <img src="${wImg(w.n)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${WPH}'">
        <span class="wstars">${"★".repeat(w.r)}</span>
        <span class="own"></span>
      </button>
      ${favBtn("w", w.n)}
      <div class="wname">${esc(w.n)}</div>
      <div class="wmeta">${w.t}${sigOf.has(w.n) ? ` · <span class="sigof">${esc(sigOf.get(w.n))}</span>` : ""}</div>
      ${(() => { const st = weaponStatText(w); return st ? `<div class="wstat" title="Level 90, refinement not counted"><span><em>ATK</em><b>${st.a}</b></span><span><em>${esc(st.name)}</em><b>${st.val}%</b></span></div>` : w.r >= 4 ? `<div class="wstat none"><span>Stats not added yet</span></div>` : ""; })()}
      <div class="rctl">${o ? `
        <div class="stp" title="Refinement"><button data-d="r-1" aria-label="Lower refinement"></button><b>R${o.r}</b><button data-d="r1" aria-label="Raise refinement"></button></div>
        <div class="stp" title="Copies"><button data-d="n-1" aria-label="Fewer copies"></button><b>×${o.n}</b><button data-d="n1" aria-label="More copies"></button></div>`
      : `<span class="nown">Not owned</span>`}</div>
    </div>`;
  }).join("") : `<div class="empty">No weapon matches.</div>`;
  $$("#wGrid .wc").forEach((card) => {
    const n = card.dataset.w;
    const sigChar = sigOf.get(n);
    card.querySelector("[data-toggle]").onclick = () => {
      if (inv[n]) delete inv[n];
      else if (owned.has(n) && sigChar && plan.roster[sigChar]) plan.roster[sigChar].w = 0; // set on the roster card
      else inv[n] = { r: 1, n: 1 };
      save(); renderWeapons();
    };
    card.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => {
      const k = b.dataset.d[0], step = +b.dataset.d.slice(1);
      const cur = owned.get(n);
      const o = inv[n] || (inv[n] = { r: cur.r, n: cur.n });
      if (k === "r") o.r = Math.max(1, Math.min(5, o.r + step));
      else o.n = Math.max(1, Math.min(9, o.n + step));
      if (sigChar && plan.roster[sigChar] && plan.roster[sigChar].w > 0) plan.roster[sigChar].w = o.r;
      save(); renderWeapons();
    });
  });
}

/* ---------------------------------------------------------------- Builds page */
let buildSel = null, buildEl = "All";
function prydwenUrl(n) {
  const slug = n === "Shorekeeper" ? "the-shorekeeper" : n.toLowerCase().replace(/[():]/g, "").trim().replace(/\s+/g, "-");
  return `https://www.prydwen.gg/wuthering-waves/characters/${slug}`;
}
/* ---------------------------------------------------------------- Favorites */
const isFav = (kind, n) => !!(plan.fav && plan.fav[kind] && plan.fav[kind][n]);
function toggleFav(kind, n) {
  if (!plan.fav) plan.fav = { r: {}, w: {} };
  if (!plan.fav[kind]) plan.fav[kind] = {};
  if (plan.fav[kind][n]) delete plan.fav[kind][n]; else plan.fav[kind][n] = 1;
  save();
}
const favBtn = (kind, n, cls = "") => `<button class="fav${cls ? " " + cls : ""}${isFav(kind, n) ? " on" : ""}" data-fav="${kind}" data-n="${esc(n)}" title="${isFav(kind, n) ? "Remove from favorites" : "Add to favorites"}" aria-label="Favorite" aria-pressed="${isFav(kind, n)}">★</button>`;

function renderBuilds() {
  const seg = $("#bElSeg");
  seg.innerHTML = elSegHtml(buildEl);
  seg.querySelectorAll("[data-el]").forEach((b) => b.onclick = () => { buildEl = b.dataset.el; renderBuilds(); });
  const roster = plan.roster || {};
  const q = normKey($("#bSearch").value);
  const list = RESONATORS.filter((c) => CHAR_BUILDS.has(c.n))
    .filter((c) => buildEl === "All" || c.e === buildEl)
    .filter((c) => !q || normKey(c.n).includes(q))
    .sort((a, b) => (isFav("r", b.n) - isFav("r", a.n)) || (!!roster[b.n] - !!roster[a.n]) || (b.r - a.r) || a.n.localeCompare(b.n));
  if (!buildSel || !CHAR_BUILDS.has(buildSel)) buildSel = (list[0] || RESONATORS[0]).n;
  $("#bList").innerHTML = list.map((c) => `<button class="pk${roster[c.n] ? "" : " notown"}${c.n === buildSel ? " sel" : ""}" data-b="${esc(c.n)}" style="--el:${EL_COLOR[c.e]}">
      <span class="tmimg">${portrait("resonators", c.n)}<img class="el" src="${elIcon(c.e)}" alt=""></span>
      ${isFav("r", c.n) ? `<i class="favmark" title="Favorite">\u2605</i>` : ""}<span class="tmn">${esc(c.n)}</span></button>`).join("") || `<div class="empty">No resonator matches.</div>`;
  $$("#bList [data-b]").forEach((b) => b.onclick = () => { buildSel = b.dataset.b; renderBuilds(); if (innerWidth < 900) $("#bDetail").scrollIntoView({ behavior: "smooth" }); });

  const c = RES_BY_NAME.get(buildSel), b = CHAR_BUILDS.get(buildSel);
  const owned = ownedWeapons();
  const myRes = ownedMap(false).get(c.n);
  const mine = [...owned].map(([n, o]) => ({ n, o, sc: weaponScore(c.n, n, o.r) })).filter((x) => x.sc >= 0).sort((x, y) => y.sc - x.sc)[0];
  const listed = new Set(b.w);
  const SUB = { crit: "CRIT", atk: "ATK%", er: "Energy Regen", hp: "HP%", def: "DEF%" };

  /* one weapon as a photo tile; kind: "best" | "alt" | "more" */
  const showDmg = c.role !== "heal";   // for healers weapon damage is not what matters
  const dmg = (n) => (showDmg ? weaponDmgPct(c.n, b.w[0], n) : null);
  const wTile = (n, kind, label) => {
    const w = findWeapon(n), o = owned.get(n), d = dmg(n), sc = d ? Math.max(0, Math.min(100, 100 + d.pct)) : Math.max(0, Math.min(100, weaponScore(c.n, n, 1)));
    const sig = SIGNATURE[c.n] === n, other = !sig && Object.values(SIGNATURE).includes(n);
    const st = weaponStatText(w);
    return `<div class="wt ${kind}${o ? " have" : ""}" title="${esc(n)}${w ? " · " + w.r + "★" + (st ? " · " + st.atk + " · " + st.sub : " · " + (SUB[w.s] || "")) : ""}">
      <span class="wtimg"><img src="${wImg(n)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${WPH}'">${o ? `<i class="wtown">R${o.r}</i>` : ""}</span>
      <span class="wtlab">${esc(label)}</span>
      <b class="wtn">${esc(n)}</b>
      <small>${w ? "★".repeat(w.r) : ""}${sig ? " · Signature" : other ? " · Other's signature" : ""}</small>
      ${st ? `<span class="wtst"><span><em>ATK</em> ${st.a}</span><span><em>${esc(st.name)}</em> ${st.val}%</span></span>` : w && SUB[w.s] ? `<span class="wtst"><span><em>Substat</em> ${SUB[w.s]}</span></span>` : ""}
      ${d ? `<span class="wtdmg ${d.ref ? "ref" : d.tested ? "tested" : "est"}" title="${d.ref ? "Reference weapon" : d.tested ? "Tested in game" + (d.lib != null ? ": Liberation DMG " + (d.lib > 0 ? "+" : "") + d.lib + "%" : "") : "Rough estimate from stats, passive not counted"}">${d.ref ? "100%" : (d.tested ? "" : "\u2248 ") + (d.pct > 0 ? "+" : d.pct < 0 ? "\u2212" : "") + (d.tested ? Math.abs(d.pct).toFixed(1) : Math.round(Math.abs(d.pct))) + "%"}<em>${d.ref ? "reference" : d.tested ? "tested" : "est."}</em></span>` : ""}
      <span class="wtbar"><i style="width:${sc}%"></i></span>
    </div>`;
  };
  const moreAll = [...WEAPONS.values()]
    .filter((w) => w.t === b.wt && !listed.has(w.n) && (w.r >= 4 || owned.has(w.n)))
    .map((w) => { const d = dmg(w.n); return { w, sc: d ? d.pct : weaponScore(c.n, w.n, 1) }; })
    .sort((x, y) => y.sc - x.sc || y.w.r - x.w.r);
  const more = moreAll.slice(0, 8).concat(moreAll.slice(8).filter((x) => owned.has(x.w.n)).slice(0, 4));
  const test = DMG_TESTS[c.n] && DMG_TESTS[c.n].ref === b.w[0] ? DMG_TESTS[c.n] : null;
  const dmgNote = !showDmg ? `Damage differences are not shown for healers, their weapon matters for energy, healing and buffs.`
    : `Percentages are the damage difference to <b>${esc(b.w[0])}</b>.` + (test ? ` <b>Tested</b> values are from in-game runs (${esc(test.metric)}, Lv 90, R1; <a href="${test.src.url}" target="_blank" rel="noopener">${esc(test.src.label)}</a>).` : "")
      + ` <b>Est.</b> is a rough estimate from base ATK, substat and a typical ATK passive. Real weapon passives are not counted, so the real gap can be bigger or smaller.`;

  /* stat chips with an icon */
  const statIcon = (t) => {
    const l = t.toLowerCase();
    const el = ELEMENTS.find((x) => l.includes(x.toLowerCase()));
    if (el) return elIcon(el);
    if (/crit/.test(l)) return "assets/ic_star.png";
    if (/energy/.test(l)) return "assets/ic_sync.png";
    if (/atk/.test(l)) return "assets/ic_sword.png";
    if (/hp|def/.test(l)) return "assets/ic_shield.png";
    if (/heal/.test(l)) return "assets/ic_plus.png";
    return "";
  };
  const statChips = (txt) => !txt || txt === "–" ? `<span class="chip none">none</span>`
    : txt.split(/\s+or\s+|\s*&\s*/).map((t) => { const ic = statIcon(t); return `<span class="chip">${ic ? `<img src="${ic}" alt="">` : ""}${esc(t)}</span>`; }).join(`<span class="orsep">or</span>`);
  const setChip = (p) => {
    const m = /^(\d)-pc\s+(.*)$/.exec(p);
    const si = webImg("echosets", (m ? m[2] : p).replace(/\s*\(.*\)\s*$/, ""));
    const icon = si ? `<img src="${si}" alt="" loading="lazy" onerror="this.remove()">` : "";
    return `<span class="chip set">${icon}${m ? `<em>${m[1]}</em>${esc(m[2])}` : esc(p)}</span>`;
  };
  const setChips = (txt) => txt.split(/\s*\+\s*/).map((p) => p.split(/\s+or\s+/).map(setChip).join(`<span class="orsep">or</span>`)).join("");

  /* teams that use this resonator */
  const tierRank = (t) => parseFloat(t.tier.slice(1));
  const asCarry = TEAM_TEMPLATES.filter((t) => t.slots[0].includes(c.n)).sort((x, y) => tierRank(x) - tierRank(y));
  const asHelper = TEAM_TEMPLATES.filter((t) => !t.slots[0].includes(c.n) && (t.slots[1].includes(c.n) || t.slots[2].includes(c.n))).sort((x, y) => tierRank(x) - tierRank(y));
  const pt = (n, cls = "") => {
    const r = RES_BY_NAME.get(n);
    return `<span class="pt${cls}${n === c.n ? " me" : ""}${r && ownedMap(false).has(n) ? "" : " notown"}" title="${esc(n)}">${portrait("resonators", n)}${r ? `<img class="el" src="${elIcon(r.e)}" alt="">` : ""}<small>${esc(n.replace(/^Rover \((.*)\)$/, "Rover $1").replace(/^Yangyang: /, ""))}</small></span>`;
  };
  const teamBlock = (t, carry) => `<div class="bteam"><div class="bth"><span class="tier t${t.tier.replace(".", "")}">${t.tier}</span><b>${esc(t.name)}</b></div>
      <div class="btslots">${t.slots.map((g, i) => `<div class="btg"><span class="btl">${["Carry", "Sub-DPS / support", "Support / healer"][i]}</span><div>${g.map((n) => pt(n)).join("")}</div></div>`).join("")}</div></div>`;

  /* quick facts: meta tier, banner, target */
  const todayIso = isoOf(serverToday());
  const bnr = BANNERS.filter((x) => x.resonators.includes(c.n) && x.end > todayIso).sort((x, y) => (x.start < y.start ? -1 : 1))[0];
  const inTargets = (plan.goals || []).some((g) => g.type === "char" && g.name === c.n);
  const bestTier = (list) => list.length ? list[0].tier : null;
  const tCarry = bestTier(asCarry), tHelp = bestTier(asHelper);
  const facts = [
    tCarry ? `<span class="fact"><em>Meta</em> ${tCarry} carry</span>` : tHelp ? `<span class="fact"><em>Meta</em> ${tHelp} support</span>` : `<span class="fact"><em>Meta</em> not in the tier list</span>`,
    c.soon ? `<span class="fact"><em>Banner</em> not released yet</span>`
      : bnr ? `<span class="fact on"><em>Banner</em> ${bnr.start <= todayIso ? "now" : "from " + fmtShort(bnr.start)}: ${esc(bnr.label)}, until ${fmtShort(bnr.end)}</span>` : `<span class="fact"><em>Banner</em> none in the calendar</span>`,
    myRes || c.soon ? "" : inTargets ? `<span class="fact on"><em>Target</em> on your list</span>` : `<button class="link" id="bAddTarget">Add as pull target</button>`,
  ].filter(Boolean).join("");

  $("#bDetail").innerHTML = `
    <div class="bhead" style="--el:${EL_COLOR[c.e]}">
      <span class="tmimg big">${portrait("resonators", c.n)}<img class="el" src="${elIcon(c.e)}" alt=""></span>
      <div>
        <h2 class="bname">${esc(c.n)}${favBtn("r", c.n, "inline")}</h2>
        <div class="bchips"><span class="chip"><img src="${elIcon(c.e)}" alt="">${c.e}</span><span class="chip">${"★".repeat(c.r)}</span><span class="chip">${b.wt}</span><span class="chip">${ROLE_LABEL[c.role]}</span></div>
        <div class="bmine">${myRes ? `You own ${esc(c.n)}: S${myRes.s}${myRes.w > 0 ? ", signature R" + myRes.w : ", no signature weapon"}.` : `You do not own ${esc(c.n)} yet.`}
          ${mine ? `Best fitting weapon in your list: <b>${esc(mine.n)}</b> R${mine.o.r}.` : `No ${b.wt.toLowerCase()} in your weapon list yet.`}
          <button class="link" id="bToWeapons">Edit weapons</button></div>
        <div class="bfacts">${facts}</div>
      </div>
    </div>

    <div class="bsec"><div class="label">Best weapon <em>damage compared to it, see below</em></div>
      <div class="wtgrid one">${wTile(b.w[0], "best", "Best in slot")}</div></div>
    ${b.w.length > 1 ? `<div class="bsec"><div class="label">Alternatives <em>from the build guides</em></div>
      <div class="wtgrid">${b.w.slice(1).map((n, i) => wTile(n, "alt", "Alternative " + (i + 1))).join("")}</div></div>` : ""}
    ${more.length ? `<div class="bsec"><div class="label">More ${b.wt.toLowerCase()} options <em>${showDmg ? "sorted by damage" : "rated by rarity and substat"}</em></div>
      <div class="wtgrid">${more.map(({ w }) => wTile(w.n, "more", w.r === 5 ? "5★ stat stick" : "4★ budget")).join("")}</div>
      </div>` : ""}

    <div class="note bdmgnote">${dmgNote} A golden frame means you own the weapon.</div>

    <div class="bsec"><div class="label">Echoes</div>
      <div class="brow"><span class="bk">Echo set</span><div>${setChips(b.set)}</div></div>
      <div class="brow"><span class="bk">Main echo</span><div><span class="chip echo">${esc(b.echo)}</span></div></div></div>
    <div class="bsec"><div class="label">Echo main stats</div>
      <div class="brow"><span class="bk">4-cost</span><div>${statChips(b.ms[0])}</div></div>
      <div class="brow"><span class="bk">3-cost</span><div>${statChips(b.ms[1])}</div></div>
      <div class="brow"><span class="bk">1-cost</span><div>${statChips(b.ms[2])}</div></div></div>

    ${asCarry.length ? `<div class="bsec"><div class="label">Best teams <em>${esc(c.n)} as the carry</em></div>${asCarry.slice(0, 4).map((t) => teamBlock(t)).join("")}</div>` : ""}
    ${asHelper.length ? `<div class="bsec"><div class="label">Used as support in</div>${asHelper.slice(0, 4).map((t) => teamBlock(t)).join("")}</div>` : ""}

    <div class="bsec blinks"><div class="label">More details</div>
      <a href="${BUILD_INFO.sites[0].url}" target="_blank" rel="noopener">Game8 builds</a>
      <a href="${prydwenUrl(c.n)}" target="_blank" rel="noopener">Prydwen: ${esc(c.n)}</a></div>`;
  $("#bToWeapons").onclick = () => { showPage("teams"); setTeamTab("weapons"); };
  const at = $("#bAddTarget");
  if (at) at.onclick = () => { plan.goals.push({ type: "char", name: c.n }); save(); scheduleCalc(); renderBuilds(); };
  $("#bSrc").innerHTML = `Build data from ${BUILD_INFO.sites.map((x) => `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join(" and ")}, version ${BUILD_INFO.version} (${BUILD_INFO.updated}). Community recommendations, not official.`;
}

/* One team row. opts: {owned, custom, idx} */
function teamRow(t, owned, opts = {}) {
  const slots = [0, 1, 2].map((i) => t.members[i] || null);
  const wa = assignWeapons(slots, ownedWeapons());
  const pull = teamPullChance(t, owned);
  const overall = t.chance * pull;
  const mem = slots.map((n, i) => {
    if (!n) return `<button class="tm empty" ${opts.custom ? `data-slot="${i}"` : ""}><span class="plus"></span><span class="tmn">Empty</span></button>`;
    const c = RES_BY_NAME.get(n), x = owned.get(n) || { s: 0, w: 0 };
    const tag = n === t.carry ? `<span class="ctag">Carry</span>` : "";
    return `<${opts.custom ? `button data-slot="${i}"` : "div"} class="tm${x.planned ? " planned" : ""}" style="--el:${EL_COLOR[c.e]}">
      <span class="tmimg">${portrait("resonators", n)}<img class="el" src="${elIcon(c.e)}" alt="">${tag}${weaponSquare(n, wa[i])}</span>
      <span class="tmn">${esc(n)}</span>
      <span class="tmv">${x.newFromGoal ? "Target" + (x.s ? " " + seqTxt(x) : "") : seqTxt(x)} · ${weapTxt(x)}</span>
    </${opts.custom ? "button" : "div"}>`;
  }).join("");
  const tierCls = t.template ? "t" + t.template.tier.replace(".", "") : "tx";
  const tierTxt = t.template ? t.template.tier : "–";
  const name = t.template ? t.template.name : "Custom team";
  const plannedTxt = t.planned.length ? `<span class="pbadge">Needs pull: ${t.planned.map(esc).join(", ")}</span>` : "";
  const head = opts.custom
    ? `<div class="ttop"><input type="text" class="tnamein" data-name="${opts.idx}" maxlength="32" value="${esc(opts.name || "")}" placeholder="Team name"><button class="mini del" data-delteam="${opts.idx}" title="Delete team" aria-label="Delete team"></button></div>
       <div class="tsub"><span class="tier ${tierCls}">${tierTxt}</span><span>${t.template ? (t.exact ? "" : "Closest: ") + esc(name) : "No known archetype"}</span>${plannedTxt}</div>`
    : `<div class="ttop"><span class="tier ${tierCls}">${tierTxt}</span><b class="tname">${esc(name)}</b>${plannedTxt}</div>`;
  const notes = t.notes.length ? `<ul class="tnotes">${t.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  return `<div class="team${opts.custom ? " custom" : ""}">
    <div class="tmem">${mem}</div>
    <div class="tinfo">
      ${head}
      <div class="tline"><span>Power <b>${t.power}</b></span><span>Grade <b class="grade g${t.grade}">${t.grade}</b></span><span class="tparts">Team ${t.base} · Investment +${t.inv}${t.adj ? ` · Build ${t.adj > 0 ? "+" : "−"}${Math.abs(t.adj)}` : ""}</span></div>
      ${notes}
    </div>
    <div class="tchance">
      <div class="label" title="Estimate from community tier lists">Clear chance <em>est.</em></div>
      <div class="tc ${t.chance >= 0.8 ? "good" : t.chance < 0.4 ? "bad" : ""}">${pct(t.chance)}</div>
      <div class="bar"><div class="fill${t.chance >= 0.8 ? " cyanfill" : ""}" style="width:${t.chance * 100}%"></div></div>
      ${pull < 1 ? `<div class="ssub">With pull chance <b>${pct(overall)}</b></div>` : ""}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- Meta teams tab */
const META_GROUPS = [
  ["top", "T0 and T0.5", (t) => t === "T0" || t === "T0.5"],
  ["t1", "T1", (t) => t === "T1" || t === "T1.5"],
  ["low", "T2 and lower", (t) => !["T0", "T0.5", "T1", "T1.5"].includes(t)],
  ["all", "All", () => true],
];
let metaGroup = "top";
try { metaGroup = localStorage.getItem("wuwaMetaGroup") || "top"; } catch (e) { /* ignore */ }
if (!META_GROUPS.some((g) => g[0] === metaGroup)) metaGroup = "top";
let metaCan = false;

const shortName = (n) => n.replace(/^Rover \((.*)\)$/, "Rover $1").replace(/^Yangyang: /, "");
function metaPt(n, owned, asButton) {
  const r = RES_BY_NAME.get(n), has = owned.has(n);
  const tag = asButton ? "button" : "span";
  return `<${tag} class="pt${has ? "" : " notown"}${asButton ? " link" : ""}"${asButton ? ` data-build="${esc(n)}" title="Open the build of ${esc(n)}"` : ` title="${esc(n)}${has ? "" : " (not in your roster)"}"`}>${portrait("resonators", n)}${r ? `<img class="el" src="${elIcon(r.e)}" alt="">` : ""}<small>${esc(shortName(n))}</small></${tag}>`;
}
function metaTeamStatus(t, owned) {
  const missing = [];
  t.slots.forEach((g, i) => { if (!g.some((n) => owned.has(n))) missing.push(g.slice(0, 2).join(" or ")); });
  return missing;
}
function renderMetaTeams() {
  const owned = ownedMap(false);
  const seg = $("#metaTier");
  seg.innerHTML = META_GROUPS.map(([k, label]) => `<button class="btn${metaGroup === k ? " on" : ""}" data-mg="${k}">${label}</button>`).join("");
  seg.querySelectorAll("[data-mg]").forEach((b) => b.onclick = () => {
    metaGroup = b.dataset.mg;
    try { localStorage.setItem("wuwaMetaGroup", metaGroup); } catch (e) { /* ignore */ }
    renderMetaTeams();
  });
  $("#metaCan").checked = metaCan;
  $("#metaCan").onchange = () => { metaCan = $("#metaCan").checked; renderMetaTeams(); };
  const inGroup = META_GROUPS.find((g) => g[0] === metaGroup)[2];
  const all = TEAM_TEMPLATES.filter((t) => inGroup(t.tier)).map((t) => ({ t, missing: metaTeamStatus(t, owned) }));
  const list = all.filter((x) => !metaCan || !x.missing.length);
  const canCount = all.filter((x) => !x.missing.length).length;
  const tiers = [...new Set(list.map((x) => x.t.tier))];
  $("#metaSum").textContent = `${list.length} team${list.length === 1 ? "" : "s"} shown. You can build ${canCount} of ${all.length} in this group.`;
  $("#metaList").innerHTML = list.length ? tiers.map((tier) => {
    const rows = list.filter((x) => x.t.tier === tier).sort((a, b) => (a.missing.length > 0) - (b.missing.length > 0));
    return `<div class="mtier"><span class="tier t${tier.replace(".", "")}">${tier}</span><i></i></div>` + rows.map(({ t, missing }) => `
      <div class="bteam meta${missing.length ? "" : " can"}">
        <div class="bth"><b>${esc(t.name)}</b>
          <span class="mstat ${missing.length ? "no" : "yes"}">${missing.length ? "Needs " + esc(missing.join("; ")) : "You can build this"}</span></div>
        <div class="btslots">${t.slots.map((g, i) => `<div class="btg"><span class="btl">${["Carry", "Second unit", "Third unit"][i]}</span><div>${g.map((n) => metaPt(n, owned, i === 0)).join("")}</div></div>`).join("")}</div>
      </div>`).join("");
  }).join("") : `<div class="empty">${metaCan ? "None of these teams is complete with your roster yet. Mark more resonators on the Roster tab." : "No teams in this group."}</div>`;
  $$("#metaList [data-build]").forEach((b) => b.onclick = () => { buildSel = b.dataset.build; buildEl = "All"; showPage("builds"); });
  $("#metaSrc").innerHTML = `Tier lists for ${esc(TEAM_SOURCES.version)}, updated ${esc(TEAM_SOURCES.updated)} (` +
    TEAM_SOURCES.sites.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join(", ") +
    `). Each slot lists the options, best first. Greyed resonators are not on your roster.`;
}

function renderBestTeams() {
  const bs = $("#buildSeg");
  bs.innerHTML = BUILDS.map((b) => `<button class="btn${plan.teamBuild === b.k ? " on" : ""}" data-b="${b.k}" title="${b.tip}">${b.label}</button>`).join("");
  bs.querySelectorAll("[data-b]").forEach((b) => b.onclick = () => { plan.teamBuild = b.dataset.b; save(); renderBestTeams(); });
  $("#usePlanned").checked = !!plan.usePlanned;

  const owned = ownedMap();
  const teams = buildTeams(owned, plan.teamBuild);
  const ss = $("#setSeg");
  ss.innerHTML = [2, 3].map((k) => `<button class="btn${+plan.setSize === k ? " on" : ""}" data-size="${k}">${k} teams</button>`).join("");
  ss.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => { plan.setSize = +b.dataset.size; save(); renderBestTeams(); });

  const set = bestTeamSet(teams, +plan.setSize || 2);
  const setBox = $("#teamSet");
  if (!teams.length) {
    setBox.innerHTML = `<div class="empty">Mark the resonators you own on the Roster tab first.</div>`;
  } else if (!set) {
    setBox.innerHTML = `<div class="empty">You need more resonators for ${plan.setSize} separate teams.</div>`;
  } else {
    const all = set.reduce((p, t) => p * t.chance * teamPullChance(t, owned), 1);
    setBox.innerHTML = `<div class="setsum"><span>All ${set.length} teams clear</span><b>${pct(all)}</b><div class="bar"><div class="fill" style="width:${all * 100}%"></div></div></div>` +
      set.map((t) => teamRow(t, owned)).join("");
  }
  const list = $("#autoList");
  list.innerHTML = teams.length ? teams.slice(0, autoShown).map((t) => teamRow(t, owned)).join("") : `<div class="empty">No teams yet.</div>`;
  $("#btnMoreTeams").classList.toggle("hidden", teams.length <= autoShown);
}

function renderMyTeams() {
  const owned = ownedMap();
  const box = $("#myTeams");
  const teams = plan.myTeams || [];
  box.innerHTML = teams.length ? teams.map((mt, i) => {
    const members = (mt.members || []).filter(Boolean);
    const sc = members.length ? scoreTeam(members, (n) => owned.get(n) || { s: 0, w: 0 }, plan.teamBuild) : null;
    const t = sc ? { ...sc, members: mt.members.slice(0, 3) } : { members: [null, null, null], notes: ["Click a slot to pick a resonator."], planned: [], template: null, power: 0, grade: "–", chance: 0, base: 0, inv: 0, adj: 0, carry: null };
    const missing = members.filter((n) => !owned.has(n));
    if (missing.length) t.notes = [`Not in your roster: ${missing.join(", ")}.`, ...t.notes];
    return `<div class="panel">${teamRow(t, owned, { custom: true, idx: i, name: mt.name })}</div>`;
  }).join("") : `<div class="panel"><div class="empty">No teams yet. Click New team and pick three resonators.</div></div>`;

  box.querySelectorAll("[data-slot]").forEach((b) => {
    const ti = +b.closest(".team").querySelector("[data-name]").dataset.name;
    b.onclick = () => openPicker(ti, +b.dataset.slot);
  });
  box.querySelectorAll("[data-name]").forEach((inp) => inp.addEventListener("input", () => { plan.myTeams[+inp.dataset.name].name = inp.value; save(); }));
  box.querySelectorAll("[data-delteam]").forEach((b) => b.onclick = () => { plan.myTeams.splice(+b.dataset.delteam, 1); save(); renderMyTeams(); });
}

function newTeam() {
  if (!Array.isArray(plan.myTeams)) plan.myTeams = [];
  if (plan.myTeams.length >= 12) return;
  plan.myTeams.push({ name: `Team ${plan.myTeams.length + 1}`, members: [null, null, null] });
  save(); renderMyTeams();
  openPicker(plan.myTeams.length - 1, 0);
}

function openPicker(teamIdx, slot) {
  pickTarget = { teamIdx, slot };
  pickEl = "All";
  $("#pickSearch").value = "";
  $("#pickTitle").textContent = `Choose resonator ${slot + 1}`;
  renderPicker();
  $("#pickModal").classList.remove("hidden");
  if (!matchMedia("(pointer: coarse)").matches) setTimeout(() => $("#pickSearch").focus(), 30);   // on a phone the keyboard would cover the list
}

function renderPicker() {
  const owned = ownedMap();
  const seg = $("#pickEl");
  seg.innerHTML = elSegHtml(pickEl);
  seg.querySelectorAll("[data-el]").forEach((b) => b.onclick = () => { pickEl = b.dataset.el; renderPicker(); });
  const q = normKey($("#pickSearch").value);
  const team = plan.myTeams[pickTarget.teamIdx];
  const taken = (team.members || []).filter((n, i) => n && i !== pickTarget.slot);
  const list = RESONATORS
    .filter((c) => !c.soon)
    .filter((c) => pickEl === "All" || c.e === pickEl)
    .filter((c) => !q || normKey(c.n).includes(q))
    .sort((a, b) => (owned.has(b.n) - owned.has(a.n)) || (b.r - a.r) || a.n.localeCompare(b.n));
  $("#pickGrid").innerHTML = list.map((c) => {
    const x = owned.get(c.n);
    const dis = taken.includes(c.n);
    return `<button class="pk${x ? "" : " notown"}${dis ? " taken" : ""}" data-pick="${esc(c.n)}" style="--el:${EL_COLOR[c.e]}" ${dis ? "disabled" : ""}>
      <span class="tmimg">${portrait("resonators", c.n)}<img class="el" src="${elIcon(c.e)}" alt=""></span>
      <span class="tmn">${esc(c.n)}</span>
      <span class="tmv">${x ? (x.newFromGoal ? "Pull target" : seqTxt(x) + " · " + weapTxt(x)) : "Not owned"}</span>
    </button>`;
  }).join("");
  $$("#pickGrid [data-pick]").forEach((b) => b.onclick = () => setPick(b.dataset.pick));
}

function setPick(name) {
  const team = plan.myTeams[pickTarget.teamIdx];
  team.members = [0, 1, 2].map((i) => (team.members || [])[i] || null);
  team.members[pickTarget.slot] = name;
  $("#pickModal").classList.add("hidden");
  save(); renderMyTeams();
}

/* ---------------------------------------------------------------- History and luck */

/* Share of players who need longer for their 5* than you (at pity p). */
function luckOf(p) {
  p = Math.max(1, Math.min(HARD, p | 0));
  return 1 - MODEL.F[p] + 0.5 * MODEL.f[p];
}

const POOL_NAMES = { "1": "featured resonator banner", "2": "featured weapon banner", "3": "standard resonator banner", "4": "standard weapon banner" };

function renderLuck() {
  const empty = $("#luckEmpty"), body = $("#luckBody");
  const pool = history && history.pools ? history.pools[activeTab] : null;
  const fives = pool ? pool.fives.filter((f) => f.pity >= 1 && f.pity <= HARD) : [];
  if (!fives.length) {
    empty.classList.remove("hidden"); body.classList.add("hidden");
    empty.innerHTML = pool ? "No 5★ on this banner to rate yet." : "Once your history is loaded you will see how lucky you were.";
    return;
  }
  empty.classList.add("hidden"); body.classList.remove("hidden");
  const score = (fives.reduce((s, f) => s + luckOf(f.pity), 0) / fives.length) * 100;
  const avg = fives.reduce((s, f) => s + f.pity, 0) / fives.length;
  const verdict = score >= 60 ? "Lucky" : score >= 40 ? "Average" : "Unlucky";
  const big = $("#lBig");
  big.textContent = Math.round(score) + "%";
  big.className = "sbig" + (score >= 60 ? " good" : score >= 40 ? " gold" : " bad");
  $("#lVerdict").textContent = verdict + (fives.length < 5 ? " (rough)" : "");
  $("#lCap").innerHTML = `<b>${Math.round(score)}%</b> of players need longer than you for a 5★ on the ${POOL_NAMES[activeTab] || "banner"}.`;
  $("#lBar").style.width = score + "%";
  const best = fives.reduce((a, b) => (b.pity < a.pity ? b : a));
  const worst = fives.reduce((a, b) => (b.pity > a.pity ? b : a));
  const rows = [
    ["Avg pity (you / model)", `${fix1(avg)} / ${fix1(MODEL.mean)}`],
    ["Best pull", `${esc(best.name)} (${best.pity})`],
    ["Worst pull", `${esc(worst.name)} (${worst.pity})`],
  ];
  if (activeTab === "1") {
    const dec = pool.won + pool.lost;
    rows.push(["50/50 rate", dec ? `${pool.won} of ${dec} won (${Math.round((pool.won / dec) * 100)}%)` : "–"]);
  }
  $("#lKv").innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("");
  drawLuckChart(fives);
}

function drawLuckChart(fives) {
  const cv = $("#luckChart");
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 300, H = 170;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext("2d");
  c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
  const L = 36, R = 10, T = 10, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const X = (p) => L + (p / HARD) * pw, Y = (v) => T + (1 - v) * ph;
  c.font = "600 11px Roboto, sans-serif";
  c.strokeStyle = "rgba(242,239,230,0.07)"; c.lineWidth = 1; c.fillStyle = "#8f9198";
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(L + pw, Y(v)); c.stroke();
    c.fillText(Math.round(v * 100) + "%", 2, Y(v) + 4);
  }
  for (const p of [0, 20, 40, 60, 80]) c.fillText(String(p), X(p) - 5, H - 8);
  const grad = c.createLinearGradient(0, T, 0, T + ph);
  grad.addColorStop(0, "rgba(240,200,110,0.28)"); grad.addColorStop(1, "rgba(240,200,110,0)");
  c.beginPath(); c.moveTo(X(0), Y(0));
  for (let p = 1; p <= HARD; p++) c.lineTo(X(p), Y(MODEL.F[p]));
  c.lineTo(X(HARD), Y(0)); c.closePath(); c.fillStyle = grad; c.fill();
  c.beginPath(); c.moveTo(X(0), Y(0));
  for (let p = 1; p <= HARD; p++) c.lineTo(X(p), Y(MODEL.F[p]));
  c.strokeStyle = "#ffecb4"; c.lineWidth = 2; c.stroke();
  for (const f of fives) {
    const x = X(f.pity), y = Y(MODEL.F[f.pity]);
    c.strokeStyle = "rgba(242,239,230,.25)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, Y(0)); c.stroke();
    c.fillStyle = MODEL.F[f.pity] <= 0.5 ? "#7ed6ce" : "#f2efe6";
    c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath(); c.fill();
    c.strokeStyle = "#0c0d11"; c.lineWidth = 1; c.stroke();
  }
  c.fillStyle = "#8f9198"; c.fillText("LEFT = EARLIER 5★ = LUCKIER", L + 8, T + 14);
}

function renderHistory() {
  const tabs = $("#tabs"), stats = $("#histStats"), list = $("#histList");
  const pools = history && history.pools ? history.pools : {};
  const keys = ["1", "2", "3", "4"].filter((k) => pools[k] && pools[k].total > 0);
  const label = { "1": "Featured resonator", "2": "Featured weapon", "3": "Standard resonator", "4": "Standard weapon" };
  if (!keys.length) {
    tabs.innerHTML = ""; stats.innerHTML = "";
    list.innerHTML = `<div class="empty">No history yet. Open Convene &gt; History in the game and click <b>Fetch history</b> at the top.</div>`;
    renderLuck();
    return;
  }
  if (!keys.includes(activeTab)) activeTab = keys[0];
  tabs.innerHTML = keys.map((k) => `<button class="btn${k === activeTab ? " on" : ""}" data-tab="${k}">${label[k]}</button>`).join("");
  $$("#tabs .btn").forEach((b) => b.onclick = () => { activeTab = b.dataset.tab; renderHistory(); });
  const p = pools[activeTab];
  const box = [
    ["Pulls", fmt(p.total)],
    ["Astrite value", fmt(p.astrite)],
    ["Pity now", String(p.pity5)],
    ["Avg pity", p.avg != null ? String(p.avg) : "–"],
  ];
  if (activeTab === "1") box.push(["50/50 W / L", `${p.won} / ${p.lost}`]);
  stats.innerHTML = box.map(([k, v]) => `<div class="hs"><span>${k}</span><b>${v}</b></div>`).join("");
  const cat = activeTab === "2" || activeTab === "4" ? "weapons" : "resonators";
  const tagTxt = { won: "Won", lost: "Lost", guarantee: "Guarantee" };
  list.innerHTML = p.fives.length ? p.fives.map((f) => `
    <div class="hcard">
      <div class="card">
        ${portrait(cat, f.name)}
        <div class="pity${f.pity > SOFT ? " hi" : ""}"${f.unsure ? ` title="Oldest 5★ in your record. If older pulls are missing, the real pity is higher."` : ""}>${f.pity}${f.unsure ? "<sup>?</sup>" : ""}</div>
        <div class="nm">${esc(f.name)}</div>
      </div>
      <div class="meta"><span>${esc((f.time || "").slice(0, 10))}</span>${f.result ? `<span class="tag ${f.result}">${tagTxt[f.result]}${f.unsure ? "?" : ""}</span>` : ""}</div>
    </div>`).join("") + `<div class="note hnote">? Oldest 5★ in your record. If Kuro's record does not reach back far enough, its real pity is higher and the 50/50 result can be different.</div>`
    : `<div class="empty">No 5★ on this banner yet.</div>`;
  renderLuck();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function pityNote() {
  const el = $("#pityNote");
  const p1 = history?.pools?.["1"], p2 = history?.pools?.["2"];
  if (!p1 && !p2) { el.innerHTML = "<b>Fetch history</b> fills in pity and guarantee automatically."; return; }
  const hc = p1 ? p1.pity5 : 0, hg = p1 ? p1.guaranteed : false, hw = p2 ? p2.pity5 : 0;
  const same = hc === +plan.charPity && hg === !!plan.guaranteed && hw === +plan.weaponPity;
  el.innerHTML = `From your history of ${esc(history.updated || "?")}: resonator <b>${hc}</b>${hg ? " (guarantee)" : " (50/50)"}, weapon <b>${hw}</b>.` +
    (same ? "" : ` <a href="#" id="applyHist">Apply</a>`);
  const a = $("#applyHist");
  if (a) a.onclick = (e) => { e.preventDefault(); applyHistoryPity(); };
}

function applyHistoryPity() {
  const p1 = history?.pools?.["1"], p2 = history?.pools?.["2"];
  if (p1) { plan.charPity = p1.pity5; plan.guaranteed = p1.guaranteed; }
  if (p2) plan.weaponPity = p2.pity5;
  fillInputs(); save(); calculate(); pityNote();
}

/* ---------------------------------------------------------------- Images page */
function renderImagesPage() {
  const box = $("#imgCats");
  if (!online) return;
  if (!images) { box.innerHTML = `<div class="empty">Loading images …</div>`; return; }
  const titles = { resonators: "Resonators", weapons: "Weapons", currency: "Currency" };
  box.innerHTML = Object.entries(images.cats).map(([c, info]) => `
    <div class="imgcat">
      <div class="ih"><div><b>${titles[c] || c}</b><br><small>${esc(info.path)}</small></div><button class="btn small" data-open="${c}"><img src="assets/ic_folder.png" alt="">Open</button></div>
      <div class="thumbs">${info.files.length ? info.files.map((f) => `<div class="thumb${c === "currency" ? " sq" : ""}"><img src="${f.url}?v=${f.mtime}" alt=""><span>${esc(f.file)}</span></div>`).join("") : `<div class="empty">${esc(info.label)}</div>`}</div>
    </div>`).join("");
  box.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openFolder(b.dataset.open));

  // Names without an image
  const want = new Map();
  for (const g of plan.goals || []) want.set((g.type === "weapon" ? "weapons" : "resonators") + "|" + g.name, g);
  for (const n of Object.keys(plan.roster || {})) want.set("resonators|" + n, n);
  for (const [k, p] of Object.entries(history?.pools || {})) {
    const cat = k === "2" || k === "4" ? "weapons" : "resonators";
    for (const f of p.fives || []) want.set(cat + "|" + f.name, f);
  }
  const miss = [...want.keys()].filter((k) => { const [c, n] = k.split("|"); return !findImg(c, n); });
  $("#imgMissing").innerHTML = miss.length
    ? `<div class="note">These names have no image yet (folder in brackets):</div>` + miss.map((k) => { const [c, n] = k.split("|"); return `<span class="chip">${esc(n)} <small>(${c})</small></span>`; }).join("")
    : `<div class="note">Every target, roster resonator and 5★ from your history has an image.</div>`;
}

async function openFolder(cat) {
  if (!online) return;
  try {
    const r = await (await fetch("/api/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cat }) })).json();
    $("#imgMsg").className = "msg ok";
    $("#imgMsg").textContent = r.ok ? "Folder opened: " + r.path : "Could not open the folder.";
  } catch (e) {
    $("#imgMsg").className = "msg err"; $("#imgMsg").textContent = "Error: " + e.message;
  }
}

/* ---------------------------------------------------------------- Sources list */
function renderSources() {
  const box = $("#sources");
  box.innerHTML = plan.sources.map((s, i) => `
    <div class="src${s.on ? "" : " off"}" data-i="${i}">
      <label class="chk"><input type="checkbox" data-f="on" ${s.on ? "checked" : ""}><i></i></label>
      <input type="text" data-f="name" value="${esc(s.name)}">
      <input type="number" min="0" data-f="astrite" value="${+s.astrite || 0}">
      <input type="number" min="0" data-f="tides" value="${+s.tides || 0}">
      <input type="date" data-f="date" value="${isoOk(s.date) ? s.date : ""}" title="Available by (empty = already available or before every banner end)">
      <button class="del" title="Remove" aria-label="Remove"></button>
    </div>`).join("");
  $$("#sources .src").forEach((row) => {
    const i = +row.dataset.i;
    row.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        const f = inp.dataset.f;
        plan.sources[i][f] = f === "on" ? inp.checked : f === "name" ? inp.value : f === "date" ? (isoOk(inp.value) ? inp.value : "") : +inp.value || 0;
        if (f === "on") row.classList.toggle("off", !inp.checked);
        save(); scheduleCalc();
      });
    });
    row.querySelector(".del").onclick = () => { plan.sources.splice(i, 1); renderSources(); save(); scheduleCalc(); };
  });
}

/* ---------------------------------------------------------------- Settings, presets, quick setup */
function addPreset() {
  const pr = INCOME_PRESETS[0];
  if (!pr) return;
  const have = new Set((plan.sources || []).map((s) => s.name));
  let n = 0;
  for (const s of pr.sources) if (!have.has(s.name)) { plan.sources.push({ on: true, name: s.name, astrite: s.astrite, tides: s.tides || 0, date: s.date || "" }); n++; }
  renderSources(); save(); calculate();
  $("#sourceMsg").textContent = n ? `${n} rows from "${pr.label}" added. They are estimates, check them against the event list in the game.` : "Those rows are already in your list.";
}

function fillModel() {
  const m = plan.model;
  $$("[data-m]").forEach((el) => { el.value = m[el.dataset.m]; });
  $("#modelText").textContent = `Pull model: ${m.base}% base rate, soft pity from pull ${m.soft + 1} (+${m.step}% per pull), hard pity ${m.hard}, 50/50 on the resonator banner, pity carries over between event banners.`;
  $$("[data-k=charPity], [data-k=weaponPity], #suCharPity, #suWeapPity").forEach((el) => { el.max = m.hard - 1; });
  $("#modelNote").textContent = JSON.stringify(normModel(m)) === JSON.stringify(normModel(DEFAULT_MODEL))
    ? "Default model. Kuro publishes base rate and hard pity, the soft pity curve is a community estimate."
    : "Custom model. All chances use these values.";
}

function serverOptions() {
  return SERVERS.map((s) => `<option value="${s.k}">${esc(s.label)} (UTC${s.utc >= 0 ? "+" : ""}${s.utc})</option>`).join("");
}

function openSetup() {
  const today = isoOf(serverToday());
  $("#suServer").innerHTML = serverOptions();
  $("#suServer").value = plan.server;
  const v = (id, x) => { $(id).value = x || ""; };
  v("#suAstrite", plan.astrite); v("#suLunite", plan.lunite); v("#suRadiant", plan.radiant); v("#suForging", plan.forging);
  v("#suCharPity", plan.charPity); v("#suWeapPity", plan.weaponPity);
  $("#suGuar").checked = !!plan.guaranteed;
  $("#suSub").checked = !!plan.sub;
  $("#suTarget").value = "";
  $("#suBanner").innerHTML = BANNERS.filter((b) => b.end >= today)
    .map((b) => `<option value="${b.end}">${esc(b.label)} (until ${fmtDate(b.end)})</option>`).join("") +
    `<option value="">Date not known yet</option>`;
  $("#suList").innerHTML = RESONATORS.filter((c) => c.r === 5).map((c) => `<option value="${esc(c.n)}"${c.soon ? ` label="not released"` : ""}>`).join("");
  $("#setupModal").classList.remove("hidden");
}

function applySetup() {
  const n = (id) => Math.max(0, +$(id).value || 0);
  plan.server = $("#suServer").value;
  plan.astrite = n("#suAstrite"); plan.lunite = n("#suLunite");
  plan.radiant = n("#suRadiant"); plan.forging = n("#suForging");
  plan.charPity = clampPity(n("#suCharPity")); plan.weaponPity = clampPity(n("#suWeapPity"));
  plan.guaranteed = $("#suGuar").checked;
  plan.sub = $("#suSub").checked;
  const t = $("#suTarget").value.trim();
  if (t) {
    const c = findResonator(t);
    const g = { type: "char", name: (c ? c.n : t).slice(0, 40) };
    if (isoOk($("#suBanner").value)) g.end = $("#suBanner").value;
    plan.goals.push(g);
  }
  closeSetup();
}

function closeSetup() {
  $("#setupModal").classList.add("hidden");
  $("#serverSel").value = plan.server;
  save(); fillInputs(); renderSources(); pityNote(); calculate();
}

/* Read the Convene link straight from Client.log (no PowerShell needed). */
async function readLogFile(file) {
  if (!file) return;
  msg("Reading " + file.name + " …", true);
  try {
    const url = findConveneUrl(new Uint8Array(await file.arrayBuffer()));
    if (!url) {
      msg("No Convene link in this file. Open Convene > History in the game, wait until it loads, then pick Client.log again.", false);
      return;
    }
    $("#conveneUrlWeb").value = url;
    doSync({ url });
  } catch (e) {
    msg("Could not read the file. If the game is still running, close it and try again (the link stays in the log).", false);
  }
}

/* ---------------------------------------------------------------- Drawing */
function drawChart(curve, you, worst, prob, active) {
  const cv = $("#chart");
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = 260;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext("2d");
  c.scale(dpr, dpr);
  c.clearRect(0, 0, W, H);
  const L = 44, Rr = 14, T = 14, B = 34;
  const pw = W - L - Rr, ph = H - T - B;
  c.font = "600 11px Roboto, sans-serif";
  if (!active || curve.length < 2) {
    c.fillStyle = "#9aa3b4"; c.fillText("Add a target to see the curve.", L, T + 20);
    return;
  }
  const x0 = curve[0].x, x1 = curve[curve.length - 1].x;
  const X = (x) => L + ((x - x0) / Math.max(1, x1 - x0)) * pw;
  const Y = (y) => T + (1 - y) * ph;

  c.strokeStyle = "rgba(242,239,230,0.07)"; c.lineWidth = 1;
  c.fillStyle = "#8f9198";
  for (const y of [0, 0.25, 0.5, 0.75, 1]) {
    c.beginPath(); c.moveTo(L, Y(y)); c.lineTo(L + pw, Y(y)); c.stroke();
    c.fillText(Math.round(y * 100) + "%", 6, Y(y) + 4);
  }
  const span = x1 - x0;
  const stepX = span > 600 ? 100 : span > 300 ? 50 : span > 120 ? 20 : 10;
  for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) {
    c.beginPath(); c.moveTo(X(x), T); c.lineTo(X(x), T + ph); c.stroke();
    c.fillText(String(x), X(x) - 8, H - 14);
  }
  c.fillStyle = "#8f9198"; c.fillText("TOTAL PULLS", L + pw - 72, H - 1);

  const grad = c.createLinearGradient(0, T, 0, T + ph);
  grad.addColorStop(0, "rgba(240,200,110,0.32)");
  grad.addColorStop(1, "rgba(240,200,110,0.0)");
  c.beginPath(); c.moveTo(X(curve[0].x), Y(0));
  for (const p of curve) c.lineTo(X(p.x), Y(p.y));
  c.lineTo(X(x1), Y(0)); c.closePath(); c.fillStyle = grad; c.fill();
  c.beginPath();
  curve.forEach((p, i) => (i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))));
  c.strokeStyle = "#ffecb4"; c.lineWidth = 2.2; c.shadowColor = "rgba(240,200,110,.6)"; c.shadowBlur = 8; c.stroke();
  c.shadowBlur = 0;

  if (worst >= x0 && worst <= x1) {
    c.setLineDash([4, 4]); c.strokeStyle = "rgba(242,239,230,.55)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(worst), T); c.lineTo(X(worst), T + ph); c.stroke(); c.setLineDash([]);
    c.fillStyle = "#f2efe6"; c.fillText("Guarantee " + worst, Math.min(X(worst) + 5, L + pw - 90), T + 12);
  }
  const yx = Math.min(Math.max(you, x0), x1);
  c.strokeStyle = "#7ed6ce"; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(X(yx), T); c.lineTo(X(yx), T + ph); c.stroke();
  c.fillStyle = "#7ed6ce";
  c.beginPath();
  const cx = X(yx), cy = Y(prob);
  c.moveTo(cx, cy - 6); c.lineTo(cx + 6, cy); c.lineTo(cx, cy + 6); c.lineTo(cx - 6, cy); c.closePath(); c.fill();
  const label = `You: ${you} pulls · ${pct(prob)}`;
  const tw = c.measureText(label).width;
  const lx = Math.min(Math.max(cx - tw / 2, L), L + pw - tw);
  const ly = cy > T + 40 ? cy - 14 : cy + 22;
  c.fillStyle = "rgba(242,239,230,.95)"; c.fillRect(lx - 6, ly - 12, tw + 12, 18);
  c.fillStyle = "#16171b"; c.fillText(label, lx, ly + 1);
}

function drawRing(cv, pity) {
  const c = cv.getContext("2d");
  c.clearRect(0, 0, 260, 260);
  const cx = 130, cy = 130, R = 108;
  const start = -Math.PI / 2;
  const softEnd = start + (Math.min(pity, SOFT) / HARD) * Math.PI * 2;
  c.lineWidth = 8; c.lineCap = "butt";
  if (pity > 0) {
    c.strokeStyle = "#f0c86e"; c.shadowColor = "rgba(240,200,110,.8)"; c.shadowBlur = 12;
    c.beginPath(); c.arc(cx, cy, R, start, softEnd); c.stroke();
  }
  if (pity > SOFT) {
    c.strokeStyle = "#fff4cf"; c.shadowColor = "rgba(255,240,200,.95)";
    c.beginPath(); c.arc(cx, cy, R, softEnd, start + (pity / HARD) * Math.PI * 2); c.stroke();
  }
  c.shadowBlur = 0;
}

/* ---------------------------------------------------------------- Inputs */
function fillInputs() {
  $$("[data-k]").forEach((el) => {
    if (!(el.dataset.k in plan)) return;
    const v = plan[el.dataset.k];
    if (el.type === "checkbox") el.checked = !!v; else el.value = v ?? "";
  });
}

function bindInputs() {
  $$("input[data-k]").forEach((el) => {
    el.addEventListener("input", () => {
      const k = el.dataset.k;
      plan[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? (+el.value || 0) : el.value;
      save(); scheduleCalc(); if (["charPity", "guaranteed", "weaponPity"].includes(k)) pityNote();
    });
  });
  $("#btnAddSource").onclick = () => { plan.sources.push({ on: true, name: "New source", astrite: 0, tides: 0, date: "" }); renderSources(); save(); calculate(); };
  $("#btnPreset").onclick = addPreset;
  $("#serverSel").onchange = (e) => { plan.server = e.target.value; save(); calculate(); };
  $$("[data-m]").forEach((el) => el.addEventListener("change", () => {
    const m = { ...plan.model, [el.dataset.m]: +el.value };
    plan.model = setModel(m); fillModel(); save(); calculate(); renderHistory();
  }));
  $("#btnModelReset").onclick = () => { plan.model = setModel(DEFAULT_MODEL); fillModel(); save(); calculate(); renderHistory(); };
  $("#btnSetup").onclick = openSetup;
  $("#goalBanner").onchange = () => { $("#goalEndWrap").classList.toggle("hidden", $("#goalBanner").value !== "custom"); updateGoalHint(); };
  $("#goalName").addEventListener("input", suggestBanner);
  $("#goalFor").addEventListener("input", suggestBanner);
  $$(".nav").forEach((b) => b.onclick = () => showPage(b.dataset.page));
  $$("[data-goto]").forEach((b) => b.onclick = () => showPage(b.dataset.goto));
  $$("#goalType .btn").forEach((b) => b.onclick = () => setGoalType(b.dataset.type));
  $("#goalOk").onclick = addGoal;
  $("#goalCancel").onclick = () => $("#goalModal").classList.add("hidden");
  $("#goalModal").addEventListener("click", (e) => { if (e.target.id === "goalModal") $("#goalModal").classList.add("hidden"); });
  ["#goalName", "#goalFor", "#goalEnd"].forEach((s) => $(s).addEventListener("keydown", (e) => { if (e.key === "Enter") addGoal(); }));
  $("#btnSaveScen").onclick = saveScenario;
  $("#scenName").addEventListener("keydown", (e) => { if (e.key === "Enter") saveScenario(); });
  $("#btnOpenImg").onclick = () => openFolder("");
  $("#btnReloadImg").onclick = async () => {
    await loadImages(); renderImagesPage(); renderHistory(); calculate();
    $("#imgMsg").className = "msg ok";
    const n = images ? Object.values(images.cats).reduce((s, c) => s + c.files.length, 0) : 0;
    $("#imgMsg").textContent = `${n} images found.`;
  };

  // Teams page
  $$("#teamTabs .btn").forEach((b) => b.onclick = () => setTeamTab(b.dataset.ttab));
  $("#wSearch").oninput = renderWeapons;
  $("#wOwnedOnly").onchange = renderWeapons;
  $("#wLow").onchange = renderWeapons;
  $("#bSearch").oninput = renderBuilds;
  $("#rosterSearch").addEventListener("input", renderRoster);
  $("#ownedOnly").addEventListener("change", renderRoster);
  $("#favOnly").addEventListener("change", renderRoster);
  $("#btnRosterImport").onclick = importRosterFromHistory;
  $("#usePlanned").addEventListener("change", (e) => { plan.usePlanned = e.target.checked; save(); renderBestTeams(); });
  $("#btnMoreTeams").onclick = () => { autoShown += 8; renderBestTeams(); };
  $("#btnNewTeam").onclick = newTeam;
  $("#pickSearch").addEventListener("input", renderPicker);
  $("#pickCancel").onclick = () => $("#pickModal").classList.add("hidden");
  $("#pickClear").onclick = () => {
    const team = plan.myTeams[pickTarget.teamIdx];
    team.members = [0, 1, 2].map((i) => (team.members || [])[i] || null);
    team.members[pickTarget.slot] = null;
    $("#pickModal").classList.add("hidden"); save(); renderMyTeams();
  };
  $("#pickModal").addEventListener("click", (e) => { if (e.target.id === "pickModal") $("#pickModal").classList.add("hidden"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".modal").forEach((m) => m.classList.add("hidden")); });
  // Phones fire resize when the keyboard or address bar moves (height only). Redrawing then would rebuild the
  // page under the finger and close the keyboard, so only a real width change (rotation, window size) recalculates.
  let lastW = innerWidth;
  window.addEventListener("resize", () => { if (innerWidth !== lastW) { lastW = innerWidth; scheduleCalc(); } });
}

/* ---------------------------------------------------------------- Saving / server */
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem("wuwaPlan", JSON.stringify(plan)); } catch (e) { /* ignore */ }
    if (online) fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) }).catch(() => {});
  }, 300);
}

/* Older plans used German names for the default sources and targets. */
const OLD_NAMES = {
  "Permanente Events": "Permanent events",
  "Mengzhou Exploration (Schätzung)": "Mengzhou exploration (estimate)",
  "Neue Quelle": "New source",
  "Signatur-Waffe": "Signature weapon",
  "Waffe": "Weapon",
};
const renameOld = (s) => OLD_NAMES[s] || s;

function migrate(p) {
  const out = { ...structuredClone(DEFAULT_PLAN), ...p };
  if (!Array.isArray(out.goals)) {
    out.goals = [];
    const N = +p.targetChars, M = +p.targetWeapons;
    for (let i = 0; i < (N || 0); i++) out.goals.push({ type: "char", name: `Resonator ${i + 1}` });
    for (let i = 0; i < (M || 0); i++) out.goals.push({ type: "weapon", name: "Signature weapon" });
  }
  delete out.targetChars; delete out.targetWeapons;
  out.goals = out.goals.map((g) => {
    const o = { type: g.type === "weapon" ? "weapon" : "char", name: renameOld(g.name) };
    if (isoOk(g.end)) o.end = g.end;
    if (o.type === "weapon" && g.for) o.for = String(g.for).slice(0, 40);
    return o;
  });
  if (!Array.isArray(out.sources)) out.sources = [];
  out.sources = out.sources.map((s) => ({ ...s, name: renameOld(s.name), date: isoOk(s.date) ? s.date : "" }));
  if (!SERVERS.some((x) => x.k === out.server)) out.server = "europe";
  out.todayClaimed = out.todayClaimed !== false;
  out.model = normModel(out.model);
  if (!isoOk(out.endDate)) out.endDate = defaultEnd();
  if (!Array.isArray(out.scenarios)) out.scenarios = [];
  out.scenarios = out.scenarios.map((s) => ({ ...s, name: String(s.name || "").replace(/^Szenario /, "Scenario "), plan: migrateLite(s.plan) }));
  if (![0.5, 0.75, 0.9, 1].includes(+out.dayTarget)) out.dayTarget = 0.5;
  if (!out.roster || typeof out.roster !== "object") out.roster = {};
  const wq = {};
  if (out.weapons && typeof out.weapons === "object") {
    for (const [n, v] of Object.entries(out.weapons)) {
      const w = findWeapon(n);
      if (w) wq[w.n] = { r: Math.max(1, Math.min(5, v.r | 0 || 1)), n: Math.max(1, Math.min(9, v.n | 0 || 1)) };
    }
  }
  out.weapons = wq;
  const clean = {};
  for (const [n, v] of Object.entries(out.roster)) {
    const c = findResonator(n);
    if (c) clean[c.n] = { s: Math.max(0, Math.min(6, v.s | 0)), w: Math.max(0, Math.min(5, v.w | 0)) };
  }
  out.roster = clean;
  const fv = { r: {}, w: {} };
  if (out.fav && typeof out.fav === "object") {
    for (const n of Object.keys(out.fav.r || {})) { const c = findResonator(n); if (c) fv.r[c.n] = 1; }
    for (const n of Object.keys(out.fav.w || {})) { const w = findWeapon(n); if (w) fv.w[w.n] = 1; }
  }
  out.fav = fv;
  if (!Array.isArray(out.myTeams)) out.myTeams = [];
  out.myTeams = out.myTeams.map((t) => ({ name: String(t.name || ""), members: [0, 1, 2].map((i) => { const c = findResonator((t.members || [])[i]); return c ? c.n : null; }) }));
  if (!BUILDS.some((b) => b.k === out.teamBuild)) out.teamBuild = "solid";
  if (![2, 3].includes(+out.setSize)) out.setSize = 2;
  return out;
}

function migrateLite(p) {
  const c = { ...p };
  if (!Array.isArray(c.goals)) {
    c.goals = [];
    for (let i = 0; i < (+c.targetChars || 0); i++) c.goals.push({ type: "char", name: `Resonator ${i + 1}` });
    for (let i = 0; i < (+c.targetWeapons || 0); i++) c.goals.push({ type: "weapon", name: "Signature weapon" });
  }
  c.goals = c.goals.map((g) => ({ ...g, name: renameOld(g.name) }));
  if (Array.isArray(c.sources)) c.sources = c.sources.map((s) => ({ ...s, name: renameOld(s.name) }));
  return c;
}

function setStatus() {
  const s = $("#status");
  if (!online) {
    s.innerHTML = history && history.updated
      ? `Player <b>${esc(history.playerId || "?")}</b> · history last loaded <b>${esc(history.updated)}</b> · stored in this browser`
      : "No history loaded yet. Click <b>Fetch history</b> at the top right.";
    return;
  }
  if (history && history.updated) s.innerHTML = `Player <b>${esc(history.playerId || "?")}</b> · history last loaded <b>${esc(history.updated)}</b>`;
  else s.innerHTML = "No history loaded yet. Click <b>Fetch history</b> at the top right.";
}

function msg(text, ok) {
  const m = online ? $("#syncMsgLocal") : $("#syncMsg");
  m.className = "msg " + (ok ? "ok" : "err");
  m.textContent = text;
}

async function doSync(body) {
  if (!online) return doBrowserSync(body);
  const btns = $$(".btn"); btns.forEach((b) => (b.disabled = true));
  const st = $("#status"); const old = st.innerHTML;
  st.innerHTML = "Loading history from Kuro …";
  msg("Loading history from Kuro …", true);
  try {
    const gp = $("#gamePath").value.trim();
    if (gp) await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gamePath: gp }) });
    let res = await (await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, gamePath: gp }) })).json();
    if (!res.ok && body.auto && hasUrl) {
      const res2 = await (await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
      if (res2.ok) res = res2;
    }
    if (!res.ok) {
      showPage("images");
      let t = res.error || "Unknown error";
      if (res.checked && res.checked.length) t += "\nFolders checked:\n" + res.checked.join("\n");
      msg(t, false);
      st.innerHTML = old;
      return;
    }
    hasUrl = true;
    history = res.history;
    const n = Object.values(res.counts || {}).reduce((a, b) => a + b, 0);
    msg(`Done: ${n} pulls loaded. Pity and guarantee were applied.`, true);
    applyHistoryPity();
    renderHistory(); setStatus();
  } catch (e) {
    msg("Error: " + e.message, false);
    st.innerHTML = old;
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

async function doBrowserSync(body) {
  const url = (body.url || (body.auto ? localStorage.getItem("wuwaConveneUrl") || sessionUrl : "") || "").trim();
  if (!url) {
    showPage("images");
    msg("Pick your Client.log in step 2 or paste the Convene link.", false);
    return;
  }
  const btns = $$(".btn"); btns.forEach((b) => (b.disabled = true));
  msg("Loading history from Kuro …", true);
  try {
    const res = await browserSync(url);
    history = res.history;
    const n = Object.values(res.counts).reduce((a, b) => a + b, 0);
    const kept = !!localStorage.getItem("wuwaConveneUrl");
    msg(`Done: ${n} pulls loaded. Pity and guarantee were applied.` +
      (kept ? "" : " The link was not saved. Tick \"Remember the link\" if Fetch history should reuse it next time."), true);
    applyHistoryPity(); renderHistory(); setStatus();
  } catch (e) {
    showPage("images");
    msg(e instanceof TypeError ? "No connection to Kuro. Check your internet connection." : e.message, false);
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

async function init() {
  let firstVisit = true;
  try {
    const saved = JSON.parse(localStorage.getItem("wuwaPlan") || "null");
    if (saved) { plan = { ...plan, ...saved }; firstVisit = false; }
  } catch (e) { /* ignore */ }
  try {
    const st = await (await fetch("/api/state")).json();
    online = true;
    hasUrl = !!st.hasUrl;
    history = st.history;
    if (st.settings && st.settings.plan) plan = { ...plan, ...st.settings.plan };
    if (st.settings && st.settings.gamePath) $("#gamePath").value = st.settings.gamePath;
  } catch (e) {
    online = false;
  }
  if (!online) {
    // GitHub Pages / no local server: history lives in this browser.
    document.body.classList.add("web");
    PAGES.images = ["Import", "Convene history and backup"];
    $$('[data-sub="images"]').forEach((b) => { b.textContent = "Import"; });
    const raw = loadRawHistory();
    if (raw.pools && Object.keys(raw.pools).length) history = analyzeHistory(raw);
    const cmd = `irm "${new URL("import.ps1", location.href).href}" | iex`;
    $("#psCmd").textContent = cmd;
    $("#btnCopyCmd").onclick = async () => {
      try { await navigator.clipboard.writeText(cmd); $("#btnCopyCmd").textContent = "Copied"; } catch (e) { /* ignore */ }
      setTimeout(() => { $("#btnCopyCmd").textContent = "Copy"; }, 1500);
    };
    $("#btnUrlWeb").onclick = () => {
      const u = $("#conveneUrlWeb").value.trim();
      if (!u) { msg("Paste the Convene link first.", false); return; }
      doSync({ url: u });
    };
    $("#btnExport").onclick = exportData;
    $("#btnImportFile").onclick = () => $("#importFile").click();
    $("#importFile").onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; };
    // Read the link straight from the game log
    $("#btnLogFile").onclick = () => $("#logFile").click();
    $("#logFile").onchange = (e) => { readLogFile(e.target.files[0]); e.target.value = ""; };
    const dz = $("#logDrop");
    ["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, () => dz.classList.remove("over")));
    dz.addEventListener("drop", (e) => { e.preventDefault(); readLogFile(e.dataTransfer.files[0]); });
    // Only keep the link if the visitor wants it
    const rl = $("#rememberLink");
    rl.checked = !!localStorage.getItem("wuwaConveneUrl");
    rl.onchange = () => {
      if (rl.checked) { if (sessionUrl) localStorage.setItem("wuwaConveneUrl", sessionUrl); }
      else localStorage.removeItem("wuwaConveneUrl");
    };
    $("#btnClearHist").onclick = () => {
      if (!confirm("Delete the stored Convene history from this browser?")) return;
      localStorage.removeItem("wuwaHistoryRaw"); localStorage.removeItem("wuwaConveneUrl");
      sessionUrl = ""; $("#rememberLink").checked = false;
      history = null; renderHistory(); setStatus(); pityNote(); msg("History deleted from this browser.", true);
    };
  }
  plan = migrate(plan);
  plan.model = setModel(plan.model);
  $("#serverSel").innerHTML = serverOptions();
  $("#serverSel").value = plan.server;
  fillModel();
  $("#teamSrc").innerHTML = `Clear chance is an estimate for full stars in current endgame (Tower of Adversity, Whimpering Wastes). ` +
    `Team tiers: community tier lists for ${esc(TEAM_SOURCES.version)} (` +
    TEAM_SOURCES.sites.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join(", ") +
    `), updated ${esc(TEAM_SOURCES.updated)}, plus your sequences and weapons. Echo quality and your own play matter at least as much.`;
  $("#dataInfo").textContent = `Data ${DATA_INFO.version}, updated ${fmtDate(DATA_INFO.updated)}. Banner dates are expected dates until the in-game notice confirms them.`;
  $("#suStart").onclick = applySetup;
  $("#suSkip").onclick = closeSetup;
  applyCurrencyImages();
  await loadImages();
  fillInputs(); bindInputs(); renderSources(); renderHistory(); setStatus(); pityNote();
  $("#btnSync").onclick = () => doSync({ auto: true });
  $("#btnAuto").onclick = () => doSync({ auto: true });
  $("#btnUrl").onclick = () => {
    const url = $("#conveneUrl").value.trim();
    if (!url) { msg("Paste the Convene link first.", false); return; }
    doSync({ url });
  };
  try { teamTab = localStorage.getItem("wuwaTeamTab") || "roster"; } catch (e) { /* ignore */ }
  if (!["roster", "weapons", "meta", "best", "mine"].includes(teamTab)) teamTab = "roster";
  setTeamTab(teamTab);
  let start = "overview";
  try { start = localStorage.getItem("wuwaPage") || "overview"; } catch (e) { /* ignore */ }
  showPage(start);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(calculate);
  if (firstVisit && !online) { showPage("overview"); openSetup(); }
  setInterval(() => { if (page === "resources") $("#serverNote").innerHTML = serverText(); }, 30000);
}

init();

/* ---------------------------------------------------------------- Animated background
   A live version of assets/bg.png in the game's Tacet style: rotating resonance rings with a gold
   scanner, a resonance pulse every few seconds, a breathing sound wave and twinkling stars.
   Built to be cheap: one single draw loop, a static gradient behind the canvas, rings are only drawn
   where they are on screen, a frame cap, slower drawing while the window is not in focus, and a governor
   that lowers the quality (and finally stops the animation) when a browser cannot keep up.
   Settings > Display can force it on or off. Off means the static picture. */
(function bgScene() {
  const cv = document.getElementById("bgfx");
  if (!cv) return;
  const root = document.documentElement;
  const KEY = "wuwaBg", TKEY = "wuwaBgTier";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = cv.getContext("2d");
  const GOLD = "232,182,74", INK = "214,210,198";
  const INK_FILL = `rgb(${INK})`, GOLD_FILL = `rgb(${GOLD})`;
  const TAU = Math.PI * 2;
  // quality tiers: 0 full, 1 lighter, 2 minimal; tier 3 = animation stopped (static picture)
  const TIERS = [
    { fps: 60, dpr: 1.5, dash: true, stars: 1, wave: 4, name: "full quality" },
    { fps: 30, dpr: 1, dash: false, stars: .5, wave: 6, name: "lighter mode" },
    { fps: 20, dpr: 1, dash: false, stars: .3, wave: 8, name: "minimal mode" },
  ];
  const FKEY = "wuwaBgFps";
  let cap = +store.get(FKEY) || 0;                 // 0 = automatic
  let mode = store.get(KEY);
  if (mode !== "on" && mode !== "off") mode = "auto";
  const loadTier = () => { const v = String(store.get(TKEY) || "").split("|"); return Date.now() - (+v[1] || 0) < 864e5 ? Math.max(0, Math.min(3, +v[0] || 0)) : 0; };
  const saveTier = (t) => store.set(TKEY, t + "|" + Date.now());
  let tier = loadTier();
  if (mode === "on") tier = 0;

  let running = false, raf = 0;
  let w = 0, h = 0, dpr = 1, R = 1, T = 0, rings = [], starsInk = [], starsGold = [], crosses = [], sparks = [], pulses = [], nextPulse = 1.2;
  let mx = 0, my = 0, px = 0, py = 0, lastDraw = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const seeded = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  function build() {
    const q = TIERS[Math.min(tier, 2)];
    rings = [];
    // inner rings: short dashed arcs close to the core
    for (let i = 0; i < 4; i++) rings.push({ r: .045 + i * .028, a0: seeded(i) * TAU, len: rnd(.9, 1.6) * Math.PI, sp: (i % 2 ? -1 : 1) * rnd(.05, .12), dash: i % 2 ? [6, 6] : [], al: .75, lw: 1.3 });
    rings.push({ r: .165, tick: true, sp: .02, al: .6 });
    // outer rings: long arcs, a few dashed, slow
    for (let i = 0; i < 16; i++) {
      const r = .2 + i * .065 + seeded(i + 9) * .02;
      rings.push({ r, a0: seeded(i + 3) * TAU, len: rnd(.7, 1.5) * Math.PI, sp: (i % 2 ? -1 : 1) * rnd(.006, .02) * (1.4 - r / 1.4),
        dash: seeded(i + 30) < .45 ? [10, 9] : [], al: rnd(.22, .45), lw: 1.1, gold: i === 2 || i === 7 || i === 12 });
    }
    for (const g of rings) g.st = `rgba(${INK},${g.al})`;
    starsInk = []; starsGold = []; crosses = [];
    const n = Math.round(w * h / 9000 * q.stars);
    for (let i = 0; i < n; i++) {
      const s = { x: Math.random() * w, y: Math.random() * h, s: rnd(.6, 1.6), tw: rnd(0, TAU), sp: rnd(.4, 1.6) };
      if (Math.random() < .12) crosses.push(s); else if (Math.random() < .3) starsGold.push(s); else starsInk.push(s);
    }
    sparks = [];
    for (let i = 0; i < Math.round(Math.min(40, w * h / 40000) * (tier ? .5 : 1)); i++) sparks.push(spark({}, true));
  }
  function spark(p, anyY) {
    p.x = rnd(0, w); p.y = anyY ? rnd(0, h) : h + 8; p.s = rnd(1.4, 3.4); p.v = rnd(8, 24); p.dx = rnd(-5, 5); p.a = rnd(.3, .85); p.tw = rnd(0, TAU);
    return p;
  }
  function resize(force) {
    const nw = document.documentElement.clientWidth || innerWidth, nh = innerHeight;
    // Phones fire resize whenever the address bar or keyboard moves, and then only the height changes.
    // Keep the tallest height seen so the picture is never stretched and the stars do not jump around.
    if (!force && h && nw === w && nh <= h) return;
    dpr = Math.min(TIERS[Math.min(tier, 2)].dpr, window.devicePixelRatio || 1);
    w = nw; h = nh; R = Math.max(w, h);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + "px"; cv.style.height = h + "px";   // same size as the buffer, never the changing 100vh
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  /* Rings are huge; most of each arc lies outside the window. Only the parts on screen are stroked. */
  const MARG = 100, VIS = new Uint8Array(96);
  const onScreen = (x, y) => x > -MARG && x < w + MARG && y > -MARG && y < h + MARG;
  function strokeArc(cx, cy, rr, a0, len, dashed) {
    const n = Math.max(6, Math.min(90, Math.ceil(len * rr / 80)));
    for (let i = 0; i <= n; i++) { const a = a0 + len * i / n; VIS[i] = onScreen(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) ? 1 : 0; }
    ctx.beginPath();
    let start = -1;
    for (let i = 0; i < n; i++) {
      const seg = VIS[i] || VIS[i + 1];
      if (seg && start < 0) start = i;
      if ((!seg || i === n - 1) && start >= 0) {
        const end = seg ? n : i;
        const as = a0 + len * start / n;
        ctx.moveTo(cx + Math.cos(as) * rr, cy + Math.sin(as) * rr);
        ctx.arc(cx, cy, rr, as, a0 + len * end / n);
        start = -1;
      }
    }
    ctx.stroke();
  }

  function drawRings(cx, cy) {
    ctx.lineCap = "round";
    const dashOn = TIERS[Math.min(tier, 2)].dash;
    for (const g of rings) {
      const rr = g.r * R, rot = T * g.sp;
      if (g.tick) {                       // tick ring like a dial
        ctx.strokeStyle = g.st; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath();
        for (let k = 0; k < 72; k++) {
          const a = rot + k / 72 * TAU, long = k % 6 === 0, l = long ? 9 : 4;
          ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          ctx.lineTo(cx + Math.cos(a) * (rr + l), cy + Math.sin(a) * (rr + l));
        }
        ctx.stroke();
        continue;
      }
      const a0 = g.a0 + rot;
      const dashed = dashOn && g.dash.length > 0;
      ctx.setLineDash(dashed ? g.dash : []); ctx.lineWidth = g.lw; ctx.strokeStyle = g.st;
      strokeArc(cx, cy, rr, a0, g.len, dashed);
      if (g.gold) {                       // a bright gold scanner running along the arc
        const p = (T * .12 + g.r) % 1, a = a0 + p * g.len;
        const sx = cx + Math.cos(a) * rr, sy = cy + Math.sin(a) * rr;
        if (!onScreen(sx, sy)) continue;
        const grd = ctx.createLinearGradient(cx + Math.cos(a - .25) * rr, cy + Math.sin(a - .25) * rr, sx, sy);
        grd.addColorStop(0, `rgba(${GOLD},0)`); grd.addColorStop(1, `rgba(${GOLD},.9)`);
        ctx.setLineDash([]); ctx.strokeStyle = grd; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rr, Math.max(a0, a - .25), a); ctx.stroke();
        ctx.fillStyle = `rgba(${GOLD},.95)`;
        ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, TAU); ctx.fill();
      }
    }
    ctx.setLineDash([]);
    // glowing core
    if (onScreen(cx, cy)) {
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, .05 * R);
      core.addColorStop(0, `rgba(${GOLD},.10)`); core.addColorStop(1, `rgba(${GOLD},0)`);
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, .05 * R, 0, TAU); ctx.fill();
    }
  }

  function drawPulses(dt, cx, cy) {
    nextPulse -= dt;
    if (nextPulse <= 0) { pulses.push({ r: .03, a: .8 }); nextPulse = rnd(4.5, 6.5); }
    for (const p of pulses) {
      p.r += dt * .16; p.a -= dt * .11;
      if (p.a <= 0) continue;
      ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${GOLD},${p.a})`;
      ctx.beginPath(); ctx.arc(cx, cy, p.r * R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = `rgba(${GOLD},${p.a * .12})`;
      ctx.beginPath(); ctx.arc(cx, cy, p.r * R, 0, TAU); ctx.stroke();
    }
    pulses = pulses.filter((p) => p.a > 0);
  }

  function colAmp(x, maxH) {
    const u = x / w;
    const env = Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI), .8) * (1 - u * .55);
    const v = .55 + .45 * Math.sin(u * 46 - T * 2.1) * Math.sin(u * 13 + T * .7) + .25 * Math.sin(u * 90 + T * 3.3);
    return Math.max(1.5, env * Math.abs(v) * maxH);
  }
  function drawWave() {
    const q = TIERS[Math.min(tier, 2)];
    const y0 = h * .715, step = q.wave + (w < 700 ? 1 : 0), maxH = Math.min(70, h * .07);
    const sweep = ((T * .09) % 1.4 - .2) * w, hotW = w * .06;    // a gold glow travelling along the wave
    ctx.setLineDash(q.dash ? [1.2, 2.4] : []); ctx.lineWidth = q.dash ? 1.2 : 1;
    ctx.strokeStyle = `rgba(${INK},${q.dash ? .55 : .42})`;
    ctx.beginPath();
    for (let x = 0; x < w; x += step) {
      if (Math.abs(x - sweep) < hotW) continue;
      const a = colAmp(x, maxH); ctx.moveTo(x, y0 - a); ctx.lineTo(x, y0 + a);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(${GOLD},.8)`;
    ctx.beginPath();
    const x1 = Math.max(0, Math.ceil((sweep - hotW) / step) * step);
    for (let x = x1; x < w && x < sweep + hotW; x += step) { const a = colAmp(x, maxH) * 1.1; ctx.moveTo(x, y0 - a); ctx.lineTo(x, y0 + a); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${INK},.18)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
  }

  function drawStars(dt) {
    ctx.fillStyle = INK_FILL;
    for (const s of starsInk) { ctx.globalAlpha = .25 + .55 * (.5 + .5 * Math.sin(s.tw + T * s.sp)); ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.fillStyle = GOLD_FILL;
    for (const s of starsGold) { ctx.globalAlpha = .25 + .55 * (.5 + .5 * Math.sin(s.tw + T * s.sp)); ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.strokeStyle = INK_FILL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.globalAlpha = .45;
    for (const s of crosses) { ctx.moveTo(s.x - 4, s.y); ctx.lineTo(s.x + 4, s.y); ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x, s.y + 4); }
    ctx.stroke();
    ctx.fillStyle = GOLD_FILL;
    for (const p of sparks) {
      p.y -= p.v * dt; p.x += p.dx * dt; p.tw += dt * 1.6;
      if (p.y < -8 || p.x < -8 || p.x > w + 8) spark(p, false);
      ctx.globalAlpha = p.a * (.55 + .45 * Math.sin(p.tw));
      ctx.beginPath(); ctx.moveTo(p.x, p.y - p.s); ctx.lineTo(p.x + p.s * .7, p.y); ctx.lineTo(p.x, p.y + p.s); ctx.lineTo(p.x - p.s * .7, p.y); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- governor: watches how the browser copes and lowers the quality when it cannot keep up ---- */
  let gFrames = 0, gLate = 0, gCost = 0, gBad = 0, gGrace = 0;
  function resetGov() { gFrames = gLate = gCost = gBad = 0; gGrace = performance.now() + 3000; }
  function govern(now, since, cost, expected) {
    // only judge a window that is visible, focused and free of long stalls (tab switches, window moves)
    if (mode !== "auto" || now < gGrace || !document.hasFocus() || since > 600) { gFrames = gLate = gCost = 0; return; }
    gFrames++; gCost += cost; if (since > expected * 1.6) gLate++;
    if (gFrames < 90) return;
    const slow = gLate / gFrames > .35 || gCost / gFrames > expected * .4;
    gFrames = gLate = gCost = 0;
    gBad = slow ? gBad + 1 : 0;
    if (gBad >= 2) { gBad = 0; lower(); }
  }
  function lower() {
    tier = Math.min(3, tier + 1);
    saveTier(tier);
    gGrace = performance.now() + 2500;
    if (tier >= 3) stopScene(); else resize(true);
    note();
  }

  /* ---- loop: exactly one requestAnimationFrame chain, whatever happens to focus and visibility ---- */
  let prevRaf = 0, rafDt = 1000 / 60, dtWin = [], nTick = 0, statN = 0, statT = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    // learn the frame time of the display (60, 120, 144 Hz ...) and draw on every n-th frame: a steady rhythm, no judder
    const g = now - prevRaf; prevRaf = now;
    if (g > 2 && g < 100) { dtWin.push(g); if (dtWin.length >= 40) { rafDt = Math.max(4, Math.min(...dtWin)); dtWin.length = 0; } }
    const q = TIERS[Math.min(tier, 2)], target = !cap ? q.fps : tier === 0 ? cap : Math.min(q.fps, cap), skip = Math.max(1, Math.floor(1000 / target / rafDt + .4));
    if (++nTick % skip) return;
    const since = now - lastDraw; lastDraw = now;
    const dt = Math.min(.1, since / 1000), t0 = performance.now();
    T += dt;
    px += (mx - px) * Math.min(1, dt * 2); py += (my - py) * Math.min(1, dt * 2);
    const cx = w * .8 + px * 18, cy = h * .18 + py * 12;
    ctx.clearRect(0, 0, w, h);
    drawStars(dt);
    drawRings(cx, cy);
    drawPulses(dt, cx, cy);
    drawWave();
    govern(now, since, performance.now() - t0, skip * rafDt);
    statN++;
    if (now - statT > 1000) { fpsNow = Math.round(statN * 1000 / (now - statT)); statN = 0; statT = now; stat(); }
  }
  function kick() { if (running && !raf && !document.hidden) raf = requestAnimationFrame(loop); }
  function startScene() {
    if (running) { kick(); return; }
    running = true; root.classList.add("bganim"); cv.style.display = "";
    resize(true); lastDraw = 0; statN = 0; statT = 0; resetGov(); kick();
  }
  function stopScene() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0; root.classList.remove("bganim"); cv.style.display = "none";
  }
  function apply() {
    const want = !reduced && mode !== "off" && !(mode === "auto" && tier >= 3);
    if (want) startScene(); else stopScene();
    note();
  }
  let fpsNow = 0;
  function stat() {
    const el = document.getElementById("bgStat");
    if (!el || !el.offsetParent) return;           // only while the Display panel is on screen
    el.textContent = running ? `Now: ${TIERS[Math.min(tier, 2)].name}${fpsNow ? ", " + fpsNow + " fps" : ", measuring"}.` : "Now: off, the picture stays still.";
  }
  function note() {
    const el = document.getElementById("bgNote"), sel = document.getElementById("bgMode");
    if (sel) sel.value = mode;
    if (!el) return;
    el.textContent = reduced ? "Your system asks for reduced motion, so the picture stays still."
      : mode === "auto" && tier >= 3 ? "Switched off automatically because this browser could not keep up. Choose Always on to force it."
      : mode === "auto" && tier > 0 ? "Running in a lighter mode because this browser is slow."
      : "";
    stat();
  }
  window.wuwaBg = {
    set(m) {
      mode = m === "on" || m === "off" ? m : "auto";
      store.set(KEY, mode);
      tier = 0; saveTier(0);
      apply();
    },
    get mode() { return mode; },
    get tier() { return tier; },
    get loops() { return raf ? 1 : 0; },
    get fps() { return fpsNow; },
    stat,
    setFps(v) { cap = +v || 0; store.set(FKEY, cap ? String(cap) : "auto"); resetGov(); },
  };

  addEventListener("resize", () => { if (running) resize(false); });
  addEventListener("pointermove", (e) => { if (w) { mx = e.clientX / w - .5; my = e.clientY / h - .5; } }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else { lastDraw = 0; resetGov(); kick(); }
  });
  addEventListener("focus", resetGov);
  const sel = document.getElementById("bgMode");
  if (sel) sel.addEventListener("change", () => window.wuwaBg.set(sel.value));
  const fsel = document.getElementById("bgFps");
  if (fsel) { fsel.value = cap ? String(cap) : "auto"; fsel.addEventListener("change", () => window.wuwaBg.setFps(fsel.value)); }
  apply();
})();

/* Interface animations (page fade, hover transitions) can be switched off in Settings. */
(function uiAnim() {
  const sel = document.getElementById("uiAnim");
  let v = "on"; try { v = localStorage.getItem("wuwaUiAnim") || "on"; } catch (e) { /* ignore */ }
  const apply = () => document.documentElement.classList.toggle("noanim", v === "off");
  if (sel) { sel.value = v; sel.addEventListener("change", () => { v = sel.value; try { localStorage.setItem("wuwaUiAnim", v); } catch (e) { /* ignore */ } apply(); }); }
  apply();
})();


/* ---------------------------------------------------------------- Countdown (Overview) */
function fmtLeft(ms) {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}
/* A phase changes around the daily reset of the chosen server on its start/end date (approximate). */
function phaseMs(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + (RESET_HOUR - serverOf(plan).utc) * 3600000;
}
function renderCountdown() {
  const box = $("#cdStrip");
  if (!box) return;
  const now = Date.now();
  const cur = BANNERS.find((b) => phaseMs(b.start) <= now && now < phaseMs(b.end));
  const next = BANNERS.filter((b) => phaseMs(b.start) > now).sort((a, b) => (a.start < b.start ? -1 : 1))[0];
  const names = (b) => b.resonators.map(shortName).join(", ");
  const sv = serverOf(plan);
  const toReset = 86400000 - ((now + sv.utc * 3600000 - RESET_HOUR * 3600000) % 86400000 + 86400000) % 86400000;
  const card = (k, v, sub, cls = "") => `<div class="cd${cls}"><span class="cdk">${k}</span><b class="cdv">${v}</b><span class="cds">${sub}</span></div>`;
  box.innerHTML =
    (cur ? card("Current banner ends in", fmtLeft(phaseMs(cur.end) - now), `${esc(cur.label)} · ${esc(names(cur))}`)
      : card("Current banner", "–", "No running phase in the calendar")) +
    (next ? card("Next banner starts in", fmtLeft(phaseMs(next.start) - now), `${esc(next.label)} · ${esc(names(next))}`)
      : card("Next banner", "–", "Not announced in the calendar yet")) +
    card("Daily reset in", fmtLeft(toReset), `${esc(sv.label)} server, 04:00`) ;
}
setInterval(() => { if (page === "overview" && !document.hidden) renderCountdown(); }, 30000);

/* ---------------------------------------------------------------- Backup (Settings) */
(function backup() {
  const msg = $("#bkMsg"), ex = $("#bkExport"), fi = $("#bkFile"), act = $("#bkAct");
  if (!ex || !fi) return;
  let pending = null;
  const say = (t, cls = "") => { msg.className = "note " + cls; msg.innerHTML = t; };
  ex.onclick = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^wuwa[A-Za-z]*$/.test(k) && k !== "wuwaConveneUrl" && k !== "wuwaBgTier") data[k] = localStorage.getItem(k);
    }
    data.wuwaPlan = JSON.stringify(plan);
    const file = { app: "wuwa-planner", version: 1, exported: new Date().toISOString(), data };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
    a.download = `wuwa-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`Backup saved to your downloads (${Object.keys(data).length} items). The saved Convene link is not included.`, "good");
  };
  fi.onchange = async () => {
    const f = fi.files && fi.files[0];
    fi.value = "";
    if (!f) return;
    pending = null; act.innerHTML = "";
    let obj;
    try { obj = JSON.parse(await f.text()); } catch (e) { return say("This file is not a valid backup.", "bad"); }
    if (!obj || obj.app !== "wuwa-planner" || !obj.data || typeof obj.data !== "object") return say("This file is not a backup from this planner.", "bad");
    const keys = Object.keys(obj.data).filter((k) => /^wuwa[A-Za-z]*$/.test(k) && k !== "wuwaConveneUrl" && k !== "wuwaBgTier" && typeof obj.data[k] === "string");
    if (!keys.length) return say("The backup is empty.", "bad");
    if (obj.data.wuwaPlan) { try { JSON.parse(obj.data.wuwaPlan); } catch (e) { return say("The plan inside this backup is damaged.", "bad"); } }
    pending = { obj, keys };
    const when = obj.exported ? new Date(obj.exported).toLocaleString("en-GB") : "unknown date";
    say(`Backup from <b>${esc(when)}</b> with ${keys.length} items. Restoring replaces your current roster, targets, resources and settings.`);
    act.innerHTML = `<button class="btn on" id="bkGo">Restore now</button><button class="btn" id="bkNo">Cancel</button>`;
    $("#bkNo").onclick = () => { pending = null; act.innerHTML = ""; say(""); };
    $("#bkGo").onclick = async () => {
      if (!pending) return;
      pending.keys.forEach((k) => { try { localStorage.setItem(k, pending.obj.data[k]); } catch (e) { /* ignore */ } });
      if (online && pending.obj.data.wuwaPlan) {
        try { await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: JSON.parse(pending.obj.data.wuwaPlan) }) }); } catch (e) { /* ignore */ }
      }
      location.reload();
    };
  };
})();

/* ---------------------------------------------------------------- Favorites and "open character" clicks */
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-fav]");
  if (f) {
    e.preventDefault(); e.stopPropagation();
    toggleFav(f.dataset.fav, f.dataset.n);
    if (page === "teams") renderTeamsPage(); else if (page === "builds") renderBuilds();
    return;
  }
  const o = e.target.closest("[data-open]");
  if (o) {
    e.preventDefault(); e.stopPropagation();
    buildSel = o.dataset.open; buildEl = "All";
    showPage("builds");
  }
}, true);
