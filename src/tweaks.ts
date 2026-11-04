// The writer: a quickhack document and the game's records in, TweakXL YAML and text entries out. Numbers
// are written as differences (docs/design.md, "H2: plan"; proved in the game by the H2a spike): each one
// gets one more modifier, and the game's own records stay as they are. Pure, no VS Code.
import type { QuickhackDoc, TierEdit } from "./document";
import { mainEffect, Tier, Family, Variant, Effect } from "./read";

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
