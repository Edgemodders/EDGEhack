import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  copyName,
  deskChange,
  deskItems,
  deskNewHackProblem,
  deskRoot,
  duplicateDeskItem,
  makeDeskNewHack,
  onDesk,
  projectPlace,
  savedOnDesk,
  writeToProject,
} from "../src/desk";
import { newHackDoc, printDoc } from "../src/document";
import { docFile, projectDocs } from "../src/projectDocs";
import type { ProjectRef } from "../src/types";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { renderEditor, renderGetIt } from "../src/editorHtml";
import { fetchRecord, fetchText } from "./fixture";

const scratch = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "ehdesk-"));
function scratchProject(): ProjectRef {
  const dir = scratch();
  return { name: "test", modName: "My Mod", file: path.join(dir, "test.cpmodproj"), dir, archive: path.join(dir, "source", "archive"), raw: path.join(dir, "source", "raw"), resources: path.join(dir, "source", "resources"), packed: path.join(dir, "packed") };
}
const KEYS = ["Zap", "Overheat"];

test("the Desk is in LOCALAPPDATA, or where EDGEHACK_DESK says", () => {
  assert.equal(deskRoot({ LOCALAPPDATA: "C:\\Users\\v\\AppData\\Local" }), path.join("C:\\Users\\v\\AppData\\Local", "EDGEhack", "desk"));
  assert.equal(deskRoot({ EDGEHACK_DESK: "D:\\scratch\\desk", LOCALAPPDATA: "C:\\x" }), "D:\\scratch\\desk");
});

test("a new quickhack on the Desk is a Library-shaped item, its id from its name alone", () => {
  const root = scratch();
  const item = makeDeskNewHack(root, KEYS, "Zap", "  Static Skull ");
  assert.equal(item.doc?.id, "static_skull");
  assert.equal(item.doc?.newHack, true);
  assert.equal(item.folder, path.join(root, "static_skull.quickhack.asset"));
  assert.equal(item.file, path.join(item.folder, "source", "raw", "edgehack", "static_skull.quickhack.json"));
  const asset = JSON.parse(fs.readFileSync(path.join(item.folder, "asset.json"), "utf8"));
  assert.equal(asset.format, 1);
  assert.equal(asset.kind, "quickhack");
  assert.equal(asset.name, "Static Skull");
  assert.equal(asset.main, "source/raw/edgehack/static_skull.quickhack.json");
  assert.equal(asset.version, 1);
  assert.match(asset.id, /^[0-9a-f]{16}$/);
  assert.ok(onDesk(item.file, root));
  assert.ok(!onDesk(path.join(scratch(), "x.quickhack.json"), root));
});

