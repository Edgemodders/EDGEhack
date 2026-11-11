// Adding effects to a quickhack (docs/design.md, "Adding effects"): the pool of status effects, sorted by
// who they work on; another quickhack's effects, followed tier by tier; what a document's added effects
// are on each tier; and the warnings. No VS Code, so the MCP server (H4) can use it too.
import { AddedEffect, AddedField, BuiltEffect, DamageTypeName, QuickhackDoc, withAddedValue } from "./document";
import { Effect, Family, isShared, readStatus, Tier, tierKey } from "./read";
import { isLocKey, Records, words } from "./records";
import type { BridgeClient, TweakRecord, TweakValue } from "./types";

/** Who a status effect is for. Only `enemy` shows unless the modder asks for all. */
export type PoolKind = "enemy" | "v" | "boss" | "other";

export interface PoolEntry {
  path: string;
  /** The record's name in words: Contagion Poison Lvl 2. */
  name: string;
  /** The name the game shows on the status bar, when it has one: Poisoned. */
  uiName?: string;
  /** Burning, Stunned, Blind, ... */
  type?: string;
  tags: string[];
  kind: PoolKind;
  /** A quickhack or grenade of the game's already puts it on a target: the safest pick. */
  used: boolean;
}

const BOSS = /^(Chimera|AdamSmasher|Oda|Sasquatch|RibakovBoss|Royce|Minotaur|WagnerBodyguardBoss|KurtKrauserBoss|MaxTacBoss)\.|\.Boss|S[Mm]asher|Chimera/;
/** Quest and system states, enemy netrunners' hacks on V, inline parts and base records other effects copy. */
const SYSTEM = /^(GameplayRestriction|WorkspotStatus|MinigameAction|HousingStatusEffect|TEST|FunctionalTests|PreventionStatusEffect|Effectors|Character|Attacks|AIQuickHackStatusEffect)\.|_inline\d+$|\.Base[A-Z]/;
const V_OWN = /^(Items|NewPerks)\.|Player|Cooldown/;
const V_TAGS = ["CyberwareBuff", "PlayerCyberwareCooldown", "QuickHackCooldown", "Buff"];

/** Sorts a status effect from its name, type and tags. The game's own use on a target settles it first. */
export function kindOf(path: string, tags: string[], type: string | undefined, used = false): PoolKind {
  if (BOSS.test(path)) return "boss";
  if (used || tags.includes("GrenadeStatusEffect")) return "enemy";
  if (SYSTEM.test(path)) return "other";
  if (V_OWN.test(path) || /PlayerCooldown$/.test(type ?? "") || tags.some((t) => V_TAGS.includes(t))) return "v";
  return tags.includes("Debuff") ? "enemy" : "other";
}

const strings = (v: TweakValue | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const flatStr = (r: TweakRecord, name: string): string | undefined => {
  const v = r.flats?.[name];
  return typeof v === "string" && v && v !== "None" ? v : undefined;
};

/** Every record of a type, a page at a time. */
async function every(b: BridgeClient, type: string, flats: string[]): Promise<TweakRecord[]> {
  const out: TweakRecord[] = [];
  for (let offset = 0; ; ) {
    const page = await b.tweakRecords({ type, flats, offset, limit: 20000 });
    out.push(...page.items);
    offset += page.items.length;
    if (!page.items.length || offset >= page.total) return out;
  }
}

/** The pool from the records, pure: what the tests feed. `used` holds the status effects the game's quickhacks put on a target. */
export function poolOf(statuses: TweakRecord[], used: Set<string>, uiNames: Map<string, string>): PoolEntry[] {
  const order: PoolKind[] = ["enemy", "v", "boss", "other"];
  return statuses
    .filter((s) => s.path)
    .map((s) => {
      const path = s.path!;
      const tags = strings(s.flats?.gameplayTags);
      const type = flatStr(s, "statusEffectType");
      const isUsed = used.has(path) || tags.includes("GrenadeStatusEffect");
      return { path, name: words(path), uiName: uiNames.get(flatStr(s, "uiData") ?? ""), type: type ? words(type) : undefined, tags, kind: kindOf(path, tags, type, used.has(path)), used: isUsed };
    })
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || Number(b.used) - Number(a.used) || a.name.localeCompare(b.name));
}

