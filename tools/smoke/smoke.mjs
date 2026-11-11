// EDGEhack's smoke test: VS Code, the built extension and the real REDbridge on the real game, with a
// stand-in REDcode (tools/smoke/stub) holding a scratch project. It opens a quickhack, then edits it,
// and drives the pages over the DevTools protocol, the way a modder would: images must really load,
// inputs must change the document, undo must work, and a save must write the mod's files. It writes only
// in its scratch folder, and only reads the game.
//
//   npm run build && npm run smoke
//
// Environment: EH_BRIDGE (REDbridge.exe, default %LOCALAPPDATA%\REDnode\bridge\REDbridge.exe), EH_GAME
// (the game folder), EH_CODE (Code.exe, default the per-user install).
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as zlib from "node:zlib";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const T = path.join(os.tmpdir(), "ehsmoke");
const local = process.env.LOCALAPPDATA ?? "";
const BRIDGE = process.env.EH_BRIDGE ?? path.join(local, "REDnode", "bridge", "REDbridge.exe");
const GAME = process.env.EH_GAME ?? "E:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077";
// A VS Code of its own when one is cached (EDGEwave smoke test), so it stays apart from the one in use.
const cached = path.join(os.tmpdir(), "ewsmoke", "vsc");
const cachedCode = fs.existsSync(cached) ? fs.readdirSync(cached).map((d) => path.join(cached, d, "Code.exe")).find((f) => fs.existsSync(f)) : undefined;
const CODE = process.env.EH_CODE ?? cachedCode ?? path.join(local, "Programs", "Microsoft VS Code", "Code.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[smoke]", ...a);

for (const f of ["ud", "proj", "desk", "keys", "control.json", "done.json", "packed.json", "opened.json", "loc.json"]) fs.rmSync(path.join(T, f), { recursive: true, force: true });
fs.mkdirSync(path.join(T, "proj", "source", "raw"), { recursive: true });
fs.mkdirSync(path.join(T, "ud", "User"), { recursive: true });
fs.cpSync(path.join(here, "stub"), path.join(T, "stub"), { recursive: true });
fs.writeFileSync(path.join(T, "ud", "User", "settings.json"), JSON.stringify({ "window.dialogStyle": "custom", "security.workspace.trust.enabled": false }));
for (const f of [BRIDGE, CODE]) if (!fs.existsSync(f)) throw new Error(`Not found: ${f}`);

// A stand-in OpenAI for Generate (H3b.3): every image is a white square on black, 1024 x 1024. The
// key comes from OPENAI_API_KEY, which wins over the shared store, and the store is a scratch folder.
const openaiSeen = [];
function squarePng(n) {
  const rows = [];
  for (let y = 0; y < n; y++) {
    const row = Buffer.alloc(1 + n * 3);
    for (let x = 0; x < n; x++) if (x > n * 0.3 && x < n * 0.7 && y > n * 0.3 && y < n * 0.7) row.fill(255, 1 + x * 3, 4 + x * 3);
    rows.push(row);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(n, 0);
  head.writeUInt32BE(n, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}
const SQUARE = squarePng(1024);
const openai = http.createServer((req, res) => {
  const parts = [];
  req.on("data", (c) => parts.push(c));
  req.on("end", () => {
    const body = Buffer.concat(parts);
    openaiSeen.push({ path: req.url, auth: req.headers.authorization, body });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url === "/v1/models" ? { data: [{ id: "gpt-image-1" }, { id: "gpt-4o" }] } : { data: [{ b64_json: SQUARE.toString("base64") }] }));
  });
});
await new Promise((r) => openai.listen(0, "127.0.0.1", r));

const env = {
  ...process.env,
  EH_SMOKE: T,
  EH_BRIDGE: BRIDGE,
  EH_GAME: GAME,
  EDGEHACK_DESK: path.join(T, "desk"),
  EDGEHACK_OPENAI_BASE: `http://127.0.0.1:${openai.address().port}`,
  OPENAI_API_KEY: "sk-smoke-test",
  EDGEMODDERS_KEYS_DIR: path.join(T, "keys"),
};
// Started from a VS Code terminal, these would attach it to that VS Code, or run it as Node.
for (const k of Object.keys(env)) if (/^(VSCODE_|ELECTRON_)/.test(k)) delete env[k];
const code = spawn(CODE, ["--new-window", "--user-data-dir", path.join(T, "ud"), "--extensions-dir", path.join(T, "ex"), "--disable-extensions", "--extensionDevelopmentPath", repo, "--extensionDevelopmentPath", path.join(T, "stub"), "--remote-debugging-port=9347", "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust", path.join(T, "proj")], { env, stdio: "ignore" });

let failed = 0;
const check = (ok, what) => {
  log(ok ? "ok  " : "FAIL", what);
  if (!ok) failed++;
};
const finish = (msg) => {
  log(failed ? `FAILED: ${failed} check(s)` : "PASS", msg ?? "");
  code.kill();
  openai.close();
  process.exit(failed ? 1 : 0);
};
setTimeout(() => {
  failed++;
  finish("timed out");
}, 240000);

