import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { Family, readFamily, readStatus, tierKey } from "../src/read";
import { writeTweaks } from "../src/tweaks";
import { newDoc, newHackDoc, parseDoc, printDoc, QuickhackDoc, withAddedEffect, withAddedRecipient, withAddedTier, withAddedValue, withoutAddedEffect } from "../src/document";
import { addedGameValue, addedNotes, addedWarnings, applyAddedToAll, effectKey, effectOnTier, kindOf, offeredEffects, plainName, poolOf, ResolvedAdded, resolveAdded, tierForRank, usedByQuickhacks, worthAdding } from "../src/effects";
import { renderAddedEffects, renderEditor } from "../src/editorHtml";
import { fetchRecord, fetchText, records as fixtureRecords } from "./fixture";

const reader = () => new Records(fetchRecord, fetchText);
const zap = (r = reader()) =>
  readFamily(r, "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

/** A second family to take effects from. Made here from Zap's, with tiers at other ranks. */
async function source(r = reader()): Promise<Family> {
  const f = await zap(r);
  return { ...f, key: "Fizz", name: "Fizz", tiers: [{ ...f.tiers[0], rank: 2 }, { ...f.tiers[1], rank: 4 }] };
}

async function resolved(doc: QuickhackDoc, fam: Family, r: Records): Promise<ResolvedAdded[]> {
  return resolveAdded(doc, fam, { family: async (key) => (key === "Fizz" ? source(r) : zap(r)), records: r });
}

const status = "BaseStatusEffect.ZapLvl1HackBurn";

test("a document keeps added effects as it writes them, each with an id of its own", () => {
  let doc = newHackDoc("mod", "Zap", "Static");
  doc = withAddedEffect(doc, { status });
  doc = withAddedEffect(doc, { from: "Fizz", effect: "BaseStatusEffect.ZapHackBurn" });
  assert.deepEqual(doc.effects?.map((e) => e.id), ["a1", "a2"]);
  doc = withAddedTier(doc, "a1", "Items.ZapProgram", false);
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "duration", 9, 6);
  doc = withAddedRecipient(doc, "a1", "V");
  const back = parseDoc(printDoc(doc));
  assert.deepEqual(back.effects, doc.effects);
  assert.deepEqual(back.effects?.[0], { id: "a1", status, off: ["Items.ZapProgram"], values: { "Items.ZapLvl1Program": { duration: 9 } }, on: "V" });
});

test("an id is not used again while a later one is there, and clearing leaves the document clean", () => {
  let doc = newHackDoc("mod", "Zap", "Static");
  doc = withAddedEffect(doc, { status });
  doc = withAddedEffect(doc, { status });
  doc = withoutAddedEffect(doc, "a1");
  doc = withAddedEffect(doc, { status });
  assert.deepEqual(doc.effects?.map((e) => e.id), ["a2", "a3"]);
  doc = withAddedTier(doc, "a2", "Items.ZapProgram", false);
  doc = withAddedTier(doc, "a2", "Items.ZapProgram", true);
  doc = withAddedValue(doc, "a2", "Items.ZapProgram", "duration", 9, 6);
  doc = withAddedValue(doc, "a2", "Items.ZapProgram", "duration", 6, 6);
  assert.deepEqual(doc.effects?.[0], { id: "a2", status });
  doc = withoutAddedEffect(withoutAddedEffect(doc, "a2"), "a3");
  assert.ok(!("effects" in doc));
  assert.ok(!printDoc(doc).includes("effects"));
});

test("a bad added effect says what is wrong", () => {
  const base = { format: 1, id: "x", family: "Zap", tiers: {} };
  assert.throws(() => parseDoc(JSON.stringify({ ...base, effects: [{ id: "a1" }] })), /needs a status effect/);
  assert.throws(() => parseDoc(JSON.stringify({ ...base, effects: [{ id: "A 1", status }] })), /needs an id/);
  assert.throws(() => parseDoc(JSON.stringify({ ...base, effects: [{ id: "a1", status }, { id: "a1", status }] })), /Two added effects/);
  assert.throws(() => parseDoc(JSON.stringify({ ...base, effects: [{ id: "a1", status, on: "them" }] })), /target or on V/);
  assert.throws(() => parseDoc(JSON.stringify({ ...base, effects: [{ id: "a1", status, values: { t: { duration: "long" } } }] })), /must be a number/);
});

