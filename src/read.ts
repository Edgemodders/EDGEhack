// Reads a quickhack from TweakDB into the editor's words: a family of tiers, each with its texts,
// icons, costs, effects, who it works on, spread, passives and how to get it. Pure: it reads through
// Records, so the tests feed it made-up records. The chain is in docs/design.md, "How the game
// builds a quickhack".
import { list, num, Rec, Records, str, words } from "./records";

/** A number the game adds up from modifiers: the base value and what scales it in the game. */
export interface Value {
  base: number;
  /** What changes it at run time, in words: "V's Memory Cost Reduction", "the target's Hacking Resistance". */
  scaledBy: string[];
}

/** An icon: a UIIcon record, and the atlas part it names. */
export interface IconRef {
  record: string;
  atlas: string;
  part: string;
}

export interface Damage {
  /** Thermal, Electric, Chemical, Physical. */
  type: string;
  perHit: number;
  /** Seconds between hits, for damage over time; undefined for one hit. */
  every?: number;
  /** What scales it in the game. */
  scaledBy: string[];
  /** The attack record, and the stat its damage is added up in: what the writer appends to. */
  record: string;
  stat?: string;
}

export interface StatChange {
  stat: string;
  value: number;
  /** Additive, Multiplier, AdditiveMultiplier. */
  how: string;
}

export interface Effect {
  /** The ObjectActionEffect record, or the effector record for one inside a status effect. */
  record: string;
  /** Who gets it. */
  on: "target" | "V";
  /** When it happens: as the upload starts, or when it completes. */
  when: "start" | "upload";
  /** What it is in words: a status effect's name, or an effector's kind. */
  name: string;
  /** The status effect it applies, if any. */
  status?: string;
  /** The effector it runs, if any (the class in words). */
  effector?: string;
  type?: string;
  duration?: Value;
  /** The status effect's duration group and its modifiers: what the writer copies with one more. */
  durationGroup?: string;
  durationMods?: string[];
  stacks?: number;
  tags: string[];
  damage: Damage[];
  stats: StatChange[];
  icon?: IconRef;
  /** Shared by every quickhack (armor down while hacked, the "was quickhacked" mark, ...). */
  shared: boolean;
  /** The cooldown V gets: shown with the costs, not as an effect. */
  cooldown: boolean;
  /** Starts the spread to nearby enemies. */
  spread: boolean;
}

export interface Variant {
  record: string;
  ram?: Value;
  upload?: Value;
  /** Its main effect: Boss actions have status effects and attacks of their own. */
  main?: Effect;
}

export interface Tier {
  /** The tier's item record, undefined for a device or vehicle hack, which has no item. */
  item?: string;
  /** 0 for the base item, then 1 to 5 (Lvl4PlusPlus). */
  rank: number;
  /** Common, Uncommon, Rare, Epic, Legendary, or Legendary++ for the last tier. */
  quality?: string;
  /** The tier's own action. */
  action: string;
  name: string;
  description?: string;
  wheelName?: string;
  wheelDescription?: string;
  /** Lines the tier's tooltip adds (the item's OnAttach packages). */
  tooltip: string[];
  /** The wheel's records, shared across tiers: its entry and its icon part. */
  ui?: string;
  captionIcon?: string;
  icons: { item?: IconRef; wheel?: IconRef };
  category?: string;
  ram?: Value;
  upload?: Value;
  /** The cooldown: its status effect, and that effect's duration group, which the writer appends to. */
  cooldown?: Value & { record: string; group?: string };
  effects: Effect[];
  /** Why it cannot be used on a target, as the game says it. */
  notWhen: string[];
  spread: boolean;
  passives: { record: string; name: string; stats: StatChange[]; effectors: string[] }[];
  recipe?: { record: string; components: { name: string; amount: number }[] };
  boss?: Variant;
  chimera?: Variant;
  /** Every record read for this tier, for Advanced. */
  records: string[];
}

export interface Family {
  /** The family's key: its name in the item paths (Overheat), or action:<path> for a device or vehicle hack. */
  key: string;
  name: string;
  kind: "people" | "device" | "vehicle";
  category?: string;
  tiers: Tier[];
}

