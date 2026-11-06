// The writer: a quickhack document and the game's records in, TweakXL YAML and text entries out. Numbers
// are written as differences (docs/design.md, "H2: plan"; proved in the game by the H2a spike): each one
// gets one more modifier, and the game's own records stay as they are. A new quickhack is the other way
// round: every record it changes is its own copy (docs/design.md, "H3: plan"). Pure, no VS Code.
import type { QuickhackDoc, TierEdit } from "./document";
import { mainEffect, Tier, Family, Variant, Effect } from "./read";
import { NEW_HACK_SCRIPT } from "./newHackScript";

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

  set(flat: string, value: string): void {
    this.changes.push(`${flat}: ${value}\n`);
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

/** The YAML and texts for a document. */
export function writeTweaks(fam: Family, doc: QuickhackDoc): WrittenTweaks {
  if (doc.newHack) return writeNewHack(fam, doc);
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
  }

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

/**
 * The records of a new quickhack beside its family: an item and an action per tier, its own wheel entry
 * and cooldown, and copies of the status effect and attack when their numbers change. Spread and the Boss
 * and Chimera actions are left out, since they point at the family's own records. Proved in the game with
 * one tier by the H3.1 spike.
 */
function writeNewHack(fam: Family, doc: QuickhackDoc): WrittenTweaks {
  const out = new Out(`EDGEhack.${doc.id}`);
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
      const fields: Record<string, Field> = {};
      if (round(durationDiff) !== 0 && main.durationGroup) {
        const group = `${out.prefix}.${label}_Duration`;
        records.push(`${group}:\n  $type: StatModifierGroup\n  statModsLimit: -1\n  statModifiers:\n${[...(main.durationMods ?? []), out.modifier(`${label}_DurationMod`, "BaseStats.MaxDuration", durationDiff)].map((m) => `    - ${m}\n`).join("")}`);
        fields.duration = group;
      }
      if (round(damageDiff) !== 0) {
        if (damage?.stat && damage.effector && damage.package) {
          // The damage sits at the end of a chain, each link naming the next, so each is copied.
          const attack = `Attacks.EDGEhack_${doc.id}_${label}`;
          const effector = `${out.prefix}.${label}_Effector`;
          const pkg = `${out.prefix}.${label}_Package`;
          records.push(copy(attack, damage.record, { statModifiers: [...(damage.attackMods ?? []), out.modifier(`${label}_Damage`, damage.stat, damageDiff)] }));
          records.push(copy(effector, damage.effector, { attackRecord: attack }));
          records.push(copy(pkg, damage.package, { effectors: (damage.packageEffectors ?? []).map((e) => (e === damage.effector ? effector : e)) }));
          fields.packages = (main.packages ?? []).map((p) => (p === damage.package ? pkg : p));
        } else {
          out.warnings.push(`${label}: its damage is not in a status effect's package, so it was left as it is.`);
        }
      }
      if (Object.keys(fields).length) {
        const status = `BaseStatusEffect.EDGEhack_${doc.id}_${label}`;
        const effect = `QuickHack.EDGEhack_${doc.id}_${label}_Effect`;
        records.push(copy(status, main.status, fields));
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

    records.push(
      copy(newActionPath(doc, t), t.action, {
        actionName: name,
        objectActionUI: t.ui ? uis.get(t.ui) : undefined,
        costs,
        activationTime,
        instigatorPrereqs: t.lists.instigatorPrereqs.map((p) => (p === own?.fromCheck ? own.check : p)),
        startEffects,
        completionEffects,
      }),
    );
    if (!t.item) continue;
    // As the game's tiers do, each item lists its own action and every lower tier's.
    records.push(
      copy(newItemPath(doc, t), t.item, {
        displayName: nameKey,
        localizedDescription: descriptionKey,
        iconPath: doc.itemIcon?.replace(/^UIIcon\./, ""),
        shardType: name,
        objectActions: [...t.lists.objectActions.filter((a) => !/^QuickHack\./.test(a)), ...actions.filter((a) => a.rank <= t.rank).map((a) => a.path)],
      }),
    );
  }

  const yaml = [`# Made by EDGEhack from ${doc.id}.quickhack.json. Change that document, not this file: saving it writes this again.\n`, ...records].join("\n");
  return { yaml, texts, warnings: out.warnings, script: NEW_HACK_SCRIPT };
}
