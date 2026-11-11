// EDGEhack's MCP server (H4.5): Claude Code, through EDGEchat's plugin or EDGEhack's Connect an
// Assistant, and REDagent in the game, through REDnode, make and change Cyberpunk 2077 quickhacks.
//
//   edgehack-mcp [--project <WolvenKit project>] [--bridge <REDbridge.exe or its folder>] [--game <Cyberpunk 2077 folder>]
//
// Options win, then the variables EDGEHACK_PROJECT, REDBRIDGE_EXE, EDGEHACK_GAME_PATH; then REDcode's and
// EDGEdeck's VS Code settings, read from their file; then the copies of REDbridge REDnode, EDGEdeck or
// REDcode fetched, and Steam's libraries. With no project given, a call's own `project`, or a project
// in the folder the server runs in; with none, new quickhacks go on EDGEhack's Desk. Inside REDnode
// (REDNODE_BRIDGE_URL and REDNODE_BRIDGE_TOKEN set) it uses REDnode's REDbridge instead of starting one.
// stdout is the MCP channel; logs go to stderr. The tool logic is in EDGEhack's src/tools.ts.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { HackCore } from "../../../src/core";
import { deskRoot } from "../../../src/desk";
import { ADDED_FIELDS, DAMAGE_TYPES, TIER_FIELDS } from "../../../src/document";
import { TEXT_FIELDS, type Change } from "../../../src/edits";
import { findBridge, findDotnet, findGame, vscodeUserSettings } from "../../../src/locate";
import { projectAt } from "../../../src/project";
import { RedBridge, rednodeBridge } from "../../../src/redbridge";
import { describeHack, editHack, findHacks, listEffects, newHack, packHack, scriptHack, tryHack, type ToolHost } from "../../../src/tools";
import type { BridgeClient, ProjectRef } from "../../../src/types";

declare const __VERSION__: string;

const log = (line: string) => process.stderr.write(`[edgehack-mcp] ${line}\n`);
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && v.trim() ? v.trim() : undefined;
};
const env = (name: string) => (process.env[name]?.trim() ? process.env[name]!.trim() : undefined);

const settings = vscodeUserSettings();
const shared = rednodeBridge();
let own: RedBridge | undefined;

async function bridge(): Promise<BridgeClient> {
  if (shared) return shared;
  if (!own) {
    const exe = findBridge(arg("--bridge"), { settings });
    if (!exe) throw new Error("REDbridge.exe was not found. Pass --bridge or set REDBRIDGE_EXE, or get REDbridge with REDcode in VS Code or with REDnode's Mod Manager.");
    const game = findGame(arg("--game"), { settings });
    if (!game) throw new Error("The Cyberpunk 2077 folder was not found. Pass --game or set EDGEHACK_GAME_PATH.");
    log(`REDbridge ${exe.path} (${exe.from}), game ${game.path} (${game.from})`);
    own = new RedBridge({ exe: exe.path, gamePath: game.path, dotnetRoot: findDotnet({ settings }), log });
  }
  return own.client;
}
if (shared) log("using REDnode's REDbridge");

const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
const core = new HackCore({ storage: path.join(local, "EDGEhack", "mcp"), bridge, log });

const fixedProject = arg("--project") ?? env("EDGEHACK_PROJECT");
const host: ToolHost = {
  core,
  desk: deskRoot(),
  project(given?: string): ProjectRef | undefined {
    const p = given?.trim() || fixedProject;
    if (p) return projectAt(p);
    try {
      return projectAt(process.cwd());
    } catch {
      return undefined;
    }
  },
};

