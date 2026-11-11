import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { clientOver, RedBridge, rednodeBridge } from "../src/redbridge";

// A stand-in REDbridge, run by Node: Content-Length frames on stdin and stdout, its log on stderr.
const FAKE = `
let buf = Buffer.alloc(0);
const send = (obj) => { const b = JSON.stringify(obj); return "Content-Length: " + Buffer.byteLength(b) + "\\r\\n\\r\\n" + b; };
process.stderr.write("fake bridge up, args " + JSON.stringify(process.argv.slice(2)) + "\\n");
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const end = buf.indexOf("\\r\\n\\r\\n");
    if (end < 0) return;
    const len = Number(/Content-Length: (\\d+)/.exec(buf.subarray(0, end).toString())[1]);
    if (buf.length < end + 4 + len) return;
    const msg = JSON.parse(buf.subarray(end + 4, end + 4 + len).toString());
    buf = buf.subarray(end + 4 + len);
    const { id, method, params } = msg;
    if (method === "fail") process.stdout.write(send({ jsonrpc: "2.0", id, error: { code: -32000, message: "No record Items.Nope" } }));
    else if (method === "split") {
      const whole = Buffer.from(send({ jsonrpc: "2.0", id, result: { text: "Überhitzung — ✓" } }));
      process.stdout.write(whole.subarray(0, 7));
      setTimeout(() => process.stdout.write(whole.subarray(7, whole.length - 3)), 20);
      setTimeout(() => process.stdout.write(whole.subarray(whole.length - 3)), 40);
    } else if (method === "two") process.stdout.write(send({ jsonrpc: "2.0", method: "log", params: {} }) + send({ jsonrpc: "2.0", id, result: "second" }));
    else if (method === "die") process.exit(3);
    else process.stdout.write(send({ jsonrpc: "2.0", id, result: { method, params, env: process.env.DOTNET_ROOT ?? null } }));
  }
});
`;

function fakeBridge(): { bridge: RedBridge; log: string[] } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehbridge-"));
  const script = path.join(dir, "fake.cjs");
  fs.writeFileSync(script, FAKE);
  const log: string[] = [];
  const bridge = new RedBridge({ exe: process.execPath, args: [script], gamePath: "C:\\Games\\Cyberpunk 2077", dotnetRoot: "C:\\dotnet-user", log: (l) => log.push(l) });
  return { bridge, log };
}

test("the bridge starts on the first call, with --game and DOTNET_ROOT, and answers by method", async (t) => {
  const { bridge, log } = fakeBridge();
  t.after(() => bridge.stop());
  assert.equal(bridge.running, false);
  const got = (await bridge.client.tweakRecord("Items.OverheatProgram", true)) as unknown as { method: string; params: unknown; env: string };
  assert.equal(bridge.running, true);
  assert.equal(got.method, "tweakdb.record");
  assert.deepEqual(got.params, { path: "Items.OverheatProgram", resolveLocKeys: true, language: "en-us" });
  assert.equal(got.env, "C:\\dotnet-user");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(log.some((l) => l.includes('fake bridge up, args ["--game","C:\\\\Games\\\\Cyberpunk 2077"]')), log.join("\n"));
});

test("the bridge's error rejects the call with its own message, and the next call still works", async (t) => {
  const { bridge } = fakeBridge();
  t.after(() => bridge.stop());
  await assert.rejects(bridge.call("fail"), /No record Items\.Nope/);
  assert.deepEqual(((await bridge.call("echo", { a: 1 })) as { params: unknown }).params, { a: 1 });
});

test("an answer split across reads, with text beyond ASCII, comes back whole", async (t) => {
  const { bridge } = fakeBridge();
  t.after(() => bridge.stop());
  assert.deepEqual(await bridge.call("split"), { text: "Überhitzung — ✓" });
});

test("two frames in one read: a notification is skipped and the answer found", async (t) => {
  const { bridge } = fakeBridge();
  t.after(() => bridge.stop());
  assert.equal(await bridge.call("two"), "second");
});

test("calls at once each get their own answer", async (t) => {
  const { bridge } = fakeBridge();
  t.after(() => bridge.stop());
  const answers = await Promise.all([1, 2, 3, 4, 5].map((n) => bridge.call("echo", { n })));
  assert.deepEqual(answers.map((a) => (a as { params: { n: number } }).params.n), [1, 2, 3, 4, 5]);
});

test("a bridge that ends fails its waiting call, and the next call starts it again", async (t) => {
  const { bridge } = fakeBridge();
  t.after(() => bridge.stop());
  await assert.rejects(bridge.call("die"), /REDbridge ended \(code 3\)/);
  assert.equal(bridge.running, false);
  assert.equal(((await bridge.call("echo")) as { method: string }).method, "echo");
});

test("a REDbridge.exe that is not there gives a message naming it", async () => {
  const bridge = new RedBridge({ exe: path.join(os.tmpdir(), "no-such-folder", "REDbridge.exe") });
  await assert.rejects(bridge.call("bridge.info"), /REDbridge could not start .*no-such-folder/);
});

test("the client's methods send REDcode's parameters", async () => {
  const calls: [string, Record<string, unknown>][] = [];
  const c = clientOver(async (m, p) => {
    calls.push([m, p]);
    return { ok: true, written: [] };
  });
  await c.locGet(["LocKey#1"]);
  await c.importFile("a.png", "raw", "archive", true, undefined, { group: "TEXG_Generic_UI" });
  await c.pack("archive", "packed", "My Mod");
  await c.toJson("base\\x.inkatlas");
  assert.deepEqual(calls, [
    ["loc.get", { keys: ["LocKey#1"], language: "en-us", projectDir: null }],
    ["project.import", { file: "a.png", rawDir: "raw", archiveDir: "archive", keep: true, template: null, texture: { group: "TEXG_Generic_UI" } }],
    ["project.pack", { dir: "archive", outDir: "packed", modName: "My Mod" }],
    ["cr2w.toJson", { path: "base\\x.inkatlas" }],
  ]);
});

test("REDnode's shared bridge: none without both variables; calls carry the token; errors come back", async (t) => {
  assert.equal(rednodeBridge({}), undefined);
  assert.equal(rednodeBridge({ REDNODE_BRIDGE_URL: "http://127.0.0.1:1/bridge" }), undefined);
  const seen: { auth?: string; body: unknown }[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      seen.push({ auth: req.headers.authorization, body: parsed });
      res.writeHead(200, { "content-type": "application/json" });
      res.write("   "); // REDnode's spaces while a long call runs
      res.end(JSON.stringify(parsed.method === "tweakdb.record" ? { error: "No record Items.Nope" } : { result: { total: 0, offset: 0, items: [] } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const port = (server.address() as { port: number }).port;
  const c = rednodeBridge({ REDNODE_BRIDGE_URL: `http://127.0.0.1:${port}/bridge`, REDNODE_BRIDGE_TOKEN: "t0k" })!;
  assert.deepEqual(await c.tweakRecords({ type: "UIIcon" }), { total: 0, offset: 0, items: [] });
  await assert.rejects(c.tweakRecord("Items.Nope"), /No record Items\.Nope/);
  assert.equal(seen[0].auth, "Bearer t0k");
  assert.deepEqual(seen[0].body, { method: "tweakdb.records", params: { type: "UIIcon" } });
});
