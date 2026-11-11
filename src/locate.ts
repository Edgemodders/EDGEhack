// Where REDbridge, .NET and the game are, for EDGEhack outside VS Code (H4.4): the MCP server finds
// them as REDnode does (packages/overlay/redbridge.js and bridge-install.js there), with the VS Code
// settings REDcode and EDGEdeck keep read from their file. In VS Code, REDcode finds them instead.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Reads a setting such as "redcode.gamePath"; empty strings count as unset. */
export type SettingsReader = (key: string) => string | undefined;

/** The folders to look in; the process's own by default, other ones in the tests. */
export interface Places {
  env?: NodeJS.ProcessEnv;
  settings?: SettingsReader;
  /** Steam's own folder, whose steamapps/libraryfolders.vdf lists its libraries. */
  steam?: string[];
}

export interface Found {
  path: string;
  /** Where it came from, in plain words: "REDBRIDGE_EXE", "REDnode", "REDcode (Code)", "Steam" and so on. */
  from: string;
  version?: string;
}

const nonEmpty = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const localAppData = (env: NodeJS.ProcessEnv) => env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
const appData = (env: NodeJS.ProcessEnv) => env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");

// Editors whose storage folders may hold a fetched REDbridge, and the extensions that fetch it (as REDnode's list).
const EDITORS = ["Code", "Code - Insiders", "VSCodium", "EDGEkit", "Cursor"];
const FETCHERS: [string, string][] = [
  ["edgemodders.edgedeck", "EDGEdeck"],
  ["edgemodders.redcode-cyberpunk", "REDcode"],
  ["edgemodders.redcode", "REDcode"],
];

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Copies of REDbridge.exe in <dir>/<tag>/. */
function copiesIn(dir: string, from: string): Found[] {
  let tags: string[] = [];
  try {
    tags = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return tags
    .filter((tag) => !tag.startsWith(".") && isFile(path.join(dir, tag, "REDbridge.exe")))
    .map((tag) => ({ path: path.join(dir, tag, "REDbridge.exe"), from, version: tag.replace(/^v/, "") }));
}

/**
 * REDbridge.exe: a path given (a file or its folder), then REDBRIDGE_EXE, then REDcode's setting, then the
 * newest copy REDnode, EDGEdeck or REDcode fetched, then one on PATH. Undefined when there is none.
 */
export function findBridge(given?: string, places: Places = {}): Found | undefined {
  const env = places.env ?? process.env;
  for (const [p, from] of [
    [nonEmpty(given), "the --bridge option"],
    [nonEmpty(env.REDBRIDGE_EXE), "REDBRIDGE_EXE"],
    [places.settings?.("redcode.bridgePath"), "REDcode's setting"],
  ] as const) {
    if (!p) continue;
    const exe = isFile(p) ? p : path.join(p, "REDbridge.exe");
    if (isFile(exe)) return { path: exe, from };
  }
  // REDnode's own copies first, so a tie in version goes to them (the sort is stable).
  const copies = copiesIn(path.join(localAppData(env), "REDnode", "bridge"), "REDnode");
  for (const editor of EDITORS) {
    for (const [ext, name] of FETCHERS) {
      copies.push(...copiesIn(path.join(appData(env), editor, "User", "globalStorage", ext, "bridge"), `${name} (${editor})`));
    }
  }
  copies.sort((a, b) => compareVersions(b.version ?? "0", a.version ?? "0"));
  if (copies[0]) return copies[0];
  const onPath = (env.PATH ?? "").split(path.delimiter).filter(Boolean).map((d) => path.join(d, "REDbridge.exe")).find(isFile);
  return onPath ? { path: onPath, from: "PATH" } : undefined;
}

function hasNet10(root: string): boolean {
  try {
    return fs.readdirSync(path.join(root, "shared", "Microsoft.NETCore.App")).some((v) => v.startsWith("10."));
  } catch {
    return false;
  }
}

/**
 * DOTNET_ROOT for REDbridge: REDcode's setting, else undefined when .NET 10 is installed for the machine
 * (the bridge finds it), else the per-user .NET REDnode or REDcode fetched, else undefined.
 */
export function findDotnet(places: Places = {}): string | undefined {
  const env = places.env ?? process.env;
  const set = places.settings?.("redcode.dotnetRoot");
  if (set) return set;
  if (hasNet10(path.join(env.ProgramFiles ?? "C:\\Program Files", "dotnet"))) return undefined;
  const user = path.join(localAppData(env), "Microsoft", "dotnet");
  return hasNet10(user) ? user : undefined;
}

/** A Cyberpunk 2077 folder: it has bin/x64/Cyberpunk2077.exe. */
export function isGameFolder(dir: string | undefined): dir is string {
  return !!dir && isFile(path.join(dir, "bin", "x64", "Cyberpunk2077.exe"));
}

/** Steam's libraries, from its libraryfolders.vdf. */
function steamLibraries(steamRoots: string[]): string[] {
  const libs: string[] = [];
  for (const root of steamRoots) {
    libs.push(root);
    try {
      const vdf = fs.readFileSync(path.join(root, "steamapps", "libraryfolders.vdf"), "utf8");
      for (const m of vdf.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g)) libs.push(m[1].replace(/\\\\/g, "\\"));
    } catch {
      // no Steam here
    }
  }
  return [...new Set(libs)];
}

/**
 * The game folder: a path given, then EDGEHACK_GAME_PATH, then REDcode's and EDGEdeck's settings, then
 * Steam's libraries. Undefined when none is a game folder. GOG and Epic installs need one of the first four.
 */
export function findGame(given?: string, places: Places = {}): Found | undefined {
  const env = places.env ?? process.env;
  for (const [dir, from] of [
    [nonEmpty(given), "the --game option"],
    [nonEmpty(env.EDGEHACK_GAME_PATH), "EDGEHACK_GAME_PATH"],
    [places.settings?.("redcode.gamePath"), "REDcode's setting"],
    [places.settings?.("edgedeck.gamePath"), "EDGEdeck's setting"],
  ] as const) {
    if (isGameFolder(dir)) return { path: dir, from };
  }
  const steam = places.steam ?? [path.join(env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Steam")];
  for (const lib of steamLibraries(steam)) {
    const dir = path.join(lib, "steamapps", "common", "Cyberpunk 2077");
    if (isGameFolder(dir)) return { path: dir, from: "Steam" };
  }
  return undefined;
}

/** VS Code's user settings, read tolerantly (comments and trailing commas), as a SettingsReader. */
export function vscodeUserSettings(env: NodeJS.ProcessEnv = process.env): SettingsReader {
  let text = "";
  try {
    text = fs.readFileSync(path.join(appData(env), "Code", "User", "settings.json"), "utf8");
  } catch {
    // no settings file: every setting is unset
  }
  return settingsFrom(text);
}

/** A SettingsReader over a settings.json's text: string values only, found by their key. */
export function settingsFrom(text: string): SettingsReader {
  return (key) => {
    const m = text.match(new RegExp(`"${key.replace(/\./g, "\\.")}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (!m) return undefined;
    try {
      return nonEmpty(JSON.parse(`"${m[1]}"`));
    } catch {
      return undefined;
    }
  };
}
