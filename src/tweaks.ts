// The writer: a quickhack document and the game's records in, TweakXL YAML and text entries out. Numbers
// are written as differences (docs/design.md, "H2: plan"; proved in the game by the H2a spike): each one
// gets one more modifier, and the game's own records stay as they are. A new quickhack is the other way
// round: every record it changes is its own copy (docs/design.md, "H3: plan"). Pure, no VS Code.
import type { QuickhackDoc, TierEdit } from "./document";
import { mainEffect, Tier, Family, Variant, Effect, tierKey } from "./read";
import { NEW_HACK_SCRIPT } from "./newHackScript";
import type { Sales } from "./getit";
import { addedGameValue, addedWarnings, builtValue, DAMAGE_ATTACKS, DAMAGE_ICONS, DAMAGE_OFF_MACHINES, keptOffMachines, ResolvedAdded, STAT_CHOICES, STAT_ICON } from "./effects";

export interface TextEntry {
  key: string;
  text: string;
}

export interface WrittenTweaks {
  /** The YAML file's text, or undefined when the document changes nothing. */
  yaml?: string;
  /** Texts for the mod's onscreens file. */
  texts: TextEntry[];
  /** What could not be written as asked, in words. */
  warnings: string[];
  /** The script a new quickhack needs, for the project. */
  script?: string;
}

const round = (n: number): number => Math.round(n * 10000) / 10000;
const tierName = (t: Tier): string => (t.item ?? t.action).replace(/^.*\./, "").replace(/\W/g, "_");

class Out {
  readonly records: string[] = [];
  readonly changes: string[] = [];
  readonly warnings: string[] = [];
  /** One difference per record that takes it: tiers and Boss actions can share a status effect or attack. */
  private readonly once = new Map<string, number>();

  constructor(readonly prefix: string) {}

  /** A constant modifier record, and its path. */
  modifier(name: string, stat: string, value: number): string {
    const path = `${this.prefix}.${name}`;
    this.records.push(`${path}:\n  $type: ConstantStatModifier\n  value: ${round(value)}\n  modifierType: Additive\n  statType: ${stat}\n`);
    return path;
  }

  append(flat: string, value: string): void {
    this.changes.push(`${flat}:\n  - !append ${value}\n`);
  }

  /** Several values on one list: one key, since a second key of the same name would replace the first. */
  appendAll(flat: string, values: string[]): void {
    if (values.length) this.changes.push(`${flat}:\n${values.map((v) => `  - !append ${v}\n`).join("")}`);
  }

  set(flat: string, value: string): void {
    this.changes.push(`${flat}: ${value}\n`);
  }

  private notMachinePath?: string;

  /**
   * The check that keeps an effector off machines, written once: the target's `IsMechanical` stat is 0, as
   * Overheat's own `OverheatLevel2_inline9`. Our own record, since an inline record's name can change in a
   * game update. H3.4b's spike: it stopped a poison and a bleed on a drone, not on a human.
   */
  notMachine(): string {
    if (!this.notMachinePath) {
      this.notMachinePath = `${this.prefix}.NotMachine`;
      this.records.push(`${this.notMachinePath}:\n  $type: StatPrereq\n  prereqClassName: StatPrereq\n  statType: IsMechanical\n  comparisonType: LessOrEqual\n  objectToCheck: Owner\n  valueToCheck: 0\n`);
    }
    return this.notMachinePath;
  }

  private oneStackPath?: string;

  /** A stacks group of 1, written once: a built status effect's. Our own, rather than the game's inline `RTDB.StatusEffect_inline0`. */
  oneStack(): string {
    if (!this.oneStackPath) {
      this.oneStackPath = `${this.prefix}.OneStack`;
      this.records.push(`${this.oneStackPath}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n    - ${this.modifier("OneStackMod", "BaseStats.MaxStacks", 1)}\n`);
    }
    return this.oneStackPath;
  }

  /** A duration group of one constant modifier. */
  durationGroup(name: string, seconds: number): string {
    const group = `${this.prefix}.${name}`;
    this.records.push(`${group}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n    - ${this.modifier(`${name}Mod`, "BaseStats.MaxDuration", seconds)}\n`);
    return group;
  }

  /** True the first time a record takes this difference; a different one on it is a warning. */
  first(record: string, diff: number, what: string): boolean {
    const had = this.once.get(record);
    if (had === undefined) {
      this.once.set(record, diff);
      return true;
    }
    if (round(had) !== round(diff)) this.warnings.push(`${what}: ${record} is shared, and the first change to it was kept. Set the tiers that share it to the same value.`);
    return false;
  }
}

