import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records, plain, words } from "../src/records";
import { ownAction, readAction, readFamily, sumStat } from "../src/read";
import { catalogOf, familyOfPath } from "../src/catalog";
import { recordOfArg } from "../src/quickhack";
import { fetchRecord, fetchText, records } from "./fixture";

const reader = () => new Records(fetchRecord, fetchText);

test("words and plain text", () => {
  assert.equal(words("BaseStatusEffect.OverheatLevel2"), "Overheat Level 2");
  assert.equal(words("HackCategory.DamageHack"), "Damage Hack");
  assert.equal(words("BaseStats.QuickHackUpload"), "Quick Hack Upload");
  assert.equal(words("QuickHack.Foo_inline3"), "Foo");
  assert.equal(plain('A <Rich color="x">test</> hack.\\nSecond line.'), "A test hack. Second line.");
});

test("the tier's own action is the last plain quickhack action", () => {
  assert.equal(ownAction(["ItemAction.ProgramDisassemble", "QuickHack.ZapHack", "QuickHack.BossZapHack", "QuickHack.ZapLvl1Hack", "QuickHack.ChimeraZapLvl1Hack", "QuickHack.ZapLvl1HackSpread"]), "QuickHack.ZapLvl1Hack");
  assert.equal(ownAction(["ItemAction.ProgramDisassemble", "DeviceAction.PingDevice"]), undefined);
});

test("sumStat adds the additive modifiers and names what scales them", async () => {
  const r = reader();
  const mods = await r.all(["QuickHack.ZapHack_ram", "QuickHack.MemoryCostReductionMod"]);
  assert.deepEqual(await sumStat(r, mods, "BaseStats.Memory"), { base: 3, scaledBy: ["V's Memory Cost Reduction"] });
});

test("a modifier reading the effect's own stat is worked out", async () => {
  const r = reader();
  const mods = await r.all(["BaseStatusEffect.ZapDuration_inline0", "BaseStatusEffect.ZapOwnMod"]);
  const own = new Map([["BaseStats.ZapDurationIncrease", 3]]);
  assert.deepEqual(await sumStat(r, mods, "BaseStats.MaxDuration", undefined, own), { base: 9, scaledBy: [] });
  assert.deepEqual(await sumStat(r, mods, "BaseStats.MaxDuration"), { base: 6, scaledBy: ["its own Zap Duration Increase"] });
});

test("a family reads into tiers with texts, icons, costs and effects", async () => {
  const fam = await readFamily(reader(), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);
  assert.equal(fam.name, "Zap");
  assert.equal(fam.category, "Damage Hack");
  assert.equal(fam.tiers.length, 2);
  const [t0, t1] = fam.tiers;
  assert.equal(t0.action, "QuickHack.ZapHack");
  assert.equal(t1.action, "QuickHack.ZapLvl1Hack");
  assert.equal(t0.quality, "Common");
  assert.equal(t0.description, "A test hack. Second line.");
  assert.equal(t0.wheelDescription, "Zaps hard.");
  assert.deepEqual(t0.tooltip, ["Deals damage over time."]);
  assert.deepEqual(t0.icons.item, { record: "UIIcon.quickhack_zap", atlas: "base\\gui\\zap.inkatlas", part: "quickhack_zap" });
  assert.equal(t0.icons.wheel?.part, "Zap");
  assert.equal(t0.ram?.base, 3);
  assert.equal(t1.ram?.base, 4);
  assert.equal(t1.upload?.base, 1.5);
  assert.equal(t0.cooldown?.base, 12);
  assert.equal(t0.cooldown?.record, "BaseStatusEffect.ZapCooldown");
  assert.deepEqual(t0.notWhen, ["Target is immune to zaps"]);
  assert.equal(t0.spread, true);
  assert.equal(t0.recipe?.record, "Items.Recipe_ZapProgram");
  assert.deepEqual(t0.recipe?.components, [{ name: "Zap Components", amount: 5 }]);
  assert.equal(t1.recipe, undefined);
  assert.equal(t0.boss?.record, "QuickHack.BossZapHack");
  assert.equal(t0.boss?.upload?.base, 3);
  assert.equal(t1.boss?.record, "QuickHack.BossZapLvl1Hack");
  assert.equal(t1.passives.length, 1);
  assert.deepEqual(t1.passives[0].effectors, ["Modify Status Effect Duration On Attack"]);
  assert.ok(t0.records.includes("Attacks.ZapHack"));
});

