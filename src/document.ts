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
  /** A built damage over time: seconds between hits. */
  every?: number;
  /** A built stat change: the stat's new value, as its row says (times normal, or added). */
  value?: number;
  /** A built chance to apply: in percent. */
  chance?: number;
}

export type AddedField = keyof AddedValues;
export const ADDED_FIELDS: AddedField[] = ["duration", "stacks", "damage", "every", "value", "chance"];

/** The damage types a built damage over time can have. */
export const DAMAGE_TYPES = ["Electric", "Thermal", "Chemical", "Physical"] as const;
export type DamageTypeName = (typeof DAMAGE_TYPES)[number];

/**
 * An effect EDGEhack builds from the game's effector classes (H3.5), rather than one picked from the game:
 * a damage over time, a stat change while hacked, or a chance to apply a status effect.
 */
export interface BuiltEffect {
  kind: "damage" | "stat" | "chance";
  /** damage: its type. */
  damageType?: DamageTypeName;
  /** damage, Electric: the game's sparks on the target as it starts. */
  sparks?: boolean;
  /** stat: a key of STAT_CHOICES (effects.ts). */
  stat?: string;
  /** chance: the status effect a roll applies. */
  applies?: string;
}

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
  /** Or one EDGEhack builds. */
  build?: BuiltEffect;
}

/**
 * How one tier of a new quickhack is got (H3.6). By default the way the game's tier of its family is:
 * the same vendors and gate, its own schematic where the game sells one, the family's crafting cost.
 */
export interface GetIt {
  /** False: not sold by any vendor. */
  sell?: false;
  /** How many components crafting it takes; the kind stays the game's for that quality. */
  components?: number;
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
  /**
   * Icons of its own (H3b), uploaded or generated, each kept as a PNG beside the document, in the
   * folder `<id>.icons` (ownIcons.ts): true where the look has one. An own icon wins over the
   * UIIcon field above.
   */
  ownIcons?: OwnIcons;
  /** The cooldown in seconds: for the whole family, whose tiers share one. */
  cooldown?: number;
  /** By the tier's item record. */
  tiers: Record<string, TierEdit>;
  /** Effects added to it. Missing when there are none. */
  effects?: AddedEffect[];
  /** A new quickhack's Get it, by the tier's item. Missing: every tier is got the way the family's is. */
  getIt?: Record<string, GetIt>;
  /**
   * Its script (H3c.3, scripts.ts): a file of the modder's in the mod's REDnode package, whose `canUse`
   * and `onLand` REDnode runs in the game. `disabledText` is what a disabled hack says on the wheel.
   */
  scripts?: QuickhackScripts;
  /**
   * Feature lines (H3d): bullets of the modder's own in the item's tooltip, after the game's, from a tier
   * up. Plain text: H4.1's spike showed a line needs no LocKey.
   */
  lines?: FeatureLine[];
}

export interface FeatureLine {
  text: string;
  /** The tier it shows from, by its item record (a tier lists the lines of the tiers below it). Missing: the first. */
  from?: string;
}

/** The longest feature line, as the game's own run. */
export const LINE_MAX = 160;

/** A document with its feature lines changed: an empty list leaves the field out. */
export function withLines(doc: QuickhackDoc, lines: FeatureLine[]): QuickhackDoc {
  const { lines: _old, ...rest } = doc;
  const clean = lines.map((l) => ({ text: l.text.replace(/\s+/g, " ").slice(0, LINE_MAX), ...(l.from ? { from: l.from } : {}) }));
  return clean.length ? { ...rest, lines: clean } : rest;
}

function linesOf(v: unknown): FeatureLine[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new Error("The feature lines must be a list.");
  const lines = v.map((l, i) => {
    const o = l as Record<string, unknown>;
    if (!o || typeof o.text !== "string") throw new Error(`Feature line ${i + 1} needs a text.`);
    return { text: o.text, ...(typeof o.from === "string" && o.from ? { from: o.from } : {}) };
  });
  return lines.length ? lines : undefined;
}

export interface QuickhackScripts {
  /** The script file's name in the mod's REDnode package, such as "static_skull.mjs". */
  file: string;
  disabledText?: string;
}

/** A document with its script set, changed or taken away. */
export function withScripts(doc: QuickhackDoc, scripts: QuickhackScripts | undefined): QuickhackDoc {
  const { scripts: _old, ...rest } = doc;
  if (!scripts) return rest;
  const text = scripts.disabledText?.replace(/\s+/g, " ").trim().slice(0, 80);
  return { ...rest, scripts: { file: scripts.file, ...(text ? { disabledText: text } : {}) } };
}

function scriptsOf(v: unknown): QuickhackScripts | undefined {
  if (v === undefined || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o !== "object" || typeof o.file !== "string" || !/^[A-Za-z0-9_.-]+\.m?js$/.test(o.file)) throw new Error("The script needs a file name ending in .mjs or .js.");
  return { file: o.file, ...(typeof o.disabledText === "string" && o.disabledText.trim() ? { disabledText: o.disabledText } : {}) };
}

/** The three looks of a quickhack's icons (H3b): the item card, the wheel glyph, the target's status icon. */
export const ICON_LOOKS = ["item", "wheel", "status"] as const;
export type IconLook = (typeof ICON_LOOKS)[number];
export type OwnIcons = Partial<Record<IconLook, true>>;

