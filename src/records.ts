// TweakDB records as EDGEhack reads them: one record at a time, by path, with LocKeys' texts, kept
// in memory so a quickhack's chain (which shares many records between tiers) is read once. Pure: the
// reader is given a function that fetches a record, so the tests can feed made-up records.
import type { TweakLocKey, TweakRecordFull, TweakValue } from "./types";

/** A record with its flats by name. */
export interface Rec {
  path: string;
  /** The type without the gamedata prefix and _Record suffix: Item, ObjectAction, StatusEffect, ... */
  type: string;
  flats: Map<string, TweakValue>;
}

export type Fetch = (path: string) => Promise<TweakRecordFull>;
/** Texts for LocKeys given as plain strings ("LocKey#123"); undefined where there is none. */
export type FetchText = (key: string) => Promise<string | undefined>;

export class Records {
  private readonly cache = new Map<string, Promise<Rec | undefined>>();
  private readonly texts = new Map<string, Promise<string | undefined>>();

  constructor(
    private readonly fetch: Fetch,
    private readonly fetchText: FetchText = async () => undefined,
  ) {}

  /**
   * A flat's text: a LocKey flat's resolved text, or the text of a LocKey given as a plain string
   * (some UI records hold "LocKey#27962" as a CName). Undefined for none.
   */
  async text(rec: Rec | undefined, name: string): Promise<string | undefined> {
    const own = text(rec, name);
    if (own) return plain(own);
    const v = rec?.flats.get(name);
    const key = isLocKey(v) ? v.key : typeof v === "string" ? v : undefined;
    if (!key || !/^LocKey#[1-9]\d*$/.test(key)) return undefined;
    let p = this.texts.get(key);
    if (!p) {
      p = this.fetchText(key).catch(() => undefined);
      this.texts.set(key, p);
    }
    const t = await p;
    return t ? plain(t) : undefined;
  }

  /** The record at a path, or undefined when there is none. */
  get(path: string | null | undefined): Promise<Rec | undefined> {
    if (!path || typeof path !== "string") return Promise.resolve(undefined);
    let p = this.cache.get(path);
    if (!p) {
      p = this.fetch(path).then(
        (r) => ({ path: r.path ?? path, type: shortType(r.type), flats: new Map(r.flats.map((f) => [f.name, f.value])) }),
        () => undefined,
      );
      this.cache.set(path, p);
    }
    return p;
  }

  /** Every record of a list of paths, in order, leaving out those that are missing. */
  async all(paths: TweakValue | undefined): Promise<Rec[]> {
    const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string") : [];
    const got = await Promise.all(list.map((p) => this.get(p)));
    return got.filter((r): r is Rec => !!r);
  }

  /** How many records were read: for the log. */
  get size(): number {
    return this.cache.size;
  }
}

export function shortType(type: string): string {
  return type.replace(/^gamedata/, "").replace(/_Record$/, "");
}

/** A flat as a string (a path, a CName, an enum name), or undefined when empty or "None". */
export function str(rec: Rec | undefined, name: string): string | undefined {
  const v = rec?.flats.get(name);
  return typeof v === "string" && v !== "" && v !== "None" ? v : undefined;
}

export function num(rec: Rec | undefined, name: string): number | undefined {
  const v = rec?.flats.get(name);
  return typeof v === "number" ? v : undefined;
}

export function bool(rec: Rec | undefined, name: string): boolean {
  return rec?.flats.get(name) === true;
}

/** A list flat's string entries (record paths, tags). */
export function list(rec: Rec | undefined, name: string): string[] {
  const v = rec?.flats.get(name);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];
}

export function isLocKey(v: unknown): v is TweakLocKey {
  return !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as TweakLocKey).key === "string" && "text" in (v as object);
}

/** A LocKey flat's text, or undefined for none (LocKey#0) or no text. A plain LocKey string has no text. */
export function text(rec: Rec | undefined, name: string): string | undefined {
  const v = rec?.flats.get(name);
  if (isLocKey(v)) return v.key !== "LocKey#0" && v.text ? v.text : undefined;
  return undefined;
}

/** The last part of a record path, split into words: BaseStatusEffect.OverheatLevel2 -> "Overheat Level 2". */
export function words(path: string): string {
  const last = path.slice(path.lastIndexOf(".") + 1).replace(/_inline\d+$/, "");
  return last
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Game text with its markup (<Rich ...>, </>) and its written-out line breaks (\n) taken out. */
export function plain(s: string): string {
  return s.replace(/\\n/g, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
