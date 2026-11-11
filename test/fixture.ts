// Made-up TweakDB records in the game's shape, for the tests: a quickhack family "Zap" with two
// tiers, a shared effect, a cooldown, a damage-over-time status effect and a device hack. No game
// data: every name and number here is invented.
import type { TweakRecord, TweakRecordFull, TweakValue } from "../src/types";

type Flats = Record<string, TweakValue>;
const db = new Map<string, { type: string; flats: Flats }>();
const add = (path: string, type: string, flats: Flats) => db.set(path, { type: `gamedata${type}_Record`, flats });
const loc = (key: string, text: string | null) => ({ key, text });

add("Items.ZapProgram", "Item", {
  itemType: "ItemType.Prt_Program",
  quality: "Quality.Common",
  displayName: loc("LocKey#1", "Zap"),
  localizedDescription: loc("LocKey#2", "A <Rich color=\"x\">test</> hack.\\nSecond line."),
  iconPath: "quickhack_zap",
  objectActions: ["ItemAction.ProgramDisassemble", "QuickHack.ZapHack", "QuickHack.BossZapHack"],
  OnAttach: ["EquipmentGLP.ZapProgram"],
  OnEquip: [],
  CraftingData: "Items.ZapCraftingPackage",
});
add("Items.ZapLvl1Program", "Item", {
  itemType: "ItemType.Prt_Program",
  quality: "Quality.Uncommon",
  displayName: loc("LocKey#1", "Zap"),
  iconPath: "quickhack_zap",
  objectActions: ["ItemAction.ProgramDisassemble", "QuickHack.ZapHack", "QuickHack.BossZapHack", "QuickHack.ZapLvl1Hack", "QuickHack.BossZapLvl1Hack", "QuickHack.ZapLvl1HackSpread"],
  OnAttach: [],
  OnEquip: ["EquipmentGLP.ZapPassive"],
});
// Points to another tier only: not a tier of its own.
add("Items.ZapLvl3Program", "Item", { itemType: "ItemType.Prt_Program", quality: "Quality.Epic", displayName: loc("LocKey#1", "Zap"), objectActions: [] });
add("Items.CyberdeckProgram", "Item", { itemType: "ItemType.Prt_Program", displayName: loc("LocKey#0", null), objectActions: ["QuickHack.ZapHack"] });
add("Items.Jacket", "Item", { itemType: "ItemType.Clo_OuterChest", displayName: loc("LocKey#9", "Jacket") });
add("Items.Recipe_ZapProgram", "ItemRecipe", {});
add("Items.ZapCraftingPackage", "CraftingPackage", { craftingRecipe: ["Items.ZapCraftingPackage_inline0"] });
add("Items.ZapCraftingPackage_inline0", "RecipeElement", { amount: 5, ingredient: "Items.ZapMaterial" });
add("Items.ZapMaterial", "Item", { displayName: loc("LocKey#3", "Zap Components") });
add("EquipmentGLP.ZapProgram", "GameplayLogicPackage", { UIData: "EquipmentGLP.ZapProgram_inline0" });
add("EquipmentGLP.ZapProgram_inline0", "GameplayLogicPackageUIData", { localizedDescription: "LocKey#50" });
add("EquipmentGLP.ZapPassive", "GameplayLogicPackage", { effectors: ["EquipmentGLP.ZapPassive_inline0"], stats: [] });
add("EquipmentGLP.ZapPassive_inline0", "Effector", { effectorClassName: "ModifyStatusEffectDurationOnAttackEffector" });

