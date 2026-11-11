// The core (core.ts) inside VS Code: REDcode's bridge, the log in EDGEhack's output channel, and
// refresh as a VS Code event for the views. Everything else lives in the core, which the MCP server
// uses too, so nothing a tool needs goes here.
import * as vscode from "vscode";
import { bridge } from "./redcode";
import { HackCore } from "./core";

export class Hub extends HackCore {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidRefresh = this.changed.event;

  constructor(
    readonly extensionUri: vscode.Uri,
    readonly storage: vscode.Uri,
    readonly log: vscode.OutputChannel,
  ) {
    super({ storage: storage.fsPath, bridge, log: (line) => log.appendLine(line) });
    this.onRefresh(() => this.changed.fire());
  }
}
