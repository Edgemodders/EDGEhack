// REDcode, which EDGEhack builds on (extensionDependencies). Found at runtime and never imported:
// the interfaces below copy the parts of REDcodeApi version 1 that EDGEhack uses (REDcode 0.10.5,
// extensions/redcode/src/api.ts and types.ts there; https://edgemodders.github.io/REDcode/api.html).
// The bridge's and the project's types are in types.ts, which the core outside VS Code uses too.

import * as vscode from "vscode";
import type { BridgeClient, ProjectRef } from "./types";

export const REDcodeId = "edgemodders.redcode-cyberpunk";

export interface REDcodeApi {
  readonly apiVersion: 1;
  readonly version: string;
  bridge(): BridgeClient | undefined;
  gamePath(): string | undefined;
  project(): ProjectRef | undefined;
  readonly onDidChangeProject: vscode.Event<ProjectRef | undefined>;
  /**
   * Imports a file under the project's source/raw into source/archive, as Import from Raw does. `texture`
   * sets an image's .xbm setup (REDcode issue 25, REDbridge 0.12.0); a REDcode with it answers the setup
   * read back as `texture`, an older one leaves it out.
   */
  importFile(file: string, options?: { template?: string; texture?: Record<string, string | boolean> }): Promise<{ ok: boolean; written: string[]; texture?: unknown }>;
  /** Packs the project and gets it into the game as fast as it allows (REDcode: Pack and Play). */
  packAndPlay(): Promise<"rednode" | "hot" | "installed" | undefined>;
}

/** REDcode's API, activating REDcode if needed. Throws with a message for the user when it is missing or too old. */
export async function redcode(): Promise<REDcodeApi> {
  const ext = vscode.extensions.getExtension<Partial<REDcodeApi> | undefined>(REDcodeId);
  if (!ext) throw new Error("EDGEhack needs REDcode for Cyberpunk 2077 (edgemodders.redcode-cyberpunk). Install it from the Marketplace.");
  const api = ext.isActive ? ext.exports : await ext.activate();
  if (!api || api.apiVersion !== 1 || typeof api.bridge !== "function") {
    const version = String((ext.packageJSON as { version?: string }).version ?? "unknown");
    throw new Error(`EDGEhack needs REDcode 0.10.5 or later, with its API version 1; REDcode ${version} is installed. Update REDcode.`);
  }
  return api as REDcodeApi;
}

/** REDcode's running REDbridge, or an error the user can act on. */
export async function bridge(): Promise<BridgeClient> {
  const b = (await redcode()).bridge();
  if (!b || b.running === false) throw new Error("REDcode's REDbridge is not running. Open REDcode's side bar, or run REDcode: Restart REDbridge.");
  return b;
}
