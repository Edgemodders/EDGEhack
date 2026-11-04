// The quickhack editor: a custom editor for <name>.quickhack.json. The document is the text file, so
// VS Code's save, undo and dirty marker work as for any file. Each save writes the mod's files into
// REDcode's project (docs/design.md, "H2: plan").
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { parseDoc, printDoc, QuickhackDoc, TierField, TIER_FIELDS, withField, withTierField, newDoc } from "./document";
import { Family, iconOf, IconRef } from "./read";
import { writeTweaks } from "./tweaks";
import { isInside, writeProject } from "./projectFiles";
import { gameValue, renderEditor } from "./editorHtml";
import { iconsOf } from "./pageHtml";
import { bridge, redcode } from "./redcode";
import * as fs from "node:fs";
import * as path from "node:path";

export const EditorViewType = "edgehack.quickhack.editor";

const round = (n: number): number => Math.round(n * 10000) / 10000;

export class QuickhackEditor implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, Set<vscode.WebviewPanel>>();

  constructor(private readonly hub: Hub) {}

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      vscode.window.registerCustomEditorProvider(EditorViewType, this, { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false }),
      vscode.workspace.onDidSaveTextDocument((d) => {
        if (d.fileName.endsWith(".quickhack.json")) void this.saved(d);
      }),
    );
  }

  /** Makes the document for a family in the open project, or opens the one it has. */
  async edit(key: string): Promise<void> {
    const project = (await redcode()).project();
    if (!project) {
      void vscode.window.showWarningMessage("EDGEhack: open a WolvenKit project in REDcode first. A changed quickhack goes into a project (the Desk, for working without one, comes later).");
      return;
    }
    const doc = newDoc(project.modName, key);
    const file = path.join(project.raw, "edgehack", `${doc.id}.quickhack.json`);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, printDoc(doc));
    }
    await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(file), EditorViewType);
  }

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    const w = panel.webview;
    w.options = {
      enableScripts: true,
      // The storage folder as a file: URI: the context gives it with the vscode-userdata scheme, which
      // never matches the file: URIs of the icons, and each image would get a 401.
      localResourceRoots: [vscode.Uri.file(this.hub.storage.fsPath), vscode.Uri.joinPath(this.hub.extensionUri, "media")],
    };
    const shown = this.panels.get(document.uri.toString()) ?? new Set();
    shown.add(panel);
    this.panels.set(document.uri.toString(), shown);
    w.html = this.shell(w, `<p class="loading">Reading the quickhack from the game…</p>`);

    let doc: QuickhackDoc;
    let fam: Family;
    try {
      doc = parseDoc(document.getText());
      fam = await this.hub.family(doc.family);
      panel.title = path.basename(document.fileName);
      w.html = this.shell(w, renderEditor(fam, doc, await this.icons(w, fam, doc), fam.tiers.length - 1));
    } catch (e) {
      w.html = this.shell(w, `<p class="error">${message(e).replace(/</g, "&lt;")}</p>`);
      return;
    }

    const changed = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length) return;
      try {
        doc = parseDoc(document.getText());
        void w.postMessage({ doc, familyName: fam.name, warnings: writeTweaks(fam, doc).warnings });
      } catch (err) {
        void w.postMessage({ status: message(err), bad: true });
      }
    });
    panel.onDidDispose(() => {
      changed.dispose();
      shown.delete(panel);
    });
    void w.postMessage({ warnings: writeTweaks(fam, doc).warnings });

    // One message at a time, each from the document as it is now: two quick changes would otherwise
    // both start from the same text, and the second would undo the first.
    let queue: Promise<void> = Promise.resolve();
    const current = (): QuickhackDoc => parseDoc(document.getText());
    w.onDidReceiveMessage(
      (m: {
        set?: { field: keyof QuickhackDoc; value?: string | number; game?: string | number };
        setTier?: { tier: string; field: TierField; value?: number; game?: number };
        applyAll?: { field: TierField; tier?: string };
        chooseIcon?: "item" | "wheel";
        setIcon?: { which: "item" | "wheel"; value?: string };
        open?: string;
        pack?: boolean;
      }) => {
        queue = queue.then(async () => {
        try {
          if (m.open) void vscode.commands.executeCommand("redcode.openTweakRecord", m.open);
          if (m.set) await apply(document, withField(current(), m.set.field, m.set.value, m.set.game));
          if (m.setTier) await apply(document, withTierField(current(), m.setTier.tier, m.setTier.field, m.setTier.value, m.setTier.game));
          if (m.applyAll?.tier) await apply(document, applyToAll(fam, current(), m.applyAll.tier, m.applyAll.field));
          if (m.chooseIcon) await this.choose(w, m.chooseIcon);
          if (m.setIcon) {
            const field = m.setIcon.which === "item" ? "itemIcon" : "wheelIcon";
            await apply(document, withField(current(), field, m.setIcon.value));
            await w.postMessage({ iconShown: { which: m.setIcon.which, changed: !!m.setIcon.value, src: await this.iconSrc(w, fam, m.setIcon.which, m.setIcon.value) } });
          }
          if (m.pack) {
            await document.save();
            await (await redcode()).packAndPlay();
            await w.postMessage({ status: "Packed." });
          }
        } catch (e) {
          await w.postMessage({ status: message(e), bad: true });
        }
        });
      },
    );
  }

  /** Writes the mod's files when a document is saved, and says how it went on its page. */
  private async saved(document: vscode.TextDocument): Promise<void> {
    const say = (status: string, bad = false): void => {
      for (const p of this.panels.get(document.uri.toString()) ?? []) void p.webview.postMessage({ status, bad });
    };
    try {
      const doc = parseDoc(document.getText());
      const project = (await redcode()).project();
      if (!project || !isInside(document.fileName, project.dir)) {
        say("Saved, but this document is not in the project open in REDcode, so no mod files were written.", true);
        return;
      }
      const fam = await this.hub.family(doc.family);
      const written = writeTweaks(fam, doc);
      const result = await writeProject(project, await bridge(), doc, written);
      this.hub.log.appendLine(`Saved ${doc.id}: ${result.yaml ?? "no YAML, nothing changed"}${result.texts ? `, texts in ${result.texts}` : ""}`);
      say(result.yaml ? `Saved: ${path.relative(project.dir, result.yaml)}${result.texts ? ", and its texts" : ""}.` : "Saved. It changes nothing yet, so there are no mod files.");
    } catch (e) {
      this.hub.log.appendLine(`Saving ${document.fileName} failed: ${message(e)}`);
      say(message(e), true);
    }
  }

  private async icons(w: vscode.Webview, fam: Family, doc: QuickhackDoc): Promise<{ all: Map<string, string>; item?: string; wheel?: string }> {
    const all = new Map<string, string>();
    for (const icon of iconsOf(fam)) {
      const src = await this.src(w, icon);
      if (src) all.set(`${icon.atlas}|${icon.part}`, src);
    }
    return { all, item: doc.itemIcon ? await this.src(w, await iconOf(this.hub.reader, doc.itemIcon)) : undefined, wheel: doc.wheelIcon ? await this.src(w, await iconOf(this.hub.reader, doc.wheelIcon)) : undefined };
  }

  private async iconSrc(w: vscode.Webview, fam: Family, which: "item" | "wheel", value?: string): Promise<string | undefined> {
    const top = fam.tiers[fam.tiers.length - 1];
    return this.src(w, value ? await iconOf(this.hub.reader, value) : which === "item" ? top.icons.item : top.icons.wheel);
  }

  private async src(w: vscode.Webview, icon: IconRef | undefined): Promise<string | undefined> {
    const file = await this.hub.icons.file(icon);
    return file ? w.asWebviewUri(vscode.Uri.file(file)).toString() : undefined;
  }

  /** Offers the game's quickhack icons on the page. */
  private async choose(w: vscode.Webview, which: "item" | "wheel"): Promise<void> {
    await w.postMessage({ status: "Reading the game's icons…" });
    const choices = [];
    for (const icon of await this.hub.quickhackIcons(which)) {
      const src = await this.src(w, icon);
      if (src) choices.push({ value: icon.record, label: icon.part, src });
    }
    await w.postMessage({ status: "Pick an icon.", picker: { which, title: which === "item" ? "The item's icon, from the game's quickhacks" : "The wheel's icon, from the game's quickhacks", choices } });
  }

  private shell(w: vscode.Webview, body: string): string {
    const css = w.asWebviewUri(vscode.Uri.joinPath(this.hub.extensionUri, "media", "page.css"));
    const js = w.asWebviewUri(vscode.Uri.joinPath(this.hub.extensionUri, "media", "editor.js"));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${w.cspSource}; style-src ${w.cspSource}; script-src ${w.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"></head>
<body>${body}${body.includes("<main") ? `<script src="${js}"></script>` : ""}</body></html>`;
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Gives every other tier the selected tier's change in a number: the same difference from its own value. */
export function applyToAll(fam: Family, doc: QuickhackDoc, tier: string, field: TierField): QuickhackDoc {
  if (!TIER_FIELDS.includes(field)) return doc;
  const from = fam.tiers.find((t) => (t.item ?? t.action) === tier);
  const base = from && gameValue(from, field);
  const want = doc.tiers[tier]?.[field];
  if (base === undefined || want === undefined) return doc;
  const diff = want - base;
  let next = doc;
  for (const t of fam.tiers) {
    const game = gameValue(t, field);
    if (game === undefined) continue;
    next = withTierField(next, t.item ?? t.action, field, round(Math.max(0, game + diff)), game);
  }
  return next;
}

async function apply(document: vscode.TextDocument, doc: QuickhackDoc): Promise<void> {
  const text = printDoc(doc);
  if (text === document.getText()) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
  await vscode.workspace.applyEdit(edit);
}
