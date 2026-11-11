// Get it (H3.6): how the game hands out each tier of a quickhack, so a new quickhack's tier can be got
// the same way. A tier is sold as it is (a VendorItem naming its item), or as a schematic (an
// ItemRecipe whose craftingResult names its item, sold by VendorItems of its own), and crafted from
// its item's CraftingData. Read from the game once (readSaleIndex), then per family (tierSales). Pure
// apart from readSaleIndex, which asks REDbridge, so the tests feed made-up records. No VS Code.
// docs/design.md, "H3.6 Get it: plan" and its spike's results.
import type { BridgeClient, TweakRecord } from "./types";
import { list, num, Records, str, words } from "./records";
import { Family, tierKey } from "./read";

/** One line of a vendor's stock: the VendorItem, the vendors that list it, and its gate (prereq records). */
export interface StockLine {
  entry: string;
  vendors: string[];
  gate: string[];
}

/** What crafting a tier costs: its item's crafting package and, when it asks for one kind of component, that one. */
export interface Crafting {
  package: string;
  /** How many kinds of component it asks for. Only a package of one kind can have its amount changed. */
  kinds: number;
  element?: string;
  ingredient?: string;
  ingredientName?: string;
  amount?: number;
}

export interface TierSale {
  /** Sold as the quickhack itself. */
  asIs: StockLine[];
  /** Sold as a schematic, which teaches V to craft it. */
  recipe?: { record: string; result?: string; lines: StockLine[] };
  crafting?: Crafting;
  /** When vendors offer it as it is, in words: "V at level 15 or more or a cyberdeck of quality 4 or more". */
  gate?: string;
  /** When vendors offer its schematic: often another gate (Ping's Rare: level 15 as it is, 12 as a schematic). */
  schematicGate?: string;
}

/** By tier key (the tier's item). */
export type Sales = Map<string, TierSale>;

export interface SaleIndex {
  /** Item -> the VendorItems that sell it. */
  entriesOf: Map<string, string[]>;
  /** VendorItem -> the vendors whose stock lists it. */
  vendorsOf: Map<string, string[]>;
  /** VendorItem -> its generationPrereqs. */
  gatesOf: Map<string, string[]>;
  /** Crafted item -> the schematics that make it. */
  recipesOf: Map<string, string[]>;
  /** Schematic -> its CraftingResult record. */
  resultOf: Map<string, string>;
}

const strFlat = (r: TweakRecord, name: string): string | undefined => {
  const v = r.flats?.[name];
  return typeof v === "string" && v !== "" && v !== "None" ? v : undefined;
};
const listFlat = (r: TweakRecord, name: string): string[] => {
  const v = r.flats?.[name];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];
};
const push = <K, V>(m: Map<K, V[]>, k: K, v: V): void => {
  const got = m.get(k);
  if (got) {
    if (!got.includes(v)) got.push(v);
  } else m.set(k, [v]);
};

/** The index from the game's records, pure: what the tests feed. */
export function saleIndexOf(vendorItems: TweakRecord[], vendors: TweakRecord[], recipes: TweakRecord[], results: TweakRecord[]): SaleIndex {
  const index: SaleIndex = { entriesOf: new Map(), vendorsOf: new Map(), gatesOf: new Map(), recipesOf: new Map(), resultOf: new Map() };
  for (const v of vendorItems) {
    const item = strFlat(v, "item");
    if (!v.path || !item) continue;
    push(index.entriesOf, item, v.path);
    index.gatesOf.set(v.path, listFlat(v, "generationPrereqs"));
  }
  for (const v of vendors) {
    if (!v.path) continue;
    for (const e of listFlat(v, "itemStock")) push(index.vendorsOf, e, v.path);
  }
  const resultItem = new Map<string, string>();
  for (const r of results) {
    const item = strFlat(r, "item");
    if (r.path && item) resultItem.set(r.path, item);
  }
  for (const r of recipes) {
    const result = strFlat(r, "craftingResult");
    const item = result && resultItem.get(result);
    if (!r.path || !result || !item) continue;
    index.resultOf.set(r.path, result);
    push(index.recipesOf, item, r.path);
  }
  return index;
}

async function every(b: BridgeClient, type: string, flats: string[]): Promise<TweakRecord[]> {
  const out: TweakRecord[] = [];
  for (let offset = 0; ; ) {
    const page = await b.tweakRecords({ type, flats, offset, limit: 20000 });
    out.push(...page.items);
    offset += page.items.length;
    if (!page.items.length || offset >= page.total) return out;
  }
}