const text = (value: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const failure = (e: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
const run = <A>(fn: (a: A) => Promise<unknown>) => async (a: A): Promise<CallToolResult> => {
  try {
    return text(await fn(a));
  } catch (e) {
    return failure(e);
  }
};

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
// Claude Code asks the player before every call of a tool with this, in every permission mode.
const ASK_FIRST = { "anthropic/requiresUserInteraction": true };

const project = z.string().optional().describe("A WolvenKit project: its folder or .cpmodproj file. Default: the server's own, or the folder it runs in");
const file = z.string().describe("A quickhack document (.quickhack.json), as hack_find or hack_new gives it");
const tier = z.string().describe("A tier: its item record (from hack_describe), its quality (Rare), or its place from 0 (the base tier)");

const server = new McpServer({ name: "edgehack", version: __VERSION__ });

server.registerTool(
  "hack_find",
  {
    title: "Find quickhacks",
    description:
      "Searches the game's quickhacks (read from the user's own Cyberpunk 2077) and the quickhack documents in the project, on EDGEhack's Desk and in the EDGE Library (the modder's store of finished work, with a version each). Every word must match a name, key or category. " +
      "Game quickhacks come back with their key (Overheat, or action:<record> for a device or vehicle hack), for hack_describe and hack_new; documents with their file, for hack_describe, hack_edit, hack_script and hack_try. The first call reads the game's TweakDB (about 15 s).",
    inputSchema: { query: z.string().optional().describe("Words to match, such as 'overheat' or 'control'. Empty lists everything"), project, limit: z.number().int().min(1).max(500).optional() },
    annotations: READ,
  },
  run(findHacks.bind(null, host)),
);

server.registerTool(
  "hack_describe",
  {
    title: "Describe a quickhack",
    description:
      "A quickhack in the editor's words. With key: a game quickhack's tiers (record, quality, name, description, RAM, upload, damage, duration, effects in words), its cooldown and icons. " +
      "With file: a document, what it changes (the document itself, its added effects, EDGEhack's warnings and notes, its script), and its family's game values. " +
      "Numbers in a document are what the modder wants, not differences.",
    inputSchema: { key: z.string().optional().describe("A game quickhack's key from hack_find"), file: file.optional() },
    annotations: READ,
  },
  run(describeHack.bind(null, host)),
);

server.registerTool(
  "hack_effects",
  {
    title: "Effects to add",
    description:
      "What hack_edit's addEffect can add: the game's status effects (filtered by words and kind: enemy, v, boss, other; usedByTheGame marks those a quickhack or grenade of the game's already puts on a target, the safest), " +
      "with from: another quickhack's own effects (its key in effect), and what EDGEhack builds: a damage over time of a type, a stat change while hacked, or a chance to apply a status effect.",
    inputSchema: {
      query: z.string().optional().describe("Words to match, such as 'burn' or 'blind'"),
      kind: z.enum(["enemy", "v", "boss", "other"]).optional(),
      from: z.string().optional().describe("A quickhack's key: list its own effects to borrow"),
      limit: z.number().int().min(1).max(500).optional(),
    },
    annotations: READ,
  },
  run(listEffects.bind(null, host)),
);

server.registerTool(
  "hack_new",
  {
    title: "Make a quickhack",
    description:
      "Makes a quickhack document. With family and name: a new quickhack beside the game's family, with records of its own (Clone and Modify); its mod files are written into the project at once. " +
      "With change true: the document for changes to the game's family itself (or opens the one there). With no project (or desk true) it goes on EDGEhack's Desk, with no mod files. " +
      "With desk_file (a Desk or EDGE Library document) and a project: Add to Project, the quickhack copied into the project under the project's names, its mod files written; the Desk or the Library keeps its own, and a Library quickhack is noted so the project can refresh from it. The user is asked before every call.",
    inputSchema: {
      family: z.string().optional().describe("The game quickhack's key from hack_find, such as Overheat"),
      name: z.string().optional().describe("A new quickhack's name, as players see it. Its record names come from it and stay"),
      change: z.boolean().optional().describe("A document for changes to the family itself, not a new quickhack"),
      desk: z.boolean().optional().describe("On the Desk even when a project is there"),
      desk_file: z.string().optional().describe("A Desk or EDGE Library document to add to the project"),
      replace: z.boolean().optional().describe("With desk_file: replace the project's copy when it has one. Ask the modder first"),
      project,
    },
    annotations: WRITE,
    _meta: ASK_FIRST,
  },
  run(newHack.bind(null, host)),
);

const change = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set"), field: z.enum(TEXT_FIELDS), value: z.union([z.string(), z.number(), z.null()]).describe("Texts as text, cooldown in seconds, icons as UIIcon records; null for the game's") }),
  z.object({ op: z.literal("tier"), tier, field: z.enum(TIER_FIELDS as [string, ...string[]]), value: z.number().nullable().describe("RAM, upload and duration in seconds, damage a hit; null for the game's"), all: z.boolean().optional().describe("Give every tier the same difference from its own value") }),
  z.object({
    op: z.literal("addEffect"),
    status: z.string().optional().describe("A status effect's record from hack_effects"),
    from: z.string().optional().describe("Or another quickhack's key, with effect"),
    effect: z.string().optional().describe("That quickhack's effect key from hack_effects"),
    build: z.enum(["damage", "stat", "chance"]).optional().describe("Or one EDGEhack builds"),
    applies: z.string().optional().describe("A built chance: the status effect its roll applies"),
    on: z.enum(["target", "V"]).optional().describe("A status effect: who gets it. The target unless set"),
  }),
  z.object({ op: z.literal("removeEffect"), id: z.string().describe("An added effect's id (a1, a2...)") }),
  z.object({ op: z.literal("effectValue"), id: z.string(), tier, field: z.enum(ADDED_FIELDS as [string, ...string[]]), value: z.number().nullable(), all: z.boolean().optional() }),
  z.object({ op: z.literal("effectTier"), id: z.string(), tier, on: z.boolean().describe("False leaves the effect off that tier") }),
  z.object({ op: z.literal("effectBuild"), id: z.string(), damageType: z.enum(DAMAGE_TYPES).optional(), sparks: z.boolean().optional(), stat: z.string().optional().describe("A stat from hack_effects' build.stat") }),
  z.object({ op: z.literal("effectOn"), id: z.string(), on: z.enum(["target", "V"]) }),
  z.object({ op: z.literal("getIt"), tier, sell: z.boolean().optional().describe("False: no vendor sells it"), components: z.number().int().min(1).nullable().optional().describe("Crafting components; null for the family's") }),
  z.object({ op: z.literal("lines"), lines: z.array(z.object({ text: z.string().max(160), from: z.string().optional().describe("The tier it shows from") })).max(12).describe("The feature lines in the item's tooltip, all of them: this replaces the list") }),
]);

