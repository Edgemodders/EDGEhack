// The Library view (H5; design, "H5 Library: plan"): the EDGE Library's quickhacks, in the modder's own
// folders, showing only the folders that hold quickhacks and the way to them. A click opens the editor;
// each item has Add to Project, Copy to the Desk, Reveal in File Explorer and Remove from Library. With no
// Library root, or none of its items quickhacks, the view shows its welcome text.
import * as path from "node:path";
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { itemOfFile, libraryConfigFile, libraryItems, readLibraryRoot, type LibraryItem } from "./library";
import { docTreeItem } from "./quickhacksView";

type Node = { kind: "folder"; rel: string } | { kind: "item"; item: LibraryItem };

export class LibraryView implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private items: LibraryItem[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  private watchedRoot: string | undefined;

  constructor(private readonly hub: Hub) {
    hub.onDidRefresh(() => this.refresh());
  }

  refresh(): void {
    this.follow();
    this.changed.fire(undefined);
  }

  /** Follows the root's file, so a root set by any EDGE tool shows here, and the root's quickhacks. */
  watch(): vscode.Disposable {
    const file = libraryConfigFile();
    const config = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(path.dirname(file)), path.basename(file)));
    const fire = (): void => this.refresh();
    config.onDidCreate(fire);
    config.onDidChange(fire);
    config.onDidDelete(fire);
    this.follow();
    return new vscode.Disposable(() => {
      config.dispose();
      this.watcher?.dispose();
    });
  }

  private follow(): void {
    const root = readLibraryRoot();
    if (root === this.watchedRoot) return;
    this.watcher?.dispose();
    this.watcher = undefined;
    this.watchedRoot = root;
    if (!root) return;
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(root), "**/{asset.json,*.quickhack.json}"));
    const fire = (): void => this.changed.fire(undefined);
    w.onDidCreate(fire);
    w.onDidChange(fire);
    w.onDidDelete(fire);
    this.watcher = w;
  }

  getChildren(node?: Node): Node[] {
    const root = readLibraryRoot();
    if (!root) return [];
    if (!node) this.items = libraryItems(root);
    if (node?.kind === "item") return [];
    const at = node?.kind === "folder" ? node.rel : "";
    const under = (place: string) => at === "" || place === at || place.startsWith(`${at}/`);
    const folders = new Set<string>();
    for (const i of this.items) {
      if (!under(i.place) || i.place === at) continue;
      const rest = at ? i.place.slice(at.length + 1) : i.place;
      folders.add(at ? `${at}/${rest.split("/")[0]}` : rest.split("/")[0]);
    }
    return [
      ...[...folders].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).map((rel): Node => ({ kind: "folder", rel })),
      ...this.items.filter((i) => i.place === at).map((item): Node => ({ kind: "item", item })),
    ];
  }

  async getTreeItem(node: Node): Promise<vscode.TreeItem> {
    if (node.kind === "folder") {
      const item = new vscode.TreeItem(node.rel.split("/").pop()!, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `lib-folder:${node.rel}`;
      item.iconPath = vscode.ThemeIcon.Folder;
      item.contextValue = "edgehack.libraryFolder";
      return item;
    }
    const { item: lib } = node;
    const row = await docTreeItem(this.hub, { file: lib.file, doc: lib.doc, error: lib.error }, "lib:", "edgehack.library");
    if (lib.doc) {
      row.label = lib.asset.name || (typeof row.label === "string" ? row.label : lib.doc.family);
      row.description = `${row.description ?? ""} · v${lib.asset.version}`;
    }
    row.tooltip = `${row.tooltip ?? ""}\nIn the EDGE Library${lib.place ? `, ${lib.place}` : ""}, version ${lib.asset.version}. Add to Project takes it into a project.`;
    return row;
  }

  /** The Library item a row, a document's path or a URI names. */
  static itemOf(arg: unknown): LibraryItem | undefined {
    const node = arg as Node | undefined;
    if (node && typeof node === "object" && node.kind === "item") return node.item;
    const file = typeof arg === "string" ? arg : arg instanceof vscode.Uri ? arg.fsPath : undefined;
    return file ? itemOfFile(readLibraryRoot(), file) : undefined;
  }
}