/** RAM: one more cost holding the difference. */
function ram(out: Out, action: string, diff: number, name: string): void {
  if (round(diff) === 0) return;
  const mod = out.modifier(`${name}_RamMod`, "BaseStats.Memory", diff);
  const cost = `${out.prefix}.${name}_Ram`;
  out.records.push(`${cost}:\n  $type: StatPoolCost\n  statPool: BaseStatPools.Memory\n  costMods:\n    - ${mod}\n`);
  out.append(`${action}.costs`, cost);
}

function upload(out: Out, action: string, diff: number, name: string): void {
  if (round(diff) === 0) return;
  out.append(`${action}.activationTime`, out.modifier(`${name}_Upload`, "BaseStats.QuickHackUpload", diff));
}

/** Damage: one more modifier on the attack. */
function damage(out: Out, main: Effect | undefined, diff: number, name: string): void {
  if (round(diff) === 0) return;
  const d = main?.damage[0];
  if (!d?.stat) {
    out.warnings.push(`${name}: it has no damage to change.`);
    return;
  }
  if (!out.first(`damage:${d.record}`, diff, name)) return;
  out.append(`${d.record}.statModifiers`, out.modifier(`${name}_Damage`, d.stat, diff));
}

/** Duration: the status effect pointed at a new group, the old modifiers and the difference. */
function duration(out: Out, main: Effect | undefined, diff: number, name: string): void {
  if (round(diff) === 0) return;
  if (!main?.status || !main.durationGroup) {
    out.warnings.push(`${name}: its main effect has no duration to change.`);
    return;
  }
  if (!out.first(`duration:${main.status}`, diff, name)) return;
  const mod = out.modifier(`${name}_DurationMod`, "BaseStats.MaxDuration", diff);
  const group = `${out.prefix}.${name}_Duration`;
  const mods = [...(main.durationMods ?? []), mod].map((m) => `    - ${m}\n`).join("");
  out.records.push(`${group}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n${mods}`);
  out.set(`${main.status}.duration`, group);
}

/** A Boss or Chimera action: its own value when the modder set one, else the same difference. */
function variant(out: Out, v: Variant | undefined, name: string, edit: TierEdit, diffs: { ram: number; upload: number; damage: number; duration: number }): void {
  if (!v) return;
  const ramDiff = edit.bossRam !== undefined && v.ram ? edit.bossRam - v.ram.base : diffs.ram;
  const uploadDiff = edit.bossUpload !== undefined && v.upload ? edit.bossUpload - v.upload.base : diffs.upload;
  ram(out, v.record, ramDiff, name);
  upload(out, v.record, uploadDiff, name);
  // A Boss action may have no effect of its own to change: not a problem to report.
  if (v.main?.damage[0]) damage(out, v.main, diffs.damage, name);
  if (v.main?.durationGroup) duration(out, v.main, diffs.duration, name);
}

/**
 * The YAML and texts for a document. `added` is its added effects, read (resolveAdded); `sales` is how the
 * game hands out the family's tiers (getit.ts), for a new quickhack's Get it. Without it, Get it is left out.
 */
