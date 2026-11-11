import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { HackCore } from "../src/core";
import { newDoc, newHackDoc, withTierField } from "../src/document";
import { bridgeIconWriter, saveDocFiles } from "../src/save";
import type { BridgeClient, ProjectRef, TweakRecordsQuery } from "../src/types";
import { fetchRecord, fetchText, records } from "./fixture";

/** A stand-in REDbridge over the fixture's made-up records, counting its calls. */
function fixtureBridge() {
  const calls: string[] = [];
  const onscreens = JSON.stringify({ Data: { RootChunk: { root: { Data: { entries: [] } } } } });
  const bridge = {
    tweakRecords: async (q: TweakRecordsQuery) => {
      calls.push(`records ${q.type}`);
      const items = records(q.type ?? "", q.flats ?? []).filter((r) => !q.prefix || r.path?.startsWith(q.prefix));
      return { total: items.length, offset: q.offset ?? 0, items: items.slice(q.offset ?? 0) };
    },
    tweakRecord: async (p: string) => {
      calls.push(`record ${p}`);
      return fetchRecord(p);
    },
    locGet: async (keys: string[]) => Object.fromEntries(await Promise.all(keys.map(async (k) => [k, (await fetchText(k)) ? { female: (await fetchText(k))!, male: "" } : null]))),
    locProjectFiles: async () => [{ exists: true, file: "loc.json", xl: null }],
    locNewFile: async () => ({ file: "loc.json", created: false, xl: null, xlWritten: false }),
    fileToJson: async () => ({ json: onscreens }),
    fromJson: async (file: string) => ({ file, bytes: 0 }),
  } as unknown as BridgeClient;
  return { bridge, calls };
}

function scratchProject(): ProjectRef {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehcore-"));
  return { name: "test", modName: "My Mod", file: path.join(dir, "test.cpmodproj"), dir, archive: path.join(dir, "source", "archive"), raw: path.join(dir, "source", "raw"), resources: path.join(dir, "source", "resources"), packed: path.join(dir, "packed") };
}

function core() {
  const { bridge, calls } = fixtureBridge();
  const log: string[] = [];
  let bridgeAsks = 0;
  const c = new HackCore({
    storage: fs.mkdtempSync(path.join(os.tmpdir(), "ehstore-")),
    bridge: async () => {
      bridgeAsks++;
      return bridge;
    },
    log: (l) => log.push(l),
  });
  return { c, calls, log, asks: () => bridgeAsks };
}

test("the core reads the catalog and a family once, and again after refresh, which it announces", async () => {
  const { c, calls, log } = core();
  const fam = await c.family("Zap");
  assert.equal(fam.key, "Zap");
  assert.ok(fam.tiers.length >= 2, `tiers: ${fam.tiers.length}`);
  const reads = calls.length;
  assert.equal(await c.family("Zap"), fam, "the same family, not read again");
  await c.catalog();
  assert.equal(calls.length, reads);
  assert.ok(log.some((l) => l.startsWith("Catalog: ")) && log.some((l) => l.startsWith("Read ")), log.join("\n"));

  let refreshed = 0;
  const stop = c.onRefresh(() => refreshed++);
  c.refresh();
  assert.equal(refreshed, 1);
  assert.notEqual(await c.family("Zap"), fam, "read again after refresh");
  assert.ok(calls.length > reads);
  stop();
  c.refresh();
  assert.equal(refreshed, 1, "a stopped listener hears no more");
});

test("a family the game lacks fails, and is tried again on the next call", async () => {
  const { c, calls } = core();
  await assert.rejects(c.family("Nope"), /No quickhack family Nope/);
  const before = calls.length;
  await assert.rejects(c.family("Nope"));
  assert.equal(calls.length, before, "the catalog is kept; only the family is tried again");
});

test("keyOf finds the family of an item, a tier's action and nothing for another record", async () => {
  const { c } = core();
  assert.equal(await c.keyOf("Items.ZapLvl1Program"), "Zap");
  assert.equal(await c.keyOf("QuickHack.ZapLvl1Hack"), "Zap");
  assert.equal(await c.keyOf("Prereqs.ZapImmune"), undefined);
});

