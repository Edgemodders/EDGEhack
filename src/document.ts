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
