// The game's quickhacks, for the Quickhacks view: the families of quickhack items (people), and the
// device and vehicle hacks, which are actions with no item. Read with two tweakdb.records calls;
// the grouping is pure (catalogOf), so the tests feed it made-up records.
import type { BridgeClient, TweakRecord, TweakValue } from "./redcode";
import { isLocKey, words } from "./records";
import { parseItem } from "./quickhack";
import { ownAction } from "./read";

export interface FamilyEntry {
  key: string;
  name: string;
  /** Damage Hack, Control Hack, Covert Hack, Ultimate Hack; from its top tier's action. */
  category: string;
  items: { path: string; rank: number; quality?: string }[];
  /** The top tier's item icon (a UIIcon record), for the tree. */
  icon?: string;
  /** Every action its items list (each tier's, Boss, Chimera, Spread), to find the family of any of them. */
  actions: string[];
}

export interface ActionEntry {
  path: string;
  name: string;
  kind: "device" | "vehicle";
  category: string;
  icon?: string;
}

export interface Catalog {
  families: FamilyEntry[];
  devices: ActionEntry[];
  vehicles: ActionEntry[];
}

const ITEM_FLATS = ["itemType", "quality", "displayName", "iconPath", "objectActions"];
const ACTION_FLATS = ["isQuickHack", "objectActionType", "hackCategory", "actionName", "objectActionUI"];

async function every(b: BridgeClient, type: string, prefix: string, flats: string[]): Promise<TweakRecord[]> {
  const out: TweakRecord[] = [];
  for (let offset = 0; ; ) {
    const page = await b.tweakRecords({ type, prefix, flats, offset, limit: 20000, resolveLocKeys: true });
    out.push(...page.items);
    offset += page.items.length;
    if (!page.items.length || offset >= page.total) return out;
  }
}

/** Reads the catalog through REDbridge, with the wheel captions of device and vehicle hacks. */
export async function readCatalog(b: BridgeClient): Promise<Catalog> {
  const [items, actions] = await Promise.all([every(b, "Item", "Items.", ITEM_FLATS), every(b, "ObjectAction", "", ACTION_FLATS)]);
  const captions = new Map<string, string>();
  const uis = [...new Set(actions.filter((a) => isDeviceOrVehicle(a)).map((a) => a.flats?.objectActionUI).filter((u): u is string => typeof u === "string" && u !== ""))];
  await Promise.all(
    uis.map(async (ui) => {
      try {
        const rec = await b.tweakRecord(ui, true);
        const caption = rec.flats.find((f) => f.name === "caption")?.value;
        const icon = rec.flats.find((f) => f.name === "captionIcon")?.value;
        if (isLocKey(caption) && caption.text) captions.set(ui, caption.text);
        if (typeof icon === "string" && icon) {
          const part = await b.tweakRecord(icon).catch(() => undefined);
          const tex = part?.flats.find((f) => f.name === "texturePartID")?.value;
          if (typeof tex === "string" && tex) captions.set(`${ui}#icon`, tex);
        }
      } catch {
        // a missing caption leaves the action's name
      }
    }),
  );
  return catalogOf(items, actions, captions);
}

function isDeviceOrVehicle(a: TweakRecord): boolean {
  const t = a.flats?.objectActionType;
  return a.flats?.isQuickHack === true && (t === "ObjectActionType.DeviceQuickHack" || t === "ObjectActionType.VehicleQuickHack");
}

function textOf(v: TweakValue | undefined): string | undefined {
  return isLocKey(v) && v.key !== "LocKey#0" && v.text ? v.text : undefined;
}

