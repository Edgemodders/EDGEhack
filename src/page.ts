// The quickhack page: one panel per quickhack family, read-only in H1. Everything the game says
// about the quickhack in the modder's words (docs/design.md, "The editor"): texts, icons, costs per
// tier, effects, who it works on, spread, passives, how to get it, and every record behind it.
// Rendered here as HTML; a small script switches tiers and asks the host to open records in REDcode.
import * as vscode from "vscode";
import type { Hub } from "./hub";
import { esc, iconsOf, render } from "./pageHtml";

export class QuickhackPage {
  private static readonly panels = new Map<string, QuickhackPage>();
  private tier: number | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly hub: Hub,
    private readonly key: string,
  ) {
    panel.onDidDispose(() => QuickhackPage.panels.delete(key));
    panel.webview.onDidReceiveMessage((m: { open?: string; tier?: number; edit?: boolean; makeNew?: boolean }) => {
      if (m.edit) void vscode.commands.executeCommand("edgehack.editQuickhack", key);
      if (m.makeNew) void vscode.commands.executeCommand("edgehack.newQuickhack", key);
      if (m.open) void vscode.commands.executeCommand("redcode.openTweakRecord", m.open);
      if (typeof m.tier === "number") this.tier = m.tier;
    });
  }

  /** Opens (or shows) the page of a family, at a tier (an item path) when given. */
  static async show(hub: Hub, key: string, item?: string): Promise<void> {
    let page = QuickhackPage.panels.get(key);
    if (page) {
      page.panel.reveal();
    } else {
      const panel = vscode.window.createWebviewPanel("edgehack.quickhack", "Quickhack", vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        // The storage folder as a file: URI: the context gives it with the vscode-userdata scheme,
        // which never matches the file: URIs of the icons, and each image would get a 401.
        localResourceRoots: [vscode.Uri.file(hub.storage.fsPath), vscode.Uri.joinPath(hub.extensionUri, "media")],
      });
      panel.iconPath = vscode.Uri.joinPath(hub.extensionUri, "images", "activity.svg");
      page = new QuickhackPage(panel, hub, key);
      QuickhackPage.panels.set(key, page);
      panel.webview.html = page.shell(`<p class="loading">Reading the quickhack from the game…</p>`);
    }
    await page.load(item);
  }

  private async load(item?: string): Promise<void> {
    try {
      const fam = await this.hub.family(this.key);
      this.panel.title = fam.name;
      const at = item ? fam.tiers.findIndex((t) => t.item === item) : -1;
      if (at >= 0) this.tier = at;
      this.tier = Math.min(this.tier ?? fam.tiers.length - 1, fam.tiers.length - 1);
      const icons = new Map<string, string>();
      for (const icon of iconsOf(fam)) {
        const file = await this.hub.icons.file(icon);
        if (file) icons.set(`${icon.atlas}|${icon.part}`, this.panel.webview.asWebviewUri(vscode.Uri.file(file)).toString());
      }
      this.panel.webview.html = this.shell(render(fam, this.tier, icons));
    } catch (e) {
      this.panel.webview.html = this.shell(`<p class="error">${esc(e instanceof Error ? e.message : String(e))}</p>`);
    }
  }

  private shell(body: string): string {
    const w = this.panel.webview;
    const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
    const css = w.asWebviewUri(vscode.Uri.joinPath(this.hub.extensionUri, "media", "page.css"));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${w.cspSource}; style-src ${w.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"></head>
<body>${body}
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
function pick(i) {
  document.body.dataset.tier = i;
  for (const el of document.querySelectorAll("[data-tier]")) el.classList.toggle("on", el.dataset.tier === String(i));
  vscode.postMessage({ tier: i });
}
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-pick]");
  if (t) pick(Number(t.dataset.pick));
  const r = ev.target.closest("[data-record]");
  if (r) { ev.preventDefault(); vscode.postMessage({ open: r.dataset.record }); }
  if (ev.target.closest("[data-edit]")) vscode.postMessage({ edit: true });
  if (ev.target.closest("[data-new]")) vscode.postMessage({ makeNew: true });
});
if (document.body.querySelector("[data-pick]")) pick(Number(document.querySelector("main")?.dataset.start ?? 0));
</script></body></html>`;
  }
}