test("a status effect is sorted by who it is for", () => {
  assert.equal(kindOf("AdamSmasher.Dot", ["Debuff"], undefined), "boss");
  assert.equal(kindOf("BaseStatusEffect.BossOverheat", ["Debuff"], undefined, true), "boss");
  assert.equal(kindOf("BaseStatusEffect.NpcSMasherMeleeAttackStun", ["Debuff"], undefined), "boss");
  assert.equal(kindOf("BaseStatusEffect.Burn", [], undefined, true), "enemy");
  assert.equal(kindOf("BaseStatusEffect.Frag", ["GrenadeStatusEffect", "Buff"], undefined), "enemy");
  assert.equal(kindOf("BaseStatusEffect.Bleeding", ["Debuff"], undefined), "enemy");
  assert.equal(kindOf("BaseStatusEffect.OverheatCooldown", ["Debuff"], "BaseStatusEffectTypes.PlayerCooldown"), "v");
  assert.equal(kindOf("Items.Inhaler", ["Buff"], undefined), "v");
  assert.equal(kindOf("BaseStatusEffect.Sprint", ["CyberwareBuff"], undefined), "v");
  assert.equal(kindOf("GameplayRestriction.NoCombat", ["Debuff"], undefined), "other");
  assert.equal(kindOf("BaseStatusEffect.BaseOverheat", ["Debuff"], undefined), "other");
  assert.equal(kindOf("BaseStatusEffect.Thing", [], undefined), "other");
});

test("the pool lists what the game's quickhacks use first, and not what every quickhack shares", () => {
  const rec = (path: string, flats: Record<string, never> | Record<string, unknown>) => ({ id: "0x0", path, type: "x", flats: flats as never });
  const used = usedByQuickhacks(
    [
      rec("QuickHack.ZapHack", { isQuickHack: true, completionEffects: ["QuickHack.E1", "QuickHack.QuickHack_inline2", "QuickHack.OnV"], startEffects: [] }),
      rec("QuickHack.BossZapHack", { isQuickHack: true, completionEffects: ["QuickHack.E2"] }),
      rec("AIQuickHack.Thing", { isQuickHack: true, completionEffects: ["QuickHack.E3"] }),
    ],
    [
      rec("QuickHack.E1", { statusEffect: "BaseStatusEffect.Used", recipient: "ObjectActionReference.Target" }),
      rec("QuickHack.E2", { statusEffect: "BaseStatusEffect.BossOnly", recipient: "ObjectActionReference.Target" }),
      rec("QuickHack.E3", { statusEffect: "BaseStatusEffect.EnemyNetrunner", recipient: "ObjectActionReference.Target" }),
      rec("QuickHack.OnV", { statusEffect: "BaseStatusEffect.OnV", recipient: "ObjectActionReference.Instigator" }),
      rec("QuickHack.QuickHack_inline2", { statusEffect: "BaseStatusEffect.WasQuickHacked", recipient: "ObjectActionReference.Target" }),
    ],
  );
  assert.deepEqual([...used], ["BaseStatusEffect.Used"]);
  const pool = poolOf(
    [
      rec("BaseStatusEffect.Zebra", { gameplayTags: ["Debuff"] }),
      rec("BaseStatusEffect.Used", { gameplayTags: [], statusEffectType: "BaseStatusEffectTypes.Burning", uiData: "UI.Used" }),
      rec("Chimera.Dot", { gameplayTags: ["Debuff"] }),
      rec("Items.Inhaler", { gameplayTags: ["Buff"] }),
    ],
    used,
    new Map([["UI.Used", "On fire"]]),
  );
  assert.deepEqual(pool.map((p) => [p.path, p.kind, p.used]), [
    ["BaseStatusEffect.Used", "enemy", true],
    ["BaseStatusEffect.Zebra", "enemy", false],
    ["Items.Inhaler", "v", false],
    ["Chimera.Dot", "boss", false],
  ]);
  assert.equal(pool[0].uiName, "On fire");
  assert.equal(pool[0].type, "Burning");
});

