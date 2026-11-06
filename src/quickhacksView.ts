// The Quickhacks view: the open project's quickhacks, then the game's. People by category, family and
// tier; then device and vehicle hacks. A click opens the quickhack in the editor page. The filter keeps
// families and hacks whose name or records hold every word.
import * as path from "node:path";
import * as vscode from "vscode";
import type { Hub } from "./hub";
import type { ActionEntry, Catalog, FamilyEntry } from "./catalog";
import { iconOf } from "./read";
import { ProjectRef, redcode } from "./redcode";
import { ProjectDoc, projectDocs } from "./projectDocs";
import { EditorViewType } from "./editor";

type Node =
  | { kind: "project"; name: string; docs: ProjectDoc[] }
  | { kind: "doc"; entry: ProjectDoc }
  | { kind: "group"; id: "people" | "devices" | "vehicles"; label: string }
  | { kind: "category"; name: string }
  | { kind: "family"; family: FamilyEntry }
  | { kind: "tier"; family: FamilyEntry; item: FamilyEntry["items"][number] }
  | { kind: "action"; action: ActionEntry }
  | { kind: "note"; text: string };

export class QuickhacksView implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private filter: string[] = [];
  view?: vscode.TreeView<Node>;

  constructor(private readonly hub: Hub) {
    hub.onDidRefresh(() => this.changed.fire(undefined));
  }

  setFilter(text: string): void {
    this.filter = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (this.view) this.view.description = this.filter.length ? `filter: ${text}` : undefined;
    void vscode.commands.executeCommand("setContext", "edgehack.quickhacksFiltered", this.filter.length > 0);
    this.changed.fire(undefined);
  }

  private matches(...texts: (string | undefined)[]): boolean {
    if (!this.filter.length) return true;
    const all = texts.filter(Boolean).join(" ").toLowerCase();
    return this.filter.every((w) => all.includes(w));
  }

  private families(c: Catalog): FamilyEntry[] {
    return c.families.filter((f) => this.matches(f.name, f.key, f.category, ...f.items.map((i) => i.path), ...f.actions));
  }

  private actions(list: ActionEntry[]): ActionEntry[] {
    return list.filter((a) => this.matches(a.name, a.path, a.category));
  }

  /** Follows the open project's documents, so the Project group stays current. */
  async watchProject(): Promise<vscode.Disposable> {
    const api = await redcode();
    let watcher: vscode.FileSystemWatcher | undefined;
    const watch = (project: ProjectRef | undefined): void => {
      watcher?.dispose();
      watcher = undefined;
      if (project) {
        watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(project.raw), "edgehack/*.quickhack.json"));
        const fire = (): void => this.changed.fire(undefined);
        watcher.onDidCreate(fire);
        watcher.onDidChange(fire);
        watcher.onDidDelete(fire);
      }
      this.changed.fire(undefined);
    };
    watch(api.project());
    const changes = api.onDidChangeProject(watch);
    return new vscode.Disposable(() => {
      changes.dispose();
      watcher?.dispose();
    });
  }

  refreshProject(): void {
    this.changed.fire(undefined);
  }

  /** The Project group, when a project is open and holds a quickhack the filter keeps. */
  private async projectGroup(): Promise<Node | undefined> {
    let project: ProjectRef | undefined;
    try {
      project = (await redcode()).project();
    } catch {
      return undefined;
    }
    if (!project) return undefined;
    const docs = projectDocs(project).filter((e) => this.matches(path.basename(e.file), e.doc?.name, e.doc?.family));
    return docs.length ? { kind: "project", name: project.name, docs } : undefined;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (node?.kind === "project") return node.docs.map((entry) => ({ kind: "doc", entry }));
    const top = node ? [] : [await this.projectGroup()].filter((n): n is Node => !!n);
    let catalog: Catalog;
    try {
      catalog = await (this.view
        ? vscode.window.withProgress({ location: { viewId: "edgehack.quickhacks" }, title: "Reading the game's quickhacks" }, () => this.hub.catalog())
        : this.hub.catalog());
    } catch (e) {
      return [...top, { kind: "note", text: e instanceof Error ? e.message : String(e) }];
    }
    if (!node) {
      const groups: Node[] = top;
      if (this.families(catalog).length) groups.push({ kind: "group", id: "people", label: "People" });
      if (this.actions(catalog.devices).length) groups.push({ kind: "group", id: "devices", label: "Devices" });
      if (this.actions(catalog.vehicles).length) groups.push({ kind: "group", id: "vehicles", label: "Vehicles" });
      return groups.length ? groups : [{ kind: "note", text: "No quickhack matches the filter." }];
    }
    if (node.kind === "group") {
      if (node.id === "people") {
        const cats = [...new Set(this.families(catalog).map((f) => f.category))].sort();
        return cats.map((name) => ({ kind: "category", name }));
      }
      return this.actions(node.id === "devices" ? catalog.devices : catalog.vehicles).map((action) => ({ kind: "action", action }));
    }
    if (node.kind === "category") return this.families(catalog).filter((f) => f.category === node.name).map((family) => ({ kind: "family", family }));
    if (node.kind === "family") return node.family.items.map((item) => ({ kind: "tier", family: node.family, item }));
    return [];
  }

  async getTreeItem(node: Node): Promise<vscode.TreeItem> {
    const filtered = this.filter.length > 0;
    switch (node.kind) {
      case "project": {
        const item = new vscode.TreeItem(`Project: ${node.name}`, vscode.TreeItemCollapsibleState.Expanded);
        item.id = `${filtered ? "f:" : ""}project`;
        item.iconPath = new vscode.ThemeIcon("project");
        return item;
      }
      case "doc": {
        const { entry } = node;
        const file = path.basename(entry.file);
        const open = { command: "vscode.openWith", title: "Open", arguments: [vscode.Uri.file(entry.file), EditorViewType] };
        if (!entry.doc) {
          const item = new vscode.TreeItem(file, vscode.TreeItemCollapsibleState.None);
          item.id = `${filtered ? "f:" : ""}doc:${entry.file}`;
          item.description = "cannot be read";
          item.tooltip = entry.error;
          item.iconPath = new vscode.ThemeIcon("warning");
          item.command = open;
          return item;
        }
        const doc = entry.doc;
        const family = await this.hub.catalog().then((c) => c.families.find((f) => f.key === doc.family), () => undefined);
        const from = family?.name ?? doc.family;
        const item = new vscode.TreeItem(doc.name || from, vscode.TreeItemCollapsibleState.None);
        item.id = `${filtered ? "f:" : ""}doc:${entry.file}`;
        item.description = doc.newHack ? `new, from ${from}` : `changes ${from}`;
        item.tooltip = `${doc.name || from}\n${item.description}\n${entry.file}`;
        item.iconPath = await this.icon(doc.itemIcon ?? family?.icon, "zap");
        item.contextValue = "edgehack.doc";
        item.command = open;
        return item;
      }
      case "group": {
        const item = new vscode.TreeItem(node.label, node.id === "people" || filtered ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
        item.id = `${filtered ? "f:" : ""}group:${node.id}`;
        item.iconPath = new vscode.ThemeIcon(node.id === "people" ? "person" : node.id === "devices" ? "device-desktop" : "car");
        return item;
      }
      case "category": {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Expanded);
        item.id = `${filtered ? "f:" : ""}category:${node.name}`;
        item.iconPath = new vscode.ThemeIcon("symbol-namespace");
        return item;
      }
      case "family": {
        const f = node.family;
        const item = new vscode.TreeItem(f.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.id = `${filtered ? "f:" : ""}family:${f.key}`;
        item.description = `${f.items.length} tier${f.items.length === 1 ? "" : "s"}`;
        item.tooltip = `${f.name}\n${f.category}\n${f.items.map((i) => i.path).join("\n")}`;
        item.iconPath = await this.icon(f.icon, "zap");
        item.contextValue = "edgehack.family";
        item.command = { command: "edgehack.openQuickhack", title: "Open", arguments: [f.key] };
        return item;
      }
      case "tier": {
        const it = node.item;
        const item = new vscode.TreeItem(it.quality ?? "Tier", vscode.TreeItemCollapsibleState.None);
        item.id = `${filtered ? "f:" : ""}tier:${it.path}`;
        item.description = it.path.slice("Items.".length);
        item.tooltip = it.path;
        item.iconPath = new vscode.ThemeIcon("circle-small-filled");
        item.contextValue = "edgehack.tier";
        item.command = { command: "edgehack.openQuickhack", title: "Open", arguments: [it.path] };
        return item;
      }
      case "action": {
        const a = node.action;
        const item = new vscode.TreeItem(a.name, vscode.TreeItemCollapsibleState.None);
        item.id = `${filtered ? "f:" : ""}action:${a.path}`;
        item.description = a.path.slice(a.path.indexOf(".") + 1);
        item.tooltip = `${a.name}\n${a.category}\n${a.path}`;
        item.iconPath = await this.icon(a.icon, a.kind === "vehicle" ? "car" : "device-desktop");
        item.contextValue = "edgehack.action";
        item.command = { command: "edgehack.openQuickhack", title: "Open", arguments: [a.path] };
        return item;
      }
      case "note": {
        const item = new vscode.TreeItem(node.text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon("info");
        return item;
      }
    }
  }

  /** The family a node belongs to, for Make a New One From This. */
  static familyOf(node: Node | undefined): string | undefined {
    return node?.kind === "family" || node?.kind === "tier" ? node.family.key : undefined;
  }

  /** The record a node stands for, for Open in REDcode. */
  static recordOf(node: Node | undefined): string | undefined {
    if (!node) return undefined;
    if (node.kind === "family") return node.family.items[node.family.items.length - 1]?.path;
    if (node.kind === "tier") return node.item.path;
    if (node.kind === "action") return node.action.path;
    return undefined;
  }

  private async icon(uiIcon: string | undefined, fallback: string): Promise<vscode.Uri | vscode.ThemeIcon> {
    if (uiIcon) {
      try {
        const file = await this.hub.icons.file(await iconOf(this.hub.reader, uiIcon));
        if (file) return vscode.Uri.file(file);
      } catch {
        // the theme icon below
      }
    }
    return new vscode.ThemeIcon(fallback);
  }
}
