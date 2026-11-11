import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { writeTweaks } from "../src/tweaks";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { newDoc, newHackDoc, parseDoc, printDoc, QuickhackDoc, safeId, withField, withTierField } from "../src/document";
import type { BridgeClient, ProjectRef } from "../src/types";
import { gameValue, renderEditor } from "../src/editorHtml";
import { isInside, mergeEntries, writeProject } from "../src/projectFiles";
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

test("the writer's output is what the editor's numbers ask for", async () => {
  const fam = await family();
  assert.equal(gameValue(fam.tiers[1], "ram"), 4);
  assert.equal(gameValue(fam.tiers[1], "upload"), 1.5);
  assert.equal(gameValue(fam.tiers[1], "damage"), 23);
  assert.equal(gameValue(fam.tiers[1], "duration"), 6);
  assert.equal(gameValue(fam.tiers[1], "bossRam"), 4);
});

test("the editor's page shows inputs with the game's values and the document's", async () => {
  const fam = await family();
  let doc = newDoc("mod", "Zap");
  doc = withTierField(doc, "Items.ZapLvl1Program", "ram", 6, 4);
  doc = { ...doc, name: "Big <Zap>" };
  const html = renderEditor(fam, doc, { all: new Map() }, 1);
  assert.match(html, /<h1 data-title>Big &lt;Zap&gt;<\/h1>/);
  assert.match(html, /data-tier-key="Items.ZapLvl1Program" data-field="ram" data-game="4" placeholder="4" value="6"/);
  assert.match(html, /data-tier-key="Items.ZapProgram" data-field="ram" data-game="3" placeholder="3" value=""/);
  assert.match(html, /data-set="cooldown" data-game="12"/);
  assert.match(html, /data-pack/);
  assert.doesNotMatch(html, /<h2>While equipped<\/h2>[\s\S]*<h2>Texts<\/h2>/);
});

test("text entries are merged into the onscreens file, keeping others'", () => {
  const json = JSON.stringify({ Data: { RootChunk: { root: { Data: { entries: [{ secondaryKey: "Someone-Else", femaleVariant: "Keep" }, { secondaryKey: "EDGEhack-mod_zap-Old", femaleVariant: "Gone" }] } } } } });
  const out = JSON.parse(mergeEntries(json, "mod_zap", [{ key: "EDGEhack-mod_zap-Name", text: "New" }]));
  assert.deepEqual(out.Data.RootChunk.root.Data.entries.map((e: { secondaryKey: string }) => e.secondaryKey), ["Someone-Else", "EDGEhack-mod_zap-Name"]);
  assert.equal(out.Data.RootChunk.root.Data.entries[1].primaryKey, "0");
  assert.throws(() => mergeEntries("{}", "x", []), /onscreens file/);
});

test("a change goes only inside the folder it is meant for", () => {
  assert.equal(isInside("E:/a/b/c.txt", "E:/a"), true);
  assert.equal(isInside("E:/ab/c.txt", "E:/a"), false);
  assert.equal(isInside("E:/a", "E:/a"), false);
});

const newOne = (fields: Partial<QuickhackDoc> = {}): QuickhackDoc => ({ ...newHackDoc("My Mod", "Zap", "Static Skull"), ...fields });
const body = (yaml: string, path: string): string => {
  const at = yaml.indexOf(`\n${path}:\n`);
  assert.ok(at >= 0, `no record ${path}`);
  const end = yaml.indexOf("\n\n", at + 1);
  return yaml.slice(at, end < 0 ? undefined : end).trimEnd();
};

test("a new quickhack gets its own item and action per tier, with its own action name and shard type", async () => {
  const { yaml, script, warnings } = writeTweaks(await family(), newOne());
  assert.deepEqual(warnings, []);
  const item = body(yaml!, "Items.EDGEhack_my_mod_static_skull_ZapLvl1Program");
  assert.match(item, /\$base: Items\.ZapLvl1Program/);
  assert.match(item, /shardType: EDGEhack_my_mod_static_skull/);
  const action = body(yaml!, "QuickHack.EDGEhack_my_mod_static_skull_ZapLvl1Program");
  assert.match(action, /\$base: QuickHack\.ZapLvl1Hack/);
  assert.match(action, /actionName: EDGEhack_my_mod_static_skull\n/);
  assert.match(script!, /StrBeginsWith\(NameToString\(record\.ActionName\(\)\), "EDGEhack"\)/);
});

