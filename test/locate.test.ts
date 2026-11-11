import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findBridge, findDotnet, findGame, settingsFrom } from "../src/locate";
import { projectAt } from "../src/project";

const touch = (file: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "");
  return file;
};

function machine() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ehlocate-"));
  const env = { LOCALAPPDATA: path.join(root, "Local"), APPDATA: path.join(root, "Roaming"), ProgramFiles: path.join(root, "PF"), PATH: "" };
  return { root, env };
}

test("findBridge: the newest copy any tool fetched, REDnode's first on a tie", () => {
  const { env } = machine();
  assert.equal(findBridge(undefined, { env }), undefined);
  const rednode = touch(path.join(env.LOCALAPPDATA, "REDnode", "bridge", "v0.10.0", "REDbridge.exe"));
  assert.deepEqual(findBridge(undefined, { env }), { path: rednode, from: "REDnode", version: "0.10.0" });
  const redcode = touch(path.join(env.APPDATA, "Code", "User", "globalStorage", "edgemodders.redcode-cyberpunk", "bridge", "v0.12.1", "REDbridge.exe"));
  assert.deepEqual(findBridge(undefined, { env }), { path: redcode, from: "REDcode (Code)", version: "0.12.1" });
  const tie = touch(path.join(env.LOCALAPPDATA, "REDnode", "bridge", "v0.12.1", "REDbridge.exe"));
  assert.equal(findBridge(undefined, { env })?.path, tie);
});

test("findBridge: a path given, REDBRIDGE_EXE and REDcode's setting win, in that order, and a folder means REDbridge.exe in it", () => {
  const { root, env } = machine();
  touch(path.join(env.LOCALAPPDATA, "REDnode", "bridge", "v0.12.1", "REDbridge.exe"));
  const set = touch(path.join(root, "set", "REDbridge.exe"));
  const fromEnv = touch(path.join(root, "env", "REDbridge.exe"));
  const given = touch(path.join(root, "given", "REDbridge.exe"));
  const settings = settingsFrom(JSON.stringify({ "redcode.bridgePath": path.dirname(set) }));
  assert.equal(findBridge(undefined, { env, settings })?.from, "REDcode's setting");
  assert.equal(findBridge(undefined, { env: { ...env, REDBRIDGE_EXE: fromEnv }, settings })?.path, fromEnv);
  assert.equal(findBridge(path.dirname(given), { env: { ...env, REDBRIDGE_EXE: fromEnv }, settings })?.path, given);
  assert.equal(findBridge(path.join(root, "nowhere"), { env })?.from, "REDnode", "a path that is not there is passed over");
});

test("findDotnet: REDcode's setting, then none for a machine-wide .NET 10, then the per-user one", () => {
  const { env } = machine();
  assert.equal(findDotnet({ env }), undefined);
  const user = path.join(env.LOCALAPPDATA, "Microsoft", "dotnet");
  fs.mkdirSync(path.join(user, "shared", "Microsoft.NETCore.App", "10.0.1"), { recursive: true });
  assert.equal(findDotnet({ env }), user);
  fs.mkdirSync(path.join(env.ProgramFiles, "dotnet", "shared", "Microsoft.NETCore.App", "10.0.2"), { recursive: true });
  assert.equal(findDotnet({ env }), undefined, "the bridge finds the machine's");
  assert.equal(findDotnet({ env, settings: settingsFrom('{ "redcode.dotnetRoot": "D:\\\\dotnet" }') }), "D:\\dotnet");
});

test("findGame: a game folder from the option, the variable, the settings or Steam's libraries", () => {
  const { root, env } = machine();
  const steam = path.join(root, "Steam");
  const lib = path.join(root, "SteamLibrary");
  fs.mkdirSync(path.join(steam, "steamapps"), { recursive: true });
  fs.writeFileSync(path.join(steam, "steamapps", "libraryfolders.vdf"), `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${steam.replace(/\\/g, "\\\\")}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${lib.replace(/\\/g, "\\\\")}"\n\t}\n}\n`);
  assert.equal(findGame(undefined, { env, steam: [steam] }), undefined);
  const game = path.join(lib, "steamapps", "common", "Cyberpunk 2077");
  touch(path.join(game, "bin", "x64", "Cyberpunk2077.exe"));
  assert.deepEqual(findGame(undefined, { env, steam: [steam] }), { path: game, from: "Steam" });
  const other = path.join(root, "GOG", "Cyberpunk 2077");
  touch(path.join(other, "bin", "x64", "Cyberpunk2077.exe"));
  const settings = settingsFrom(JSON.stringify({ "edgedeck.gamePath": other }));
  assert.equal(findGame(undefined, { env, steam: [steam], settings })?.from, "EDGEdeck's setting");
  assert.equal(findGame(undefined, { env: { ...env, EDGEHACK_GAME_PATH: game }, steam: [steam], settings })?.from, "EDGEHACK_GAME_PATH");
  assert.equal(findGame(other, { env, steam: [] })?.from, "the --game option");
  assert.equal(findGame(path.join(root, "not a game"), { env, steam: [] }), undefined);
});

test("settingsFrom reads string settings past comments and other keys, and an empty one is unset", () => {
  const s = settingsFrom('{\n  // a comment\n  "redcode.gamePath": "E:\\\\Steam\\\\Cyberpunk 2077",\n  "redcode.bridgePath": "",\n  "other": 3,\n}');
  assert.equal(s("redcode.gamePath"), "E:\\Steam\\Cyberpunk 2077");
  assert.equal(s("redcode.bridgePath"), undefined);
  assert.equal(s("edgedeck.gamePath"), undefined);
});

test("projectAt reads a WolvenKit project from its file or its folder", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehproj-"));
  assert.throws(() => projectAt(dir), /no \.cpmodproj file/);
  fs.writeFileSync(path.join(dir, "Heat Pack.cpmodproj"), "<?xml version=\"1.0\"?>\n<CP77Mod>\n  <Name>Heat &amp; Static</Name>\n  <ModName>HeatPack</ModName>\n</CP77Mod>\n");
  const p = projectAt(dir);
  assert.equal(p.name, "Heat & Static");
  assert.equal(p.modName, "HeatPack");
  assert.equal(p.archive, path.join(dir, "source", "archive"));
  assert.equal(p.raw, path.join(dir, "source", "raw"));
  assert.deepEqual(projectAt(p.file), p);
});
