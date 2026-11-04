import { test } from "node:test";
import * as assert from "node:assert/strict";
import { actionFamily, parseItem } from "../src/quickhack";

test("item paths give a family and a tier", () => {
  assert.deepEqual(parseItem("Items.OverheatProgram"), { family: "Overheat", tier: { suffix: "", rank: 0 } });
  assert.deepEqual(parseItem("Items.OverheatLvl2Program"), { family: "Overheat", tier: { suffix: "Lvl2", rank: 2 } });
  assert.deepEqual(parseItem("Items.EMPOverloadLvl4PlusPlusProgram"), { family: "EMPOverload", tier: { suffix: "Lvl4PlusPlus", rank: 5 } });
  assert.deepEqual(parseItem("Items.WhistleLvl0Program"), { family: "Whistle", tier: { suffix: "Lvl0", rank: 0 } });
  assert.deepEqual(parseItem("Items.BlackWallProgramLvl3"), { family: "BlackWall", tier: { suffix: "Lvl3", rank: 3 } });
});

test("other records are not quickhack items", () => {
  assert.equal(parseItem("Items.Recipe_OverheatLvl2Program"), undefined);
  assert.equal(parseItem("Items.OverheatLvl2CraftingPackage"), undefined);
  assert.equal(parseItem("QuickHack.OverheatLvl2Hack"), undefined);
});

test("action paths fold Boss, Chimera and Spread into the family", () => {
  assert.equal(actionFamily("QuickHack.OverheatHack"), "Overheat");
  assert.equal(actionFamily("QuickHack.OverheatLvl2Hack"), "Overheat");
  assert.equal(actionFamily("QuickHack.BossOverheatLvl2Hack"), "Overheat");
  assert.equal(actionFamily("QuickHack.ChimeraOverheatLvl4PlusPlusHack"), "Overheat");
  assert.equal(actionFamily("QuickHack.OverheatLvl2HackSpread"), "Overheat");
  assert.equal(actionFamily("QuickHack.OverheatLvl2Hack_inline3"), undefined);
});