export function writeTweaks(fam: Family, doc: QuickhackDoc, added: ResolvedAdded[] = [], sales?: Sales): WrittenTweaks {
  if (doc.newHack) return writeNewHack(fam, doc, added, sales);
  const out = new Out(`EDGEhack.${doc.id}`);
  const texts: TextEntry[] = [];
  const textKey = (field: string, text: string): string => {
    const key = `EDGEhack-${doc.id}-${field}`;
    texts.push({ key, text });
    return `LocKey#${key}`;
  };

  for (const t of fam.tiers) {
    const edit = doc.tiers[t.item ?? t.action] ?? {};
    const main = mainEffect(t.effects);
    const name = tierName(t);
    const diffs = {
      ram: edit.ram !== undefined && t.ram ? edit.ram - t.ram.base : 0,
      upload: edit.upload !== undefined && t.upload ? edit.upload - t.upload.base : 0,
      damage: edit.damage !== undefined && main?.damage[0] ? edit.damage - main.damage[0].perHit : 0,
      duration: edit.duration !== undefined && main?.duration ? edit.duration - main.duration.base : 0,
    };
    ram(out, t.action, diffs.ram, name);
    upload(out, t.action, diffs.upload, name);
    damage(out, main, diffs.damage, name);
    duration(out, main, diffs.duration, name);
    variant(out, t.boss, `${name}_Boss`, edit, diffs);
    variant(out, t.chimera, `${name}_Chimera`, edit, diffs);
    // A change to a game quickhack reaches its Boss and Chimera actions too.
    const more = addedOnTier(out, doc, added, t, name);
    for (const action of [t.action, t.boss?.record, t.chimera?.record]) {
      if (!action) continue;
      out.appendAll(`${action}.startEffects`, more.start);
      out.appendAll(`${action}.completionEffects`, more.completion);
    }
  }
  out.warnings.push(...addedWarnings(fam, doc, added));

  // The cooldown: the tiers share a status effect, so one difference for each one the family has.
  if (doc.cooldown !== undefined) {
    const seen = new Set<string>();
    for (const t of fam.tiers) {
      const c = t.cooldown;
      if (!c || seen.has(c.record)) continue;
      seen.add(c.record);
      const diff = doc.cooldown - c.base;
      if (round(diff) === 0 || !c.group) continue;
      out.append(`${c.group}.statModifiers`, out.modifier(`${c.record.replace(/^.*\./, "").replace(/\W/g, "_")}_Cooldown`, "BaseStats.MaxDuration", diff));
    }
    if (!seen.size) out.warnings.push(`${fam.name} has no cooldown to change.`);
  }

  // Texts and icons, for the family: on every tier's item, and on each wheel entry its tiers use.
  const items = fam.tiers.map((t) => t.item).filter((i): i is string => !!i);
  const uis = [...new Set(fam.tiers.map((t) => t.ui).filter((u): u is string => !!u))];
  const parts = [...new Set(fam.tiers.map((t) => t.captionIcon).filter((p): p is string => !!p))];
  if (doc.name) {
    const key = textKey("Name", doc.name);
    for (const i of items) out.set(`${i}.displayName`, key);
    for (const u of uis) out.set(`${u}.caption`, key);
  }
  if (doc.description) {
    const key = textKey("Description", doc.description);
    for (const i of items) out.set(`${i}.localizedDescription`, key);
  }
  if (doc.wheelText) {
    const key = textKey("Wheel", doc.wheelText);
    for (const u of uis) out.set(`${u}.description`, key);
  }
  if (doc.itemIcon) {
    for (const i of items) out.set(`${i}.iconPath`, doc.itemIcon.replace(/^UIIcon\./, ""));
  }
  if (doc.wheelIcon) {
    for (const p of parts) out.set(`${p}.texturePartID`, doc.wheelIcon);
  }

  if (!out.records.length && !out.changes.length) return { texts, warnings: out.warnings };
  const yaml = [`# Made by EDGEhack from ${doc.id}.quickhack.json. Change that document, not this file: saving it writes this again.\n`, ...out.records, ...out.changes].join("\n");
  return { yaml, texts, warnings: out.warnings };
}

/** The action name and shard type of a new quickhack. The script finds its hacks by the prefix. */
export const newHackName = (doc: QuickhackDoc): string => `EDGEhack_${doc.id}`;
/** A new quickhack's item for a game tier: what Get it and a Console line name. */
export const newItemPath = (doc: QuickhackDoc, t: Tier): string => `Items.EDGEhack_${doc.id}_${tierName(t)}`;
const newActionPath = (doc: QuickhackDoc, t: Tier): string => `QuickHack.EDGEhack_${doc.id}_${tierName(t)}`;

type Field = string | string[] | undefined;

/** A record copied from a game's with $base. Everything goes in its body, so nothing relies on the order TweakXL applies flats in. */
function copy(path: string, base: string, fields: Record<string, Field>): string {
  let text = `${path}:\n  $base: ${base}\n`;
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    text += typeof value === "string" ? `  ${name}: ${value}\n` : `  ${name}:\n${value.map((v) => `    - ${v}\n`).join("")}`;
  }
  return text;
}

/** Differences in a status effect's numbers: what a copy of it adds. */
interface StatusDiffs {
  damage: number;
  duration: number;
  stacks: number;
}

/**
 * A copy of a status effect with its numbers changed, or undefined when it could not be made. Damage sits
 * at the end of a chain, each link naming the next, so each is copied. `label` names the records. With
 * `offMachines`, its damage effector gets the check that keeps it off machines (H3.4b), numbers changed or not.
 */