/** Groups quickhack items into families (named ones only) and lists device and vehicle hacks. */
export function catalogOf(items: TweakRecord[], actions: TweakRecord[], captions = new Map<string, string>()): Catalog {
  const categories = new Map(actions.map((a) => [a.path ?? a.id, String(a.flats?.hackCategory ?? "")]));
  const byFamily = new Map<string, { names: Map<number, string>; items: FamilyEntry["items"]; icons: Map<number, string>; actions: Map<number, string>; all: Set<string> }>();
  for (const it of items) {
    if (!it.path || it.flats?.itemType !== "ItemType.Prt_Program") continue;
    const parsed = parseItem(it.path);
    if (!parsed) continue;
    const acts = Array.isArray(it.flats?.objectActions) ? (it.flats.objectActions as TweakValue[]).filter((p): p is string => typeof p === "string") : [];
    const own = ownAction(acts);
    // An item with no action of its own is not a tier the player gets (Items.PingLvl3Program,
    // Items.WhistleProgram: they only point to another tier).
    if (!own) continue;
    let fam = byFamily.get(parsed.family);
    if (!fam) byFamily.set(parsed.family, (fam = { names: new Map(), items: [], icons: new Map(), actions: new Map(), all: new Set() }));
    const rank = parsed.tier.rank + (parsed.tier.suffix === "Lvl0" ? 0.5 : 0);
    const quality = typeof it.flats?.quality === "string" ? it.flats.quality.replace(/^Quality\./, "") : undefined;
    fam.items.push({ path: it.path, rank, quality: parsed.tier.suffix === "Lvl4PlusPlus" && quality === "Legendary" ? "Legendary++" : quality });
    const name = textOf(it.flats?.displayName);
    if (name) fam.names.set(rank, name);
    if (typeof it.flats?.iconPath === "string" && it.flats.iconPath) fam.icons.set(rank, `UIIcon.${it.flats.iconPath}`);
    for (const p of acts) if (/^QuickHack\./.test(p)) fam.all.add(p);
    fam.actions.set(rank, own);
  }
  const families: FamilyEntry[] = [];
  for (const [key, fam] of byFamily) {
    if (!fam.names.size) continue; // internal items with no name (Items.CyberdeckProgram)
    const ranks = [...fam.names.keys()].sort((a, b) => a - b);
    const top = ranks[ranks.length - 1];
    const topAction = [...fam.actions.entries()].sort((a, b) => a[0] - b[0]).pop()?.[1];
    families.push({
      key,
      name: fam.names.get(top)!,
      category: category(categories.get(topAction ?? "")),
      items: fam.items.sort((a, b) => a.rank - b.rank),
      icon: fam.icons.get(top) ?? [...fam.icons.values()].pop(),
      actions: [...fam.all],
    });
  }
  families.sort((a, b) => a.name.localeCompare(b.name));
  const entry = (a: TweakRecord, kind: ActionEntry["kind"]): ActionEntry => {
    const ui = String(a.flats?.objectActionUI ?? "");
    return {
      path: a.path ?? a.id,
      name: captions.get(ui) ?? words(String(a.flats?.actionName ?? a.path ?? a.id)),
      kind,
      category: category(String(a.flats?.hackCategory ?? "")),
      icon: captions.get(`${ui}#icon`),
    };
  };
  // Left out: hacks the game marks obsolete in their caption, and base records with no name and no
  // caption (DeviceAction.VehicleQuickHack, actionName None), which other hacks copy.
  const shown = (a: TweakRecord): boolean => {
    const caption = captions.get(String(a.flats?.objectActionUI ?? ""));
    if (caption?.startsWith("!OBSOLETE")) return false;
    return !!caption || (a.flats?.actionName !== "None" && !!a.flats?.actionName);
  };
  const named = actions.filter((a) => a.path && isDeviceOrVehicle(a) && shown(a));
  const devices = named.filter((a) => a.flats?.objectActionType === "ObjectActionType.DeviceQuickHack").map((a) => entry(a, "device"));
  const vehicles = named.filter((a) => a.flats?.objectActionType === "ObjectActionType.VehicleQuickHack").map((a) => entry(a, "vehicle"));
  const byName = (a: ActionEntry, b: ActionEntry) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path);
  return { families, devices: devices.sort(byName), vehicles: vehicles.sort(byName) };
}

function category(hackCategory: string | undefined): string {
  return hackCategory ? words(hackCategory) : "Other";
}

/** The family key or action a record belongs to, from its path alone; undefined when it cannot tell. */
export function familyOfPath(path: string, catalog: Catalog): { family?: FamilyEntry; action?: ActionEntry } | undefined {
  for (const f of catalog.families) {
    if (f.items.some((i) => i.path === path) || f.actions.includes(path)) return { family: f };
  }
  const recipe = /^Items\.Recipe_(.+)$/.exec(path);
  if (recipe) return familyOfPath(`Items.${recipe[1]}`, catalog);
  const m = /^QuickHack\.(?:Boss|Chimera)?([A-Za-z]+?)(?:Lvl[0-4](?:PlusPlus)?)?Hack(?:Spread)?$/.exec(path);
  if (m) {
    const family = catalog.families.find((f) => f.key === m[1]);
    if (family) return { family };
  }
  const action = [...catalog.devices, ...catalog.vehicles].find((a) => a.path === path);
  return action ? { action } : undefined;
}
