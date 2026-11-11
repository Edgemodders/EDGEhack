// Writes what a quickhack document makes into REDcode's project: the YAML under
// source/resources/r6/tweaks/<mod>/, and the texts into the project's onscreens file (made with its .xl
// by REDbridge when the project has none). No VS Code: the editor passes the project and the bridge.
import * as fs from "node:fs";
import * as path from "node:path";
import type { BridgeClient, ProjectRef } from "./redcode";
import type { QuickhackDoc } from "./document";
import type { TextEntry, WrittenTweaks } from "./tweaks";
import { NEW_HACK_SCRIPT_PATH } from "./newHackScript";

const MADE_BY = "# Made by EDGEhack";

export interface ProjectResult {
  /** The YAML file, or undefined when the document changes nothing. */
  yaml?: string;
  /** The onscreens file, when it was touched. */
  texts?: string;
  /** The script a new quickhack needs, when the document wrote it. */
  script?: string;
  /** The files this write added to the project: they did not exist before. */
  created: string[];
  /** The mod's REDnode package, when a quickhack of the project has a script (H3c.3). */
  scripts?: string;
  /** Quickhacks whose script file is missing, so main.mjs left them out. */
  missingScripts?: string[];
}

/** True when a file is inside a folder. */
export function isInside(file: string, folder: string): boolean {
  const rel = path.relative(folder, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** The entries of an onscreens file's JSON with this document's replaced, and everyone else's kept. */
export function mergeEntries(json: string, id: string, texts: TextEntry[]): string {
  const doc = JSON.parse(json);
  const root = doc?.Data?.RootChunk?.root?.Data;
  if (!root) throw new Error("The project's onscreens file is not one EDGEhack can read.");
  const prefix = `EDGEhack-${id}-`;
  const kept = ((root.entries ?? []) as { secondaryKey?: string }[]).filter((e) => !e.secondaryKey?.startsWith(prefix));
  root.entries = [
    ...kept,
    // primaryKey 0: ArchiveXL makes the key from the secondary key.
    ...texts.map((t) => ({ $type: "localizationPersistenceOnScreenEntry", femaleVariant: t.text, maleVariant: "", primaryKey: "0", secondaryKey: t.key })),
  ];
  return JSON.stringify(doc);
}

/** Where a document's TweakXL file goes in the project. */
export const yamlFile = (project: ProjectRef, id: string): string => path.join(project.resources, "r6", "tweaks", project.modName, `${id}.yaml`);

/** Takes a document's texts out of the project's onscreens file. Answers whether the file changed. */
export async function removeTexts(project: ProjectRef, bridge: BridgeClient, id: string): Promise<boolean> {
  const files = await bridge.locProjectFiles(project.dir, "en-us");
  const existing = files.find((f) => f.exists)?.file;
  if (!existing) return false;
  const full = path.join(project.dir, existing);
  const before = (await bridge.fileToJson(full)).json;
  if (typeof before !== "string") throw new Error(`REDbridge could not read ${existing}.`);
  const after = mergeEntries(before, id, []);
  if (after === JSON.stringify(JSON.parse(before))) return false;
  await bridge.fromJson(full, { json: after });
  return true;
}

export async function writeProject(project: ProjectRef, bridge: BridgeClient, doc: QuickhackDoc, written: WrittenTweaks): Promise<ProjectResult> {
  const result: ProjectResult = { created: [] };
  const yaml = yamlFile(project, doc.id);
  if (fs.existsSync(yaml) && !fs.readFileSync(yaml, "utf8").startsWith(MADE_BY)) {
    throw new Error(`${yaml} exists and was not made by EDGEhack, so it was left alone. Move or rename it.`);
  }
  if (written.yaml) {
    if (!fs.existsSync(yaml)) result.created.push(yaml);
    fs.mkdirSync(path.dirname(yaml), { recursive: true });
    fs.writeFileSync(yaml, written.yaml);
    result.yaml = yaml;
  } else {
    fs.rmSync(yaml, { force: true });
  }

  // Never removed: another document in the project may need it, and it does nothing with no new hack.
  if (written.script) {
    const file = path.join(project.resources, ...NEW_HACK_SCRIPT_PATH);
    if (!fs.existsSync(file)) result.created.push(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, written.script);
    result.script = file;
  }

  const files = await bridge.locProjectFiles(project.dir, "en-us");
  const existing = files.find((f) => f.exists)?.file;
  if (existing || written.texts.length) {
    const file = existing ?? (await bridge.locNewFile(project.dir, project.modName, "en-us")).file;
    const full = path.join(project.dir, file);
    if (!existing) result.created.push(full);
    const before = (await bridge.fileToJson(full)).json;
    if (typeof before !== "string") throw new Error(`REDbridge could not read ${file}.`);
    const after = mergeEntries(before, doc.id, written.texts);
    if (after !== JSON.stringify(JSON.parse(before))) {
      await bridge.fromJson(full, { json: after });
      result.texts = full;
    }
  }
  return result;
}