function copyStatus(out: Out, doc: QuickhackDoc, label: string, e: Effect, diffs: StatusDiffs, offMachines = false): string | undefined {
  const fields: Record<string, Field> = {};
  if (round(diffs.duration) !== 0 && e.durationGroup) {
    const group = `${out.prefix}.${label}_Duration`;
    out.records.push(`${group}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n${[...(e.durationMods ?? []), out.modifier(`${label}_DurationMod`, "BaseStats.MaxDuration", diffs.duration)].map((m) => `    - ${m}\n`).join("")}`);
    fields.duration = group;
  }
  if (round(diffs.stacks) !== 0 && e.stacksGroup) {
    const group = `${out.prefix}.${label}_Stacks`;
    out.records.push(`${group}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n${[...(e.stacksMods ?? []), out.modifier(`${label}_StacksMod`, "BaseStats.MaxStacks", diffs.stacks)].map((m) => `    - ${m}\n`).join("")}`);
    fields.maxStacks = group;
  }
  const damageChanged = round(diffs.damage) !== 0;
  if (damageChanged || offMachines) {
    const damage = e.damage[0];
    if (damage?.effector && damage.package && (damage.stat || !damageChanged)) {
      let attack: string | undefined;
      if (damageChanged) {
        attack = `Attacks.EDGEhack_${doc.id}_${label}`;
        out.records.push(copy(attack, damage.record, { statModifiers: [...(damage.attackMods ?? []), out.modifier(`${label}_Damage`, damage.stat!, diffs.damage)] }));
      }
      const effector = `${out.prefix}.${label}_Effector`;
      const pkg = `${out.prefix}.${label}_Package`;
      out.records.push(copy(effector, damage.effector, { attackRecord: attack, prereqRecord: offMachines ? out.notMachine() : undefined }));
      out.records.push(copy(pkg, damage.package, { effectors: (damage.packageEffectors ?? []).map((x) => (x === damage.effector ? effector : x)) }));
      fields.packages = (e.packages ?? []).map((p) => (p === damage.package ? pkg : p));
    } else if (damageChanged) {
      out.warnings.push(`${label}: its damage is not in a status effect's package, so it was left as it is.`);
    }
  }
  if (!Object.keys(fields).length || !e.status) return undefined;
  const status = `BaseStatusEffect.EDGEhack_${doc.id}_${label}`;
  out.records.push(copy(status, e.status, fields));
  return status;
}

/** Text for YAML, quoted. */
const quoted = (text: string): string => JSON.stringify(text);

/**
 * A built effect on one tier (H3.5), as its own records, and the effect record for the action's list. Each
 * is a status effect EDGEhack writes from nothing, of the neutral type Misc, as H3.5's spike proved:
 *
 * - damage: a ContinuousAttackEffector running a copy of the game's own damage over time of that type
 *   (DAMAGE_ATTACKS) with the card's damage in place of the game's. Chemical and physical stay off
 *   machines (H3.4b's check).
 * - stat: the stats in the status effect's package.
 * - chance: a carrier status effect of 1 s whose package applies the status effect behind the game's
 *   `SetChancePrereq`, which rolls once when it is applied. The game's ApplyStatusEffectByChanceEffector
 *   rolls only when its prereq fires again, so with an always-true one it never does (spike, Console check
 *   at 0, 50 and 100%). A poison or bleed it applies is EDGEhack's copy, kept off machines.
 */
