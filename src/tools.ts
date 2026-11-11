// What each of the MCP server's tools does (H4.5), free of VS Code and of the MCP SDK, so the unit tests
// drive it over the fixture's records. The server (packages/edgehack-mcp) only checks the inputs and
// passes them here. Every answer names the document's file, which opens in EDGEhack's editor in VS Code.

import * as fs from "node:fs";
import * as path from "node:path";
import type { HackCore } from "./core";
import { newDoc, parseDoc, printDoc, withScripts, type QuickhackDoc } from "./document";
import { applyChanges, findTier, type Change } from "./edits";
import { gameValue } from "./editorHtml";
import { addedNotes, DAMAGE_OFF_MACHINES, effectKey, effectSummary, offeredEffects, STAT_CHOICES, type PoolKind } from "./effects";
import { DAMAGE_TYPES } from "./document";
import { deskChange, deskItems, deskNewHackProblem, makeDeskNewHack, onDesk, projectPlace, savedOnDesk, writeToProject } from "./desk";
import { docFile, makeNewHackDoc, newHackProblem, projectDocs } from "./projectDocs";
import { packProject } from "./pack";
import { projectAt } from "./project";
import { tierKey, type Family } from "./read";
import { bridgeIconWriter, saveDocFiles, type SaveResult } from "./save";
import { addFunction, exportsOf, packageDir, scriptFileName, type ScriptFunction } from "./scripts";
import { liveLimits, stopTrying, tryLive, yamlToOps } from "./tryLive";
import { newItemPath, writeTweaks } from "./tweaks";
import type { ProjectRef } from "./types";

export interface ToolHost {
  core: HackCore;
  /** The project for a call: the path the call gives, else the server's own, else undefined (the Desk). */
  project(given?: string): ProjectRef | undefined;
  /** The Desk's folder. */
  desk: string;
}

const words = (q: string | undefined) => (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
const matches = (ws: string[], ...texts: (string | undefined)[]) => ws.every((w) => texts.some((t) => t?.toLowerCase().includes(w)));
const num = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? undefined : Math.round(n * 100) / 100);

/** Where a document lives: on the Desk, or in the project whose folder holds it. */
export function placeOf(host: ToolHost, file: string): { doc: QuickhackDoc; file: string; project?: ProjectRef; desk: boolean } {
  const full = path.resolve(file);
  if (!full.endsWith(".quickhack.json")) throw new Error(`${file} is not a quickhack document (a .quickhack.json file). hack_find lists them.`);
  if (!fs.existsSync(full)) throw new Error(`There is no ${full}. hack_find lists the documents there are.`);
  const doc = parseDoc(fs.readFileSync(full, "utf8"));
  if (onDesk(full, host.desk)) return { doc, file: full, desk: true };
  for (let dir = path.dirname(full); ; dir = path.dirname(dir)) {
    if (fs.readdirSync(dir).some((e) => e.toLowerCase().endsWith(".cpmodproj"))) return { doc, file: full, project: projectAt(dir), desk: false };
    if (path.dirname(dir) === dir) break;
  }
  throw new Error(`${full} is neither on EDGEhack's Desk nor in a WolvenKit project.`);
}

const needProject = (host: ToolHost, given: string | undefined, what: string): ProjectRef => {
  const p = host.project(given);
  if (!p) throw new Error(`${what} needs a WolvenKit project: pass project (its folder or .cpmodproj file).`);
  return p;
};

const docRow = (d: { file: string; doc?: QuickhackDoc; error?: string }, where: "project" | "desk") =>
  d.doc ? { file: d.file, where, id: d.doc.id, name: d.doc.name, family: d.doc.family, newHack: !!d.doc.newHack } : { file: d.file, where, error: d.error };