const QUALITY: Record<string, string> = {
  "Quality.Common": "Common",
  "Quality.Uncommon": "Uncommon",
  "Quality.Rare": "Rare",
  "Quality.Epic": "Epic",
  "Quality.Legendary": "Legendary",
  "Quality.Iconic": "Iconic",
};

/** Effects every quickhack shares: records under the base QuickHack record. */
export function isShared(path: string): boolean {
  return /^QuickHack\.QuickHack_inline\d+$/.test(path);
}

/** The main effect of a list of effects: the first on the target that is the quickhack's own. */
export function mainEffect(effects: Effect[]): Effect | undefined {
  return effects.find((e) => e.on === "target" && !e.shared && !e.cooldown && (e.duration || e.damage.length));
}

/**
 * Adds up modifiers for one stat (or every stat when none is named): the base, and what scales it.
 * `own` holds the stats the effect gives itself, so a modifier reading them is worked out: Overheat's
 * duration is 2 s plus 1 x its own Overheat Duration Increase of 3.
 */
export async function sumStat(r: Records, mods: Rec[], stat?: string, seen = new Set<string>(), own?: Map<string, number>): Promise<Value> {
  const out: Value = { base: 0, scaledBy: [] };
  for (const m of mods) {
    if (seen.has(m.path)) continue;
    seen.add(m.path);
    if (m.type === "StatModifierGroup") {
      const inner = await sumStat(r, await r.all(m.flats.get("statModifiers")), stat, seen, own);
      out.base += inner.base;
      out.scaledBy.push(...inner.scaledBy);
      continue;
    }
    if (stat && str(m, "statType") !== stat) continue;
    const how = str(m, "modifierType") ?? "Additive";
    if (m.type === "ConstantStatModifier") {
      if (how === "Additive") out.base += num(m, "value") ?? 0;
      else out.scaledBy.push(`${how === "Multiplier" ? "x" : "+"}${num(m, "value") ?? 0} (${how})`);
    } else if (m.type === "CombinedStatModifier") {
      const who = str(m, "refObject") ?? "";
      const owner = who === "Player" || who === "Instigator" ? "V's" : who === "Target" ? "the target's" : who === "Self" ? "its own" : `${who}'s`;
      const ref = str(m, "refStat");
      const known = who === "Self" && ref ? own?.get(ref) : undefined;
      if (known !== undefined && str(m, "opSymbol") === "*") out.base += known * (num(m, "value") ?? 0);
      else if (ref) out.scaledBy.push(`${owner} ${words(ref)}`);
    } else if (m.type === "CurveStatModifier") {
      out.scaledBy.push(`a curve on ${words(str(m, "refStat") ?? str(m, "column") ?? m.path)}`);
    } else if (m.type === "RandomStatModifier") {
      out.scaledBy.push(`a random value from ${num(m, "min") ?? "?"} to ${num(m, "max") ?? "?"}`);
    }
  }
  out.base = Math.round(out.base * 10000) / 10000;
  out.scaledBy = [...new Set(out.scaledBy)];
  return out;
}

/** An icon from a UIIcon record. */
export async function iconOf(r: Records, path: string | undefined): Promise<IconRef | undefined> {
  const rec = await r.get(path);
  const atlas = str(rec, "atlasResourcePath");
  const part = str(rec, "atlasPartName");
  return rec && atlas && part ? { record: rec.path, atlas, part } : undefined;
}

class Reader {
  readonly visited = new Set<string>();
  constructor(readonly r: Records) {}

  async get(path: string | undefined): Promise<Rec | undefined> {
    const rec = await this.r.get(path);
    if (rec) this.visited.add(rec.path);
    return rec;
  }

  async all(paths: unknown): Promise<Rec[]> {
    const recs = await this.r.all(paths as never);
    for (const rec of recs) this.visited.add(rec.path);
    return recs;
  }

  async statChanges(paths: unknown): Promise<StatChange[]> {
    const out: StatChange[] = [];
    for (const m of await this.all(paths)) {
      if (m.type === "StatModifierGroup") {
        out.push(...(await this.statChanges(m.flats.get("statModifiers"))));
      } else if (m.type === "ConstantStatModifier" && str(m, "statType")) {
        out.push({ stat: words(str(m, "statType")!), value: num(m, "value") ?? 0, how: str(m, "modifierType") ?? "Additive" });
      }
    }
    return out;
  }

