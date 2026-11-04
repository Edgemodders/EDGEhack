// What the views, the page and the commands share: REDcode's bridge, the game's quickhack catalog,
// the record reader and the icons, each read once and kept until Refresh.
import * as vscode from "vscode";
import { bridge } from "./redcode";
import { Records } from "./records";
import { Icons } from "./icons";
import { Catalog, familyOfPath, readCatalog } from "./catalog";
import { Family, IconRef, readAction, readFamily } from "./read";

export class Hub {
  private catalogP: Promise<Catalog> | undefined;
  private uiIcons: Promise<IconRef[]> | undefined;
  private records = this.newRecords();
  private readonly families = new Map<string, Promise<Family>>();
  readonly icons: Icons;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidRefresh = this.changed.event;

  constructor(
    readonly extensionUri: vscode.Uri,
    readonly storage: vscode.Uri,
    readonly log: vscode.OutputChannel,
  ) {
    this.icons = new Icons(storage.fsPath, bridge, (line) => log.appendLine(line));
  }

  private newRecords(): Records {
    return new Records(
      async (path) => (await bridge()).tweakRecord(path, true),
      async (key) => {
        const got = (await (await bridge()).locGet([key]))[key];
        return got?.female || got?.male || undefined;
      },
    );
  }

  /** The record reader, shared so every record is read once. */
  get reader(): Records {
    return this.records;
  }

  /** The game's quickhacks; the first call loads TweakDB in REDbridge (about 12 s), unless REDcode has. */
  catalog(): Promise<Catalog> {
    if (!this.catalogP) {
      const started = Date.now();
      this.catalogP = (async () => readCatalog(await bridge()))();
      this.catalogP.then(
        (c) => this.log.appendLine(`Catalog: ${c.families.length} families, ${c.devices.length} device and ${c.vehicles.length} vehicle hacks, in ${Date.now() - started} ms`),
        () => (this.catalogP = undefined),
      );
    }
    return this.catalogP;
  }

  /** A family by its key (Overheat) or a device or vehicle hack by action:<path>, read on first use. */
  family(key: string): Promise<Family> {
    let p = this.families.get(key);
    if (!p) {
      const started = Date.now();
      p = (async () => {
        const catalog = await this.catalog();
        if (key.startsWith("action:")) {
          const path = key.slice("action:".length);
          const entry = [...catalog.devices, ...catalog.vehicles].find((a) => a.path === path);
          return readAction(this.records, path, entry?.kind ?? "device");
        }
        const entry = catalog.families.find((f) => f.key === key);
        if (!entry) throw new Error(`No quickhack family ${key} in the game.`);
        const fam = await readFamily(this.records, key, entry.items);
        fam.name = entry.name;
        fam.category ??= entry.category;
        return fam;
      })();
      this.families.set(key, p);
      p.then(
        (f) => this.log.appendLine(`Read ${f.name}: ${f.tiers.length} tiers, ${this.records.size} records in memory, ${Date.now() - started} ms`),
        (e: unknown) => {
          this.families.delete(key);
          this.log.appendLine(`Reading ${key} failed: ${e instanceof Error ? e.message : String(e)}`);
        },
      );
    }
    return p;
  }

  /**
   * The family key for any record of a quickhack: an item, a tier's action (Boss, Chimera and
   * Spread included), a recipe, or a device or vehicle hack. Undefined for any other record.
   */
  async keyOf(path: string): Promise<string | undefined> {
    const catalog = await this.catalog();
    let found = familyOfPath(path, catalog);
    if (!found && /^0x/i.test(path)) {
      const rec = await this.records.get(path);
      if (rec && rec.path !== path) found = familyOfPath(rec.path, catalog);
    }
    if (found?.family) return found.family.key;
    if (found?.action) return `action:${found.action.path}`;
    return undefined;
  }

  /**
   * The game's quickhack icons: the item's are `UIIcon.quickhack_*`, the wheel's are the parts of the
   * quickhack atlas. Read once.
   */
  async quickhackIcons(which: "item" | "wheel"): Promise<IconRef[]> {
    if (!this.uiIcons) {
      const b = await bridge();
      this.uiIcons = b.tweakRecords({ type: "UIIcon", prefix: "UIIcon.", flats: ["atlasResourcePath", "atlasPartName"], limit: 20000 }).then((page) =>
        page.items
          .map((r) => ({ record: r.path ?? "", atlas: String(r.flats?.atlasResourcePath ?? ""), part: String(r.flats?.atlasPartName ?? "") }))
          .filter((i) => i.record && i.atlas && i.part),
      );
    }
    const icons = await this.uiIcons;
    return which === "item" ? icons.filter((i) => /^UIIcon\.quickhack_/.test(i.record)) : icons.filter((i) => /quickhacks_icons\.inkatlas$/i.test(i.atlas));
  }

  refresh(): void {
    this.uiIcons = undefined;
    this.catalogP = undefined;
    this.records = this.newRecords();
    this.families.clear();
    this.changed.fire();
  }
}
