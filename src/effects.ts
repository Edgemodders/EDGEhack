// Adding effects to a quickhack (docs/design.md, "Adding effects"): the pool of status effects, sorted by
// who they work on; another quickhack's effects, followed tier by tier; what a document's added effects
// are on each tier; and the warnings. No VS Code, so the MCP server (H4) can use it too.
import { AddedEffect, AddedField, QuickhackDoc, withAddedValue } from "./document";
import { Effect, Family, isShared, readStatus, Tier, tierKey } from "./read";
import { isLocKey, Records, words } from "./records";
import type { BridgeClient, TweakRecord, TweakValue } from "./redcode";

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
  const base = addedGameValue(r?.byTier.get(tier), field);
  const want = r?.entry.values?.[tier]?.[field];
  if (!r || base === undefined || want === undefined) return doc;
  let next = doc;
  for (const [key, e] of r.byTier) {
    const game = addedGameValue(e, field);
    if (game !== undefined) next = withAddedValue(next, id, key, field, Math.round(Math.max(0, game + want - base) * 10000) / 10000, game);
  }
  return next;
}

/** The rules of "Adding effects", each a warning, not a block. */
/** The effects a tier ends up with: its own worth adding, and the added ones it is not left off. */
function tierEffects(t: Tier, added: ResolvedAdded[]): { name: string; e: Effect }[] {
  const key = tierKey(t);
  return [...worthAdding(t).map((e) => ({ name: e.name, e })), ...added.filter((r) => !r.entry.off?.includes(key)).flatMap((r) => (r.byTier.get(key) ? [{ name: r.name, e: r.byTier.get(key)! }] : []))];
}

/**
 * What the game does with a combination, as it should: worth knowing, not a fault. Shown apart from the warnings.
 */
export function addedNotes(fam: Family, added: ResolvedAdded[]): string[] {
  const out: string[] = [];
  // AIData's NPC types choose who plays the reaction. The effect itself ran on a drone in H3.4's test (Contagion's poison, Human only).
  for (const r of added) {
    const top = r.problem ? undefined : [...r.byTier.values()].pop();
    if (top?.on === "target" && top.npcTypes?.length) out.push(`${r.name}: only ${top.npcTypes.join(" and ")} NPCs play its reaction. On others, such as drones, the effect still runs, without the reaction.`);
  }
  // Contagion Epic and better in V's cyberdeck (EquipmentGLP.ContagionLvl3Passive): a hit on a burning target removes every
  // Contagion poison (by its tag), and the game's own Epic and better poisons explode (by their record names). Seen in H3.4's test.
  const combo = fam.tiers.some((t) => {
    const onTarget = tierEffects(t, added).filter(({ e }) => e.on === "target");
    return onTarget.some(({ e }) => e.type === "Burning") && onTarget.some(({ e }) => e.tags.includes("ContagionPoison"));
  });
  if (combo) out.push("A burn and Contagion's poison together: when V has Contagion Epic or better in the cyberdeck, the burn ends the poison at its first hit, as that Contagion's own text says, and the game's own Epic and better poisons explode as they go. Without it, both run for their whole time.");
  return out;
}

export function addedWarnings(fam: Family, doc: QuickhackDoc, added: ResolvedAdded[]): string[] {
  const out: string[] = [];
  for (const r of added) {
    if (r.problem) {
      out.push(r.problem);
      continue;
    }
    const top = [...r.byTier.values()].pop();
    if (!top) continue;
    const onTarget = top.on === "target";
    // Another quickhack's effect already works on a target; the game shows that.
    if (top.status && onTarget && !r.entry.from) {
      const kind = kindOf(top.status, top.tags, top.type);
      if (kind === "boss") out.push(`${r.name} belongs to a boss fight, so it may do nothing on other enemies.`);
      if (kind === "v") out.push(`${r.name} looks like one of V's own, so it may do nothing on an enemy.`);
    }
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
    for (const [tier, values] of Object.entries(r.entry.values ?? {})) {
      const e = r.byTier.get(tier);
      for (const field of ["duration", "stacks", "damage"] as const) {
        if (values[field] !== undefined && addedGameValue(e, field) === undefined) out.push(`${r.name}: its ${field} cannot be changed on ${tier}, so it stays as the game has it.`);
      }
    }
  }
  return [...new Set(out)];
}