  /** The damage an attack record does per hit. */
  async attack(path: string | undefined, every?: number): Promise<Damage | undefined> {
    const atk = await this.get(path);
    if (!atk) return undefined;
    const mods = await this.all(atk.flats.get("statModifiers"));
    const stat = mods.map((m) => str(m, "statType")).find((s) => /Damage$/.test(s ?? ""));
    const type = str(atk, "damageType") ? words(str(atk, "damageType")!) : stat ? words(stat).replace(/ Damage$/, "") : "Physical";
    // Every additive modifier of the damage stat adds up: Overheat Lvl3 is 3 (base) + 20 (its tier).
    const sum = stat ? await sumStat(this.r, mods, stat) : { base: 0, scaledBy: [] };
    return { type, perHit: sum.base, every, scaledBy: sum.scaledBy, record: atk.path, stat };
  }

  /** What an effector does, in words, with its damage and stat changes. */
  async effector(path: string | undefined): Promise<{ name: string; damage: Damage[]; stats: StatChange[]; spread: boolean; status?: string } | undefined> {
    const e = await this.get(path);
    if (!e) return undefined;
    const cls = str(e, "effectorClassName") ?? e.type;
    const out = { name: words(cls).replace(/ Effector$/, ""), damage: [] as Damage[], stats: [] as StatChange[], spread: /^Spread/.test(cls), status: undefined as string | undefined };
    const attack = str(e, "attackRecord");
    if (attack) {
      const d = await this.attack(attack, /Continuous/.test(cls) ? num(e, "delayTime") : undefined);
      if (d) out.damage.push(d);
    }
    const group = str(e, "statGroup");
    if (group) out.stats.push(...(await this.statChanges([group])));
    const status = str(e, "statusEffect");
    if (status) out.status = status;
    return out;
  }

  async status(path: string): Promise<Omit<Effect, "record" | "on" | "when" | "shared" | "cooldown">> {
    const se = await this.get(path);
    const ui = await this.get(str(se, "uiData"));
    const name = (await this.r.text(ui, "displayName")) ?? words(path);
    const own = new Map<string, number>();
    for (const pkg of await this.all(se?.flats.get("packages"))) {
      for (const m of await this.all(pkg.flats.get("stats"))) {
        const type = str(m, "statType");
        if (type && m.type === "ConstantStatModifier" && str(m, "modifierType") === "Additive") own.set(type, (own.get(type) ?? 0) + (num(m, "value") ?? 0));
      }
    }
    const durationPath = str(se, "duration");
    const durationGroup = await this.all([durationPath].filter(Boolean));
    const duration = durationPath === "BaseStats.InfiniteDuration" ? { base: Infinity, scaledBy: [] } : durationGroup.length ? await sumStat(this.r, durationGroup, "BaseStats.MaxDuration", undefined, own) : undefined;
    const stacksGroup = await this.all([str(se, "maxStacks")].filter(Boolean));
    const stacks = stacksGroup.length ? (await sumStat(this.r, stacksGroup, "BaseStats.MaxStacks")).base : undefined;
    const damage: Damage[] = [];
    const stats: StatChange[] = [];
    let spread = false;
    for (const pkg of await this.all(se?.flats.get("packages"))) {
      stats.push(...(await this.statChanges(pkg.flats.get("stats"))));
      for (const ef of list(pkg, "effectors")) {
        const e = await this.effector(ef);
        if (!e) continue;
        damage.push(...e.damage);
        stats.push(...e.stats);
        spread ||= e.spread;
      }
    }
    const iconName = str(ui, "iconPath");
    return {
      name,
      status: path,
      type: str(se, "statusEffectType") ? words(str(se, "statusEffectType")!) : undefined,
      duration,
      durationGroup: durationPath && durationPath !== "BaseStats.InfiniteDuration" ? durationPath : undefined,
      durationMods: list(durationGroup[0], "statModifiers"),
      stacks,
      tags: list(se, "gameplayTags"),
      damage,
      stats,
      icon: iconName ? await iconOf(this.r, `UIIcon.${iconName}`) : undefined,
      spread,
    };
  }

