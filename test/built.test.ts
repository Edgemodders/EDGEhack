// H3.5: effects EDGEhack builds (damage over time, a stat change, a chance to apply), read and written.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { Family, readFamily } from "../src/read";
import { writeTweaks } from "../src/tweaks";
import { newDoc, newHackDoc, parseDoc, printDoc, QuickhackDoc, withAddedBuild, withAddedEffect, withAddedValue } from "../src/document";
import { addedNotes, addedWarnings, applyAddedToAll, builtDefault, ResolvedAdded, resolveAdded } from "../src/effects";
import { renderAddedEffects, renderEditor } from "../src/editorHtml";
import { fetchRecord, fetchText } from "./fixture";

const reader = () => new Records(fetchRecord, fetchText);
const zap = (r = reader()) =>
  readFamily(r, "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);
const resolved = (doc: QuickhackDoc, fam: Family, r: Records): Promise<ResolvedAdded[]> => resolveAdded(doc, fam, { family: async () => zap(r), records: r });
const block = (yaml: string, path: string): string => yaml.split(`\n${path}:\n`)[1].split("\n\n")[0];

test("a built effect is kept in the document, and a bad one says what is wrong", () => {
  let doc = withAddedEffect(newDoc("mod", "Zap"), { build: { kind: "damage", damageType: "Electric", sparks: true } });
  doc = withAddedEffect(doc, { build: { kind: "stat", stat: "speed" } });
  doc = withAddedEffect(doc, { build: { kind: "chance", applies: "BaseStatusEffect.ZapPoison" } });
  assert.deepEqual(parseDoc(printDoc(doc)).effects, doc.effects);
  const bad = (build: unknown): string => {
    try {
      parseDoc(JSON.stringify({ format: 1, id: "x", family: "Zap", tiers: {}, effects: [{ id: "a1", build }] }));
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  };
  assert.match(bad({ kind: "laser" }), /builds a damage over time, a stat change or a chance/);
  assert.match(bad({ kind: "damage", damageType: "Sonic" }), /damage type is one of Electric, Thermal, Chemical, Physical/);
  assert.match(bad({ kind: "stat" }), /needs the stat it changes/);
  assert.match(bad({ kind: "chance" }), /needs the status effect its roll applies/);
});

test("a damage over time is a status effect of its own on each tier, with Overheat's attack changed", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { build: { kind: "damage", damageType: "Electric", sparks: true } });
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "damage", 12, 10);
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "every", 0.25, 0.5);
  const added = await resolved(doc, fam, r);
  const { yaml, warnings } = writeTweaks(fam, doc, added);
  const L = "a1_ZapLvl1Program";
  assert.match(block(yaml!, `Attacks.EDGEhack_mod_static_${L}`), /^ {2}\$base: Attacks\.OverheatQuickHackAttackLevel3\n {2}attackTag: EDGEhack\n {2}damageType: DamageTypes\.Electric\n {2}hitFlags:\n {4}- QuickHack\n {4}- DamageOverTime\n {2}statModifiers:\n {4}- EDGEhack\.mod_static\.a1_ZapLvl1Program_Damage$/);
  assert.match(block(yaml!, `EDGEhack.mod_static.${L}_Damage`), /value: 12\n {2}modifierType: Additive\n {2}statType: BaseStats\.ElectricDamage/);
  const tick = block(yaml!, `EDGEhack.mod_static.${L}_Tick`);
  assert.match(tick, /\$type: ContinuousAttackEffector\n {2}effectorClassName: TriggerContinuousAttackEffector\n {2}attackRecord: Attacks\.EDGEhack_mod_static_a1_ZapLvl1Program\n {2}delayTime: 0\.25\n {2}timeDilationDriver: Effectors\.TDD_World\n {2}prereqRecord: Prereqs\.AlwaysTruePrereq/);
  const status = block(yaml!, `BaseStatusEffect.EDGEhack_mod_static_${L}`);
  assert.match(status, /\$type: StatusEffect\n {2}statusEffectType: BaseStatusEffectTypes\.Misc/);
  assert.match(status, /duration: EDGEhack\.mod_static\.a1_ZapLvl1Program_Duration\n {2}maxStacks: EDGEhack\.mod_static\.OneStack\n/);
  assert.match(status, /uiData: EDGEhack\.mod_static\.a1_ZapLvl1Program_UI\n {2}VFX:\n {4}- EDGEhack\.mod_static\.Sparks\n/);
  assert.match(block(yaml!, "EDGEhack.mod_static.Sparks"), /\$type: StatusEffectFX\n {2}name: status_electrocuted\n {2}shouldReapply: false/);
  assert.equal(yaml!.split("\nEDGEhack.mod_static.Sparks:\n").length - 1, 1, "one sparks record");
  assert.equal(yaml!.split("\nEDGEhack.mod_static.OneStack:\n").length - 1, 1, "one stacks group");
  assert.match(block(yaml!, `EDGEhack.mod_static.${L}_UI`), /displayName: "Electric damage over time"\n {2}description: ""\n {2}fluffText: ""\n {2}iconPath: electricuted/);
  // The lower tier keeps the defaults: 10 a hit, every 0.5 s, for 8 s.
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Damage"), /value: 10\n/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Tick"), /delayTime: 0\.5\n/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_DurationMod"), /value: 8\n {2}modifierType: Additive\n {2}statType: BaseStats\.MaxDuration/);
  assert.match(block(yaml!, "QuickHack.EDGEhack_mod_static_ZapLvl1Program"), /- QuickHack\.EDGEhack_mod_static_a1_ZapLvl1Program_Effect$/);
  assert.match(block(yaml!, `QuickHack.EDGEhack_mod_static_${L}_Effect`), /recipient: ObjectActionReference\.Target\n {2}statusEffect: BaseStatusEffect\.EDGEhack_mod_static_a1_ZapLvl1Program/);
  assert.ok(!/NotMachine/.test(yaml!), "electric hits machines");
  assert.deepEqual(warnings, []);
  assert.deepEqual(addedNotes(fam, added), []);
});

