// The OpenAI key and model for Generate (H3b.3). The key, since EDGEhack #3 (K4d): from REDcode's Keys, the
// shared key store every EDGE tool reads (REDcode #33), which asks the modder once whether EDGEhack may read it
// and, with none set, asks for it in REDcode's password box, saved for every tool. OPENAI_API_KEY in the
// environment still wins, for the smoke test and for modders who keep it there. With a REDcode older than the
// store, or none, the key stays in VS Code's own encrypted secret storage as before. A key EDGEhack kept there
// is moved into the store once, through EDGEhack's own REDbridge (src/keyStore.ts), as EDGEwave does.
//
// No key decryption is in EDGEhack: REDbridge does it, in .NET (the VS Code Marketplace refused EDGEhack 0.1.0
// for a PowerShell decryption inside it; the owner's rule of 2026-11-11 and K4's design keep it out).
// The model comes from the key's own account, newest first, unless the edgehack.generate.model setting names one.
import * as vscode from "vscode";
import { listModels, OPENAI, Quality } from "./imageService";
import { Caller, findBridge, KeysBridge, noKeyReason, Service } from "./keyStore";
import { keyStore, REDcodeId } from "./redcode";

const SECRET = "edgehack.openai.key";
const KEY = /^[\x21-\x7e]{1,4096}$/; // printable ASCII, no spaces or line breaks

let secrets: vscode.SecretStorage | undefined;
let log: ((line: string) => void) | undefined;

/** Gives the key code VS Code's secret storage and a log line; called once at activation. */
export function initKeys(context: vscode.ExtensionContext, logLine?: (line: string) => void): void {
  secrets = context.secrets;
  log = logLine;
}

/**
 * Listens for the key changing in REDcode's Keys (set, replaced or removed by any tool, or the game), and moves
 * a key EDGEhack kept itself into the store. Called once at activation; with an older REDcode only EDGEhack's
 * own secret storage is watched.
 */
export async function watchKeys(): Promise<vscode.Disposable[]> {
  const out: vscode.Disposable[] = [];
  if (secrets) out.push(secrets.onDidChange((e) => e.key === SECRET && models.clear()));
  const keys = await keyStore();
  if (keys) {
    out.push(
      keys.onDidChange((service) => {
        if (service !== Service) return;
        log?.("OpenAI: the key changed in REDcode's Keys");
        models.clear();
      }),
    );
    void moveToStore();
  }
  return out;
}

/** Another server instead of OpenAI's, for the smoke test. */
export const openaiBase = (): string | undefined => process.env.EDGEHACK_OPENAI_BASE || undefined;

/** What is wrong with a typed key, in words, or null. */
export function checkOpenAIKey(key: string): string | null {
  const k = key.trim();
  if (!KEY.test(k)) return "A key is one line of letters, digits and signs, with no spaces";
  if (!k.startsWith("sk-")) return "OpenAI keys start with sk-";
  return null;
}

let asking: Promise<string | undefined> | undefined;

/**
 * The key: from the environment; else from REDcode's Keys, after moving EDGEhack's own copy there, and asked
 * for in REDcode's password box when none is set (when `ask`); with an older REDcode, from VS Code's secret
 * storage, asked for in EDGEhack's own box. Undefined when there is none.
 */
export async function openaiKey(ask = true): Promise<string | undefined> {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  const keys = await keyStore();
  if (!keys) {
    const k = (await secrets?.get(SECRET))?.trim();
    if (k || !ask) return k || undefined;
    asking ??= askOwn().finally(() => (asking = undefined));
    return asking;
  }
  await moveToStore();
  let k: string | undefined;
  try {
    k = (await keys.get(Service, Caller))?.trim();
  } catch (e) {
    // REDbridge not running (yet) or too old: a key EDGEhack still keeps itself, else the reason.
    const own = (await secrets?.get(SECRET))?.trim();
    if (own) return own;
    throw new Error(`EDGEhack reads the OpenAI key from REDcode's Keys, which cannot be reached: ${(e as Error).message}`);
  }
  if (k || !ask) return k || undefined;
  // No key, or the modder's no: a newer REDcode tells them apart (keys.status), so a no is not met with a password box.
  if (typeof keys.status === "function") {
    const why = noKeyReason(await keys.status(Service, Caller).catch(() => undefined));
    if (why) throw new Error(why);
  }
  asking ??=keys.ask(Service, Caller).finally(() => (asking = undefined));
  return (await asking)?.trim() || undefined;
}

/** The move, tried once a session; a key read waits for it, so it never finds the store empty mid-move. */
let moving: Promise<void> | undefined;
function moveToStore(): Promise<void> {
  moving ??= move();
  return moving;
}

/** REDbridge.exe as REDcode finds it: redcode.bridgePath, else the one inside REDcode, else on the PATH. */
function bridgeExe(): string | undefined {
  const redcodeDir = vscode.extensions.getExtension(REDcodeId)?.extensionPath;
  return findBridge({
    configured: vscode.workspace.getConfiguration("redcode").get<string>("bridgePath") || undefined,
    redcodeDirs: redcodeDir ? [redcodeDir] : [],
    pathEnv: process.env.PATH,
  });
}

/**
 * Moves a key EDGEhack kept in VS Code's secret storage (EDGEhack 0.1.2 and before) into REDcode's shared store,
 * through REDbridge (REDcode's API saves only a key typed in its box), then removes EDGEhack's copy. When the
 * store already has a key, that one is kept and EDGEhack's copy removed. Says so once. On a failure EDGEhack's
 * copy stays, is used while the store cannot be reached, and the move is tried again next session.
 */
