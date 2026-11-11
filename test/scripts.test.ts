// H3c.3: a quickhack's script, its mod's REDnode package, and main.mjs run against a stand-in rednode.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { newDoc, newHackDoc, parseDoc, printDoc, withScripts } from "../src/document";
import { docFile, scriptEntries } from "../src/projectDocs";
import { addFunction, exportsOf, itemsOf, lineOf, mainSource, manifestOf, packageDir, packageId, REDNODE_NEEDED, scriptFileName, writeScriptPackage } from "../src/scripts";
import { renderScripts } from "../src/editorHtml";
import type { ProjectRef } from "../src/types";
import { fetchRecord, fetchText } from "./fixture";

function scratchProject(): ProjectRef {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehscripts-"));
  return { name: "test", modName: "My Mod", file: path.join(dir, "test.cpmodproj"), dir, archive: path.join(dir, "source", "archive"), raw: path.join(dir, "source", "raw"), resources: path.join(dir, "source", "resources"), packed: path.join(dir, "packed") };
}
const family = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

test("the package id is the mod's name in REDnode's letters", () => {
  assert.equal(packageId("EDGEhack_Test1"), "edgehack_test1");
  assert.equal(packageId("My Mod"), "my-mod");
  assert.equal(packageId("  Über!! Hacks "), "ber-hacks");
  assert.equal(packageId("___"), "edgehack-mod");
  assert.match(packageId("x".repeat(100)), /^x{64}$/);
  const project = scratchProject();
  assert.equal(packageDir(project), path.join(project.resources, "red4ext", "plugins", "REDnode", "apps", "my-mod"));
});

test("a script's exports are read from its text", () => {
  assert.deepEqual(exportsOf("export function canUse(t) {}\nexport async function onLand(t) {}"), ["canUse", "onLand"]);
  assert.deepEqual(exportsOf("export const onLand = async () => {};"), ["onLand"]);
  assert.deepEqual(exportsOf("function canUse() {}\n// export function onLand"), []);
  assert.deepEqual(exportsOf("export function canUseIt() {}"), []);
});

test("Add makes the file, then adds the other function, and never changes what is there", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ehscript-")), "pkg", "zap.mjs");
  assert.equal(addFunction(file, "canUse", "Zap"), "created");
  const first = fs.readFileSync(file, "utf8");
  assert.match(first, /Zap's script/);
  assert.deepEqual(exportsOf(first), ["canUse"]);
  fs.writeFileSync(file, first.replace("return true;", "return target.isHuman; // mine"));
  const mine = fs.readFileSync(file, "utf8");
  assert.equal(addFunction(file, "onLand", "Zap"), "added");
  const both = fs.readFileSync(file, "utf8");
  assert.ok(both.startsWith(mine.trimEnd()), "the modder's text is kept as it was");
  assert.deepEqual(exportsOf(both), ["canUse", "onLand"]);
  assert.equal(addFunction(file, "canUse", "Zap"), "there");
  assert.equal(fs.readFileSync(file, "utf8"), both);
  assert.equal(both.split("\n")[lineOf(both, "onLand") ?? -1].startsWith("export async function onLand"), true);
});

test("the items are the family's lowest tier first: the game's for a change, the mod's own for a new quickhack", async () => {
  const fam = await family();
  assert.deepEqual(itemsOf(fam, newDoc("My Mod", "Zap")), ["Items.ZapProgram", "Items.ZapLvl1Program"]);
  const own = itemsOf(fam, newHackDoc("My Mod", "Zap", "Static Skull"));
  assert.equal(own.length, 2);
  assert.ok(own.every((i) => /^Items\.EDGEhack_/.test(i)), own.join(", "));
});

test("a document keeps its script through a save, and a blank disabled text is left out", () => {
  const doc = withScripts(newDoc("My Mod", "Zap"), { file: "zap.mjs", disabledText: "  People   only " });
  const back = parseDoc(printDoc(doc));
  assert.deepEqual(back.scripts, { file: "zap.mjs", disabledText: "People only" });
  assert.deepEqual(withScripts(back, { file: "zap.mjs", disabledText: " " }).scripts, { file: "zap.mjs" });
  assert.equal(withScripts(back, undefined).scripts, undefined);
  assert.throws(() => parseDoc(JSON.stringify({ ...doc, scripts: { file: "../evil.txt" } })), /\.mjs/);
});

