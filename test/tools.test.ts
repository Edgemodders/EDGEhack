import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { HackCore } from "../src/core";
import { newDoc, newHackDoc } from "../src/document";
import { applyChanges, findTier } from "../src/edits";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { describeHack, editHack, findHacks, newHack, placeOf, scriptHack, type ToolHost } from "../src/tools";
import { projectAt } from "../src/project";
import { addToLibrary, itemById, readNote } from "../src/library";
import type { BridgeClient, TweakRecordsQuery } from "../src/types";
import { fetchRecord, fetchText, records } from "./fixture";

const family = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);
const noAdded = { added: async () => [] };

test("findTier takes a tier's item, its quality or its place", async () => {
  const fam = await family();
  assert.equal(findTier(fam, "Items.ZapLvl1Program").rank, 1);
  assert.equal(findTier(fam, "uncommon").rank, 1);
  assert.equal(findTier(fam, "0").rank, 0);
  assert.throws(() => findTier(fam, "Mythic"), /Zap has no tier "Mythic"\. Its tiers: 0 Common \(Items\.ZapProgram\), 1 Uncommon/);
});

test("changes apply in order, a value equal to the game's goes back to the game's, and all gives every tier the same difference", async () => {
  const fam = await family();
  const doc = newDoc("My Mod", "Zap");
  const { doc: d, done } = await applyChanges(doc, [{ op: "tier", tier: "Common", field: "ram", value: 5, all: true }, { op: "set", field: "description", value: "Zaps harder." }], { fam, ...noAdded });
  assert.equal(d.tiers["Items.ZapProgram"].ram, 5);
  assert.ok(d.tiers["Items.ZapLvl1Program"]?.ram !== undefined, "the other tier got the same difference");
  assert.equal(d.description, "Zaps harder.");
  assert.equal(done.length, 2);
  const back = await applyChanges(d, [{ op: "tier", tier: "0", field: "ram", value: null }], { fam, ...noAdded });
  assert.equal(back.doc.tiers["Items.ZapProgram"]?.ram, undefined);
});

test("a change that cannot be made says why, in words", async () => {
  const fam = await family();
  const doc = newDoc("My Mod", "Zap");
  const ctx = { fam, ...noAdded };
  await assert.rejects(applyChanges(doc, [{ op: "removeEffect", id: "a7" }], ctx), /no added effect a7/);
  await assert.rejects(applyChanges(doc, [{ op: "getIt", tier: "0", sell: false }], ctx), /Get it is for a new quickhack/);
  await assert.rejects(applyChanges(newHackDoc("My Mod", "Zap", "Bolt"), [{ op: "tier", tier: "0", field: "bossRam", value: 3 }], ctx), /no versions for bosses/);
  await assert.rejects(applyChanges(doc, [{ op: "addEffect" }], ctx), /give one of status/);
  await assert.rejects(applyChanges(doc, [{ op: "tier", tier: "0", field: "ram", value: -1 }], ctx), /0 or more/);
  await assert.rejects(applyChanges(newHackDoc("My Mod", "Zap", "Bolt"), [{ op: "set", field: "name", value: " " }], ctx), /keeps a name/);
});

test("added effects get fresh ids, are switched off a tier, and removed", async () => {
  const fam = await family();
  const ctx = { fam, ...noAdded };
  const { doc, done } = await applyChanges(newDoc("My Mod", "Zap"), [{ op: "addEffect", status: "BaseStatusEffect.Burning" }, { op: "addEffect", build: "damage" }, { op: "effectTier", id: "a1", tier: "1", on: false }, { op: "effectBuild", id: "a2", damageType: "Thermal" }, { op: "effectOn", id: "a1", on: "V" }], ctx);
  assert.deepEqual(done.slice(0, 2), ["added effect a1", "added effect a2"]);
  assert.deepEqual(doc.effects?.[0], { id: "a1", status: "BaseStatusEffect.Burning", off: ["Items.ZapLvl1Program"], on: "V" });
  assert.equal(doc.effects?.[1].build?.damageType, "Thermal");
  await assert.rejects(applyChanges(doc, [{ op: "effectBuild", id: "a1", stat: "armor" }], ctx), /not one EDGEhack builds/);
  const gone = await applyChanges(doc, [{ op: "removeEffect", id: "a1" }, { op: "removeEffect", id: "a2" }], ctx);
  assert.equal(gone.doc.effects, undefined);
});

