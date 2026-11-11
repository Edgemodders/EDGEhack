// The save path, free of VS Code (H4.4): a quickhack's document into its project's mod files. The
// editor calls it on every save, Clone and Modify and Add to Project; the MCP server's hack_new and
// hack_edit (H4.5) will call it the same way.

import * as path from "node:path";
import type { HackCore } from "./core";
import type { QuickhackDoc } from "./document";
import type { IconWriter } from "./ownIcons";
import { writeDocFiles } from "./projectDocs";
import type { ProjectResult } from "./projectFiles";
import type { Family } from "./read";
import type { BridgeClient, ProjectRef } from "./types";

export interface SaveResult extends ProjectResult {
  /** The document's family, as read. */
  fam: Family;
  /** A new quickhack whose Get it could not be read this time, so it was left out (saving again tries once more). */
  salesMissing: boolean;
}

/**
 * Writes a document's mod files into the project: its TweakXL YAML, texts, own icons and the mod's
 * REDnode package. Reads its family, its added effects and, for a new quickhack, where the game sells it.
 */
export async function saveDocFiles(core: HackCore, project: ProjectRef, doc: QuickhackDoc, icons: IconWriter, onSalesMissing?: () => void): Promise<SaveResult> {
  const fam = await core.family(doc.family);
  const sales = doc.newHack ? await core.salesOrNone(fam) : undefined;
  if (doc.newHack && !sales) onSalesMissing?.();
  const added = await core.added(doc, fam);
  const result = await writeDocFiles(project, await core.bridge(), fam, doc, added, sales, icons, (key) => core.family(key));
  return { ...result, fam, salesMissing: !!doc.newHack && !sales };
}

/**
 * Own icons written through REDbridge itself, for EDGEhack outside VS Code: the import (with the UI
 * texture setup) and the JSON writer. Inside VS Code the editor imports through REDcode's API instead,
 * which also shows the files in REDcode's Project view.
 */
export function bridgeIconWriter(bridge: BridgeClient, project: ProjectRef): IconWriter {
  return {
    importFile: async (file, texture) => {
      const r = await bridge.importFile(path.resolve(file), project.raw, project.archive, true, undefined, { ...texture });
      return { ok: r.ok, written: r.written.map((w) => path.join(project.archive, w)), texture: r.texture ?? null };
    },
    fromJson: (outFile, json) => bridge.fromJson(outFile, { json }),
  };
}
