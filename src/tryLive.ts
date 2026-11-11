// Try Live (H4.3; design, "H4 Try Live and MCP: plan"): a quickhack's changes in the running game,
// without packing, undone at Stop. EDGEhack sends the records it writes for the mod (the same YAML
// Pack and Play installs) to REDnode's editor channel (REDnode 0.62.0, #44), which applies them through
// TweakXL after the player's Allow in the game. No VS Code, so the MCP server (H4.5) can use it too.
//
// What shows live (H4.1's spike): a changed number on the next scan, an added effect after a refresh, a
// renamed item at once, a new quickhack made live. Not live: texts in the mod's onscreens file and own
// icons, which arrive with the archive (Pack and Play): liveLimits says it in words.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** How EDGEhack names itself to REDnode: the player sees it in the Editor request window. */
export const EDITOR = "EDGEhack";

/** The REDnode Try Live needs (the editor channel's TweakDB calls). */
export const REDNODE_TRY_LIVE = "0.62.0";

export type LiveOp = { clone: string; base: string } | { create: string; type: string } | { set: string; value: unknown } | { append: string; values: unknown[] };

/** A YAML value as TweakXL reads EDGEhack's: a number, true or false, a quoted string, [] or a bare word. */
function scalar(text: string): unknown {
  const t = text.trim();
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(t)) return Number(t);
  if (t === "true" || t === "false") return t === "true";
  if (t === "[]") return [];
  if (t.startsWith('"')) return JSON.parse(t);
  return t;
}

const typeName = (t: string): string => (t.startsWith("gamedata") ? t : `gamedata${t}_Record`);

/**
 * The editor channel's ops for the YAML EDGEhack writes (tweaks.ts): a record with `$type` becomes a
 * create and a set per field, one with `$base` a clone and a set per field, a key with a value a set, and a
 * list of `!append` (or `!append-once`) values an append. Only EDGEhack's own shapes: anything else throws.
 */
export function yamlToOps(yaml: string): LiveOp[] {
  const ops: LiveOp[] = [];
  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i++;
      continue;
    }
    const top = /^([^\s:][^:]*):(?:\s(.*))?$/.exec(line);
    if (!top) throw new Error(`Try Live cannot read line ${i + 1} of the mod's YAML: ${line}`);
    const key = top[1].trim();
    i++;
    if (top[2] !== undefined && top[2].trim() !== "") {
      ops.push({ set: key, value: scalar(top[2]) });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && /^\s/.test(lines[i]) && lines[i].trim()) body.push(lines[i++]);
    if (!body.length) throw new Error(`Try Live: ${key} has no value in the mod's YAML`);
    if (/^\s+- !append/.test(body[0])) {
      ops.push({ append: key, values: body.map((l) => scalar(l.replace(/^\s+- !append(-once)?\s+/, ""))) });
      continue;
    }
    const sets: LiveOp[] = [];
    let made: LiveOp | undefined;
    for (let k = 0; k < body.length; k++) {
      const field = /^ {2}([^\s:]+):(?:\s(.*))?$/.exec(body[k]);
      if (!field) throw new Error(`Try Live cannot read ${key}'s line: ${body[k].trim()}`);
      const [, name, rest] = field;
      if (name === "$type") made = { create: key, type: typeName(String(rest).trim()) };
      else if (name === "$base") made = { clone: key, base: String(rest).trim() };
      else if (rest !== undefined && rest.trim() !== "") sets.push({ set: `${key}.${name}`, value: scalar(rest) });
      else {
        const values: unknown[] = [];
        while (k + 1 < body.length && /^ {4}- /.test(body[k + 1])) values.push(scalar(body[++k].replace(/^ {4}- /, "")));
        sets.push({ set: `${key}.${name}`, value: values });
      }
    }
    if (!made) throw new Error(`Try Live: ${key} in the mod's YAML is neither a new record nor a change`);
    ops.push(made, ...sets);
  }
  return ops;
}

/** Where REDnode writes its editor channel's port and token. EDGEHACK_REDNODE_EDITOR for the tests. */
export const editorFile = (): string =>
  process.env.EDGEHACK_REDNODE_EDITOR ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "REDnode", "editor.json");