function builtOnTier(out: Out, doc: QuickhackDoc, r: ResolvedAdded, t: Tier, label: string): string | undefined {
  const b = r.entry.build!;
  const key = tierKey(t);
  const L = `${r.entry.id}_${label}`;
  const v = (f: "damage" | "every" | "duration" | "value" | "chance"): number => builtValue(r.entry, key, f) ?? 0;
  const status = `BaseStatusEffect.EDGEhack_${doc.id}_${L}`;
  const effect = `QuickHack.EDGEhack_${doc.id}_${L}_Effect`;
  const ui = (name: string, icon: string): string => {
    const path = `${out.prefix}.${L}_UI`;
    out.records.push(`${path}:\n  $type: StatusEffectUIData\n  displayName: ${quoted(name)}\n  description: ""\n  fluffText: ""\n  iconPath: ${icon}\n  priority: -3\n`);
    return path;
  };
  const statusRecord = (fields: { tags: string[]; duration: string; pkg: string; ui?: string; vfx?: string; removeAll?: boolean }): void => {
    out.records.push(
      `${status}:\n  $type: StatusEffect\n  statusEffectType: BaseStatusEffectTypes.Misc\n  gameplayTags: [ ${fields.tags.join(", ")} ]\n  duration: ${fields.duration}\n  maxStacks: ${out.oneStack()}\n  packages:\n    - ${fields.pkg}\n${fields.ui ? `  uiData: ${fields.ui}\n` : ""}${fields.vfx ? `  VFX:\n    - ${fields.vfx}\n` : ""}  isAffectedByTimeDilationNPC: true\n  isAffectedByTimeDilationPlayer: true\n${fields.removeAll ? "  removeAllStacksWhenDurationEnds: true\n" : ""}  savable: true\n  stopActiveSfxOnDeactivate: true\n`,
    );
  };
  const pkgPath = `${out.prefix}.${L}_Package`;

  if (b.kind === "damage") {
    const type = b.damageType!;
    const attack = `Attacks.EDGEhack_${doc.id}_${L}`;
    out.records.push(copy(attack, DAMAGE_ATTACKS[type], { statModifiers: [out.modifier(`${L}_Damage`, `BaseStats.${type}Damage`, v("damage"))] }));
    const tick = `${out.prefix}.${L}_Tick`;
    const prereq = DAMAGE_OFF_MACHINES.has(type) ? out.notMachine() : "Prereqs.AlwaysTruePrereq";
    out.records.push(`${tick}:\n  $type: ContinuousAttackEffector\n  effectorClassName: TriggerContinuousAttackEffector\n  attackRecord: ${attack}\n  delayTime: ${round(Math.max(0.05, v("every")))}\n  timeDilationDriver: Effectors.TDD_World\n  prereqRecord: ${prereq}\n`);
    out.records.push(`${pkgPath}:\n  $type: GameplayLogicPackage\n  effectors:\n    - ${tick}\n`);
    let vfx: string | undefined;
    if (type === "Electric" && b.sparks) {
      // The game's electrocuted sparks, by name: they show for a couple of seconds as it starts (H3.5's spike).
      vfx = `${out.prefix}.Sparks`;
      const text = `${vfx}:\n  $type: StatusEffectFX\n  name: status_electrocuted\n  shouldReapply: false\n`;
      if (!out.records.includes(text)) out.records.push(text);
    }
    statusRecord({ tags: ["Debuff", "DoT", "Quickhack", "DamageOverTime"], duration: out.durationGroup(`${L}_Duration`, v("duration")), pkg: pkgPath, ui: ui(r.name, DAMAGE_ICONS[type]), vfx, removeAll: true });
  } else if (b.kind === "stat") {
    const c = STAT_CHOICES[b.stat ?? ""];
    if (!c) return undefined;
    const value = c.value === undefined ? 0 : v("value");
    const mods = c.stats.map((stat, i) => {
      const path = `${out.prefix}.${L}_Stat${c.stats.length > 1 ? i + 1 : ""}`;
      out.records.push(`${path}:\n  $type: ConstantStatModifier\n  value: ${round(value)}\n  modifierType: ${c.how}\n  statType: ${stat}\n`);
      return path;
    });
    out.records.push(`${pkgPath}:\n  $type: GameplayLogicPackage\n  stats:\n${mods.map((m) => `    - ${m}\n`).join("")}`);
    statusRecord({ tags: ["Debuff", "Quickhack"], duration: out.durationGroup(`${L}_Duration`, v("duration")), pkg: pkgPath, ui: ui(r.name, STAT_ICON) });
  } else {
    const applied = r.applied;
    if (!applied?.status) return undefined;
    // A poison or bleed: EDGEhack's copy, which keeps its damage off machines.
    const target = keptOffMachines(applied) ? (copyStatus(out, doc, `${L}_Applied`, applied, { damage: 0, duration: 0, stacks: 0 }, true) ?? applied.status) : applied.status;
    const chance = `${out.prefix}.${L}_Chance`;
    out.records.push(copy(chance, "Prereqs.SetChancePrereq", { setChance: String(round(Math.min(100, Math.max(0, v("chance"))) / 100)) }));
    const apply = `${out.prefix}.${L}_Apply`;
    out.records.push(`${apply}:\n  $type: ApplyStatusEffectEffector\n  effectorClassName: ApplyStatusEffectEffector\n  applicationTarget: None\n  count: 1\n  instigator: ""\n  inverted: false\n  removeWithEffector: false\n  useCountWhenRemoving: false\n  statusEffect: ${target}\n  prereqRecord: ${chance}\n`);
    out.records.push(`${pkgPath}:\n  $type: GameplayLogicPackage\n  effectors:\n    - ${apply}\n`);
    // The carrier needs no icon: it lasts 1 s, and what it applies has its own.
    const carrier = `${out.prefix}.CarrierDuration`;
    if (!out.records.some((x) => x.startsWith(`${carrier}:`))) out.durationGroup("CarrierDuration", 1);
    statusRecord({ tags: ["Debuff"], duration: carrier, pkg: pkgPath });
  }
  out.records.push(ownEffect(effect, "target", status));
  return effect;
}

