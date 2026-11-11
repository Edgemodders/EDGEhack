// The quickhack editor: a custom editor for <name>.quickhack.json. The document is the text file, so
// VS Code's save, undo and dirty marker work as for any file. Each save writes the mod's files into
// REDcode's project (docs/design.md, "H2: plan").
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { AddedField, BuiltEffect, DamageTypeName, parseDoc, printDoc, QuickhackDoc, TierField, TIER_FIELDS, newBuiltEffect, withAddedBuild, withAddedEffect, withAddedRecipient, withAddedTier, withAddedValue, withField, withoutAddedEffect, withTierField, newDoc, withGetIt, GetIt, IconLook, withOwnIcon, withScripts } from "./document";
import { Family, iconOf, IconRef, mainEffect } from "./read";
import { iconFile, IconWriter, LOOKS } from "./ownIcons";
import { decodePng } from "./png";
import { writeTweaks } from "./tweaks";
import { isInside } from "./projectFiles";
import { makeNewHackDoc, newHackProblem, writeDocFiles } from "./projectDocs";
import { addFunction, exportsOf, functionStub, lineOf, packageDir, scriptFileName, type ScriptFunction } from "./scripts";
import { addedIcons, gameValue, renderAddedEffects, renderEditor, renderGetIt, renderScripts, type ScriptsState } from "./editorHtml";
import type { Sales } from "./getit";
import { addedNotes, applyAddedToAll, effectSummary, offeredEffects, plainName, ResolvedAdded } from "./effects";
import { iconsOf } from "./pageHtml";
import { bridge, redcode } from "./redcode";
import { generateLook } from "./generate";
import { cleanWords } from "./iconPrompts";
import { openaiBase, openaiKey, openaiModel, openaiQuality } from "./openaiKey";
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
      const result = await writeDocFiles(project, await bridge(), fam, doc, [], await this.salesFor(fam), await iconWriter(), (key) => this.hub.family(key));
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
    writeToProject(place, { file, id: doc.id });
    this.hub.log.appendLine(`Added ${shown} from the Desk to ${project.name}: ${place.file}`);
    try {
      const fam = await this.hub.family(place.doc.family);
      const sales = place.doc.newHack ? await this.salesFor(fam) : undefined;
      const result = await writeDocFiles(project, await bridge(), fam, place.doc, await this.hub.added(place.doc, fam), sales, await iconWriter(), (key) => this.hub.family(key));
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
      const icons = await this.icons(w, fam, doc, document.fileName);
      iconSet = icons.all;
      await this.addIcons(w, iconSet, added);
      w.html = this.shell(w, renderEditor(fam, doc, icons, fam.tiers.length - 1, added, undefined, desk, await this.scriptsState(document, doc)));
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
        scriptsHtml: renderScripts(await this.scriptsState(document, doc)),
        ...(doc.newHack ? { getItHtml: renderGetIt(fam, doc, sales, desk) } : {}),
      });
    };
    // The script file is the modder's: when it is saved, or the page comes back, show what it exports now.
    const scriptsAgain = (): void => {
      void this.scriptsState(document, parseDoc(document.getText()))
        .then((s) => w.postMessage({ scriptsHtml: renderScripts(s) }))
        .catch(() => undefined);
    };
    const scriptSaved = vscode.workspace.onDidSaveTextDocument((d) => {
      if (/\.m?js$/.test(d.fileName)) scriptsAgain();
    });
    panel.onDidChangeViewState(() => panel.visible && scriptsAgain());
    const changed = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length) return;
      show().catch((err: unknown) => void w.postMessage({ status: message(err), bad: true }));
    });
    panel.onDidDispose(() => {
      changed.dispose();
      scriptSaved.dispose();
      shown.delete(panel);
    });
    void w.postMessage({ warnings: writeTweaks(fam, doc, added, sales).warnings, notes: addedNotes(fam, added) });

    // Generate (H3b.3): one run at a time on this page, outside the message queue, since an image can
    // take a minute and the page stays editable meanwhile. The Item's last picture is kept for the
    // Wheel and Status drawn from it. A run also shows in a progress notification with Cancel, so a
    // modder who goes to another tab sees it end or stops it there; when it ends with the page out of
    // sight, a notification says so, with Show.
    let generating: AbortController | undefined;
    let itemPicture: Buffer | undefined;
    panel.onDidDispose(() => generating?.abort());
    const generate = async (g: { which: IconLook | "all"; words: string; fromItem?: boolean }): Promise<void> => {
      if (generating) return void w.postMessage({ status: "A Generate is already running on this page. Wait for it, or Cancel it.", bad: true });
      const words = cleanWords(g.words ?? "");
      if (!words) return void w.postMessage({ generateDone: { error: "Say what the icon shows first, such as \"a skull made of static\"." } });
      const looks: IconLook[] = g.which === "all" ? ["item", "wheel", "status"] : [g.which];
      const run = new AbortController();
      generating = run;
      const name = current().name || fam.name;
      const what = g.which === "all" ? "icons" : `${LOOKS[g.which].label} icon`;
      // The page out of sight when the run ends: tell the modder, with a way back to it.
      const tell = (text: string, bad = false): void => {
        if (panel.visible) return;
        const show = "Show";
        void (bad ? vscode.window.showWarningMessage(text, show) : vscode.window.showInformationMessage(text, show)).then((pick) => pick === show && panel.reveal());
      };
      try {
        const key = await openaiKey(true);
        if (!key) return void w.postMessage({ generateDone: { error: "Generate needs an OpenAI key. Run EDGEhack: Set the OpenAI Key, or press Generate again." } });
        const model = await openaiModel(key);
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `EDGEhack: generating ${name}'s ${what}`, cancellable: true },
          async (progress, token) => {
            token.onCancellationRequested(() => run.abort());
            // GPT Image says nothing until the picture is done, so the bar moves on the clock: each image
            // has an equal share, filled to nine tenths over about a minute, and the rest when it comes.
            const share = 100 / looks.length;
            for (const [i, look] of looks.entries()) {
              const reference = look !== "item" && (g.which === "all" || g.fromItem) ? itemPicture : undefined;
              const step = looks.length > 1 ? ` (${i + 1} of ${looks.length})` : "";
              progress.report({ message: `${LOOKS[look].label}${step}: one paid image, up to a minute…` });
              await w.postMessage({ status: `Generating the ${LOOKS[look].label} icon with ${model}${reference ? ", from the Item's picture" : ""}: one paid image, up to a minute…` });
              let moved = 0;
              const clock = setInterval(() => {
                const more = Math.min(share / 30, share * 0.9 - moved);
                if (more <= 0) return;
                moved += more;
                progress.report({ increment: more });
              }, 2000);
              try {
                const got = await generateLook(look, words, { key, model, base: openaiBase(), quality: openaiQuality(), signal: run.signal }, reference);
                if (look === "item") itemPicture = got.png;
                this.hub.log.appendLine(`Generated the ${look} icon of ${document.fileName} with ${model}: ${got.png.length} bytes.`);
                await w.postMessage({ generated: { which: look, image: `data:image/png;base64,${got.png.toString("base64")}`, prompt: got.prompt, model } });
              } finally {
                clearInterval(clock);
              }
              progress.report({ increment: share - moved });
            }
          },
        );
        await w.postMessage({ generateDone: {}, status: "Keep the ones you like. Nothing goes into the mod until Keep, then Save." });
        tell(`EDGEhack: ${name}'s ${what} ${g.which === "all" ? "are" : "is"} ready. Keep the ones you like.`);
      } catch (e) {
        this.hub.log.appendLine(`Generate failed: ${message(e)}`);
        await w.postMessage({ generateDone: { error: message(e) } });
        if (!run.signal.aborted) tell(`EDGEhack: generating ${name}'s ${what} failed: ${message(e)}`, true);
      } finally {
        generating = undefined;
      }
    };

    // One message at a time, each from the document as it is now: two quick changes would otherwise
    // both start from the same text, and the second would undo the first.
    let queue: Promise<void> = Promise.resolve();
    const current = (): QuickhackDoc => parseDoc(document.getText());
    w.onDidReceiveMessage(
      (m: {
        generate?: { which: IconLook | "all"; words: string; fromItem?: boolean };
        generateCancel?: boolean;
        set?: { field: keyof QuickhackDoc; value?: string | number; game?: string | number };
        setTier?: { tier: string; field: TierField; value?: number; game?: number };
        applyAll?: { field: TierField; tier?: string };
        chooseIcon?: "item" | "wheel";
        setIcon?: { which: IconLook; value?: string };
        uploadIcon?: { which: IconLook; png: string; generated?: boolean };
        uploadFailed?: string;
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
        scriptAdd?: ScriptFunction;
        scriptOpen?: ScriptFunction;
        scriptText?: string;
        scriptRemove?: boolean;
        open?: string;
        pack?: boolean;
        addToProject?: boolean;
      }) => {
        if (m.generate) return void generate(m.generate);
        if (m.generateCancel) return void generating?.abort();
        queue = queue.then(async () => {
        try {
          if (m.open) void vscode.commands.executeCommand("redcode.openTweakRecord", m.open);
          if (m.set) await apply(document, withField(current(), m.set.field, m.set.value, m.set.game));
          if (m.setTier) await apply(document, withTierField(current(), m.setTier.tier, m.setTier.field, m.setTier.value, m.setTier.game));
          if (m.applyAll?.tier) await apply(document, applyToAll(fam, current(), m.applyAll.tier, m.applyAll.field));
          if (m.chooseIcon) await this.choose(w, m.chooseIcon);
          if (m.setIcon) {
            // A game icon picked, or Original: either way the own picture (if any) stops being used. Its
            // file stays, so VS Code's undo brings it back.
            const which = m.setIcon.which;
            let next = withOwnIcon(current(), which, false);
            if (which !== "status") next = withField(next, which === "item" ? "itemIcon" : "wheelIcon", m.setIcon.value);
            await apply(document, next);
            await w.postMessage({ iconShown: { which, changed: !!m.setIcon.value, src: await this.iconSrc(w, fam, which, m.setIcon.value) } });
          }
          if (m.uploadIcon) {
            const which = m.uploadIcon.which;
            const png = Buffer.from(m.uploadIcon.png.replace(/^data:image\/png;base64,/, ""), "base64");
            const img = decodePng(png);
            const look = LOOKS[which];
            if (img.width !== look.width || img.height !== look.height) throw new Error(`The picture came back ${img.width} x ${img.height}, not ${look.width} x ${look.height}.`);
            const doc = current();
            const file = iconFile(document.fileName, doc.id, which);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, png);
            await apply(document, withOwnIcon(doc, which, true));
            await w.postMessage({ iconShown: { which, changed: true, src: m.uploadIcon.png }, status: `${look.label} icon ${m.uploadIcon.generated ? "kept" : "uploaded"}. Save to write it into the mod.` });
          }
          if (m.uploadFailed) await w.postMessage({ status: `That picture could not be read: ${m.uploadFailed}`, bad: true });
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
          if (m.scriptAdd || m.scriptOpen) {
            const project = (await redcode()).project();
            if (!project || onDesk(document.fileName) || !isInside(document.fileName, project.dir)) throw new Error("Its script goes in a project's REDnode package: add the quickhack to a project first.");
            const doc = current();
            const file = path.join(packageDir(project), doc.scripts?.file ?? scriptFileName(doc));
            const fn = (m.scriptAdd ?? m.scriptOpen) as ScriptFunction;
            const uri = vscode.Uri.file(file);
            const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === uri.fsPath);
            if (m.scriptAdd) {
              // Open with changes not saved: the function goes into the editor, not under it on disk.
              let did: "created" | "added" | "there";
              if (open?.isDirty) {
                did = exportsOf(open.getText()).includes(fn) ? "there" : "added";
                if (did === "added") {
                  const edit = new vscode.WorkspaceEdit();
                  edit.insert(uri, open.positionAt(open.getText().length), `\n${functionStub(fn, doc.name || fam.name)}`);
                  await vscode.workspace.applyEdit(edit);
                }
              } else did = addFunction(file, fn, doc.name || fam.name);
              if (!doc.scripts) await apply(document, withScripts(doc, { file: path.basename(file) }));
              if (did === "created") announceCreated(project.dir, [file]);
              this.hub.log.appendLine(`Script of ${doc.id}: ${fn} ${did} in ${file}`);
              await w.postMessage({ status: `${fn} is in ${path.relative(project.dir, file)}. Save the quickhack to write the mod's REDnode package.` });
            }
            const text = open?.isDirty ? open.getText() : fs.readFileSync(file, "utf8");
            const line = lineOf(text, fn) ?? 0;
            // In the tab the script already has, if it has one; beside the page the first time.
            const tab = vscode.window.tabGroups.all.find((g) => g.tabs.some((t) => (t.input as { uri?: vscode.Uri } | undefined)?.uri?.fsPath === uri.fsPath));
            await vscode.window.showTextDocument(uri, { viewColumn: tab?.viewColumn ?? vscode.ViewColumn.Beside, selection: new vscode.Range(line, 0, line, 0) });
            await w.postMessage({ scriptsHtml: renderScripts(await this.scriptsState(document, current())) });
          }
          if (m.scriptText !== undefined) {
            const doc = current();
            if (doc.scripts) await apply(document, withScripts(doc, { ...doc.scripts, disabledText: m.scriptText }));
          }
          if (m.scriptRemove) {
            const doc = current();
            const project = (await redcode()).project();
            const where = doc.scripts && project ? path.relative(project.dir, path.join(packageDir(project), doc.scripts.file)) : doc.scripts?.file;
            await apply(document, withScripts(doc, undefined));
            await w.postMessage({ status: `The script is off this quickhack. Its file stays: ${where}. Save to take it out of the mod's REDnode package.` });
          }
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
      const result = await writeDocFiles(project, await bridge(), fam, doc, await this.hub.added(doc, fam), sales, await iconWriter(), (key) => this.hub.family(key));
      this.hub.log.appendLine(`Saved ${doc.id}: ${result.yaml ?? "no YAML, nothing changed"}${result.texts ? `, texts in ${result.texts}` : ""}${result.scripts ? `, scripts in ${result.scripts}` : ""}`);
      announceCreated(project.dir, result.created);
      if (result.missingScripts?.length) {
        say(`Saved, but the script file of ${result.missingScripts.join(", ")} is not there, so the mod's REDnode package leaves ${result.missingScripts.length === 1 ? "it" : "them"} out. Add a function on ${result.missingScripts.length === 1 ? "its" : "their"} page to make it again.`, true);
        return;
      }
      say(result.yaml ? `Saved: ${path.relative(project.dir, result.yaml)}${result.texts ? ", and its texts" : ""}${result.scripts ? ", and the mod's REDnode package" : ""}.` : "Saved. It changes nothing yet, so there are no mod files.");
    } catch (e) {
      this.hub.log.appendLine(`Saving ${document.fileName} failed: ${message(e)}`);
      say(message(e), true);
    }
  }

  /** What the Scripts section shows for a document (H3c.3): its file in the project's REDnode package, and what it exports. */
  private async scriptsState(document: vscode.TextDocument, doc: QuickhackDoc): Promise<ScriptsState> {
    const project = onDesk(document.fileName) ? undefined : (await redcode()).project();
    if (!project || !isInside(document.fileName, project.dir)) return { inProject: false, exists: false, functions: [] };
    if (!doc.scripts) return { inProject: true, exists: false, functions: [] };
    const file = path.join(packageDir(project), doc.scripts.file);
    const exists = fs.existsSync(file);
    return {
      inProject: true,
      file: path.relative(project.dir, file).split(path.sep).join("/"),
      exists,
      functions: exists ? exportsOf(fs.readFileSync(file, "utf8")) : [],
      disabledText: doc.scripts.disabledText,
    };
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

  private async icons(w: vscode.Webview, fam: Family, doc: QuickhackDoc, docFile: string): Promise<{ all: Map<string, string>; item?: string; wheel?: string; status?: string }> {
    const all = new Map<string, string>();
    for (const icon of iconsOf(fam)) {
      const src = await this.src(w, icon);
      if (src) all.set(`${icon.atlas}|${icon.part}`, src);
    }
    const own = (look: IconLook): string | undefined => (doc.ownIcons?.[look] ? ownSrc(docFile, doc.id, look) : undefined);
    const top = fam.tiers[fam.tiers.length - 1];
    return {
      all,
      item: own("item") ?? (doc.itemIcon ? await this.src(w, await iconOf(this.hub.reader, doc.itemIcon)) : undefined),
      wheel: own("wheel") ?? (doc.wheelIcon ? await this.src(w, await iconOf(this.hub.reader, doc.wheelIcon)) : undefined),
      status: own("status") ?? (top ? await this.src(w, mainEffect(top.effects)?.icon) : undefined),
    };
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

  private async iconSrc(w: vscode.Webview, fam: Family, which: IconLook, value?: string): Promise<string | undefined> {
    const top = fam.tiers[fam.tiers.length - 1];
    if (which === "status") return this.src(w, mainEffect(top.effects)?.icon);
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
    const card = w.asWebviewUri(vscode.Uri.joinPath(this.hub.extensionUri, "media", "card.js"));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${w.cspSource} data:; style-src ${w.cspSource}; script-src ${w.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"></head>
<body>${body}${body.includes("<main") ? `<script src="${card}"></script><script src="${js}"></script>` : ""}</body></html>`;
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

/** What saving writes a document's own icons with: REDcode's import (with the texture setup) and REDbridge's JSON writer. */
async function iconWriter(): Promise<IconWriter> {
  const api = await redcode();
  const b = await bridge();
  return {
    importFile: (file, texture) => api.importFile(file, { texture: { ...texture } }),
    fromJson: (outFile, json) => b.fromJson(outFile, { json }),
  };
}

/** An own icon's picture as data, for the page: it sits beside the document, outside the folders the page may read. */
function ownSrc(docFile: string, id: string, look: IconLook): string | undefined {
  try {
    return `data:image/png;base64,${fs.readFileSync(iconFile(docFile, id, look)).toString("base64")}`;
  } catch {
    return undefined;
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
