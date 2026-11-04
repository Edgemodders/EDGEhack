import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { writeTweaks } from "../src/tweaks";
import { newDoc, parseDoc, printDoc, safeId, withField, withTierField } from "../src/document";
import { fetchRecord, fetchText } from "./fixture";

const family = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

test("a document with no changes writes nothing", async () => {
  const out = writeTweaks(await family(), newDoc("My Mod", "Zap"));
  assert.equal(out.yaml, undefined);
  assert.deepEqual(out.texts, []);
});

test("RAM and upload go on as differences, up and down, on the tier's action", async () => {
  let doc = newDoc("mod", "Zap");
  doc = withTierField(doc, "Items.ZapLvl1Program", "ram", 6, 4);
  doc = withTierField(doc, "Items.ZapProgram", "upload", 1, 2);
  const { yaml } = writeTweaks(await family(), doc);
  assert.match(yaml!, /EDGEhack\.mod_zap\.ZapLvl1Program_RamMod:\n {2}\$type: ConstantStatModifier\n {2}value: 2\n {2}modifierType: Additive\n {2}statType: BaseStats\.Memory/);
  assert.match(yaml!, /EDGEhack\.mod_zap\.ZapLvl1Program_Ram:\n {2}\$type: StatPoolCost\n {2}statPool: BaseStatPools\.Memory\n {2}costMods:\n {4}- EDGEhack\.mod_zap\.ZapLvl1Program_RamMod/);
  assert.match(yaml!, /QuickHack\.ZapLvl1Hack\.costs:\n {2}- !append EDGEhack\.mod_zap\.ZapLvl1Program_Ram/);
  assert.match(yaml!, /value: -1\n {2}modifierType: Additive\n {2}statType: BaseStats\.QuickHackUpload/);
  assert.match(yaml!, /QuickHack\.ZapHack\.activationTime:\n {2}- !append EDGEhack\.mod_zap\.ZapProgram_Upload/);
});

test("a boss gets the same difference, or its own value when set", async () => {
  let doc = newDoc("mod", "Zap");
  doc = withTierField(doc, "Items.ZapLvl1Program", "ram", 6, 4);
  doc = withTierField(doc, "Items.ZapProgram", "ram", 5, 3);
  doc = withTierField(doc, "Items.ZapProgram", "bossRam", 10);
  const { yaml } = writeTweaks(await family(), doc);
  assert.match(yaml!, /QuickHack\.BossZapLvl1Hack\.costs:\n {2}- !append EDGEhack\.mod_zap\.ZapLvl1Program_Boss_Ram/);
  assert.match(yaml!, /ZapLvl1Program_Boss_RamMod:\n {2}\$type: ConstantStatModifier\n {2}value: 2/);
  assert.match(yaml!, /ZapProgram_Boss_RamMod:\n {2}\$type: ConstantStatModifier\n {2}value: 7/);
});

test("damage goes on the attack, duration in a new group with the old modifiers", async () => {
  let doc = newDoc("mod", "Zap");
  doc = withTierField(doc, "Items.ZapLvl1Program", "damage", 73, 23);
  doc = withTierField(doc, "Items.ZapLvl1Program", "duration", 12, 6);
  const { yaml, warnings } = writeTweaks(await family(), doc);
  assert.match(yaml!, /value: 50\n {2}modifierType: Additive\n {2}statType: BaseStats\.ThermalDamage/);
  assert.match(yaml!, /Attacks\.ZapLvl1Hack\.statModifiers:\n {2}- !append EDGEhack\.mod_zap\.ZapLvl1Program_Damage/);
  assert.match(yaml!, /ZapLvl1Program_Duration:\n {2}\$type: StatModifierGroup\n {2}statModsLimit: -1\n {2}statModifiers:\n {4}- BaseStatusEffect\.ZapDuration_inline0\n {4}- EDGEhack\.mod_zap\.ZapLvl1Program_DurationMod/);
  assert.match(yaml!, /BaseStatusEffect\.ZapLvl1HackBurn\.duration: EDGEhack\.mod_zap\.ZapLvl1Program_Duration/);
  assert.deepEqual(warnings, []);
});

test("the cooldown is written once for the family", async () => {
  const doc = { ...newDoc("mod", "Zap"), cooldown: 20 };
  const { yaml } = writeTweaks(await family(), doc);
  assert.equal(yaml!.match(/BaseStatusEffect\.ZapCooldownDuration\.statModifiers/g)?.length, 1);
  assert.match(yaml!, /value: 8\n {2}modifierType: Additive\n {2}statType: BaseStats\.MaxDuration/);
});

test("texts and icons go on every tier's item and the wheel's shared records", async () => {
  const doc = { ...newDoc("mod", "Zap"), name: "Big Zap", description: "It zaps.", wheelText: "Zaps a lot.", itemIcon: "UIIcon.quickhack_other", wheelIcon: "UIIcon.Other" };
  const { yaml, texts } = writeTweaks(await family(), doc);
  assert.deepEqual(texts, [
    { key: "EDGEhack-mod_zap-Name", text: "Big Zap" },
    { key: "EDGEhack-mod_zap-Description", text: "It zaps." },
    { key: "EDGEhack-mod_zap-Wheel", text: "Zaps a lot." },
  ]);
  assert.match(yaml!, /Items\.ZapProgram\.displayName: LocKey#EDGEhack-mod_zap-Name/);
  assert.match(yaml!, /Items\.ZapLvl1Program\.displayName: LocKey#EDGEhack-mod_zap-Name/);
  assert.match(yaml!, /Interactions\.ZapHack\.caption: LocKey#EDGEhack-mod_zap-Name/);
  assert.match(yaml!, /Items\.ZapProgram\.localizedDescription: LocKey#EDGEhack-mod_zap-Description/);
  assert.match(yaml!, /Interactions\.ZapHack\.description: LocKey#EDGEhack-mod_zap-Wheel/);
  assert.match(yaml!, /Items\.ZapProgram\.iconPath: quickhack_other/);
  assert.match(yaml!, /ChoiceCaptionParts\.ZapIcon\.texturePartID: UIIcon\.Other/);
  assert.equal(yaml!.match(/Interactions\.ZapHack\.caption/g)?.length, 1);
});

test("documents read and print, leaving out what is unset", () => {
  assert.equal(safeId("My Mod: Overheat!"), "my_mod_overheat");
  let doc = newDoc("My Mod", "Overheat");
  assert.equal(doc.id, "my_mod_overheat");
  doc = withTierField(doc, "Items.A", "ram", 5, 3);
  doc = withTierField(doc, "Items.B", "ram", 3, 3);
  doc = withField(doc, "name", "New", "Old");
  const text = printDoc(doc);
  const back = parseDoc(text);
  assert.deepEqual(back.tiers, { "Items.A": { ram: 5 } });
  assert.equal(back.name, "New");
  assert.equal(withField(doc, "name", "Old", "Old").name, undefined);
  assert.equal(withTierField(doc, "Items.A", "ram", undefined).tiers["Items.A"].ram, undefined);
});

test("a bad document says what is wrong", () => {
  assert.throws(() => parseDoc("{ nope"), /not valid JSON/);
  assert.throws(() => parseDoc('{"format":2,"id":"a","family":"b"}'), /format 2/);
  assert.throws(() => parseDoc('{"format":1,"id":"A B","family":"b"}'), /an id/);
  assert.throws(() => parseDoc('{"format":1,"id":"a"}'), /family/);
  assert.throws(() => parseDoc('{"format":1,"id":"a","family":"b","tiers":{"Items.X":{"ram":"lots"}}}'), /must be a number/);
});