  async effects(paths: unknown, when: Effect["when"], cooldownPath: string | undefined): Promise<Effect[]> {
    const out: Effect[] = [];
    for (const oae of await this.all(paths)) {
      const on = str(oae, "recipient") === "ObjectActionReference.Instigator" ? "V" : "target";
      const base = { record: oae.path, on, when, shared: isShared(oae.path) } as const;
      const statusPath = str(oae, "statusEffect");
      if (statusPath) {
        const s = await this.status(statusPath);
        out.push({ ...base, ...s, cooldown: statusPath === cooldownPath });
        continue;
      }
      const e = await this.effector(str(oae, "effectorToTrigger"));
      if (!e) continue;
      const nested = e.status ? await this.status(e.status) : undefined;
      out.push({
        ...base,
        name: nested?.name ?? e.name,
        effector: e.name,
        status: nested?.status,
        type: nested?.type,
        duration: nested?.duration,
        durationGroup: nested?.durationGroup,
        durationMods: nested?.durationMods,
        stacks: nested?.stacks,
        tags: nested?.tags ?? [],
        damage: [...e.damage, ...(nested?.damage ?? [])],
        stats: [...e.stats, ...(nested?.stats ?? [])],
        icon: nested?.icon,
        cooldown: false,
        spread: e.spread || !!nested?.spread,
      });
    }
    return out;
  }

  async costs(action: Rec | undefined): Promise<Value | undefined> {
    const costs = await this.all(action?.flats.get("costs"));
    if (!costs.length) return undefined;
    const mods: Rec[] = [];
    for (const c of costs) mods.push(...(await this.all(c.flats.get("costMods"))));
    return sumStat(this.r, mods, "BaseStats.Memory");
  }

  async upload(action: Rec | undefined): Promise<Value | undefined> {
    const mods = await this.all(action?.flats.get("activationTime"));
    return mods.length ? sumStat(this.r, mods, "BaseStats.QuickHackUpload") : undefined;
  }

  /** The cooldown: a status effect V gets, which the action's instigator prerequisites check for. */
  async cooldown(action: Rec | undefined): Promise<(Value & { record: string; group?: string }) | undefined> {
    for (const pre of await this.all(action?.flats.get("instigatorPrereqs"))) {
      const se = await this.get(str(pre, "statusEffect"));
      if (!se || pre.flats.get("invert") !== true) continue;
      const isCooldown = list(se, "gameplayTags").includes("QuickHackCooldown") || str(se, "statusEffectType") === "BaseStatusEffectTypes.PlayerCooldown";
      if (!isCooldown) continue;
      const group = await this.all([str(se, "duration")].filter(Boolean));
      return { record: se.path, group: group[0]?.path, ...(await sumStat(this.r, group, "BaseStats.MaxDuration")) };
    }
    return undefined;
  }

  async variant(path: string | undefined): Promise<Variant | undefined> {
    const action = await this.get(path);
    if (!action) return undefined;
    const cooldown = await this.cooldown(action);
    const effects = [...(await this.effects(action.flats.get("startEffects"), "start", cooldown?.record)), ...(await this.effects(action.flats.get("completionEffects"), "upload", cooldown?.record))];
    return { record: action.path, ram: await this.costs(action), upload: await this.upload(action), main: mainEffect(effects) };
  }
}

