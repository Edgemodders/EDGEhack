// A stand-in REDcode for the smoke test: the same API, over the real REDbridge on the real game, with a
// scratch project. It takes its steps from a control file the smoke script writes, since a script
// cannot run VS Code's commands through a webview. Environment: EH_SMOKE (the scratch folder),
// EH_BRIDGE (REDbridge.exe), EH_GAME (the game folder).
const vscode = require("vscode");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const T = process.env.EH_SMOKE;
const proc = spawn(process.env.EH_BRIDGE, ["--game", process.env.EH_GAME], { stdio: ["pipe", "pipe", "ignore"] });
let buf = Buffer.alloc(0);
let n = 0;
const waiting = new Map();
proc.stdout.on("data", (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    const h = buf.indexOf("\r\n\r\n");
    if (h < 0) return;
    const len = Number(/Content-Length: (\d+)/i.exec(buf.subarray(0, h).toString())?.[1]);
    if (buf.length < h + 4 + len) return;
    const msg = JSON.parse(buf.subarray(h + 4, h + 4 + len).toString());
    buf = buf.subarray(h + 4 + len);
    waiting.get(msg.id)?.(msg);
    waiting.delete(msg.id);
  }
});
function call(method, params) {
  const id = ++n;
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  proc.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
  return new Promise((ok, fail) => waiting.set(id, (m) => (m.error ? fail(new Error(m.error.message)) : ok(m.result))));
}

const bridge = {
  running: true,
  toJson: (p, outFile) => call("cr2w.toJson", { path: p, outFile: outFile ?? null }),
  toPng: (p, outFile) => call("texture.toPng", { path: p, outFile }),
  tweakRecords: (q) => call("tweakdb.records", q),
  tweakRecord: (p, resolveLocKeys = false, language = "en-us") => call("tweakdb.record", { path: p, resolveLocKeys, language }),
  fileToJson: (file) => call("cr2w.fileToJson", { file }),
  fromJson: (outFile, source) => call("cr2w.fromJson", { outFile, ...source }),
  locProjectFiles: (projectDir, language = "en-us") => call("loc.projectFiles", { projectDir, language }),
  locNewFile: (projectDir, modName, language = "en-us") => call("loc.newFile", { projectDir, modName, language }),
  locGet: (keys, language = "en-us") => call("loc.get", { keys, language, projectDir: null }),
};

const dir = path.join(T, "proj");
const project = {
  name: "smoke",
  modName: "smokemod",
  file: path.join(dir, "smoke.cpmodproj"),
  dir,
  archive: path.join(dir, "source", "archive"),
  raw: path.join(dir, "source", "raw"),
  resources: path.join(dir, "source", "resources"),
  packed: path.join(dir, "packed"),
};

const write = (name, value) => fs.writeFileSync(path.join(T, name), JSON.stringify(value));

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("redcode.openTweakRecord", (p) => write("opened.json", p)),
    { dispose: () => proc.kill() },
  );
  // The smoke script's steps: { command, args } runs a command; { dumpLoc } reads the onscreens file.
  const control = path.join(T, "control.json");
  setInterval(async () => {
    if (!fs.existsSync(control)) return;
    const step = JSON.parse(fs.readFileSync(control, "utf8"));
    fs.rmSync(control);
    try {
      if (step.command) await vscode.commands.executeCommand(step.command, ...(step.args ?? []));
      if (step.dumpLoc) {
        const files = await bridge.locProjectFiles(dir);
        const file = files.find((f) => f.exists);
        write("loc.json", file ? (await bridge.fileToJson(path.join(dir, file.file))).json : null);
      }
      write("done.json", step);
    } catch (e) {
      write("done.json", { error: String(e) });
    }
  }, 200);
  return {
    apiVersion: 1,
    version: "0.10.5-stub",
    bridge: () => bridge,
    gamePath: () => process.env.EH_GAME,
    project: () => project,
    onDidChangeProject: new vscode.EventEmitter().event,
    packAndPlay: async () => {
      write("packed.json", true);
      return "installed";
    },
  };
}

module.exports = { activate, deactivate: () => proc.kill() };