// ---- DevTools: every frame's execution context, the webviews' among them
let ws;
let nextId = 1;
const waiting = new Map();
const contexts = [];
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const pages = await (await fetch("http://127.0.0.1:9347/json")).json();
    const page = pages.find((p) => p.type === "page" && p.url.includes("workbench"));
    if (page) {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((r) => ws.addEventListener("open", r));
    }
  } catch {}
  if (!ws) await sleep(1000);
}
if (!ws) {
  failed++;
  finish("no DevTools target");
}
const cdp = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    const w = waiting.get(m.id);
    waiting.delete(m.id);
    m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
    return;
  }
  if (m.method === "Runtime.executionContextCreated") contexts.push({ id: m.params.context.id, origin: m.params.context.origin, sessionId: m.sessionId });
  if (m.method === "Target.attachedToTarget") {
    const s = m.params.sessionId;
    cdp("Runtime.enable", {}, s).catch(() => {});
    cdp("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, s).catch(() => {});
    cdp("Runtime.runIfWaitingForDebugger", {}, s).catch(() => {});
  }
});
await cdp("Runtime.enable");
await cdp("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });

const evalIn = async (c, expression) => {
  const r = await cdp("Runtime.evaluate", { expression, contextId: c.id, awaitPromise: true, returnByValue: true }, c.sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
/** The webview whose document matches a test, waiting for it. */
async function pageWith(test, what, seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    for (const c of contexts.filter((c) => c.origin.startsWith("vscode-webview"))) {
      try {
        if (await evalIn(c, test)) return c;
      } catch {}
    }
    await sleep(1000);
  }
  failed++;
  finish(`${what} never appeared`);
}
const run = (page, js) => evalIn(page, `(async () => { ${js} })()`);

/** Runs a step in the stand-in REDcode, and waits for it. */
async function step(s) {
  fs.rmSync(path.join(T, "done.json"), { force: true });
  fs.writeFileSync(path.join(T, "control.json"), JSON.stringify(s));
  for (let i = 0; i < 300; i++) {
    if (fs.existsSync(path.join(T, "done.json"))) {
      await sleep(100);
      return JSON.parse(fs.readFileSync(path.join(T, "done.json"), "utf8"));
    }
    await sleep(200);
  }
  throw new Error(`No answer to ${JSON.stringify(s)}`);
}
const images = (page) => run(page, `const all = [...document.images]; await Promise.all(all.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); return { total: all.length, broken: all.filter((i) => !i.naturalWidth).map((i) => i.src.slice(-40)) };`);
// A screenshot of a window in the background can wait for a frame that never comes (seen on 2026-11-09):
// bring it forward first, and give up on the picture, not the run, after 15 s.
const shot = async (name) => {
  await cdp("Page.bringToFront").catch(() => {});
  const s = await Promise.race([cdp("Page.captureScreenshot", { format: "png" }), sleep(15000).then(() => null)]);
  if (!s?.data) {
    log("screenshot skipped (no frame in 15 s):", name);
    return;
  }
  fs.writeFileSync(path.join(T, name), Buffer.from(s.data, "base64"));
  log("screenshot", path.join(T, name));
};
const setInput = (page, selector, value) => run(page, `const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("change", { bubbles: true })); return el.className;`);

// ---- the read-only page
await sleep(4000);
log((await step({ command: "edgehack.openQuickhack", args: ["Items.OverheatLvl2Program"] })).error ?? "opened Overheat");
const read = await pageWith("!!document.querySelector('[data-edit]')", "the read-only page", 90);
let im = await images(read);
check(im.total >= 3 && im.broken.length === 0, `read-only page: ${im.total} images, broken ${JSON.stringify(im.broken)}`);
const numbers = await run(read, `return [...document.querySelectorAll("table.numbers tbody tr")].map((r) => r.innerText.replace(/\\s+/g, " ").slice(0, 110));`);
log(numbers.join("\n       "));
check(/Duration 5 s/.test(numbers.join("|")), "Duration reads 5 s, as the game's tooltip");
check(/a second/.test(numbers.join("|")), "Damage is given a second");
check(await run(read, `return document.querySelector('[data-tier="2"].on') !== null;`), "Rare is the selected tier");
await run(read, `document.querySelector("a.rec").click();`);
await sleep(500);
check(fs.existsSync(path.join(T, "opened.json")), "a record link asks REDcode to open it");
await shot("read.png");

// ---- Edit makes the document and opens the editor
await run(read, `document.querySelector("[data-edit]").click();`);
const editor = await pageWith("!!document.querySelector('main.edit')", "the editor");
const docFile = path.join(T, "proj", "source", "raw", "edgehack", "smokemod_overheat.quickhack.json");
check(fs.existsSync(docFile), "Edit made the document in the project's source/raw/edgehack");
const docOf = () => JSON.parse(fs.readFileSync(docFile, "utf8"));
im = await images(editor);
check(im.total >= 3 && im.broken.length === 0, `editor: ${im.total} images, broken ${JSON.stringify(im.broken)}`);
const yamlFile = path.join(T, "proj", "source", "resources", "r6", "tweaks", "smokemod", "smokemod_overheat.yaml");
check(!fs.existsSync(yamlFile), "no YAML before anything is changed");

// Numbers and texts.
const RAM = '[data-tier-key="Items.OverheatLvl2Program"][data-field="ram"]';
check((await run(editor, `return document.querySelector(${JSON.stringify(RAM)}).placeholder;`)) === "6", "the field shows the game's RAM, 6");
const cls = await setInput(editor, RAM, "8");
check(/changed/.test(cls), "a changed number is marked");
await setInput(editor, '[data-tier-key="Items.OverheatLvl4Program"][data-field="ram"]', "6");
await setInput(editor, "[data-set=name]", "Smoke Heat");
await sleep(500);
check((await run(editor, `return document.querySelector("[data-title]").textContent;`)) === "Smoke Heat", "the page's title follows the name");
await step({ command: "workbench.action.files.save" });
await sleep(1500);
check(fs.existsSync(yamlFile), "a save wrote the YAML");
let yaml = fs.existsSync(yamlFile) ? fs.readFileSync(yamlFile, "utf8") : "";
check(/QuickHack\.OverheatLvl2Hack\.costs:\n {2}- !append EDGEhack\.smokemod_overheat\.OverheatLvl2Program_Ram/.test(yaml), "the YAML appends Rare's RAM");
check(/value: -3/.test(yaml), "Legendary's RAM is a negative difference");
check(/Items\.OverheatLvl2Program\.displayName: LocKey#EDGEhack-smokemod_overheat-Name/.test(yaml), "the YAML names the text by its key");
check(!/\r/.test(yaml) && yaml.startsWith("# Made by EDGEhack"), "the YAML says who made it");
await step({ dumpLoc: true });
const loc = JSON.parse(fs.readFileSync(path.join(T, "loc.json"), "utf8"));
const entries = loc ? JSON.parse(loc).Data.RootChunk.root.Data.entries : [];
check(entries.some((e) => e.secondaryKey === "EDGEhack-smokemod_overheat-Name" && e.femaleVariant === "Smoke Heat"), "the onscreens file holds the name");
const xls = fs.readdirSync(path.join(T, "proj", "source", "resources")).filter((f) => f.endsWith(".xl"));
check(xls.length === 1, `the .xl was written: ${xls}`);
log("status:", await run(editor, `return document.querySelector("[data-status]").textContent;`));

// Undo reaches the page, through the document.
await setInput(editor, '[data-tier-key="Items.OverheatLvl3Program"][data-field="ram"]', "20");
await sleep(400);
await run(editor, `document.activeElement && document.activeElement.blur();`);
await step({ command: "undo" });
await sleep(600);
check((await run(editor, `return document.querySelector('[data-tier-key="Items.OverheatLvl3Program"][data-field="ram"]').value;`)) === "", "undo clears the field");
await step({ command: "redo" });
await sleep(600);
check((await run(editor, `return document.querySelector('[data-tier-key="Items.OverheatLvl3Program"][data-field="ram"]').value;`)) === "20", "redo puts it back");
await setInput(editor, '[data-tier-key="Items.OverheatLvl3Program"][data-field="ram"]', "");

// All tiers: the selected tier's change on every tier. Rare is 8, the game's 6: +2.
await run(editor, `document.querySelector('th button[data-pick="2"]').click(); document.querySelector('[data-apply-all="ram"]').click();`);
await sleep(800);
const ramValues = await run(editor, `return [...document.querySelectorAll('[data-field="ram"]')].map((i) => i.value);`);
check(JSON.stringify(ramValues) === JSON.stringify(["5", "6", "8", "9", "11", "11"]), `All tiers adds Rare's +2 to each: ${ramValues}`);

// Icons.
await run(editor, `document.querySelector('[data-icon="wheel"]').click();`);
for (let i = 0; i < 60; i++) {
  if (await run(editor, `return !document.querySelector("[data-picker]").hidden;`)) break;
  await sleep(500);
}
const grid = await images(editor);
const choices = await run(editor, `return document.querySelectorAll("[data-choice]").length;`);
check(choices > 10 && grid.broken.length === 0, `the wheel's picker: ${choices} choices, broken ${JSON.stringify(grid.broken.slice(0, 3))}`);
await shot("picker.png");
const before = await run(editor, `return document.querySelector('[data-icon-figure="wheel"] img').src;`);
await run(editor, `document.querySelector('[data-choice="UIIcon.OverLoad"]').click();`);
await sleep(800);
check((await run(editor, `return document.querySelector('[data-icon-figure="wheel"] img').src;`)) !== before, "the chosen icon shows");
await step({ command: "workbench.action.files.save" });
await sleep(1200);
check(docOf().wheelIcon === "UIIcon.OverLoad", "the document holds the wheel's icon");
yaml = fs.readFileSync(yamlFile, "utf8");
check(/ChoiceCaptionParts\.OverheatIcon\.texturePartID: UIIcon\.OverLoad/.test(yaml), "the YAML sets the wheel's icon");

// Own icons (H3b.2): Upload on the wheel, fitted to 64 x 64 with black made see-through, then a save
// writes the texture (imported with the UI setup), the atlas and the UIIcon record.
check((await run(editor, `return !!document.querySelector('[data-icon-figure="status"] [data-icon-upload="status"]') && !document.querySelector('[data-icon-figure="status"] [data-icon]');`)) === true, "Status has Upload and no game picker");
await run(
  editor,
  `const c = document.createElement("canvas"); c.width = 200; c.height = 100; const g = c.getContext("2d");
   g.fillStyle = "#000"; g.fillRect(0, 0, 200, 100); g.fillStyle = "#fff"; g.fillRect(80, 30, 40, 40);
   const blob = await new Promise((r) => c.toBlob(r, "image/png"));
   document.querySelector('[data-icon-black="wheel"]').checked = true;
   document.querySelector('[data-icon-upload="wheel"]').click();
   const input = document.querySelector("[data-icon-file]");
   const dt = new DataTransfer(); dt.items.add(new File([blob], "wheel.png", { type: "image/png" }));
   input.files = dt.files; input.dispatchEvent(new Event("change"));`,
);
const ownWheel = path.join(T, "proj", "source", "raw", "edgehack", "smokemod_overheat.icons", "wheel.png");
for (let i = 0; i < 30 && !fs.existsSync(ownWheel); i++) await sleep(200);
check(fs.existsSync(ownWheel), "Upload kept the picture beside the document");
if (fs.existsSync(ownWheel)) {
  const png = fs.readFileSync(ownWheel);
  check(png.readUInt32BE(16) === 64 && png.readUInt32BE(20) === 64, `the picture is fitted to 64 x 64: ${png.readUInt32BE(16)} x ${png.readUInt32BE(20)}`);
}
await sleep(600);
check((await run(editor, `return document.querySelector('[data-icon-figure="wheel"] img').src.startsWith("data:image/png");`)) === true, "the page shows the uploaded picture");
await step({ command: "workbench.action.files.save" });
const atlasFile = path.join(T, "proj", "source", "archive", "edgehack", "icons", "smokemod_overheat.inkatlas");
const xbmFile = path.join(T, "proj", "source", "archive", "edgehack", "icons", "smokemod_overheat.xbm");
for (let i = 0; i < 40 && !fs.existsSync(atlasFile); i++) await sleep(250);
check(fs.existsSync(xbmFile), "a save imported the icons' texture as an .xbm");
check(fs.existsSync(atlasFile), "and wrote the atlas beside it");
check(docOf().ownIcons?.wheel === true, "the saved document marks the wheel's own icon");
yaml = fs.readFileSync(yamlFile, "utf8");
check(/UIIcon\.edgehack_smokemod_overheat_wheel:\n {2}\$type: UIIcon\n {2}atlasResourcePath: edgehack\\icons\\smokemod_overheat\.inkatlas/.test(yaml), "the YAML names the own icon's atlas part");
check(/ChoiceCaptionParts\.OverheatIcon\.texturePartID: UIIcon\.edgehack_smokemod_overheat_wheel/.test(yaml), "the wheel uses the own icon, over the picked one");
await shot("own-icon.png");
// Original: back to the picked icon; the texture and atlas go at the next save.
await run(editor, `document.querySelector('[data-icon-reset="wheel"]').click();`);
await sleep(600);
await step({ command: "workbench.action.files.save" });
for (let i = 0; i < 20 && fs.existsSync(atlasFile); i++) await sleep(250);
check(docOf().ownIcons === undefined && docOf().wheelIcon === undefined, "Original clears the own icon and the picked one");
check(!fs.existsSync(atlasFile), "with no own icons, a save removes the atlas");

// Generate (H3b.3): Generate All against the stand-in OpenAI, the Item first, then the Wheel and Status
// as edits of it; Keep writes a fitted picture as Upload does, and nothing is kept before Keep.
await run(
  editor,
  `document.querySelector('[data-icon-generate="all"]').click();
   const w = document.querySelector("[data-generate-words]"); w.value = "a skull made of static"; w.dispatchEvent(new Event("input"));`,
);
const shownPrompt = await run(editor, `return document.querySelector("[data-generate-prompt]").textContent;`);
check(/a skull made of static/.test(shownPrompt) && /Item:/.test(shownPrompt) && /Wheel:/.test(shownPrompt) && /Status:/.test(shownPrompt), "Show the Prompt holds the three prompts with the words");
check(/Three paid images/.test(await run(editor, `return document.querySelector("[data-generate-cost]").textContent;`)), "Generate All says it is three paid images");
// An earlier upload's file stays after Original (for undo): Keep must write it anew.
const wheelTime = () => (fs.existsSync(ownWheel) ? fs.statSync(ownWheel).mtimeMs : 0);
const wheelBefore = wheelTime();
await run(editor, `document.querySelector("[data-generate-go]").click();`);
let results = 0;
for (let i = 0; i < 60 && results < 3; i++) {
  await sleep(250);
  results = await run(editor, `return document.querySelectorAll("[data-result]").length;`);
}
check(results === 3, `Generate All shows three results: ${results}`);
const gens = openaiSeen.filter((r) => r.path === "/v1/images/generations");
const edits = openaiSeen.filter((r) => r.path === "/v1/images/edits");
check(openaiSeen.some((r) => r.path === "/v1/models") && openaiSeen.every((r) => r.auth === "Bearer sk-smoke-test"), "it read the account's models, with the key");
check(gens.length === 1 && /a skull made of static/.test(JSON.parse(gens[0].body.toString()).prompt) && JSON.parse(gens[0].body.toString()).size === "1024x1024" && /no frame, no border/.test(JSON.parse(gens[0].body.toString()).prompt), "the Item's glyph alone was drawn from words");
check(edits.length === 2 && edits.every((e) => e.body.includes(SQUARE.subarray(0, 64)) && /same glyph/.test(e.body.toString("latin1"))), "the Wheel and Status were edits of the Item's picture");
const sizes = await run(editor, `return [...document.querySelectorAll("[data-result]")].map((f) => { const i = f.querySelectorAll("img.real"); const g = i[i.length - 1]; return f.dataset.result + ":" + g.naturalWidth + "x" + g.naturalHeight; }).join(" ");`);
check(sizes === "item:99x128 wheel:64x64 status:64x64", `each result is fitted to its look: ${sizes}`);
// The Item: the glyph flat in the game's cyan on the game's own card, emptied of its glyph. The stand-in
// glyph is a square in the middle of the screen; elsewhere on the screen (below the cut corner's lit
// diagonal) nothing is lit, so the game's glyph is gone, while the card's left border is still lit.
const itemPixels = await run(
  editor,
  `const i = [...document.querySelectorAll('[data-result="item"] img.real')].pop(); const c = document.createElement("canvas"); c.width = 99; c.height = 128;
   const g = c.getContext("2d"); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, 99, 128).data; const px = (x, y) => [...d.slice((y * 99 + x) * 4, (y * 99 + x) * 4 + 3)];
   const hex = (x, y) => px(x, y).map((n) => n.toString(16).padStart(2, "0")).join(""); const lit = (x, y) => px(x, y)[1] > 150 && px(x, y)[2] > 150;
   const where = []; let left = 0; for (let y = 36; y < 106; y++) for (let x = 12; x < 94; x++) if (lit(x, y) && !(x >= 32 && x <= 74 && y >= 44 && y <= 86)) { left++; if (left <= 8) where.push(x + "," + y + ":" + hex(x, y)); }
   return hex(52, 64) + " " + (lit(8, 64) || lit(9, 64)) + " " + left + (where.length ? " at " + where.join(" ") : "");`,
);
check(itemPixels === "50cdd2 true 0", `the Item is the glyph in #50cdd2 on the game's card, its border kept and its own glyph gone: ${itemPixels}`);
check(wheelTime() === wheelBefore, "nothing is kept before Keep");
await run(editor, `document.querySelector('[data-generate-keep="wheel"]').click();`);
for (let i = 0; i < 30 && wheelTime() === wheelBefore; i++) await sleep(200);
check(wheelTime() !== wheelBefore, "Keep writes the Wheel's picture beside the document");
await run(editor, `document.querySelector('[data-generate-again="status"]').click();`);
for (let i = 0; i < 40 && openaiSeen.filter((r) => r.path === "/v1/images/edits").length < 3; i++) await sleep(250);
check(openaiSeen.filter((r) => r.path === "/v1/images/edits").length === 3, "Try Again on the Status draws it again from the same Item picture");
await sleep(800);
await run(editor, `document.querySelector("[data-generate-keep-all]").click();`);
const ownItem = path.join(path.dirname(ownWheel), "item.png");
const ownStatus = path.join(path.dirname(ownWheel), "status.png");
for (let i = 0; i < 30 && !(fs.existsSync(ownItem) && fs.existsSync(ownStatus)); i++) await sleep(200);
check(fs.existsSync(ownItem) && fs.existsSync(ownStatus), "Keep All writes the Item's and the Status's too");
await step({ command: "workbench.action.files.save" });
for (let i = 0; i < 40 && !fs.existsSync(atlasFile); i++) await sleep(250);
const kept = docOf().ownIcons ?? {};
check(kept.item === true && kept.wheel === true && kept.status === true, "the saved document marks the three generated icons");
check(fs.existsSync(atlasFile), "and a save writes their atlas");
await shot("generate.png");
await run(editor, `document.querySelector("[data-generate-close]").click(); for (const w of ["item", "wheel", "status"]) document.querySelector('[data-icon-reset="' + w + '"]').click();`);
await sleep(800);
await step({ command: "workbench.action.files.save" });
for (let i = 0; i < 20 && fs.existsSync(atlasFile); i++) await sleep(250);
check(docOf().ownIcons === undefined && !fs.existsSync(atlasFile), "Original on each takes the generated icons out again");

// Scripts (H3c.3): Add writes the function into the modder's file and names it in the document; a save
// (here through Pack and Play) writes the mod's REDnode package; Remove takes the script off, and the
// next save takes EDGEhack's files away while the modder's file stays.
const pkgDir = path.join(T, "proj", "source", "resources", "red4ext", "plugins", "REDnode", "apps", "smokemod");
const scriptFile = path.join(pkgDir, "smokemod_overheat.mjs");
const scriptsHtml = () => run(editor, `return document.querySelector("[data-scripts]").innerHTML;`);
check(/data-script-add="canUse"/.test(await scriptsHtml()) && /data-script-add="onLand"/.test(await scriptsHtml()), "the Scripts section offers Add for both functions");
await run(editor, `document.querySelector('[data-script-add="canUse"]').click();`);
for (let i = 0; i < 30 && !fs.existsSync(scriptFile); i++) await sleep(200);
check(fs.existsSync(scriptFile) && /export function canUse/.test(fs.readFileSync(scriptFile, "utf8")), "Add makes the script file with canUse");
for (let i = 0; i < 20 && !/data-script-open="canUse"/.test(await scriptsHtml()); i++) await sleep(250);
check(/data-script-open="canUse"/.test(await scriptsHtml()) && /data-script-text/.test(await scriptsHtml()), "then the scan check has Open, and the disabled text shows");
await run(
  editor,
  `const t = document.querySelector("[data-script-text]"); t.value = "People only"; t.dispatchEvent(new Event("change", { bubbles: true }));`,
);
await sleep(600);
fs.rmSync(path.join(T, "packed.json"), { force: true });
await run(editor, `document.querySelector("[data-pack]").click();`);
const mainFile = path.join(pkgDir, "main.mjs");
for (let i = 0; i < 40 && !fs.existsSync(mainFile); i++) await sleep(250);
check(docOf().scripts?.file === "smokemod_overheat.mjs" && docOf().scripts?.disabledText === "People only", `the document names its script and text: ${JSON.stringify(docOf().scripts)}`);
const mainText = fs.existsSync(mainFile) ? fs.readFileSync(mainFile, "utf8") : "";
check(/Items\.OverheatProgram", "Items\.OverheatLvl1Program/.test(mainText) && /\.\/smokemod_overheat\.mjs/.test(mainText) && /People only/.test(mainText), "a save writes main.mjs with Overheat's items, lowest tier first");
const manifestFile = path.join(pkgDir, "rednode-app.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
check(manifest.id === "smokemod" && manifest.main === "main.mjs" && manifest.requires?.rednode === ">=0.61.1", `and the package's manifest: ${JSON.stringify(manifest)}`);
await run(editor, `const b = document.querySelector("[data-script-remove]"); b.focus(); b.click();`);
for (let i = 0; i < 20 && /data-script-remove/.test(await scriptsHtml()); i++) await sleep(150);
check(!/data-script-remove/.test(await scriptsHtml()), "Remove redraws the section at once, with the button still focused");
await sleep(300);
fs.rmSync(path.join(T, "packed.json"), { force: true });
await run(editor, `document.querySelector("[data-pack]").click();`);
for (let i = 0; i < 40 && fs.existsSync(mainFile); i++) await sleep(250);
check(docOf().scripts === undefined && !fs.existsSync(mainFile) && !fs.existsSync(manifestFile) && fs.existsSync(scriptFile), "Remove takes the script off: EDGEhack's files go, the script file stays");

// Feature lines (H3d): Add a line gives a focused box; its text and tier go into the document; a save writes
// the line's records and appends it to the items from its tier up; Remove takes it away.
const linesHtml = () => run(editor, `return document.querySelector("[data-lines]").innerHTML;`);
check(/data-line-add/.test(await linesHtml()), "the Texts section has Feature lines with Add a line");
await run(editor, `document.querySelector("[data-line-add]").click();`);
for (let i = 0; i < 20 && !/data-line-text="0"/.test(await linesHtml()); i++) await sleep(150);
check(await run(editor, `return document.activeElement?.dataset?.lineText === "0";`), "Add a line gives a new box, with the focus in it");
await run(
  editor,
  `const t = document.querySelector('[data-line-text="0"]'); t.value = "Burns the wounded"; t.dispatchEvent(new Event("change", { bubbles: true })); t.blur();
   const f = document.querySelector('[data-line-from="0"]'); f.value = "Items.OverheatLvl2Program"; f.dispatchEvent(new Event("change", { bubbles: true }));`,
);
await sleep(700);
fs.rmSync(path.join(T, "packed.json"), { force: true });
await run(editor, `document.querySelector("[data-pack]").click();`);
for (let i = 0; i < 40 && !/Line1_UI/.test(fs.existsSync(yamlFile) ? fs.readFileSync(yamlFile, "utf8") : ""); i++) await sleep(250);
const linesYaml = fs.existsSync(yamlFile) ? fs.readFileSync(yamlFile, "utf8") : "";
check(JSON.stringify(docOf().lines) === JSON.stringify([{ text: "Burns the wounded", from: "Items.OverheatLvl2Program" }]), `the document has the line and its tier: ${JSON.stringify(docOf().lines)}`);
check(/Line1_UI:\n  \$base: EquipmentGLP\.[A-Za-z0-9_]+\n  localizedDescription: "Burns the wounded"/.test(linesYaml), "a save writes the line's UI data, a copy of Overheat's own line, with its text");
check(/Items\.OverheatLvl2Program\.OnAttach:\n  - !append EDGEhack\.smokemod_overheat\.Line1/.test(linesYaml) && !/Items\.OverheatLvl1Program\.OnAttach/.test(linesYaml), "and appends it from Rare up, not below");
await run(editor, `const b = document.querySelector('[data-line-remove="0"]'); b.focus(); b.click();`);
for (let i = 0; i < 20 && /data-line-text/.test(await linesHtml()); i++) await sleep(150);
check(!/data-line-text/.test(await linesHtml()), "Remove takes the line away at once");
await sleep(500);
fs.rmSync(path.join(T, "packed.json"), { force: true });
await run(editor, `document.querySelector("[data-pack]").click();`);
for (let i = 0; i < 40 && /Line1/.test(fs.existsSync(yamlFile) ? fs.readFileSync(yamlFile, "utf8") : ""); i++) await sleep(250);
check(docOf().lines === undefined && !/Line1/.test(fs.existsSync(yamlFile) ? fs.readFileSync(yamlFile, "utf8") : ""), "and the next save takes its records out");

// Back to the game's value: no change, no modifier.
await setInput(editor, RAM, "6");
await sleep(400);
await run(editor, `document.querySelector("[data-pack]").click();`);
for (let i = 0; i < 30 && !fs.existsSync(path.join(T, "packed.json")); i++) await sleep(200);
check(fs.existsSync(path.join(T, "packed.json")), "Pack and Play saves and asks REDcode to pack");
await sleep(800);
check(docOf().tiers?.["Items.OverheatLvl2Program"]?.ram === undefined, "the game's value clears the field in the document");
yaml = fs.readFileSync(yamlFile, "utf8");
check(!/OverheatLvl2Hack\.costs/.test(yaml), "and its modifier is gone from the YAML");
await shot("editor.png");
log("document:", fs.readFileSync(docFile, "utf8").replace(/\s+/g, " ").slice(0, 300));

// ---- Clone and Modify: the page's button, the name asked in VS Code's own box
const main = (expression) => cdp("Runtime.evaluate", { expression, returnByValue: true }).then((r) => r.result.value);
const typeName = async (text) => {
  for (let i = 0; i < 20 && !(await main(`!!document.querySelector(".quick-input-widget input:focus")`)); i++) await sleep(300);
  await cdp("Input.insertText", { text });
  await sleep(500);
};
const press = async (key, vk) => {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: vk });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: vk });
};
await step({ command: "edgehack.openQuickhack", args: ["Overheat"] });
const read2 = await pageWith("!!document.querySelector('[data-new]')", "the page's Clone and Modify button");
await run(read2, `document.querySelector("[data-new]").click();`);
await typeName("Smoke Static");
await press("Enter", 13);
const made = await pageWith("!!document.querySelector('main[data-new-hack]')", "the new quickhack's editor");
const newFile = path.join(T, "proj", "source", "raw", "edgehack", "smokemod_smoke_static.quickhack.json");
const newOf = () => JSON.parse(fs.readFileSync(newFile, "utf8"));
check(fs.existsSync(newFile) && newOf().newHack === true && newOf().family === "Overheat" && newOf().name === "Smoke Static", "the button and the name made a new quickhack's document");
const newYaml = path.join(T, "proj", "source", "resources", "r6", "tweaks", "smokemod", "smokemod_smoke_static.yaml");
check(fs.existsSync(newYaml), "its mod files are written at once, before any change");
check(fs.existsSync(path.join(T, "proj", "source", "resources", "r6", "scripts", "EDGEhack", "NewQuickhacks.reds")), "with the shared script");
yaml = fs.readFileSync(newYaml, "utf8");
check(/^Items\.EDGEhack_smokemod_smoke_static_OverheatLvl2Program:\n {2}\$base: Items\.OverheatLvl2Program\n/m.test(yaml), "the YAML copies each tier's item");
check(/actionName: EDGEhack_smokemod_smoke_static/.test(yaml) && /shardType: EDGEhack_smokemod_smoke_static/.test(yaml), "with its own action name and shard type");
check(!/^(Items\.Overheat|QuickHack\.Overheat)[^\n]*\.\w+:/m.test(yaml), "and changes no record of the game's");
await step({ dumpLoc: true });
check(JSON.parse(JSON.parse(fs.readFileSync(path.join(T, "loc.json"), "utf8"))).Data.RootChunk.root.Data.entries.some((e) => e.secondaryKey === "EDGEhack-smokemod_smoke_static-Name" && e.femaleVariant === "Smoke Static"), "the onscreens file holds its name, beside the other document's");
check((await run(made, `return document.querySelector('[data-field="bossRam"]') === null;`)), "no fields for bosses");
im = await images(made);
check(im.total >= 3 && im.broken.length === 0, `its editor: ${im.total} images, broken ${JSON.stringify(im.broken)}`);
check(/A new quickhack, started from the game's Overheat/.test(await run(made, `return document.querySelector(".ro").textContent;`)), "the page says what it is");
await run(made, `document.querySelector('th button[data-pick="2"]').click();`);
await sleep(300);
check((await run(made, `return document.querySelector('.tier.on [data-give]').textContent;`)) === 'await game.player.addItem("Items.EDGEhack_smokemod_smoke_static_OverheatLvl2Program")', "the Console line follows the selected tier");
// Get it (H3.6): how the game's tier is got, filled in once the vendors are read; its stock lines in the YAML.
let getIt = "";
for (let i = 0; i < 40; i++) {
  getIt = await run(made, `return document.querySelector('[data-getit] .tier.on').textContent;`);
  if (!/Reading where/.test(getIt)) break;
  await sleep(500);
}
log("Get it:", getIt.replace(/\s+/g, " ").slice(0, 240));
check(/sold as it is by \d+ vendors?|schematic is sold by \d+ vendors?|not sold by any vendor/.test(getIt), "Get it says how the game's tier is got");
check(/^Vendors\.\w+\.itemStock:\n {2}- !append-once Vendors\.EDGEhack_smokemod_smoke_static_/m.test(yaml), "and the YAML adds its stock lines to the family's vendors");
await shot("newhack.png");

// Its numbers copy the chain, and Pack and Play waits for the files.
await setInput(made, '[data-tier-key="Items.OverheatLvl2Program"][data-field="damage"]', "65");
await setInput(made, '[data-tier-key="Items.OverheatLvl2Program"][data-field="duration"]', "11");
await sleep(500);
fs.rmSync(path.join(T, "packed.json"), { force: true });
await run(made, `document.querySelector("[data-pack]").click();`);
for (let i = 0; i < 30 && !fs.existsSync(path.join(T, "packed.json")); i++) await sleep(200);
check(fs.existsSync(path.join(T, "packed.json")), "Pack and Play on it asks REDcode to pack");
yaml = fs.readFileSync(newYaml, "utf8");
check(/^Attacks\.EDGEhack_smokemod_smoke_static_OverheatLvl2Program:\n {2}\$base: /m.test(yaml) && /^BaseStatusEffect\.EDGEhack_smokemod_smoke_static_OverheatLvl2Program:\n {2}\$base: /m.test(yaml), "changed damage and duration are in by the time it packs, as copies");

// Add Effect: from another quickhack, and a status effect.
const newDocNow = async () => {
  await step({ command: "workbench.action.files.save" });
  await sleep(900);
  return JSON.parse(fs.readFileSync(newFile, "utf8"));
};
await run(made, `document.querySelector("[data-add-effect]").click();`);
for (let i = 0; i < 60; i++) {
  if (await run(made, `return !document.querySelector("[data-effect-picker]").hidden;`)) break;
  await sleep(500);
}
const families = await run(made, `return document.querySelectorAll("[data-effect-pick-family]").length;`);
check(families === 17, `the picker offers the other families: ${families}`);
await sleep(800);
const famImages = await images(made);
check(famImages.broken.length === 0, `their icons load: broken ${JSON.stringify(famImages.broken.slice(0, 3))}`);
await run(made, `document.querySelector("[data-add-effect]").scrollIntoView();`);
await sleep(200);
await shot("effect-picker.png");
await run(made, `document.querySelector('[data-effect-pick-family="Contagion"]').click();`);
for (let i = 0; i < 40; i++) {
  if (await run(made, `return !!document.querySelector("[data-add-from]");`)) break;
  await sleep(250);
}
const poison = await run(made, `return [...document.querySelectorAll("[data-add-from]")].map((b) => b.querySelector("b").textContent);`);
check(poison.includes("Poison"), `Contagion offers its poison: ${poison}`);
await run(made, `document.querySelector("[data-add-from]").click();`);
await sleep(1200);
const withPoison = await newDocNow();
check(withPoison.effects?.[0]?.from === "Contagion" && /ContagionPoison/.test(withPoison.effects?.[0]?.effect ?? ""), "the document holds Contagion's poison");
check(await run(made, `return document.querySelectorAll("[data-added-card]").length === 1 && document.querySelector("[data-effect-picker]").hidden;`), "its card shows, and the picker closes");
check(/keeps its damage off machines/.test(await run(made, `return document.querySelector("[data-added-uses]").textContent;`)), "and it says its copy keeps the damage off machines");
check(/keeps their damage off machines/.test(await run(made, `return document.querySelector("[data-notes]").textContent;`)), "and a note says so at the top");

await run(made, `document.querySelector("[data-add-effect]").click();`);
await sleep(800);
await run(made, `document.querySelector('[data-effect-tab="status"]').click();`);
const everyEnemy = await run(made, `return document.querySelectorAll("[data-add-status]").length;`);
check(everyEnemy >= 100, `the status effects list: ${everyEnemy}`);
await setInput(made, "[data-effect-search]", "bleeding");
await run(made, `document.querySelector("[data-effect-search]").dispatchEvent(new Event("input", { bubbles: true }));`);
await sleep(200);
const bleeds = await run(made, `return [...document.querySelectorAll("[data-add-status]")].map((b) => b.dataset.addStatus);`);
check(bleeds.includes("BaseStatusEffect.Bleeding") && bleeds.length < everyEnemy, `the search narrows them: ${bleeds.length}`);
await run(made, `document.querySelector("[data-effect-all]").click();`);
await sleep(200);
const withAll = await run(made, `return document.querySelectorAll("[data-add-status]").length;`);
check(withAll >= bleeds.length, `Show all adds to them: ${withAll}`);
await run(made, `document.querySelector("[data-effect-all]").click();`);
await run(made, `document.querySelector("[data-add-effect]").scrollIntoView();`);
await sleep(200);
await shot("effect-status.png");
await run(made, `document.querySelector('[data-add-status="BaseStatusEffect.Bleeding"]').click();`);
await sleep(1200);
check((await newDocNow()).effects?.[1]?.status === "BaseStatusEffect.Bleeding", "the document holds the status effect");
check((await run(made, `return document.querySelectorAll("[data-added-card]").length;`)) === 2, "two cards show");

// A number makes a copy, and only there; a tier can be left off; undo reaches the cards.
await setInput(made, '[data-added="a1"][data-added-tier="Items.OverheatLvl2Program"][data-added-field="duration"]', "20");
await sleep(800);
check((await newDocNow()).effects[0].values?.["Items.OverheatLvl2Program"]?.duration === 20, "a number goes in the document");
check(/Numbers changed on Rare/.test(await run(made, `return document.querySelector('[data-added-card="a1"] [data-added-uses]').textContent;`)), "and the card says Rare's numbers changed");
await run(made, `document.querySelector('[data-added-on="a2"][data-added-tier="Items.OverheatProgram"]').click();`);
await sleep(800);
check(JSON.stringify((await newDocNow()).effects[1].off) === JSON.stringify(["Items.OverheatProgram"]), "a cleared box leaves it off that tier");
await run(made, `document.querySelector("[data-add-effect]").scrollIntoView();`);
await sleep(200);
await shot("effect-cards.png");
await step({ command: "workbench.action.files.save" });
await sleep(1500);
yaml = fs.readFileSync(newYaml, "utf8");
check(/^BaseStatusEffect\.EDGEhack_smokemod_smoke_static_a1_OverheatLvl2Program:\n {2}\$base: BaseStatusEffect\.ContagionPoisonLvl2\n {2}duration: /m.test(yaml), "the YAML copies the poison for Rare");
check(/^QuickHack\.EDGEhack_smokemod_smoke_static_a2_OverheatLvl2Program_Effect:\n {2}\$type: ObjectActionEffect\n {2}recipient: ObjectActionReference\.Target\n {2}statusEffect: BaseStatusEffect\.EDGEhack_smokemod_smoke_static_a2_OverheatLvl2Program/m.test(yaml), "the YAML makes the bleed's effect record, on its copy");
check(/prereqRecord: EDGEhack\.smokemod_smoke_static\.NotMachine/.test(yaml), "and the copies keep their damage off machines");
const baseTier = yaml.split("QuickHack.EDGEhack_smokemod_smoke_static_OverheatProgram:\n")[1].split("\n\n")[0];
const rareTier = yaml.split("QuickHack.EDGEhack_smokemod_smoke_static_OverheatLvl2Program:\n")[1].split("\n\n")[0];
check(!/static_a2/.test(baseTier) && /static_a2/.test(rareTier), "the bleed is off Common and on Rare");
check(/static_a1_OverheatProgram_Effect/.test(baseTier) && /^QuickHack\.EDGEhack_smokemod_smoke_static_a1_OverheatProgram_Effect:\n {2}\$base: QuickHack\.ContagionHack_inline/m.test(yaml), "Common takes a copy of Contagion's own effect record");
check(/static_a1_OverheatLvl2Program_Effect/.test(rareTier), "Rare takes its copy");
await run(made, `document.activeElement && document.activeElement.blur();`);
await step({ command: "undo" });
await sleep(800);
check((await run(made, `return document.querySelector('[data-added-on="a2"][data-added-tier="Items.OverheatProgram"]').checked;`)) === true, "undo reaches the card");
await step({ command: "redo" });
await sleep(800);
await run(made, `document.querySelector('[data-added-remove="a2"]').click();`);
await sleep(800);
check((await run(made, `return document.querySelectorAll("[data-added-card]").length;`)) === 1, "Remove takes a card away");
await step({ command: "workbench.action.files.save" });
await sleep(1200);
check(!/static_a2/.test(fs.readFileSync(newYaml, "utf8")), "and the YAML follows");

// The same name is refused in the box, and nothing is made.
await step({ command: "edgehack.openQuickhack", args: ["Overheat"] });
await sleep(1500);
const read3 = await pageWith("!!document.querySelector('[data-new]')", "the page again");
await run(read3, `document.querySelector("[data-new]").click();`);
await typeName("Smoke Static");
const refusal = await main(`document.querySelector(".quick-input-widget .quick-input-message")?.textContent ?? ""`);
check(/already has/.test(refusal), `the same name is refused: ${refusal}`);
await press("Escape", 27);
await sleep(300);

// The view's Project group lists both, and opens them.
await step({ command: "workbench.view.extension.edgehack" });
await sleep(2500);
const rows = await main(`[...document.querySelectorAll('.monaco-list-row')].map((r) => r.getAttribute("aria-label") ?? r.textContent)`);
check(rows.some((r) => /Project: smoke/.test(r)), "the Quickhacks view has a Project group");
check(rows.some((r) => /Smoke Static/.test(r) && /new, from Overheat/.test(r)), "listing the new quickhack");
check(rows.some((r) => /Smoke Heat|Overheat/.test(r) && /changes Overheat/.test(r)), "and the change to the game's");
await shot("view.png");
log("new document:", fs.readFileSync(newFile, "utf8").replace(/\s+/g, " ").slice(0, 300));

// ---- The Desk (H3.7): in the scratch folder (EDGEHACK_DESK), never the modder's own.
const deskItem = path.join(T, "desk", "smoke_desk.quickhack.asset");
const deskFile = path.join(deskItem, "source", "raw", "edgehack", "smoke_desk.quickhack.json");
const deskYaml = path.join(T, "proj", "source", "resources", "r6", "tweaks", "smokemod", "smokemod_smoke_desk.yaml");
await step({ command: "edgehack.desk.new", args: ["Overheat", "Smoke Desk"] });
check(fs.existsSync(deskFile) && JSON.parse(fs.readFileSync(path.join(deskItem, "asset.json"), "utf8")).kind === "quickhack", "Clone and Modify on the Desk makes a Library-shaped item");
check(!fs.existsSync(deskYaml), "and writes no mod files");
const deskPage = await pageWith("!!document.querySelector('main[data-desk]')", "the Desk quickhack's editor");
check(await run(deskPage, `return !!document.querySelector("[data-add-to-project]") && !document.querySelector("[data-pack]");`), "its page offers Add to Project, not Pack and Play");
check(await run(deskPage, `return !document.querySelector("[data-give]");`), "and no Console line until it is in a project");
await setInput(deskPage, '[data-tier-key="Items.OverheatLvl3Program"][data-field="ram"]', "9");
await sleep(800);
await step({ command: "workbench.action.files.save" });
await sleep(1200);
check(JSON.parse(fs.readFileSync(deskFile, "utf8")).tiers["Items.OverheatLvl3Program"]?.ram === 9, "a change is saved on the Desk");
check(JSON.parse(fs.readFileSync(path.join(deskItem, "asset.json"), "utf8")).version === 2, "and raises the item's version");
check(/Saved on the Desk/.test(await run(deskPage, `return document.querySelector("[data-status]").textContent;`)), "the page says it was saved on the Desk");
check(!fs.existsSync(deskYaml), "still with no mod files");
await run(deskPage, `document.querySelector("[data-add-to-project]").click();`);
const added = path.join(T, "proj", "source", "raw", "edgehack", "smokemod_smoke_desk.quickhack.json");
for (let i = 0; i < 40 && !fs.existsSync(deskYaml); i++) await sleep(500);
check(fs.existsSync(added) && JSON.parse(fs.readFileSync(added, "utf8")).id === "smokemod_smoke_desk", "Add to Project puts it in the project under the project's id");
check(JSON.parse(fs.readFileSync(added, "utf8")).tiers["Items.OverheatLvl3Program"]?.ram === 9, "with its changes");
check(fs.existsSync(deskYaml) && /^Items\.EDGEhack_smokemod_smoke_desk_OverheatLvl2Program:/m.test(fs.readFileSync(deskYaml, "utf8")), "and writes its mod files");
check(fs.existsSync(deskFile), "the Desk keeps its own");
await pageWith("!!document.querySelector('main[data-new-hack]:not([data-desk]) [data-pack]') && document.querySelector('[data-title]').textContent === 'Smoke Desk'", "the project's copy, opened");
await step({ command: "edgehack.desk.duplicate", args: [deskFile, "Smoke Desk Two"] });
const twoFile = path.join(T, "desk", "smoke_desk_two.quickhack.asset", "source", "raw", "edgehack", "smoke_desk_two.quickhack.json");
check(fs.existsSync(twoFile) && JSON.parse(fs.readFileSync(twoFile, "utf8")).tiers["Items.OverheatLvl3Program"]?.ram === 9, "Duplicate copies it under another name");
await step({ command: "workbench.view.extension.edgehack" });
await sleep(2500);
const deskRows = await main(`[...document.querySelectorAll('.monaco-list-row')].map((r) => r.getAttribute("aria-label") ?? r.textContent)`);
check(deskRows.some((r) => /Smoke Desk Two/.test(r)) && deskRows.filter((r) => /Smoke Desk/.test(r) && /new, from Overheat/.test(r)).length >= 3, `the Desk view lists both, and the project's copy: ${deskRows.filter((r) => /Smoke Desk/.test(r)).length} rows`);
await shot("desk.png");

// Remove from Project: the document and its mod files go (to the Recycle Bin), its texts leave the
// onscreens file, and the Desk's copy stays.
const addedYaml = path.join(T, "proj", "source", "resources", "r6", "tweaks", "smokemod", "smokemod_smoke_desk.yaml");
check(fs.existsSync(addedYaml), "the added quickhack has its YAML in the project");
await step({ command: "edgehack.project.remove", args: [added, true] });
await sleep(1500);
check(!fs.existsSync(added) && !fs.existsSync(addedYaml), "Remove from Project takes its document and YAML out of the project");
check(fs.existsSync(deskFile), "and leaves the Desk's copy");
await step({ dumpLoc: true });
const locAfter = JSON.parse(fs.readFileSync(path.join(T, "loc.json"), "utf8"));
const entriesAfter = locAfter ? JSON.parse(locAfter).Data.RootChunk.root.Data.entries : [];
check(!entriesAfter.some((e) => e.secondaryKey?.startsWith("EDGEhack-smokemod_smoke_desk-")) && entriesAfter.some((e) => e.secondaryKey?.startsWith("EDGEhack-smokemod_overheat-")), "its texts leave the onscreens file; the others' stay");
finish();
