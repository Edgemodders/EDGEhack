// H4.3: Try Live, the mod's YAML as REDnode's editor-channel ops, and the calls, against a stand-in channel.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { newDoc, newHackDoc, withLines, withTierField, withField } from "../src/document";
import { newItemPath, writeTweaks } from "../src/tweaks";
import { EDITOR, LiveOp, stopTrying, tryLive, yamlToOps } from "../src/tryLive";
import { fetchRecord, fetchText } from "./fixture";

const family = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

test("EDGEhack's YAML shapes become ops: records, sets, lists and appends", () => {
  const yaml = [
    "# Made by EDGEhack",
    "EDGEhack.x.Mod:\n  $type: ConstantStatModifier\n  value: -1.5\n  modifierType: Additive\n  statType: BaseStats.Memory\n",
    "EDGEhack.x.Copy:\n  $base: QuickHack.ZapHack\n  costs:\n    - QuickHack.A\n    - EDGEhack.x.Mod\n  instigator: \"\"\n  effectors: []\n",
    "QuickHack.ZapHack.costs:\n  - !append EDGEhack.x.Mod\n  - !append-once EDGEhack.x.Other\n",
    "Items.ZapProgram.displayName: LocKey#EDGEhack-x-Name\n",
    'EDGEhack.x.Line1_UI:\n  $base: EquipmentGLP.ZapProgram_inline0\n  localizedDescription: "Burns: the wounded"\n',
  ].join("\n");
  const ops = yamlToOps(yaml);
  assert.deepEqual(ops, [
    { create: "EDGEhack.x.Mod", type: "gamedataConstantStatModifier_Record" },
    { set: "EDGEhack.x.Mod.value", value: -1.5 },
    { set: "EDGEhack.x.Mod.modifierType", value: "Additive" },
    { set: "EDGEhack.x.Mod.statType", value: "BaseStats.Memory" },
    { clone: "EDGEhack.x.Copy", base: "QuickHack.ZapHack" },
    { set: "EDGEhack.x.Copy.costs", value: ["QuickHack.A", "EDGEhack.x.Mod"] },
    { set: "EDGEhack.x.Copy.instigator", value: "" },
    { set: "EDGEhack.x.Copy.effectors", value: [] },
    { append: "QuickHack.ZapHack.costs", values: ["EDGEhack.x.Mod", "EDGEhack.x.Other"] },
    { set: "Items.ZapProgram.displayName", value: "LocKey#EDGEhack-x-Name" },
    { clone: "EDGEhack.x.Line1_UI", base: "EquipmentGLP.ZapProgram_inline0" },
    { set: "EDGEhack.x.Line1_UI.localizedDescription", value: "Burns: the wounded" },
  ] satisfies LiveOp[]);
  assert.throws(() => yamlToOps("Not yaml at all"), /cannot read line 1/);
});

test("what EDGEhack writes for a change and for a new quickhack reads as ops, every record made before its flats are set", async () => {
  const fam = await family();
  const change = withLines(withField(withTierField(newDoc("My Mod", "Zap"), "Items.ZapProgram", "ram", 9), "name", "Zip"), [{ text: "Burns the wounded" }]);
  const made = withLines(newHackDoc("My Mod", "Zap", "Static Skull"), [{ text: "People only" }]);
  for (const doc of [change, made]) {
    const { yaml } = writeTweaks(fam, doc);
    assert.ok(yaml);
    const ops = yamlToOps(yaml);
    assert.ok(ops.length > 3, `${doc.id}: ${ops.length} ops`);
    const madeRecords = new Set<string>();
    for (const op of ops) {
      if ("clone" in op) madeRecords.add(op.clone);
      if ("create" in op) madeRecords.add(op.create);
      if ("set" in op) {
        const record = op.set.slice(0, op.set.lastIndexOf("."));
        if (record.startsWith("EDGEhack.") || record.startsWith("Items.EDGEhack_") || record.startsWith("QuickHack.EDGEhack_")) assert.ok(madeRecords.has(record), `${record} is made before ${op.set}`);
      }
    }
  }
});