/** hack_find: the game's quickhacks and the documents in the project and on the Desk whose names match every word. */
export async function findHacks(host: ToolHost, a: { query?: string; project?: string; limit?: number }) {
  const ws = words(a.query);
  const limit = a.limit ?? 50;
  const catalog = await host.core.catalog();
  const game = [
    ...catalog.families.filter((f) => matches(ws, f.name, f.key, f.category)).map((f) => ({ key: f.key, name: f.name, kind: "people", category: f.category, tiers: f.items.length })),
    ...[...catalog.devices, ...catalog.vehicles].filter((x) => matches(ws, x.name, x.path, x.category)).map((x) => ({ key: `action:${x.path}`, name: x.name, kind: x.kind, category: x.category })),
  ];
  const project = host.project(a.project);
  const familyName = (key: string) => catalog.families.find((f) => f.key === key)?.name ?? key;
  const docs = [
    ...(project ? projectDocs(project).map((d) => docRow(d, "project")) : []),
    ...deskItems(host.desk).map((d) => docRow(d, "desk")),
  ].filter((d) => !ws.length || matches(ws, "name" in d ? d.name : undefined, "family" in d ? d.family : undefined, "family" in d && d.family ? familyName(d.family) : undefined, "id" in d ? d.id : undefined));
  return {
    game: game.slice(0, limit),
    gameTotal: game.length,
    documents: docs.slice(0, limit),
    project: project ? { name: project.name, dir: project.dir } : null,
  };
}

/** A family in the editor's words: each tier's costs and effects, what the numbers hack_edit changes are now. */
export function familySummary(fam: Family) {
  const top = fam.tiers[fam.tiers.length - 1];
  return {
    key: fam.key,
    name: fam.name,
    kind: fam.kind,
    category: fam.category,
    cooldown: num(top?.cooldown?.base),
    tiers: fam.tiers.map((t, i) => ({
      tier: tierKey(t),
      index: i,
      quality: t.quality,
      name: t.name,
      description: t.description,
      ram: num(gameValue(t, "ram")),
      upload: num(gameValue(t, "upload")),
      damage: num(gameValue(t, "damage")),
      duration: num(gameValue(t, "duration")),
      bossRam: num(gameValue(t, "bossRam")),
      effects: t.effects.filter((e) => !e.shared && !e.cooldown).map((e) => ({ key: effectKey(e), name: e.name, summary: effectSummary(e) })),
      notWhen: t.notWhen.length ? t.notWhen : undefined,
      spread: t.spread || undefined,
      icons: { item: t.icons.item?.record, wheel: t.icons.wheel?.record },
    })),
  };
}

/** What a document says it will do, and what EDGEhack warns about it. */
async function review(host: ToolHost, doc: QuickhackDoc, fam: Family) {
  const added = await host.core.added(doc, fam);
  const sales = doc.newHack ? await host.core.salesOrNone(fam) : undefined;
  const written = writeTweaks(fam, doc, added, sales);
  return {
    added: added.map((r) => ({ id: r.entry.id, name: r.name, from: r.sourceName, problem: r.problem })),
    warnings: written.warnings,
    notes: addedNotes(fam, added),
    changesTheGame: !!written.yaml,
  };
}

/** hack_describe: a game quickhack by key, or a document by file with its family and what it changes. */
export async function describeHack(host: ToolHost, a: { key?: string; file?: string }) {
  if (a.file) {
    const place = placeOf(host, a.file);
    const fam = await host.core.family(place.doc.family);
    let script: { file: string; exists: boolean; exports: ScriptFunction[] } | undefined;
    if (place.project && place.doc.scripts) {
      const f = path.join(packageDir(place.project), place.doc.scripts.file);
      script = { file: f, exists: fs.existsSync(f), exports: fs.existsSync(f) ? exportsOf(fs.readFileSync(f, "utf8")) : [] };
    }
    return { file: place.file, where: place.desk ? "desk" : "project", project: place.project?.dir, document: place.doc, ...(await review(host, place.doc, fam)), script, family: familySummary(fam) };
  }
  if (!a.key) throw new Error("Pass key (a quickhack from hack_find, such as Overheat) or file (a document).");
  return familySummary(await host.core.family(a.key));
}

/** hack_effects: the status effects to add, a quickhack's own effects to borrow, and what EDGEhack can build. */
export async function listEffects(host: ToolHost, a: { query?: string; kind?: PoolKind; from?: string; limit?: number }) {
  const ws = words(a.query);
  const pool = (await host.core.effectPool()).filter((p) => (!a.kind || p.kind === a.kind) && matches(ws, p.name, p.uiName, p.type, p.path, ...p.tags));
  const limit = a.limit ?? 50;
  return {
    statusEffects: pool.slice(0, limit).map((p) => ({ status: p.path, name: p.name, shown: p.uiName, type: p.type, kind: p.kind, usedByTheGame: p.used || undefined })),
    statusTotal: pool.length,
    fromQuickhack: a.from
      ? offeredEffects(await host.core.family(a.from)).map((o) => ({ from: a.from, effect: o.key, name: o.effect.name, summary: effectSummary(o.effect) }))
      : undefined,
    build: {
      damage: { damageTypes: [...DAMAGE_TYPES], keptOffMachines: [...DAMAGE_OFF_MACHINES], numbers: ["damage", "every", "duration"] },
      stat: Object.entries(STAT_CHOICES).map(([stat, c]) => ({ stat, label: c.label, how: c.how, startsAt: c.value, unit: c.unit, hint: c.hint })),
      chance: { needs: "applies: a status effect's record from statusEffects", numbers: ["chance", "duration"] },
    },
  };
}