export interface EditorAnswer {
  status: number;
  body: { ok: boolean; reason?: string; applied?: number; restored?: number; failed?: { index: number; reason: string } };
}

const NO_GAME = "Start the game with REDnode (0.62.0 or later) to try it live.";

/** One call on REDnode's editor channel, with the reason in words when the game is not there. */
export async function editorCall(call: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<EditorAnswer> {
  let port: number;
  let token: string;
  try {
    ({ port, token } = JSON.parse(fs.readFileSync(editorFile(), "utf8")));
  } catch {
    throw new Error(NO_GAME);
  }
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${port}/editor/${call}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ editor: EDITOR, ...body }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw new Error("Cancelled.");
    throw new Error(NO_GAME);
  }
  const answer = (await res.json().catch(() => ({ ok: false, reason: `REDnode answered ${res.status}` }))) as EditorAnswer["body"];
  if (res.status === 404 && /No call/.test(answer.reason ?? "")) throw new Error(`Try Live needs REDnode ${REDNODE_TRY_LIVE} or later in the game.`);
  if (res.status === 409) throw new Error(NO_GAME);
  return { status: res.status, body: answer };
}

export interface TryResult {
  applied: number;
  /** The item given to V, when one was. */
  gave?: string;
}

/**
 * Tries a quickhack live: what an earlier try changed put back, the ops applied, V's quickhacks refreshed,
 * and `give` (a new quickhack's item) given to V. The first try of a session waits for the player's Allow.
 */
export async function tryLive(ops: LiveOp[], label: string, give?: string, signal?: AbortSignal): Promise<TryResult> {
  const check = (a: EditorAnswer, what: string): EditorAnswer => {
    if (a.status === 403) throw new Error(`${a.body.reason ?? "The player did not allow it"}. Allow EDGEhack in the game's Editor request window to try it live.`);
    if (!a.body.ok) {
      const f = a.body.failed;
      throw new Error(f ? `${what} stopped at change ${f.index + 1} of ${ops.length}: ${f.reason}` : `${what}: ${a.body.reason ?? `REDnode answered ${a.status}`}`);
    }
    return a;
  };
  check(await editorCall("tweakdb.reset", {}, signal), "Putting the last try back");
  const applied = check(await editorCall("tweakdb.apply", { label, ops }, signal), "Try Live").body.applied ?? 0;
  check(await editorCall("quickhacks.refresh", {}, signal), "Refreshing V's quickhacks");
  if (give) check(await editorCall("player.give", { item: give }, signal), `Giving V ${give}`);
  return { applied, gave: give };
}

/** Stops trying: everything EDGEhack changed in the game back as it was, and V's quickhacks refreshed. */
export async function stopTrying(): Promise<number> {
  const a = await editorCall("tweakdb.reset", {});
  if (!a.body.ok) throw new Error(a.body.reason ?? `REDnode answered ${a.status}`);
  await editorCall("quickhacks.refresh", {}).catch(() => undefined);
  return a.body.restored ?? 0;
}

/**
 * What a live try cannot show yet, in words, or undefined when everything shows (H5.0). The game reads
 * text entries only when it starts (the live names spike), so a new quickhack's name and texts show as
 * their text keys (LocKey#...) until the mod is packed and the game started again, and a changed one's as
 * last packed until then. Own icons arrive with the archive, at Pack and Play.
 */
export function liveLimits(doc: { newHack?: boolean; name?: string; description?: string; wheelText?: string; ownIcons?: object }, whose: "your" | "its"): string | undefined {
  const notes: string[] = [];
  if (doc.newHack) notes.push(`A new quickhack's name and texts show as text keys (LocKey#...) until Pack and Play and a game restart: the game reads new texts only when it starts.`);
  else if (doc.name || doc.description || doc.wheelText) notes.push(`${whose === "your" ? "Your" : "Its"} texts show as last packed until Pack and Play and a game restart.`);
  if (doc.ownIcons) notes.push(`${whose === "your" ? "Your" : "Its"} own icons show after Pack and Play.`);
  return notes.length ? notes.join(" ") : undefined;
}