test("another quickhack offers its own effects only, once each, followed tier by tier", async () => {
  const f = await source();
  assert.deepEqual(worthAdding(f.tiers[0]).map((e) => e.status), ["BaseStatusEffect.ZapHackBurn"]);
  const offered = offeredEffects({ ...f, tiers: [f.tiers[0]] });
  assert.equal(offered.length, 1);
  assert.equal(offered[0].key, effectKey(offered[0].effect));
  // Below its lowest tier it gives its lowest; between tiers, the nearest below.
  assert.equal(tierForRank(f, 0)?.rank, 2);
  assert.equal(tierForRank(f, 3)?.rank, 2);
  assert.equal(tierForRank(f, 5)?.rank, 4);
});

test("a tier's name comes out of an effect's key", async () => {
  const e = { record: "QuickHack.X_inline3", status: "BaseStatusEffect.OverheatLevel2" } as never;
  assert.equal(effectKey(e), "BaseStatusEffect.Overheat");
  assert.equal(effectKey({ record: "x", status: "BaseStatusEffect.ContagionPoisonLvl4PlusPlus" } as never), "BaseStatusEffect.ContagionPoison");
  assert.equal(effectKey({ record: "QuickHack.SystemCollapseLvl4Hack_inline7" } as never), "QuickHack.SystemCollapseHack_inline7");
});

test("an effect comes from the nearest tier that has it, below first, and never by its place in a list", async () => {
  const f = await source();
  const low = worthAdding(f.tiers[0])[0];
  const high = worthAdding(f.tiers[1])[0];
  // ZapHackBurn and ZapLvl1HackBurn: the same key once the tier is out, and each tier its own record.
  assert.equal(effectKey(low), "BaseStatusEffect.ZapHackBurn");
  assert.equal(effectKey(high), "BaseStatusEffect.ZapHackBurn");
  assert.equal(effectOnTier(f, effectKey(low), 2)?.status, low.status);
  assert.equal(effectOnTier(f, effectKey(high), 4)?.status, high.status);
  assert.equal(effectOnTier(f, effectKey(high), 5)?.status, high.status, "above its top tier");
  assert.equal(effectOnTier(f, effectKey(low), 0)?.status, low.status, "below its lowest tier");
  // An effect only the top tier has reaches the lower ones; another tier's first effect is not taken for it.
  const only: Family = { ...f, tiers: [{ ...f.tiers[0], effects: [] }, f.tiers[1]] };
  assert.equal(effectOnTier(only, effectKey(high), 2)?.status, high.status);
  assert.equal(effectOnTier(f, "BaseStatusEffect.NoSuch", 2), undefined);
});

test("a tier's own cooldown, what it gives V and what is made for a boss are not offered", async () => {
  const f = await source();
  const t = f.tiers[0];
  const base = worthAdding(t)[0];
  const tier = { ...t, effects: [base, { ...base, status: "BaseStatusEffect.HelperOnV", on: "V" as const }, { ...base, status: "BaseStatusEffect.BossThing" }, { ...base, status: undefined, damage: [] }] };
  assert.deepEqual(worthAdding(tier).map((e) => e.status), [base.status]);
});

test("a record's tier number is taken out of an effect's name", () => {
  assert.equal(plainName("Memory Wipe Level 4"), "Memory Wipe");
  assert.equal(plainName("Overload Level 4Plus Plus"), "Overload");
  assert.equal(plainName("Contagion Poison Lvl 2"), "Contagion Poison");
  assert.equal(plainName("Poison"), "Poison");
});

