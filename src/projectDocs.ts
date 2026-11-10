// A REDcode project's quickhack documents: finding them, making a new quickhack, and writing a
// document's mod files. No VS Code, so the MCP server (H4) can use it too (docs/design.md, "MCP tools").
import * as fs from "node:fs";
import * as path from "node:path";
import type { BridgeClient, ProjectRef } from "./redcode";
import { newDoc, newHackDoc, parseDoc, printDoc, QuickhackDoc, safeId } from "./document";
import type { Family } from "./read";
import { writeTweaks } from "./tweaks";
import type { Sales } from "./getit";
import type { ResolvedAdded } from "./effects";
import { ProjectResult, writeProject, yamlFile } from "./projectFiles";
import { atlasPaths, iconsDir, IconWriter, writeOwnIcons } from "./ownIcons";

/** Where a document lives in a project: source/raw/edgehack/<id>.quickhack.json. */
export const docFile = (project: ProjectRef, id: string): string => path.join(project.raw, "edgehack", `${id}.quickhack.json`);

export interface ProjectDoc {
  file: string;
  /** Undefined when the file cannot be read as a document; `error` then says why. */
  doc?: QuickhackDoc;
  error?: string;
}

/** The project's quickhack documents, by file name. */
export function projectDocs(project: ProjectRef): ProjectDoc[] {
  const folder = path.join(project.raw, "edgehack");
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".quickhack.json"))
    .sort()
    .map((f) => {
      const file = path.join(folder, f);
      try {
        return { file, doc: parseDoc(fs.readFileSync(file, "utf8")) };
      } catch (e) {
        return { file, error: e instanceof Error ? e.message : String(e) };
      }
    });
}

/**
 * What is wrong with a new quickhack's name, in words, or undefined when it can be used. A name fixes the
 * records' ids, so it must make an id, a free one, and not the one a change to a game family would take.
 */
export function newHackProblem(project: ProjectRef, familyKeys: string[], family: string, name: string): string | undefined {
  if (!name.trim()) return "A new quickhack needs a name.";
  if (!safeId(name)) return "The name needs at least one letter from A to Z or a digit: its record names come from them.";
  const doc = newHackDoc(project.modName, family, name.trim());
  if (fs.existsSync(docFile(project, doc.id))) return `This project already has ${doc.id}.quickhack.json. Choose another name, or open that one.`;
  const clash = familyKeys.find((key) => newDoc(project.modName, key).id === doc.id);
  if (clash) return `That name would take the file for changes to the game's ${clash}. Choose another.`;
  return undefined;
}

/** Writes a new quickhack's document. Throws what newHackProblem says. */
export function makeNewHackDoc(project: ProjectRef, familyKeys: string[], family: string, name: string): { file: string; doc: QuickhackDoc } {
  const problem = newHackProblem(project, familyKeys, family, name);
  if (problem) throw new Error(problem);
  const doc = newHackDoc(project.modName, family, name.trim());
  const file = docFile(project, doc.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, printDoc(doc));
  return { file, doc };
}

/**
 * What a document put into the project, that Remove from Project takes out: the document, its own icons'
 * pictures, its TweakXL file, and its icons' texture and atlas. Only those that exist. Its texts are in the
 * shared onscreens file (removeTexts), and the shared script stays, since other documents may need it.
 */
export function projectFilesOf(project: ProjectRef, id: string): string[] {
  const doc = docFile(project, id);
  const icons = atlasPaths(id);
  return [doc, iconsDir(doc, id), yamlFile(project, id), path.join(project.raw, icons.png), path.join(project.archive, icons.xbm), path.join(project.archive, icons.atlas)].filter((f) => fs.existsSync(f));
}

/** A document's mod files, written into the project. `added` is its added effects, read; `sales`, how the game hands out its family (Get it). */
export async function writeDocFiles(
  project: ProjectRef,
  bridge: BridgeClient,
  fam: Family,
  doc: QuickhackDoc,
  added: ResolvedAdded[] = [],
  sales?: Sales,
  icons?: IconWriter,
): Promise<ProjectResult> {
  const result = await writeProject(project, bridge, doc, writeTweaks(fam, doc, added, sales));
  // Its own icons' texture and atlas (H3b), or the removal of an earlier save's when it has none now.
  if (icons) result.created.push(...(await writeOwnIcons({ raw: project.raw, archive: project.archive }, icons, doc, docFile(project, doc.id))));
  else if (doc.ownIcons) throw new Error("This quickhack has its own icons, and nothing was given to write them.");
  return result;
}
