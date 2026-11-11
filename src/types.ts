// The types EDGEhack's core works with, free of VS Code (H4.4): REDbridge's answers, the part of a
// REDbridge client EDGEhack calls, and a WolvenKit project. In VS Code the client is REDcode's
// (redcode.ts); outside it, EDGEhack's own (redbridge.ts) or REDnode's shared one. The shapes copy
// REDcode's (MIT; extensions/redcode/src/types.ts and bridgeClient.ts there), never imported.

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

/** What project.import answers: the files written, relative to the archive folder, and an image's texture setup read back. */
export interface ImportAnswer {
  ok: boolean;
  written: string[];
  texture?: unknown | null;
}

/**
 * The part of a REDbridge client EDGEhack uses. Its methods mirror REDbridge's JSON-RPC methods, with
 * the names and parameters of REDcode's client, so REDcode's object fits it as it is.
 */
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
  /**
   * project.import: a file under rawDir into archiveDir, through WolvenKit's importer. `texture` (REDbridge
   * 0.12.0) sets an image's .xbm setup. In VS Code, EDGEhack imports icons through REDcode's API instead, which also shows them in its Project view.
   */
  importFile(file: string, rawDir: string, archiveDir: string, keep?: boolean, template?: string, texture?: string | Record<string, string | boolean>): Promise<ImportAnswer>;
  /** project.pack: a folder (a project's source/archive) into outDir/modName.archive (REDbridge 0.6.0). For hack_pack (H4.5). */
  pack(dir: string, outDir: string, modName: string): Promise<{ archive?: string; files?: number }>;
}

/** A WolvenKit project, as REDcode's API gives it, with its folders. */
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

/** A node of REDcode's TweakDB view, as its menus pass it (tweakView.ts). */
export interface TweakViewNode {
  kind: "record" | "type" | "group" | "note";
  ref?: { id: string; path: string | null; type: string };
}
