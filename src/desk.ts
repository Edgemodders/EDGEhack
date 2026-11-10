// The Desk (H3.7): quickhacks being worked on outside any project, in %LOCALAPPDATA%\EDGEhack\desk. Each
// is a folder in the EDGE Library's item shape, <id>.quickhack.asset\ with asset.json and
// source\raw\edgehack\<id>.quickhack.json, so Add to Library (H5) is a copy (docs/design.md, "Desk and
// Library"). No VS Code, so the MCP server (H4) can use it too.
//
// A document's id names its records, and the mod's name is part of it, so a Desk document has an id of its
// own (its name, or its family for a change) and takes the project's when it is added to one. Nothing is
// written into a game or a project from the Desk: no YAML until Add to Project.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { newDoc, newHackDoc, parseDoc, printDoc, QuickhackDoc, safeId } from "./document";
import type { ProjectRef } from "./redcode";
import { docFile, newHackProblem } from "./projectDocs";
import { copyOwnIcons } from "./ownIcons";

/** The Desk's folder: EDGEHACK_DESK when set (tests, the smoke test), else %LOCALAPPDATA%\EDGEhack\desk. */
export function deskRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.EDGEHACK_DESK) return env.EDGEHACK_DESK;
  return path.join(env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share"), "EDGEhack", "desk");
}

/** The shared fields of an EDGE Library item (EDGEbuilder's docs/library.md, "Items"). */
export interface DeskAsset {
  format: 1;
  /** Made once, never changed. */
  id: string;
  name: string;
  kind: "quickhack";
  /** The document, from the item's folder. */
  main: string;
  /** Raised by each save. */
  version: number;
}

export interface DeskItem {
  folder: string;
  file: string;
  /** When the document was last written, for newest first. */
  modified: number;
  /** Undefined when the file cannot be read as a document; `error` then says why. */
  doc?: QuickhackDoc;
  error?: string;
}

const SUFFIX = ".quickhack.asset";
const main = (id: string): string => path.join("source", "raw", "edgehack", `${id}.quickhack.json`);
const folderOf = (root: string, id: string): string => path.join(root, `${id}${SUFFIX}`);

