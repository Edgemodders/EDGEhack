import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { newDoc, newHackDoc, printDoc } from "../src/document";
import { deskAsset, deskCopy, deskItems, makeDeskNewHack } from "../src/desk";
import { addToLibrary, itemById, itemOfFile, libraryFolders, libraryItems, libraryToProject, LibraryItemExists, newerInLibrary, noteOfDoc, projectFreeId, readLibraryRoot, readNote, safeFolder, savedInLibrary, writeLibraryRoot } from "../src/library";
import type { ProjectRef } from "../src/types";

const scratch = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `ehlib-${name}-`));

function scratchProject(): ProjectRef {
  const dir = scratch("proj");
  fs.writeFileSync(path.join(dir, "test.cpmodproj"), "<CP77Mod><Name>Test</Name><ModName>My Mod</ModName></CP77Mod>");
  return { name: "test", modName: "My Mod", file: path.join(dir, "test.cpmodproj"), dir, archive: path.join(dir, "source", "archive"), raw: path.join(dir, "source", "raw"), resources: path.join(dir, "source", "resources"), packed: path.join(dir, "packed") };
}

/** A Desk quickhack with an own icon beside it. */
function deskHack(desk: string, name = "Static Bloom") {
  const item = makeDeskNewHack(desk, ["Zap"], "Zap", name);
  const icons = path.join(path.dirname(item.file), `${item.doc!.id}.icons`);
  fs.mkdirSync(icons, { recursive: true });
  fs.writeFileSync(path.join(icons, "item.png"), "png");
  return item;
}

test("the root is kept in the shared file, keeping its other fields", () => {
  const dir = scratch("cfg");
  const file = path.join(dir, "EDGE", "library.json");
  assert.equal(readLibraryRoot(file), undefined);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ other: 1 }));
  const root = writeLibraryRoot(path.join(dir, "EDGE Library"), file);
  assert.equal(readLibraryRoot(file), root);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).other, 1);
  assert.ok(fs.existsSync(root));
});

test("folders are the modder's: what goes through .. or names an item is refused", () => {
  assert.equal(safeFolder("Production\\Quickhacks/"), "Production/Quickhacks");
  assert.equal(safeFolder(""), "");
  assert.throws(() => safeFolder("a/../b"), /cannot go through/);
  assert.throws(() => safeFolder("x.quickhack.asset"), /is a Library item/);
});

test("Add to Library copies a Desk quickhack with its icons and asset id; again, only with replace, raising its version", () => {
  const desk = scratch("desk");
  const root = scratch("root");
  const d = deskHack(desk);
  const assetId = deskAsset(d)!.id;
  const { item, replaced } = addToLibrary(root, "Quickhacks/Fire", { file: d.file, doc: d.doc!, assetId, name: "Static Bloom" });
  assert.equal(replaced, false);
  assert.equal(item.rel, "Quickhacks/Fire/static_bloom.quickhack.asset");
  assert.equal(item.asset.id, assetId);
  assert.equal(item.asset.version, 1);
  assert.equal(item.asset.kind, "quickhack");
  assert.equal(item.asset.main, "source/raw/edgehack/static_bloom.quickhack.json");
  assert.ok(fs.existsSync(path.join(path.dirname(item.file), "static_bloom.icons", "item.png")), "its own icon went with it");
  assert.throws(() => addToLibrary(root, "", { file: d.file, doc: d.doc!, assetId }), LibraryItemExists);
  const again = addToLibrary(root, "Elsewhere", { file: d.file, doc: { ...d.doc!, description: "Hotter" }, assetId }, { replace: true });
  assert.equal(again.replaced, true);
  assert.equal(again.item.folder, item.folder, "replaced where it is");
  assert.equal(again.item.asset.version, 2);
  assert.equal(again.item.doc?.description, "Hotter");
  assert.deepEqual(libraryFolders(root), ["Quickhacks", "Quickhacks/Fire"], "no folder made for the replace");
});