test("feature lines replace the list, with a tier named any way", async () => {
  const fam = await family();
  const { doc } = await applyChanges(newDoc("My Mod", "Zap"), [{ op: "lines", lines: [{ text: "Arcs to a second target." }, { text: "  ", from: "1" }, { text: "Stuns drones.", from: "Uncommon" }] }], { fam, ...noAdded });
  assert.deepEqual(doc.lines, [{ text: "Arcs to a second target." }, { text: "Stuns drones.", from: "Items.ZapLvl1Program" }]);
});

/** A host over the fixture's records, with a scratch project and Desk. */
function host() {
  const onscreens = JSON.stringify({ Data: { RootChunk: { root: { Data: { entries: [] } } } } });
  const bridge = {
    tweakRecords: async (q: TweakRecordsQuery) => {
      const items = records(q.type ?? "", q.flats ?? []).filter((r) => !q.prefix || r.path?.startsWith(q.prefix));
      return { total: items.length, offset: 0, items: (q.offset ?? 0) > 0 ? [] : items };
    },
    tweakRecord: async (p: string) => fetchRecord(p),
    locGet: async () => ({}),
    locProjectFiles: async () => [{ exists: true, file: "loc.json", xl: null }],
    locNewFile: async () => ({ file: "loc.json", created: false, xl: null, xlWritten: false }),
    fileToJson: async () => ({ json: onscreens }),
    fromJson: async (file: string) => ({ file, bytes: 0 }),
  } as unknown as BridgeClient;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ehtools-"));
  const dir = path.join(root, "Proj");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "Proj.cpmodproj"), "<CP77Mod><Name>Proj</Name><ModName>Proj</ModName></CP77Mod>");
  const core = new HackCore({ storage: path.join(root, "store"), bridge: async () => bridge });
  let withProject = true;
  const lib = path.join(root, "library");
  const h: ToolHost = { core, desk: path.join(root, "desk"), library: () => lib, project: (given) => (given ? projectAt(given) : withProject ? projectAt(dir) : undefined) };
  return { h, dir, root, noProject: () => (withProject = false) };
}

test("hack_new makes a quickhack in the project with its mod files; hack_edit changes it; hack_describe reads it back", async () => {
  const { h, dir } = host();
  const made = await newHack(h, { family: "Zap", name: "Bolt" });
  assert.equal(made.where, "project");
  assert.ok(made.file && fs.existsSync(made.file) && made.file.startsWith(dir));
  const edited = await editHack(h, { file: made.file!, changes: [{ op: "tier", tier: "0", field: "ram", value: 9 }] });
  assert.equal(edited.document.tiers["Items.ZapProgram"].ram, 9);
  assert.ok("yaml" in edited.saved && edited.saved.yaml && fs.existsSync(edited.saved.yaml));
  const d = (await describeHack(h, { file: made.file })) as { where: string; document: { name: string }; family: { tiers: unknown[] } };
  assert.equal(d.where, "project");
  assert.equal(d.document.name, "Bolt");
  assert.equal(d.family.tiers.length, 2);
  await assert.rejects(newHack(h, { family: "Zap", name: "Bolt" }), /already has/);
  await assert.rejects(newHack(h, { family: "Nope", name: "X" }), /No quickhack family Nope/);
  await assert.rejects(newHack(h, { family: "action:DeviceAction.ZapCamera", name: "X" }), /only from one for people/);
});

test("with no project, hack_new goes on the Desk; a script there is refused; Add to Project asks before replacing", async () => {
  const { h, noProject, dir } = host();
  noProject();
  const made = await newHack(h, { family: "Zap", name: "Desk Bolt" });
  assert.equal(made.where, "desk");
  assert.equal(placeOf(h, made.file!).desk, true);
  await assert.rejects(scriptHack(h, { file: made.file!, function: "canUse" }), /lives in a project/);
  await assert.rejects(newHack(h, { desk_file: made.file }), /needs a WolvenKit project/);
  const added = await newHack(h, { desk_file: made.file, project: dir });
  assert.equal(added.added, true);
  const again = await newHack(h, { desk_file: made.file, project: dir });
  assert.equal(again.added, false);
  assert.equal(again.replaces, true);
  assert.equal((await newHack(h, { desk_file: made.file, project: dir, replace: true })).added, true);
});

