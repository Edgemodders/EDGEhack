// H3b.3: Generate's prompts, and the calls to OpenAI's GPT Image, against a stand-in server.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { cleanWords, PROMPTS, promptFor } from "../src/iconPrompts";
import { editImage, generateImage, listModels } from "../src/imageService";
import { generateLook } from "../src/generate";

interface Seen {
  method: string;
  path: string;
  auth?: string;
  type?: string;
  body: Buffer;
}

/** A stand-in OpenAI: answers each request with `answer`, and records what it saw. */
async function stub(answer: (s: Seen) => { status?: number; json?: unknown; text?: string; wait?: number }): Promise<{ base: string; seen: Seen[]; close: () => Promise<void> }> {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => {
      const s: Seen = { method: req.method ?? "", path: req.url ?? "", auth: req.headers.authorization, type: req.headers["content-type"], body: Buffer.concat(parts) };
      seen.push(s);
      const a = answer(s);
      const send = () => {
        res.writeHead(a.status ?? 200, { "content-type": "application/json" });
        res.end(a.text ?? JSON.stringify(a.json ?? {}));
      };
      if (a.wait) setTimeout(send, a.wait);
      else send();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, seen, close: () => new Promise((r) => server.close(() => r())) };
}

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const image = { json: { data: [{ b64_json: PNG.toString("base64") }] } };

test("every look's prompt holds the words, says no text, and keeps them to one line", () => {
  for (const look of ["item", "wheel", "status"] as const) {
    const p = promptFor(look, "  a skull\n made of   static ");
    assert.ok(p.includes("a skull made of static"), look);
    assert.ok(p.includes("No text"), look);
    assert.ok(!p.includes("{words}"), look);
  }
  assert.ok(promptFor("wheel", "x").includes("pure black background"));
  assert.ok(promptFor("status", "x").includes("silhouette"));
  assert.ok(promptFor("item", "x").includes("gold pins"));
});

test("the Wheel and Status from the Item say to draw the same glyph alone; the Item has no such prompt", () => {
  assert.ok(promptFor("wheel", "a skull", true).includes("same glyph"));
  assert.ok(promptFor("status", "a skull", true).includes("same glyph"));
  assert.equal(promptFor("item", "a skull", true), promptFor("item", "a skull"));
  assert.equal(PROMPTS.item.size, "1024x1536");
  assert.equal(PROMPTS.item.fit, "cover");
  assert.equal(PROMPTS.wheel.black, true);
});

test("no words: no prompt, and at most 300 characters of them", () => {
  assert.throws(() => promptFor("item", "   "), /Say what the icon shows/);
  assert.equal(cleanWords("a".repeat(400)).length, 300);
});

test("the models are the account's GPT Image ones, newest first, mini after", async () => {
  const s = await stub(() => ({ json: { data: [{ id: "gpt-4o" }, { id: "gpt-image-1-mini" }, { id: "gpt-image-1" }, { id: "gpt-image-1.5" }, { id: "dall-e-3" }] } }));
  try {
    assert.deepEqual(await listModels({ key: "sk-test", base: s.base }), ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"]);
    assert.equal(s.seen[0].path, "/v1/models");
    assert.equal(s.seen[0].auth, "Bearer sk-test");
  } finally {
    await s.close();
  }
});

test("Generate posts the model, prompt and size, and gives back the PNG", async () => {
  const s = await stub(() => image);
  try {
    const got = await generateLook("item", "a skull", { key: "sk-test", base: s.base, model: "gpt-image-1" });
    assert.deepEqual(got.png, PNG);
    assert.equal(s.seen[0].path, "/v1/images/generations");
    const body = JSON.parse(s.seen[0].body.toString());
    assert.equal(body.model, "gpt-image-1");
    assert.equal(body.size, "1024x1536");
    assert.equal(body.quality, "medium");
    assert.equal(body.output_format, "png");
    assert.equal(body.prompt, got.prompt);
    assert.ok(body.prompt.includes("a skull"));
  } finally {
    await s.close();
  }
});

test("with the Item's picture, the Wheel is an edit that sends it as the reference", async () => {
  const s = await stub(() => image);
  try {
    const ref = Buffer.from("the item picture");
    const got = await generateLook("wheel", "a skull", { key: "sk-test", base: s.base, model: "gpt-image-1", quality: "high" }, ref);
    assert.equal(s.seen[0].path, "/v1/images/edits");
    assert.match(s.seen[0].type ?? "", /^multipart\/form-data/);
    const form = s.seen[0].body.toString("latin1");
    assert.ok(form.includes("the item picture"));
    assert.ok(form.includes('name="image[]"'));
    assert.ok(form.includes("1024x1024"));
    assert.ok(form.includes("high"));
    assert.ok(got.prompt.includes("same glyph"));
  } finally {
    await s.close();
  }
});

test("the Item with a reference is still drawn from words alone", async () => {
  const s = await stub(() => image);
  try {
    await generateLook("item", "a skull", { key: "sk-test", base: s.base, model: "gpt-image-1" }, Buffer.from("x"));
    assert.equal(s.seen[0].path, "/v1/images/generations");
  } finally {
    await s.close();
  }
});

test("a refused key, a refused prompt and an answer with no image say so in words", async () => {
  const s = await stub((r) =>
    r.auth === "Bearer bad" ? { status: 401, json: { error: { message: "Incorrect API key provided" } } } : r.path.endsWith("edits") ? { json: { data: [] } } : { status: 400, json: { error: { message: "Your request was rejected by the safety system." } } },
  );
  try {
    await assert.rejects(generateImage("gpt-image-1", "p", "1024x1024", { key: "bad", base: s.base }), /OpenAI refused the key: Incorrect API key provided/);
    await assert.rejects(generateImage("gpt-image-1", "p", "1024x1024", { key: "sk-test", base: s.base }), /OpenAI refused the request: Your request was rejected/);
    await assert.rejects(editImage("gpt-image-1", "p", PNG, "1024x1024", { key: "sk-test", base: s.base }), /OpenAI sent no image/);
  } finally {
    await s.close();
  }
});

test("Cancel stops a call that is waiting for its image", async () => {
  const s = await stub(() => ({ ...image, wait: 2000 }));
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 50);
    await assert.rejects(generateImage("gpt-image-1", "p", "1024x1024", { key: "sk-test", base: s.base, signal: c.signal }), /Cancelled/);
  } finally {
    await s.close();
  }
});
