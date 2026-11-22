"use strict";

/* ================================================================
   Character builds and weapons
   Builds: Game8 "All Character Builds" (game8.co, checked 20 Nov 2026),
   for Lily and Suoming the Game8/Games.gg/GameMarket build guides.
   Weapon ranks after the best weapon are the alternatives those guides name.
   Weapon types, rarities and substats: Game8 / Prydwen weapon lists.
   ================================================================ */

const BUILD_INFO = {
  version: "3.8",
  updated: "Nov 2026",
  sites: [
    { label: "Game8 – All Character Builds", url: "https://game8.co/games/Wuthering-Waves/archives/457465" },
    { label: "Prydwen", url: "https://www.prydwen.gg/wuthering-waves/characters" },
  ],
};

const WEAPON_TYPES = ["Sword", "Broadblade", "Pistols", "Gauntlets", "Rectifier"];

/* name: [type, rarity, substat]  substat: crit | atk | er | hp | def */
const WEAPONS = (() => {
  const L = {
    Broadblade: [
      ["Ages of Harvest", 5, "crit"], ["Verdant Summit", 5, "crit"], ["Lustrous Razor", 5, "atk"], ["Thunderflare Dominion", 5, "crit"],
      ["Wildfire Mark", 5, "crit"], ["Kumokiri", 5, "crit"], ["Starfield Calibrator", 5, "er"], ["Radiance Cleaver", 5, "crit"],
      ["Thousandfold Deliverance", 5, "hp"],
      ["Aureate Zenith", 4, "crit"], ["Autumntrace", 4, "crit"], ["Dauntless Evernight", 4, "def"], ["Discord", 4, "er"],
      ["Helios Cleaver", 4, "atk"], ["Waning Redshift", 4, "atk"], ["Broadblade#41", 4, "er"], ["Meditations on Mercy", 4, "atk"],
      ["Beguiling Melody", 3, "atk"], ["Broadblade of Night", 3, "atk"], ["Broadblade of Voyager", 3, "er"], ["Originite: Type I", 3, "def"],
      ["Guardian Broadblade", 3, "atk"], ["Tyro Broadblade", 2, "atk"], ["Training Broadblade", 1, "atk"],
    ],
    Sword: [
      ["Emerald of Genesis", 5, "crit"], ["Blazing Brilliance", 5, "crit"], ["Red Spring", 5, "crit"], ["Unflickering Valor", 5, "er"],
      ["Bloodpact's Pledge", 5, "er"], ["Defier's Thorn", 5, "hp"], ["Emerald Sentence", 5, "crit"], ["Everbright Polestar", 5, "crit"],
      ["Laser Shearer", 5, "er"], ["Azure Oath", 5, "crit"], ["Frostburn", 5, "crit"], ["Glint of Clouds", 5, "crit"], ["Unspoken Rue", 5, "crit"],
      ["Sword#18", 4, "atk"], ["Somnoire Anchor", 4, "atk"], ["Overture", 4, "er"], ["Lunar Cutter", 4, "atk"], ["Lumingloss", 4, "atk"],
      ["Commando of Conviction", 4, "atk"], ["Endless Collapse", 4, "atk"], ["Fables of Wisdom", 4, "atk"], ["Feather Edge", 4, "crit"],
      ["Sword of Voyager", 3, "er"], ["Sword of Night", 3, "atk"], ["Originite: Type II", 3, "hp"], ["Guardian Sword", 3, "hp"],
      ["Tyro Sword", 2, "atk"], ["Training Sword", 1, "atk"],
    ],
    Pistols: [
      ["Static Mist", 5, "crit"], ["The Last Dance", 5, "crit"], ["Woodland Aria", 5, "crit"], ["Lux & Umbra", 5, "crit"],
      ["Phasic Homogenizer", 5, "crit"], ["Spectrum Blaster", 5, "crit"], ["Spectral Trigger", 5, "crit"], ["Skull Thrasher", 5, "crit"],
      ["Lullaby", 5, "er"],
      ["Novaburst", 4, "atk"], ["Thunderbolt", 4, "atk"], ["Undying Flame", 4, "atk"], ["Cadenza", 4, "er"], ["Relativistic Jet", 4, "atk"],
      ["Pistols#26", 4, "atk"], ["Romance in Farewell", 4, "atk"], ["Solar Flame", 4, "crit"],
      ["Pistols of Voyager", 3, "hp"], ["Pistols of Night", 3, "atk"], ["Originite: Type III", 3, "atk"], ["Guardian Pistols", 3, "atk"],
      ["Tyro Pistols", 2, "atk"], ["Training Pistols", 1, "atk"],
    ],
    Gauntlets: [
      ["Verity's Handle", 5, "crit"], ["Abyss Surges", 5, "atk"], ["Tragicomedy", 5, "crit"], ["Blazing Justice", 5, "crit"],
      ["Moongazer's Sigil", 5, "crit"], ["Pulsation Bracer", 5, "crit"], ["Daybreaker's Spine", 5, "crit"], ["Solsworn Ciphers", 5, "crit"],
      ["Stonard", 4, "crit"], ["Marcato", 4, "er"], ["Hollow Mirage", 4, "atk"], ["Amity Accord", 4, "def"], ["Gauntlets#21D", 4, "er"],
      ["Celestial Spiral", 4, "atk"], ["Legend of Drunken Hero", 4, "atk"], ["Aether Strike", 4, "crit"],
      ["Originite: Type IV", 3, "crit"], ["Guardian Gauntlets", 3, "def"], ["Gauntlets of Voyager", 3, "def"], ["Gauntlets of Night", 3, "atk"],
      ["Tyro Gauntlets", 2, "atk"], ["Training Gauntlets", 1, "atk"],
    ],
    Rectifier: [
      ["Stringmaster", 5, "crit"], ["Rime-Draped Sprouts", 5, "crit"], ["Stellar Symphony", 5, "er"], ["Cosmic Ripples", 5, "atk"],
      ["Whispers of Sirens", 5, "crit"], ["Luminous Hymn", 5, "crit"], ["Lethean Elegy", 5, "crit"], ["Boson Astrolabe", 5, "er"],
      ["Blooming Jadehaven", 5, "crit"], ["Firstlight's Herald", 5, "er"], ["Freeze Frame", 5, "crit"], ["Forged Dwarf Star", 5, "crit"],
      ["Rectifier#25", 4, "er"], ["Fusion Accretion", 4, "atk"], ["Variation", 4, "er"], ["Jinzhou Keeper", 4, "atk"], ["Comet Flare", 4, "hp"],
      ["Augment", 4, "crit"], ["Call of the Abyss", 4, "er"], ["Ocean's Gift", 4, "atk"], ["Waltz in Masquerade", 4, "atk"], ["Radiant Dawn", 4, "crit"],
      ["Rectifier of Voyager", 3, "er"], ["Rectifier of Night", 3, "atk"], ["Originite: Type V", 3, "atk"], ["Guardian Rectifier", 3, "atk"],
      ["Tyro Rectifier", 2, "atk"], ["Training Rectifier", 1, "atk"],
    ],
  };
  const m = new Map();
  for (const [t, list] of Object.entries(L)) for (const [n, r, s] of list) m.set(n, { n, t, r, s });
  return m;
})();
/* Lv 90 stats: name -> [base ATK, substat key, substat value].
   Keys: cr CRIT Rate, cd CRIT DMG, atk ATK%, er Energy Regen, hp HP%, def DEF%.
   4★: Game8 weapon lists. 5★ and 3★: Prydwen weapon list (13 Jul 2026), Frostburn: ldshop.gg, Glint of Clouds: allthings.how,
   Thousandfold Deliverance: allthings.how (beta leak, can differ slightly). Weapons that are not listed here have no number yet. */