test("each new item lists its own action and every lower tier's, and no Boss or Spread action", async () => {
  const { yaml } = writeTweaks(await family(), newOne());
  const base = body(yaml!, "Items.EDGEhack_my_mod_static_skull_ZapProgram");
  assert.match(base, /objectActions:\n {4}- ItemAction\.ProgramDisassemble\n {4}- QuickHack\.EDGEhack_my_mod_static_skull_ZapProgram$/);
  const top = body(yaml!, "Items.EDGEhack_my_mod_static_skull_ZapLvl1Program");
  assert.match(top, /- QuickHack\.EDGEhack_my_mod_static_skull_ZapProgram\n {4}- QuickHack\.EDGEhack_my_mod_static_skull_ZapLvl1Program$/);
  assert.doesNotMatch(yaml!, /Boss|HackSpread/);
});

test("a new quickhack has its own cooldown and no spread, and touches no game record", async () => {
  const { yaml } = writeTweaks(await family(), newOne());
  const action = body(yaml!, "QuickHack.EDGEhack_my_mod_static_skull_ZapProgram");
  assert.match(action, /startEffects:\n {4}- QuickHack\.EDGEhack_my_mod_static_skull_CooldownStart\n/);
  assert.match(action, /instigatorPrereqs:\n {4}- QuickHack\.EDGEhack_my_mod_static_skull_CooldownCheck\n/);
  assert.doesNotMatch(action, /ZapSpreadInit|ZapStartCooldown|ZapCooldownPrereq/);
  assert.match(body(yaml!, "QuickHack.EDGEhack_my_mod_static_skull_CooldownStart"), /\$base: QuickHack\.ZapStartCooldown\n {2}statusEffect: BaseStatusEffect\.EDGEhack_my_mod_static_skull_Cooldown/);
  // Every record it writes is new: nothing starts with a game record's name or uses !append.
  const heads = yaml!.split("\n").filter((l) => /^[A-Za-z]/.test(l));
  assert.ok(heads.length > 0);
  for (const h of heads) assert.match(h, /EDGEhack/, h);
  assert.doesNotMatch(yaml!, /!append/);
});

test("a new quickhack's RAM and upload join copies of the game's lists", async () => {
  const doc = withTierField(withTierField(newOne(), "Items.ZapProgram", "ram", 5, 3), "Items.ZapProgram", "upload", 1, 2);
  const action = body(writeTweaks(await family(), doc).yaml!, "QuickHack.EDGEhack_my_mod_static_skull_ZapProgram");
  assert.match(action, /costs:\n {4}- QuickHack\.ZapHack_cost\n {4}- EDGEhack\.my_mod_static_skull\.ZapProgram_Ram\n/);
  assert.match(action, /activationTime:\n {4}- QuickHack\.ZapHack_upload\n {4}- EDGEhack\.my_mod_static_skull\.ZapProgram_Upload\n/);
});

test("a new quickhack's damage and duration copy the chain, leaving the family's alone", async () => {
  let doc = withTierField(newOne(), "Items.ZapLvl1Program", "damage", 73, 23);
  doc = withTierField(doc, "Items.ZapLvl1Program", "duration", 12, 6);
  const { yaml, warnings } = writeTweaks(await family(), doc);
  assert.deepEqual(warnings, []);
  const p = "my_mod_static_skull";
  assert.match(body(yaml!, `Attacks.EDGEhack_${p}_ZapLvl1Program`), /\$base: Attacks\.ZapLvl1Hack\n {2}statModifiers:\n {4}- Attacks\.ZapBase\n {4}- Attacks\.ZapLvl1Hack_tier\n {4}- EDGEhack\.my_mod_static_skull\.ZapLvl1Program_Damage/);
  assert.match(body(yaml!, `EDGEhack.${p}.ZapLvl1Program_Effector`), /attackRecord: Attacks\.EDGEhack_my_mod_static_skull_ZapLvl1Program/);
  assert.match(body(yaml!, `EDGEhack.${p}.ZapLvl1Program_Package`), /effectors:\n {4}- EDGEhack\.my_mod_static_skull\.ZapLvl1Program_Effector/);
  const status = body(yaml!, `BaseStatusEffect.EDGEhack_${p}_ZapLvl1Program`);
  assert.match(status, /duration: EDGEhack\.my_mod_static_skull\.ZapLvl1Program_Duration/);
  assert.match(status, /packages:\n {4}- EDGEhack\.my_mod_static_skull\.ZapLvl1Program_Package/);
  const action = body(yaml!, `QuickHack.EDGEhack_${p}_ZapLvl1Program`);
  assert.match(action, /- QuickHack\.EDGEhack_my_mod_static_skull_ZapLvl1Program_Effect/);
  assert.doesNotMatch(action, /ZapLvl1Hack_effect/);
  // The tier left alone keeps the game's effect.
  assert.match(body(yaml!, `QuickHack.EDGEhack_${p}_ZapProgram`), /- QuickHack\.ZapHack_effect/);
});

