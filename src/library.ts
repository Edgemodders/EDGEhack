// The EDGE Library for quickhacks (H5; design, "H5 Library: plan"), by EDGEbuilder's shared rules
// (https://edgemodders.github.io/EDGEbuilder/library.html#shared-rules, draft 4: the kind quickhack,
// EDGEbuilder #5). No VS Code, so the MCP server uses it too.
//
// One root for every EDGE tool, in %APPDATA%\EDGE\library.json; the folders under it are the modder's.
// A quickhack is an item <id>.quickhack.asset\ with asset.json (format, id, name, kind, main, version) and
// source\raw\edgehack\<id>.quickhack.json, its own icons beside it: the Desk's shape, so Add to Library
// is a copy. asset.json's id is made once and kept, so adding the same quickhack again finds its item; the
// document's own id names the mod's records and has no mod name in the Library, as on the Desk. A project
// that takes an item notes it in source/library.json, the came-from note every tool writes the same way.
//
// The root, the folders and the note follow REDcode's library.ts and EDGEbuilder's bake.ts (both MIT).

import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { newDoc, newHackDoc, parseDoc, printDoc, safeId, type QuickhackDoc } from "./document";
import { projectPlace, writeToProject } from "./desk";
import { copyOwnIcons, iconsDir } from "./ownIcons";
import type { ProjectRef } from "./types";

export const ITEM_SUFFIX = ".quickhack.asset";
const ITEM_ENDING = /\.(asset|bake)$/i;
const mainOf = (id: string): string => ["source", "raw", "edgehack", `${id}.quickhack.json`].join("/");

// ---- the root ----------------------------------------------------------------------------------------

/** Where the EDGE tools keep the Library's root: `%APPDATA%\EDGE\library.json`, `{ "root": ... }`. EDGE_LIBRARY_CONFIG for tests. */
export function libraryConfigFile(env: NodeJS.ProcessEnv = process.env): string {
  if (env.EDGE_LIBRARY_CONFIG) return env.EDGE_LIBRARY_CONFIG;
  return path.join(env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "EDGE", "library.json");
}

export function readLibraryRoot(file = libraryConfigFile()): string | undefined {
  try {
    const root = (JSON.parse(fs.readFileSync(file, "utf8")) as { root?: unknown }).root;
    return typeof root === "string" && root.trim() ? root.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Makes the root folder and records it for every EDGE tool, keeping any other fields the file has. */
export function writeLibraryRoot(root: string, file = libraryConfigFile()): string {
  root = path.resolve(root);
  fs.mkdirSync(root, { recursive: true });
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    // the first tool to set it
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...data, root }, null, 2));
  return root;
}

/** The player's Documents folder, wherever Windows keeps it (OneDrive or another drive), else the usual place. */
function documentsFolder(): string {
  const fallback = path.join(os.homedir(), "Documents");
  if (process.platform !== "win32") return fallback;
  try {
    const out = execFileSync("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders", "/v", "Personal"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    const m = /Personal\s+REG_(?:EXPAND_)?SZ\s+(.+)/.exec(out);
    if (!m) return fallback;
    return m[1].trim().replace(/%([^%]+)%/g, (all, name: string) => process.env[name] ?? all);
  } catch {
    return fallback;
  }
}

/** The Library folder offered the first time: `Documents\EDGE Library`. */
export function suggestedLibraryRoot(): string {
  return path.join(documentsFolder(), "EDGE Library");
}

export function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The modder's folders under the root, with `/`, leaving out items and hidden folders. */
export function libraryFolders(root: string, cap = 2000): string[] {
  const found: string[] = [];
  const walk = (dir: string, rel: string, depth: number): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= cap) return;
      if (!e.isDirectory() || e.name.startsWith(".") || ITEM_ENDING.test(e.name)) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      found.push(child);
      if (depth < 16) walk(path.join(dir, e.name), child, depth + 1);
    }
  };
  walk(root, "", 0);
  return found.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** A folder under the root as the modder typed it, with `/`; throws on what could leave the root. "" is the root. */
export function safeFolder(folder: string | undefined): string {
  const parts = (folder ?? "").split(/[\\/]+/).filter((p) => p !== "");
  for (const p of parts) {
    if (p === "." || p === "..") throw new Error(`A Library folder cannot go through "${p}": ${folder}`);
    if (/[<>:"|?*\u0000-\u001f]/.test(p) || /[. ]$/.test(p)) throw new Error(`Not a folder name: "${p}"`);
    if (ITEM_ENDING.test(p)) throw new Error(`"${p}" is a Library item, not a folder.`);
  }
  return parts.join("/");
}

// ---- items -------------------------------------------------------------------------------------------

export interface ItemAsset {
  format: 1;
  id: string;
  name: string;
  kind: "quickhack";
  main: string;
  version: number;
  [more: string]: unknown;
}

export interface LibraryItem {
  /** The item's folder. */
  folder: string;
  /** The item's folder under the root, with `/`. */
  rel: string;
  /** The folder it sits in under the root, with `/`; "" for the root. */
  place: string;
  /** Its document. */
  file: string;
  asset: ItemAsset;
  modified: number;
  /** Undefined when the document cannot be read; `error` then says why. */
  doc?: QuickhackDoc;
  error?: string;
}

const toRel = (root: string, p: string): string => path.relative(root, p).split(path.sep).join("/");

function readAsset(folder: string): ItemAsset | undefined {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(folder, "asset.json"), "utf8")) as Partial<ItemAsset>;
    if (a.kind !== "quickhack" || typeof a.id !== "string" || typeof a.main !== "string") return undefined;
    return { ...a, format: 1, version: Number(a.version) || 1, name: typeof a.name === "string" ? a.name : path.basename(folder, ITEM_SUFFIX) } as ItemAsset;
  } catch {
    return undefined;
  }
}

