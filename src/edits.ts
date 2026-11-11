// Changes to a quickhack document as a list, free of VS Code (H4.5): what the editor's page does one
// control at a time, for the MCP server's hack_edit. Each change goes through the same document
// helpers the page uses, with the game's value beside it, so a number set back to the game's is
// taken out as the page does.

import {
  ADDED_FIELDS,
  DAMAGE_TYPES,
  TIER_FIELDS,
  newBuiltEffect,
  withAddedBuild,
  withAddedEffect,
  withAddedRecipient,
  withAddedTier,
  withAddedValue,
  withField,
  withGetIt,
  withLines,
  withoutAddedEffect,
  withTierField,
  type AddedField,
  type DamageTypeName,
  type FeatureLine,
  type QuickhackDoc,
  type TierField,
} from "./document";
import { addedBase, applyAddedToAll, STAT_CHOICES, type ResolvedAdded } from "./effects";
import { gameValue } from "./editorHtml";
import { tierKey, type Family, type Tier } from "./read";

export const round = (n: number): number => Math.round(n * 10000) / 10000;

/** Gives every other tier the selected tier's change in a number: the same difference from its own value. */
export function applyToAll(fam: Family, doc: QuickhackDoc, tier: string, field: TierField): QuickhackDoc {
  if (!TIER_FIELDS.includes(field)) return doc;
  const from = fam.tiers.find((t) => (t.item ?? t.action) === tier);
  const base = from && gameValue(from, field);
  const want = doc.tiers[tier]?.[field];
  if (base === undefined || want === undefined) return doc;
  const diff = want - base;
  let next = doc;
  for (const t of fam.tiers) {
    const game = gameValue(t, field);
    if (game === undefined) continue;
    next = withTierField(next, t.item ?? t.action, field, round(Math.max(0, game + diff)), game);
  }
  return next;
}

