// The Desk view (H3.7): the quickhacks on the Desk, newest first, then a Project group with the open REDcode
// project's quickhacks (docs/design.md, "Views"). A click opens the editor. Each Desk quickhack has Add to
// Project and Remove; a new one also Duplicate. Add to Library waits for the Library (H5).
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { DeskItem, deskItems, deskRoot } from "./desk";
import { ProjectDoc, projectDocs } from "./projectDocs";
import { redcode } from "./redcode";
import type { ProjectRef } from "./types";
import { docTreeItem } from "./quickhacksView";

type Node = { kind: "desk"; item: DeskItem } | { kind: "project"; name: string; docs: ProjectDoc[] } | { kind: "doc"; entry: ProjectDoc };

export class DeskView implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly hub: Hub) {
    hub.onDidRefresh(() => this.refresh());
  }

  refresh(): void {
    this.changed.fire(undefined);
  }

  /** Follows the Desk's folder and the open project's documents. */
  async watch(): Promise<vscode.Disposable> {
    const root = deskRoot();
    fs.mkdirSync(root, { recursive: true });
    const fire = (): void => this.refresh();
    const desk = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(root), "**"));
    desk.onDidCreate(fire);
    desk.onDidChange(fire);
    desk.onDidDelete(fire);
    let project: vscode.FileSystemWatcher | undefined;
    let changes: vscode.Disposable | undefined;
    try {
      const api = await redcode();
      const follow = (p: ProjectRef | undefined): void => {
        project?.dispose();
        project = undefined;
        if (p) {
          project = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(p.raw), "edgehack/*.quickhack.json"));
          project.onDidCreate(fire);
          project.onDidChange(fire);
          project.onDidDelete(fire);
        }
        fire();
      };
      follow(api.project());
      changes = api.onDidChangeProject(follow);
    } catch {
      // No REDcode: the Desk alone.
    }
    return new vscode.Disposable(() => {
      desk.dispose();
      project?.dispose();
      changes?.dispose();
    });
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (node?.kind === "project") return node.docs.map((entry) => ({ kind: "doc", entry }));
    if (node) return [];
    const out: Node[] = deskItems().map((item) => ({ kind: "desk", item }));
    let project: ProjectRef | undefined;
    try {
      project = (await redcode()).project();
    } catch {
      project = undefined;
    }
    if (project) {
      const docs = projectDocs(project);
      if (docs.length) out.push({ kind: "project", name: project.name, docs });
    }
    // Empty, the view shows its welcome text.
    return out;
  }

  async getTreeItem(node: Node): Promise<vscode.TreeItem> {
    if (node.kind === "project") {
      const item = new vscode.TreeItem(`Project: ${node.name}`, vscode.TreeItemCollapsibleState.Expanded);
      item.id = "desk-project";
      item.iconPath = new vscode.ThemeIcon("project");
      return item;
    }
    if (node.kind === "doc") return docTreeItem(this.hub, node.entry, "desk-pdoc:", "edgehack.doc");
    const item = await docTreeItem(this.hub, node.item, "desk:", "edgehack.desk");
    item.tooltip = `${item.tooltip ?? ""}\nOn the Desk: no mod files until it goes into a project.`;
    return item;
  }

  /** The Desk item a node or a document's file stands for. */
  /** The project's document a row, path or URI names. */
  static projectDocOf(arg: unknown): ProjectDoc | undefined {
    const node = arg as Node | undefined;
    if (node && typeof node === "object" && node.kind === "doc") return node.entry;
    const file = typeof arg === "string" ? arg : arg instanceof vscode.Uri ? arg.fsPath : undefined;
    if (!file || !file.endsWith(".quickhack.json")) return undefined;
    return { file };
  }

  static itemOf(arg: unknown): DeskItem | undefined {
    const node = arg as Node | undefined;
    if (node && typeof node === "object" && node.kind === "desk") return node.item;
    const file = typeof arg === "string" ? arg : arg instanceof vscode.Uri ? arg.fsPath : undefined;
    if (!file) return undefined;
    return deskItems().find((i) => path.resolve(i.file) === path.resolve(file));
  }
}
