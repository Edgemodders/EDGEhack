// A quickhack document, <name>.quickhack.json: what a modder changed, in the modder's words. Values are
// what the modder wants the number to be, not differences: the writer works out each difference from
// the game's own value, so a game patch that changes a base value keeps the modder's number. Anything
// missing stays as the game has it. Pure, no VS Code.

/** The numbers of one tier. */
export interface TierEdit {
  ram?: number;
  upload?: number;
  /** Damage a hit (a tick, for damage over time). */
  damage?: number;
  duration?: number;
  /** Against bosses, when the modder sets their own; else a boss gets the same difference. */
  bossRam?: number;
  bossUpload?: number;
}

export type TierField = keyof TierEdit;
export const TIER_FIELDS: TierField[] = ["ram", "upload", "damage", "duration", "bossRam", "bossUpload"];

/** An added effect's numbers on one tier. Any of them makes it a copy of its own on that tier. */
export interface AddedValues {
  duration?: number;
  stacks?: number;
  /** Damage a hit (a tick, for damage over time). */
  damage?: number;
}

export type AddedField = keyof AddedValues;
export const ADDED_FIELDS: AddedField[] = ["duration", "stacks", "damage"];

/**
 * An effect added to the quickhack: a status effect, or another quickhack's effect, which follows that
 * quickhack's tiers. It uses the game's own record until a number on a tier changes.
 */
export interface AddedEffect {
  /** Names its records. Fixed once written, and not used again in the document. */
  id: string;
  /** A status effect's record. */
  status?: string;
  /** Or another quickhack's family, and which of its effects (effectKey). */
  from?: string;
  effect?: string;
  /** Who a status effect goes on: the target unless set. Another quickhack's effect keeps its own. */
  on?: "target" | "V";
  /** The tiers it is left off, by tier item. Missing, it is on every tier. */
  off?: string[];
  /** Numbers by tier item. */
  values?: Record<string, AddedValues>;
}

export interface QuickhackDoc {
  format: 1;
  /** Names the mod's records and text keys. Fixed once written: saves and other mods refer to them. */
  id: string;
  /** The game's family this changes, or a new quickhack's starting point: Overheat. */
  family: string;
  /** A new quickhack beside the family, with records of its own, rather than a change to the family. */
  newHack?: boolean;
  name?: string;
  description?: string;
  /** The wheel's text. The game shows it only for a hack whose tab has no effects list. */
  wheelText?: string;
  /** The UIIcon record of the item's icon, and of the wheel's. */
  itemIcon?: string;
  wheelIcon?: string;
  /** The cooldown in seconds: for the whole family, whose tiers share one. */
  cooldown?: number;
  /** By the tier's item record. */
  tiers: Record<string, TierEdit>;
  /** Effects added to it. Missing when there are none. */
  effects?: AddedEffect[];
}

/** A name fit for record paths and text keys: lowercase letters, digits and underscores. */
export function safeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function newDoc(modName: string, family: string): QuickhackDoc {
  const id = safeId(`${modName}_${family}`);
  return { format: 1, id, family, tiers: {} };
}

/** A document for a new quickhack: the id comes from its name, since a mod may make several from one family. */
export function newHackDoc(modName: string, family: string, name: string): QuickhackDoc {
  return { format: 1, id: safeId(`${modName}_${name}`), family, newHack: true, name, tiers: {} };
}

function number(v: unknown, what: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !isFinite(v)) throw new Error(`${what} must be a number.`);
  return v;
}

function text(v: unknown, what: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`${what} must be text.`);
  return v;
}

function addedEffects(v: unknown): AddedEffect[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new Error("The effects must be a list.");
  const seen = new Set<string>();
  const out = v.map((raw: Record<string, unknown>) => {
    if (!raw || typeof raw.id !== "string" || !/^[a-z0-9_]+$/.test(raw.id)) throw new Error("An added effect needs an id of lowercase letters, digits and underscores.");
    if (seen.has(raw.id)) throw new Error(`Two added effects have the id ${raw.id}.`);
    seen.add(raw.id);
    const status = text(raw.status, `Effect ${raw.id}'s status effect`);
    const from = text(raw.from, `Effect ${raw.id}'s quickhack`);
    const effect = text(raw.effect, `Effect ${raw.id}'s effect`);
    if (!status && !(from && effect)) throw new Error(`Effect ${raw.id} needs a status effect, or a quickhack and one of its effects.`);
    if (raw.on !== undefined && raw.on !== "target" && raw.on !== "V") throw new Error(`Effect ${raw.id} goes on the target or on V.`);
    const off = raw.off === undefined ? undefined : Array.isArray(raw.off) ? raw.off.filter((x): x is string => typeof x === "string") : undefined;
    const values: Record<string, AddedValues> = {};
    for (const [tier, edit] of Object.entries((raw.values ?? {}) as Record<string, Record<string, unknown>>)) {
      const t: AddedValues = {};
      for (const f of ADDED_FIELDS) {
        const n = number(edit?.[f], `Effect ${raw.id}'s ${f} on ${tier}`);
        if (n !== undefined) t[f] = n;
      }
      if (Object.keys(t).length) values[tier] = t;
    }
    const e: AddedEffect = { id: raw.id };
    if (status) e.status = status;
    if (from) e.from = from;
    if (effect) e.effect = effect;
    if (raw.on) e.on = raw.on as "target" | "V";
    if (off?.length) e.off = off;
    if (Object.keys(values).length) e.values = values;
    return e;
  });
  return out.length ? out : undefined;
}

