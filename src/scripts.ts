// A quickhack's script (H3c.3; design, "H3c Scripts: plan"): two REDnode functions, a scan check
// (canUse) and an on-land function (onLand), in a file of the modder's own, run in the game by REDnode
// 0.61.1 or later through `quickhacks.define`. The mod gets one REDnode package in its project,
// source/resources/red4ext/plugins/REDnode/apps/<package>/, so Pack and Play installs it with the rest:
//
//   <quickhack id>.mjs     the modder's, one per quickhack. EDGEhack writes a function into it only when
//                          the modder presses Add for it, and never changes what is there
//   main.mjs               EDGEhack's: defines every quickhack of the project that has a script, with
//                          its items lowest tier first. Written again at each save
//   rednode-app.json       EDGEhack's: the package's manifest
//   quickhacks.d.ts        EDGEhack's: the types the script files name in their JSDoc
//
// No VS Code, so the MCP server (H4) can use it too.
import * as fs from "node:fs";
import * as path from "node:path";
import type { ProjectRef } from "./redcode";
import type { QuickhackDoc } from "./document";
import type { Family } from "./read";
import { newItemPath } from "./tweaks";

export const SCRIPT_FUNCTIONS = ["canUse", "onLand"] as const;
export type ScriptFunction = (typeof SCRIPT_FUNCTIONS)[number];

/** The REDnode that has `quickhacks.define` as EDGEhack uses it (REDnode #42). */
export const REDNODE_NEEDED = ">=0.61.1";

/** What a disabled hack says on the wheel when the document sets nothing. REDnode's own default. */
export const DEFAULT_DISABLED_TEXT = "Not on this target";

const MADE_BY = "Made by EDGEhack";

/** The mod's REDnode package id: the mod's name in lowercase letters, digits, - and _. */
export function packageId(modName: string): string {
  const id = modName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);
  return /^[a-z0-9]/.test(id) ? id : `edgehack-${id || "mod"}`.slice(0, 64);
}

/** Where the mod's REDnode package goes in the project. */
export const packageDir = (project: Pick<ProjectRef, "resources" | "modName">): string =>
  path.join(project.resources, "red4ext", "plugins", "REDnode", "apps", packageId(project.modName));

/** A quickhack's script file name, in the package. */
export const scriptFileName = (doc: Pick<QuickhackDoc, "id">): string => `${doc.id}.mjs`;

/** The functions a script file exports, as far as a plain read of its text can tell. */
export function exportsOf(text: string): ScriptFunction[] {
  return SCRIPT_FUNCTIONS.filter((fn) => new RegExp(`^\\s*export\\s+(?:(?:async\\s+)?function\\s*\\*?\\s*${fn}\\b|(?:const|let|var)\\s+${fn}\\b)`, "m").test(text));
}

/** A script's first lines, when Add makes the file. */
export function scriptHeader(name: string): string {
  return `// ${name}'s script: REDnode runs it in the game (REDnode 0.61.1 or later). This file is yours:
// EDGEhack only adds a function here when you press Add on the quickhack's page, and never changes
// what is here. Remove a function you do not need. Docs: https://edgemodders.github.io/REDnode/quickhacks.html
// The rednode package works here too: import { api, game } from "rednode".
`;
}

/** A function's starting code, with its JSDoc. */
export function functionStub(fn: ScriptFunction, name: string): string {
  if (fn === "canUse") {
    return `
/**
 * Whether ${name} shows usable on this person when V scans them. While it runs the hack shows
 * "Checking...", held for a second the first time V scans someone. Answer from \`target\` alone and it is
 * quick; each game call costs about a frame. Return false to disable it, with the page's text.
 * @param {import("./quickhacks").QuickhackTarget} target
 * @param {import("./quickhacks").QuickhackUse} hack
 * @returns {boolean | Promise<boolean>}
 */
export function canUse(target, hack) {
  return true;
}
`;
  }
  return `
/**
 * Runs when ${name} lands on a living person, a frame or two after what its records do. It adds to the
 * hack and cannot cancel it. \`target.damage(amount)\` and \`target.addEffect(id)\` act as V.
 * @param {import("./quickhacks").QuickhackTarget} target
 * @param {import("./quickhacks").QuickhackUse} hack
 */
export async function onLand(target, hack) {
  // For example, more damage on the wounded, by tier (1 is Common):
  // if (target.healthPercent < 50) await target.damage(20 * hack.tier);
}
`;
}

/**
 * Adds a function to a script file: makes the file when there is none, appends the function when the file
 * does not export it. Never changes what is there. Answers what it did.
 */
export function addFunction(file: string, fn: ScriptFunction, name: string): "created" | "added" | "there" {
  const exists = fs.existsSync(file);
  const text = exists ? fs.readFileSync(file, "utf8") : "";
  if (exportsOf(text).includes(fn)) return "there";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, exists ? `${text.replace(/\s*$/, "\n")}${functionStub(fn, name)}` : `${scriptHeader(name)}${functionStub(fn, name)}`);
  return exists ? "added" : "created";
}

/** The line a function starts on in a script's text, from 0, or undefined. */
export function lineOf(text: string, fn: ScriptFunction): number | undefined {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => new RegExp(`^\\s*export\\s+(?:(?:async\\s+)?function\\s*\\*?\\s*${fn}\\b|(?:const|let|var)\\s+${fn}\\b)`).test(l));
  return at < 0 ? undefined : at;
}

/** The items `quickhacks.define` takes for a document: the mod's own for a new quickhack, the game's for a change, lowest tier first. */
export function itemsOf(fam: Family, doc: QuickhackDoc): string[] {
  return [...fam.tiers]
    .filter((t) => t.item)
    .sort((a, b) => a.rank - b.rank)
    .map((t) => (doc.newHack ? newItemPath(doc, t) : (t.item as string)));
}