test("main.mjs defines each quickhack with the functions its file exports", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehmain-"));
  // A stand-in rednode package that records each define.
  fs.mkdirSync(path.join(dir, "node_modules", "rednode"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules", "rednode", "package.json"), JSON.stringify({ name: "rednode", type: "module", main: "index.js" }));
  fs.writeFileSync(path.join(dir, "node_modules", "rednode", "index.js"), "export const defined = []; export const quickhacks = { async define(items, fns) { defined.push({ items, fns }); return async () => {}; } };");
  fs.writeFileSync(path.join(dir, "a.mjs"), "export function canUse(t) { return t.isHuman; }");
  fs.writeFileSync(path.join(dir, "b.mjs"), "export async function onLand() {}\nexport function canUse() { return false; }");
  fs.writeFileSync(path.join(dir, "c.mjs"), "export const nothing = 1;");
  fs.writeFileSync(
    path.join(dir, "main.mjs"),
    mainSource([
      { name: "A", items: ["Items.A", "Items.ALvl2"], file: "a.mjs", disabledText: "People only" },
      { name: "B", items: ["Items.B"], file: "b.mjs" },
      { name: "C", items: ["Items.C"], file: "c.mjs" },
    ]),
  );
  const warned: string[] = [];
  const warn = console.warn;
  console.warn = (m: string) => void warned.push(m);
  try {
    await import(pathToFileURL(path.join(dir, "main.mjs")).href);
  } finally {
    console.warn = warn;
  }
  const { defined } = (await import(pathToFileURL(path.join(dir, "node_modules", "rednode", "index.js")).href)) as { defined: { items: string[]; fns: Record<string, unknown> }[] };
  assert.equal(defined.length, 2);
  assert.deepEqual(defined[0].items, ["Items.A", "Items.ALvl2"]);
  assert.equal(typeof defined[0].fns.canUse, "function");
  assert.equal(defined[0].fns.onLand, undefined);
  assert.equal(defined[0].fns.disabledText, "People only");
  assert.equal(typeof defined[1].fns.onLand, "function");
  assert.match(warned.join("\n"), /C: its script exports neither/);
});

test("the package is written from the quickhacks with a script, and taken away with the last of them", async () => {
  const project = scratchProject();
  const fam = await family();
  const dir = packageDir(project);
  const doc = withScripts(newDoc("My Mod", "Zap"), { file: scriptFileName(newDoc("My Mod", "Zap")) });
  // Not there yet: left out, and said so.
  let r = writeScriptPackage(project, await scriptEntries(project, async () => fam, { doc, fam }));
  assert.deepEqual(r.missing, [doc.name || fam.name]);
  assert.equal(fs.existsSync(path.join(dir, "main.mjs")), false);
  addFunction(path.join(dir, doc.scripts!.file), "canUse", "Zap");
  r = writeScriptPackage(project, await scriptEntries(project, async () => fam, { doc, fam }));
  assert.equal(r.dir, dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "rednode-app.json"), "utf8")) as { id: string; requires: { rednode: string } };
  assert.deepEqual(manifest, manifestOf("My Mod"));
  assert.equal(manifest.id, "my-mod");
  assert.equal(manifest.requires.rednode, REDNODE_NEEDED);
  assert.match(fs.readFileSync(path.join(dir, "main.mjs"), "utf8"), /Items\.ZapProgram", "Items\.ZapLvl1Program/);
  assert.ok(fs.existsSync(path.join(dir, "quickhacks.d.ts")));
  // Saved documents count too: another quickhack's script stays in main.mjs when this one is saved.
  const other = withScripts(newHackDoc("My Mod", "Zap", "Static Skull"), { file: "static_skull.mjs" });
  fs.mkdirSync(path.dirname(docFile(project, other.id)), { recursive: true });
  fs.writeFileSync(docFile(project, other.id), printDoc(other));
  addFunction(path.join(dir, "static_skull.mjs"), "onLand", "Static Skull");
  writeScriptPackage(project, await scriptEntries(project, async () => fam, { doc, fam }));
  const main = fs.readFileSync(path.join(dir, "main.mjs"), "utf8");
  assert.match(main, /static_skull\.mjs/);
  assert.match(main, /zap\.mjs|my_mod_zap\.mjs/);
  // Leaving the project (Remove from Project), then the last script taken off: EDGEhack's files go, the modder's stay.
  writeScriptPackage(project, await scriptEntries(project, async () => fam, { doc, fam }, other.id));
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "main.mjs"), "utf8"), /static_skull/);
  fs.rmSync(docFile(project, other.id));
  writeScriptPackage(project, await scriptEntries(project, async () => fam, { doc: withScripts(doc, undefined), fam }));
  assert.deepEqual(fs.readdirSync(dir).sort(), [doc.scripts!.file, "static_skull.mjs"].sort());
});

test("a main.mjs EDGEhack did not make is left alone", () => {
  const project = scratchProject();
  const dir = packageDir(project);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "main.mjs"), "// mine");
  fs.writeFileSync(path.join(dir, "x.mjs"), "export function canUse() { return true; }");
  assert.throws(() => writeScriptPackage(project, [{ name: "X", items: ["Items.X"], file: "x.mjs" }]), /not made by EDGEhack/);
  assert.equal(fs.readFileSync(path.join(dir, "main.mjs"), "utf8"), "// mine");
});

test("the Scripts section offers Add or Open per function, and waits for a project on the Desk", () => {
  assert.match(renderScripts({ inProject: false, exists: false, functions: [] }), /add it to a project first/);
  const none = renderScripts({ inProject: true, exists: false, functions: [] });
  assert.match(none, /data-script-add="canUse"/);
  assert.match(none, /data-script-add="onLand"/);
  assert.doesNotMatch(none, /data-script-text/);
  const one = renderScripts({ inProject: true, file: "source/resources/x/zap.mjs", exists: true, functions: ["canUse"], disabledText: "People only" });
  assert.match(one, /data-script-open="canUse"/);
  assert.match(one, /data-script-add="onLand"/);
  assert.match(one, /value="People only"/);
  assert.match(one, /data-script-remove/);
  assert.match(renderScripts({ inProject: true, file: "zap.mjs", exists: false, functions: [] }), /is not there/);
});