test("a project's quickhack goes to the Library with no mod name in its id, and a new item id", () => {
  const root = scratch("root");
  const project = scratchProject();
  const doc = newHackDoc("My Mod", "Zap", "Bolt");
  assert.equal(doc.id, "my_mod_bolt");
  const file = path.join(project.raw, "edgehack", `${doc.id}.quickhack.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, printDoc(doc));
  const { item } = addToLibrary(root, "", { file, doc, modName: "My Mod" });
  assert.equal(item.doc?.id, "bolt");
  assert.match(item.asset.id, /^[0-9a-f]{16}$/);
  assert.equal(projectFreeId(newDoc("My Mod", "Zap"), "My Mod"), "zap");
});

test("libraryItems finds quickhacks in any folder, and passes over other kinds and bakes", () => {
  const desk = scratch("desk");
  const root = scratch("root");
  addToLibrary(root, "A/B", { file: deskHack(desk, "One").file, doc: deskHack(desk, "Two").doc! });
  fs.mkdirSync(path.join(root, "Props", "drum.prop.asset"), { recursive: true });
  fs.writeFileSync(path.join(root, "Props", "drum.prop.asset", "asset.json"), JSON.stringify({ format: 1, id: "x", kind: "prop", main: "a.ent" }));
  fs.mkdirSync(path.join(root, "scene.bake", "inside.quickhack.asset"), { recursive: true });
  const items = libraryItems(root);
  assert.deepEqual(items.map((i) => i.rel), ["A/B/two.quickhack.asset"]);
  assert.equal(itemOfFile(root, items[0].file)?.asset.id, items[0].asset.id);
  assert.equal(itemOfFile(root, path.join(os.tmpdir(), "x.quickhack.json")), undefined);
});

test("a save in the Library raises the item's version and keeps its name the document's", () => {
  const desk = scratch("desk");
  const root = scratch("root");
  const { item } = addToLibrary(root, "", { file: deskHack(desk).file, doc: deskHack(desk, "Other").doc! });
  const saved = savedInLibrary(root, item.file, "Other Renamed");
  assert.equal(saved?.asset.version, 2);
  assert.equal(itemById(root, item.asset.id)?.asset.name, "Other Renamed");
});

test("Add to Project from the Library writes the came-from note, keeps other tools' entries, and asks before replacing", () => {
  const desk = scratch("desk");
  const root = scratch("root");
  const project = scratchProject();
  fs.mkdirSync(path.join(project.dir, "source"), { recursive: true });
  fs.writeFileSync(path.join(project.dir, "source", "library.json"), JSON.stringify({ format: 1, items: [{ kind: "prop", path: "Props/drum.prop.asset", added: "x", by: "edgefab", files: ["a"] }] }));
  const d = deskHack(desk);
  const { item } = addToLibrary(root, "Quickhacks", { file: d.file, doc: d.doc!, assetId: deskAsset(d)!.id });
  const r = libraryToProject(project, item, ["Zap"], root);
  assert.equal(r.added, true);
  assert.equal(path.basename(r.file), "my_mod_static_bloom.quickhack.json");
  assert.ok(fs.existsSync(path.join(path.dirname(r.file), "my_mod_static_bloom.icons", "item.png")));
  const note = readNote(project.dir);
  assert.equal(note.items.length, 2);
  assert.equal(note.items[0].by, "edgefab", "EDGEfab's entry kept");
  const mine = noteOfDoc(project, r.file)!;
  assert.deepEqual({ id: mine.id, kind: mine.kind, path: mine.path, version: mine.version, by: mine.by }, { id: item.asset.id, kind: "quickhack", path: "Quickhacks/static_bloom.quickhack.asset", version: 1, by: "edgehack" });
  assert.deepEqual(mine.files, ["source/raw/edgehack/my_mod_static_bloom.quickhack.json", "source/raw/edgehack/my_mod_static_bloom.icons/item.png"]);
  const again = libraryToProject(project, item, ["Zap"], root);
  assert.equal(again.added, false);
  assert.equal(again.replaces, true);
});

test("Refresh from Library: a project's quickhack is newer in the Library after a save there, and not after taking it again", () => {
  const desk = scratch("desk");
  const root = scratch("root");
  const project = scratchProject();
  const d = deskHack(desk);
  const { item } = addToLibrary(root, "", { file: d.file, doc: d.doc! });
  libraryToProject(project, item, ["Zap"], root);
  assert.deepEqual(newerInLibrary(project, root), []);
  savedInLibrary(root, item.file, undefined);
  const newer = newerInLibrary(project, root);
  assert.equal(newer.length, 1);
  assert.equal(newer[0].item.asset.version, 2);
  libraryToProject(project, newer[0].item, ["Zap"], root, { replace: true });
  assert.deepEqual(newerInLibrary(project, root), []);
});

test("Copy to the Desk keeps the item's asset id, so Add to Library later updates the same item", () => {
  const desk = scratch("desk");
  const desk2 = scratch("desk2");
  const root = scratch("root");
  const d = deskHack(desk);
  const { item } = addToLibrary(root, "", { file: d.file, doc: d.doc! });
  const copy = deskCopy(desk2, { file: item.file, doc: item.doc!, asset: item.asset });
  assert.ok(copy.item);
  assert.equal(deskAsset(copy.item!)!.id, item.asset.id);
  assert.ok(fs.existsSync(path.join(path.dirname(copy.item!.file), "static_bloom.icons", "item.png")));
  assert.ok(deskCopy(desk2, { file: item.file, doc: item.doc!, asset: item.asset }).exists, "asks before replacing the Desk's");
  assert.equal(deskItems(desk2).length, 1);
  assert.throws(() => addToLibrary(root, "", { file: copy.item!.file, doc: copy.item!.doc!, assetId: deskAsset(copy.item!)!.id }), LibraryItemExists);
});
