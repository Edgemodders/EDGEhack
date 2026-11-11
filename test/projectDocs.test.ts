import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { render } from "../src/pageHtml";
import { renderEditor } from "../src/editorHtml";
import { newDoc, newHackDoc, printDoc } from "../src/document";
import { docFile, makeNewHackDoc, newHackProblem, projectDocs, projectFilesOf } from "../src/projectDocs";
import { removeTexts, yamlFile } from "../src/projectFiles";
import type { BridgeClient, ProjectRef } from "../src/types";
import { fetchRecord, fetchText } from "./fixture";

function scratchProject(): ProjectRef {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehdocs-"));
  return { name: "test", modName: "My Mod", file: path.join(dir, "test.cpmodproj"), dir, archive: path.join(dir, "source", "archive"), raw: path.join(dir, "source", "raw"), resources: path.join(dir, "source", "resources"), packed: path.join(dir, "packed") };
}
const family = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

test("a project with no folder has no documents", () => {
  assert.deepEqual(projectDocs(scratchProject()), []);
});

test("a new quickhack's document goes in the project and is listed", () => {
  const project = scratchProject();
  const { file, doc } = makeNewHackDoc(project, ["Zap"], "Zap", "  Static Skull ");
  assert.equal(file, docFile(project, "my_mod_static_skull"));
  assert.equal(doc.name, "Static Skull");
  const docs = projectDocs(project);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].doc?.newHack, true);
  assert.equal(docs[0].doc?.family, "Zap");
});

test("a document that cannot be read is listed with why", () => {
  const project = scratchProject();
  fs.mkdirSync(path.join(project.raw, "edgehack"), { recursive: true });
  fs.writeFileSync(path.join(project.raw, "edgehack", "broken.quickhack.json"), "{ not json");
  fs.writeFileSync(path.join(project.raw, "edgehack", "notes.txt"), "not a document");
  const docs = projectDocs(project);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].doc, undefined);
  assert.match(docs[0].error ?? "", /not valid JSON/);
});

test("a new quickhack's name must make a free id, and say why not", () => {
  const project = scratchProject();
  assert.match(newHackProblem(project, ["Zap"], "Zap", "   ") ?? "", /needs a name/);
  assert.match(newHackProblem(project, ["Zap"], "Zap", "!!!") ?? "", /at least one letter/);
  assert.equal(newHackProblem(project, ["Zap"], "Zap", "Static Skull"), undefined);
  makeNewHackDoc(project, ["Zap"], "Zap", "Static Skull");
  // Another spelling of the same id takes the same file.
  assert.match(newHackProblem(project, ["Zap"], "Zap", "static-skull!") ?? "", /already has my_mod_static_skull/);
  assert.throws(() => makeNewHackDoc(project, ["Zap"], "Zap", "Static Skull"), /already has/);
  assert.equal(fs.readdirSync(path.join(project.raw, "edgehack")).length, 1);
});

test("a new quickhack cannot take the file of a change to a game family", () => {
  const project = scratchProject();
  assert.match(newHackProblem(project, ["Zap", "Overheat"], "Zap", "overheat") ?? "", /changes to the game's Overheat/);
  fs.mkdirSync(path.join(project.raw, "edgehack"), { recursive: true });
  const change = newDoc(project.modName, "Zap");
  fs.writeFileSync(docFile(project, change.id), printDoc(change));
  assert.match(newHackProblem(project, ["Zap"], "Zap", "Zap") ?? "", /already has/);
});

test("the game's page offers a new one for people's hacks", async () => {
  const fam = await family();
  assert.match(render(fam, 0, new Map()), /<button data-new>Clone and Modify/);
});

test("a new quickhack's editor says what it is, drops bosses and gives a Console line per tier", async () => {
  const fam = await family();
  const html = renderEditor(fam, newHackDoc("My Mod", "Zap", "Static Skull"), { all: new Map() }, 1);
  assert.match(html, /<main data-start="1" class="edit" data-new-hack>/);
  assert.match(html, /A new quickhack, started from the game's Zap/);
  assert.doesNotMatch(html, /data-field="bossRam"/);
  assert.doesNotMatch(html, /data-field="bossUpload"/);
  assert.match(html, /<h2>Get it<\/h2>/);
  assert.match(html, /data-tier="0"><p class="none">Reading where the game sells it…<\/p><p class="foot">While testing, in REDnode's Console: <code data-give>await game\.player\.addItem\("Items\.EDGEhack_my_mod_static_skull_ZapProgram"\)/);
  assert.match(html, /Items\.EDGEhack_my_mod_static_skull_ZapLvl1Program/);
});

test("a change's editor stays as it was", async () => {
  const fam = await family();
  const html = renderEditor(fam, newDoc("My Mod", "Zap"), { all: new Map() }, 1);
  assert.match(html, /A change to the game's Zap/);
  assert.match(html, /data-field="bossRam"/);
  assert.doesNotMatch(html, /data-new-hack|data-give/);
});

test("Remove from Project names what the document put into the project, and takes its texts out", async () => {
  const project = scratchProject();
  const id = "my_mod_zap";
  const files = [
    docFile(project, id),
    path.join(project.raw, "edgehack", `${id}.icons`, "item.png"),
    yamlFile(project, id),
    path.join(project.raw, "edgehack", "icons", `${id}.png`),
    path.join(project.archive, "edgehack", "icons", `${id}.xbm`),
    path.join(project.archive, "edgehack", "icons", `${id}.inkatlas`),
  ];
  for (const f of files) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, "x");
  }
  // Another document's files are not named.
  fs.writeFileSync(docFile(project, "my_mod_other"), "x");
  const named = projectFilesOf(project, id);
  assert.deepEqual(named, [files[0], path.dirname(files[1]), files[2], files[3], files[4], files[5]]);
  fs.rmSync(files[2]);
  assert.equal(projectFilesOf(project, id).length, 5, "only those that exist");

  const entries = (keys: string[]) => JSON.stringify({ Data: { RootChunk: { root: { Data: { entries: keys.map((k) => ({ secondaryKey: k, femaleVariant: k })) } } } } });
  let written: string | undefined;
  const bridge = {
    locProjectFiles: async () => [{ file: "source/archive/loc.json", exists: true, xl: null }],
    fileToJson: async () => ({ json: entries([`EDGEhack-${id}-Name`, "EDGEhack-my_mod_other-Name", "Other"]) }),
    fromJson: async (_f: string, s: { json: string }) => {
      written = s.json;
      return { file: _f, bytes: 0 };
    },
  } as unknown as BridgeClient;
  assert.equal(await removeTexts(project, bridge, id), true);
  const keys = JSON.parse(written!).Data.RootChunk.root.Data.entries.map((e: { secondaryKey: string }) => e.secondaryKey);
  assert.deepEqual(keys, ["EDGEhack-my_mod_other-Name", "Other"]);
  assert.equal(await removeTexts(project, { ...bridge, fileToJson: async () => ({ json: written }) } as typeof bridge, id), false, "nothing of it left: no write");
});
