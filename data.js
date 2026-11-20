"use strict";

/* ================================================================
   WuWa Pull Planner – game data that changes with every patch.
   Update this file when a new version or phase starts.
   ================================================================ */

const DATA_INFO = { version: "3.8", updated: "2026-11-20" };

/* Servers: fixed UTC offset of the server time. Daily reset is at 04:00 server time. */
const SERVERS = [
  { k: "america", label: "America", utc: -5 },
  { k: "europe", label: "Europe", utc: 1 },
  { k: "asia", label: "Asia", utc: 8 },
  { k: "sea", label: "SEA", utc: 8 },
  { k: "hmt", label: "HMT (TW, HK, MO)", utc: 8 },
];
const RESET_HOUR = 4;

/* Banner calendar. end = last day of the phase (server time).
   Dates for 3.8 are the expected dates until the in-game Convene notice confirms them. */
const BANNERS = [
  { id: "3.8-1", label: "3.8 Phase 1", start: "2026-11-12", end: "2026-12-03", resonators: ["Lily", "Sigrika", "Qiuyuan"] },
  { id: "3.8-2", label: "3.8 Phase 2", start: "2026-12-03", end: "2026-12-21", resonators: ["Yangyang: Xuanling", "Suisui", "Hiyuki"] },
];

/* 5★ resonators of the standard pool. Losing the 50/50 gives one of these. */
const STANDARD_5 = [
  { n: "Verina", id: 1503 }, { n: "Encore", id: 1203 }, { n: "Calcharo", id: 1301 },
  { n: "Lingyang", id: 1104 }, { n: "Jianxin", id: 1405 },
];

/* Estimated one-time Astrite for the rest of a version. "Add estimates" on the Resources page inserts these rows. */
const INCOME_PRESETS = [
  {
    label: "3.8 estimates",
    sources: [
      { name: "Unwritten Dreams", astrite: 1200 },
      { name: "Events 3.8", astrite: 1400 },
      { name: "Endstate Matrix", astrite: 300 },
      { name: "Whimpering Wastes (3x)", astrite: 2100 },
      { name: "Tower of Adversity (2x)", astrite: 1400 },
      { name: "Permanent events", astrite: 1280 },
      { name: "Resonator Trials", astrite: 100 },
    ],
  },
];

/* Where the team tiers in teams.js come from. */
const TEAM_SOURCES = {
  version: "3.8",
  updated: "Nov 2026",
  sites: [
    { label: "wuwabuild.com", url: "https://wuwabuild.com" },
  ],
};
