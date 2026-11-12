// The Library's commands (H5): Add to Library from the Desk and from a project, and on a Library item
// Add to Project, Copy to the Desk, Reveal and Remove; Refresh from Library on a project's quickhack. The
// root is asked the first time, as REDcode's Add to Library does (its libraryCommand.ts, MIT); the folder
// picker offers the folder last used first. The item logic is library.ts.
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Hub } from "./hub";
import type { QuickhackEditor } from "./editor";
import { DeskView } from "./deskView";
import { LibraryView } from "./libraryView";
import { deskAsset, deskCopy, deskRoot } from "./desk";
import { parseDoc } from "./document";
import { addToLibrary, isInside, itemById, libraryFolders, newerInLibrary, noteOfDoc, noteQuickhack, readLibraryRoot, safeFolder, suggestedLibraryRoot, writeLibraryRoot, type AddSource } from "./library";
import { redcode } from "./redcode";

const LastFolder = "edgehack.library.lastFolder";

/** Where the Library is, asking the first time, as the shared rules say the first tool to need it does. */
async function libraryRoot(): Promise<string | undefined> {
  const known = readLibraryRoot();
  if (known) return known;
  const suggested = suggestedLibraryRoot();
  const choice = await vscode.window.showQuickPick(
    [
      { label: suggested, description: "Suggested" },
      { label: "$(folder-opened) Choose a Folder...", choose: true },
    ],
    { title: "Where should the EDGE Library go?", placeHolder: "One folder that every EDGE tool shares, for work you keep. It can move later." },
  );
  if (!choice) return undefined;
  let root = choice.label;
  if ("choose" in choice) {
    const picked = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: "Use for the EDGE Library", title: "Where should the EDGE Library go?" });
    if (!picked?.[0]) return undefined;
    root = picked[0].fsPath;
  }
  const game = await redcode().then((api) => api.gamePath(), () => undefined);
  if (game && isInside(path.resolve(root), game)) {
    void vscode.window.showErrorMessage("EDGEhack: the EDGE Library cannot be inside the game's folder: deploys must never touch it.");
    return undefined;
  }
  return writeLibraryRoot(root);
}

interface FolderItem extends vscode.QuickPickItem {
  folder?: string;
  action?: "new";
}

