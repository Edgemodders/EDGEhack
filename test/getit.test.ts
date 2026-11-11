// H3.6 Get it: how the game hands out a family's tiers, and a new quickhack's tiers handed out the same way.
// Every vendor, stock line, schematic and prereq here is invented, in the game's shape.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { writeTweaks } from "../src/tweaks";
import { newHackDoc, parseDoc, printDoc, QuickhackDoc, withGetIt } from "../src/document";
import { gateWords, SaleIndex, saleIndexOf, Sales, tierSales, vendorCount } from "../src/getit";
import { renderGetIt } from "../src/editorHtml";
import type { TweakRecord, TweakRecordFull, TweakValue } from "../src/types";
import { fetchRecord, fetchText } from "./fixture";

const rec = (path: string, flats: Record<string, TweakValue>): TweakRecord => ({ id: path, path, type: "", flats });

// The made-up prereqs a stock line's gate names, beside the fixture's records.
const extra = new Map<string, { type: string; flats: Record<string, TweakValue> }>([
  ["Vendors.ZapGate", { type: "gamedataMultiPrereq_Record", flats: { aggregationType: "OR", nestedPrereqs: ["Vendors.ZapGate_inline0", "Vendors.ZapGate_inline1"], prereqClassName: "gameMultiPrereq" } }],
  ["Vendors.ZapGate_inline0", { type: "gamedataStatPrereq_Record", flats: { statType: "Level", comparisonType: "GreaterOrEqual", valueToCheck: 12, prereqClassName: "StatPrereq" } }],
  ["Vendors.ZapGate_inline1", { type: "gamedataIPrereq_Record", flats: { prereqClassName: "RarityOfEquippedCyberdeckPrereq", minimumQuality: 4 } }],
  ["Vendors.CredGate", { type: "gamedataStatPrereq_Record", flats: { statType: "StreetCred", comparisonType: "GreaterOrEqual", valueToCheck: 20, prereqClassName: "StatPrereq" } }],
]);
const fetch = async (path: string): Promise<TweakRecordFull> => {
  const e = extra.get(path);
  if (e) return { id: path, path, type: e.type, flats: Object.entries(e.flats).map(([name, value]) => ({ name, type: "", value })) } as TweakRecordFull;
  return fetchRecord(path);
};
const reader = () => new Records(fetch, fetchText);
const zap = (r: Records) =>
  readFamily(r, "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

// Common is sold as it is by two vendors; Uncommon as a schematic by one of them and a third.
const index: SaleIndex = saleIndexOf(
  [
    rec("Vendors.Netrunner_inline1", { item: "Items.ZapProgram", generationPrereqs: ["Vendors.CredGate"] }),
    rec("Vendors.Netrunner_inline2", { item: "Items.Recipe_ZapLvl1Program", generationPrereqs: ["Vendors.ZapGate"] }),
    rec("Vendors.Unsold_inline0", { item: "Items.Jacket", generationPrereqs: [] }),
  ],
  [
    rec("Vendors.wat_netrunner", { itemStock: ["Vendors.Netrunner_inline1", "Vendors.Netrunner_inline2"] }),
    rec("Vendors.hey_netrunner", { itemStock: ["Vendors.Netrunner_inline1"] }),
    rec("Vendors.kab_techstore", { itemStock: ["Vendors.Netrunner_inline2"] }),
  ],
  [rec("Items.Recipe_ZapLvl1Program", { craftingResult: "Items.Recipe_ZapLvl1Program_inline0" })],
  [rec("Items.Recipe_ZapLvl1Program_inline0", { item: "Items.ZapLvl1Program", amount: 1 })],
);

const salesOf = async (): Promise<{ sales: Sales; fam: Awaited<ReturnType<typeof zap>> }> => {
  const r = reader();
  const fam = await zap(r);
  return { sales: await tierSales(fam, index, r), fam };
};
const block = (yaml: string, path: string): string => yaml.split(`\n${path}:\n`)[1]?.split("\n\n")[0] ?? "";

test("the index knows who sells what, and which schematic crafts which item", () => {
  assert.deepEqual(index.entriesOf.get("Items.ZapProgram"), ["Vendors.Netrunner_inline1"]);
  assert.deepEqual(index.vendorsOf.get("Vendors.Netrunner_inline1"), ["Vendors.wat_netrunner", "Vendors.hey_netrunner"]);
  assert.deepEqual(index.recipesOf.get("Items.ZapLvl1Program"), ["Items.Recipe_ZapLvl1Program"]);
  assert.equal(index.resultOf.get("Items.Recipe_ZapLvl1Program"), "Items.Recipe_ZapLvl1Program_inline0");
});

test("each tier is read: sold as it is, as a schematic, its crafting cost and its gate in words", async () => {
  const { sales } = await salesOf();
  const common = sales.get("Items.ZapProgram")!;
  assert.equal(vendorCount(common.asIs), 2);
  assert.equal(common.recipe, undefined);
  assert.equal(common.gate, "Street Cred 20 or more");
  assert.deepEqual(
    { package: common.crafting?.package, kinds: common.crafting?.kinds, amount: common.crafting?.amount, name: common.crafting?.ingredientName },
    { package: "Items.ZapCraftingPackage", kinds: 1, amount: 5, name: "Zap Components" },
  );
  const uncommon = sales.get("Items.ZapLvl1Program")!;
  assert.equal(uncommon.asIs.length, 0);
  assert.equal(uncommon.recipe?.record, "Items.Recipe_ZapLvl1Program");
  assert.equal(vendorCount(uncommon.recipe!.lines), 2);
  assert.equal(uncommon.gate, undefined);
  assert.equal(uncommon.schematicGate, "V at level 12 or more or a cyberdeck of quality 4 or more");
  assert.equal(uncommon.crafting, undefined);
});

test("a gate it cannot read is named by its record", async () => {
  assert.equal(await gateWords(reader(), ["Items.Jacket"]), "a condition of the game's (Jacket)");
  assert.equal(await gateWords(reader(), []), undefined);
});

test("a new quickhack's tiers are sold the same way: its own stock lines and schematic, each vendor's stock appended once", async () => {
  const { sales, fam } = await salesOf();
  const doc = newHackDoc("My Mod", "Zap", "Static Skull");
  const { yaml, warnings } = writeTweaks(fam, doc, [], sales);
  assert.deepEqual(warnings.filter((w) => /sold|craft|component/i.test(w)), []);
  const id = "my_mod_static_skull";
  assert.equal(block(yaml!, `Vendors.EDGEhack_${id}_ZapProgram`), `  $base: Vendors.Netrunner_inline1\n  item: Items.EDGEhack_${id}_ZapProgram`);
  assert.match(block(yaml!, `Items.Recipe_EDGEhack_${id}_ZapLvl1Program`), new RegExp(`\\$base: Items\\.Recipe_ZapLvl1Program\\n  displayName: LocKey#EDGEhack-${id}-Name\\n  craftingResult: Items\\.Recipe_EDGEhack_${id}_ZapLvl1Program_Result`));
  assert.equal(block(yaml!, `Items.Recipe_EDGEhack_${id}_ZapLvl1Program_Result`), `  $base: Items.Recipe_ZapLvl1Program_inline0\n  item: Items.EDGEhack_${id}_ZapLvl1Program`);
  assert.equal(block(yaml!, `Vendors.EDGEhack_${id}_ZapLvl1Program_Schematic`), `  $base: Vendors.Netrunner_inline2\n  item: Items.Recipe_EDGEhack_${id}_ZapLvl1Program`);
  // One key per vendor, with every line it gets.
  assert.equal((yaml!.match(/^Vendors\.wat_netrunner\.itemStock:$/gm) ?? []).length, 1);
  assert.match(yaml!, new RegExp(`Vendors\\.wat_netrunner\\.itemStock:\\n  - !append-once Vendors\\.EDGEhack_${id}_ZapProgram\\n  - !append-once Vendors\\.EDGEhack_${id}_ZapLvl1Program_Schematic\\n`));
  assert.match(yaml!, new RegExp(`Vendors\\.hey_netrunner\\.itemStock:\\n  - !append-once Vendors\\.EDGEhack_${id}_ZapProgram\\n`));
  assert.match(yaml!, new RegExp(`Vendors\\.kab_techstore\\.itemStock:\\n  - !append-once Vendors\\.EDGEhack_${id}_ZapLvl1Program_Schematic\\n`));
  // The item keeps the family's crafting cost: no package of its own.
  assert.doesNotMatch(block(yaml!, `Items.EDGEhack_${id}_ZapProgram`), /CraftingData/);
});

test("Sell it off leaves a tier out of every vendor's stock", async () => {
  const { sales, fam } = await salesOf();
  const doc = withGetIt(newHackDoc("My Mod", "Zap", "Static Skull"), "Items.ZapProgram", "sell", false);
  const { yaml } = writeTweaks(fam, doc, [], sales);
  assert.doesNotMatch(yaml!, /Vendors\.EDGEhack_my_mod_static_skull_ZapProgram:/);
  assert.doesNotMatch(yaml!, /Vendors\.hey_netrunner\.itemStock/);
  assert.match(yaml!, /Vendors\.EDGEhack_my_mod_static_skull_ZapLvl1Program_Schematic:/);
});

test("changed components give the tier a crafting package of its own, in the item's own record", async () => {
  const { sales, fam } = await salesOf();
  const doc = withGetIt(newHackDoc("My Mod", "Zap", "Static Skull"), "Items.ZapProgram", "components", 2, 5);
  const { yaml, warnings } = writeTweaks(fam, doc, [], sales);
  const p = "EDGEhack.my_mod_static_skull";
  assert.equal(block(yaml!, `${p}.ZapProgram_CraftingElement`), "  $base: Items.ZapCraftingPackage_inline0\n  amount: 2");
  assert.equal(block(yaml!, `${p}.ZapProgram_Crafting`), `  $base: Items.ZapCraftingPackage\n  craftingRecipe:\n    - ${p}.ZapProgram_CraftingElement`);
  assert.match(block(yaml!, "Items.EDGEhack_my_mod_static_skull_ZapProgram"), new RegExp(`  CraftingData: ${p.replace(".", "\\.")}\\.ZapProgram_Crafting`));
  assert.deepEqual(warnings.filter((w) => /component/.test(w)), []);

  // On a tier the game does not craft, a warning and nothing written.
  const other = withGetIt(newHackDoc("My Mod", "Zap", "Static Skull"), "Items.ZapLvl1Program", "components", 3);
  const out = writeTweaks(fam, other, [], sales);
  assert.ok(out.warnings.some((w) => /ZapLvl1Program: the game's tier is not crafted/.test(w)));
  assert.doesNotMatch(out.yaml!, /ZapLvl1Program_Crafting/);
});

test("without the game's sales read, Get it is left out and nothing is said", async () => {
  const r = reader();
  const fam = await zap(r);
  const { yaml, warnings } = writeTweaks(fam, withGetIt(newHackDoc("My Mod", "Zap", "Static Skull"), "Items.ZapProgram", "components", 2, 5), []);
  assert.doesNotMatch(yaml!, /itemStock|Recipe_EDGEhack|_Crafting/);
  assert.deepEqual(warnings.filter((w) => /component|sold/.test(w)), []);
});

test("Get it is kept in the document; the game's own values and sell on are not stored", () => {
  let doc: QuickhackDoc = newHackDoc("My Mod", "Zap", "Static Skull");
  doc = withGetIt(doc, "Items.ZapProgram", "components", 5, 5);
  assert.equal(doc.getIt, undefined);
  doc = withGetIt(doc, "Items.ZapProgram", "components", 2, 5);
  doc = withGetIt(doc, "Items.ZapLvl1Program", "sell", false);
  assert.deepEqual(parseDoc(printDoc(doc)).getIt, { "Items.ZapProgram": { components: 2 }, "Items.ZapLvl1Program": { sell: false } });
  doc = withGetIt(doc, "Items.ZapLvl1Program", "sell", true);
  assert.deepEqual(doc.getIt, { "Items.ZapProgram": { components: 2 } });
  const bad = (getIt: unknown): string => {
    try {
      parseDoc(JSON.stringify({ format: 1, id: "x", family: "Zap", newHack: true, tiers: {}, getIt }));
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  };
  assert.match(bad({ "Items.ZapProgram": { components: 0 } }), /whole number, 1 or more/);
  assert.match(bad({ "Items.ZapProgram": { sell: "no" } }), /true or false/);
});

test("the editor's Get it says how the game's tier is got, with Sell it and the components", async () => {
  const { sales, fam } = await salesOf();
  const html = renderGetIt(fam, withGetIt(newHackDoc("My Mod", "Zap", "Static Skull"), "Items.ZapProgram", "components", 2, 5), sales);
  assert.match(html, /sold as it is by 2 vendors, once Street Cred 20 or more/);
  assert.match(html, /schematic is sold by 2 vendors, once V at level 12 or more or a cyberdeck of quality 4 or more, and buying it teaches V to craft it/);
  assert.match(html, /<input type="checkbox" data-getit-sell data-tier-key="Items\.ZapProgram" checked>/);
  assert.match(html, /data-getit-components data-tier-key="Items\.ZapProgram" data-game="5" placeholder="5" value="2"/);
  assert.match(html, /Zap Components, as the game's \(5\)/);
  assert.match(html, /The game's tier is not crafted/);
  assert.match(html, /await game\.player\.addItem\("Items\.EDGEhack_my_mod_static_skull_ZapLvl1Program"\)/);
});