/** The status effects the game's own quickhacks for people put on a target, leaving out Boss and Chimera actions and what every quickhack shares. */
export function usedByQuickhacks(actions: TweakRecord[], effects: TweakRecord[]): Set<string> {
  const byPath = new Map(effects.map((e) => [e.path ?? "", e]));
  const used = new Set<string>();
  for (const a of actions) {
    if (a.flats?.isQuickHack !== true || !/^QuickHack\./.test(a.path ?? "") || /^QuickHack\.(Boss|Chimera)/.test(a.path ?? "")) continue;
    for (const p of [...strings(a.flats?.completionEffects), ...strings(a.flats?.startEffects)]) {
      const e = byPath.get(p);
      const status = e && flatStr(e, "statusEffect");
      if (status && !isShared(p) && flatStr(e, "recipient") !== "ObjectActionReference.Instigator") used.add(status);
    }
  }
  return used;
}

/** Reads the pool through REDbridge: about 1,700 status effects, once TweakDB is loaded. */
export async function readEffectPool(b: BridgeClient): Promise<PoolEntry[]> {
  const [statuses, actions, effects, uis] = await Promise.all([
    every(b, "StatusEffect", ["gameplayTags", "statusEffectType", "uiData"]),
    every(b, "ObjectAction", ["isQuickHack", "completionEffects", "startEffects"]),
    every(b, "ObjectActionEffect", ["statusEffect", "recipient"]),
    every(b, "StatusEffectUIData", ["displayName"]),
  ]);
  const keyOf = (u: TweakRecord): string | undefined => {
    const v = u.flats?.displayName;
    return isLocKey(v) ? v.key : typeof v === "string" ? v : undefined;
  };
  const keys = [...new Set(uis.map(keyOf).filter((k): k is string => !!k && /^LocKey#[1-9]\d*$/.test(k)))];
  const texts = keys.length ? await b.locGet(keys).catch(() => ({}) as Record<string, { female: string; male: string } | null>) : {};
  const uiNames = new Map<string, string>();
  for (const u of uis) {
    const t = texts[keyOf(u) ?? ""];
    if (u.path && (t?.female || t?.male)) uiNames.set(u.path, t.female || t.male);
  }
  return poolOf(statuses, usedByQuickhacks(actions, effects), uiNames);
}

/** The effect's name with its tier taken out, the same on every tier: BaseStatusEffect.OverheatLevel2 -> BaseStatusEffect.Overheat. */
export function effectKey(e: Effect): string {
  return (e.status ?? e.record).replace(/(Lvl|Level|Tier)\d(PlusPlus)?/, "");
}

/** An effect's name without the tier a record's name carries: Memory Wipe Level 4 -> Memory Wipe. */
export function plainName(name: string): string {
  return name.replace(/ (Level|Lvl|Tier) ?\d+( ?Plus ?Plus)?$/, "").trim();
}

/**
 * The effects of a tier worth adding elsewhere: what it does to its target. Not the shared ones, the
 * spread's plumbing or what only reports a crime, nor V's own (cooldowns, helper states the hack needs for
 * itself), nor those made for a boss: both stay in the status effects, under Show all.
 */
export function worthAdding(t: Tier): Effect[] {
  return t.effects.filter((e) => e.on === "target" && !e.shared && !e.cooldown && !e.spread && (e.status || e.damage.length) && !(e.status && BOSS.test(e.status)));
}

export interface OfferedEffect {
  key: string;
  /** The tier it is shown from: the highest that has it. */
  effect: Effect;
}

/** A family's effects to pick from, best tier first, one per key. */
export function offeredEffects(fam: Family): OfferedEffect[] {
  const out = new Map<string, OfferedEffect>();
  for (const t of [...fam.tiers].reverse()) {
    for (const effect of worthAdding(t)) {
      const key = effectKey(effect);
      if (!out.has(key)) out.set(key, { key, effect });
    }
  }
  return [...out.values()];
}

/** The source's tier for a rank: the same one, or the nearest below it, or its lowest. */
export function tierForRank(source: Family, rank: number): Tier | undefined {
  const below = source.tiers.filter((t) => t.rank <= rank);
  return below.length ? below[below.length - 1] : source.tiers[0];
}

/**
 * The source's effect for a rank: from the nearest tier that has it, at or below the rank first. Tiers do
 * not all have every effect (Short Circuit's EMP starts at Epic), and an effect's place in a tier's list
 * says nothing about what it is: going by place gave a weakspot effect for the EMP.
 */
export function effectOnTier(source: Family, key: string, rank: number): Effect | undefined {
  const below = source.tiers.filter((t) => t.rank <= rank).reverse();
  const above = source.tiers.filter((t) => t.rank > rank);
  for (const t of [...below, ...above]) {
    const e = worthAdding(t).find((x) => effectKey(x) === key);
    if (e) return e;
  }
  return undefined;
}

/**
 * The stats a built stat change offers (H3.5), each as the game's own enemy statuses use it: the values
 * are theirs (Flash grenades for accuracy, the EMP for the time between shots, Comms Noise for detection).
 * A "can" stat is a switch: it is set to 0, so it has no number.
 */
export interface StatChoice {
  label: string;
  stats: string[];
  how: "Multiplier" | "Additive";
  /** The value a new card starts with, and the unit its row shows. */
  value?: number;
  unit?: string;
  hint?: string;
}

export const STAT_CHOICES: Record<string, StatChoice> = {
  accuracy: { label: "Accuracy", stats: ["BaseStats.Accuracy"], how: "Multiplier", value: 0.4, unit: "times", hint: "0.4 is what a Flash grenade does" },
  armor: { label: "Armor", stats: ["BaseStats.Armor"], how: "Additive", value: -30, unit: "added", hint: "Negative lowers it. The game's electric statuses use -10 to -50" },
  chemicalResistance: { label: "Chemical resistance", stats: ["BaseStats.ChemicalResistance"], how: "Additive", value: -30, unit: "added", hint: "Negative lowers it, -100 to 100" },
  thermalResistance: { label: "Thermal resistance", stats: ["BaseStats.ThermalResistance"], how: "Additive", value: -30, unit: "added", hint: "Negative lowers it, -100 to 100" },
  electricResistance: { label: "Electric resistance", stats: ["BaseStats.ElectricResistance"], how: "Additive", value: -30, unit: "added", hint: "Negative lowers it, -100 to 100" },
  evasion: { label: "Evasion", stats: ["BaseStats.Evasion"], how: "Multiplier", value: 0, unit: "times", hint: "0 takes it away; a Flash grenade does that" },
  detection: { label: "Detection", stats: ["BaseStats.Detection"], how: "Multiplier", value: 0.5, unit: "times", hint: "How fast the target spots V. 0.5 is half as fast, as Comms Noise does" },
  fireRate: { label: "Time between shots", stats: ["BaseStats.CycleTime", "BaseStats.CycleTime_Burst"], how: "Multiplier", value: 1.5, unit: "times", hint: "Above 1 shoots slower. 1.5 is what an EMP does" },
  canSprint: { label: "Cannot sprint", stats: ["BaseStats.CanSprint"], how: "Multiplier" },
  canJump: { label: "Cannot jump", stats: ["BaseStats.CanJump"], how: "Multiplier" },
  canUseCovers: { label: "Cannot take cover", stats: ["BaseStats.CanUseCovers"], how: "Multiplier" },
  canCallReinforcements: { label: "Cannot call reinforcements", stats: ["BaseStats.CanCallReinforcements"], how: "Multiplier" },
};

/** The icons a built effect shows (the game's own), when the game shows one: no icon showed over an enemy in H3.5's spike. */
export const DAMAGE_ICONS: Record<DamageTypeName, string> = { Electric: "electricuted", Thermal: "burning_icon", Chemical: "poisoned", Physical: "wounded_disabled_icon" };
export const STAT_ICON = "decreased_stats_icon";

/**
 * The game's own damage over time of each type, which a built damage card copies with its own damage
 * (H3.5's test, 2026-11-08). A copy of Overheat's attack dealt thermal damage whatever type it was given,
 * shown in the thermal colour; the game's electric one showed the electric colour at once.
 */
export const DAMAGE_ATTACKS: Record<DamageTypeName, string> = {
  Electric: "Attacks.ElectricDamageOverTime",
  Thermal: "Attacks.ThermalDamageOverTime",
  Chemical: "Attacks.ChemicalDamageOverTime",
  Physical: "Attacks.PhysicalDamageOverTime",
};

/** Damage types EDGEhack keeps off machines, as an added poison or bleed (H3.4b). */
export const DAMAGE_OFF_MACHINES = new Set<DamageTypeName>(["Chemical", "Physical"]);

/** A built effect's number on a tier when the modder has not set one. */
export function builtDefault(b: BuiltEffect, field: AddedField): number | undefined {
  switch (b.kind) {
    case "damage":
      return field === "damage" ? 10 : field === "every" ? 0.5 : field === "duration" ? 8 : undefined;
    case "stat":
      return field === "duration" ? 10 : field === "value" ? STAT_CHOICES[b.stat ?? ""]?.value : undefined;
    case "chance":
      return field === "chance" ? 25 : undefined;
  }
}

/** The fields a built effect's card shows, in order. */
export function builtFields(b: BuiltEffect): AddedField[] {
  if (b.kind === "damage") return ["damage", "every", "duration"];
  if (b.kind === "stat") return STAT_CHOICES[b.stat ?? ""]?.value === undefined ? ["duration"] : ["value", "duration"];
  return ["chance"];
}

/** A built effect's number on a tier: the modder's, or the default. */
export function builtValue(entry: AddedEffect, tier: string, field: AddedField): number | undefined {
  return entry.values?.[tier]?.[field] ?? (entry.build ? builtDefault(entry.build, field) : undefined);
}

/** A built effect's name in words. */
export function builtName(b: BuiltEffect, applied?: Effect): string {
  if (b.kind === "damage") return `${b.damageType} damage over time`;
  if (b.kind === "stat") return STAT_CHOICES[b.stat ?? ""]?.label ?? words(b.stat ?? "A stat");
  return `Chance to apply ${plainName(applied?.name ?? words(b.applies ?? ""))}`;
}

/** A built effect on one tier, as the rest of the editor reads effects: for the summary, the warnings and the notes. */
function builtOnTier(entry: AddedEffect, tier: string, applied?: Effect): Effect {
  const b = entry.build!;
  const v = (f: AddedField): number => builtValue(entry, tier, f) ?? 0;
  const base: Effect = { record: "", on: "target", when: "upload", name: builtName(b, applied), tags: [], damage: [], stats: [], shared: false, cooldown: false, spread: false };
  if (b.kind === "damage") {
    return { ...base, type: "Misc", duration: { base: v("duration"), scaledBy: [] }, damage: [{ type: b.damageType!, perHit: v("damage"), every: v("every"), scaledBy: [], record: "" }] };
  }
  if (b.kind === "stat") {
    const c = STAT_CHOICES[b.stat ?? ""];
    return { ...base, type: "Misc", duration: { base: v("duration"), scaledBy: [] }, stats: c ? [{ stat: c.label, value: c.value === undefined ? 0 : v("value"), how: c.how }] : [] };
  }
  // A chance: what it may apply, so the tier-by-tier warnings see it.
  return { ...(applied ?? base), record: "", on: "target", when: "upload", name: builtName(b, applied), shared: false, cooldown: false, spread: false };
}

/** One added effect of a document, read: what it is on each tier. */
export interface ResolvedAdded {
  entry: AddedEffect;
  name: string;
  /** The family it came from, in words. */
  sourceName?: string;
  /** By tierKey. A tier it is switched off on still has one, so the page can show its numbers. */
  byTier: Map<string, Effect>;
  /** Why it could not be read, in words: a game patch may rename what a document names. */
  problem?: string;
  /** A built chance: the status effect its roll applies, read. */
  applied?: Effect;
}

export interface ResolveContext {
  family(key: string): Promise<Family>;
  records: Records;
}

/** Reads a document's added effects. A pick that cannot be read says so rather than failing the document. */
export async function resolveAdded(doc: QuickhackDoc, fam: Family, ctx: ResolveContext): Promise<ResolvedAdded[]> {
  const out: ResolvedAdded[] = [];
  for (const entry of doc.effects ?? []) {
    const byTier = new Map<string, Effect>();
    if (entry.build) {
      const b = entry.build;
      const applied = b.kind === "chance" && b.applies ? await readStatus(ctx.records, b.applies, "target") : undefined;
      if (b.kind === "chance" && !applied) {
        out.push({ entry, name: builtName(b), byTier, problem: `${b.applies} is not in this game, so its chance was left out.` });
        continue;
      }
      if (b.kind === "stat" && !STAT_CHOICES[b.stat ?? ""]) {
        out.push({ entry, name: builtName(b), byTier, problem: `${b.stat} is not a stat EDGEhack offers, so it was left out.` });
        continue;
      }
      // Two built cards with one name get a number, so a card cannot be taken for another.
      let name = builtName(b, applied);
      const same = out.filter((r) => r.entry.build && (r.name === name || r.name.startsWith(`${name} `))).length;
      if (same) name = `${name} ${same + 1}`;
      for (const t of fam.tiers) byTier.set(tierKey(t), { ...builtOnTier(entry, tierKey(t), applied), name });
      out.push({ entry, name, byTier, applied });
      continue;
    }
    if (entry.from && entry.effect) {
      let source: Family | undefined;
      try {
        source = await ctx.family(entry.from);
      } catch {
        // said below
      }
      for (const t of fam.tiers) {
        const e = source && effectOnTier(source, entry.effect, t.rank);
        if (e) byTier.set(tierKey(t), e);
      }
      const first = [...byTier.values()].pop();
      out.push({ entry, name: plainName(first?.name ?? words(entry.effect)), sourceName: source?.name ?? entry.from, byTier, problem: byTier.size ? undefined : `${entry.from}'s ${words(entry.effect)} is not in this game, so it was left out.` });
      continue;
    }
    const status = entry.status && (await readStatus(ctx.records, entry.status, entry.on));
    if (!status) {
      out.push({ entry, name: words(entry.status ?? entry.id), byTier, problem: `${entry.status ?? entry.id} is not in this game, so it was left out.` });
      continue;
    }
    for (const t of fam.tiers) byTier.set(tierKey(t), status);
    out.push({ entry, name: plainName(status.name), byTier });
  }
  return out;
}

/** What the game has for a number of an added effect, or undefined when it has none to change. */
export function addedGameValue(e: Effect | undefined, field: AddedField): number | undefined {
  if (!e?.status || e.effector) return undefined;
  switch (field) {
    case "duration":
      return e.duration && isFinite(e.duration.base) && e.durationGroup ? e.duration.base : undefined;
    case "stacks":
      return e.stacksGroup ? e.stacks : undefined;
    case "damage":
      return e.damage[0]?.stat && e.damage[0].effector && e.damage[0].package ? e.damage[0].perHit : undefined;
  }
}

/** What a number of an added effect starts from: the game's value, or a built effect's default. */
export function addedBase(r: ResolvedAdded, tier: string, field: AddedField): number | undefined {
  return r.entry.build ? builtDefault(r.entry.build, field) : addedGameValue(r.byTier.get(tier), field);
}

/** A built effect's one line on its card. */
export function builtSummary(r: ResolvedAdded): string {
  const b = r.entry.build!;
  if (b.kind === "chance") {
    const a = r.applied;
    return a ? `A roll on each upload applies it to the target. ${effectSummary(a)}` : "A roll on each upload applies a status effect to the target.";
  }
  if (b.kind === "damage") return `On the target, ${b.damageType!.toLowerCase()} damage a hit, every so often, for a time.${b.damageType === "Electric" && b.sparks ? " Sparks as it starts." : ""}`;
  const c = STAT_CHOICES[b.stat ?? ""];
  return c?.value === undefined ? "On the target, for a time." : `On the target: its ${c.label.toLowerCase()} ${c.how === "Multiplier" ? "times the value" : "plus the value"}, for a time.`;
}

/** An added effect's one line on a card and in the picker, in the modder's words. */
export function effectSummary(e: Effect): string {
  const parts = [e.on === "V" ? "On V" : "On the target"];
  if (e.type) parts.push(e.type);
  if (e.duration) parts.push(isFinite(e.duration.base) ? `lasts ${Math.round(e.duration.base * 100) / 100} s` : "lasts until removed");
  for (const d of e.damage.filter((x) => x.perHit !== 0)) parts.push(d.every ? `${Math.ceil(d.perHit / d.every)} ${d.type.toLowerCase()} a second` : `${Math.round(d.perHit * 100) / 100} ${d.type.toLowerCase()}`);
  for (const s of e.stats.filter((x) => x.value !== 0).slice(0, 2)) parts.push(`${s.stat} ${s.value >= 0 ? "+" : ""}${Math.round(s.value * 100) / 100}`);
  return parts.join(" \u00b7 ");
}

/** Gives every other tier the selected tier's change in a number of an added effect: the same difference from its own value. */
export function applyAddedToAll(doc: QuickhackDoc, added: ResolvedAdded[], id: string, tier: string, field: AddedField): QuickhackDoc {
  const r = added.find((a) => a.entry.id === id);
  if (!r) return doc;
  const base = addedBase(r, tier, field);
  const want = r.entry.values?.[tier]?.[field];
  if (base === undefined || want === undefined) return doc;
  let next = doc;
  // A built effect has one default on every tier, so every tier takes the same value; a stat change may be negative.
  if (r.entry.build) {
    for (const key of r.byTier.keys()) next = withAddedValue(next, id, key, field, want, base);
    return next;
  }
  for (const [key, e] of r.byTier) {
    const game = addedGameValue(e, field);
    if (game !== undefined) next = withAddedValue(next, id, key, field, Math.round(Math.max(0, game + want - base) * 10000) / 10000, game);
  }
  return next;
}

/**
 * The effect types EDGEhack keeps off machines (H3.4b, the owner's decision of 2026-11-07). The game keeps
 * machines safe only per quickhack: Contagion cannot be uploaded to one, but its poison reached a drone
 * through Overheat in H3.4's test.
 */
const OFF_MACHINES = new Set(["Poisoned", "Bleeding"]);

/** True when a built effect's damage is kept off machines: a chemical or physical damage over time, or a chance whose poison or bleed EDGEhack copies. */
export function builtOffMachines(r: ResolvedAdded): boolean {
  const b = r.entry.build;
  if (!b || r.problem) return false;
  if (b.kind === "damage") return DAMAGE_OFF_MACHINES.has(b.damageType!);
  return b.kind === "chance" && keptOffMachines(r.applied);
}

/** A poison or bleed on the target: what EDGEhack means to keep off machines. */
export function hitsMachines(e: Effect | undefined): boolean {
  return !!e && e.on === "target" && !!e.type && OFF_MACHINES.has(e.type);
}

/**
 * True when EDGEhack writes this added effect with a check that keeps its damage off machines: a poison or
 * bleed applied by its status effect, whose damage runs from an effector in one of its packages. The check
 * goes on a copy of that effector (H3.4b's spike: the effect's `immunityStats` is not checked when a
 * quickhack applies it, but the effector's `prereqRecord` is).
 */
export function keptOffMachines(e: Effect | undefined): boolean {
  const d = e?.damage[0];
  return hitsMachines(e) && !!e!.status && !e!.effector && !!d?.effector && !!d.package;
}

/** The effects a tier ends up with: its own worth adding, and the added ones it is not left off. */
function tierEffects(t: Tier, added: ResolvedAdded[]): { name: string; e: Effect; added: boolean }[] {
  const key = tierKey(t);
  return [
    ...worthAdding(t).map((e) => ({ name: e.name, e, added: false })),
    ...added.filter((r) => !r.entry.off?.includes(key)).flatMap((r) => (r.byTier.get(key) ? [{ name: r.name, e: r.byTier.get(key)!, added: true }] : [])),
  ];
}

/**
 * What the game does with a combination, as it should, and what EDGEhack changes on purpose: worth knowing,
 * not a fault. Shown apart from the warnings (the owner's distinction, 2026-11-07).
 */
export function addedNotes(fam: Family, added: ResolvedAdded[]): string[] {
  const out: string[] = [];
  // No note for AIData's NPC types: they choose only who acts an effect out, and the effect itself ran on a drone in H3.4's test.
  // That machines do not act out a poison is self-evident to players (the owner, 2026-11-07).
  const builtDamage = added.some((r) => !r.problem && r.entry.build?.kind === "damage" && builtOffMachines(r));
  if (builtDamage || added.some((r) => !r.problem && (r.entry.build ? builtOffMachines(r) : [...r.byTier.values()].some(keptOffMachines)))) {
    const which = builtDamage ? "Poison, bleed, and chemical and physical damage over time" : "Poison and bleed";
    out.push(`${which}: EDGEhack keeps their damage off machines (androids, drones and mechs), which the game would let them hit through this quickhack.`);
  }
  // Contagion Epic and better in V's cyberdeck (EquipmentGLP.ContagionLvl3Passive): a hit on a burning target removes every
  // Contagion poison (by its tag), and the game's own Epic and better poisons explode (by their record names). Seen in H3.4's test.
  // An added poison kept off machines is EDGEhack's copy, under its own name, so it ends without the explosion.
  let game = false;
  let copies = false;
  for (const t of fam.tiers) {
    const onTarget = tierEffects(t, added).filter(({ e }) => e.on === "target");
    if (!onTarget.some(({ e }) => e.type === "Burning")) continue;
    for (const x of onTarget.filter(({ e }) => e.tags.includes("ContagionPoison"))) {
      if (x.added && keptOffMachines(x.e)) copies = true;
      else game = true;
    }
  }
  const start = "A burn and Contagion's poison together: when V has Contagion Epic or better in the cyberdeck, the burn ends the poison at its first hit, as that Contagion's own text says";
  if (game) out.push(`${start}, and the game's own Epic and better poisons explode as they go. Without that Contagion, both run for their whole time.`);
  else if (copies) out.push(`${start}. This quickhack's poison is EDGEhack's copy, so it ends without the explosion the game's own Epic and better poisons set off. Without that Contagion, both run for their whole time.`);
  return out;
}

/** The rules of "Adding effects", each a warning, not a block. */

export function addedWarnings(fam: Family, doc: QuickhackDoc, added: ResolvedAdded[]): string[] {
  const out: string[] = [];
  for (const r of added) {
    if (r.problem) {
      out.push(r.problem);
      continue;
    }
    const top = [...r.byTier.values()].pop();
    if (!top) continue;
    if (r.entry.build) {
      // A chance warns as its status effect would; the rest are EDGEhack's own, with nothing to warn about.
      const a = r.applied;
      if (r.entry.build.kind === "chance" && a) {
        const kind = kindOf(r.entry.build.applies!, a.tags, a.type);
        if (kind === "boss") out.push(`${r.name}: it belongs to a boss fight, so it may do nothing on other enemies.`);
        if (kind === "v") out.push(`${r.name}: it looks like one of V's own, so it may do nothing on an enemy.`);
        if (!a.duration || !isFinite(a.duration.base)) out.push(`${r.name}: it has no duration of its own, so it may stay until something removes it (unverified).`);
        if (hitsMachines(a) && a.damage.length && !keptOffMachines(a)) out.push(`${r.name}: EDGEhack could not keep its damage off machines, so it still hits them as the game allows.`);
      }
      continue;
    }
    const onTarget = top.on === "target";
    // Another quickhack's effect already works on a target; the game shows that.
    if (top.status && onTarget && !r.entry.from) {
      const kind = kindOf(top.status, top.tags, top.type);
      if (kind === "boss") out.push(`${r.name} belongs to a boss fight, so it may do nothing on other enemies.`);
      if (kind === "v") out.push(`${r.name} looks like one of V's own, so it may do nothing on an enemy.`);
    }
    // One with no damage has nothing to keep off (two in the game: a distraction and an NPC's melee bleed).
    if (hitsMachines(top) && top.damage.length && !keptOffMachines(top)) out.push(`${r.name}: EDGEhack could not keep its damage off machines, so it still hits them as the game allows.`);
    if (top.status && (!top.duration || !isFinite(top.duration.base))) out.push(`${r.name} has no duration of its own, so it may stay until something removes it (unverified).`);
  }
  // Tier by tier: what the tier ends up with, its own effects and the added ones.
  const repeated = new Set<string>();
  const types = new Set<string>();
  for (const t of fam.tiers) {
    const here = tierEffects(t, added);
    const seenStatus = new Map<string, string>();
    const seenType = new Map<string, Set<string>>();
    for (const { name, e } of here) {
      if (e.status) {
        if (seenStatus.has(e.status)) repeated.add(name);
        seenStatus.set(e.status, name);
      }
      // Misc says nothing about what an effect does, and two burns ran side by side in H3.1's test.
      if (e.on === "target" && e.status && e.type && e.type !== "Misc" && e.type !== "Burning") {
        const set = seenType.get(e.type) ?? new Set<string>();
        set.add(e.status);
        seenType.set(e.type, set);
      }
    }
    for (const [type, set] of seenType) if (set.size > 1) types.add(type);
  }
  for (const name of repeated) out.push(`${name} is on a tier twice. One upload may count as two stacks, or as one (unverified).`);
  for (const type of types) out.push(`Two ${type} effects on one tier: they may replace each other. Two burns ran side by side in the game; ${type} is unverified.`);
  for (const r of added) {
    if (r.entry.build) continue;
    for (const [tier, values] of Object.entries(r.entry.values ?? {})) {
      const e = r.byTier.get(tier);
      for (const field of ["duration", "stacks", "damage"] as const) {
        if (values[field] !== undefined && addedGameValue(e, field) === undefined) out.push(`${r.name}: its ${field} cannot be changed on ${tier}, so it stays as the game has it.`);
      }
    }
  }
  return [...new Set(out)];
}