const WEAPON_STAT_NAMES = { cr: "CRIT Rate", cd: "CRIT DMG", atk: "ATK%", er: "Energy Regen", hp: "HP%", def: "DEF%" };
const WEAPON_STATS = {
  // 5★
  "Lustrous Razor": [587, "atk", 36.4], "Abyss Surges": [587, "atk", 36.4], "Cosmic Ripples": [500, "atk", 54], "Stringmaster": [500, "cr", 36],
  "Verdant Summit": [587, "cd", 48.6], "Emerald of Genesis": [587, "cr", 24.3], "Static Mist": [587, "cr", 24.3], "Ages of Harvest": [587, "cr", 24.3],
  "Blazing Brilliance": [587, "cd", 48.6], "Rime-Draped Sprouts": [500, "cd", 72], "Verity's Handle": [587, "cr", 24.3], "Stellar Symphony": [412, "er", 77],
  "Red Spring": [587, "cr", 24.3], "The Last Dance": [500, "cd", 72], "Tragicomedy": [587, "cr", 24.3], "Luminous Hymn": [500, "cr", 36],
  "Unflickering Valor": [415, "er", 77], "Bloodpact's Pledge": [587, "er", 38.9], "Whispers of Sirens": [500, "cd", 72], "Blazing Justice": [587, "cd", 48.6],
  "Woodland Aria": [500, "cr", 36], "Defier's Thorn": [413, "hp", 72.2], "Wildfire Mark": [587, "cd", 48.6], "Lethean Elegy": [588, "cr", 24.3],
  "Thunderflare Dominion": [675, "cr", 12.1], "Moongazer's Sigil": [500, "cr", 36], "Lux & Umbra": [587, "cd", 48.6], "Emerald Sentence": [587, "cr", 24.3],
  "Kumokiri": [500, "cr", 36], "Boson Astrolabe": [525, "er", 38.8], "Radiance Cleaver": [587, "cd", 48.6], "Laser Shearer": [587, "er", 38.8],
  "Phasic Homogenizer": [587, "cd", 48.6], "Pulsation Bracer": [587, "cr", 24.3], "Spectrum Blaster": [587, "cr", 24.3], "Starfield Calibrator": [414, "er", 77],
  "Everbright Polestar": [588, "cr", 24.3], "Daybreaker's Spine": [588, "cr", 24.3], "Frostburn": [588, "cr", 24.3], "Glint of Clouds": [500, "cr", 36],
  "Thousandfold Deliverance": [413, "hp", 72.2],
  // 4★
  "Waning Redshift": [462, "atk", 18.2], "Aureate Zenith": [412, "cd", 40.5], "Broadblade#41": [412, "er", 32.3], "Meditations on Mercy": [462, "atk", 18.2],
  "Autumntrace": [412, "cr", 20.3], "Dauntless Evernight": [337, "def", 61.6], "Discord": [337, "er", 51.8], "Helios Cleaver": [412, "atk", 30.4],
  "Legend of Drunken Hero": [462, "atk", 18.2], "Gauntlets#21D": [387, "er", 38.9], "Celestial Spiral": [462, "atk", 18.2], "Amity Accord": [337, "def", 61.6],
  "Hollow Mirage": [412, "atk", 30.4], "Marcato": [337, "er", 51.8], "Stonard": [412, "cr", 20.3], "Aether Strike": [412, "cd", 40.5],
  "Cadenza": [337, "er", 51.8], "Novaburst": [412, "atk", 30.4], "Thunderbolt": [387, "atk", 36.4], "Undying Flame": [412, "atk", 30.4],
  "Romance in Farewell": [462, "atk", 18.2], "Solar Flame": [412, "cr", 20.2], "Pistols#26": [387, "atk", 36.4], "Relativistic Jet": [462, "atk", 18.2],
  "Ocean's Gift": [462, "atk", 18.2], "Fusion Accretion": [462, "atk", 18.2], "Call of the Abyss": [337, "er", 51.8], "Waltz in Masquerade": [462, "atk", 18.2],
  "Rectifier#25": [337, "er", 51.8], "Augment": [412, "cr", 20.3], "Comet Flare": [412, "hp", 30.4], "Jinzhou Keeper": [387, "atk", 36.4],
  "Variation": [337, "er", 51.8], "Radiant Dawn": [412, "cd", 40.5], "Feather Edge": [412, "cr", 20.2], "Sword#18": [387, "atk", 36.4],
  "Fables of Wisdom": [462, "atk", 18.2], "Somnoire Anchor": [462, "atk", 18.2], "Endless Collapse": [462, "atk", 18.2], "Overture": [337, "er", 51.8],
  "Commando of Conviction": [412, "atk", 30.4], "Lumingloss": [387, "atk", 36.4], "Lunar Cutter": [412, "atk", 30.4],
  // 3★
  "Gauntlets of Voyager": [325, "def", 30.7], "Originite: Type I": [300, "def", 38.4], "Guardian Gauntlets": [300, "def", 38.4],
  "Broadblade of Night": [325, "atk", 24.3], "Sword of Night": [325, "atk", 24.3], "Pistols of Night": [325, "atk", 24.3], "Gauntlets of Night": [325, "atk", 24.3],
  "Rectifier of Night": [325, "atk", 24.3], "Pistols of Voyager": [300, "hp", 30.3], "Originite: Type II": [325, "hp", 24.3], "Originite: Type III": [325, "atk", 24.3],
  "Guardian Rectifier": [325, "atk", 24.3], "Guardian Pistols": [325, "atk", 24.3], "Guardian Broadblade": [325, "atk", 24.3], "Originite: Type V": [300, "atk", 30.3],
  "Guardian Sword": [300, "hp", 30.3], "Broadblade of Voyager": [300, "er", 32.3], "Sword of Voyager": [300, "er", 32.3], "Rectifier of Voyager": [300, "er", 32.3],
  "Originite: Type IV": [300, "cd", 40.5], "Beguiling Melody": [300, "atk", 30.4],
};
for (const [n, [a, k, v]] of Object.entries(WEAPON_STATS)) {
  const w = WEAPONS.get(n);
  if (w) { w.a = a; w.sk = k; w.sv = v; }
}
/* "ATK 587" and "CRIT Rate 24.3%" for a weapon, or null while there is no number for it */
function weaponStatText(w) {
  if (!w || w.a == null) return null;
  return { atk: `ATK ${w.a}`, sub: `${WEAPON_STAT_NAMES[w.sk]} ${w.sv}%`, a: w.a, name: WEAPON_STAT_NAMES[w.sk], val: w.sv };
}

