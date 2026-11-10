// REDcode, which EDGEhack builds on (extensionDependencies). Found at runtime and never imported:
// the interfaces below copy the parts of REDcodeApi version 1 that EDGEhack uses (REDcode 0.10.5,
// extensions/redcode/src/api.ts and types.ts there; https://edgemodders.github.io/REDcode/api.html).

import * as vscode from "vscode";

export const REDcodeId = "edgemodders.redcode-cyberpunk";

/** A TweakDB value as REDbridge gives it: record links as paths (0x ids when unnamed), LocKeys as { key, text }. */
export type TweakValue = string | number | boolean | null | TweakLocKey | TweakValue[] | { [key: string]: unknown };

export interface TweakLocKey {
  key: string;
  text: string | null;
}

export interface TweakRecord {
  id: string;
  path: string | null;
  type: string;
  flats: Record<string, TweakValue> | null;
}

export interface TweakRecords {
  total: number;
  offset: number;
  items: TweakRecord[];
}

export interface TweakRecordsQuery {
  type?: string;
  prefix?: string;
  flats?: string[];
  offset?: number;
  limit?: number;
  resolveLocKeys?: boolean;
  language?: string;
}

export interface TweakRecordFull {
  id: string;
  path: string | null;
  type: string;
  flats: { name: string; type: string; value: TweakValue }[];
}

/** The part of REDcode's REDbridge client EDGEhack uses: its methods mirror REDbridge's JSON-RPC methods. */
export interface BridgeClient {
  readonly running?: boolean;
  /** cr2w.toJson: a game file as WolvenKit JSON. */
  toJson(path: string, outFile?: string): Promise<{ file?: string; bytes?: number; json?: unknown }>;
  /** texture.toPng: a game texture as a PNG file, the right way up. */
  toPng(path: string, outFile: string): Promise<{ file: string; bytes: number }>;
  tweakRecords(query: TweakRecordsQuery): Promise<TweakRecords>;
  tweakRecord(path: string, resolveLocKeys?: boolean, language?: string): Promise<TweakRecordFull>;
  /** cr2w.fileToJson: a CR2W file on disk as WolvenKit JSON. */
  fileToJson(file: string, outFile?: string): Promise<{ json?: string | null }>;
  /** cr2w.fromJson: writes a CR2W file from WolvenKit JSON. */
  fromJson(outFile: string, source: { json: string }): Promise<{ file: string; bytes: number }>;
  /** loc.projectFiles: the project's onscreens files for a language. */
  locProjectFiles(projectDir: string, language?: string): Promise<{ file: string; exists: boolean; xl: string | null }[]>;
  /** loc.newFile: makes sure the project has an onscreens file, with its .xl. */
  locNewFile(projectDir: string, modName: string, language?: string): Promise<{ file: string; created: boolean; xl: string | null; xlWritten: boolean }>;
  /** loc.get: texts for LocKeys ("LocKey#123" or a secondary key), null where there is none. */
  locGet(keys: string[], language?: string, projectDir?: string): Promise<Record<string, { female: string; male: string } | null>>;
}

export interface ProjectRef {
  name: string;
  modName: string;
  file: string;
  dir: string;
  archive: string;
  raw: string;
  resources: string;
  packed: string;
}

export interface REDcodeApi {
  readonly apiVersion: 1;
  readonly version: string;
  bridge(): BridgeClient | undefined;
  gamePath(): string | undefined;
  project(): ProjectRef | undefined;
  readonly onDidChangeProject: vscode.Event<ProjectRef | undefined>;
  /**
   * Imports a file under the project's source/raw into source/archive, as Import from Raw does. `texture`
   * sets an image's .xbm setup (REDcode issue 25, REDbridge 0.12.0); a REDcode with it answers the setup
   * read back as `texture`, an older one leaves it out.
   */
  importFile(file: string, options?: { template?: string; texture?: Record<string, string | boolean> }): Promise<{ ok: boolean; written: string[]; texture?: unknown }>;
  /** Packs the project and gets it into the game as fast as it allows (REDcode: Pack and Play). */
  packAndPlay(): Promise<"rednode" | "hot" | "installed" | undefined>;
}

/** A node of REDcode's TweakDB view, as its menus pass it (tweakView.ts). */
export interface TweakViewNode {
  kind: "record" | "type" | "group" | "note";
  ref?: { id: string; path: string | null; type: string };
}

/** REDcode's API, activating REDcode if needed. Throws with a message for the user when it is missing or too old. */
export async function redcode(): Promise<REDcodeApi> {
  const ext = vscode.extensions.getExtension<Partial<REDcodeApi> | undefined>(REDcodeId);
  if (!ext) throw new Error("EDGEhack needs REDcode for Cyberpunk 2077 (edgemodders.redcode-cyberpunk). Install it from the Marketplace.");
  const api = ext.isActive ? ext.exports : await ext.activate();
  if (!api || api.apiVersion !== 1 || typeof api.bridge !== "function") {
    const version = String((ext.packageJSON as { version?: string }).version ?? "unknown");
    throw new Error(`EDGEhack needs REDcode 0.10.5 or later, with its API version 1; REDcode ${version} is installed. Update REDcode.`);
  }
  return api as REDcodeApi;
}

/** REDcode's running REDbridge, or an error the user can act on. */
export async function bridge(): Promise<BridgeClient> {
  const b = (await redcode()).bridge();
  if (!b || b.running === false) throw new Error("REDcode's REDbridge is not running. Open REDcode's side bar, or run REDcode: Restart REDbridge.");
  return b;
}