test("a new quickhack's texts, icons and cooldown go in its own records", async () => {
  const { yaml, texts } = writeTweaks(await family(), newOne({ description: "Skulls.", wheelText: "Wheel words.", itemIcon: "UIIcon.quickhack_x", wheelIcon: "UIIcon.X", cooldown: 20 }));
  assert.deepEqual(texts.map((t) => t.key), ["EDGEhack-my_mod_static_skull-Name", "EDGEhack-my_mod_static_skull-Description", "EDGEhack-my_mod_static_skull-Wheel"]);
  const item = body(yaml!, "Items.EDGEhack_my_mod_static_skull_ZapProgram");
  assert.match(item, /displayName: LocKey#EDGEhack-my_mod_static_skull-Name/);
  assert.match(item, /iconPath: quickhack_x/);
  const ui = body(yaml!, "Interactions.EDGEhack_my_mod_static_skull");
  assert.match(ui, /caption: LocKey#EDGEhack-my_mod_static_skull-Name/);
  assert.match(ui, /captionIcon: ChoiceCaptionParts\.EDGEhack_my_mod_static_skullIcon/);
  assert.match(body(yaml!, "ChoiceCaptionParts.EDGEhack_my_mod_static_skullIcon"), /texturePartID: UIIcon\.X/);
  const group = body(yaml!, "EDGEhack.my_mod_static_skull.Cooldown");
  assert.match(group, /- BaseStatusEffect\.ZapCooldownDuration_inline0\n {4}- EDGEhack\.my_mod_static_skull\.CooldownMod/);
  assert.match(body(yaml!, "EDGEhack.my_mod_static_skull.CooldownMod"), /value: 8\n/);
});

test("numbers against bosses are refused on a new quickhack, in words", async () => {
  const { warnings } = writeTweaks(await family(), withTierField(newOne(), "Items.ZapProgram", "bossRam", 10));
  assert.match(warnings[0], /no Boss action/);
});

test("a new quickhack's document reads and prints as one", () => {
  const doc = parseDoc(printDoc(newHackDoc("My Mod", "Zap", "Static Skull")));
  assert.equal(doc.newHack, true);
  assert.equal(doc.id, "my_mod_static_skull");
  assert.equal(parseDoc(printDoc(newDoc("My Mod", "Zap"))).newHack, undefined);
});

test("the project gets the shared script for a new quickhack, and not for a change", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehscript"));
  const project = { dir, resources: path.join(dir, "res"), modName: "My Mod" } as unknown as ProjectRef;
  const onscreens = JSON.stringify({ Data: { RootChunk: { root: { Data: { entries: [] } } } } });
  const bridge = { locProjectFiles: async () => [{ exists: true, file: "loc.json" }], fileToJson: async () => ({ json: onscreens }), fromJson: async () => ({}) } as unknown as BridgeClient;
  const script = path.join(project.resources, "r6", "scripts", "EDGEhack", "NewQuickhacks.reds");
  const change = writeTweaks(await family(), withTierField(newDoc("My Mod", "Zap"), "Items.ZapProgram", "ram", 5, 3));
  assert.equal((await writeProject(project, bridge, newDoc("My Mod", "Zap"), change)).script, undefined);
  assert.equal(fs.existsSync(script), false);
  const made = await writeProject(project, bridge, newOne(), writeTweaks(await family(), newOne()));
  assert.equal(made.script, script);
  assert.match(fs.readFileSync(script, "utf8"), /^\/\/ Made by EDGEhack/);
  // The first write says which files it added to the project; writing again adds none.
  assert.deepEqual(made.created, [made.yaml, script]);
  assert.deepEqual((await writeProject(project, bridge, newOne(), writeTweaks(await family(), newOne()))).created, []);
  fs.rmSync(dir, { recursive: true, force: true });
});