const WEAPON_BY_KEY = new Map([...WEAPONS.values()].map((w) => [String(w.n).toLowerCase().replace(/[^a-z0-9]/g, ""), w]));
function findWeapon(name) {
  return WEAPONS.get(name) || WEAPON_BY_KEY.get(String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "")) || null;
}

/* name: [weapon type, [best weapon, alternatives...], echo set, main echo, [4-cost, 3-cost, 1-cost]] */
const CHAR_BUILDS = (() => {
  const C = "CRIT Rate or CRIT DMG";
  const raw = {
    "Aemeath": ["Sword", ["Everbright Polestar", "Emerald of Genesis", "Red Spring"], "5-pc Trailblazing Star", "Sigillum", [C, "Fusion DMG or ATK%", "ATK%"]],
    "Augusta": ["Broadblade", ["Thunderflare Dominion", "Verdant Summit", "Aureate Zenith"], "3-pc Crown of Valor + 2-pc Void Thunder", "The False Sovereign", [C, "Electro DMG or ATK%", "ATK%"]],
    "Brant": ["Sword", ["Unflickering Valor"], "5-pc Tidebreaking Courage", "Dragon of Dirge", [C, "Energy Regen or Fusion DMG", "ATK%"]],
    "Calcharo": ["Broadblade", ["Lustrous Razor"], "5-pc Void Thunder", "Nightmare: Thundering Mephis", [C, "Electro DMG", "ATK%"]],
    "Camellya": ["Sword", ["Red Spring"], "5-pc Havoc Eclipse", "Nightmare: Crownless", [C, "Havoc DMG", "ATK%"]],
    "Cantarella": ["Rectifier", ["Whispers of Sirens"], "5-pc Midnight Veil", "Lorelei", [C, "Havoc DMG", "ATK%"]],
    "Carlotta": ["Pistols", ["The Last Dance"], "5-pc Frosty Resolve", "Sentry Construct", [C, "Glacio DMG or ATK%", "ATK%"]],
    "Cartethyia": ["Sword", ["Defier's Thorn"], "5-pc Windward Pilgrimage", "Reminiscence: Fleurdelys", ["CRIT Rate & CRIT DMG", "–", "HP%"]],
    "Changli": ["Sword", ["Blazing Brilliance"], "5-pc Molten Rift", "Nightmare: Inferno Rider", [C, "Fusion DMG", "ATK%"]],
    "Chisa": ["Broadblade", ["Kumokiri", "Wildfire Mark", "Lustrous Razor", "Autumntrace"], "3-pc Thread of Severed Fate + 2-pc Havoc Eclipse", "Reminiscence: Threnodian – Leviathan", [C, "ATK% or Havoc DMG", "ATK%"]],
    "Ciaccona": ["Pistols", ["Woodland Aria"], "5-pc Gusts of Welkin", "Reminiscence: Fleurdelys", [C, "Aero DMG", "ATK%"]],
    "Denia": ["Rectifier", ["Forged Dwarf Star"], "5-pc Chromatic Foam", "Reminiscence: Denia", [C, "Fusion DMG", "ATK%"]],
    "Encore": ["Rectifier", ["Stringmaster", "Cosmic Ripples"], "5-pc Molten Rift", "Nightmare: Inferno Rider", [C, "Fusion DMG", "ATK% or Energy Regen"]],
    "Galbrena": ["Pistols", ["Lux & Umbra"], "3-pc Flamewing's Shadow + 2-pc Flaming Clawprint", "Corrosaurus", [C, "Fusion DMG", "ATK%"]],
    "Hiyuki": ["Sword", ["Frostburn", "Red Spring", "Feather Edge"], "5-pc Wishes of Quiet Snowfall", "Reminiscence: Threnodian – Voidborne Construct", [C, "Glacio DMG or ATK%", "ATK%"]],
    "Hsin": ["Rectifier", ["Blooming Jadehaven", "Lethean Elegy", "Stringmaster", "Cosmic Ripples", "Waltz in Masquerade"], "5-pc Heart of Sworn Vigil", "Reminiscence: Suhsin the Inevitable", [C, "Electro DMG or ATK%", "ATK%"]],
    "Iuno": ["Gauntlets", ["Moongazer's Sigil", "Verity's Handle", "Abyss Surges"], "3-pc Crown of Valor + 2-pc Sierra Gale", "Lady of the Sea", [C, "Aero DMG", "ATK%"]],
    "Jianxin": ["Gauntlets", ["Verity's Handle"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Aero DMG or Energy Regen", "ATK%"]],
    "Jingran": ["Broadblade", ["Thousandfold Deliverance"], "5-pc Lamp of Nether Road", "Myriad Snare: Rustfire Chassis", [C, "–", "HP%"]],
    "Jinhsi": ["Broadblade", ["Ages of Harvest"], "5-pc Celestial Light", "Jué", [C, "Spectro DMG", "ATK%"]],
    "Jiyan": ["Broadblade", ["Verdant Summit"], "5-pc Sierra Gale", "Nightmare: Feilian Beringal", [C, "Aero DMG", "ATK%"]],
    "Lily": ["Pistols", ["Lullaby", "Static Mist", "Cadenza", "Romance in Farewell"], "5-pc Flower of Tinged Yearning (Unison) or 5-pc Rejuvenating Glow (Echo teams)", "Formrender or Fallacy of No Return", ["HP% or Healing Bonus", "Energy Regen", "HP%"]],
    "Lingyang": ["Gauntlets", ["Abyss Surges"], "5-pc Frosty Resolve", "Sentry Construct", [C, "Glacio DMG", "ATK%"]],
    "Lucilla": ["Rectifier", ["Freeze Frame", "Lethean Elegy", "Stringmaster"], "5-pc Wishes of Quiet Snowfall", "Glommoth", [C, "Glacio DMG or ATK%", "ATK%"]],
    "Lucy": ["Pistols", ["Spectral Trigger", "Lux & Umbra", "Skull Thrasher", "Phasic Homogenizer", "The Last Dance", "Solar Flame"], "1-pc Shadow of Shattered Dreams + 2-pc Rite of Gilded Revelation + 2-pc Reel of Spliced Memories", "Reminiscence: Nightmare Adam Smasher", [C, "Spectro DMG", "ATK%"]],
    "Lupa": ["Broadblade", ["Wildfire Mark"], "5-pc Flaming Clawprint", "Lioness of Glory", [C, "Fusion DMG", "ATK%"]],
    "Luuk Herssen": ["Gauntlets", ["Daybreaker's Spine", "Pulsation Bracer"], "5-pc Rite of Gilded Revelation", "Twin Nova – Nebulous Cannon", [C, "Spectro DMG", "ATK%"]],
    "Lynae": ["Pistols", ["Spectrum Blaster"], "5-pc Pact of Neonlight Leap", "Hyvatia", [C, "Spectro DMG or Energy Regen", "ATK%"]],
    "Mornye": ["Broadblade", ["Starfield Calibrator", "Discord", "Broadblade#41", "Dauntless Evernight"], "5-pc Halo of Starry Radiance", "Reactor Husk", ["Healing Bonus", "Energy Regen", "DEF%"]],
    "Phoebe": ["Rectifier", ["Luminous Hymn", "Ocean's Gift"], "5-pc Eternal Radiance", "Capitaneus", [C, "Spectro DMG", "ATK%"]],
    "Phrolova": ["Rectifier", ["Lethean Elegy"], "3-pc Dream of the Lost + 2-pc Havoc Eclipse", "Nightmare: Hecate", [C, "Havoc DMG", "ATK%"]],
    "Qingxiao": ["Sword", ["Glint of Clouds", "Red Spring", "Emerald Sentence", "Lumingloss"], "5-pc Heart of Evil's Purge", "Calamity Effigy", [C, "Aero DMG and ATK%", "ATK%"]],
    "Qiuyuan": ["Sword", ["Emerald Sentence", "Red Spring", "Emerald of Genesis", "Commando of Conviction"], "3-pc Law of Harmony + 2-pc Sierra Gale", "Reminiscence: Fenrico", [C, "Aero DMG", "ATK%"]],
    "Rebecca": ["Pistols", ["Skull Thrasher"], "1-pc Shadow of Shattered Dreams + 2-pc Void Thunder + 2-pc Reel of Spliced Memories", "Reminiscence: Nightmare Adam Smasher", [C, "Electro DMG", "ATK%"]],
    "Roccia": ["Gauntlets", ["Tragicomedy"], "5-pc Midnight Veil", "Nightmare: Impermanence Heron", [C, "Havoc DMG or Energy Regen", "ATK%"]],
    "Rover (Aero)": ["Sword", ["Bloodpact's Pledge"], "5-pc Windward Pilgrimage", "Reminiscence: Fleurdelys", [C, "Aero DMG", "ATK%"]],
    "Rover (Electro)": ["Sword", ["Blazing Brilliance"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Electro DMG", "ATK%"]],
    "Rover (Havoc)": ["Sword", ["Emerald of Genesis"], "5-pc Havoc Eclipse", "Dreamless", [C, "Havoc DMG", "ATK%"]],
    "Rover (Spectro)": ["Sword", ["Emerald of Genesis"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Spectro DMG or Energy Regen", "ATK%"]],
    "Shorekeeper": ["Rectifier", ["Stellar Symphony"], "5-pc Rejuvenating Glow", "Fallacy of No Return", ["Healing Bonus or CRIT DMG", "Energy Regen or HP%", "HP%"]],
    "Sigrika": ["Gauntlets", ["Solsworn Ciphers", "Blazing Justice", "Aether Strike", "Abyss Surges"], "5-pc Sound of True Name", "Nameless Explorer", [C, "Energy Regen or ATK%", "ATK%"]],
    "Suisui": ["Rectifier", ["Firstlight's Herald", "Stellar Symphony", "Variation", "Call of the Abyss"], "5-pc Song of Feathered Trace", "Forbidden Bastion", ["Healing Bonus or HP%", "Energy Regen or HP%", "HP%"]],
    "Suoming": ["Sword", ["Unspoken Rue", "Red Spring", "Emerald of Genesis", "Lumingloss"], "5-pc Heart of Sworn Vigil", "Reminiscence: Suhsin the Inevitable", [C, "Electro DMG", "ATK%"]],
    "Verina": ["Rectifier", ["Stellar Symphony"], "5-pc Rejuvenating Glow", "Fallacy of No Return", ["Healing Bonus or ATK%", "Energy Regen", "ATK%"]],
    "Xiangli Yao": ["Gauntlets", ["Verity's Handle"], "5-pc Void Thunder", "Nightmare: Thundering Mephis", [C, "Electro DMG", "ATK%"]],
    "Yangyang: Xuanling": ["Sword", ["Azure Oath", "Emerald Sentence", "Emerald of Genesis", "Red Spring"], "5-pc Song of Feathered Trace", "Thousand-Puppet Pavilion", [C, "Havoc DMG", "ATK%"]],
    "Yinlin": ["Rectifier", ["Stringmaster"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Electro DMG or Energy Regen", "ATK%"]],
    "Zani": ["Gauntlets", ["Blazing Justice"], "5-pc Eternal Radiance", "Capitaneus", [C, "Spectro DMG", "ATK%"]],
    "Zhezhi": ["Rectifier", ["Rime-Draped Sprouts"], "5-pc Empyrean Anthem", "Nightmare: Lampylumen Myriad", [C, "Glacio DMG or Energy Regen", "ATK%"]],
    // 4-star
    "Aalto": ["Pistols", ["The Last Dance"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Aero DMG or Energy Regen", "ATK%"]],
    "Baizhi": ["Rectifier", ["Stellar Symphony"], "5-pc Rejuvenating Glow", "Bell-Borne Geochelone", ["Healing Bonus or HP%", "Energy Regen", "HP%"]],
    "Buling": ["Rectifier", ["Stellar Symphony"], "Rejuvenating Glow", "Fallacy of No Return", ["Healing Bonus or ATK%", "Energy Regen", "ATK%"]],
    "Chixia": ["Pistols", ["The Last Dance"], "5-pc Molten Rift", "Nightmare: Inferno Rider", [C, "Fusion DMG", "ATK%"]],
    "Danjin": ["Sword", ["Blazing Brilliance"], "5-pc Havoc Eclipse", "Nightmare: Crownless", [C, "Havoc DMG", "ATK%"]],
    "Lumi": ["Broadblade", ["Lustrous Razor"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Electro DMG or Energy Regen", "ATK%"]],
    "Mortefi": ["Pistols", ["Static Mist"], "5-pc Empyrean Anthem", "Hecate", ["CRIT Rate", "Fusion DMG or Energy Regen", "ATK%"]],
    "Sanhua": ["Sword", ["Emerald of Genesis", "Overture", "Commando of Conviction", "Lunar Cutter"], "5-pc Moonlit Clouds", "Impermanence Heron", [C, "Glacio DMG or Energy Regen", "ATK%"]],
    "Taoqi": ["Broadblade", ["Dauntless Evernight"], "5-pc Moonlit Clouds", "Bell-Borne Geochelone", [C, "Havoc DMG", "DEF%"]],
    "Yangyang": ["Sword", ["Emerald of Genesis"], "5-pc Moonlit Clouds", "Bell-Borne Geochelone", [C, "Aero DMG", "ATK%"]],
    "Youhu": ["Gauntlets", ["Abyss Surges"], "5-pc Rejuvenating Glow", "Bell-Borne Geochelone", ["Healing Bonus or ATK%", "Energy Regen or ATK%", "ATK%"]],
    "Yuanwu": ["Gauntlets", ["Abyss Surges"], "5-pc Empyrean Anthem", "Nightmare: Tempest Mephis", [C, "Electro DMG", "DEF%"]],
  };
  const m = new Map();
  for (const [n, [wt, w, set, echo, ms]] of Object.entries(raw)) m.set(n, { n, wt, w, set, echo, ms });
  return m;
})();

/* ---------------------------------------------------------------- weapon choice
   Score of a weapon for a resonator: weapons the guides name come first (best = 100),
   other weapons of the right type are rated by rarity and how well the substat fits the role. */
const RARITY_PTS = { 5: 58, 4: 38, 3: 18, 2: 8, 1: 4 };
function weaponScore(charName, wName, refine = 1) {
  const b = CHAR_BUILDS.get(charName), w = findWeapon(wName), c = RES_BY_NAME.get(charName);
  if (!b || !w || w.t !== b.wt) return -1;
  const i = b.w.indexOf(w.n);
  let s;
  if (i === 0) s = 100;
  else if (i > 0) s = 86 - i * 6;
  else {
    s = RARITY_PTS[w.r] || 0;
    const role = c ? c.role : "dps";
    const wants = role === "heal" ? { er: 12, hp: 8, atk: 4, crit: 2, def: /DEF%/.test(b.ms.join()) ? 10 : 0 }
      : role === "sub" ? { crit: 10, atk: 7, er: 7, hp: 0, def: 0 }
      : { crit: 12, atk: 8, er: 2, hp: 0, def: 0 };
    s += wants[w.s] || 0;
    if (SIGNATURE && Object.values(SIGNATURE).includes(w.n)) s -= 3; // someone else's signature: fine as a stat stick, not tailored
  }
  return s + (Math.max(1, Math.min(5, refine)) - 1);
}

/* Best assignment of owned weapons to the members of one team.
   owned: Map name -> {r, n}. Returns an array (one entry per member) of {w, r, score} or null. */
function assignWeapons(members, owned) {
  const cand = members.map((m) => {
    if (!m) return [];
    const list = [];
    for (const [n, o] of owned) {
      const sc = weaponScore(m, n, o.r);
      if (sc >= 0) list.push({ w: n, r: o.r, score: sc });
    }
    return list.sort((a, b) => b.score - a.score).slice(0, 8);
  });
  let best = null, bestSum = -1;
  const used = new Map();
  (function rec(i, cur, sum) {
    if (i === members.length) { if (sum > bestSum) { bestSum = sum; best = cur.slice(); } return; }
    let any = false;
    for (const c of cand[i]) {
      const u = used.get(c.w) || 0;
      if (u >= (owned.get(c.w).n || 1)) continue;
      any = true;
      used.set(c.w, u + 1); cur.push(c);
      rec(i + 1, cur, sum + c.score);
      cur.pop(); used.set(c.w, u);
    }
    if (!any || !cand[i].length) { cur.push(null); rec(i + 1, cur, sum); cur.pop(); }
    else { cur.push(null); rec(i + 1, cur, sum); cur.pop(); } // leaving one member empty can free a weapon for another
  })(0, [], 0);
  return best || members.map(() => null);
}


/* ---------- Weapon damage comparison ----------
   TESTED: published in-game hologram runs (same character, echoes and rotation, Lv 90, R1). Values are the difference to the
   reference weapon in percent: [Heavy Attack DMG, Resonance Liberation DMG]. Add more characters here when a source exists.
   ESTIMATE: for everything else, a rough model (below) from base ATK, substat and a typical ATK passive. */
const DMG_TESTS = {
  Qingxiao: {
    ref: "Glint of Clouds",
    metric: "Heavy Attack and Resonance Liberation DMG, Fallacy of No Return hologram (stage VI)",
    src: { label: "allthings.how", url: "https://allthings.how/wuthering-waves-is-qingxiao-s-signature-weapon-worth-it/" },
    rows: { "Blazing Brilliance": [1.0, 0.1], "Emerald Sentence": [-13.2, -14.0] },
  },
};
const DMG_MODEL = {
  charAtk: 450, atkBonus: 0.5, flat: 300, baseCr: 0.65, baseCd: 2.0,   // a typical built carry
  bisPremium: 0.17,   // the best weapon usually carries a passive worth about this much (calibrated on the Qingxiao test with the real weapon stats)
  // Lv 90 stats by rarity: base ATK, substat values (CRIT Rate / ATK%), passive worth in ATK% (a typical "+ATK%" passive)
  tier: { 5: { atk: 587, crit: 0.243, atkp: 0.364, pas: 0.12 }, 4: { atk: 412, crit: 0.2025, atkp: 0.3038, pas: 0.08 },
          3: { atk: 337, crit: 0.162, atkp: 0.243, pas: 0.04 } },
  erValue: 0.08,      // Energy Regen is counted as a little ATK%
};
function weaponDmgIndex(w) {
  const m = DMG_MODEL, t = m.tier[w.r] || m.tier[3];
  // real Lv 90 numbers when the weapon has them, otherwise the typical values of its rarity
  const real = w.a != null;
  const atk = real ? w.a : t.atk;
  const atkp = m.atkBonus + t.pas + (real ? (w.sk === "atk" ? w.sv / 100 : 0) + (w.sk === "er" ? m.erValue : 0)
    : (w.s === "atk" ? t.atkp : 0) + (w.s === "er" ? m.erValue : 0));
  const cr = Math.min(1, m.baseCr + (real ? (w.sk === "cr" ? w.sv / 100 : 0) : (w.s === "crit" ? t.crit : 0)));
  const cd = m.baseCd + (real && w.sk === "cd" ? w.sv / 100 : 0);
  return ((m.charAtk + atk) * (1 + atkp) + m.flat) * (1 + cr * (cd - 1));
}
/* Difference to the best weapon in percent. Returns { pct, tested, lib } or null when it cannot be told. */
function weaponDmgPct(charName, bestName, name) {
  if (name === bestName) return { pct: 0, tested: false, ref: true };
  const test = DMG_TESTS[charName];
  if (test && test.ref === bestName && test.rows[name]) return { pct: test.rows[name][0], lib: test.rows[name][1], tested: true };
  const w = findWeapon(name), bw = findWeapon(bestName);
  if (!w || !bw) return null;
  const ref = weaponDmgIndex(bw) * (bw.r === 5 ? 1 + DMG_MODEL.bisPremium : 1);
  return { pct: Math.round((weaponDmgIndex(w) / ref - 1) * 1000) / 10, tested: false };
}

/* ---------------------------------------------------------------- Echo check
   Rule of thumb, not an official formula: every substat roll is compared with the best possible roll of that stat
   (max roll values of the game) and weighted by how useful the stat is for this resonator (role, scaling stat). */
const ECHO_SUBS = [
  { k: "cr", n: "CRIT Rate", max: 10.5, u: "%" }, { k: "cd", n: "CRIT DMG", max: 21, u: "%" },
  { k: "atkp", n: "ATK%", max: 11.6, u: "%" }, { k: "atk", n: "ATK (flat)", max: 60, u: "" },
  { k: "hpp", n: "HP%", max: 11.6, u: "%" }, { k: "hp", n: "HP (flat)", max: 580, u: "" },
  { k: "defp", n: "DEF%", max: 14.7, u: "%" }, { k: "def", n: "DEF (flat)", max: 70, u: "" },
  { k: "er", n: "Energy Regen", max: 12.4, u: "%" },
  { k: "basic", n: "Basic Attack DMG", max: 11.6, u: "%" }, { k: "heavy", n: "Heavy Attack DMG", max: 11.6, u: "%" },
  { k: "skill", n: "Resonance Skill DMG", max: 11.6, u: "%" }, { k: "lib", n: "Resonance Liberation DMG", max: 11.6, u: "%" },
];
const ECHO_ROLLS = (() => {
  const dmg = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6];
  return {
    cr: [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5], cd: [12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21],
    atkp: dmg, hpp: dmg, basic: dmg, heavy: dmg, skill: dmg, lib: dmg,
    defp: [8.1, 9, 10, 10.9, 11.8, 12.8, 13.8, 14.7], er: [6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4],
    atk: [30, 40, 50, 60], hp: [320, 360, 390, 430, 470, 510, 540, 580], def: [40, 50, 60, 70],
  };
})();
const ECHO_MAINS = {
  4: ["CRIT Rate", "CRIT DMG", "Healing Bonus", "ATK%", "HP%", "DEF%"],
  3: ["Glacio DMG", "Fusion DMG", "Electro DMG", "Aero DMG", "Spectro DMG", "Havoc DMG", "Energy Regen", "ATK%", "HP%", "DEF%"],
  1: ["ATK%", "HP%", "DEF%"],
};
const ECHO_DMG_TYPES = [["any", "Not sure"], ["basic", "Basic Attack"], ["heavy", "Heavy Attack"], ["skill", "Resonance Skill"], ["lib", "Resonance Liberation"]];

function echoWeights(name, dmg) {
  const c = RES_BY_NAME.get(name), b = CHAR_BUILDS.get(name);
  const role = c ? c.role : "dps";
  const ms1 = b ? b.ms[1] : "", ms2 = b ? b.ms[2] : "ATK%";
  const sc = /^HP/i.test(ms2) ? "hp" : /^DEF/i.test(ms2) ? "def" : "atk";
  const w = { cr: 0, cd: 0, atkp: 0, atk: 0, hpp: 0, hp: 0, defp: 0, def: 0, er: 0, basic: 0, heavy: 0, skill: 0, lib: 0 };
  const crit = role === "dps" ? 1 : role === "sub" ? 0.8 : 0.15;
  w.cr = crit; w.cd = crit;
  const main = role === "heal" ? 0.85 : 0.65;
  if (sc === "atk") { w.atkp = main; w.atk = main * 0.3; }
  else if (sc === "hp") { w.hpp = main; w.hp = main * 0.3; }
  else { w.defp = main; w.def = main * 0.3; }
  w.er = role === "dps" ? 0.2 : role === "sub" ? 0.45 : 0.7;
  if (/energy regen/i.test(ms1) && role !== "heal") w.er = Math.max(w.er, 0.4);
  if (role !== "heal") {
    const top = role === "dps" ? 0.55 : 0.4;
    const keys = ["basic", "heavy", "skill", "lib"];
    if (dmg && dmg !== "any") keys.forEach((k) => { w[k] = k === dmg ? top : 0.05; });
    else keys.forEach((k) => { w[k] = top / 2.2; });
  }
  return w;
}

/* echo = { cost: 4|3|1, main: "CRIT Rate", dmg: "any"|"basic"|..., subs: [{ k, v }] } */
function echoRate(name, echo) {
  const b = CHAR_BUILDS.get(name), w = echoWeights(name, echo.dmg), c = RES_BY_NAME.get(name);
  const seen = new Set(), rows = []; let dup = false;
  for (const s of echo.subs) {
    const sub = ECHO_SUBS.find((x) => x.k === s.k), v = +s.v;
    if (!sub || !(v > 0)) continue;
    if (seen.has(s.k)) { dup = true; continue; }
    seen.add(s.k);
    rows.push({ k: s.k, label: sub.n, v, unit: sub.u, q: Math.min(1, v / sub.max), w: w[s.k] });
  }
  const ideal = Object.values(w).sort((a, z) => z - a).slice(0, rows.length).reduce((a, z) => a + z, 0);
  const got = rows.reduce((a, r) => a + r.w * r.q, 0);
  const score = ideal > 0 ? Math.round((100 * got) / ideal) : 0;
  const grades = [[70, "S", "Excellent. Level it up and keep it."], [55, "A", "Very good, worth leveling."], [40, "B", "Usable until something better drops."],
    [25, "C", "Weak, only as a filler."], [0, "D", "Barely useful for this resonator."]];
  const g = grades.find((x) => score >= x[0]);
  const recText = b ? b.ms[{ 4: 0, 3: 1, 1: 2 }[echo.cost]] : "";
  const rec = recText && recText !== "–" ? recText.split(/\s+or\s+|\s+and\s+|\s*&\s*/).map((x) => x.trim().toLowerCase()) : [];
  const mainOk = !echo.main || !rec.length ? null : rec.includes(echo.main.toLowerCase());
  const cr = rows.find((r) => r.k === "cr"), cd = rows.find((r) => r.k === "cd");
  const cv = c && c.role !== "heal" && (cr || cd) ? 2 * (cr ? cr.v : 0) + (cd ? cd.v : 0) : null;
  return { score, grade: g[1], text: g[2], rows, dup, mainOk, mainRec: recText, cv, n: rows.length };
}
