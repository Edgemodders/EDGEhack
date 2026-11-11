// EDGEhack's entry point: the side bar's views (the Desk from H3.7, the Library still empty, the
// Quickhacks view from H1), the quickhack page, and edgehack.openQuickhack, which any tool can call with any record
// of a quickhack (docs/design.md, "Opening a quickhack from anywhere").
import * as vscode from "vscode";
import { Hub } from "./hub";
import { QuickhacksView } from "./quickhacksView";
import { QuickhackPage } from "./page";
import { recordOfArg } from "./quickhack";
import { QuickhackEditor } from "./editor";
import { DeskView } from "./deskView";
import { copyName, deskRoot, duplicateDeskItem, deskNewHackProblem } from "./desk";
import { projectFilesOf, scriptEntries } from "./projectDocs";
import { writeScriptPackage } from "./scripts";
import { removeTexts } from "./projectFiles";
import { bridge, redcode } from "./redcode";
import { clearOpenAIKey, setOpenAIKey } from "./openaiKey";
import { connectAssistant, installServer, registerWithEditor } from "./mcp";
import * as path from "node:path";

/** An empty tree, so a view shows its welcome text until its phase fills it. */
class Empty implements vscode.TreeDataProvider<never> {
  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }
  getChildren(): never[] {
    return [];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("EDGEhack");
  const hub = new Hub(context.extensionUri, context.globalStorageUri, log);
  const quickhacks = new QuickhacksView(hub);
  const view = vscode.window.createTreeView("edgehack.quickhacks", { treeDataProvider: quickhacks, showCollapseAll: true });
  quickhacks.view = view;
  // Without REDcode the view says so itself, when it reads the catalog.
  void quickhacks.watchProject().then((d) => context.subscriptions.push(d), () => undefined);

  const editor = new QuickhackEditor(hub);
  const desk = new DeskView(hub);
  const deskTree = vscode.window.createTreeView("edgehack.desk", { treeDataProvider: desk });
  editor.onDeskChanged = () => desk.refresh();
  void desk.watch().then((d) => context.subscriptions.push(d), (e: unknown) => log.appendLine(`Desk: not watched: ${e instanceof Error ? e.message : String(e)}`));
  const failed = (err: unknown): void => void vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));

  const open = async (arg?: unknown): Promise<void> => {
    let target = recordOfArg(arg);
    if (!target) {
      target = await vscode.window.showInputBox({ title: "Open a Quickhack", prompt: "A quickhack's record, such as Items.OverheatLvl2Program or QuickHack.OverheatHack" });
      if (!target) return;
    }
    try {
      const catalog = await hub.catalog();
      const key = catalog.families.some((f) => f.key === target) ? target : await hub.keyOf(target);
      if (!key) {
        void vscode.window.showInformationMessage(`${target} is not a quickhack. EDGEhack opens quickhack items, their actions (any tier, Boss, Chimera or Spread), their crafting specs, and device and vehicle hacks.`);
        return;
      }
      await QuickhackPage.show(hub, key, target.startsWith("Items.") ? target : undefined);
    } catch (e) {
      void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    }
  };

  // The MCP server for assistants (H4.5): copied where a Claude Code registration finds it, and offered to
  // the editor's own agents where VS Code has MCP support.
  installServer(context.extensionPath, (line) => log.appendLine(line));
  const version = String((context.extension.packageJSON as { version?: string }).version ?? "");

  context.subscriptions.push(
    log,
    view,
    deskTree,
    ...registerWithEditor(version, (line) => log.appendLine(line)),
    vscode.commands.registerCommand("edgehack.connectAssistant", () => connectAssistant(context, log)),
    // Clone and Modify straight onto the Desk, whether a project is open or not.
    vscode.commands.registerCommand("edgehack.desk.new", async (key?: string, name?: string) => {
      try {
        let family = typeof key === "string" ? key : undefined;
        if (!family) {
          const catalog = await hub.catalog();
          const pick = await vscode.window.showQuickPick(
            catalog.families.map((f) => ({ label: f.name, description: f.category, key: f.key })),
            { title: "Clone and Modify on the Desk", placeHolder: "The game's quickhack to start from" },
          );
          family = pick?.key;
        }
        if (!family) return undefined;
        return await editor.makeNew(family, name, true);
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
    vscode.commands.registerCommand("edgehack.desk.addToProject", async (arg?: unknown) => {
      try {
        const item = DeskView.itemOf(arg);
        if (!item) return undefined;
        const file = await editor.addToProject(item.file);
        quickhacks.refreshProject();
        desk.refresh();
        return file;
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
    vscode.commands.registerCommand("edgehack.desk.duplicate", async (arg?: unknown, given?: string) => {
      try {
        const item = DeskView.itemOf(arg);
        if (!item?.doc) return undefined;
        const keys = (await hub.catalog()).families.map((f) => f.key);
        const root = deskRoot();
        const name =
          given ??
          (await vscode.window.showInputBox({
            title: `Duplicate ${item.doc.name ?? item.doc.family}`,
            prompt: "The copy's name, as players see it.",
            value: copyName(root, keys, item.doc),
            validateInput: (text) => (text ? deskNewHackProblem(root, keys, item.doc!.family, text) : undefined),
          }));
        if (!name) return undefined;
        const copy = duplicateDeskItem(root, keys, item, name);
        desk.refresh();
        await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(copy.file), "edgehack.quickhack.editor");
        return copy.file;
      } catch (err) {
        failed(err);
        return undefined;
      }
    }),
    // To the Recycle Bin, not deleted for good, after asking.
    vscode.commands.registerCommand("edgehack.desk.remove", async (arg?: unknown, confirmed?: boolean) => {
      try {
        const item = DeskView.itemOf(arg);
        if (!item) return false;
        const shown = item.doc?.name || item.doc?.family || item.folder;
        if (confirmed !== true) {
          const choice = await vscode.window.showWarningMessage(`Move ${shown} off the Desk, to the Recycle Bin?`, { modal: true, detail: "A copy you added to a project stays in the project." }, "Move to Recycle Bin");
          if (choice !== "Move to Recycle Bin") return false;
        }
        for (const tab of vscode.window.tabGroups.all.flatMap((g) => g.tabs)) {
          const uri = (tab.input as { uri?: vscode.Uri } | undefined)?.uri;
          if (uri && uri.fsPath.startsWith(item.folder)) await vscode.window.tabGroups.close(tab);
        }
        await vscode.workspace.fs.delete(vscode.Uri.file(item.folder), { recursive: true, useTrash: true });
        desk.refresh();
        return true;
      } catch (err) {
        failed(err);
        return false;
      }
    }),
    vscode.commands.registerCommand("edgehack.project.remove", async (arg?: unknown, confirmed?: boolean) => {
      try {
        const entry = DeskView.projectDocOf(arg);
        const project = (await redcode()).project();
        if (!entry || !project) return false;
        const id = path.basename(entry.file).replace(/\.quickhack\.json$/, "");
        const files = projectFilesOf(project, id);
        const shown = entry.doc?.name || entry.doc?.family || id;
        if (confirmed !== true) {
          const list = files.map((f) => path.relative(project.dir, f).split(path.sep).join("/"));
          const choice = await vscode.window.showWarningMessage(
            `Remove ${shown} from ${project.name}?`,
            { modal: true, detail: `These go to the Recycle Bin:\n${list.join("\n")}\n\nIts texts are taken out of the project's onscreens file${entry.doc?.scripts ? ", and it out of the mod's REDnode package; its script file stays" : ""}. A copy on the Desk stays.` },
            "Remove from Project",
          );
          if (choice !== "Remove from Project") return false;
        }
        for (const tab of vscode.window.tabGroups.all.flatMap((g) => g.tabs)) {
          const uri = (tab.input as { uri?: vscode.Uri } | undefined)?.uri;
          if (uri && files.some((f) => uri.fsPath === f || uri.fsPath.startsWith(f + path.sep))) await vscode.window.tabGroups.close(tab);
        }
        for (const f of files) await vscode.workspace.fs.delete(vscode.Uri.file(f), { recursive: true, useTrash: true });
        try {
          await removeTexts(project, await bridge(), id);
        } catch (err) {
          void vscode.window.showWarningMessage(`EDGEhack removed ${shown}, but not its texts from the onscreens file: ${err instanceof Error ? err.message : String(err)}`);
        }
        // The mod's REDnode package without it (H3c.3). Its script file is the modder's and stays.
        try {
          writeScriptPackage(project, await scriptEntries(project, (key) => hub.family(key), undefined, id));
        } catch (err) {
          void vscode.window.showWarningMessage(`EDGEhack removed ${shown}, but could not write the mod's REDnode package again: ${err instanceof Error ? err.message : String(err)}`);
        }
        hub.log.appendLine(`Removed ${id} from ${project.name}: ${files.join(", ")}`);
        desk.refresh();
        return true;
      } catch (err) {
        failed(err);
        return false;
      }
    }),
    vscode.window.registerTreeDataProvider("edgehack.library", new Empty()),
    vscode.commands.registerCommand("edgehack.openQuickhack", open),
    // The same, as REDcode's TweakDB view menu entry: a separate id so the palette shows only one.
    vscode.commands.registerCommand("edgehack.openQuickhackFromREDcode", open),
    editor.register(),
    vscode.commands.registerCommand("edgehack.editQuickhack", async (key?: string) => {
      try {
        if (key) await editor.edit(key);
      } catch (err) {
        void vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
      }
    }),
    // From the page with a family's key, from the view with its node; a name skips the question.
    vscode.commands.registerCommand("edgehack.newQuickhack", async (from?: unknown, name?: string) => {
      try {
        const key = typeof from === "string" ? from : QuickhacksView.familyOf(from as never);
        if (!key) return undefined;
        const file = await editor.makeNew(key, name);
        quickhacks.refreshProject();
        return file;
      } catch (err) {
        void vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
        return undefined;
      }
    }),
    vscode.commands.registerCommand("edgehack.quickhacks.filter", async () => {
      const text = await vscode.window.showInputBox({ title: "Filter Quickhacks", prompt: "Words in a quickhack's name, category or records", placeHolder: "overheat, control, Lvl4, camera" });
      if (text !== undefined) quickhacks.setFilter(text);
    }),
    vscode.commands.registerCommand("edgehack.quickhacks.clearFilter", () => quickhacks.setFilter("")),
    vscode.commands.registerCommand("edgehack.quickhacks.refresh", () => hub.refresh()),
    vscode.commands.registerCommand("edgehack.openInREDcode", (node: unknown) => {
      const record = QuickhacksView.recordOf(node as never);
      if (record) void vscode.commands.executeCommand("redcode.openTweakRecord", record);
    }),
    vscode.commands.registerCommand("edgehack.setOpenAIKey", async () => {
      if (await setOpenAIKey()) void vscode.window.showInformationMessage("EDGEhack: the OpenAI API key is saved in the EDGE tools' shared key store.");
    }),
    vscode.commands.registerCommand("edgehack.clearOpenAIKey", () => clearOpenAIKey()),
  );
}

export function deactivate(): void {}