test("chemical and physical damage stay off machines, with the note; sparks only on electric", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newDoc("mod", "Zap"), { build: { kind: "damage", damageType: "Electric", sparks: true } });
  doc = withAddedBuild(doc, "a1", { damageType: "Chemical" });
  const added = await resolved(doc, fam, r);
  const { yaml } = writeTweaks(fam, doc, added);
  assert.match(block(yaml!, "EDGEhack.mod_zap.a1_ZapProgram_Tick"), /prereqRecord: EDGEhack\.mod_zap\.NotMachine/);
  assert.match(yaml!, /damageType: DamageTypes\.Chemical/);
  assert.match(yaml!, /iconPath: poisoned/);
  assert.ok(!/Sparks/.test(yaml!), "no sparks on chemical damage");
  assert.ok(addedNotes(fam, added).some((n) => /keeps their damage off machines/.test(n)));
  assert.match(renderAddedEffects(fam, added, new Map()), /Its damage stays off machines/);
  // On a game family, it goes on the family's actions.
  assert.match(yaml!, /QuickHack\.ZapHack\.completionEffects:\n {2}- !append QuickHack\.EDGEhack_mod_zap_a1_ZapProgram_Effect/);
});

test("a stat change puts its stats in the package; a switch has no value; a new stat clears the old values", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { build: { kind: "stat", stat: "fireRate" } });
  doc = withAddedValue(doc, "a1", "Items.ZapProgram", "value", 2, 1.5);
  let { yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r));
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Package"), /\$type: GameplayLogicPackage\n {2}stats:\n {4}- EDGEhack\.mod_static\.a1_ZapProgram_Stat1\n {4}- EDGEhack\.mod_static\.a1_ZapProgram_Stat2/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Stat1"), /value: 2\n {2}modifierType: Multiplier\n {2}statType: BaseStats\.CycleTime$/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Stat2"), /statType: BaseStats\.CycleTime_Burst/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapLvl1Program_Stat1"), /value: 1\.5\n/);
  assert.match(block(yaml!, "BaseStatusEffect.EDGEhack_mod_static_a1_ZapProgram"), /gameplayTags: \[ Debuff, Quickhack \]/);
  assert.match(yaml!, /iconPath: decreased_stats_icon/);

  doc = withAddedBuild(doc, "a1", { stat: "canSprint" });
  assert.equal(doc.effects![0].values, undefined, "the old stat's value is gone");
  ({ yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r)));
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Stat"), /value: 0\n {2}modifierType: Multiplier\n {2}statType: BaseStats\.CanSprint/);
  const page = renderAddedEffects(fam, await resolved(doc, fam, r), new Map());
  assert.ok(!/data-added-field="value"/.test(page), "a switch has no value row");
  assert.match(page, /data-added-field="duration"/);

  // A lowered armor is negative, and All tiers gives every tier the same value.
  doc = withAddedBuild(doc, "a1", { stat: "armor" });
  doc = withAddedValue(doc, "a1", "Items.ZapProgram", "value", -50, builtDefault({ kind: "stat", stat: "armor" }, "value"));
  doc = applyAddedToAll(doc, await resolved(doc, fam, r), "a1", "Items.ZapProgram", "value");
  assert.equal(doc.effects![0].values!["Items.ZapLvl1Program"].value, -50);
});