/** Reads the index through REDbridge: every stock line, vendor and schematic in the game, once. */
export async function readSaleIndex(b: BridgeClient): Promise<SaleIndex> {
  const [vendorItems, vendors, recipes, results] = await Promise.all([
    every(b, "VendorItem", ["item", "generationPrereqs"]),
    every(b, "Vendor", ["itemStock"]),
    every(b, "ItemRecipe", ["craftingResult"]),
    every(b, "CraftingResult", ["item"]),
  ]);
  return saleIndexOf(vendorItems, vendors, recipes, results);
}

function line(index: SaleIndex, entry: string): StockLine {
  return { entry, vendors: index.vendorsOf.get(entry) ?? [], gate: index.gatesOf.get(entry) ?? [] };
}

const COMPARE: Record<string, string> = { GreaterOrEqual: "or more", Greater: "or more", LessOrEqual: "or less", Less: "or less", Equal: "exactly" };

/** A vendor's gate in words, read from its prereq records. Unknown kinds are named by their record. */
export async function gateWords(r: Records, prereqs: string[], depth = 0): Promise<string | undefined> {
  if (!prereqs.length || depth > 4) return undefined;
  const parts: string[] = [];
  for (const p of prereqs) {
    const rec = await r.get(p);
    if (!rec) continue;
    const cls = str(rec, "prereqClassName") ?? rec.type;
    if (rec.type === "MultiPrereq" || cls === "gameMultiPrereq") {
      const inner: string[] = [];
      for (const n of list(rec, "nestedPrereqs")) {
        const w = await gateWords(r, [n], depth + 1);
        if (w) inner.push(w);
      }
      const joiner = str(rec, "aggregationType") === "OR" ? " or " : " and ";
      if (inner.length) parts.push(inner.join(joiner));
      continue;
    }
    if (rec.type === "StatPrereq" || cls === "StatPrereq") {
      const stat = (str(rec, "statType") ?? "").replace(/^BaseStats\./, "");
      const value = num(rec, "valueToCheck");
      const how = COMPARE[str(rec, "comparisonType") ?? ""] ?? "";
      const n = value === undefined ? "" : `${Math.round(value * 100) / 100}`;
      const said = how === "exactly" ? `exactly ${n}` : `${n} ${how}`.trim();
      if (stat === "Level") parts.push(`V at level ${said}`);
      else if (stat === "StreetCred") parts.push(`Street Cred ${said}`);
      else parts.push(`${words(stat)} ${said}`.trim());
      continue;
    }
    if (cls === "RarityOfEquippedCyberdeckPrereq") {
      const q = num(rec, "minimumQuality");
      parts.push(`a cyberdeck of quality ${q ?? "?"} or more`);
      continue;
    }
    parts.push(`a condition of the game's (${words(rec.path)})`);
  }
  return parts.length ? parts.join(" and ") : undefined;
}

async function craftingOf(r: Records, item: string): Promise<Crafting | undefined> {
  const pkg = str(await r.get(item), "CraftingData");
  if (!pkg) return undefined;
  const elements = list(await r.get(pkg), "craftingRecipe");
  const c: Crafting = { package: pkg, kinds: elements.length };
  if (elements.length === 1) {
    const el = await r.get(elements[0]);
    c.element = elements[0];
    c.ingredient = str(el, "ingredient");
    c.amount = num(el, "amount");
    if (c.ingredient) c.ingredientName = await r.text(await r.get(c.ingredient), "displayName");
  }
  return c;
}

/** How the game hands out each tier of a family. */
export async function tierSales(fam: Family, index: SaleIndex, r: Records): Promise<Sales> {
  const sales: Sales = new Map();
  for (const t of fam.tiers) {
    if (!t.item) continue;
    const sale: TierSale = { asIs: (index.entriesOf.get(t.item) ?? []).map((e) => line(index, e)).filter((l) => l.vendors.length) };
    // The schematic that is sold, when there are several.
    const recipes = index.recipesOf.get(t.item) ?? [];
    for (const rec of recipes) {
      const lines = (index.entriesOf.get(rec) ?? []).map((e) => line(index, e)).filter((l) => l.vendors.length);
      if (lines.length || !sale.recipe) sale.recipe = { record: rec, result: index.resultOf.get(rec), lines };
      if (lines.length) break;
    }
    sale.crafting = await craftingOf(r, t.item);
    const asIsGate = sale.asIs.map((l) => l.gate).find((g) => g.length);
    if (asIsGate) sale.gate = await gateWords(r, asIsGate);
    const schematicGate = sale.recipe?.lines.map((l) => l.gate).find((g) => g.length);
    if (schematicGate) sale.schematicGate = await gateWords(r, schematicGate);
    sales.set(tierKey(t), sale);
  }
  return sales;
}

/** How many different vendors a tier's lines reach. */
export const vendorCount = (lines: StockLine[]): number => new Set(lines.flatMap((l) => l.vendors)).size;
