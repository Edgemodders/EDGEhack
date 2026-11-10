// The quickhack editor: a custom editor for <name>.quickhack.json. The document is the text file, so
// VS Code's save, undo and dirty marker work as for any file. Each save writes the mod's files into
// REDcode's project (docs/design.md, "H2: plan").
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { AddedField, BuiltEffect, DamageTypeName, parseDoc, printDoc, QuickhackDoc, TierField, TIER_FIELDS, newBuiltEffect, withAddedBuild, withAddedEffect, withAddedRecipient, withAddedTier, withAddedValue, withField, withoutAddedEffect, withTierField, newDoc, withGetIt, GetIt } from "./document";
import { Family, iconOf, IconRef } from "./read";
import { writeTweaks } from "./tweaks";
import { isInside } from "./projectFiles";
import { makeNewHackDoc, newHackProblem, writeDocFiles } from "./projectDocs";
import { addedIcons, gameValue, renderAddedEffects, renderEditor, renderGetIt } from "./editorHtml";
import type { Sales } from "./getit";
import { addedNotes, applyAddedToAll, effectSummary, offeredEffects, plainName, ResolvedAdded } from "./effects";
import { iconsOf } from "./pageHtml";
import { bridge, redcode } from "./redcode";
import { deskChange, deskNewHackProblem, deskRoot, makeDeskNewHack, onDesk, projectPlace, savedOnDesk, writeToProject } from "./desk";
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

  /** Makes the document for a family in the open project, or on the Desk with none open, or opens the one there. */
  async edit(key: string): Promise<void> {
    const project = (await redcode()).project();
    if (!project) {
      const familyName = (await this.hub.catalog()).families.find((f) => f.key === key)?.name ?? key;
      const item = deskChange(deskRoot(), key, familyName);
      this.hub.log.appendLine(`Edit ${key} on the Desk: ${item.file}`);
      this.onDeskChanged?.();
      await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(item.file), EditorViewType);
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
   * With no project open, or `toDesk`, it goes on the Desk instead, with no mod files (H3.7).
   */
  async makeNew(key: string, given?: string, toDesk = false): Promise<string | undefined> {
    if (key.startsWith("action:")) {
      void vscode.window.showInformationMessage("A new quickhack can start only from one for people, for now. Device and vehicle hacks come later.");
      return undefined;
    }
    const project = toDesk ? undefined : (await redcode()).project();
    if (!project) return this.makeOnDesk(key, given);
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
      const fam = await this.hub.family(key);
      const result = await writeDocFiles(project, await bridge(), fam, doc, [], await this.salesFor(fam));
      this.hub.log.appendLine(`Wrote ${doc.id}: ${result.yaml ?? "no YAML"}`);
      announceCreated(project.dir, result.created);
    } catch (e) {
      void vscode.window.showErrorMessage(`EDGEhack made the document, but not its mod files: ${message(e)} Change something and save to try again.`);
    }
    await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(file), EditorViewType);
    return file;
  }

  /** Called when the Desk's folders change, so its view can follow. */
  onDeskChanged?: () => void;

  private async makeOnDesk(key: string, given?: string): Promise<string | undefined> {
    const root = deskRoot();
    const catalog = await this.hub.catalog();
    const keys = catalog.families.map((f) => f.key);
    const familyName = catalog.families.find((f) => f.key === key)?.name ?? key;
    const name =
      given ??
      (await vscode.window.showInputBox({
        title: `Clone and Modify ${familyName}, on the Desk`,
        prompt: "The new quickhack's name, as players see it. It goes on the Desk until you add it to a project; its record names come from its name then.",
        placeHolder: "Spike Static",
        validateInput: (text) => (text ? deskNewHackProblem(root, keys, key, text) : undefined),
      }));
    if (!name) return undefined;
    const item = makeDeskNewHack(root, keys, key, name);
    this.hub.log.appendLine(`Made ${item.doc?.id} from ${key} on the Desk: ${item.file}`);
    this.onDeskChanged?.();
    await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(item.file), EditorViewType);
    return item.file;
  }

  /**
   * Add to Project: a Desk document goes into the open project under the project's ids, its mod files are
   * written, and the project's copy opens. The Desk keeps its own, as EDGEfab's does; adding it again
   * replaces the project's, after asking. Returns the project's file, or undefined if nothing was added.
   */
  async addToProject(file: string): Promise<string | undefined> {
    const project = (await redcode()).project();
    if (!project) {
      void vscode.window.showWarningMessage("EDGEhack: open a WolvenKit project in REDcode first, then Add to Project again.");
      return undefined;
    }
    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === vscode.Uri.file(file).fsPath);
    if (open?.isDirty) await open.save();
    const doc = parseDoc(fs.readFileSync(file, "utf8"));
    const catalog = await this.hub.catalog();
    const place = projectPlace(project, catalog.families.map((f) => f.key), doc);
    const shown = doc.name || catalog.families.find((f) => f.key === doc.family)?.name || doc.family;
    if (place.replaces) {
      const choice = await vscode.window.showWarningMessage(
        `${project.name} already has ${path.basename(place.file)}. Replace it with the Desk's ${shown}? Changes made to it in the project are lost.`,
        { modal: true },
        "Replace",
      );
      if (choice !== "Replace") return undefined;
      // An open editor on the project's copy would keep its old text and could save it back.
      const there = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === vscode.Uri.file(place.file).fsPath);
      if (there?.isDirty) await vscode.commands.executeCommand("workbench.action.revertFile", there.uri);
    }
    writeToProject(place);
    this.hub.log.appendLine(`Added ${shown} from the Desk to ${project.name}: ${place.file}`);
    try {
      const fam = await this.hub.family(place.doc.family);
      const sales = place.doc.newHack ? await this.salesFor(fam) : undefined;
      const result = await writeDocFiles(project, await bridge(), fam, place.doc, await this.hub.added(place.doc, fam), sales);
      this.hub.log.appendLine(`Wrote ${place.doc.id}: ${result.yaml ?? "no YAML"}`);
      announceCreated(project.dir, result.created);
    } catch (e) {
      void vscode.window.showErrorMessage(`EDGEhack added the document to the project, but not its mod files: ${message(e)} Change something and save to try again.`);
    }
    await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(place.file), EditorViewType);
    return place.file;
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
    const desk = onDesk(document.fileName);

    let doc: QuickhackDoc;
    let fam: Family;
    let added: ResolvedAdded[];
    let iconSet: Map<string, string>;
    // Get it's reading of the game's vendors and schematics: a few seconds the first time, so the page
    // opens without it and shows it when it comes.
    let sales: Sales | undefined;
    try {
      doc = parseDoc(document.getText());
      fam = await this.hub.family(doc.family);
      added = await this.hub.added(doc, fam);
      panel.title = path.basename(document.fileName);
      const icons = await this.icons(w, fam, doc);
      iconSet = icons.all;
      await this.addIcons(w, iconSet, added);
      w.html = this.shell(w, renderEditor(fam, doc, icons, fam.tiers.length - 1, added, undefined, desk));
      if (doc.newHack) {
        void this.salesFor(fam).then((got) => {
          sales = got;
          void w.postMessage({ getItHtml: renderGetIt(fam, doc, sales, desk), warnings: writeTweaks(fam, doc, added, sales).warnings });
        });
      }
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
      await w.postMessage({
        doc,
        familyName: fam.name,
        warnings: writeTweaks(fam, doc, added, sales).warnings,
        notes: addedNotes(fam, added),
        effectsHtml: renderAddedEffects(fam, added, iconSet),
        ...(doc.newHack ? { getItHtml: renderGetIt(fam, doc, sales, desk) } : {}),
      });
    };
    const changed = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length) return;
      show().catch((err: unknown) => void w.postMessage({ status: message(err), bad: true }));
    });
    panel.onDidDispose(() => {
      changed.dispose();
      shown.delete(panel);
    });
    void w.postMessage({ warnings: writeTweaks(fam, doc, added, sales).warnings, notes: addedNotes(fam, added) });

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
        getIt?: { tier: string; field: keyof GetIt; value?: boolean | number; game?: number };
        open?: string;
        pack?: boolean;
        addToProject?: boolean;
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
          if (m.getIt) await apply(document, withGetIt(current(), m.getIt.tier, m.getIt.field, m.getIt.value, m.getIt.game));
          if (m.addToProject) {
            await document.save();
            await this.addToProject(document.fileName);
          }
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
      if (onDesk(document.fileName)) {
        savedOnDesk(document.fileName, doc.name);
        this.onDeskChanged?.();
        say("Saved on the Desk. Add to Project writes its mod files into a project.");
        return;
      }
      const project = (await redcode()).project();
      if (!project || !isInside(document.fileName, project.dir)) {
        say("Saved, but this document is not in the project open in REDcode, so no mod files were written.", true);
        return;
      }
      const fam = await this.hub.family(doc.family);
      const sales = doc.newHack ? await this.salesFor(fam) : undefined;
      if (doc.newHack && !sales) say("Saved, but where the game sells it could not be read, so Get it was left out this time. Save again to try once more.", true);
      const result = await writeDocFiles(project, await bridge(), fam, doc, await this.hub.added(doc, fam), sales);
      this.hub.log.appendLine(`Saved ${doc.id}: ${result.yaml ?? "no YAML, nothing changed"}${result.texts ? `, texts in ${result.texts}` : ""}`);
      announceCreated(project.dir, result.created);
      say(result.yaml ? `Saved: ${path.relative(project.dir, result.yaml)}${result.texts ? ", and its texts" : ""}.` : "Saved. It changes nothing yet, so there are no mod files.");
    } catch (e) {
      this.hub.log.appendLine(`Saving ${document.fileName} failed: ${message(e)}`);
      say(message(e), true);
    }
  }

  /** How the game hands out a family's tiers, or undefined (logged) when it could not be read. */
  private async salesFor(fam: Family): Promise<Sales | undefined> {
    try {
      return await this.hub.sales(fam);
    } catch (e) {
      this.hub.log.appendLine(`Get it: reading where the game sells ${fam.name} failed: ${message(e)}`);
      return undefined;
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

/** A toast for files a write added to the project, with Open to see them as text in new tabs. */
function announceCreated(projectDir: string, created: string[]): void {
  if (!created.length) return;
  const names = created.map((f) => path.relative(projectDir, f).split(path.sep).join("/"));
  const text = names.length === 1 ? `EDGEhack added a file to the project: ${names[0]}` : `EDGEhack added ${names.length} files to the project: ${names.join(", ")}`;
  void vscode.window.showInformationMessage(text, "Open").then(async (choice) => {
    if (choice !== "Open") return;
    for (const f of created) await vscode.window.showTextDocument(vscode.Uri.file(f), { preview: false });
  });
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