test("an added status effect on a new quickhack: one effect record, on every tier's list", async () => {
  const r = reader();
  const fam = await zap(r);
  const doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status });
  const { yaml, warnings } = writeTweaks(fam, doc, await resolved(doc, fam, r));
  const own = "QuickHack.EDGEhack_mod_static_a1";
  assert.equal(yaml!.split(`\n${own}:\n`).length - 1, 1, "one record");
  assert.match(yaml!, new RegExp(`${own.replace(/\./g, "\\.")}:\\n {2}\\$type: ObjectActionEffect\\n {2}recipient: ObjectActionReference\\.Target\\n {2}statusEffect: ${status.replace(/\./g, "\\.")}`));
  for (const tier of ["ZapProgram", "ZapLvl1Program"]) {
    const action = yaml!.split(`QuickHack.EDGEhack_mod_static_${tier}:\n`)[1].split("\n\n")[0];
    assert.match(action, new RegExp(`completionEffects:[^]*- ${own.replace(/\./g, "\\.")}`), tier);
  }
  assert.deepEqual(warnings.filter((w) => /status|look/.test(w)), []);
});

test("V's own goes on V", async () => {
  const r = reader();
  const fam = await zap(r);
  const doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status, on: "V" });
  const { yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r));
  assert.match(yaml!, /recipient: ObjectActionReference\.Instigator\n {2}statusEffect: BaseStatusEffect\.ZapLvl1HackBurn/);
});

test("a tier it is left off does not get it", async () => {
  const r = reader();
  const fam = await zap(r);
  const doc = withAddedTier(withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status }), "a1", "Items.ZapProgram", false);
  const { yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r));
  const low = yaml!.split("QuickHack.EDGEhack_mod_static_ZapProgram:\n")[1].split("\n\n")[0];
  const high = yaml!.split("QuickHack.EDGEhack_mod_static_ZapLvl1Program:\n")[1].split("\n\n")[0];
  assert.ok(!low.includes("static_a1"));
  assert.ok(high.includes("static_a1"));
});

test("another quickhack's effect is referenced, and each tier takes that quickhack's tier", async () => {
  const r = reader();
  const fam = await zap(r);
  const src = await source(r);
  const key = effectKey(worthAdding(src.tiers[0])[0]);
  const doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { from: "Fizz", effect: key });
  const added = await resolved(doc, fam, r);
  // Fizz's lowest is at rank 2, so both of Zap's tiers take it.
  assert.deepEqual([...added[0].byTier.values()].map((e) => e.status), ["BaseStatusEffect.ZapHackBurn", "BaseStatusEffect.ZapHackBurn"]);
  assert.equal(added[0].sourceName, "Fizz");
  const { yaml } = writeTweaks(fam, doc, added);
  assert.match(yaml!.split("QuickHack.EDGEhack_mod_static_ZapLvl1Program:\n")[1].split("\n\n")[0], /- QuickHack\.ZapHack_effect/);
  assert.ok(!/QuickHack\.EDGEhack_mod_static_a1/.test(yaml!), "no record of its own while unchanged");
});

test("a changed number makes a copy on that tier only, with the chain, and leaves the game's alone", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status });
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "duration", 10, 6);
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "stacks", 5, 2);
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "damage", 40, 23);
  const { yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r));
  const label = "a1_ZapLvl1Program";
  assert.match(yaml!, new RegExp(`EDGEhack\\.mod_static\\.${label}_DurationMod:\\n {2}\\$type: ConstantStatModifier\\n {2}value: 4\\n`));
  assert.match(yaml!, new RegExp(`EDGEhack\\.mod_static\\.${label}_StacksMod:\\n {2}\\$type: ConstantStatModifier\\n {2}value: 3\\n {2}modifierType: Additive\\n {2}statType: BaseStats\\.MaxStacks`));
  assert.match(yaml!, new RegExp(`EDGEhack\\.mod_static\\.${label}_Stacks:[^]*- BaseStatusEffect\\.ZapStacks_inline0\\n {4}- EDGEhack\\.mod_static\\.${label}_StacksMod`));
  assert.match(yaml!, new RegExp(`Attacks\\.EDGEhack_mod_static_${label}:\\n {2}\\$base: Attacks\\.ZapLvl1Hack`));
  const copy = yaml!.split(`BaseStatusEffect.EDGEhack_mod_static_${label}:\n`)[1].split("\n\n")[0];
  assert.match(copy, /\$base: BaseStatusEffect\.ZapLvl1HackBurn/);
  assert.match(copy, /duration: EDGEhack\.mod_static\.a1_ZapLvl1Program_Duration/);
  assert.match(copy, /maxStacks: EDGEhack\.mod_static\.a1_ZapLvl1Program_Stacks/);
  assert.match(copy, /packages:\n {4}- EDGEhack\.mod_static\.a1_ZapLvl1Program_Package/);
  // The top tier uses its copy; the lower one the plain record.
  const high = yaml!.split("QuickHack.EDGEhack_mod_static_ZapLvl1Program:\n")[1].split("\n\n")[0];
  const low = yaml!.split("QuickHack.EDGEhack_mod_static_ZapProgram:\n")[1].split("\n\n")[0];
  assert.match(high, /- QuickHack\.EDGEhack_mod_static_a1_ZapLvl1Program_Effect$/);
  assert.match(low, /- QuickHack\.EDGEhack_mod_static_a1$/);
  // No game record is changed.
  assert.ok(!/^(Items\.Zap|QuickHack\.Zap|BaseStatusEffect\.Zap|Attacks\.Zap)[^\n]*\.\w+:/m.test(yaml!));
});

