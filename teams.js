"use strict";

/* ================================================================
   WuWa Pull Planner – resonator database and team logic
   Data: Version 3.8 (November 2026). Team tiers follow the community
   team tier list on wuwabuild.com (T0 to T4), plus a few budget teams.
   ================================================================ */

const ELEMENTS = ["Glacio", "Fusion", "Electro", "Aero", "Spectro", "Havoc"];
const EL_COLOR = {
  Glacio: "#8fd3f5", Fusion: "#f08a66", Electro: "#b994ff",
  Aero: "#73e0b4", Spectro: "#f2dc7a", Havoc: "#d0609a", Unknown: "#8d93a0",
};

/* Resonators that are announced but not playable yet (shown with a "Not released" tag, not usable in teams). Remove a name
   here, and fill in its element in RESONATORS below, when it goes live. */
const UNRELEASED = new Set(["Anna", "April", "Cairn", "Gordia", "I.YA", "Lucielle", "Simulsys"]);

/* role: dps = main damage, sub = sub-DPS / buffer, heal = sustain (healer or shielder) */
const RESONATORS = [
  // Glacio
  ["Sanhua", 4, "Glacio", "sub"], ["Baizhi", 4, "Glacio", "heal"], ["Youhu", 4, "Glacio", "heal"],
  ["Lingyang", 5, "Glacio", "dps"], ["Zhezhi", 5, "Glacio", "sub"], ["Carlotta", 5, "Glacio", "dps"],
  ["Lucilla", 5, "Glacio", "sub"], ["Hiyuki", 5, "Glacio", "dps"], ["Suisui", 5, "Glacio", "heal"],
  // Fusion
  ["Chixia", 4, "Fusion", "dps"], ["Mortefi", 4, "Fusion", "sub"], ["Encore", 5, "Fusion", "dps"],
  ["Changli", 5, "Fusion", "sub"], ["Brant", 5, "Fusion", "sub"], ["Lupa", 5, "Fusion", "sub"],
  ["Galbrena", 5, "Fusion", "dps"], ["Mornye", 5, "Fusion", "heal"], ["Aemeath", 5, "Fusion", "dps"],
  ["Denia", 5, "Fusion", "sub"], ["Jingran", 5, "Fusion", "dps"],
  // Electro
  ["Yuanwu", 4, "Electro", "sub"], ["Lumi", 4, "Electro", "sub"], ["Buling", 4, "Electro", "heal"],
  ["Calcharo", 5, "Electro", "dps"], ["Yinlin", 5, "Electro", "sub"], ["Xiangli Yao", 5, "Electro", "dps"],
  ["Augusta", 5, "Electro", "dps"], ["Rebecca", 5, "Electro", "sub"], ["Hsin", 5, "Electro", "dps"],
  ["Suoming", 5, "Electro", "sub"], ["Rover (Electro)", 5, "Electro", "sub"],
  // Aero
  ["Aalto", 4, "Aero", "sub"], ["Yangyang", 4, "Aero", "sub"], ["Jianxin", 5, "Aero", "heal"],
  ["Jiyan", 5, "Aero", "dps"], ["Rover (Aero)", 5, "Aero", "heal"], ["Ciaccona", 5, "Aero", "sub"],
  ["Cartethyia", 5, "Aero", "dps"], ["Iuno", 5, "Aero", "sub"], ["Qiuyuan", 5, "Aero", "sub"],
  ["Sigrika", 5, "Aero", "dps"], ["Qingxiao", 5, "Aero", "dps"],
  // Spectro
  ["Verina", 5, "Spectro", "heal"], ["Shorekeeper", 5, "Spectro", "heal"], ["Jinhsi", 5, "Spectro", "dps"],
  ["Phoebe", 5, "Spectro", "dps"], ["Zani", 5, "Spectro", "dps"], ["Rover (Spectro)", 5, "Spectro", "sub"],
  ["Lynae", 5, "Spectro", "sub"], ["Lucy", 5, "Spectro", "dps"], ["Luuk Herssen", 5, "Spectro", "dps"],
  ["Lily", 5, "Spectro", "heal"],
  // Havoc
  ["Danjin", 4, "Havoc", "dps"], ["Taoqi", 4, "Havoc", "heal"], ["Camellya", 5, "Havoc", "dps"],
  ["Cantarella", 5, "Havoc", "sub"], ["Roccia", 5, "Havoc", "sub"], ["Phrolova", 5, "Havoc", "dps"],
  ["Rover (Havoc)", 5, "Havoc", "dps"], ["Chisa", 5, "Havoc", "heal"], ["Yangyang: Xuanling", 5, "Havoc", "dps"],
  // New Federation, version 4.x: revealed by Kuro on 17 Nov 2026, NOT RELEASED. Element, weapon, rarity and role are
  // not official yet (the leaks contradict each other), so the element stays "Unknown" and the role is a placeholder.
  ["Anna", 5, "Unknown", "sub"], ["April", 5, "Unknown", "sub"], ["Cairn", 5, "Unknown", "sub"],
  ["Gordia", 5, "Unknown", "sub"], ["I.YA", 5, "Unknown", "sub"], ["Lucielle", 5, "Unknown", "sub"],
  ["Simulsys", 5, "Unknown", "sub"],
].map(([n, r, e, role]) => ({ n, r, e, role, soon: UNRELEASED.has(n) }));