test("a chance is a carrier with the game's chance prereq and the plain apply part", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { build: { kind: "chance", applies: "BaseStatusEffect.ZapLvl1HackBurn" } });
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "chance", 60, 25);
  const added = await resolved(doc, fam, r);
  const { yaml, warnings } = writeTweaks(fam, doc, added);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapLvl1Program_Chance"), /^ {2}\$base: Prereqs\.SetChancePrereq\n {2}setChance: 0\.6$/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Chance"), /setChance: 0\.25$/);
  const apply = block(yaml!, "EDGEhack.mod_static.a1_ZapLvl1Program_Apply");
  assert.match(apply, /\$type: ApplyStatusEffectEffector\n {2}effectorClassName: ApplyStatusEffectEffector\n {2}applicationTarget: None\n/);
  assert.match(apply, /removeWithEffector: false\n/);
  assert.match(apply, /statusEffect: BaseStatusEffect\.ZapLvl1HackBurn\n {2}prereqRecord: EDGEhack\.mod_static\.a1_ZapLvl1Program_Chance/);
  const carrier = block(yaml!, "BaseStatusEffect.EDGEhack_mod_static_a1_ZapLvl1Program");
  assert.match(carrier, /duration: EDGEhack\.mod_static\.CarrierDuration\n/);
  assert.ok(!/uiData/.test(carrier), "the carrier has no icon");
  assert.equal(yaml!.split("\nEDGEhack.mod_static.CarrierDuration:\n").length - 1, 1, "one carrier duration");
  assert.match(block(yaml!, "EDGEhack.mod_static.CarrierDurationMod"), /value: 1\n/);
  assert.ok(!/ApplyStatusEffectByChanceEffector/.test(yaml!), "not the game's chance part, which never rolls here");
  // Zap's higher tier has this burn already, so the chance may add a second stack.
  assert.deepEqual(warnings, ["Chance to apply Zapped is on a tier twice. One upload may count as two stacks, or as one (unverified)."]);
  assert.match(renderAddedEffects(fam, added, new Map()), /Chance to apply/);
});

test("a chance that applies a poison applies EDGEhack's copy, kept off machines", async () => {
  const r = reader();
  const fam = await zap(r);
  const doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { build: { kind: "chance", applies: "BaseStatusEffect.ZapPoison" } });
  const added = await resolved(doc, fam, r);
  const { yaml } = writeTweaks(fam, doc, added);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Apply"), /statusEffect: BaseStatusEffect\.EDGEhack_mod_static_a1_ZapProgram_Applied\n/);
  assert.match(block(yaml!, "BaseStatusEffect.EDGEhack_mod_static_a1_ZapProgram_Applied"), /\$base: BaseStatusEffect\.ZapPoison/);
  assert.match(block(yaml!, "EDGEhack.mod_static.a1_ZapProgram_Applied_Effector"), /prereqRecord: EDGEhack\.mod_static\.NotMachine/);
  assert.ok(addedNotes(fam, added).some((n) => /keeps their damage off machines/.test(n)));
});

test("a chance on a status effect that is gone says so, and the rest is written", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { build: { kind: "chance", applies: "BaseStatusEffect.Gone" } });
  doc = withAddedEffect(doc, { build: { kind: "stat", stat: "speed" } });
  const added = await resolved(doc, fam, r);
  const { yaml, warnings } = writeTweaks(fam, doc, added);
  assert.ok(warnings.some((w) => /BaseStatusEffect\.Gone is not in this game/.test(w)), warnings.join());
  assert.match(yaml!, /statType: BaseStats\.MaxSpeed/);
  assert.ok(!/a1_ZapProgram_Chance/.test(yaml!));
  assert.deepEqual(addedWarnings(fam, doc, added).filter((w) => !/Gone/.test(w)), []);
});

test("the page has the Build one tab, and a built card shows its choices and numbers", async () => {
  const r = reader();
  const fam = await zap(r);
  const doc = withAddedEffect(newDoc("mod", "Zap"), { build: { kind: "damage", damageType: "Electric" } });
  const added = await resolved(doc, fam, r);
  const page = renderEditor(fam, doc, { all: new Map() }, 0, added);
  assert.match(page, /data-effect-tab="build">Build one</);
  assert.match(page, /data-add-built="damage"/);
  assert.match(page, /data-add-built="stat"/);
  assert.match(page, /data-chance-mode/);
  const card = renderAddedEffects(fam, added, new Map());
  assert.match(card, /data-build-field="damageType"/);
  assert.match(card, /data-build-field="sparks"/);
  for (const f of ["damage", "every", "duration"]) assert.match(card, new RegExp(`data-added-field="${f}"`));
  assert.match(card, /placeholder="10"/);
  assert.match(card, /Built by EDGEhack/);
});