/** A document with an own icon set or cleared. */
export function withOwnIcon(doc: QuickhackDoc, look: IconLook, on: boolean): QuickhackDoc {
  const own: OwnIcons = { ...(doc.ownIcons ?? {}) };
  if (on) own[look] = true;
  else delete own[look];
  const { ownIcons: _old, ...rest } = doc;
  return Object.keys(own).length ? { ...rest, ownIcons: own } : rest;
}

function ownIconsOf(v: unknown): OwnIcons | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new Error("ownIcons must be an object.");
  const own: OwnIcons = {};
  for (const [k, on] of Object.entries(v as Record<string, unknown>)) {
    if (!(ICON_LOOKS as readonly string[]).includes(k)) throw new Error(`ownIcons has no look "${k}" (item, wheel, status).`);
    if (on === true) own[k as IconLook] = true;
  }
  return Object.keys(own).length ? own : undefined;
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

function builtEffect(v: unknown, id: string): BuiltEffect | undefined {
  if (v === undefined || v === null) return undefined;
  const raw = v as Record<string, unknown>;
  if (raw.kind !== "damage" && raw.kind !== "stat" && raw.kind !== "chance") throw new Error(`Effect ${id} builds a damage over time, a stat change or a chance to apply.`);
  const b: BuiltEffect = { kind: raw.kind };
  if (raw.kind === "damage") {
    if (!DAMAGE_TYPES.includes(raw.damageType as DamageTypeName)) throw new Error(`Effect ${id}'s damage type is one of ${DAMAGE_TYPES.join(", ")}.`);
    b.damageType = raw.damageType as DamageTypeName;
    if (raw.sparks === true) b.sparks = true;
  }
  if (raw.kind === "stat") {
    const stat = text(raw.stat, `Effect ${id}'s stat`);
    if (!stat) throw new Error(`Effect ${id} needs the stat it changes.`);
    b.stat = stat;
  }
  if (raw.kind === "chance") {
    const applies = text(raw.applies, `Effect ${id}'s status effect`);
    if (!applies) throw new Error(`Effect ${id} needs the status effect its roll applies.`);
    b.applies = applies;
  }
  return b;
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
    const build = builtEffect(raw.build, raw.id);
    if (!status && !(from && effect) && !build) throw new Error(`Effect ${raw.id} needs a status effect, a quickhack and one of its effects, or what EDGEhack builds.`);
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
    if (build) e.build = build;
    return e;
  });
  return out.length ? out : undefined;
}

function getItOf(v: unknown): Record<string, GetIt> | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new Error("Get it must be an object by tier.");
  const out: Record<string, GetIt> = {};
  for (const [tier, raw] of Object.entries(v as Record<string, Record<string, unknown>>)) {
    const g: GetIt = {};
    if (raw?.sell === false) g.sell = false;
    else if (raw?.sell !== undefined && raw?.sell !== true) throw new Error(`Get it's sell on ${tier} is true or false.`);
    const c = number(raw?.components, `Get it's components on ${tier}`);
    if (c !== undefined) {
      if (c < 1 || !Number.isInteger(c)) throw new Error(`Get it's components on ${tier} must be a whole number, 1 or more.`);
      g.components = c;
    }
    if (Object.keys(g).length) out[tier] = g;
  }
  return Object.keys(out).length ? out : undefined;
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
    ownIcons: ownIconsOf(o.ownIcons),
    cooldown: number(o.cooldown, "The cooldown"),
    tiers,
    effects: addedEffects(o.effects),
    getIt: getItOf(o.getIt),
    scripts: scriptsOf(o.scripts),
    lines: linesOf(o.lines),
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

/** A document with one tier's Get it changed; a value equal to the game's (or sell true) is taken out. */
export function withGetIt(doc: QuickhackDoc, tier: string, field: keyof GetIt, value: boolean | number | undefined, game?: number): QuickhackDoc {
  const g: GetIt = { ...doc.getIt?.[tier] };
  if (field === "sell") {
    if (value === false) g.sell = false;
    else delete g.sell;
  } else if (value === undefined || value === game || typeof value !== "number") delete g.components;
  else g.components = Math.max(1, Math.round(value));
  const all = { ...doc.getIt, [tier]: g };
  if (!Object.keys(g).length) delete all[tier];
  return { ...doc, getIt: Object.keys(all).length ? all : undefined };
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

/** A new built effect's starting choices: electric damage, accuracy, or the status effect picked. */
export function newBuiltEffect(kind: BuiltEffect["kind"], applies?: string): BuiltEffect {
  if (kind === "damage") return { kind, damageType: "Electric" };
  if (kind === "stat") return { kind, stat: "accuracy" };
  if (!applies) throw new Error("Pick the status effect the roll applies.");
  return { kind, applies };
}

/** Changes what a built effect is: its damage type, sparks or stat. A new stat clears the old one's values. */
export function withAddedBuild(doc: QuickhackDoc, id: string, change: Partial<Pick<BuiltEffect, "damageType" | "sparks" | "stat">>): QuickhackDoc {
  return mapAdded(doc, id, (e) => {
    if (!e.build) return e;
    const build: BuiltEffect = { ...e.build, ...change };
    if (!build.sparks) delete build.sparks;
    let values = e.values;
    if (change.stat !== undefined && change.stat !== e.build.stat && values) {
      values = Object.fromEntries(
        Object.entries(values)
          .map(([tier, v]) => {
            const { value: _gone, ...rest } = v;
            return [tier, rest] as const;
          })
          .filter(([, v]) => Object.keys(v).length),
      );
    }
    const { values: _old, ...rest } = e;
    return values && Object.keys(values).length ? { ...rest, build, values } : { ...rest, build };
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
