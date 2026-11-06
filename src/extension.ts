// EDGEhack's entry point: the side bar's views (Desk and Library still empty, the Quickhacks view
// from H1), the quickhack page, and edgehack.openQuickhack, which any tool can call with any record
// of a quickhack (docs/design.md, "Opening a quickhack from anywhere").
import * as vscode from "vscode";
import { Hub } from "./hub";
import { QuickhacksView } from "./quickhacksView";
import { QuickhackPage } from "./page";
import { recordOfArg } from "./quickhack";
import { QuickhackEditor } from "./editor";

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

  context.subscriptions.push(
    log,
    view,
    vscode.window.registerTreeDataProvider("edgehack.desk", new Empty()),
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
  );
}

export function deactivate(): void {}