test("a change to a game family appends, on one key per list, to its Boss action too", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = newDoc("mod", "Zap");
  doc = withAddedEffect(doc, { status });
  doc = withAddedEffect(doc, { status: "BaseStatusEffect.ZapHackBurn" });
  const { yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r));
  for (const action of ["QuickHack.ZapHack", "QuickHack.ZapLvl1Hack", "QuickHack.BossZapHack", "QuickHack.BossZapLvl1Hack"]) {
    const key = `${action}.completionEffects:\n`;
    assert.equal(yaml!.split(key).length - 1, 1, `${action} has one key`);
    assert.match(yaml!.split(key)[1], /^ {2}- !append QuickHack\.EDGEhack_mod_zap_a1\n {2}- !append QuickHack\.EDGEhack_mod_zap_a2\n/, action);
  }
});

test("a record that is gone says so, and the rest is written", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status: "BaseStatusEffect.NotInTheGame" });
  doc = withAddedEffect(doc, { from: "Gone", effect: "x" });
  const ctx = { family: async () => { throw new Error("no"); }, records: r };
  const added = await resolveAdded(doc, fam, ctx);
  const { warnings, yaml } = writeTweaks(fam, doc, added);
  assert.ok(warnings.some((w) => /NotInTheGame is not in this game/.test(w)), warnings.join());
  assert.ok(warnings.some((w) => /Gone's/.test(w)), warnings.join());
  assert.ok(yaml);
  assert.ok(!/static_a1|static_a2/.test(yaml!));
});