/** Picks a Library folder, offering the last one first, and New Folder... (the folders are the modder's). */
function pickFolder(context: vscode.ExtensionContext, root: string, name: string): Promise<string | undefined> {
  const last = context.globalState.get<string>(LastFolder);
  const folders = libraryFolders(root);
  const order = ["", ...folders].sort((a, b) => Number(b === last) - Number(a === last));
  const qp = vscode.window.createQuickPick<FolderItem>();
  qp.title = `Add to Library: ${name}: which folder?`;
  qp.placeholder = "Pick a folder in the Library for it, or make one with New Folder...";
  qp.items = [
    ...order.map((folder): FolderItem => ({ label: folder ? `$(folder) ${folder}` : "$(root-folder) The Library's top folder", description: folder === last ? "Last used" : folder ? undefined : "no folder of its own", folder })),
    { label: "$(new-folder) New Folder...", action: "new", alwaysShow: true },
  ];
  // Only the folder last used is picked out: the first time, no row is, so nothing is taken by a stray Enter.
  const first = last === undefined ? undefined : qp.items.find((i) => i.folder === last);
  if (first) qp.activeItems = [first];
  // The picker opens where the Library's place question was, at once: the click or Enter that answered that
  // question must not answer this one (the owner's H5 test, 2026-11-11, took the top folder that way).
  const shownAt = Date.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: string | undefined): void => {
      done = true;
      resolve(r);
      qp.dispose();
    };
    qp.onDidAccept(async () => {
      if (Date.now() - shownAt < 500) return;
      const item = qp.activeItems[0];
      if (!item) return;
      if (item.action === "new") {
        done = true;
        qp.hide();
        const typed = await vscode.window.showInputBox({
          title: "New Library folder",
          prompt: `Under ${root}. Use / for folders inside folders, as in Quickhacks/Fire.`,
          validateInput: (v) => {
            try {
              return safeFolder(v) ? undefined : "Type a folder name.";
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
          },
        });
        finish(typed === undefined ? undefined : safeFolder(typed));
      } else finish(item.folder ?? "");
    });
    qp.onDidHide(() => {
      if (!done) finish(undefined);
    });
    qp.show();
  });
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function registerLibrary(context: vscode.ExtensionContext, hub: Hub, editor: QuickhackEditor, desk: DeskView, library: LibraryView): vscode.Disposable[] {
  const failed = (err: unknown): void => void vscode.window.showErrorMessage(`EDGEhack: ${message(err)}`);
  const keys = async () => (await hub.catalog()).families.map((f) => f.key);
  const project = () => redcode().then((api) => api.project(), () => undefined);
  const changed = (): void => {
    library.refresh();
    desk.refresh();
  };
  editor.onLibraryChanged = changed;

  /** What Add to Library takes: a Desk quickhack, or a quickhack of the open project. */
  async function sourceOf(arg: unknown): Promise<{ source: AddSource; fromProject?: Awaited<ReturnType<typeof project>> } | undefined> {
    const onDesk = DeskView.itemOf(arg);
    if (onDesk) {
      if (!onDesk.doc) throw new Error(onDesk.error ?? "This document cannot be read.");
      const asset = deskAsset(onDesk);
      return { source: { file: onDesk.file, doc: onDesk.doc, assetId: asset?.id, name: asset?.name ?? onDesk.doc.name } };
    }
    const entry = DeskView.projectDocOf(arg);
    const p = await project();
    if (!entry || !p || !isInside(entry.file, p.dir)) return undefined;
    const doc = entry.doc ?? parseDoc(fs.readFileSync(entry.file, "utf8"));
    const familyName = (await hub.catalog()).families.find((f) => f.key === doc.family)?.name ?? doc.family;
    return { source: { file: entry.file, doc, assetId: noteOfDoc(p, entry.file)?.id, name: doc.name || familyName, modName: p.modName }, fromProject: p };
  }

  return [
    // folder and confirmed are for scripts (the smoke test): a folder skips the picker, confirmed the question.
    vscode.commands.registerCommand("edgehack.library.add", async (arg?: unknown, folderGiven?: string, confirmed?: boolean) => {
      try {
        const from = await sourceOf(arg);
        if (!from) return undefined;
        const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === vscode.Uri.file(from.source.file).fsPath);
        if (open?.isDirty) await open.save();
        const root = await libraryRoot();
        if (!root) return undefined;
        const name = from.source.name ?? from.source.doc.family;
        const existing = from.source.assetId ? itemById(root, from.source.assetId) : undefined;
        let folder = "";
        if (existing && confirmed !== true) {
          const choice = await vscode.window.showWarningMessage(
            `The EDGE Library already has ${existing.asset.name} (version ${existing.asset.version}, in ${existing.place || "its root"}). Replace it with this one?`,
            { modal: true, detail: "It stays where it is, with its version raised. What was changed in the Library's copy since is lost; projects that took it can refresh from it." },
            "Replace",
          );
          if (choice !== "Replace") return undefined;
        } else if (!existing) {
          const picked = typeof folderGiven === "string" ? safeFolder(folderGiven) : await pickFolder(context, root, name);
          if (picked === undefined) return undefined;
          folder = picked;
          await context.globalState.update(LastFolder, folder);
        }
        const { item } = addToLibrary(root, folder, from.source, { replace: !!existing });
        // A project's quickhack is now that item's, so Refresh from Library can follow it.
        if (from.fromProject) noteQuickhack(from.fromProject, from.source.file, item, root);
        hub.log.appendLine(`Added ${item.asset.name} to the EDGE Library: ${item.folder} (version ${item.asset.version})`);
        changed();
        void vscode.window.showInformationMessage(`${item.asset.name} is in the EDGE Library${item.place ? `, in ${item.place}` : ""}${existing ? `, version ${item.asset.version}` : ""}.`, "Reveal").then((c) => {
          if (c === "Reveal") void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(item.file));
        });
        return item.file;
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
    vscode.commands.registerCommand("edgehack.library.addToProject", async (arg?: unknown, confirmed?: boolean) => {
      try {
        const item = LibraryView.itemOf(arg);
        const root = readLibraryRoot();
        if (!item || !root) return undefined;
        const p = await project();
        if (!p) {
          void vscode.window.showWarningMessage("EDGEhack: open a WolvenKit project in REDcode first, then Add to Project again.");
          return undefined;
        }
        return await editor.libraryToProject(p, item, await keys(), root, confirmed === true);
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
    vscode.commands.registerCommand("edgehack.library.copyToDesk", async (arg?: unknown, confirmed?: boolean) => {
      try {
        const item = LibraryView.itemOf(arg);
        if (!item?.doc) return undefined;
        const from = { file: item.file, doc: item.doc, asset: item.asset };
        let r = deskCopy(deskRoot(), from);
        if (r.exists) {
          if (confirmed !== true) {
            const choice = await vscode.window.showWarningMessage(`The Desk already has ${item.asset.name}. Replace it with the Library's version ${item.asset.version}?`, { modal: true, detail: "Changes made to it on the Desk are lost." }, "Replace");
            if (choice !== "Replace") return undefined;
          }
          r = deskCopy(deskRoot(), from, { replace: true });
        }
        desk.refresh();
        await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(r.item!.file), "edgehack.quickhack.editor");
        return r.item!.file;
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
    vscode.commands.registerCommand("edgehack.library.open", async (arg?: unknown) => {
      const item = LibraryView.itemOf(arg);
      if (item) await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(item.file), "edgehack.quickhack.editor");
    }),
    vscode.commands.registerCommand("edgehack.library.reveal", async (arg?: unknown) => {
      const item = LibraryView.itemOf(arg);
      if (item) await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(item.file));
    }),
    // To the Recycle Bin, not deleted for good, after asking.
    vscode.commands.registerCommand("edgehack.library.remove", async (arg?: unknown, confirmed?: boolean) => {
      try {
        const item = LibraryView.itemOf(arg);
        if (!item) return false;
        if (confirmed !== true) {
          const choice = await vscode.window.showWarningMessage(`Move ${item.asset.name} out of the EDGE Library, to the Recycle Bin?`, { modal: true, detail: "Projects that took it keep their copy." }, "Move to Recycle Bin");
          if (choice !== "Move to Recycle Bin") return false;
        }
        for (const tab of vscode.window.tabGroups.all.flatMap((g) => g.tabs)) {
          const uri = (tab.input as { uri?: vscode.Uri } | undefined)?.uri;
          if (uri && isInside(uri.fsPath, item.folder)) await vscode.window.tabGroups.close(tab);
        }
        await vscode.workspace.fs.delete(vscode.Uri.file(item.folder), { recursive: true, useTrash: true });
        hub.log.appendLine(`Removed ${item.asset.name} from the EDGE Library: ${item.folder}`);
        changed();
        return true;
      } catch (err) {
        failed(err);
        return false;
      }
    }),
    vscode.commands.registerCommand("edgehack.library.refresh", () => changed()),
    vscode.commands.registerCommand("edgehack.project.refreshFromLibrary", async (arg?: unknown, confirmed?: boolean) => {
      try {
        const entry = DeskView.projectDocOf(arg);
        const p = await project();
        const root = readLibraryRoot();
        if (!entry || !p || !root) return undefined;
        const newer = newerInLibrary(p, root).find((n) => path.resolve(n.file) === path.resolve(entry.file));
        if (!newer) {
          void vscode.window.showInformationMessage("EDGEhack: this quickhack is as the Library has it.");
          return undefined;
        }
        if (confirmed !== true) {
          const choice = await vscode.window.showWarningMessage(
            `Refresh ${newer.item.asset.name} from the EDGE Library, version ${newer.entry.version ?? "?"} to ${newer.item.asset.version}?`,
            { modal: true, detail: "The Library's version replaces the project's: changes made to it in the project since are lost. Its mod files are written again." },
            "Refresh",
          );
          if (choice !== "Refresh") return undefined;
        }
        return await editor.libraryToProject(p, newer.item, await keys(), root, true);
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
  ];
}