/** True when a file is on the Desk. */
export function onDesk(file: string, root = deskRoot()): boolean {
  const rel = path.relative(root, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** The Desk's quickhacks, newest first. */
export function deskItems(root = deskRoot()): DeskItem[] {
  if (!fs.existsSync(root)) return [];
  const out: DeskItem[] = [];
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith(SUFFIX)) continue;
    const folder = path.join(root, name);
    const file = path.join(folder, main(name.slice(0, -SUFFIX.length)));
    if (!fs.existsSync(file)) continue;
    const modified = fs.statSync(file).mtimeMs;
    try {
      out.push({ folder, file, modified, doc: parseDoc(fs.readFileSync(file, "utf8")) });
    } catch (e) {
      out.push({ folder, file, modified, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out.sort((a, b) => b.modified - a.modified || a.folder.localeCompare(b.folder));
}

function write(root: string, doc: QuickhackDoc, name: string): DeskItem {
  const folder = folderOf(root, doc.id);
  const file = path.join(folder, main(doc.id));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const asset: DeskAsset = { format: 1, id: crypto.randomBytes(8).toString("hex"), name, kind: "quickhack", main: main(doc.id).split(path.sep).join("/"), version: 1 };
  fs.writeFileSync(path.join(folder, "asset.json"), `${JSON.stringify(asset, null, 2)}\n`);
  fs.writeFileSync(file, printDoc(doc));
  return { folder, file, modified: fs.statSync(file).mtimeMs, doc };
}

/** A new quickhack's document on the Desk: its id from its name alone, since there is no mod yet. */
export function deskNewHackDoc(family: string, name: string): QuickhackDoc {
  return newHackDoc("", family, name);
}

/**
 * What is wrong with a new quickhack's name on the Desk, in words, or undefined when it can be used. The
 * same rules as in a project, against the Desk's folders.
 */
export function deskNewHackProblem(root: string, familyKeys: string[], family: string, name: string): string | undefined {
  if (!name.trim()) return "A new quickhack needs a name.";
  if (!safeId(name)) return "The name needs at least one letter from A to Z or a digit: its record names come from them.";
  const id = deskNewHackDoc(family, name.trim()).id;
  if (fs.existsSync(folderOf(root, id))) return `The Desk already has ${id}. Choose another name, or open that one.`;
  const clash = familyKeys.find((key) => newDoc("", key).id === id);
  if (clash) return `That name would take the Desk's place for changes to the game's ${clash}. Choose another.`;
  return undefined;
}

/** Makes a new quickhack on the Desk. Throws what deskNewHackProblem says. */
export function makeDeskNewHack(root: string, familyKeys: string[], family: string, name: string): DeskItem {
  const problem = deskNewHackProblem(root, familyKeys, family, name);
  if (problem) throw new Error(problem);
  return write(root, deskNewHackDoc(family, name.trim()), name.trim());
}

/** The Desk's document for changes to a game family, made if it has none. */
export function deskChange(root: string, family: string, familyName = family): DeskItem {
  const doc = newDoc("", family);
  const existing = deskItems(root).find((i) => path.basename(i.folder) === `${doc.id}${SUFFIX}`);
  return existing ?? write(root, doc, familyName);
}

/**
 * After a save on the Desk: raises the item's version in its asset.json, as the shared rules ask for each
 * change, and keeps its name the document's. Quiet when it has none.
 */
export function savedOnDesk(file: string, name: string | undefined, root = deskRoot()): void {
  const rel = path.relative(root, file).split(path.sep);
  const assetFile = path.join(root, rel[0], "asset.json");
  if (!fs.existsSync(assetFile)) return;
  try {
    const asset = JSON.parse(fs.readFileSync(assetFile, "utf8")) as DeskAsset;
    asset.version = (Number(asset.version) || 0) + 1;
    if (name?.trim()) asset.name = name.trim();
    fs.writeFileSync(assetFile, `${JSON.stringify(asset, null, 2)}\n`);
  } catch {
    // A broken asset.json is the modder's to fix; the document itself was saved.
  }
}

/** A free name for a copy of a new quickhack: "<name> copy", then "copy 2" and so on. */
export function copyName(root: string, familyKeys: string[], doc: QuickhackDoc): string {
  const base = `${doc.name ?? doc.family} copy`;
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!deskNewHackProblem(root, familyKeys, doc.family, name)) return name;
  }
}

/** A copy of a new quickhack on the Desk, with another name, so another id. Throws for a change to a game family. */
export function duplicateDeskItem(root: string, familyKeys: string[], item: DeskItem, name: string): DeskItem {
  if (!item.doc) throw new Error(item.error ?? "This document cannot be read.");
  if (!item.doc.newHack) throw new Error("A change to a game quickhack has one place on the Desk; Duplicate copies new quickhacks.");
  const problem = deskNewHackProblem(root, familyKeys, item.doc.family, name);
  if (problem) throw new Error(problem);
  const fresh = deskNewHackDoc(item.doc.family, name.trim());
  const copy = write(root, { ...item.doc, id: fresh.id, name: name.trim() }, name.trim());
  copyOwnIcons(item.file, item.doc.id, copy.file, fresh.id);
  return copy;
}

/** Where a Desk document goes in a project, and whether a document is already there. */
export interface ProjectPlace {
  file: string;
  doc: QuickhackDoc;
  /** The project already has a document at that place: adding again replaces it. */
  replaces: boolean;
}

/**
 * Where Add to Project puts a Desk document: its id becomes the project's (the mod's name and the
 * quickhack's), the rest stays as it is. Throws, in words, when the name cannot go into that project.
 */
export function projectPlace(project: ProjectRef, familyKeys: string[], doc: QuickhackDoc): ProjectPlace {
  if (doc.newHack) {
    const name = (doc.name ?? "").trim();
    const id = newHackDoc(project.modName, doc.family, name).id;
    const file = docFile(project, id);
    const replaces = fs.existsSync(file);
    if (!replaces) {
      const problem = newHackProblem(project, familyKeys, doc.family, name);
      if (problem) throw new Error(problem);
    } else {
      // The file there must be this quickhack, a new one from the same family, not something else.
      let there: QuickhackDoc | undefined;
      try {
        there = parseDoc(fs.readFileSync(file, "utf8"));
      } catch {
        there = undefined;
      }
      if (!there?.newHack || there.family !== doc.family) throw new Error(`The project already has ${id}.quickhack.json, and it is not this quickhack. Rename this one on the Desk first.`);
    }
    return { file, doc: { ...doc, id }, replaces };
  }
  const id = newDoc(project.modName, doc.family).id;
  const file = docFile(project, id);
  return { file, doc: { ...doc, id }, replaces: fs.existsSync(file) };
}

/** Writes a Desk document into the project, at the place projectPlace gave. */
/** Writes the document into the project; `from`, the Desk's document, whose own icons go with it (H3b). */
export function writeToProject(place: ProjectPlace, from?: { file: string; id: string }): void {
  fs.mkdirSync(path.dirname(place.file), { recursive: true });
  fs.writeFileSync(place.file, printDoc(place.doc));
  if (from) copyOwnIcons(from.file, from.id, place.file, place.doc.id);
}