test("the warnings: a repeat, V's own or a boss's on a target, kinds of NPC, no duration, two of a type", async () => {
  const r = reader();
  const fam = await zap(r);
  // Zap's own tier has this status already: on that tier it is there twice.
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status: "BaseStatusEffect.ZapHackBurn" });
  let w = addedWarnings(fam, doc, await resolved(doc, fam, r));
  assert.ok(w.some((x) => /is on a tier twice/.test(x)), w.join());

  const effect = (over: object) => ({ record: "", on: "target", when: "upload", tags: [], damage: [], stats: [], shared: false, cooldown: false, spread: false, duration: { base: 5, scaledBy: [] }, ...over }) as never;
  const mk = (entry: object, e: never): ResolvedAdded => ({ entry: { id: "a1", ...entry }, name: "Thing", byTier: new Map(fam.tiers.map((t) => [tierKey(t), e])) });
  doc = newHackDoc("mod", "Zap", "Static");
  w = addedWarnings(fam, doc, [mk({ status: "BaseStatusEffect.PlayerSpeed" }, effect({ status: "BaseStatusEffect.PlayerSpeed", tags: ["Buff"] }))]);
  assert.ok(w.some((x) => /one of V's own/.test(x)), w.join());
  w = addedWarnings(fam, doc, [mk({ status: "BaseStatusEffect.PlayerSpeed", on: "V" }, effect({ status: "BaseStatusEffect.PlayerSpeed", tags: ["Buff"], on: "V" }))]);
  assert.ok(!w.some((x) => /one of V's own/.test(x)), "not when it goes on V");
  w = addedWarnings(fam, doc, [mk({ status: "AdamSmasher.Dot" }, effect({ status: "AdamSmasher.Dot" }))]);
  assert.ok(w.some((x) => /boss fight/.test(x)), w.join());
  // Who acts an effect out needs no message: the effect itself ran on a drone in H3.4's test.
  const humanOnly = [mk({ status: "BaseStatusEffect.X" }, effect({ status: "BaseStatusEffect.X", npcTypes: ["Human"] }))];
  assert.equal(addedNotes(fam, humanOnly).length, 0);
  assert.ok(!addedWarnings(fam, doc, humanOnly).some((x) => /Human/.test(x)));
  w = addedWarnings(fam, doc, [mk({ status: "BaseStatusEffect.X" }, effect({ status: "BaseStatusEffect.X", duration: undefined }))]);
  assert.ok(w.some((x) => /no duration of its own/.test(x)), w.join());
  // Two burns ran side by side in the game, so Burning says nothing; another type is unverified.
  const two = [mk({ status: "BaseStatusEffect.A" }, effect({ status: "BaseStatusEffect.A", type: "Blind" })), { ...mk({ status: "BaseStatusEffect.B" }, effect({ status: "BaseStatusEffect.B", type: "Blind" })), entry: { id: "a2", status: "BaseStatusEffect.B" } }];
  w = addedWarnings(fam, doc, two);
  assert.ok(w.some((x) => /Two Blind effects/.test(x)), w.join());
  const burns = [mk({ status: "BaseStatusEffect.A" }, effect({ status: "BaseStatusEffect.A", type: "Burning" })), { ...mk({ status: "BaseStatusEffect.B" }, effect({ status: "BaseStatusEffect.B", type: "Burning" })), entry: { id: "a2", status: "BaseStatusEffect.B" } }];
  assert.ok(!addedWarnings(fam, doc, burns).some((x) => /Two Burning/.test(x)));
  // A burn beside Contagion's poison: the game's Contagion Epic passive detonates and removes it.
  const combo = [burns[0], { ...mk({ status: "BaseStatusEffect.P" }, effect({ status: "BaseStatusEffect.P", type: "Poisoned", tags: ["Poison", "ContagionPoison"] })), entry: { id: "a2", status: "BaseStatusEffect.P" } }];
  assert.ok(addedNotes(fam, combo).some((x) => /ends the poison at its first hit/.test(x)));
  assert.ok(!addedWarnings(fam, doc, combo).some((x) => /ends the poison/.test(x)), "a note, not a warning");
  const plainPoison = [burns[0], { ...combo[1], byTier: new Map(fam.tiers.map((t) => [tierKey(t), effect({ status: "BaseStatusEffect.P", type: "Poisoned", tags: ["Poison"] })])) }];
  assert.ok(!addedNotes(fam, plainPoison).length, "only Contagion's poison");
  const onV = [burns[0], { ...combo[1], byTier: new Map(fam.tiers.map((t) => [tierKey(t), effect({ status: "BaseStatusEffect.P", type: "Poisoned", tags: ["ContagionPoison"], on: "V" })])) }];
  assert.ok(!addedNotes(fam, onV).length, "not when the poison goes on V");
});

test("an effect run by a game effector keeps its numbers, and says so if a document sets one", async () => {
  const r = reader();
  const fam = await zap(r);
  const run = { ...(await readStatus(r, status))!, effector: "Apply Status Effect", record: "QuickHack.X" };
  assert.equal(addedGameValue(run, "duration"), undefined);
  const key = tierKey(fam.tiers[0]);
  const doc = newHackDoc("mod", "Zap", "Static");
  const added: ResolvedAdded[] = [{ entry: { id: "a1", from: "Fizz", effect: "x", values: { [key]: { duration: 3 } } }, name: "Run", byTier: new Map([[key, run]]) }];
  const { warnings, yaml } = writeTweaks(fam, { ...doc, effects: [added[0].entry] }, added);
  assert.ok(warnings.some((w) => /duration cannot be changed/.test(w)), warnings.join());
  assert.ok(!/a1_ZapProgram/.test(yaml!), "no copy is made");
});

test("All tiers gives each tier the same difference, from its own value", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status });
  doc = withAddedValue(doc, "a1", "Items.ZapProgram", "damage", 30, 23);
  doc = applyAddedToAll(doc, await resolved(doc, fam, r), "a1", "Items.ZapProgram", "damage");
  // One status on both tiers here, so both get the value; the tier given it stays.
  assert.deepEqual(doc.effects?.[0].values, { "Items.ZapProgram": { damage: 30 }, "Items.ZapLvl1Program": { damage: 30 } });
});

