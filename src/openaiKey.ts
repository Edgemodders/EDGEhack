// The OpenAI key and model for Generate (H3b.3): the key from the EDGE tools' shared store, asked for
// once in a password box when missing and saved there for every EDGE tool; the model from the
// key's own account, newest first, unless the edgehack.generate.model setting names one.
import * as vscode from "vscode";
import { checkKey, sharedKeys } from "./sharedKeys";
import { listModels, OPENAI, Quality } from "./imageService";

const Tool = "EDGEhack";

/** Another server instead of OpenAI's, for the smoke test. */
export const openaiBase = (): string | undefined => process.env.EDGEHACK_OPENAI_BASE || undefined;

/** The key: from the shared store, else asked for once (when `ask`). Undefined when there is none. */
export async function openaiKey(ask = true): Promise<string | undefined> {
  const k = await sharedKeys.getKey("openai", { tool: Tool });
  if (k || !ask) return k;
  return setOpenAIKey();
}

export async function setOpenAIKey(): Promise<string | undefined> {
  const k = await vscode.window.showInputBox({
    title: "EDGEhack: OpenAI API key",
    prompt: `For Generate on a quickhack's icons. Kept encrypted for your Windows account in the EDGE tools' shared key store, so every EDGE tool that needs it uses it too, and sent only to OpenAI. Make one at ${OPENAI.keyFrom}. Each Generate is a paid image on your account.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? checkKey("openai", v.trim()) : null),
  });
  if (!k?.trim()) return undefined;
  await sharedKeys.setKey("openai", k.trim());
  return k.trim();
}

export async function clearOpenAIKey(): Promise<void> {
  const go = await vscode.window.showWarningMessage("Clear the OpenAI API key?", { modal: true, detail: "It is the EDGE tools' shared key: every EDGE tool that uses it asks for it again." }, "Clear It");
  if (go !== "Clear It") return;
  await sharedKeys.removeKey("openai");
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
