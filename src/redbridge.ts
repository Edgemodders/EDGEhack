// EDGEhack's own REDbridge client (H4.4), for the MCP server, which runs without VS Code and so
// without REDcode's. Two ways to reach a REDbridge:
//
// - RedBridge starts REDbridge.exe itself and speaks JSON-RPC 2.0 on its stdio, Content-Length
//   framed as language servers do; stderr is its log. It starts on the first call.
// - rednodeBridge() uses REDnode's shared one when REDnode started this process and offers it
//   (REDNODE_BRIDGE_URL and REDNODE_BRIDGE_TOKEN, REDnode #40), so no second REDbridge runs beside
//   the game's. The address is 127.0.0.1 only, and every call carries the token REDnode made for
//   this start of the server.
//
// Both give a BridgeClient with the method names and parameters of REDcode's client, so the core
// works the same on all three.

import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import type { BridgeClient } from "./types";

/** One REDbridge method, by name, with its parameters. */
export type BridgeCall = (method: string, params: Record<string, unknown>) => Promise<unknown>;

/** A BridgeClient over any way of calling REDbridge's methods. */
export function clientOver(call: BridgeCall, running: () => boolean = () => true): BridgeClient {
  const c = <T>(method: string, params: Record<string, unknown>) => call(method, params) as Promise<T>;
  return {
    get running() {
      return running();
    },
    toJson: (path, outFile) => c("cr2w.toJson", outFile ? { path, outFile } : { path }),
    toPng: (path, outFile) => c("texture.toPng", { path, outFile }),
    tweakRecords: (query) => c("tweakdb.records", { ...query }),
    tweakRecord: (path, resolveLocKeys = false, language = "en-us") => c("tweakdb.record", { path, resolveLocKeys, language }),
    fileToJson: (file, outFile) => c("cr2w.fileToJson", outFile ? { file, outFile } : { file }),
    fromJson: (outFile, source) => c("cr2w.fromJson", { outFile, ...source }),
    locProjectFiles: (projectDir, language = "en-us") => c("loc.projectFiles", { projectDir, language }),
    locNewFile: (projectDir, modName, language = "en-us") => c("loc.newFile", { projectDir, modName, language }),
    locGet: (keys, language = "en-us", projectDir) => c("loc.get", { keys, language, projectDir: projectDir ?? null }),
    importFile: (file, rawDir, archiveDir, keep = true, template, texture) =>
      c("project.import", { file, rawDir, archiveDir, keep, template: template ?? null, ...(texture !== undefined ? { texture } : {}) }),
    pack: (dir, outDir, modName) => c("project.pack", { dir, outDir, modName }),
  };
}

export interface RedBridgeOptions {
  /** REDbridge.exe. */
  exe: string;
  /** Arguments before the bridge's own, for a stand-in run by Node in the tests. */
  args?: string[];
  /** The Cyberpunk 2077 folder, passed as --game so the bridge loads it at start. */
  gamePath?: string;
  /** DOTNET_ROOT for a per-user .NET; the environment's own when unset. */
  dotnetRoot?: string;
  /** Each line of the bridge's log (its stderr), and the client's own notes. */
  log?: (line: string) => void;
}

interface Waiting {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/** One REDbridge process, started on the first call and again after it ends. */
export class RedBridge {
  readonly client: BridgeClient;
  private child: ChildProcess | undefined;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private readonly waiting = new Map<number, Waiting>();

  constructor(readonly options: RedBridgeOptions) {
    this.client = clientOver((method, params) => this.call(method, params), () => this.running);
  }

  get running(): boolean {
    return this.child !== undefined && this.child.exitCode === null && this.child.signalCode === null;
  }

  /** Calls a method, starting the bridge first if it is not running. Rejects with the bridge's own message when the call fails. */
  call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.running) this.start();
    const id = this.nextId++;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.child!.stdin!.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`, "utf8");
    });
  }

  /** Ends the process; calls still waiting fail. */
  stop(): void {
    const child = this.child;
    this.child = undefined;
    child?.kill();
    this.failAll(new Error("REDbridge was stopped."));
  }

  private start(): void {
    const { exe, args = [], gamePath, dotnetRoot, log } = this.options;
    const env = { ...process.env };
    if (dotnetRoot) env.DOTNET_ROOT = dotnetRoot;
    const child = spawn(exe, [...args, ...(gamePath ? ["--game", gamePath] : [])], { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    this.buffer = Buffer.alloc(0);
    log?.(`REDbridge started: ${exe}${gamePath ? ` (game ${gamePath})` : ""}`);
    child.stdout!.on("data", (chunk: Buffer) => this.onData(chunk));
    readline.createInterface({ input: child.stderr! }).on("line", (line) => log?.(`bridge | ${line}`));
    child.stdin!.on("error", () => undefined); // a write after the bridge ended; its exit fails the call
    child.on("error", (e) => {
      if (this.child !== child) return;
      this.child = undefined;
      this.failAll(new Error(`REDbridge could not start (${exe}): ${e.message}`));
    });
    child.on("exit", (code, signal) => {
      if (this.child !== child) return;
      this.child = undefined;
      log?.(`REDbridge ended (${signal ?? `code ${code}`})`);
      this.failAll(new Error(`REDbridge ended (${signal ?? `code ${code}`}) before it answered.`));
    });
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1]);
      if (!Number.isFinite(length)) {
        // not a frame: drop the header and look for the next one
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }
      const start = headerEnd + 4;
      if (this.buffer.length < start + length) return;
      const body = this.buffer.subarray(start, start + length).toString("utf8");
      this.buffer = this.buffer.subarray(start + length);
      this.handle(body);
    }
  }

  private handle(body: string): void {
    let msg: { id?: unknown; method?: unknown; result?: unknown; error?: { message?: string; code?: number } };
    try {
      msg = JSON.parse(body);
    } catch {
      return;
    }
    if (typeof msg.id !== "number" || msg.method !== undefined) return; // a notification or a request from the bridge
    const w = this.waiting.get(msg.id);
    if (!w) return;
    this.waiting.delete(msg.id);
    if (msg.error) w.reject(new Error(msg.error.message ?? `REDbridge error ${msg.error.code ?? ""}`.trim()));
    else w.resolve(msg.result);
  }

  private failAll(error: Error): void {
    const all = [...this.waiting.values()];
    this.waiting.clear();
    for (const w of all) w.reject(error);
  }
}

/**
 * REDnode's shared REDbridge, when REDnode started this process and offers it, else undefined. A POST
 * of { method, params } answers { result } or { error }; REDnode sends spaces while a long call runs,
 * which JSON allows before the answer.
 */
export function rednodeBridge(env: NodeJS.ProcessEnv = process.env): BridgeClient | undefined {
  const url = env.REDNODE_BRIDGE_URL?.trim(), token = env.REDNODE_BRIDGE_TOKEN?.trim();
  if (!url || !token) return undefined;
  return clientOver(async (method, params) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ method, params }) });
    const answer = (await res.json().catch(() => ({ error: `REDnode's REDbridge answered HTTP ${res.status}` }))) as { result?: unknown; error?: string | { message?: string } };
    if (!res.ok || answer.error !== undefined) {
      throw new Error(typeof answer.error === "string" ? answer.error : answer.error?.message ?? `REDnode's REDbridge answered HTTP ${res.status}`);
    }
    return answer.result;
  });
}
