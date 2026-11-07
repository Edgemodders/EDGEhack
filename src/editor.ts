// The quickhack editor: a custom editor for <name>.quickhack.json. The document is the text file, so
// VS Code's save, undo and dirty marker work as for any file. Each save writes the mod's files into
// REDcode's project (docs/design.md, "H2: plan").
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { AddedField, BuiltEffect, DamageTypeName, parseDoc, printDoc, QuickhackDoc, TierField, TIER_FIELDS, newBuiltEffect, withAddedBuild, withAddedEffect, withAddedRecipient, withAddedTier, withAddedValue, withField, withoutAddedEffect, withTierField, newDoc } from "./document";
import { Family, iconOf, IconRef } from "./read";
import { writeTweaks } from "./tweaks";
import { isInside } from "./projectFiles";
import { makeNewHackDoc, newHackProblem, writeDocFiles } from "./projectDocs";
import { addedIcons, gameValue, renderAddedEffects, renderEditor } from "./editorHtml";
import { addedNotes, applyAddedToAll, effectSummary, offeredEffects, plainName, ResolvedAdded } from "./effects";
import { iconsOf } from "./pageHtml";
import { bridge, redcode } from "./redcode";
import * as fs from "node:fs";
import * as path from "node:path";

export const EditorViewType = "edgehack.quickhack.editor";

const round = (n: number): number => Math.round(n * 10000) / 10000;