/** One quickhack in main.mjs. */
export interface ScriptEntry {
  /** As players see it, for the log. */
  name: string;
  items: string[];
  /** The script file's name in the package. */
  file: string;
  disabledText?: string;
}

/** main.mjs: defines each quickhack with the functions its file exports. */
export function mainSource(entries: ScriptEntry[]): string {
  const imports = entries.map((e, i) => `import * as script${i} from ${JSON.stringify(`./${e.file}`)};`).join("\n");
  const list = entries
    .map(
      (e, i) =>
        `  { name: ${JSON.stringify(e.name)}, script: script${i}, items: [${e.items.map((item) => JSON.stringify(item)).join(", ")}]${e.disabledText ? `, disabledText: ${JSON.stringify(e.disabledText)}` : ""} },`,
    )
    .join("\n");
  return `// ${MADE_BY}: written again each time a quickhack with a script is saved. Change the quickhacks'
// own script files, not this one.
import { quickhacks } from "rednode";
${imports}

const hacks = [
${list}
];

for (const h of hacks) {
  const canUse = typeof h.script.canUse === "function" ? h.script.canUse : undefined;
  const onLand = typeof h.script.onLand === "function" ? h.script.onLand : undefined;
  if (!canUse && !onLand) {
    console.warn(\`\${h.name}: its script exports neither canUse nor onLand, so it does nothing\`);
    continue;
  }
  quickhacks.define(h.items, { canUse, onLand, disabledText: h.disabledText }).catch((err) => console.error(\`\${h.name}: \${err.message}\`));
}
`;
}

/** The package's manifest. */
export function manifestOf(modName: string): Record<string, unknown> {
  return {
    id: packageId(modName),
    name: `${modName} quickhacks`,
    version: "1.0.0",
    description: `The quickhacks' scripts of ${modName}. ${MADE_BY}.`,
    main: "main.mjs",
    requires: { rednode: REDNODE_NEEDED },
  };
}

/** The types the script files name in their JSDoc, after REDnode's quickhacks.ts. */
export const TYPES_SOURCE = `// ${MADE_BY}: the types of REDnode's quickhacks.define (REDnode 0.61.1), for the script files' JSDoc.
// Written again at each save. Docs: https://edgemodders.github.io/REDnode/quickhacks.html

/** The person a function is about, as they were when the game asked. */
export interface QuickhackTarget {
  /** The person's entity ID hash, as a string. */
  id: string;
  level: number;
  /** Health in points. */
  health: number;
  /** Health in percent, 0 to 100. */
  healthPercent: number;
  isHuman: boolean;
  isBoss: boolean;
  isMechanical: boolean;
  isDrone: boolean;
  isAndroid: boolean;
  isElite: boolean;
  isCivilian: boolean;
  /** Lowers their health by amount points, as V. False when they are gone. */
  damage(amount: number): Promise<boolean>;
  /** A status effect on them from V, such as "BaseStatusEffect.ContagionPoisonLvl2". False when they are gone. */
  addEffect(effect: string): Promise<boolean>;
}

/** Which of the quickhack's hacks it is. */
export interface QuickhackUse {
  /** The hack's action record, or its id ("0x…") when REDnode does not know the name. */
  action: string;
  /** The tier's item. */
  item: string;
  /** The tier, from 1 (Common). */
  tier: number;
  /** onLand: it spread to this person from another one. */
  spread: boolean;
  /** onLand: V uploaded it. */
  byV: boolean;
}
`;

const MAIN = "main.mjs";
const MANIFEST = "rednode-app.json";
const TYPES = "quickhacks.d.ts";

function madeByEdgehack(file: string): boolean {
  if (!fs.existsSync(file)) return true;
  return fs.readFileSync(file, "utf8").includes(MADE_BY);
}

export interface PackageResult {
  /** The package folder, when it has a script. */
  dir?: string;
  /** Files this write added: they did not exist before. */
  created: string[];
  /** Quickhacks left out: their document names a script file that is not there. */
  missing: string[];
}

/**
 * Writes the mod's REDnode package from the quickhacks that have a script: main.mjs, the manifest and the
 * types, beside the script files. With none, takes away EDGEhack's own files and leaves the modder's.
 * A main.mjs or manifest EDGEhack did not make is left alone, with an error.
 */
export function writeScriptPackage(project: Pick<ProjectRef, "resources" | "modName">, entries: ScriptEntry[]): PackageResult {
  const dir = packageDir(project);
  const result: PackageResult = { created: [], missing: [] };
  const present = entries.filter((e) => {
    const there = fs.existsSync(path.join(dir, e.file));
    if (!there) result.missing.push(e.name);
    return there;
  });
  const own = [MAIN, MANIFEST, TYPES].map((f) => path.join(dir, f));
  for (const f of own.slice(0, 2)) {
    if (!madeByEdgehack(f)) throw new Error(`${f} exists and was not made by EDGEhack, so the quickhacks' scripts were not written. Move or rename it.`);
  }
  if (!present.length) {
    for (const f of own) fs.rmSync(f, { force: true });
    return result;
  }
  fs.mkdirSync(dir, { recursive: true });
  const write = (file: string, text: string): void => {
    if (!fs.existsSync(file)) result.created.push(file);
    fs.writeFileSync(file, text);
  };
  write(own[0], mainSource(present));
  write(own[1], `${JSON.stringify(manifestOf(project.modName), null, 2)}\n`);
  write(own[2], TYPES_SOURCE);
  result.dir = dir;
  return result;
}