const ROLE_LABEL = { dps: "Main DPS", sub: "Sub-DPS", heal: "Sustain" };

const TIER_PTS = { "T0": 100, "T0.5": 93, "T1": 86, "T1.5": 80, "T2": 72, "T3": 63, "T4": 55 };

/* Each team: slot 1 = carry, slot 2 = second unit, slot 3 = third unit.
   Options inside a slot are listed best first. */
const TEAM_TEMPLATES = [
  ["T0", "Hiyuki Hypercarry", ["Hiyuki"], ["Lucilla", "Lynae"], ["Suisui", "Chisa", "Mornye"]],
  ["T0", "Hsin Unison", ["Hsin"], ["Suoming"], ["Lily", "Shorekeeper", "Verina"]],
  ["T0", "Jingran Hypercarry", ["Jingran"], ["Iuno", "Mortefi"], ["Shorekeeper", "Lupa"]],
  ["T0", "Qingxiao Hypercarry", ["Qingxiao"], ["Denia", "Lynae"], ["Mornye"]],
  ["T0", "Xuanling Hypercarry", ["Yangyang: Xuanling"], ["Chisa", "Rebecca", "Phrolova", "Lynae"], ["Suisui", "Chisa"]],
  ["T0.5", "Aemeath Fusion Burst", ["Aemeath"], ["Denia"], ["Chisa", "Suisui", "Lupa"]],
  ["T0.5", "Aemeath Rupture", ["Aemeath"], ["Lynae"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T0.5", "Hsin Flare", ["Hsin"], ["Rover (Electro)"], ["Suisui", "Chisa", "Buling"]],
  ["T0.5", "Luuk Hypercarry", ["Luuk Herssen"], ["Denia", "Lynae", "Sanhua"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T0.5", "Sigrika Hypercarry", ["Sigrika"], ["Qiuyuan", "Lucilla"], ["Ciaccona", "Shorekeeper", "Lily"]],
  ["T0.5", "Suoming Hypercarry", ["Suoming"], ["Lynae", "Sanhua"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T1", "Aemeath Mono Fusion", ["Aemeath"], ["Lupa"], ["Mornye", "Brant", "Changli"]],
  ["T1", "Augusta Hypercarry", ["Augusta"], ["Iuno", "Lynae", "Mortefi"], ["Shorekeeper", "Verina"]],
  ["T1", "Cartethyia Hypercarry", ["Cartethyia"], ["Ciaccona"], ["Chisa", "Rover (Aero)"]],
  ["T1", "Galbrena Hypercarry", ["Galbrena"], ["Lupa", "Lynae", "Lucilla", "Qiuyuan"], ["Mornye", "Denia", "Shorekeeper", "Lily"]],
  ["T1", "Iuno Hypercarry", ["Iuno"], ["Lynae"], ["Mornye", "Ciaccona", "Shorekeeper"]],
  ["T1", "Lucy Hypercarry", ["Lucy"], ["Rebecca"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T1", "Phrolova Echo", ["Phrolova"], ["Lucilla", "Cantarella", "Sigrika", "Lynae"], ["Qiuyuan", "Roccia", "Shorekeeper"]],
  ["T1.5", "Carlotta Hypercarry", ["Carlotta"], ["Lynae", "Zhezhi"], ["Mornye", "Shorekeeper", "Verina", "Buling"]],
  ["T1.5", "Jinhsi Unison", ["Jinhsi"], ["Hsin"], ["Shorekeeper", "Lily", "Verina"]],
  ["T1.5", "Tri-DPS Fusion", ["Galbrena", "Changli"], ["Brant"], ["Lupa"]],
  ["T2", "Brant Hypercarry", ["Brant"], ["Lupa"], ["Denia", "Mornye"]],
  ["T2", "Jiyan Mono Aero", ["Jiyan"], ["Iuno"], ["Ciaccona"]],
  ["T2", "Phoebe Hypercarry", ["Phoebe"], ["Lynae", "Chisa", "Mortefi"], ["Rover (Spectro)"]],
  ["T2", "Zani Hypercarry", ["Zani"], ["Phoebe"], ["Rover (Spectro)", "Shorekeeper"]],
  ["T3", "Camellya Hypercarry", ["Camellya"], ["Lynae", "Roccia", "Sanhua"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T3", "Encore Hypercarry", ["Encore"], ["Lupa"], ["Mornye", "Shorekeeper", "Brant"]],
  ["T3", "Jinhsi Hypercarry", ["Jinhsi"], ["Zhezhi", "Yinlin"], ["Shorekeeper", "Verina", "Buling"]],
  ["T3", "Jiyan Dual DPS", ["Jiyan"], ["Ciaccona"], ["Shorekeeper", "Verina"]],
  ["T3", "Lingyang Hypercarry", ["Lingyang"], ["Lynae", "Zhezhi"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T3", "Xiangli Yao Hypercarry", ["Xiangli Yao"], ["Lynae", "Yinlin"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T3", "Electro Budget", ["Xiangli Yao"], ["Yuanwu", "Yinlin"], ["Buling"]],
  ["T4", "Calcharo Dual DPS", ["Calcharo"], ["Xiangli Yao"], ["Shorekeeper", "Verina"]],
  ["T4", "Chixia Mono Fusion", ["Chixia"], ["Brant", "Mornye"], ["Lupa"]],
  ["T4", "Havoc Rover Hypercarry", ["Rover (Havoc)"], ["Lynae", "Roccia", "Danjin"], ["Mornye", "Shorekeeper", "Verina"]],
  ["T4", "Spectro Rover Budget", ["Rover (Spectro)"], ["Sanhua", "Mortefi"], ["Verina", "Baizhi"]],
].map(([tier, name, ...slots], i) => ({ id: i, tier, name, slots }));

/* ---------------------------------------------------------------- lookup */
function rKey(s) {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
const RES_BY_KEY = new Map(RESONATORS.map((c) => [rKey(c.n), c]));
const RES_BY_NAME = new Map(RESONATORS.map((c) => [c.n, c]));
function findResonator(name) {
  const k = rKey(name);
  if (RES_BY_KEY.has(k)) return RES_BY_KEY.get(k);
  if (k === "xuanling" || k === "yangyangsp") return RES_BY_NAME.get("Yangyang: Xuanling");
  if (k === "luuk") return RES_BY_NAME.get("Luuk Herssen");
  if (k === "thehorekeeper" || k === "theshorekeeper") return RES_BY_NAME.get("Shorekeeper");
  return null;
}

/* Best tier a resonator reaches as a carry (used for teams that match no template). */
const CARRY_TIER = (() => {
  const m = new Map();
  for (const t of TEAM_TEMPLATES) for (const n of t.slots[0]) m.set(n, Math.max(m.get(n) || 0, TIER_PTS[t.tier]));
  return m;
})();

/* ---------------------------------------------------------------- scoring */
const SEQ_CARRY = [0, 4, 7, 9, 10, 11, 13];
const WEAP_CARRY = [0, 6, 7, 8, 9, 10];
const SEQ_SUPP = [0, 2, 3, 3, 4, 4, 5];
const WEAP_SUPP = [0, 2, 2, 3, 3, 3];
const BUILD_ADJ = { casual: -8, solid: 0, optimised: 5 };
const FALLBACK_PEN = { sub: 14, heal: 11, other: 20 };

/* Estimated chance to clear current endgame (Tower of Adversity / Whimpering Wastes) with full stars.
   Rough model: 50 % at power 78, about 88 % at power 94. */
function clearChance(power) {
  return 1 / (1 + Math.exp(-(power - 78) / 8));
}
function gradeOf(power) {
  if (power >= 105) return "SS";
  if (power >= 95) return "S";
  if (power >= 85) return "A";
  if (power >= 72) return "B";
  if (power >= 60) return "C";
  return "D";
}

/* Penalty for filling a template slot with someone who is not listed there. */
function slotPenalty(name, slotIdx, slotOpts) {
  const i = slotOpts.indexOf(name);
  if (i >= 0) return { pen: i * 3, listed: true };
  const c = RES_BY_NAME.get(name);
  const role = c ? c.role : "other";
  let pen = FALLBACK_PEN.other;
  if (slotIdx === 2 && role === "heal") pen = FALLBACK_PEN.heal;
  else if (role === "sub" || role === "heal") pen = FALLBACK_PEN.sub;
  return { pen, listed: false };
}

/* Best template match for 1-3 member names. Returns base power and the matched template. */
function matchTemplate(members) {
  let best = null;
  for (const t of TEAM_TEMPLATES) {
    for (const carry of members) {
      if (!t.slots[0].includes(carry)) continue;
      const rest = members.filter((m) => m !== carry);
      const perms = rest.length === 2 ? [rest, [rest[1], rest[0]]] : rest.length === 1 ? [[rest[0], null], [null, rest[0]]] : [[null, null]];
      for (const [a, b] of perms) {
        let pen = t.slots[0].indexOf(carry) * 3;
        let listed = 1;
        const subs = [];
        [[a, 1], [b, 2]].forEach(([m, si]) => {
          if (!m) { pen += 25; return; }
          const r = slotPenalty(m, si, t.slots[si]);
          pen += r.pen;
          if (r.listed) listed++; else subs.push(m);
        });
        const base = TIER_PTS[t.tier] - pen;
        const rank = base + listed * 1.5; // prefer the archetype that lists more of the members
        if (!best || rank > best.rank) best = { base, rank, template: t, carry, listed, subs };
      }
    }
  }
  return best;
}

/* members: array of names (1-3). info(name) -> {s, w, planned} */
function scoreTeam(members, info, build = "solid") {
  members = members.filter(Boolean);
  const notes = [];
  if (!members.length) return null;
  let m = matchTemplate(members);
  let base, carry, template = null, exact = false;
  if (m && m.base >= 40) {
    base = m.base; carry = m.carry; template = m.template;
    exact = m.listed === 3;
    if (m.subs.length) notes.push(`${m.subs.join(" and ")} ${m.subs.length > 1 ? "are" : "is"} not a usual pick for ${template.name}.`);
  } else {
    // No known team: judge by roles.
    const dps = members.filter((n) => (RES_BY_NAME.get(n) || {}).role === "dps");
    carry = dps.sort((a, b) => (CARRY_TIER.get(b) || 55) - (CARRY_TIER.get(a) || 55))[0] || members[0];
    base = (CARRY_TIER.get(carry) || 55) - 22 - (3 - members.length) * 25;
    notes.push("No known team archetype. The score is a rough guess from roles.");
  }
  const roles = members.map((n) => (RES_BY_NAME.get(n) || {}).role);
  const hasHeal = roles.includes("heal");
  if (!hasHeal && !(template && exact)) { base -= 6; notes.push("No healer or shielder. Survival will be harder."); }
  else if (!hasHeal) notes.push("No healer in this team. Play around dodges.");
  if (roles.filter((r) => r === "dps").length >= 2 && !(template && exact)) notes.push("Two main DPS share field time. One of them deals less damage.");
  if (members.length < 3) notes.push(`Add ${3 - members.length} more resonator${members.length === 2 ? "" : "s"}.`);

  let inv = 0;
  const planned = [];
  for (const n of members) {
    const x = info(n) || { s: 0, w: 0 };
    const s = Math.max(0, Math.min(6, x.s | 0)), w = Math.max(0, Math.min(5, x.w | 0));
    if (n === carry) inv += SEQ_CARRY[s] + WEAP_CARRY[w];
    else inv += SEQ_SUPP[s] + WEAP_SUPP[w];
    if (x.planned) planned.push(n);
  }
  const cInfo = info(carry) || {};
  if (!(cInfo.w > 0)) notes.push(`${carry} has no signature weapon. That costs a lot of damage on a carry.`);
  const adj = BUILD_ADJ[build] ?? 0;
  const power = Math.round(base + inv + adj);
  return {
    members, carry, template, exact, base: Math.round(base), inv, adj, power,
    grade: gradeOf(power), chance: clearChance(power), planned, notes,
  };
}

/* ---------------------------------------------------------------- auto builder */
/* owned: Map name -> {s, w, planned}. Returns teams sorted by power. */
function buildTeams(owned, build = "solid") {
  const has = (n) => owned.has(n);
  const info = (n) => owned.get(n);
  const pool = [...owned.keys()];
  const fill = (slotIdx, exclude) => {
    const want = slotIdx === 2 ? ["heal", "sub"] : ["sub", "heal"];
    return pool
      .filter((n) => !exclude.includes(n))
      .map((n) => ({ n, c: RES_BY_NAME.get(n) }))
      .filter((x) => x.c && want.includes(x.c.role))
      .sort((a, b) => want.indexOf(a.c.role) - want.indexOf(b.c.role) || b.c.r - a.c.r || ((info(b.n).s | 0) - (info(a.n).s | 0)))
      .slice(0, 3).map((x) => x.n);
  };
  const seen = new Map();
  for (const t of TEAM_TEMPLATES) {
    for (const carry of t.slots[0].filter(has)) {
      let o1 = t.slots[1].filter((n) => has(n) && n !== carry);
      if (!o1.length) o1 = fill(1, [carry]);
      for (const a of o1) {
        let o2 = t.slots[2].filter((n) => has(n) && n !== carry && n !== a);
        if (!o2.length) o2 = fill(2, [carry, a]);
        for (const b of o2) {
          const key = [carry, a, b].sort().join("|");
          if (seen.has(key)) continue;
          const sc = scoreTeam([carry, a, b], info, build);
          if (sc) seen.set(key, sc);
        }
      }
    }
  }
  return [...seen.values()].sort((x, y) => y.power - x.power || y.chance - x.chance);
}

/* Best k teams without shared members (for Tower of Adversity / Whimpering Wastes). */
function bestTeamSet(teams, k) {
  const cand = teams.slice(0, 36);
  let best = null;
  const rec = (start, chosen, used, sum) => {
    if (chosen.length === k) {
      if (!best || sum > best.sum) best = { sum, teams: [...chosen] };
      return;
    }
    for (let i = start; i < cand.length; i++) {
      const t = cand[i];
      if (t.members.some((n) => used.has(n))) continue;
      t.members.forEach((n) => used.add(n));
      chosen.push(t);
      rec(i + 1, chosen, used, sum + t.power);
      chosen.pop();
      t.members.forEach((n) => used.delete(n));
    }
  };
  rec(0, [], new Set(), 0);
  return best ? best.teams : null;
}
