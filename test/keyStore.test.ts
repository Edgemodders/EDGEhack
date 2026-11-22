// The shared key store's client (src/keyStore.ts, EDGEhack #3, copied from EDGEwave's) against a stand-in REDbridge: JSON-RPC 2.0 over
// stdio with Content-Length framing, keys.get/set/info as REDbridge 0.18.0 answers them, only with --keys.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findBridge, installedRedcodeDirs, KeysBridge, noKeyReason, TooOld } from "../src/keyStore";

/** The stand-in: keys in memory, seeded from argv; "old" answers every keys.* as an unknown method. */
const stub = `
const keys = Object.create(null);
const old = process.argv.includes("old");
const keysOn = process.argv.includes("--keys");
const seed = process.argv.find((a) => a.startsWith("seed="));
if (seed) keys.openai = seed.slice(5);
const used = [];
let buf = Buffer.alloc(0);
const send = (m) => {
  const b = Buffer.from(JSON.stringify(m), "utf8");
  process.stdout.write("Content-Length: " + b.length + "\\r\\n\\r\\n");
  process.stdout.write(b);
};
const info = (s) => ({ service: s, name: s, set: s in keys, source: s in keys ? "file" : null, env: s.toUpperCase() + "_API_KEY", last4: s in keys ? keys[s].slice(-4) : null, unreadable: false, updated: null, usedBy: used });
process.stdin.on("data", (c) => {
  buf = Buffer.concat([buf, c]);
  for (;;) {
    const end = buf.indexOf("\\r\\n\\r\\n");
    if (end < 0) return;
    const n = Number(/Content-Length: (\\d+)/.exec(buf.subarray(0, end).toString())[1]);
    if (buf.length < end + 4 + n) return;
    const m = JSON.parse(buf.subarray(end + 4, end + 4 + n).toString());
    buf = buf.subarray(end + 4 + n);
    const p = m.params || {};
    process.stderr.write("call " + m.method + "\\n");
    if (m.method === "exit") process.exit(3);
    if (old) { send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } }); continue; }
    if (!keysOn) { send({ jsonrpc: "2.0", id: m.id, error: { code: -32000, message: "key methods are off" } }); continue; }
    // A notification first, which the client must skip.
    send({ jsonrpc: "2.0", method: "log", params: { line: "hi" } });
    if (m.method === "keys.get") { if (p.service in keys) used.push({ tool: p.tool, at: "now" }); send({ jsonrpc: "2.0", id: m.id, result: { service: p.service, key: keys[p.service] ?? null, source: p.service in keys ? "file" : null, unreadable: false } }); }
    else if (m.method === "keys.set") { if (/\\s/.test(p.key)) send({ jsonrpc: "2.0", id: m.id, error: { code: -32000, message: "A key is one line of letters, digits and signs, with no spaces" } }); else { keys[p.service] = p.key; send({ jsonrpc: "2.0", id: m.id, result: info(p.service) }); } }
    else if (m.method === "keys.info") send({ jsonrpc: "2.0", id: m.id, result: info(p.service) });
    else send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } });
  }
});
`;

function stubFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ew-keys-"));
  const file = path.join(dir, "bridge.cjs");
  fs.writeFileSync(file, stub);
  return file;
}

test("KeysBridge: get, set and info through a REDbridge started with --keys; the same process for every call", async () => {
  const b = new KeysBridge({ exe: process.execPath, args: [stubFile()] });
  try {
    assert.deepEqual(await b.get("openai", "EDGEhack"), { service: "openai", key: null, source: null, unreadable: false });
    assert.equal((await b.info("openai")).set, false);
    const set = await b.set("openai", "sk_test1234");
    assert.equal(set.set, true);
    assert.equal(set.last4, "1234");
    // Several at once: each answer goes to its own call.
    const [a, c] = await Promise.all([b.get("openai", "EDGEhack"), b.info("elevenlabs")]);
    assert.equal(a.key, "sk_test1234");
    assert.equal(a.source, "file");
    assert.equal(c.set, false);
    await assert.rejects(b.set("openai", "two words"), /no spaces/);
  } finally {
    b.close();
  }
});

