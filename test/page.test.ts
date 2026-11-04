import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Records } from "../src/records";
import { readAction, readFamily } from "../src/read";
import { iconsOf, render } from "../src/pageHtml";
import { fetchRecord, fetchText } from "./fixture";

test("the page shows a family's tiers, numbers and effects, with game text escaped", async () => {
  const fam = await readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);
  const icons = new Map([["base\\gui\\zap.inkatlas|quickhack_zap", "https://icons/zap.png"]]);
  const html = render(fam, 1, icons);
  assert.match(html, /<main data-start="1">/);
  assert.match(html, /<h1>Zap<\/h1>/);
  assert.match(html, /Quickhack &middot; Damage Hack &middot; 2 tiers/);
  assert.match(html, /data-pick="0" data-tier="0">Common</);
  assert.match(html, /data-pick="1" data-tier="1">Uncommon</);
  assert.match(html, /23 thermal every 0.25 s/);
  assert.match(html, /<img class="icon big" src="https:\/\/icons\/zap.png"/);
  assert.match(html, /Zaps hard\./);
  assert.match(html, /Every quickhack also \(1\)/);
  assert.match(html, /data-record="QuickHack.BossZapLvl1Hack"/);
  // The spread's plumbing is said in Spread, not listed as an effect.
  assert.doesNotMatch(html, /<b>Spread Init<\/b>/);
  assert.match(html, /Spreads to nearby enemies/);
  assert.equal(iconsOf(fam).filter((i) => i.part === "quickhack_zap").length, 2);
});

test("a device hack's page has no item sections", async () => {
  const fam = await readAction(new Records(fetchRecord, fetchText), "DeviceAction.ZapCamera", "device");
  const html = render(fam, 0, new Map());
  assert.match(html, /Device hack &middot; 1 tier/);
  assert.doesNotMatch(html, /While equipped/);
  assert.doesNotMatch(html, /<figcaption>Item/);
  assert.match(html, /Comes with the cyberdeck/);
});