function readItem(root: string, folder: string): LibraryItem | undefined {
  const asset = readAsset(folder);
  if (!asset) return undefined;
  const file = path.join(folder, ...asset.main.split("/"));
  if (!isInside(file, folder) || !fs.existsSync(file)) return undefined;
  const rel = toRel(root, folder);
  const item: LibraryItem = { folder, rel, place: rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "", file, asset, modified: fs.statSync(file).mtimeMs };
  try {
    item.doc = parseDoc(fs.readFileSync(file, "utf8"));
  } catch (e) {
    item.error = e instanceof Error ? e.message : String(e);
  }
  return item;
}

/** Every quickhack in the Library, by folder then name. Other kinds and other tools' items are passed over. */
export function libraryItems(root: string, cap = 5000): LibraryItem[] {
  const out: LibraryItem[] = [];
  const walk = (dir: string, depth: number): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= cap || !e.isDirectory() || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.name.toLowerCase().endsWith(ITEM_SUFFIX)) {
        const item = readItem(root, full);
        if (item) out.push(item);
      } else if (!ITEM_ENDING.test(e.name) && depth < 16) walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return out.sort((a, b) => a.place.localeCompare(b.place, undefined, { sensitivity: "base" }) || a.asset.name.localeCompare(b.asset.name, undefined, { sensitivity: "base" }));
}

/** The item a document belongs to, when it is in the Library. */
export function itemOfFile(root: string | undefined, file: string): LibraryItem | undefined {
  if (!root || !isInside(path.resolve(file), path.resolve(root))) return undefined;
  for (let dir = path.dirname(path.resolve(file)); isInside(dir, root) && dir !== path.resolve(root); dir = path.dirname(dir)) {
    if (dir.toLowerCase().endsWith(ITEM_SUFFIX)) return readItem(root, dir);
  }
  return undefined;
}

export function itemById(root: string, id: string): LibraryItem | undefined {
  return libraryItems(root).find((i) => i.asset.id === id);
}

/** A document's id with no mod in it, as in the Library and on the Desk. `modName` takes a project's prefix off. */
export function projectFreeId(doc: QuickhackDoc, modName?: string): string {
  const prefix = modName ? `${safeId(modName)}_` : "";
  if (prefix && doc.id.startsWith(prefix) && doc.id.length > prefix.length) return doc.id.slice(prefix.length);
  return doc.newHack ? newHackDoc("", doc.family, doc.name ?? doc.family).id : newDoc("", doc.family).id;
}

/** Thrown when an item for the same quickhack is there and replacing it was not asked for. */
export class LibraryItemExists extends Error {
  constructor(readonly item: LibraryItem) {
    super(`The Library already has ${item.asset.name}, in ${item.place || "its root"}.`);
  }
}

export interface AddSource {
  /** The document's file, for its own icons beside it. */
  file: string;
  doc: QuickhackDoc;
  /** The item's id when it came from the Library (a Desk copy, or a project's came-from note). */
  assetId?: string;
  name?: string;
  /** A project's mod name, so its prefix comes off the document's id. */
  modName?: string;
}

/**
 * Add to Library: the document (and its own icons) as an item in `folder`. The same quickhack again (by
 * its asset id) replaces the Library's copy where it is, raising its version, only with `replace`.
 */
export function addToLibrary(root: string, folder: string, source: AddSource, opts: { replace?: boolean } = {}): { item: LibraryItem; replaced: boolean } {
  const existing = source.assetId ? itemById(root, source.assetId) : undefined;
  if (existing && !opts.replace) throw new LibraryItemExists(existing);
  const id = projectFreeId(source.doc, source.modName);
  const doc: QuickhackDoc = { ...source.doc, id };
  const name = (source.name ?? doc.name ?? doc.family).trim() || doc.family;
  let target: string;
  let asset: ItemAsset;
  if (existing) {
    target = existing.folder;
    // The item's content is replaced whole, as the modder asked: a renamed document leaves no old file.
    fs.rmSync(path.join(target, "source"), { recursive: true, force: true });
    asset = { ...existing.asset, name, main: mainOf(id), version: existing.asset.version + 1 };
  } else {
    const parent = path.join(root, ...safeFolder(folder).split("/").filter(Boolean));
    target = path.join(parent, `${id}${ITEM_SUFFIX}`);
    for (let n = 2; fs.existsSync(target); n++) target = path.join(parent, `${id}_${n}${ITEM_SUFFIX}`);
    asset = { format: 1, id: source.assetId ?? crypto.randomBytes(8).toString("hex"), name, kind: "quickhack", main: mainOf(id), version: 1 };
  }
  const file = path.join(target, ...asset.main.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, printDoc(doc));
  copyOwnIcons(source.file, source.doc.id, file, id);
  fs.writeFileSync(path.join(target, "asset.json"), `${JSON.stringify(asset, null, 2)}\n`);
  return { item: readItem(root, target)!, replaced: !!existing };
}

