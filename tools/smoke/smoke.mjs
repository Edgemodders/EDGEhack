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

for (const f of ["ud", "proj", "control.json", "done.json", "packed.json", "opened.json", "loc.json"]) fs.rmSync(path.join(T, f), { recursive: true, force: true });
fs.mkdirSync(path.join(T, "proj", "source", "raw"), { recursive: true });
fs.mkdirSync(path.join(T, "ud", "User"), { recursive: true });
fs.cpSync(path.join(here, "stub"), path.join(T, "stub"), { recursive: true });
fs.writeFileSync(path.join(T, "ud", "User", "settings.json"), JSON.stringify({ "window.dialogStyle": "custom", "security.workspace.trust.enabled": false }));
for (const f of [BRIDGE, CODE]) if (!fs.existsSync(f)) throw new Error(`Not found: ${f}`);

const env = { ...process.env, EH_SMOKE: T, EH_BRIDGE: BRIDGE, EH_GAME: GAME };
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
const shot = async (name) => {
  const s = await cdp("Page.captureScreenshot", { format: "png" });
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

// ---- Make a New One From This: the page's button, the name asked in VS Code's own box
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
const read2 = await pageWith("!!document.querySelector('[data-new]')", "the page's Make a New One button");
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
finish();