test("saveDocFiles writes a changed quickhack's YAML into the project, through the core's bridge", async () => {
  const { c } = core();
  const project = scratchProject();
  const doc = withTierField(newDoc("My Mod", "Zap"), "Items.ZapProgram", "ram", 5, 3);
  const r = await saveDocFiles(c, project, doc, bridgeIconWriter(await c.bridge(), project));
  assert.ok(r.yaml && fs.existsSync(r.yaml), `yaml: ${r.yaml}`);
  assert.equal(r.fam.key, "Zap");
  assert.equal(r.salesMissing, false);
  assert.match(fs.readFileSync(r.yaml, "utf8"), /QuickHack\.ZapHack\.costs:/);
  assert.deepEqual(r.created, [r.yaml]);
  const again = await saveDocFiles(c, project, doc, bridgeIconWriter(await c.bridge(), project));
  assert.deepEqual(again.created, [], "saving again adds no files");
});

test("saveDocFiles goes on without Get it when where the game sells a new quickhack cannot be read, and says so first", async () => {
  const { c } = core();
  c.sales = async () => {
    throw new Error("REDbridge is not running");
  };
  const project = scratchProject();
  const order: string[] = [];
  const r = await saveDocFiles(c, project, newHackDoc("My Mod", "Zap", "Static Skull"), bridgeIconWriter(await c.bridge(), project), () => order.push("missing"));
  order.push("written");
  assert.deepEqual(order, ["missing", "written"]);
  assert.equal(r.salesMissing, true);
  assert.ok(r.yaml && fs.existsSync(r.yaml));
});

test("bridgeIconWriter imports into the project's folders with the texture setup, and answers full paths", async () => {
  const project = scratchProject();
  const seen: unknown[] = [];
  const bridge = {
    importFile: async (...args: unknown[]) => {
      seen.push(args);
      return { ok: true, written: ["edgehack\\icons\\a.xbm"], texture: { group: "TEXG_Generic_UI" } };
    },
    fromJson: async (file: string, s: { json: string }) => ({ file, bytes: s.json.length }),
  } as unknown as BridgeClient;
  const w = bridgeIconWriter(bridge, project);
  const got = await w.importFile(path.join(project.raw, "edgehack", "icons", "a.png"), { group: "TEXG_Generic_UI" } as never);
  assert.deepEqual(got, { ok: true, written: [path.join(project.archive, "edgehack\\icons\\a.xbm")], texture: { group: "TEXG_Generic_UI" } });
  assert.deepEqual(seen[0], [path.join(project.raw, "edgehack", "icons", "a.png"), project.raw, project.archive, true, undefined, { group: "TEXG_Generic_UI" }]);
});

// The rule since H3.3: nothing a tool needs reaches VS Code. Every file the core is made of, followed
// through its imports, must stay clear of "vscode" and of the extension's own VS Code files.
test("the core reaches no VS Code import", () => {
  const src = path.join(__dirname, "..", "src");
  const roots = ["core.ts", "save.ts", "redbridge.ts", "locate.ts", "project.ts", "types.ts", "tryLive.ts", "desk.ts", "projectDocs.ts"];
  const seen = new Set<string>();
  const bad: string[] = [];
  const walk = (file: string, from: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = fs.readFileSync(path.join(src, file), "utf8");
    for (const m of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm)) {
      const spec = m[1];
      if (spec === "vscode") bad.push(`${file} (from ${from}) imports vscode`);
      else if (spec.startsWith("./")) {
        const next = spec.slice(2).replace(/\.mjs$/, ".mjs") + (spec.endsWith(".mjs") ? "" : ".ts");
        if (fs.existsSync(path.join(src, next))) walk(next, file);
      }
    }
  };
  for (const r of roots) walk(r, r);
  assert.deepEqual(bad, []);
  assert.ok(seen.size > roots.length, `walked ${seen.size} files`);
});