/** After a save of a Library document: its item's version raised, and its name kept the document's. */
export function savedInLibrary(root: string, file: string, name: string | undefined): LibraryItem | undefined {
  const item = itemOfFile(root, file);
  if (!item) return undefined;
  const asset = { ...item.asset, version: item.asset.version + 1, ...(name?.trim() ? { name: name.trim() } : {}) };
  fs.writeFileSync(path.join(item.folder, "asset.json"), `${JSON.stringify(asset, null, 2)}\n`);
  return { ...item, asset };
}

// ---- the came-from note ------------------------------------------------------------------------------

/** One item of a project's `source/library.json`. Other tools' items are kept as they are. */
export interface NoteItem {
  id?: string;
  kind: string;
  path: string;
  version?: number;
  hash?: string;
  added: string;
  by: string;
  files: string[];
  [more: string]: unknown;
}

const noteFile = (projectDir: string) => path.join(projectDir, "source", "library.json");

export function readNote(projectDir: string): { format: 1; items: NoteItem[] } {
  try {
    const data = JSON.parse(fs.readFileSync(noteFile(projectDir), "utf8"));
    if (Array.isArray(data?.items)) return { ...data, format: 1, items: data.items };
  } catch {
    // none yet, or not readable: a new one is written
  }
  return { format: 1, items: [] };
}

function writeNote(projectDir: string, note: { format: 1; items: NoteItem[] }): void {
  fs.mkdirSync(path.dirname(noteFile(projectDir)), { recursive: true });
  fs.writeFileSync(noteFile(projectDir), JSON.stringify(note, null, 2));
}

/** EDGEhack's entry for a project's document, when it came from the Library or went to it. */
export function noteOfDoc(project: ProjectRef, file: string): NoteItem | undefined {
  const rel = toRel(project.dir, file);
  return readNote(project.dir).items.find((i) => i.by === "edgehack" && i.kind === "quickhack" && i.files[0] === rel);
}

/** Notes that a project's document is the Library item's, at its version: other entries are kept, this one's replaced. */
export function noteQuickhack(project: ProjectRef, docFile: string, item: LibraryItem, root: string): NoteItem {
  const rel = toRel(project.dir, docFile);
  const icons = iconsDir(docFile, path.basename(docFile).replace(/\.quickhack\.json$/, ""));
  const files = [rel, ...(fs.existsSync(icons) ? fs.readdirSync(icons).map((f) => toRel(project.dir, path.join(icons, f))) : [])];
  const entry: NoteItem = { id: item.asset.id, kind: "quickhack", path: toRel(root, item.folder), version: item.asset.version, added: new Date().toISOString(), by: "edgehack", files };
  const note = readNote(project.dir);
  note.items = [...note.items.filter((i) => !(i.by === "edgehack" && i.kind === "quickhack" && (i.id === entry.id || i.files[0] === rel))), entry];
  writeNote(project.dir, note);
  return entry;
}

/**
 * Add to Project from the Library: the item's document under the project's names, its own icons with it,
 * and the came-from note. A project that has it already gets it again only with `replace`. The mod's files
 * are the caller's to write (saveDocFiles), as after a Desk's Add to Project.
 */
export function libraryToProject(project: ProjectRef, item: LibraryItem, familyKeys: string[], root: string, opts: { replace?: boolean } = {}): { file: string; doc: QuickhackDoc; added: boolean; replaces: boolean } {
  if (!item.doc) throw new Error(item.error ?? `${item.asset.name} cannot be read.`);
  const place = projectPlace(project, familyKeys, item.doc);
  if (place.replaces && !opts.replace) return { file: place.file, doc: place.doc, added: false, replaces: true };
  writeToProject(place, { file: item.file, id: item.doc.id });
  noteQuickhack(project, place.file, item, root);
  return { file: place.file, doc: place.doc, added: true, replaces: place.replaces };
}

/** The project's quickhacks whose Library item has a newer version than the project took. */
export function newerInLibrary(project: ProjectRef, root: string): { file: string; entry: NoteItem; item: LibraryItem }[] {
  const items = libraryItems(root);
  const out: { file: string; entry: NoteItem; item: LibraryItem }[] = [];
  for (const entry of readNote(project.dir).items) {
    if (entry.by !== "edgehack" || entry.kind !== "quickhack" || !entry.files[0]) continue;
    const item = items.find((i) => i.asset.id === entry.id) ?? items.find((i) => i.rel === entry.path);
    const file = path.join(project.dir, ...entry.files[0].split("/"));
    if (item && fs.existsSync(file) && item.asset.version > (entry.version ?? 0)) out.push({ file, entry, item });
  }
  return out;
}
