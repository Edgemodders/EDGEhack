// Packing a project for hack_pack (H4.5), free of VS Code: the archive through REDbridge's packer
// (WolvenKit's), and the resources copied by WolvenKit's rules, as REDcode's Pack does for a plain
// archive mod (REDcode, MIT: extensions/redcode/src/pack.ts, its non-REDmod path). An EDGEhack mod is
// never a REDmod, so the REDmod parts are left out. In VS Code, REDcode's own Pack and Play is used.

import * as fs from "node:fs";
import * as path from "node:path";
import type { BridgeClient, ProjectRef } from "./types";

export interface PackSummary {
  /** The archive written, or undefined when source/archive had no files. */
  archive?: string;
  archiveFiles: number;
  /** Paths under source/archive with capital letters or spaces, which the game may not resolve. */
  warnings: string[];
  /** Resource files copied into packed, relative to source/resources; ArchiveXL files go beside the archive. */
  resources: string[];
  /** Tweak files outside r6/tweaks, which TweakXL does not read; .tweak ones are also left out, as WolvenKit does. */
  misplacedTweaks: string[];
  packedDir: string;
  archiveDir: string;
}

const TWEAKS = new Set([".tweak", ".yaml", ".yml"]);

/** Packs the project into its packed folder, emptied first (as REDcode's default), so nothing removed from the project lingers. */
export async function packProject(bridge: BridgeClient, project: ProjectRef): Promise<PackSummary> {
  const packed = project.packed;
  const archiveDir = path.join(packed, "archive", "pc", "mod");
  const summary: PackSummary = { archiveFiles: 0, warnings: [], resources: [], misplacedTweaks: [], packedDir: packed, archiveDir };
  if (fs.existsSync(packed)) emptyFolder(packed);
  fs.mkdirSync(packed, { recursive: true });

  if (walk(project.archive).length) {
    const r = await bridge.pack(project.archive, archiveDir, project.modName);
    summary.archive = r.archive;
    summary.archiveFiles = r.files;
    summary.warnings = r.warnings ?? [];
  }

  for (const file of walk(project.resources)) {
    const rel = path.relative(project.resources, file);
    const name = path.basename(file);
    const ext = path.extname(name).toLowerCase();
    if (ext === ".xl") {
      copy(file, path.join(archiveDir, name));
      summary.resources.push(rel);
    } else if (name.toLowerCase() === "info.json" || ext === ".script" || ext === ".ws") {
      // a REDmod's manifest and CDPR script sources: only a REDmod carries them
    } else if (ext === ".tweak" && !isUnder(rel, "r6", "tweaks")) {
      summary.misplacedTweaks.push(rel);
    } else {
      copy(file, path.join(packed, rel));
      summary.resources.push(rel);
      if (TWEAKS.has(ext) && !isUnder(rel, "r6", "tweaks")) summary.misplacedTweaks.push(rel);
    }
  }
  return summary;
}

function isUnder(rel: string, ...folders: string[]): boolean {
  const parts = rel.split(/[\\/]/).map((p) => p.toLowerCase());
  return parts.length > folders.length && folders.every((f, i) => parts[i] === f);
}

function copy(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/** Every file under dir, or nothing when the folder is missing. */
export function walk(dir: string): string[] {
  const out: string[] = [];
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) pending.push(full);
      else if (e.isFile()) out.push(full);
    }
  }
  return out;
}

/** Deletes the files under dir, then the folders left empty, keeping dir. A file in use stops it with a message. */
function emptyFolder(dir: string): void {
  for (const file of walk(dir)) {
    try {
      fs.rmSync(file, { force: true, maxRetries: 5, retryDelay: 200 });
    } catch (e) {
      throw new Error(`Could not empty ${dir}: ${file} is in use (${(e as NodeJS.ErrnoException).code ?? ""}). Close what has it open, such as the game, then pack again.`);
    }
  }
  const subs: string[] = [];
  const pending = [dir];
  while (pending.length) {
    const current = pending.shift()!;
    for (const e of fs.readdirSync(current, { withFileTypes: true })) {
      if (e.isDirectory()) {
        subs.push(path.join(current, e.name));
        pending.push(path.join(current, e.name));
      }
    }
  }
  for (const sub of subs.reverse()) {
    try {
      fs.rmdirSync(sub);
    } catch {
      // held open, or not empty: left
    }
  }
}