test("KeysBridge: an older REDbridge (no keys.*) says it needs 0.18.0; a stopped one rejects; a missing exe says so", async () => {
  const file = stubFile();
  const old = new KeysBridge({ exe: process.execPath, args: [file, "old"] });
  try {
    await assert.rejects(old.get("openai", "x"), (e: Error) => e.message === TooOld);
  } finally {
    old.close();
  }
  const b = new KeysBridge({ exe: process.execPath, args: [file, "seed=sk_abcd"] });
  try {
    assert.equal((await b.get("openai", "x")).key, "sk_abcd");
    // The stand-in exits on this call: the call is answered with the exit, and the next call starts it again.
    await assert.rejects((b as unknown as { call(m: string, p: object): Promise<unknown> }).call("exit", {}), /stopped \(exit code 3\)/);
    assert.equal((await b.get("openai", "x")).key, "sk_abcd");
  } finally {
    b.close();
  }
  const missing = new KeysBridge({ exe: path.join(os.tmpdir(), "no-such-REDbridge.exe") });
  await assert.rejects(missing.get("openai", "x"), /REDbridge (could not start|stopped)/);
  missing.close();
});

test("findBridge: the setting (a file or its folder) first, else inside REDcode, newest first, else on the PATH", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ew-find-"));
  const mk = (...p: string[]) => {
    const f = path.join(root, ...p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, "");
    return f;
  };
  const own = mk("own", "REDbridge.exe");
  const older = mk("ext", "edgemodders.redcode-cyberpunk-0.10.9", "bridge", "REDbridge.exe");
  const newer = mk("ext", "edgemodders.redcode-cyberpunk-0.10.16", "bridge", "REDbridge.exe");
  mk("ext", "edgemodders.edgewave-0.2.0", "bridge", "REDbridge.exe");
  const onPath = mk("bin", "REDbridge.exe");
  const dirs = installedRedcodeDirs(path.join(root, "ext"));
  assert.deepEqual(dirs.map((d) => path.basename(d)), ["edgemodders.redcode-cyberpunk-0.10.16", "edgemodders.redcode-cyberpunk-0.10.9"]);
  assert.equal(findBridge({ configured: own, redcodeDirs: dirs }), own);
  assert.equal(findBridge({ configured: path.dirname(own), redcodeDirs: dirs }), own);
  // A setting that is not REDbridge is not passed over: REDcode would not start another either.
  assert.equal(findBridge({ configured: path.join(root, "nothing"), redcodeDirs: dirs }), undefined);
  assert.equal(findBridge({ redcodeDirs: dirs }), newer);
  assert.equal(findBridge({ redcodeDirs: [], pathEnv: [path.join(root, "none"), path.dirname(onPath)].join(path.delimiter) }), onPath);
  assert.notEqual(older, newer);
  assert.deepEqual(installedRedcodeDirs(path.join(root, "missing")), []);
});

test("noKeyReason: a no, an unanswered question and no key, from REDcode's keys.status", () => {
  assert.equal(noKeyReason(undefined), undefined, "a REDcode without status: ask, as before");
  assert.equal(noKeyReason({ service: "openai", set: false, access: "unasked" }), undefined, "no key set: REDcode's password box asks");
  assert.equal(noKeyReason({ service: "openai", set: true, unreadable: true, access: "unasked" }), undefined, "an unreadable key: asking replaces it");
  assert.match(noKeyReason({ service: "openai", set: true, access: "denied" }) ?? "", /Don't Allow.*Forget Tool Permissions for Keys/);
  assert.match(noKeyReason({ service: "openai", set: false, access: "denied" }) ?? "", /Don't Allow/, "a no stays a no with no key set too");
  assert.match(noKeyReason({ service: "openai", set: true, access: "unasked" }) ?? "", /closed without an answer/, "a key is there but the question was dismissed: no password box over it");
  assert.equal(noKeyReason({ service: "openai", set: true, access: "allowed" }), undefined);
});
