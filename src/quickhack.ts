// Names of the game's quickhack records, pure (no VS Code, no REDbridge), so the views and the
// editor agree on what a family and a tier are. Checked against game 2.5's 92 quickhack items
// (docs/design.md, "Tiers, families and variants").
import type { TweakViewNode } from "./types";

/** A quickhack's tier, as the game names its items. */
export interface Tier {
  /** The part of the record name: "", "Lvl0" to "Lvl4", "Lvl4PlusPlus". */
  suffix: string;
  /** The order in a family, 0 for the base item. */
  rank: number;
}

/** The family and tier of a quickhack item path such as Items.OverheatLvl2Program. */
export interface ItemName {
  family: string;
  tier: Tier;
}

const TIER_RANK: Record<string, number> = { "": 0, Lvl0: 0, Lvl1: 1, Lvl2: 2, Lvl3: 3, Lvl4: 4, Lvl4PlusPlus: 5 };

/**
 * Reads a quickhack item's path: `Items.<Family>[Lvl<n>[PlusPlus]]Program`, or with the tier after
 * `Program` as Phantom Liberty's Blackwall Gateway has it (`Items.BlackWallProgramLvl2`). Returns
 * undefined for any other record.
 *
 * @example parseItem("Items.OverheatLvl2Program") // { family: "Overheat", tier: { suffix: "Lvl2", rank: 2 } }
 */
export function parseItem(path: string): ItemName | undefined {
  const m = /^Items\.([A-Za-z]+?)(Lvl[0-4](?:PlusPlus)?)?Program(Lvl[0-4](?:PlusPlus)?)?$/.exec(path);
  if (!m || (m[2] && m[3])) return undefined;
  const suffix = m[2] ?? m[3] ?? "";
  return { family: m[1], tier: { suffix, rank: TIER_RANK[suffix] } };
}

/**
 * The family of a quickhack action's path, with its Boss, Chimera and Spread variants folded in:
 * `QuickHack.[Boss|Chimera]<Family>[Lvl…]Hack[Spread]`.
 *
 * @example actionFamily("QuickHack.BossOverheatLvl2Hack") // "Overheat"
 */
export function actionFamily(path: string): string | undefined {
  const m = /^QuickHack\.(?:Boss|Chimera)?([A-Za-z]+?)(?:Lvl[0-4](?:PlusPlus)?)?Hack(?:Spread)?$/.exec(path);
  return m?.[1];
}

/**
 * The record path or id in whatever edgehack.openQuickhack was given: a string (a record path,
 * an id, or a family key), a REDcode TweakDB view node, { record } or { path }.
 */
export function recordOfArg(arg: unknown): string | undefined {
  if (typeof arg === "string") return arg.trim() || undefined;
  if (arg && typeof arg === "object") {
    const o = arg as TweakViewNode & { record?: unknown; path?: unknown };
    if (o.kind === "record" && o.ref) return o.ref.path ?? o.ref.id;
    if (typeof o.record === "string") return o.record;
    if (typeof o.path === "string") return o.path;
  }
  return undefined;
}