server.registerTool(
  "hack_edit",
  {
    title: "Change a quickhack",
    description:
      "Changes a quickhack document, in order, as the editor's page does, and saves it: in a project its mod files (TweakXL YAML, texts, own icons, the REDnode package) are written again; on the Desk and in the EDGE Library none are (a Library save raises its version). " +
      "A number set to the game's value, or null, goes back to the game's. Changes: set (name, description, wheelText, itemIcon, wheelIcon, cooldown), tier (ram, upload, damage, duration, bossRam, bossUpload on one tier, or all), " +
      "addEffect, removeEffect, effectValue, effectTier, effectBuild, effectOn (on added effects, by id), getIt (a new quickhack's vendors and crafting), lines (feature lines). " +
      "Nothing is saved when a change cannot be made. Answers the document, EDGEhack's warnings and notes, and the files written. The user is asked before every call, so send all the changes of one request in one call, in order, rather than one call each.",
    inputSchema: { file, changes: z.array(change).min(1).max(100) },
    annotations: WRITE,
    _meta: ASK_FIRST,
  },
  run((a: { file: string; changes: unknown[] }) => editHack(host, { file: a.file, changes: a.changes as Change[] })),
);

server.registerTool(
  "hack_script",
  {
    title: "A quickhack's script",
    description:
      "Writes a quickhack's own logic in the mod's REDnode package (REDnode 0.61.1 or later runs it in the game): canUse(target, hack) decides, each time V scans a person, whether the quickhack shows usable (true) or disabled; " +
      "onLand(target, hack) runs when it lands, with target.damage(amount) and target.addEffect(record). Without source it adds a commented stub; with source it writes the whole script file, which must export the function. " +
      "Answers the file's text, so a later call can send it back changed. disabledText is what a disabled hack says on the wheel. This is code that runs in the player's game: the user is asked before every call.",
    inputSchema: {
      file,
      function: z.enum(["canUse", "onLand"]),
      source: z.string().max(200000).optional().describe("The whole script file, as JavaScript (an ES module)"),
      disabledText: z.string().max(120).optional(),
    },
    annotations: WRITE,
    _meta: ASK_FIRST,
  },
  run(scriptHack.bind(null, host)),
);

server.registerTool(
  "hack_pack",
  {
    title: "Pack the mod",
    description:
      "Packs the project into its packed folder, as REDcode's Pack does: the archive (icons, texts) through WolvenKit's packer, and the TweakXL files, scripts and REDnode package copied by WolvenKit's rules. The packed folder is emptied first. " +
      "It does not install the mod: EDGEdeck or REDcode's Pack and Play do. The user is asked before every call.",
    inputSchema: { project },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: ASK_FIRST,
  },
  run(packHack.bind(null, host)),
);

server.registerTool(
  "hack_try",
  {
    title: "Try it live",
    description:
      "Try Live: sends a quickhack document's records to the running game through REDnode (0.62.0 or later), with no packing, and refreshes V's quickhacks; with tier, a new quickhack's tier is put in V's backpack. " +
      "Texts and own icons show as last packed. The first try of a session waits for the player to allow EDGEhack in the game. stop true puts back everything EDGEhack changed in the game. The user is asked before every call.",
    inputSchema: { file: file.optional(), tier: tier.optional(), stop: z.boolean().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    _meta: ASK_FIRST,
  },
  run(tryHack.bind(null, host)),
);

process.on("exit", () => own?.stop());
server.connect(new StdioServerTransport()).then(
  () => log(`ready (EDGEhack ${__VERSION__}); Desk ${host.desk}${fixedProject ? `, project ${fixedProject}` : ""}`),
  (e) => {
    log(`could not start: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