/** Reads one tier: an item (or none, for a device hack) and its own action. */
export async function readTier(r: Records, itemPath: string | undefined, actionPath: string, rank: number): Promise<Tier> {
  const rd = new Reader(r);
  const item = await rd.get(itemPath);
  const action = await rd.get(actionPath);
  const ui = await rd.get(str(action, "objectActionUI"));
  const cooldown = await rd.cooldown(action);
  const effects = [
    ...(await rd.effects(action?.flats.get("startEffects"), "start", cooldown?.record)),
    ...(await rd.effects(action?.flats.get("completionEffects"), "upload", cooldown?.record)),
  ];
  const notWhen: string[] = [];
  for (const pre of await rd.all(action?.flats.get("targetActivePrereqs"))) {
    const t = await r.text(pre, "failureExplanation");
    if (t && !notWhen.includes(t)) notWhen.push(t);
  }
  const tooltip: string[] = [];
  for (const glp of await rd.all(item?.flats.get("OnAttach"))) {
    const t = await r.text(await rd.get(str(glp, "UIData")), "localizedDescription");
    if (t) tooltip.push(t);
  }
  const passives = [];
  for (const glp of await rd.all(item?.flats.get("OnEquip"))) {
    const effectors: string[] = [];
    const stats = await rd.statChanges(glp.flats.get("stats"));
    for (const ef of list(glp, "effectors")) {
      const e = await rd.effector(ef);
      if (e) {
        effectors.push(e.name);
        stats.push(...e.stats);
      }
    }
    const name = (await r.text(await rd.get(str(glp, "UIData")), "localizedName")) ?? words(glp.path);
    passives.push({ record: glp.path, name, stats, effectors });
  }
  let recipe: Tier["recipe"];
  if (item) {
    const rec = await rd.get(`Items.Recipe_${item.path.slice("Items.".length)}`);
    if (rec) {
      const components = [];
      const crafting = await rd.get(str(item, "CraftingData"));
      for (const el of await rd.all(crafting?.flats.get("craftingRecipe"))) {
        const ing = await rd.get(str(el, "ingredient"));
        components.push({ name: (await r.text(ing, "displayName")) ?? words(str(el, "ingredient") ?? el.path), amount: num(el, "amount") ?? 1 });
      }
      recipe = { record: rec.path, components };
    }
  }
  // The Boss and Chimera actions of the same tier sit beside the tier's own in the item's list.
  const own = actionPath.slice("QuickHack.".length);
  const siblings = list(item, "objectActions");
  const boss = siblings.find((p) => p === `QuickHack.Boss${own}`);
  const chimera = siblings.find((p) => p === `QuickHack.Chimera${own}`);
  const caption = await r.text(ui, "caption");
  const name = (await r.text(item, "displayName")) ?? caption ?? words(str(action, "actionName") ?? actionPath);
  return {
    item: item?.path,
    rank,
    quality: QUALITY[str(item, "quality") ?? ""] ?? (str(item, "quality") ? words(str(item, "quality")!) : undefined),
    action: actionPath,
    name,
    description: await r.text(item, "localizedDescription"),
    wheelName: caption,
    wheelDescription: await r.text(ui, "description"),
    tooltip,
    ui: ui?.path,
    captionIcon: str(ui, "captionIcon"),
    icons: {
      item: str(item, "iconPath") ? await iconOf(r, `UIIcon.${str(item, "iconPath")}`) : undefined,
      wheel: await iconOf(r, str(await rd.get(str(ui, "captionIcon")), "texturePartID")),
    },
    category: str(action, "hackCategory") ? words(str(action, "hackCategory")!) : undefined,
    ram: await rd.costs(action),
    upload: await rd.upload(action),
    cooldown,
    effects,
    notWhen,
    spread: effects.some((e) => e.spread),
    passives,
    recipe,
    boss: await rd.variant(boss),
    chimera: await rd.variant(chimera),
    records: [...rd.visited],
  };
}

/**
 * The tier's own action among an item's actions: the last people quickhack in its list that is not
 * a Boss, Chimera or Spread one (an item lists every lower tier's actions before its own).
 */
export function ownAction(objectActions: string[]): string | undefined {
  const own = objectActions.filter((p) => /^QuickHack\./.test(p) && !/^QuickHack\.(Boss|Chimera)/.test(p) && !/Spread$/.test(p));
  return own[own.length - 1];
}

/** Reads a family from its items, base tier first. */
export async function readFamily(r: Records, key: string, items: { path: string; rank: number }[]): Promise<Family> {
  const tiers: Tier[] = [];
  for (const it of [...items].sort((a, b) => a.rank - b.rank)) {
    const item = await r.get(it.path);
    const action = ownAction(list(item, "objectActions"));
    if (action) tiers.push(await readTier(r, it.path, action, it.rank));
  }
  if (tiers.length && tiers[tiers.length - 1].item?.endsWith("PlusPlusProgram")) tiers[tiers.length - 1].quality = "Legendary++";
  const top = tiers[tiers.length - 1];
  return { key, name: top?.name ?? key, kind: "people", category: top?.category, tiers };
}

/** Reads a device or vehicle hack: one action, no item. */
export async function readAction(r: Records, actionPath: string, kind: "device" | "vehicle"): Promise<Family> {
  const tier = await readTier(r, undefined, actionPath, 0);
  return { key: `action:${actionPath}`, name: tier.name, kind, category: tier.category, tiers: [tier] };
}