/** An effect record of our own, for a status effect picked by itself. */
function ownEffect(path: string, on: Effect["on"], status: string): string {
  return `${path}:\n  $type: ObjectActionEffect\n  recipient: ObjectActionReference.${on === "V" ? "Instigator" : "Target"}\n  statusEffect: ${status}\n`;
}

/**
 * The added effects on one tier, as effect records for the action's lists. Unchanged, each uses the game's
 * record; a changed number gives this tier a copy of the status effect, under a name of its own.
 */
function addedOnTier(out: Out, doc: QuickhackDoc, added: ResolvedAdded[], t: Tier, label: string): { start: string[]; completion: string[] } {
  const result = { start: [] as string[], completion: [] as string[] };
  const key = tierKey(t);
  for (const r of added) {
    if (r.entry.off?.includes(key)) continue;
    const e = r.byTier.get(key);
    if (!e) continue;
    if (r.entry.build) {
      const path = builtOnTier(out, doc, r, t, label);
      if (path) result.completion.push(path);
      continue;
    }
    const want = r.entry.values?.[key] ?? {};
    const diff = (field: "duration" | "stacks" | "damage"): number => {
      const game = addedGameValue(e, field);
      const value = want[field];
      return value !== undefined && game !== undefined ? value - game : 0;
    };
    const diffs: StatusDiffs = { duration: diff("duration"), stacks: diff("stacks"), damage: diff("damage") };
    const own = `QuickHack.EDGEhack_${doc.id}_${r.entry.id}`;
    // A poison or bleed is always a copy, to carry the check that keeps it off machines (H3.4b).
    const offMachines = keptOffMachines(e);
    const changed = round(diffs.duration) !== 0 || round(diffs.stacks) !== 0 || round(diffs.damage) !== 0;
    const status = changed || offMachines ? copyStatus(out, doc, `${r.entry.id}_${label}`, e, diffs, offMachines) : undefined;
    let path: string;
    if (status) {
      path = `${own}_${label}_Effect`;
      out.records.push(r.entry.from ? copy(path, e.record, { statusEffect: status }) : ownEffect(path, e.on, status));
    } else if (r.entry.from) {
      path = e.record;
    } else {
      // One effect record for the tiers that use the game's status effect.
      path = own;
      const text = ownEffect(path, e.on, e.status!);
      if (!out.records.includes(text)) out.records.push(text);
    }
    (e.when === "start" ? result.start : result.completion).push(path);
  }
  return result;
}

/**
 * The records of a new quickhack beside its family: an item and an action per tier, its own wheel entry
 * and cooldown, and copies of the status effect and attack when their numbers change. Spread and the Boss
 * and Chimera actions are left out, since they point at the family's own records. Proved in the game with
 * one tier by the H3.1 spike.
 */