test("the page shows an added effect's card, with its tiers and which record it uses", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status });
  let html = renderAddedEffects(fam, await resolved(doc, fam, r), new Map());
  assert.match(html, /data-added-card="a1"/);
  assert.match(html, /Uses the game&#39;s record\./);
  assert.match(html, /data-added-on="a1" data-added-tier="Items\.ZapProgram" checked/);
  assert.match(html, /data-added="a1" data-added-tier="Items\.ZapLvl1Program" data-added-field="duration" data-game="6"/);
  assert.match(html, /data-added-field="stacks"/);
  assert.match(html, /data-added-field="damage"/);
  assert.match(html, /data-added-who="a1"/);
  doc = withAddedValue(doc, "a1", "Items.ZapProgram", "duration", 9, 6);
  doc = withAddedTier(doc, "a1", "Items.ZapLvl1Program", false);
  html = renderAddedEffects(fam, await resolved(doc, fam, r), new Map());
  assert.match(html, /A copy of its own on Common; the game&#39;s record elsewhere\./);
  assert.match(html, /data-added-on="a1" data-added-tier="Items\.ZapLvl1Program">/);
  const page = renderEditor(fam, doc, { all: new Map() }, 0, await resolved(doc, fam, r));
  assert.match(page, /data-add-effect/);
  assert.match(page, /data-effects/);
  assert.match(page, /data-key="Items\.ZapProgram"/);
});

