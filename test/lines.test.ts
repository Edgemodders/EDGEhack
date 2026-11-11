// H3d: feature lines, the modder's own bullets in the item's tooltip.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { readFamily, tierKey } from "../src/read";
import { newDoc, newHackDoc, parseDoc, printDoc, withLines, LINE_MAX } from "../src/document";
import { newItemPath, writeTweaks } from "../src/tweaks";
import { renderLines } from "../src/editorHtml";
import { fetchRecord, fetchText } from "./fixture";

const family = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

/** The YAML block of one key: its line and the indented lines under it. */
function block(yaml: string, key: string): string {
  const lines = yaml.split("\n");
  const at = lines.findIndex((l) => l === `${key}:`);
  if (at < 0) return "";
  const out = [lines[at]];
  for (const l of lines.slice(at + 1)) {
    if (!l.startsWith(" ")) break;
    out.push(l);
  }
  return out.join("\n");
}

test("the tier's first tooltip line is read, to copy", async () => {
  const fam = await family();
  assert.deepEqual(fam.tiers[0].lineBase, { glp: "EquipmentGLP.ZapProgram", ui: "EquipmentGLP.ZapProgram_inline0" });
  assert.deepEqual(fam.tiers[0].lists.onAttach, ["EquipmentGLP.ZapProgram"]);
});

test("feature lines keep through a save, folded to one line and cut to length", () => {
  const doc = withLines(newDoc("My Mod", "Zap"), [{ text: "Burns  the\nwounded" }, { text: "x".repeat(LINE_MAX + 20), from: "Items.ZapLvl1Program" }]);
  const back = parseDoc(printDoc(doc));
  assert.equal(back.lines?.[0].text, "Burns the wounded");
  assert.equal(back.lines?.[1].text.length, LINE_MAX);
  assert.equal(back.lines?.[1].from, "Items.ZapLvl1Program");
  assert.equal(withLines(back, []).lines, undefined);
  assert.throws(() => parseDoc(JSON.stringify({ ...doc, lines: [{ from: "x" }] })), /needs a text/);
});

test("a change to a game quickhack: each line a copy of the family's line, appended from its tier up", async () => {
  const fam = await family();
  const doc = withLines(newDoc("My Mod", "Zap"), [{ text: "Burns the wounded" }, { text: "Spreads on a kill", from: "Items.ZapLvl1Program" }, { text: "   " }]);
  const { yaml } = writeTweaks(fam, doc);
  assert.ok(yaml);
  const prefix = `EDGEhack.${doc.id}`;
  const ui = block(yaml, `${prefix}.Line1_UI`);
  assert.match(ui, /\$base: EquipmentGLP\.ZapProgram_inline0/);
  assert.match(ui, /localizedDescription: "Burns the wounded"/);
  assert.match(block(yaml, `${prefix}.Line1`), /UIData: EDGEhack\.my_mod_zap\.Line1_UI/);
  assert.match(block(yaml, `${prefix}.Line1`), /effectors: \[\]/);
  assert.equal(block(yaml, `${prefix}.Line3_UI`), "", "an empty line writes nothing");
  const common = block(yaml, "Items.ZapProgram.OnAttach");
  assert.match(common, /!append EDGEhack\.my_mod_zap\.Line1\n?$/m);
  assert.doesNotMatch(common, /Line2/);
  const uncommon = block(yaml, "Items.ZapLvl1Program.OnAttach");
  assert.match(uncommon, /Line1/);
  assert.match(uncommon, /Line2/);
});

test("a new quickhack: its own items list the family's lines, then the modder's", async () => {
  const fam = await family();
  const doc = withLines(newHackDoc("My Mod", "Zap", "Static Skull"), [{ text: "Disabled on machines" }]);
  const { yaml } = writeTweaks(fam, doc);
  assert.ok(yaml);
  const item = block(yaml, newItemPath(doc, fam.tiers[0]));
  assert.match(item, /OnAttach:\n\s+- EquipmentGLP\.ZapProgram\n\s+- EDGEhack\.my_mod_static_skull\.Line1/);
  assert.doesNotMatch(yaml, /Items\.ZapProgram\.OnAttach/, "the game's own item is left alone");
});

test("no lines, no change: a document without them writes what it did before", async () => {
  const fam = await family();
  const { yaml } = writeTweaks(fam, newDoc("My Mod", "Zap"));
  assert.equal(yaml, undefined);
});

test("the page lists the game's lines, then the modder's with their tier, and Add a line", async () => {
  const fam = await family();
  const none = renderLines(fam, newDoc("My Mod", "Zap"));
  assert.match(none, /data-line-add/);
  assert.doesNotMatch(none, /data-line-text/);
  const doc = withLines(newDoc("My Mod", "Zap"), [{ text: "Burns the wounded", from: tierKey(fam.tiers[1]) }]);
  const html = renderLines(fam, doc);
  assert.match(html, /value="Burns the wounded"/);
  assert.match(html, new RegExp(`value="${tierKey(fam.tiers[1]).replace(/\./g, "\\.")}" selected`));
  assert.match(html, /data-line-remove="0"/);
});