export const TEXT_FIELDS = ["name", "description", "wheelText", "itemIcon", "wheelIcon", "cooldown"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

/** One change to a document. A null value sets it back to the game's. */
export type Change =
  | { op: "set"; field: TextField; value: string | number | null }
  | { op: "tier"; tier: string; field: TierField; value: number | null; all?: boolean }
  | { op: "addEffect"; status?: string; from?: string; effect?: string; build?: "damage" | "stat" | "chance"; applies?: string; on?: "target" | "V" }
  | { op: "removeEffect"; id: string }
  | { op: "effectValue"; id: string; tier: string; field: AddedField; value: number | null; all?: boolean }
  | { op: "effectTier"; id: string; tier: string; on: boolean }
  | { op: "effectBuild"; id: string; damageType?: DamageTypeName; sparks?: boolean; stat?: string }
  | { op: "effectOn"; id: string; on: "target" | "V" }
  | { op: "getIt"; tier: string; sell?: boolean; components?: number | null }
  | { op: "lines"; lines: FeatureLine[] };

/** A tier by its item or action record, its quality (Rare, Legendary++), or its place from 0 (the base tier) up. */
export function findTier(fam: Family, which: string): Tier {
  const w = which.trim();
  const t =
    fam.tiers.find((x) => x.item === w || x.action === w) ??
    fam.tiers.find((x) => x.quality?.toLowerCase() === w.toLowerCase()) ??
    (/^\d+$/.test(w) ? fam.tiers[Number(w)] : undefined);
  if (!t) throw new Error(`${fam.name} has no tier "${which}". Its tiers: ${fam.tiers.map((x, i) => `${i} ${x.quality ?? ""} (${tierKey(x)})`.replace(/\s+/g, " ")).join(", ")}.`);
  return t;
}

export interface EditContext {
  fam: Family;
  /** The document's added effects, read: asked again after each change that adds or alters one. */
  added(doc: QuickhackDoc): Promise<ResolvedAdded[]>;
}

/** Applies the changes in order. Throws, with nothing applied, at the first that cannot be made. Answers the document and a line per change. */
export async function applyChanges(doc: QuickhackDoc, changes: Change[], ctx: EditContext): Promise<{ doc: QuickhackDoc; done: string[] }> {
  const { fam } = ctx;
  const top = fam.tiers[fam.tiers.length - 1];
  const done: string[] = [];
  let d = doc;
  const effect = (id: string) => {
    const e = (d.effects ?? []).find((x) => x.id === id);
    if (!e) throw new Error(`The quickhack has no added effect ${id}. Its added effects: ${(d.effects ?? []).map((x) => x.id).join(", ") || "none"}.`);
    return e;
  };
  for (const [i, c] of changes.entries()) {
    const at = `Change ${i + 1} (${c.op})`;
    switch (c.op) {
      case "set": {
        if (!TEXT_FIELDS.includes(c.field)) throw new Error(`${at}: ${String(c.field)} is not a field to set. Use one of ${TEXT_FIELDS.join(", ")}.`);
        if (c.field === "cooldown") {
          if (!top.cooldown) throw new Error(`${at}: ${fam.name} has no cooldown to change.`);
          if (c.value !== null && (typeof c.value !== "number" || c.value < 0)) throw new Error(`${at}: a cooldown is a number of seconds, 0 or more.`);
          d = withField(d, "cooldown", c.value ?? undefined, top.cooldown.base);
        } else {
          if (c.value !== null && typeof c.value !== "string") throw new Error(`${at}: ${c.field} is a text.`);
          const game = c.field === "name" ? top.name : c.field === "description" ? top.description : c.field === "wheelText" ? top.wheelDescription : c.field === "itemIcon" ? top.icons.item?.record : top.icons.wheel?.record;
          if (c.field === "name" && d.newHack && !c.value?.trim()) throw new Error(`${at}: a new quickhack keeps a name of its own.`);
          d = withField(d, c.field, c.value ?? undefined, game);
        }
        done.push(c.value === null ? `${c.field} back to the game's` : `${c.field} set`);
        break;
      }
      case "tier": {
        if (!TIER_FIELDS.includes(c.field)) throw new Error(`${at}: ${String(c.field)} is not a tier number. Use one of ${TIER_FIELDS.join(", ")}.`);
        if (d.newHack && (c.field === "bossRam" || c.field === "bossUpload")) throw new Error(`${at}: a new quickhack has no versions for bosses of its own, so there is nothing to set against them.`);
        const t = findTier(fam, c.tier);
        const game = gameValue(t, c.field);
        if (game === undefined) throw new Error(`${at}: the ${t.quality ?? tierKey(t)} tier of ${fam.name} has no ${c.field} to change.`);
        if (c.value !== null && (!Number.isFinite(c.value) || c.value < 0)) throw new Error(`${at}: ${c.field} must be a number, 0 or more.`);
        d = withTierField(d, tierKey(t), c.field, c.value ?? undefined, game);
        if (c.all && c.value !== null) d = applyToAll(fam, d, tierKey(t), c.field);
        done.push(`${c.field} on ${c.all ? "every tier, by the same difference" : t.quality ?? tierKey(t)}`);
        break;
      }
      case "addEffect": {
        const kinds = [c.status, c.from, c.build].filter(Boolean).length;
        if (kinds !== 1) throw new Error(`${at}: give one of status (a status effect's record), from with effect (another quickhack's effect), or build (damage, stat or chance).`);
        if (c.from && !c.effect) throw new Error(`${at}: from needs effect, the key hack_effects gives for that quickhack's effect.`);
        if (c.build === "chance" && !c.applies) throw new Error(`${at}: a built chance needs applies, the status effect its roll applies.`);
        const next = c.status
          ? withAddedEffect(d, { status: c.status, ...(c.on === "V" ? { on: "V" as const } : {}) })
          : c.from
            ? withAddedEffect(d, { from: c.from, effect: c.effect })
            : withAddedEffect(d, { build: newBuiltEffect(c.build!, c.applies) });
        const id = next.effects![next.effects!.length - 1].id;
        d = next;
        done.push(`added effect ${id}`);
        break;
      }
      case "removeEffect":
        effect(c.id);
        d = withoutAddedEffect(d, c.id);
        done.push(`removed effect ${c.id}`);
        break;
      case "effectValue": {
        effect(c.id);
        if (!ADDED_FIELDS.includes(c.field)) throw new Error(`${at}: ${String(c.field)} is not an effect number. Use one of ${ADDED_FIELDS.join(", ")}.`);
        const t = findTier(fam, c.tier);
        const r = (await ctx.added(d)).find((x) => x.entry.id === c.id);
        if (r?.problem) throw new Error(`${at}: effect ${c.id} could not be read: ${r.problem}`);
        const game = r ? addedBase(r, tierKey(t), c.field) : undefined;
        if (c.value !== null && !Number.isFinite(c.value)) throw new Error(`${at}: ${c.field} must be a number.`);
        d = withAddedValue(d, c.id, tierKey(t), c.field, c.value ?? undefined, game);
        if (c.all && c.value !== null) d = applyAddedToAll(d, await ctx.added(d), c.id, tierKey(t), c.field);
        done.push(`effect ${c.id}'s ${c.field} on ${c.all ? "every tier" : t.quality ?? tierKey(t)}`);
        break;
      }
      case "effectTier": {
        effect(c.id);
        const t = findTier(fam, c.tier);
        d = withAddedTier(d, c.id, tierKey(t), c.on);
        done.push(`effect ${c.id} ${c.on ? "on" : "off"} ${t.quality ?? tierKey(t)}`);
        break;
      }
      case "effectBuild": {
        const e = effect(c.id);
        if (!e.build) throw new Error(`${at}: effect ${c.id} is not one EDGEhack builds.`);
        if (c.damageType && !DAMAGE_TYPES.includes(c.damageType)) throw new Error(`${at}: damageType is one of ${DAMAGE_TYPES.join(", ")}.`);
        if (c.stat && !STAT_CHOICES[c.stat]) throw new Error(`${at}: stat is one of ${Object.keys(STAT_CHOICES).join(", ")}.`);
        d = withAddedBuild(d, c.id, { ...(c.damageType ? { damageType: c.damageType } : {}), ...(c.sparks !== undefined ? { sparks: c.sparks } : {}), ...(c.stat ? { stat: c.stat } : {}) });
        done.push(`effect ${c.id} built differently`);
        break;
      }
      case "effectOn": {
        const e = effect(c.id);
        if (!e.status) throw new Error(`${at}: only a status effect's recipient can change; another quickhack's effect keeps its own.`);
        d = withAddedRecipient(d, c.id, c.on);
        done.push(`effect ${c.id} on ${c.on === "V" ? "V" : "the target"}`);
        break;
      }
      case "getIt": {
        if (!d.newHack) throw new Error(`${at}: Get it is for a new quickhack; a change to the game's sells the way the game does.`);
        const t = findTier(fam, c.tier);
        if (c.sell !== undefined) d = withGetIt(d, tierKey(t), "sell", c.sell);
        if (c.components !== undefined) d = withGetIt(d, tierKey(t), "components", c.components ?? undefined);
        done.push(`Get it on ${t.quality ?? tierKey(t)}`);
        break;
      }
      case "lines": {
        const lines = c.lines.map((l) => ({ text: l.text, ...(l.from ? { from: tierKey(findTier(fam, l.from)) } : {}) }));
        d = withLines(d, lines.filter((l) => l.text.trim()));
        done.push(`${lines.length} feature line${lines.length === 1 ? "" : "s"}`);
        break;
      }
      default:
        throw new Error(`${at}: unknown change.`);
    }
  }
  return { doc: d, done };
}