/** Writes a document and its mod files where it lives. */
async function store(host: ToolHost, place: { file: string; project?: ProjectRef; desk: boolean }, doc: QuickhackDoc): Promise<SaveResult | undefined> {
  fs.mkdirSync(path.dirname(place.file), { recursive: true });
  fs.writeFileSync(place.file, printDoc(doc));
  if (place.desk) {
    savedOnDesk(place.file, doc.name, host.desk);
    return undefined;
  }
  return saveDocFiles(host.core, place.project!, doc, bridgeIconWriter(await host.core.bridge(), place.project!));
}

const saved = (r: SaveResult | undefined, project?: ProjectRef) =>
  r
    ? {
        yaml: r.yaml,
        texts: r.texts,
        scripts: r.scripts,
        created: r.created,
        getItLeftOut: r.salesMissing || undefined,
        missingScripts: r.missingScripts,
        next: project ? "hack_pack packs the project; hack_try tries it in the running game first." : undefined,
      }
    : { desk: true, next: "On the Desk no mod files are written. hack_new with desk_file and a project adds it to a project." };

/** hack_new: a new quickhack from a game family, a document for changes to a family, or a Desk document added to a project. */
export async function newHack(host: ToolHost, a: { family?: string; name?: string; change?: boolean; desk?: boolean; project?: string; desk_file?: string; replace?: boolean }) {
  const catalog = await host.core.catalog();
  const keys = catalog.families.map((f) => f.key);
  if (a.desk_file) {
    const from = placeOf(host, a.desk_file);
    if (!from.desk) throw new Error(`${a.desk_file} is not on the Desk.`);
    const project = needProject(host, a.project, "Adding a Desk quickhack to a project");
    const place = projectPlace(project, keys, from.doc);
    if (place.replaces && !a.replace) {
      return { added: false, file: place.file, replaces: true, next: `${project.name} already has this quickhack. Ask the modder, then call again with replace true to replace the project's copy (its changes there are lost).` };
    }
    writeToProject(place, { file: from.file, id: from.doc.id });
    const r = await saveDocFiles(host.core, project, place.doc, bridgeIconWriter(await host.core.bridge(), project));
    return { added: true, file: place.file, where: "project", id: place.doc.id, saved: saved(r, project), deskKeeps: from.file };
  }
  if (!a.family) throw new Error("Pass family: a quickhack's key from hack_find, such as Overheat.");
  const familyName = catalog.families.find((f) => f.key === a.family)?.name;
  const isAction = a.family.startsWith("action:");
  if (!familyName && !isAction) throw new Error(`No quickhack family ${a.family} in the game. hack_find lists them.`);
  const project = a.desk ? undefined : host.project(a.project);
  if (a.change) {
    if (project) {
      const doc = newDoc(project.modName, a.family);
      const file = docFile(project, doc.id);
      const existed = fs.existsSync(file);
      if (!existed) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, printDoc(doc));
      }
      return { file, where: "project", id: doc.id, existed, next: "hack_edit changes it; nothing is written into the mod until something changes." };
    }
    const item = deskChange(host.desk, a.family, familyName ?? a.family);
    return { file: item.file, where: "desk", id: item.doc?.id, next: "hack_edit changes it." };
  }
  if (isAction) throw new Error("A new quickhack can start only from one for people, for now. Device and vehicle hacks can be changed (change true), not cloned.");
  const name = (a.name ?? "").trim();
  if (!name) throw new Error("A new quickhack needs name: what players see.");
  if (project) {
    const problem = newHackProblem(project, keys, a.family, name);
    if (problem) throw new Error(problem);
    const { file, doc } = makeNewHackDoc(project, keys, a.family, name);
    const r = await saveDocFiles(host.core, project, doc, bridgeIconWriter(await host.core.bridge(), project));
    return { file, where: "project", id: doc.id, saved: saved(r, project) };
  }
  const problem = deskNewHackProblem(host.desk, keys, a.family, name);
  if (problem) throw new Error(problem);
  const item = makeDeskNewHack(host.desk, keys, a.family, name);
  return { file: item.file, where: "desk", id: item.doc?.id, saved: saved(undefined) };
}

