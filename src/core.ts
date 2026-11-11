// What every part of EDGEhack shares, free of VS Code (H4.4): a REDbridge, the game's quickhack
// catalog, the record reader, the icons, the effect pool and where the game sells each tier, each
// read once and kept until refresh(). The extension's Hub (hub.ts) is this with VS Code's event and
// output channel; the MCP server (H4.5) makes one over its own REDbridge.

import type { BridgeClient } from "./types";
import { Records } from "./records";
import { Icons } from "./icons";
import { Catalog, familyOfPath, readCatalog } from "./catalog";
import { Family, IconRef, readAction, readFamily } from "./read";
import { PoolEntry, readEffectPool, ResolvedAdded, resolveAdded } from "./effects";
import type { QuickhackDoc } from "./document";
import { readSaleIndex, SaleIndex, Sales, tierSales } from "./getit";

export interface CoreOptions {
  /** A folder of EDGEhack's own, for the icons it cuts from the game. */
  storage: string;
  /** The REDbridge to read the game through, or an error the user can act on. */
  bridge: () => Promise<BridgeClient>;
  /** Where the core's notes go: reading times, failures. */
  log?: (line: string) => void;
}

export class HackCore {
  private catalogP: Promise<Catalog> | undefined;
  private uiIcons: Promise<IconRef[]> | undefined;
  private pool: Promise<PoolEntry[]> | undefined;
  private saleIndex: Promise<SaleIndex> | undefined;
  private readonly salesOf = new Map<string, Promise<Sales>>();
  private records: Records;
  private readonly families = new Map<string, Promise<Family>>();
  private readonly refreshed = new Set<() => void>();
  readonly icons: Icons;
  /** The REDbridge the core reads through. */
  readonly bridge: () => Promise<BridgeClient>;

  constructor(readonly options: CoreOptions) {
    this.bridge = options.bridge;
    this.records = this.newRecords();
    this.icons = new Icons(options.storage, options.bridge, (line) => this.note(line));
  }

  /** Writes a line to the core's log. */
  note(line: string): void {
    this.options.log?.(line);
  }

  /** Calls `listener` after each refresh(); the function returned stops it. */
  onRefresh(listener: () => void): () => void {
    this.refreshed.add(listener);
    return () => this.refreshed.delete(listener);
  }

  private newRecords(): Records {
    return new Records(
      async (path) => (await this.bridge()).tweakRecord(path, true),
      async (key) => {
        const got = (await (await this.bridge()).locGet([key]))[key];
        return got?.female || got?.male || undefined;
      },
    );
  }

  /** The record reader, shared so every record is read once. */
  get reader(): Records {
    return this.records;
  }

  /** The game's quickhacks; the first call loads TweakDB in REDbridge (about 12 s), unless it already has. */
  catalog(): Promise<Catalog> {
    if (!this.catalogP) {
      const started = Date.now();
      this.catalogP = (async () => readCatalog(await this.bridge()))();
      this.catalogP.then(
        (c) => this.note(`Catalog: ${c.families.length} families, ${c.devices.length} device and ${c.vehicles.length} vehicle hacks, in ${Date.now() - started} ms`),
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
      const records = this.records;
      p = (async () => {
        const catalog = await this.catalog();
        if (key.startsWith("action:")) {
          const path = key.slice("action:".length);
          const entry = [...catalog.devices, ...catalog.vehicles].find((a) => a.path === path);
          return readAction(records, path, entry?.kind ?? "device");
        }
        const entry = catalog.families.find((f) => f.key === key);
        if (!entry) throw new Error(`No quickhack family ${key} in the game.`);
        const fam = await readFamily(records, key, entry.items);
        fam.name = entry.name;
        fam.category ??= entry.category;
        return fam;
      })();
      this.families.set(key, p);
      p.then(
        (f) => this.note(`Read ${f.name}: ${f.tiers.length} tiers, ${records.size} records in memory, ${Date.now() - started} ms`),
        (e: unknown) => {
          if (this.families.get(key) === p) this.families.delete(key);
          this.note(`Reading ${key} failed: ${e instanceof Error ? e.message : String(e)}`);
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
      const b = await this.bridge();
      this.uiIcons = b.tweakRecords({ type: "UIIcon", prefix: "UIIcon.", flats: ["atlasResourcePath", "atlasPartName"], limit: 20000 }).then((page) =>
        page.items
          .map((r) => ({ record: r.path ?? "", atlas: String(r.flats?.atlasResourcePath ?? ""), part: String(r.flats?.atlasPartName ?? "") }))
          .filter((i) => i.record && i.atlas && i.part),
      );
      this.uiIcons.catch(() => (this.uiIcons = undefined));
    }
    const icons = await this.uiIcons;
    return which === "item" ? icons.filter((i) => /^UIIcon\.quickhack_/.test(i.record)) : icons.filter((i) => /quickhacks_icons\.inkatlas$/i.test(i.atlas));
  }

  /** The game's status effects, sorted for the Add Effect picker. Read once. */
  effectPool(): Promise<PoolEntry[]> {
    if (!this.pool) {
      this.pool = (async () => readEffectPool(await this.bridge()))();
      this.pool.catch(() => (this.pool = undefined));
    }
    return this.pool;
  }

  /**
   * How the game hands out each tier of a family (Get it, H3.6): every stock line, vendor and schematic,
   * read once (a few seconds), then per family.
   */
  sales(fam: Family): Promise<Sales> {
    if (!this.saleIndex) {
      const started = Date.now();
      this.saleIndex = (async () => readSaleIndex(await this.bridge()))();
      this.saleIndex.then(
        (i) => this.note(`Get it: ${i.entriesOf.size} items sold, ${i.recipesOf.size} crafted from schematics, in ${Date.now() - started} ms`),
        () => (this.saleIndex = undefined),
      );
    }
    let p = this.salesOf.get(fam.key);
    if (!p) {
      p = this.saleIndex.then((index) => tierSales(fam, index, this.records));
      p.catch(() => this.salesOf.delete(fam.key));
      this.salesOf.set(fam.key, p);
    }
    return p;
  }

  /** sales(), or undefined (logged) when it could not be read, so a save can go on without Get it. */
  async salesOrNone(fam: Family): Promise<Sales | undefined> {
    try {
      return await this.sales(fam);
    } catch (e) {
      this.note(`Get it: reading where the game sells ${fam.name} failed: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  }

  /** A document's added effects, read. */
  added(doc: QuickhackDoc, fam: Family): Promise<ResolvedAdded[]> {
    return resolveAdded(doc, fam, { family: (key) => this.family(key), records: this.records });
  }

  /** Forgets everything read, so the next call reads the game again. */
  refresh(): void {
    this.uiIcons = undefined;
    this.pool = undefined;
    this.saleIndex = undefined;
    this.salesOf.clear();
    this.catalogP = undefined;
    this.records = this.newRecords();
    this.families.clear();
    for (const listener of [...this.refreshed]) listener();
  }
}