test("hack_script adds a stub, writes a whole source, and the mod's REDnode package", async () => {
  const { h } = host();
  const made = await newHack(h, { family: "Zap", name: "Script Bolt" });
  const stub = await scriptHack(h, { file: made.file!, function: "canUse" });
  assert.equal(stub.did, "created");
  assert.deepEqual(stub.exports, ["canUse"]);
  const full = await scriptHack(h, { file: made.file!, function: "onLand", source: `${stub.source}\nexport function onLand(target) { target.damage(5); }\n`, disabledText: "Not on drones" });
  assert.equal(full.did, "written");
  assert.deepEqual(full.exports, ["canUse", "onLand"]);
  assert.ok("scripts" in full.saved && full.saved.scripts && fs.existsSync(path.join(full.saved.scripts, "main.mjs")));
  assert.equal(JSON.parse(fs.readFileSync(made.file!, "utf8")).scripts.disabledText, "Not on drones");
  await assert.rejects(scriptHack(h, { file: made.file!, function: "onLand", source: "export const x = 1;\n" }), /must export onLand/);
});

test("hack_find finds the game's and the documents by words; placeOf refuses what is not a document", async () => {
  const { h } = host();
  await newHack(h, { family: "Zap", name: "Find Bolt" });
  const f = await findHacks(h, { query: "zap" });
  assert.ok(f.game.some((g) => g.key === "Zap"));
  const docs = await findHacks(h, { query: "find bolt" });
  assert.equal(docs.documents.length, 1);
  assert.throws(() => placeOf(h, path.join(os.tmpdir(), "x.json")), /not a quickhack document/);
});

test("the server's package has EDGEhack's version", () => {
  const root = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const server = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "packages", "edgehack-mcp", "package.json"), "utf8"));
  assert.equal(server.version, root.version, "raise both together: the release publishes the server with EDGEhack's version");
});

test("the MCP provider src/mcp.ts registers is declared in package.json, or VS Code refuses it", () => {
  const root = path.join(__dirname, "..");
  const id = /registerMcpServerDefinitionProvider!\("([^"]+)"/.exec(fs.readFileSync(path.join(root, "src", "mcp.ts"), "utf8"))?.[1];
  const declared = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).contributes.mcpServerDefinitionProviders ?? [];
  assert.ok(id, "src/mcp.ts names its provider");
  assert.ok(declared.some((p: { id: string }) => p.id === id), `package.json declares ${id}`);
});

test("Library quickhacks: hack_find lists them, hack_edit raises their version, and hack_new takes one into a project with the came-from note", async () => {
  const { h, dir, noProject } = host();
  noProject();
  const made = await newHack(h, { family: "Zap", name: "Kept Bolt" });
  const lib = h.library!()!;
  const { item } = addToLibrary(lib, "Quickhacks", { file: made.file!, doc: placeOf(h, made.file!).doc });
  const found = await findHacks(h, { query: "kept" });
  const row = found.documents.find((d) => d.where === "library") as { name?: string; version?: number; folder?: string } | undefined;
  assert.deepEqual([row?.name, row?.version, row?.folder], ["Kept Bolt", 1, "Quickhacks"]);
  assert.equal(placeOf(h, item.file).library?.asset.id, item.asset.id);
  const edited = await editHack(h, { file: item.file, changes: [{ op: "tier", tier: "0", field: "ram", value: 7 }] });
  assert.equal(edited.where, "library");
  assert.equal(itemById(lib, item.asset.id)?.asset.version, 2);
  await assert.rejects(scriptHack(h, { file: item.file, function: "canUse" }), /lives in a project/);
  const added = await newHack(h, { desk_file: item.file, project: dir });
  assert.equal(added.added, true);
  assert.deepEqual((added as { fromLibrary?: unknown }).fromLibrary, { name: "Kept Bolt", version: 2 });
  const note = readNote(dir).items[0];
  assert.deepEqual([note.by, note.kind, note.id, note.version], ["edgehack", "quickhack", item.asset.id, 2]);
  const again = await newHack(h, { desk_file: item.file, project: dir });
  assert.equal(again.added, false);
});