/** hack_edit: changes applied in order to a document, which is saved with its mod files. */
export async function editHack(host: ToolHost, a: { file: string; changes: Change[] }) {
  const place = placeOf(host, a.file);
  const fam = await host.core.family(place.doc.family);
  const { doc, done } = await applyChanges(place.doc, a.changes, { fam, added: (d) => host.core.added(d, fam) });
  const r = await store(host, place, doc);
  return { file: place.file, where: place.desk ? "desk" : "project", done, document: doc, ...(await review(host, doc, fam)), saved: saved(r, place.project) };
}

/** hack_script: a quickhack's scan check or on-land function, in the mod's REDnode package. */
export async function scriptHack(host: ToolHost, a: { file: string; function: ScriptFunction; source?: string; disabledText?: string }) {
  const place = placeOf(host, a.file);
  if (!place.project) throw new Error("A script lives in a project's REDnode package. Add the quickhack to a project first (hack_new with desk_file).");
  const fam = await host.core.family(place.doc.family);
  let doc = place.doc;
  const scriptFile = path.join(packageDir(place.project), doc.scripts?.file ?? scriptFileName(doc));
  if (!doc.scripts) doc = withScripts(doc, { file: path.basename(scriptFile) });
  let did: "created" | "added" | "there" | "written";
  if (a.source !== undefined) {
    const exported = exportsOf(a.source);
    if (!exported.includes(a.function)) throw new Error(`The source must export ${a.function} (export function ${a.function}(target, hack) { ... }). It exports ${exported.join(", ") || "neither canUse nor onLand"}.`);
    fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
    fs.writeFileSync(scriptFile, a.source);
    did = "written";
  } else {
    did = addFunction(scriptFile, a.function, doc.name || fam.name);
  }
  if (a.disabledText !== undefined) doc = withScripts(doc, { ...doc.scripts!, ...(a.disabledText.trim() ? { disabledText: a.disabledText.trim() } : { disabledText: undefined }) });
  const r = await store(host, place, doc);
  const text = fs.readFileSync(scriptFile, "utf8");
  return { file: place.file, script: scriptFile, did, exports: exportsOf(text), source: text, saved: saved(r, place.project) };
}

/** hack_pack: the project packed into its packed folder. */
export async function packHack(host: ToolHost, a: { project?: string }) {
  const project = needProject(host, a.project, "Packing");
  const s = await packProject(await host.core.bridge(), project);
  return {
    ...s,
    next: "Install the packed folder: with EDGEdeck (its edgedeck_install_project tool), or REDcode's Pack and Play in VS Code. The game loads it at its next start; REDnode's archives_reload can swap the archive into a running game.",
  };
}

/** hack_try: Try Live, the document's records in the running game through REDnode; stop puts the game back. */
export async function tryHack(host: ToolHost, a: { file?: string; tier?: string; stop?: boolean }) {
  if (a.stop) return { stopped: true, restored: await stopTrying() };
  if (!a.file) throw new Error("Pass file (a document), or stop true.");
  const place = placeOf(host, a.file);
  const doc = place.doc;
  const fam = await host.core.family(doc.family);
  const sales = doc.newHack ? await host.core.salesOrNone(fam) : undefined;
  const written = writeTweaks(fam, doc, await host.core.added(doc, fam), sales);
  if (!written.yaml) throw new Error("It changes nothing yet, so there is nothing to try.");
  const tier = a.tier !== undefined ? findTier(fam, a.tier) : undefined;
  const give = doc.newHack && tier?.item ? newItemPath(doc, tier) : undefined;
  const r = await tryLive(yamlToOps(written.yaml), doc.name || fam.name, give);
  const later = liveLimits(doc, "its");
  return {
    applied: r.applied,
    gave: r.gave,
    note: [
      give ? "The tier is in V's backpack: the player puts it in the cyberdeck." : doc.newHack ? "Pass tier to give V the new quickhack." : undefined,
      later,
      "The first try of a session waits for the player to allow EDGEhack in the game (F10). hack_try with stop true puts the game back.",
    ].filter(Boolean),
  };
}