test("effects: the cooldown, a shared one, the spread and the burn with its damage", async () => {
  const fam = await readFamily(reader(), "Zap", [{ path: "Items.ZapLvl1Program", rank: 1 }]);
  const effects = fam.tiers[0].effects;
  const cooldown = effects.find((e) => e.cooldown);
  assert.equal(cooldown?.on, "V");
  assert.equal(cooldown?.when, "start");
  const shared = effects.find((e) => e.shared);
  assert.equal(shared?.record, "QuickHack.QuickHack_inline2");
  assert.deepEqual(shared?.stats, [{ stat: "Armor Mult Bonus", value: -5, how: "Additive" }]);
  const spread = effects.find((e) => e.spread);
  assert.equal(spread?.name, "Spread Init");
  const burn = effects.find((e) => e.status === "BaseStatusEffect.ZapLvl1HackBurn");
  assert.ok(burn);
  assert.equal(burn.name, "Zapped");
  assert.equal(burn.on, "target");
  assert.equal(burn.when, "upload");
  assert.equal(burn.type, "Burning");
  assert.equal(burn.duration?.base, 6);
  assert.equal(burn.stacks, 2);
  assert.deepEqual(burn.damage, [{ type: "Thermal", perHit: 23, every: 0.25, scaledBy: [], record: "Attacks.ZapLvl1Hack", stat: "BaseStats.ThermalDamage" }]);
  assert.equal(burn.durationGroup, "BaseStatusEffect.ZapDuration");
  assert.deepEqual(burn.durationMods, ["BaseStatusEffect.ZapDuration_inline0"]);
  assert.deepEqual(burn.stats, [{ stat: "Armor", value: -10, how: "Additive" }]);
  assert.equal(burn.icon?.part, "zap_icon");
});

test("a device hack reads as one tier with no item", async () => {
  const fam = await readAction(reader(), "DeviceAction.ZapCamera", "device");
  assert.equal(fam.key, "action:DeviceAction.ZapCamera");
  assert.equal(fam.tiers.length, 1);
  assert.equal(fam.tiers[0].item, undefined);
  assert.equal(fam.category, "Device Hack");
});

test("the catalog groups items into families and lists device and vehicle hacks", () => {
  const captions = new Map([
    ["Interactions.ZapCamera", "Zap the Camera"],
    ["Interactions.OldThing", "!OBSOLETE"],
  ]);
  const c = catalogOf(records("Item", ["itemType", "quality", "displayName", "iconPath", "objectActions"]), records("ObjectAction", ["isQuickHack", "objectActionType", "hackCategory", "actionName", "objectActionUI"]), captions);
  assert.deepEqual(
    c.families.map((f) => [f.key, f.name, f.category, f.items.map((i) => i.path), f.icon]),
    [["Zap", "Zap", "Damage Hack", ["Items.ZapProgram", "Items.ZapLvl1Program"], "UIIcon.quickhack_zap"]],
  );
  assert.deepEqual(c.devices.map((d) => [d.path, d.name]), [["DeviceAction.ZapCamera", "Zap the Camera"]]);
  assert.deepEqual(c.vehicles, []);
  assert.equal(familyOfPath("QuickHack.BossZapLvl1Hack", c)?.family?.key, "Zap");
  assert.equal(familyOfPath("QuickHack.ZapLvl1HackSpread", c)?.family?.key, "Zap");
  assert.equal(familyOfPath("Items.Recipe_ZapProgram", c)?.family?.key, "Zap");
  assert.equal(familyOfPath("DeviceAction.ZapCamera", c)?.action?.path, "DeviceAction.ZapCamera");
  assert.equal(familyOfPath("Items.Jacket", c), undefined);
});

test("openQuickhack takes strings, REDcode's view nodes and objects", () => {
  assert.equal(recordOfArg(" Items.ZapProgram "), "Items.ZapProgram");
  assert.equal(recordOfArg({ kind: "record", ref: { id: "0x1", path: "QuickHack.ZapHack", type: "gamedataObjectAction_Record" } }), "QuickHack.ZapHack");
  assert.equal(recordOfArg({ kind: "record", ref: { id: "0x1", path: null, type: "x" } }), "0x1");
  assert.equal(recordOfArg({ record: "Items.ZapProgram" }), "Items.ZapProgram");
  assert.equal(recordOfArg({ kind: "type" }), undefined);
  assert.equal(recordOfArg(""), undefined);
});