function writeNewHack(fam: Family, doc: QuickhackDoc, added: ResolvedAdded[], sales?: Sales): WrittenTweaks {
  const out = new Out(`EDGEhack.${doc.id}`);
  // Get it: the stock lines each vendor gets, kept to append once per vendor at the end.
  const stock = new Map<string, string[]>();
  const stockUp = (vendors: string[], entry: string): void => {
    for (const v of vendors) stock.set(v, [...(stock.get(v) ?? []), entry]);
  };
  if (fam.kind !== "people") {
    return { texts: [], warnings: [`${fam.name} is a ${fam.kind} hack: a new quickhack can start only from one for people, for now.`] };
  }
  const texts: TextEntry[] = [];
  const textKey = (field: string, text: string | undefined): string | undefined => {
    if (!text) return undefined;
    const key = `EDGEhack-${doc.id}-${field}`;
    texts.push({ key, text });
    return `LocKey#${key}`;
  };
  const name = newHackName(doc);
  const nameKey = textKey("Name", doc.name);
  const descriptionKey = textKey("Description", doc.description);
  const wheelKey = textKey("Wheel", doc.wheelText);
  const records = out.records;

  // One wheel entry and icon part for each the family's tiers use: nearly always one.
  const uis = new Map<string, string>();
  for (const t of fam.tiers) {
    if (!t.ui || uis.has(t.ui)) continue;
    const suffix = uis.size ? `_${uis.size + 1}` : "";
    const ui = `Interactions.EDGEhack_${doc.id}${suffix}`;
    uis.set(t.ui, ui);
    const part = `ChoiceCaptionParts.EDGEhack_${doc.id}${suffix}Icon`;
    if (t.captionIcon) records.push(copy(part, t.captionIcon, { texturePartID: doc.wheelIcon }));
    records.push(copy(ui, t.ui, { caption: nameKey, description: wheelKey, captionIcon: t.captionIcon ? part : undefined }));
  }

  // Its own cooldown, one for each the family's tiers use, so using it leaves the family free.
  const cooldowns = new Map<string, { start: string; check: string; from: string; fromCheck: string }>();
  for (const t of fam.tiers) {
    const c = t.cooldown;
    if (!c || cooldowns.has(c.record)) continue;
    const start = t.effects.find((e) => e.cooldown)?.record;
    if (!start || !c.prereq) {
      out.warnings.push(`${tierName(t)}: its cooldown could not be copied, so it shares ${fam.name}'s.`);
      continue;
    }
    const suffix = cooldowns.size ? `_${cooldowns.size + 1}` : "";
    const status = `BaseStatusEffect.EDGEhack_${doc.id}${suffix}_Cooldown`;
    const diff = doc.cooldown !== undefined ? doc.cooldown - c.base : 0;
    let duration: string | undefined;
    if (round(diff) !== 0) {
      duration = `${out.prefix}.Cooldown${suffix}`;
      records.push(`${duration}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n${[...(c.groupMods ?? []), out.modifier(`Cooldown${suffix}Mod`, "BaseStats.MaxDuration", diff)].map((m) => `    - ${m}\n`).join("")}`);
    }
    records.push(copy(status, c.record, { duration }));
    const ownStart = `QuickHack.EDGEhack_${doc.id}${suffix}_CooldownStart`;
    const ownCheck = `QuickHack.EDGEhack_${doc.id}${suffix}_CooldownCheck`;
    records.push(copy(ownStart, start, { statusEffect: status }));
    records.push(copy(ownCheck, c.prereq, { statusEffect: status }));
    cooldowns.set(c.record, { start: ownStart, check: ownCheck, from: start, fromCheck: c.prereq });
  }
  if (doc.cooldown !== undefined && !cooldowns.size) out.warnings.push(`${fam.name} has no cooldown to change.`);

  const actions = fam.tiers.map((t) => ({ rank: t.rank, path: newActionPath(doc, t) }));
  for (const t of fam.tiers) {
    const edit = doc.tiers[t.item ?? t.action] ?? {};
    const label = tierName(t);
    if (edit.bossRam !== undefined || edit.bossUpload !== undefined) {
      out.warnings.push(`${label}: a new quickhack has no Boss action, so its numbers against bosses are not used.`);
    }
    const spread = new Set(t.effects.filter((e) => e.spread).map((e) => e.record));
    const own = t.cooldown ? cooldowns.get(t.cooldown.record) : undefined;
    const startEffects = t.lists.startEffects.filter((e) => !spread.has(e)).map((e) => (e === own?.from ? own.start : e));
    let completionEffects = t.lists.completionEffects.filter((e) => !spread.has(e));

    const main = mainEffect(t.effects);
    const damage = main?.damage[0];
    const damageDiff = edit.damage !== undefined && damage ? edit.damage - damage.perHit : 0;
    const durationDiff = edit.duration !== undefined && main?.duration ? edit.duration - main.duration.base : 0;
    if (edit.damage !== undefined && !damage) out.warnings.push(`${label}: it has no damage to change.`);
    if (edit.duration !== undefined && !main?.duration) out.warnings.push(`${label}: its main effect has no duration to change.`);
    // A copied status effect needs its effect on the action to be the plain kind that names it.
    if ((round(damageDiff) !== 0 || round(durationDiff) !== 0) && main?.status && !main.effector) {
      const status = copyStatus(out, doc, label, main, { damage: damageDiff, duration: durationDiff, stacks: 0 });
      if (status) {
        const effect = `QuickHack.EDGEhack_${doc.id}_${label}_Effect`;
        records.push(copy(effect, main.record, { statusEffect: status }));
        completionEffects = completionEffects.map((e) => (e === main.record ? effect : e));
      }
    } else if (round(damageDiff) !== 0 || round(durationDiff) !== 0) {
      out.warnings.push(`${label}: its main effect could not be copied, so its damage and duration were left as they are.`);
    }

    const ramDiff = edit.ram !== undefined && t.ram ? edit.ram - t.ram.base : 0;
    const costs = [...t.lists.costs];
    if (round(ramDiff) !== 0) {
      const mod = out.modifier(`${label}_RamMod`, "BaseStats.Memory", ramDiff);
      const cost = `${out.prefix}.${label}_Ram`;
      records.push(`${cost}:\n  $type: StatPoolCost\n  statPool: BaseStatPools.Memory\n  costMods:\n    - ${mod}\n`);
      costs.push(cost);
    }
    const uploadDiff = edit.upload !== undefined && t.upload ? edit.upload - t.upload.base : 0;
    const activationTime = [...t.lists.activationTime];
    if (round(uploadDiff) !== 0) activationTime.push(out.modifier(`${label}_Upload`, "BaseStats.QuickHackUpload", uploadDiff));
    const more = addedOnTier(out, doc, added, t, label);

    records.push(
      copy(newActionPath(doc, t), t.action, {
        actionName: name,
        objectActionUI: t.ui ? uis.get(t.ui) : undefined,
        costs,
        activationTime,
        instigatorPrereqs: t.lists.instigatorPrereqs.map((p) => (p === own?.fromCheck ? own.check : p)),
        startEffects: [...startEffects, ...more.start],
        completionEffects: [...completionEffects, ...more.completion],
      }),
    );
    if (!t.item) continue;
    const item = newItemPath(doc, t);
    const key = tierKey(t);
    const sale = sales?.get(key);
    const want = doc.getIt?.[key] ?? {};

    // Crafting: the family's package, or one of its own when the components change. In the item's own
    // body: set from another file, the H3.6a spike's package did not take.
    let craftingData: string | undefined;
    if (want.components !== undefined && sales) {
      const c = sale?.crafting;
      if (!c) out.warnings.push(`${label}: the game's tier is not crafted, so its components were left out.`);
      else if (c.kinds !== 1 || !c.element) out.warnings.push(`${label}: crafting it takes ${c.kinds} kinds of component, so its components were left as the game has them.`);
      else if (want.components !== c.amount) {
        const element = `${out.prefix}.${label}_CraftingElement`;
        records.push(copy(element, c.element, { amount: String(want.components) }));
        craftingData = `${out.prefix}.${label}_Crafting`;
        records.push(copy(craftingData, c.package, { craftingRecipe: [element] }));
      }
    }

    // As the game's tiers do, each item lists its own action and every lower tier's.
    records.push(
      copy(item, t.item, {
        displayName: nameKey,
        localizedDescription: descriptionKey,
        iconPath: doc.itemIcon?.replace(/^UIIcon\./, ""),
        shardType: name,
        objectActions: [...t.lists.objectActions.filter((a) => !/^QuickHack\./.test(a)), ...actions.filter((a) => a.rank <= t.rank).map((a) => a.path)],
        CraftingData: craftingData,
      }),
    );

    // Sold the way the family's tier is: its stock lines copied with this item, at the same vendors and
    // behind the same gate, and a schematic of its own where the game sells one (H3.6a's spike: a vendor
    // shows a new line at once on an existing save, and buying the schematic teaches the recipe).
    if (!sale || want.sell === false) continue;
    sale.asIs.forEach((l, n) => {
      const entry = `Vendors.EDGEhack_${doc.id}_${label}${n ? `_${n + 1}` : ""}`;
      records.push(copy(entry, l.entry, { item }));
      stockUp(l.vendors, entry);
    });
    if (sale.recipe?.lines.length) {
      const recipe = `Items.Recipe_EDGEhack_${doc.id}_${label}`;
      const result = `${recipe}_Result`;
      records.push(sale.recipe.result ? copy(result, sale.recipe.result, { item }) : `${result}:\n  $type: CraftingResult\n  amount: 1\n  item: ${item}\n`);
      records.push(copy(recipe, sale.recipe.record, { displayName: nameKey, craftingResult: result }));
      sale.recipe.lines.forEach((l, n) => {
        const entry = `Vendors.EDGEhack_${doc.id}_${label}_Schematic${n ? `_${n + 1}` : ""}`;
        records.push(copy(entry, l.entry, { item: recipe }));
        stockUp(l.vendors, entry);
      });
    }
  }
  // Each vendor's stock under one key: a second key of the same name would replace the first.
  for (const [vendor, entries] of stock) out.changes.push(`${vendor}.itemStock:\n${entries.map((e) => `  - !append-once ${e}\n`).join("")}`);

  out.warnings.push(...addedWarnings(fam, doc, added));
  const yaml = [`# Made by EDGEhack from ${doc.id}.quickhack.json. Change that document, not this file: saving it writes this again.\n`, ...records, ...out.changes].join("\n");
  return { yaml, texts, warnings: out.warnings, script: NEW_HACK_SCRIPT };
}