/** Reads a document's text. Throws with a message for the modder when it cannot be used. */
export function parseDoc(source: string): QuickhackDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (e) {
    throw new Error(`This is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("This is not a quickhack document.");
  if (o.format !== 1) throw new Error(`This quickhack document has format ${String(o.format)}; this EDGEhack reads format 1.`);
  if (typeof o.id !== "string" || !/^[a-z0-9_]+$/.test(o.id)) throw new Error("A quickhack document needs an id of lowercase letters, digits and underscores.");
  if (typeof o.family !== "string" || !o.family) throw new Error("A quickhack document needs the family it changes.");
  const tiers: Record<string, TierEdit> = {};
  for (const [item, edit] of Object.entries((o.tiers ?? {}) as Record<string, Record<string, unknown>>)) {
    const t: TierEdit = {};
    for (const f of TIER_FIELDS) {
      const v = number(edit?.[f], `${item}'s ${f}`);
      if (v !== undefined) t[f] = v;
    }
    tiers[item] = t;
  }
  return {
    format: 1,
    id: o.id,
    family: o.family,
    ...(o.newHack === true ? { newHack: true } : {}),
    name: text(o.name, "The name"),
    description: text(o.description, "The description"),
    wheelText: text(o.wheelText, "The wheel text"),
    itemIcon: text(o.itemIcon, "The item icon"),
    wheelIcon: text(o.wheelIcon, "The wheel icon"),
    cooldown: number(o.cooldown, "The cooldown"),
    tiers,
    effects: addedEffects(o.effects),
  };
}

/** A document as its file's text, leaving out what is unset and tiers with no changes. */
export function printDoc(doc: QuickhackDoc): string {
  const tiers: Record<string, TierEdit> = {};
  for (const [item, edit] of Object.entries(doc.tiers)) {
    if (Object.values(edit).some((v) => v !== undefined)) tiers[item] = edit;
  }
  return `${JSON.stringify({ ...doc, tiers }, null, 2)}\n`;
}

/**
 * A document with one field set, or unset with undefined or a value equal to the game's. Pure: the
 * editor applies the result as a text edit, so VS Code's undo covers it.
 */
export function withField(doc: QuickhackDoc, field: keyof QuickhackDoc, value: string | number | undefined, game?: string | number): QuickhackDoc {
  const v = value === "" || value === game ? undefined : value;
  return { ...doc, [field]: v };
}

export function withTierField(doc: QuickhackDoc, tier: string, field: TierField, value: number | undefined, game?: number): QuickhackDoc {
  const edit: TierEdit = { ...doc.tiers[tier] };
  if (value === undefined || value === game) delete edit[field];
  else edit[field] = value;
  return { ...doc, tiers: { ...doc.tiers, [tier]: edit } };
}

/** A document with one more effect. Its id is never one the document has used, so a copy's records keep their names. */
export function withAddedEffect(doc: QuickhackDoc, effect: Omit<AddedEffect, "id">): QuickhackDoc {
  const used = (doc.effects ?? []).map((e) => Number(/^a(\d+)$/.exec(e.id)?.[1] ?? 0));
  const id = `a${Math.max(0, ...used) + 1}`;
  return { ...doc, effects: [...(doc.effects ?? []), { id, ...effect }] };
}

export function withoutAddedEffect(doc: QuickhackDoc, id: string): QuickhackDoc {
  const effects = (doc.effects ?? []).filter((e) => e.id !== id);
  const { effects: _gone, ...rest } = doc;
  return effects.length ? { ...rest, effects } : rest;
}

function mapAdded(doc: QuickhackDoc, id: string, change: (e: AddedEffect) => AddedEffect): QuickhackDoc {
  return { ...doc, effects: (doc.effects ?? []).map((e) => (e.id === id ? change(e) : e)) };
}

/** Puts an added effect on a tier, or leaves it off. */
export function withAddedTier(doc: QuickhackDoc, id: string, tier: string, on: boolean): QuickhackDoc {
  return mapAdded(doc, id, (e) => {
    const off = (e.off ?? []).filter((t) => t !== tier);
    if (!on) off.push(tier);
    const { off: _old, ...rest } = e;
    return off.length ? { ...rest, off } : rest;
  });
}

/** Who a status effect goes on. The target is the default, so it is not written. */
export function withAddedRecipient(doc: QuickhackDoc, id: string, on: "target" | "V"): QuickhackDoc {
  return mapAdded(doc, id, (e) => {
    const { on: _old, ...rest } = e;
    return on === "V" ? { ...rest, on } : rest;
  });
}

/** One number of an added effect on one tier, unset with undefined or a value equal to the game's. */
export function withAddedValue(doc: QuickhackDoc, id: string, tier: string, field: AddedField, value: number | undefined, game?: number): QuickhackDoc {
  return mapAdded(doc, id, (e) => {
    const edit: AddedValues = { ...e.values?.[tier] };
    if (value === undefined || value === game) delete edit[field];
    else edit[field] = value;
    const values = { ...e.values, [tier]: edit };
    if (!Object.keys(edit).length) delete values[tier];
    const { values: _old, ...rest } = e;
    return Object.keys(values).length ? { ...rest, values } : rest;
  });
}