/** A stand-in editor channel: answers each call with `answer`, and records what it saw. */
async function channel(answer: (call: string, body: Record<string, unknown>) => { status?: number; body: Record<string, unknown> }) {
  const seen: { call: string; body: Record<string, unknown>; auth?: string }[] = [];
  const server = http.createServer((req, res) => {
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => {
      const call = (req.url ?? "").replace("/editor/", "");
      const body = JSON.parse(Buffer.concat(parts).toString() || "{}");
      seen.push({ call, body, auth: req.headers.authorization });
      const a = answer(call, body);
      res.writeHead(a.status ?? 200, { "content-type": "application/json" }).end(JSON.stringify(a.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ehlive-")), "editor.json");
  fs.writeFileSync(file, JSON.stringify({ port: (server.address() as AddressInfo).port, token: "tok" }));
  process.env.EDGEHACK_REDNODE_EDITOR = file;
  return { seen, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("Try Live: the last try put back, the ops applied, V's quickhacks refreshed, the item given", async () => {
  const c = await channel((call) => ({ body: call === "tweakdb.reset" ? { ok: true, restored: 0 } : call === "tweakdb.apply" ? { ok: true, applied: 2 } : { ok: true } }));
  try {
    const r = await tryLive([{ set: "A.b", value: 1 }, { set: "A.c", value: 2 }], "Static Skull", "Items.EDGEhack_x_ZapProgram");
    assert.deepEqual(r, { applied: 2, gave: "Items.EDGEhack_x_ZapProgram" });
    assert.deepEqual(c.seen.map((s) => s.call), ["tweakdb.reset", "tweakdb.apply", "quickhacks.refresh", "player.give"]);
    assert.ok(c.seen.every((s) => s.auth === "Bearer tok" && s.body.editor === EDITOR));
    assert.equal(c.seen[1].body.label, "Static Skull");
    assert.equal(c.seen[3].body.item, "Items.EDGEhack_x_ZapProgram");
    assert.equal(await stopTrying(), 0);
  } finally {
    await c.close();
  }
});

test("Try Live says what went wrong: a denied player, a failing change, an old REDnode, no game", async () => {
  let mode = "deny";
  const c = await channel((call) =>
    mode === "deny"
      ? { status: 403, body: { ok: false, reason: "The player denied EDGEhack for this session" } }
      : mode === "fail" && call === "tweakdb.apply"
        ? { status: 422, body: { ok: false, applied: 1, failed: { index: 1, reason: "TweakDB has no flat A.c" } } }
        : mode === "old"
          ? { status: 404, body: { ok: false, reason: "No call /editor/tweakdb.reset" } }
          : { body: { ok: true, restored: 0, applied: 1 } },
  );
  try {
    await assert.rejects(tryLive([{ set: "A.b", value: 1 }], "x"), /denied EDGEhack.*Editor request window/);
    mode = "fail";
    await assert.rejects(tryLive([{ set: "A.b", value: 1 }, { set: "A.c", value: 2 }], "x"), /stopped at change 2 of 2: TweakDB has no flat A\.c/);
    mode = "old";
    await assert.rejects(tryLive([{ set: "A.b", value: 1 }], "x"), /needs REDnode 0\.62\.0 or later/);
  } finally {
    await c.close();
  }
  process.env.EDGEHACK_REDNODE_EDITOR = path.join(os.tmpdir(), "no-such-editor.json");
  await assert.rejects(tryLive([{ set: "A.b", value: 1 }], "x"), /Start the game with REDnode/);
});

test("a new quickhack's item for the tier given is its own", async () => {
  const fam = await family();
  const doc = newHackDoc("My Mod", "Zap", "Static Skull");
  assert.match(newItemPath(doc, fam.tiers[1]), /^Items\.EDGEhack_my_mod_static_skull_/);
});