for (const [path, ram, upload, damage] of [
  ["QuickHack.ZapHack", 3, 2, 10],
  ["QuickHack.ZapLvl1Hack", 4, 1.5, 20],
] as const) {
  add(path, "ObjectAction", {
    actionName: "Zap",
    isQuickHack: true,
    objectActionType: "ObjectActionType.PuppetQuickHack",
    hackCategory: "HackCategory.DamageHack",
    objectActionUI: "Interactions.ZapHack",
    activationTime: [`${path}_upload`],
    costs: [`${path}_cost`],
    instigatorPrereqs: ["QuickHack.ZapCooldownPrereq"],
    targetActivePrereqs: ["Prereqs.ZapImmune"],
    startEffects: ["QuickHack.ZapStartCooldown", "QuickHack.ZapSpreadInit"],
    completionEffects: ["QuickHack.QuickHack_inline2", `${path}_effect`],
  });
  add(`${path}_upload`, "ConstantStatModifier", { value: upload, modifierType: "Additive", statType: "BaseStats.QuickHackUpload" });
  add(`${path}_cost`, "StatPoolCost", { statPool: "BaseStatPools.Memory", costMods: [`${path}_ram`, "QuickHack.MemoryCostReductionMod"] });
  add(`${path}_ram`, "ConstantStatModifier", { value: ram, modifierType: "Additive", statType: "BaseStats.Memory" });
  add(`${path}_effect`, "ObjectActionEffect", { recipient: "ObjectActionReference.Target", statusEffect: `BaseStatusEffect.${path.slice(10)}Burn` });
  add(`BaseStatusEffect.${path.slice(10)}Burn`, "StatusEffect", {
    statusEffectType: "BaseStatusEffectTypes.Burning",
    gameplayTags: ["Debuff", "DoT"],
    duration: "BaseStatusEffect.ZapDuration",
    maxStacks: "BaseStatusEffect.ZapStacks",
    uiData: "BaseStatusEffect.ZapUI",
    packages: [`BaseStatusEffect.${path.slice(10)}Burn_pkg`],
  });
  add(`BaseStatusEffect.${path.slice(10)}Burn_pkg`, "GameplayLogicPackage", { effectors: [`BaseStatusEffect.${path.slice(10)}Burn_dot`], stats: ["BaseStatusEffect.ZapArmor"] });
  add(`BaseStatusEffect.${path.slice(10)}Burn_dot`, "ContinuousAttackEffector", { effectorClassName: "TriggerContinuousAttackEffector", attackRecord: `Attacks.${path.slice(10)}`, delayTime: 0.25 });
  add(`Attacks.${path.slice(10)}`, "Attack_GameEffect", { damageType: "DamageTypes.Thermal", statModifiers: ["Attacks.ZapBase", `Attacks.${path.slice(10)}_tier`] });
  add(`Attacks.${path.slice(10)}_tier`, "ConstantStatModifier", { value: damage, modifierType: "Additive", statType: "BaseStats.ThermalDamage" });
}
add("QuickHack.BossZapHack", "ObjectAction", { actionName: "BossZap", costs: ["QuickHack.ZapHack_cost"], activationTime: ["QuickHack.ZapHack_upload", "QuickHack.BossExtraUpload"] });
add("QuickHack.BossZapLvl1Hack", "ObjectAction", { actionName: "BossZap", costs: ["QuickHack.ZapLvl1Hack_cost"], activationTime: ["QuickHack.ZapLvl1Hack_upload"] });
add("QuickHack.ZapLvl1HackSpread", "ObjectAction", { actionName: "Zap" });
add("QuickHack.BossExtraUpload", "ConstantStatModifier", { value: 1, modifierType: "Additive", statType: "BaseStats.QuickHackUpload" });
add("Attacks.ZapBase", "ConstantStatModifier", { value: 3, modifierType: "Additive", statType: "BaseStats.ThermalDamage" });
add("QuickHack.MemoryCostReductionMod", "CombinedStatModifier", { opSymbol: "*", refObject: "Player", refStat: "BaseStats.MemoryCostReduction", value: -1, modifierType: "Additive", statType: "BaseStats.Memory" });
add("BaseStatusEffect.ZapDuration", "StatModifierGroup", { statModifiers: ["BaseStatusEffect.ZapDuration_inline0"] });
add("BaseStatusEffect.ZapDuration_inline0", "ConstantStatModifier", { value: 6, modifierType: "Additive", statType: "BaseStats.MaxDuration" });
add("BaseStatusEffect.ZapOwnMod", "CombinedStatModifier", { opSymbol: "*", refObject: "Self", refStat: "BaseStats.ZapDurationIncrease", value: 1, modifierType: "Additive", statType: "BaseStats.MaxDuration" });
add("BaseStatusEffect.ZapStacks", "StatModifierGroup", { statModifiers: ["BaseStatusEffect.ZapStacks_inline0"] });
add("BaseStatusEffect.ZapStacks_inline0", "ConstantStatModifier", { value: 2, modifierType: "Additive", statType: "BaseStats.MaxStacks" });
add("BaseStatusEffect.ZapUI", "StatusEffectUIData", { displayName: "LocKey#60", iconPath: "zap_icon" });
// A poison, with Contagion's tag, for the effects EDGEhack keeps off machines (H3.4b).
add("BaseStatusEffect.ZapPoison", "StatusEffect", {
  statusEffectType: "BaseStatusEffectTypes.Poisoned",
  gameplayTags: ["Debuff", "DoT", "ContagionPoison"],
  duration: "BaseStatusEffect.ZapDuration",
  maxStacks: "BaseStatusEffect.ZapStacks",
  uiData: "BaseStatusEffect.ZapUI",
  packages: ["BaseStatusEffect.ZapPoison_pkg"],
});
add("BaseStatusEffect.ZapPoison_pkg", "GameplayLogicPackage", { effectors: ["BaseStatusEffect.ZapPoison_dot"], stats: [] });
add("BaseStatusEffect.ZapPoison_dot", "ContinuousAttackEffector", { effectorClassName: "TriggerContinuousAttackEffector", attackRecord: "Attacks.ZapPoison", delayTime: 0.25 });
add("Attacks.ZapPoison", "Attack_GameEffect", { damageType: "DamageTypes.Chemical", statModifiers: ["Attacks.ZapPoison_inline0"] });
add("Attacks.ZapPoison_inline0", "ConstantStatModifier", { value: 4, modifierType: "Additive", statType: "BaseStats.ChemicalDamage" });
add("BaseStatusEffect.ZapArmor", "ConstantStatModifier", { value: -10, modifierType: "Additive", statType: "BaseStats.Armor" });
add("UIIcon.quickhack_zap", "UIIcon", { atlasResourcePath: "base\\gui\\zap.inkatlas", atlasPartName: "quickhack_zap" });
add("UIIcon.Zap", "UIIcon", { atlasResourcePath: "base\\gui\\wheel.inkatlas", atlasPartName: "Zap" });
add("UIIcon.zap_icon", "UIIcon", { atlasResourcePath: "base\\gui\\status.inkatlas", atlasPartName: "zap_icon" });
add("Interactions.ZapHack", "InteractionBase", { caption: loc("LocKey#1", "Zap"), description: loc("LocKey#4", "Zaps <b>hard</b>."), captionIcon: "ChoiceCaptionParts.ZapIcon" });
add("ChoiceCaptionParts.ZapIcon", "ChoiceCaptionIconPart", { texturePartID: "UIIcon.Zap" });
add("QuickHack.ZapCooldownPrereq", "StatusEffectPrereq", { invert: true, statusEffect: "BaseStatusEffect.ZapCooldown" });
add("BaseStatusEffect.ZapCooldown", "StatusEffect", { statusEffectType: "BaseStatusEffectTypes.PlayerCooldown", gameplayTags: ["QuickHackCooldown"], duration: "BaseStatusEffect.ZapCooldownDuration" });
add("BaseStatusEffect.ZapCooldownDuration", "StatModifierGroup", { statModifiers: ["BaseStatusEffect.ZapCooldownDuration_inline0"] });
add("BaseStatusEffect.ZapCooldownDuration_inline0", "ConstantStatModifier", { value: 12, modifierType: "Additive", statType: "BaseStats.MaxDuration" });
add("QuickHack.ZapStartCooldown", "ObjectActionEffect", { recipient: "ObjectActionReference.Instigator", statusEffect: "BaseStatusEffect.ZapCooldown" });
add("QuickHack.ZapSpreadInit", "ObjectActionEffect", { recipient: "ObjectActionReference.Target", effectorToTrigger: "QuickHack.ZapSpreadInit_inline0" });
add("QuickHack.ZapSpreadInit_inline0", "SpreadInitEffector", { effectorClassName: "SpreadInitEffector", objectAction: "QuickHack.ZapHack" });
add("QuickHack.QuickHack_inline2", "ObjectActionEffect", { recipient: "ObjectActionReference.Target", effectorToTrigger: "QuickHack.QuickHack_inline3" });
add("QuickHack.QuickHack_inline3", "ApplyStatGroupEffector", { effectorClassName: "ApplyStatGroupEffector", statGroup: "QuickHack.QuickHack_inline4" });
add("QuickHack.QuickHack_inline4", "StatModifierGroup", { statModifiers: ["QuickHack.QuickHack_inline5"] });
add("QuickHack.QuickHack_inline5", "ConstantStatModifier", { value: -5, modifierType: "Additive", statType: "BaseStats.ArmorMultBonus" });
add("Prereqs.ZapImmune", "ObjectActionPrereq", { failureExplanation: "LocKey#70" });
add("DeviceAction.ZapCamera", "ObjectAction", {
  actionName: "ZapCamera",
  isQuickHack: true,
  objectActionType: "ObjectActionType.DeviceQuickHack",
  hackCategory: "HackCategory.DeviceHack",
  objectActionUI: "Interactions.ZapCamera",
});
add("DeviceAction.OldThing", "ObjectAction", { actionName: "OldThing", isQuickHack: true, objectActionType: "ObjectActionType.DeviceQuickHack", objectActionUI: "Interactions.OldThing" });
add("DeviceAction.VehicleQuickHack", "ObjectAction", { actionName: "None", isQuickHack: true, objectActionType: "ObjectActionType.VehicleQuickHack" });

const texts: Record<string, string> = {
  "LocKey#50": "Deals damage over time.",
  "LocKey#60": "Zapped",
  "LocKey#70": "Target is immune to zaps",
};

export async function fetchRecord(path: string): Promise<TweakRecordFull> {
  const r = db.get(path);
  if (!r) throw new Error(`No record ${path}`);
  return { id: "0x0", path, type: r.type, flats: Object.entries(r.flats).map(([name, value]) => ({ name, type: "", value })) };
}

export async function fetchText(key: string): Promise<string | undefined> {
  return texts[key];
}

/** Records as tweakdb.records gives them, with only the flats asked for. */
export function records(type: string, flats: string[]): TweakRecord[] {
  return [...db.entries()]
    .filter(([, r]) => r.type === `gamedata${type}_Record`)
    .map(([path, r]) => ({ id: "0x0", path, type: r.type, flats: Object.fromEntries(flats.filter((f) => f in r.flats).map((f) => [f, r.flats[f]])) }));
}