test("a Desk name must be free and must not take a family change's place", () => {
  const root = scratch();
  assert.match(deskNewHackProblem(root, KEYS, "Zap", " ") ?? "", /needs a name/);
  assert.match(deskNewHackProblem(root, KEYS, "Zap", "!!") ?? "", /at least one letter/);
  assert.match(deskNewHackProblem(root, KEYS, "Zap", "overheat") ?? "", /changes to the game's Overheat/);
  makeDeskNewHack(root, KEYS, "Zap", "Static Skull");
  assert.match(deskNewHackProblem(root, KEYS, "Zap", "static-skull") ?? "", /already has static_skull/);
  assert.throws(() => makeDeskNewHack(root, KEYS, "Zap", "Static Skull"), /already has/);
});

test("the Desk lists newest first, and a broken document with why", () => {
  const root = scratch();
  const a = makeDeskNewHack(root, KEYS, "Zap", "First");
  const b = makeDeskNewHack(root, KEYS, "Zap", "Second");
  fs.utimesSync(a.file, new Date(2026, 0, 1), new Date(2026, 0, 1));
  fs.writeFileSync(path.join(root, "notes.txt"), "not an item");
  const broken = path.join(root, "broken.quickhack.asset", "source", "raw", "edgehack");
  fs.mkdirSync(broken, { recursive: true });
  fs.writeFileSync(path.join(broken, "broken.quickhack.json"), "{ nope");
  const items = deskItems(root);
  assert.equal(items.length, 3);
  assert.equal(items[items.length - 1].file, a.file);
  assert.ok(items.some((i) => i.file === b.file));
  assert.match(items.find((i) => !i.doc)?.error ?? "", /not valid JSON/);
  assert.deepEqual(deskItems(path.join(root, "missing")), []);
});

test("a change to a game family has one place on the Desk", () => {
  const root = scratch();
  const first = deskChange(root, "Overheat");
  assert.equal(first.doc?.id, "overheat");
  assert.equal(first.doc?.newHack, undefined);
  fs.writeFileSync(first.file, printDoc({ ...first.doc!, name: "Hotter" }));
  const again = deskChange(root, "Overheat");
  assert.equal(again.file, first.file);
  assert.equal(again.doc?.name, "Hotter");
  assert.equal(deskItems(root).length, 1);
});

test("a save on the Desk raises the item's version and keeps its name", () => {
  const root = scratch();
  const item = makeDeskNewHack(root, KEYS, "Zap", "Static Skull");
  savedOnDesk(item.file, "Static Skull Mk2", root);
  savedOnDesk(item.file, undefined, root);
  const asset = JSON.parse(fs.readFileSync(path.join(item.folder, "asset.json"), "utf8"));
  assert.equal(asset.version, 3);
  assert.equal(asset.name, "Static Skull Mk2");
});

test("Duplicate copies a new quickhack under a free name; a change is refused", () => {
  const root = scratch();
  const item = makeDeskNewHack(root, KEYS, "Zap", "Static Skull");
  fs.writeFileSync(item.file, printDoc({ ...item.doc!, tiers: { "Items.ZapProgram": { ram: 2 } } }));
  const read = deskItems(root)[0];
  assert.equal(copyName(root, KEYS, read.doc!), "Static Skull copy");
  const copy = duplicateDeskItem(root, KEYS, read, copyName(root, KEYS, read.doc!));
  assert.equal(copy.doc?.id, "static_skull_copy");
  assert.equal(copy.doc?.name, "Static Skull copy");
  assert.deepEqual(copy.doc?.tiers, { "Items.ZapProgram": { ram: 2 } });
  assert.equal(copyName(root, KEYS, read.doc!), "Static Skull copy 2");
  assert.throws(() => duplicateDeskItem(root, KEYS, deskChange(root, "Overheat"), "Again"), /one place on the Desk/);
});

test("Add to Project gives a new quickhack the project's id, and asks before replacing its own", () => {
  const root = scratch();
  const project = scratchProject();
  const item = makeDeskNewHack(root, KEYS, "Zap", "Static Skull");
  const place = projectPlace(project, KEYS, { ...item.doc!, tiers: { "Items.ZapProgram": { ram: 2 } } });
  assert.equal(place.replaces, false);
  assert.equal(place.doc.id, "my_mod_static_skull");
  assert.equal(place.file, docFile(project, "my_mod_static_skull"));
  writeToProject(place);
  const docs = projectDocs(project);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].doc?.id, "my_mod_static_skull");
  assert.deepEqual(docs[0].doc?.tiers, { "Items.ZapProgram": { ram: 2 } });
  // Again: it replaces its own copy, so it says so.
  assert.equal(projectPlace(project, KEYS, item.doc!).replaces, true);
  // Something else at that place is not replaced.
  fs.writeFileSync(place.file, printDoc(newHackDoc("My Mod", "Overheat", "Static Skull")));
  assert.throws(() => projectPlace(project, KEYS, item.doc!), /not this quickhack/);
  // A name a project cannot take is refused in words.
  assert.throws(() => projectPlace(project, KEYS, { ...item.doc!, name: "  " }), /needs a name/);
});

test("Add to Project gives a change the project's id for its family", () => {
  const project = scratchProject();
  const item = deskChange(scratch(), "Overheat");
  const place = projectPlace(project, KEYS, item.doc!);
  assert.equal(place.doc.id, "my_mod_overheat");
  assert.equal(place.replaces, false);
  writeToProject(place);
  assert.equal(projectPlace(project, KEYS, item.doc!).replaces, true);
});

test("on the Desk the page offers Add to Project, and Get it waits with its Console line", async () => {
  const fam = await readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);
  const doc = makeDeskNewHack(scratch(), KEYS, "Zap", "Static Skull").doc!;
  const html = renderEditor(fam, doc, { all: new Map() }, 1, [], undefined, true);
  assert.match(html, /data-desk/);
  assert.match(html, /data-add-to-project/);
  assert.doesNotMatch(html, /data-pack/);
  assert.doesNotMatch(html, /data-give/);
  assert.match(html, /until you add it to a project/);
  assert.doesNotMatch(renderGetIt(fam, doc, undefined, true), /addItem/);
  const inProject = renderEditor(fam, doc, { all: new Map() }, 1);
  assert.match(inProject, /data-pack/);
  assert.doesNotMatch(inProject, /data-desk|data-add-to-project/);
});
