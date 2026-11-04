// EDGEhack's entry point. H0: the activity bar container and its three views (Desk, Library,
// Quickhacks) with their welcome text from package.json. The views fill in from H1 on
// (docs/design.md, "Phases").
import * as vscode from "vscode";

/** An empty tree, so each view shows its welcome text until its phase fills it. */
class Empty implements vscode.TreeDataProvider<never> {
  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }
  getChildren(): never[] {
    return [];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  for (const id of ["edgehack.desk", "edgehack.library", "edgehack.quickhacks"]) {
    context.subscriptions.push(vscode.window.registerTreeDataProvider(id, new Empty()));
  }
}

export function deactivate(): void {}