test("a poison or bleed is always a copy, whose damage effector carries the check that keeps it off machines", async () => {
  const r = reader();
  const fam = await zap(r);
  let doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status: "BaseStatusEffect.ZapPoison" });
  let added = await resolved(doc, fam, r);
  let { yaml, warnings } = writeTweaks(fam, doc, added);
  // One check, our own record.
  assert.equal(yaml!.split("\nEDGEhack.mod_static.NotMachine:\n").length - 1, 1);
  assert.match(yaml!, /EDGEhack\.mod_static\.NotMachine:\n {2}\$type: StatPrereq\n {2}prereqClassName: StatPrereq\n {2}statType: IsMechanical\n {2}comparisonType: LessOrEqual\n {2}objectToCheck: Owner\n {2}valueToCheck: 0\n/);
  for (const tier of ["ZapProgram", "ZapLvl1Program"]) {
    const label = `a1_${tier}`;
    const effector = yaml!.split(`EDGEhack.mod_static.${label}_Effector:\n`)[1].split("\n\n")[0];
    assert.match(effector, /\$base: BaseStatusEffect\.ZapPoison_dot/);
    assert.match(effector, /prereqRecord: EDGEhack\.mod_static\.NotMachine/);
    assert.ok(!/attackRecord/.test(effector), "the game's attack while its damage is unchanged");
    assert.match(yaml!, new RegExp(`EDGEhack\\.mod_static\\.${label}_Package:\\n {2}\\$base: BaseStatusEffect\\.ZapPoison_pkg\\n {2}effectors:\\n {4}- EDGEhack\\.mod_static\\.${label}_Effector`));
    const status = yaml!.split(`BaseStatusEffect.EDGEhack_mod_static_${label}:\n`)[1].split("\n\n")[0];
    assert.match(status, /\$base: BaseStatusEffect\.ZapPoison\n {2}packages:\n {4}- EDGEhack\.mod_static\.a1_\w+_Package/);
    const action = yaml!.split(`QuickHack.EDGEhack_mod_static_${tier}:\n`)[1].split("\n\n")[0];
    assert.match(action, new RegExp(`- QuickHack\\.EDGEhack_mod_static_${label}_Effect$`), tier);
  }
  assert.ok(!/^(BaseStatusEffect\.Zap|Attacks\.Zap)[^\n]*\.\w+:/m.test(yaml!), "no game record is changed");
  assert.deepEqual(warnings.filter((w) => /machines/.test(w)), []);
  assert.ok(addedNotes(fam, added).some((n) => /keeps their damage off machines/.test(n)));
  assert.match(renderAddedEffects(fam, added, new Map()), /A copy of its own on each tier, which keeps its damage off machines\./);

  // A changed damage: the same effector copy points at the changed attack too.
  doc = withAddedValue(doc, "a1", "Items.ZapLvl1Program", "damage", 10, 4);
  ({ yaml } = writeTweaks(fam, doc, await resolved(doc, fam, r)));
  const effector = yaml!.split("EDGEhack.mod_static.a1_ZapLvl1Program_Effector:\n")[1].split("\n\n")[0];
  assert.match(effector, /attackRecord: Attacks\.EDGEhack_mod_static_a1_ZapLvl1Program\n {2}prereqRecord: EDGEhack\.mod_static\.NotMachine/);

  // Beside the hack's own burn: the poison is a copy, so the note says it ends without the explosion.
  added = await resolved(doc, fam, r);
  const notes = addedNotes(fam, added);
  assert.ok(notes.some((n) => /EDGEhack's copy, so it ends without the explosion/.test(n)), notes.join());
  assert.ok(!notes.some((n) => /explode as they go/.test(n)));

  // A burn is not kept off machines: no check, no note.
  doc = withAddedEffect(newHackDoc("mod", "Zap", "Static"), { status });
  added = await resolved(doc, fam, r);
  assert.ok(!/NotMachine/.test(writeTweaks(fam, doc, added).yaml!));
  assert.ok(!addedNotes(fam, added).some((n) => /machines/.test(n)));
});

test("a poison EDGEhack cannot keep off machines says so", async () => {
  const fam = await zap();
  const doc = newHackDoc("mod", "Zap", "Static");
  const hurts = [{ type: "Chemical", perHit: 1, every: 0.25, scaledBy: [], record: "Attacks.P" }];
  const poison = { record: "QuickHack.X", on: "target", when: "upload", tags: [], damage: hurts, stats: [], shared: false, cooldown: false, spread: false, status: "BaseStatusEffect.P", type: "Poisoned", effector: "Apply Status Effect", duration: { base: 5, scaledBy: [] } } as never;
  const added: ResolvedAdded[] = [{ entry: { id: "a1", status: "BaseStatusEffect.P" }, name: "Poison", byTier: new Map(fam.tiers.map((t) => [tierKey(t), poison])) }];
  assert.ok(addedWarnings(fam, doc, added).some((w) => /could not keep its damage off machines/.test(w)));
  assert.ok(!addedNotes(fam, added).some((n) => /keeps their damage off machines/.test(n)));
  // One with no damage has nothing to keep off: no warning.
  const harmless = { ...(poison as object), damage: [] } as never;
  const quiet: ResolvedAdded[] = [{ ...added[0], byTier: new Map(fam.tiers.map((t) => [tierKey(t), harmless])) }];
  assert.ok(!addedWarnings(fam, doc, quiet).some((w) => /machines/.test(w)));
});

test("the page says there are none yet", async () => {
  assert.match(renderAddedEffects(await zap(), [], new Map()), /None yet/);
});

test("the fixture's status effects sort as enemy effects", () => {
  const rows = fixtureRecords("StatusEffect", ["gameplayTags", "statusEffectType", "uiData"]);
  const pool = poolOf(rows, new Set(), new Map());
  assert.equal(pool.find((p) => p.path === "BaseStatusEffect.ZapHackBurn")?.kind, "enemy");
  assert.equal(pool.find((p) => p.path === "BaseStatusEffect.ZapCooldown")?.kind, "v");
});