async function move(): Promise<void> {
  const own = (await secrets?.get(SECRET))?.trim();
  if (!own) return;
  const exe = bridgeExe();
  if (!exe) return log?.("OpenAI: the key in EDGEhack's secret storage stays there: REDbridge.exe was not found");
  const bridge = new KeysBridge({ exe, dotnetRoot: vscode.workspace.getConfiguration("redcode").get<string>("dotnetRoot") || undefined });
  try {
    const info = await bridge.info(Service);
    const had = info.source === "file" && !info.unreadable;
    if (!had) await bridge.set(Service, own);
    await secrets?.delete(SECRET);
    log?.(had ? "OpenAI: REDcode's Keys had a key already; EDGEhack's own copy removed" : "OpenAI: the key moved from EDGEhack's secret storage to REDcode's Keys");
    const text = had
      ? `EDGEhack: REDcode's Keys already has an OpenAI key${info.last4 ? ` (ending ${info.last4})` : ""}, shared by every EDGE tool, so EDGEhack uses it and has removed the copy it kept itself.`
      : "EDGEhack: your OpenAI key is now in REDcode's Keys, shared by every EDGE tool, and EDGEhack no longer keeps a copy of its own.";
    // Not awaited: a key read waiting for the move must not wait for the modder to close this.
    void vscode.window.showInformationMessage(text, "Open REDcode's Keys").then((pick) => {
      if (pick) void vscode.commands.executeCommand("redcode.keys.focus");
    });
  } catch (e) {
    log?.(`OpenAI: could not move the key to REDcode's Keys, so EDGEhack keeps its own copy for now: ${(e as Error).message}`);
  } finally {
    bridge.close();
  }
}

/** EDGEhack's own password box, with a REDcode older than the store. */
async function askOwn(): Promise<string | undefined> {
  const k = await vscode.window.showInputBox({
    title: "EDGEhack: OpenAI API key",
    prompt: `For Generate on a quickhack's icons. Kept encrypted in VS Code's secret storage, for EDGEhack only, and sent only to OpenAI. Make one at ${OPENAI.keyFrom}. Each Generate is a paid image on your account.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? checkOpenAIKey(v) : null),
  });
  if (!k?.trim() || !secrets) return undefined;
  await secrets.store(SECRET, k.trim());
  models.clear();
  return k.trim();
}

/** Set the OpenAI Key: REDcode's password box, saved for every tool; EDGEhack's own with an older REDcode. */
export async function setOpenAIKey(): Promise<string | undefined> {
  const keys = await keyStore();
  if (!keys) {
    const k = await askOwn();
    if (k) void vscode.window.showInformationMessage("EDGEhack: the OpenAI API key is saved in VS Code's secret storage.");
    return k;
  }
  try {
    const k = await keys.ask(Service, Caller);
    if (k) {
      models.clear();
      void vscode.window.showInformationMessage("EDGEhack: the OpenAI API key is saved in REDcode's Keys, for every EDGE tool.");
    }
    return k;
  } catch (e) {
    void vscode.window.showErrorMessage(`EDGEhack: REDcode's Keys cannot be reached, so the key cannot be saved: ${(e as Error).message}`);
    return undefined;
  }
}

/** Clear the OpenAI Key: EDGEhack's own copy; with REDcode's Keys, points there, where Remove Key is. */
export async function clearOpenAIKey(): Promise<void> {
  if (!(await keyStore())) {
    const go = await vscode.window.showWarningMessage("Clear EDGEhack's OpenAI API key?", { modal: true, detail: "Generate asks for it again." }, "Clear It");
    if (go !== "Clear It") return;
    await secrets?.delete(SECRET);
    models.clear();
    void vscode.window.showInformationMessage("EDGEhack: the OpenAI API key is cleared.");
    return;
  }
  await secrets?.delete(SECRET);
  models.clear();
  // The key is every EDGE tool's now: REDcode, its keeper, removes it (Remove Key in its Keys view).
  const pick = await vscode.window.showInformationMessage(
    "EDGEhack: your OpenAI key is shared by every EDGE tool, in REDcode's Keys. Remove it there: Remove Key on OpenAI.",
    "Open REDcode's Keys",
  );
  if (pick) void vscode.commands.executeCommand("redcode.keys.focus");
}

const models = new Map<string, Promise<string[]>>();

/** The model Generate uses: the setting's, else the newest GPT Image model the key's account lists. */
export async function openaiModel(key: string): Promise<string> {
  const set = vscode.workspace.getConfiguration("edgehack.generate").get<string>("model")?.trim();
  if (set) return set;
  let list = models.get(key);
  if (!list) {
    list = listModels({ key, base: openaiBase(), timeoutMs: 30_000 });
    models.set(key, list);
    list.catch(() => models.delete(key));
  }
  const got = await list;
  if (!got.length) throw new Error("Your OpenAI account lists no GPT Image model (gpt-image...). Check the key's project at platform.openai.com, or name a model in the edgehack.generate.model setting.");
  return got[0];
}

export function openaiQuality(): Quality {
  const q = vscode.workspace.getConfiguration("edgehack.generate").get<string>("quality");
  return q === "low" || q === "high" || q === "auto" ? q : "medium";
}