export class QuickhackEditor implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, Set<vscode.WebviewPanel>>();
  /** The mod files being written after a save, by document: Pack and Play waits for them. */
  private readonly writing = new Map<string, Promise<void>>();

  constructor(private readonly hub: Hub) {}

  register(): vscode.Disposable {
    return vscode.Disposable.from(
      vscode.window.registerCustomEditorProvider(EditorViewType, this, { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false }),
      vscode.workspace.onDidSaveTextDocument((d) => {
        if (d.fileName.endsWith(".quickhack.json")) this.writing.set(d.uri.toString(), this.saved(d));
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

  /**
   * Makes a new quickhack from a family of the game's, in the open project, and opens it. Its mod files
   * are written at once, so Pack and Play works before any change (a save of an unchanged file writes
   * nothing). Asks for the name unless given one. Returns the document's file, or undefined if none was made.
   */
  async makeNew(key: string, given?: string): Promise<string | undefined> {
    if (key.startsWith("action:")) {
      void vscode.window.showInformationMessage("A new quickhack can start only from one for people, for now. Device and vehicle hacks come later.");
      return undefined;
    }
    const project = (await redcode()).project();
    if (!project) {
      void vscode.window.showWarningMessage("EDGEhack: open a WolvenKit project in REDcode first. A new quickhack goes into a project (the Desk, for working without one, comes later).");
      return undefined;
    }
    const catalog = await this.hub.catalog();
    const keys = catalog.families.map((f) => f.key);
    const familyName = catalog.families.find((f) => f.key === key)?.name ?? key;
    const name =
      given ??
      (await vscode.window.showInputBox({
        title: `Clone and Modify ${familyName}`,
        prompt: "The new quickhack's name, as players see it. You can change it later, but its record names come from this first name and stay.",
        placeHolder: "Spike Static",
        validateInput: (text) => (text ? newHackProblem(project, keys, key, text) : undefined),
      }));
    if (!name) return undefined;
    const { file, doc } = makeNewHackDoc(project, keys, key, name);
    this.hub.log.appendLine(`Made ${doc.id} from ${key}: ${file}`);
    try {
      const result = await writeDocFiles(project, await bridge(), await this.hub.family(key), doc);
      this.hub.log.appendLine(`Wrote ${doc.id}: ${result.yaml ?? "no YAML"}`);
    } catch (e) {
      void vscode.window.showErrorMessage(`EDGEhack made the document, but not its mod files: ${message(e)} Change something and save to try again.`);
    }
    await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(file), EditorViewType);
    return file;
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
    let added: ResolvedAdded[];
    let iconSet: Map<string, string>;
    try {
      doc = parseDoc(document.getText());
      fam = await this.hub.family(doc.family);
      added = await this.hub.added(doc, fam);
      panel.title = path.basename(document.fileName);
      const icons = await this.icons(w, fam, doc);
      iconSet = icons.all;
      await this.addIcons(w, iconSet, added);
      w.html = this.shell(w, renderEditor(fam, doc, icons, fam.tiers.length - 1, added));
    } catch (e) {
      w.html = this.shell(w, `<p class="error">${message(e).replace(/</g, "&lt;")}</p>`);
      return;
    }

    // Only the latest change is shown: reading a newly added effect can take longer than the next edit.
    let turn = 0;
    const show = async (): Promise<void> => {
      const mine = ++turn;
      const now = parseDoc(document.getText());
      const read = await this.hub.added(now, fam);
      await this.addIcons(w, iconSet, read);
      if (mine !== turn) return;
      doc = now;
      added = read;
      await w.postMessage({ doc, familyName: fam.name, warnings: writeTweaks(fam, doc, added).warnings, notes: addedNotes(fam, added), effectsHtml: renderAddedEffects(fam, added, iconSet) });
    };
    const changed = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length) return;
      show().catch((err: unknown) => void w.postMessage({ status: message(err), bad: true }));
    });
    panel.onDidDispose(() => {
      changed.dispose();
      shown.delete(panel);
    });
    void w.postMessage({ warnings: writeTweaks(fam, doc, added).warnings, notes: addedNotes(fam, added) });

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
        addEffect?: boolean;
        pickFamily?: string;
        addFrom?: { from: string; effect: string };
        addStatus?: { status: string; on?: "target" | "V" };
        addBuilt?: { kind: BuiltEffect["kind"]; applies?: string };
        addedBuild?: { id: string; field: "damageType" | "sparks" | "stat"; value: string | boolean };
        removeAdded?: string;
        addedOn?: { id: string; tier: string; on: boolean };
        addedWho?: { id: string; on: "target" | "V" };
        addedValue?: { id: string; tier: string; field: AddedField; value?: number; game?: number };
        addedAll?: { id: string; tier: string; field: AddedField };
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
          if (m.addEffect) await this.offerEffects(w, fam);
          if (m.pickFamily) await this.offerFamily(w, m.pickFamily);
          if (m.addFrom) await apply(document, withAddedEffect(current(), { from: m.addFrom.from, effect: m.addFrom.effect }));
          if (m.addStatus) await apply(document, withAddedEffect(current(), { status: m.addStatus.status, ...(m.addStatus.on === "V" ? { on: "V" as const } : {}) }));
          if (m.addBuilt) await apply(document, withAddedEffect(current(), { build: newBuiltEffect(m.addBuilt.kind, m.addBuilt.applies) }));
          if (m.addedBuild) {
            const f = m.addedBuild.field;
            const change = f === "sparks" ? { sparks: m.addedBuild.value === true } : f === "damageType" ? { damageType: m.addedBuild.value as DamageTypeName } : { stat: String(m.addedBuild.value) };
            await apply(document, withAddedBuild(current(), m.addedBuild.id, change));
          }
          if (m.removeAdded) await apply(document, withoutAddedEffect(current(), m.removeAdded));
          if (m.addedOn) await apply(document, withAddedTier(current(), m.addedOn.id, m.addedOn.tier, m.addedOn.on));
          if (m.addedWho) await apply(document, withAddedRecipient(current(), m.addedWho.id, m.addedWho.on));
          if (m.addedValue) await apply(document, withAddedValue(current(), m.addedValue.id, m.addedValue.tier, m.addedValue.field, m.addedValue.value, m.addedValue.game));
          if (m.addedAll) await apply(document, applyAddedToAll(current(), await this.hub.added(current(), fam), m.addedAll.id, m.addedAll.tier, m.addedAll.field));
          if (m.pack) {
            await document.save();
            await this.writing.get(document.uri.toString());
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
      const result = await writeDocFiles(project, await bridge(), fam, doc, await this.hub.added(doc, fam));
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

  /** Adds the added effects' icons to those the page can show. */
  private async addIcons(w: vscode.Webview, all: Map<string, string>, added: ResolvedAdded[]): Promise<void> {
    for (const icon of addedIcons(added)) {
      const key = `${icon.atlas}|${icon.part}`;
      if (all.has(key)) continue;
      const src = await this.src(w, icon);
      if (src) all.set(key, src);
    }
  }

  private async iconSrc(w: vscode.Webview, fam: Family, which: "item" | "wheel", value?: string): Promise<string | undefined> {
    const top = fam.tiers[fam.tiers.length - 1];
    return this.src(w, value ? await iconOf(this.hub.reader, value) : which === "item" ? top.icons.item : top.icons.wheel);
  }

  private async src(w: vscode.Webview, icon: IconRef | undefined): Promise<string | undefined> {
    const file = await this.hub.icons.file(icon);
    return file ? w.asWebviewUri(vscode.Uri.file(file)).toString() : undefined;
  }

  /** Offers the picker's two sources on the page: the other families, and the status effects. */
  private async offerEffects(w: vscode.Webview, fam: Family): Promise<void> {
    await w.postMessage({ status: "Reading the game's status effects\u2026" });
    const catalog = await this.hub.catalog();
    const families = [];
    for (const f of catalog.families) {
      if (f.key === fam.key) continue;
      families.push({ key: f.key, name: f.name, src: await this.src(w, await iconOf(this.hub.reader, f.icon)) });
    }
    await w.postMessage({ status: "Pick an effect.", effectPicker: { families, pool: await this.hub.effectPool() } });
  }

  /** Offers a family's effects on the page. */
  private async offerFamily(w: vscode.Webview, key: string): Promise<void> {
    const source = await this.hub.family(key);
    const effects = [];
    for (const o of offeredEffects(source)) {
      effects.push({ key: o.key, name: plainName(o.effect.name), summary: effectSummary(o.effect), src: await this.src(w, o.effect.icon) });
    }
    await w.postMessage({ effectFamily: { key, name: source.name, effects } });
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
