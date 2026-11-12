// The OpenAI key and model for Generate (H3b.3): the key in VS Code's own encrypted secret storage
// (SecretStorage, kept by VS Code in the operating system's credential store), asked for once in a
// password box when missing; OPENAI_API_KEY in the environment wins, for the smoke test and for modders
// who keep it there. The model from the key's own account, newest first, unless the
// edgehack.generate.model setting names one.
//
// Each EDGE extension keeps its own keys this way, and asks for them itself (the owner's decision of
// 2026-11-11): the EDGE tools' shared key store, which decrypted key files through PowerShell, is
// shelved, since the VS Code Marketplace refused EDGEhack 0.1.0 for "suspicious content" with it inside.
import * as vscode from "vscode";
import { listModels, OPENAI, Quality } from "./imageService";

const SECRET = "edgehack.openai.key";
const KEY = /^[\x21-\x7e]{1,4096}$/; // printable ASCII, no spaces or line breaks

let secrets: vscode.SecretStorage | undefined;

/** Gives the key code VS Code's secret storage; called once at activation. */
export function initKeys(context: vscode.ExtensionContext): void {
  secrets = context.secrets;
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

/** The key: from the environment, else VS Code's secret storage, else asked for once (when `ask`). Undefined when there is none. */
export async function openaiKey(ask = true): Promise<string | undefined> {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  const k = (await secrets?.get(SECRET))?.trim();
  if (k || !ask) return k || undefined;
  return setOpenAIKey();
}

export async function setOpenAIKey(): Promise<string | undefined> {
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

export async function clearOpenAIKey(): Promise<void> {
  const go = await vscode.window.showWarningMessage("Clear EDGEhack's OpenAI API key?", { modal: true, detail: "Generate asks for it again." }, "Clear It");
  if (go !== "Clear It") return;
  await secrets?.delete(SECRET);
  models.clear();
  void vscode.window.showInformationMessage("EDGEhack: the OpenAI API key is cleared.");
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
