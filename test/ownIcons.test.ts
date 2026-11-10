// H3b.2: a quickhack's own icons: the document's field, the mod's texture and atlas, and the records.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Records } from "../src/records";
import { readFamily } from "../src/read";
import { writeTweaks } from "../src/tweaks";
import { newDoc, newHackDoc, parseDoc, printDoc, withOwnIcon } from "../src/document";
import { ATLAS_SIZE, atlasImage, atlasJson, copyOwnIcons, iconFile, IconWriter, LOOKS, UI_TEXTURE, writeOwnIcons } from "../src/ownIcons";
import { decodePng, encodePng, Image } from "../src/png";
import { fetchRecord, fetchText } from "./fixture";

const zap = () =>
  readFamily(new Records(fetchRecord, fetchText), "Zap", [
    { path: "Items.ZapProgram", rank: 0 },
    { path: "Items.ZapLvl1Program", rank: 1 },
  ]);

const solid = (width: number, height: number, rgba: [number, number, number, number]): Image => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
};
const pixel = (img: Image, x: number, y: number): number[] => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "edgehack-icons-"));

test("own icons are kept in the document, and a wrong look is refused", () => {
  let doc = withOwnIcon(newDoc("mod", "Zap"), "item", true);
  doc = withOwnIcon(doc, "status", true);
  assert.deepEqual(parseDoc(printDoc(doc)).ownIcons, { item: true, status: true });
  assert.equal(withOwnIcon(withOwnIcon(doc, "item", false), "status", false).ownIcons, undefined);
  assert.throws(() => parseDoc(JSON.stringify({ format: 1, id: "x", family: "Zap", tiers: {}, ownIcons: { badge: true } })), /no look "badge"/);
});

test("the texture puts each look at its place, and the atlas names its parts", () => {
  const img = atlasImage({ item: solid(99, 128, [255, 0, 0, 255]), status: solid(64, 64, [0, 0, 255, 200]) });
  assert.equal(img.width, ATLAS_SIZE);
  assert.deepEqual(pixel(img, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(pixel(img, 98, 127), [255, 0, 0, 255]);
  assert.deepEqual(pixel(img, 99, 0), [0, 0, 0, 0]);
  assert.deepEqual(pixel(img, LOOKS.wheel.x, 0), [0, 0, 0, 0], "no wheel given: left empty");
  assert.deepEqual(pixel(img, LOOKS.status.x + 63, 63), [0, 0, 255, 200]);

  const j = JSON.parse(atlasJson("mod_zap", ["item", "status"]));
  const slots = j.Data.RootChunk.slots.Elements;
  assert.equal(slots[0].texture.DepotPath.$value, "edgehack\\icons\\mod_zap.xbm");
  assert.equal(slots[1].texture.DepotPath.$value, "edgehack\\icons\\mod_zap.xbm", "the same texture in the 1080p slot");
  assert.deepEqual(
    slots[0].parts.map((p: { partName: { $value: string } }) => p.partName.$value),
    ["edgehack_mod_zap_item", "edgehack_mod_zap_status"],
  );
  assert.deepEqual(slots[0].parts[0].clippingRectInUVCoords, { $type: "RectF", Bottom: 128 / 256, Left: 0, Right: 99 / 256, Top: 0 });
});

test("a change with own icons points the item, the wheel and the status effect at them", async () => {
  let doc = newDoc("mod", "Zap");
  for (const l of ["item", "wheel", "status"] as const) doc = withOwnIcon(doc, l, true);
  doc = { ...doc, itemIcon: "UIIcon.quickhack_other" };
  const { yaml } = writeTweaks(await zap(), doc);
  assert.match(yaml!, /UIIcon\.edgehack_mod_zap_item:\n {2}\$type: UIIcon\n {2}atlasResourcePath: edgehack\\icons\\mod_zap\.inkatlas\n {2}atlasPartName: edgehack_mod_zap_item/);
  assert.match(yaml!, /Items\.ZapProgram\.iconPath: edgehack_mod_zap_item/, "the own icon wins over a picked one");
  assert.doesNotMatch(yaml!, /quickhack_other/);
  assert.match(yaml!, /\.texturePartID: UIIcon\.edgehack_mod_zap_wheel/);
  assert.match(yaml!, /BaseStatusEffect\.ZapUI\.iconPath: edgehack_mod_zap_status/);
});

test("a new quickhack's own status icon goes on its own copy of the status effect, not the game's", async () => {
  const doc = withOwnIcon(newHackDoc("mod", "Zap", "Static"), "status", true);
  const { yaml } = writeTweaks(await zap(), doc);
  assert.doesNotMatch(yaml!, /^BaseStatusEffect\.ZapUI\.iconPath/m, "the game's UI record is left alone");
  assert.match(yaml!, /_UI:\n {2}\$base: BaseStatusEffect\.ZapUI\n {2}iconPath: edgehack_mod_static_status/);
  assert.match(yaml!, /uiData: EDGEhack\.mod_static\.\w+_UI/);
  assert.match(yaml!, /UIIcon\.edgehack_mod_static_status:/);
});

test("writing the icons: the texture into raw, imported with the UI setup, the atlas beside it", async () => {
  const dir = tmp();
  const docFile = path.join(dir, "raw", "edgehack", "mod_zap.quickhack.json");
  const doc = withOwnIcon(withOwnIcon(newDoc("mod", "Zap"), "item", true), "wheel", true);
  fs.mkdirSync(path.dirname(iconFile(docFile, doc.id, "item")), { recursive: true });
  fs.writeFileSync(iconFile(docFile, doc.id, "item"), encodePng(solid(99, 128, [10, 20, 30, 255])));
  fs.writeFileSync(iconFile(docFile, doc.id, "wheel"), encodePng(solid(64, 64, [255, 255, 255, 255])));
  const calls: string[] = [];
  const writer: IconWriter = {
    async importFile(file, texture) {
      calls.push(`import ${path.relative(dir, file)} ${texture.group}`);
      assert.deepEqual(texture, UI_TEXTURE);
      return { ok: true, written: [], texture: { ...texture } };
    },
    async fromJson(outFile, json) {
      calls.push(`atlas ${path.relative(dir, outFile)} ${JSON.parse(json).Data.RootChunk.slots.Elements[0].parts.length}`);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, json);
    },
  };
  const folders = { raw: path.join(dir, "raw"), archive: path.join(dir, "archive") };
  const created = await writeOwnIcons(folders, writer, doc, docFile);
  assert.deepEqual(calls, [`import ${path.join("raw", "edgehack", "icons", "mod_zap.png")} TEXG_Generic_UI`, `atlas ${path.join("archive", "edgehack", "icons", "mod_zap.inkatlas")} 2`]);
  assert.equal(created.length, 3);
  const png = decodePng(fs.readFileSync(path.join(folders.raw, "edgehack", "icons", "mod_zap.png")));
  assert.deepEqual(pixel(png, 5, 5), [10, 20, 30, 255]);
  assert.deepEqual(pixel(png, LOOKS.wheel.x + 1, 1), [255, 255, 255, 255]);

  const old: IconWriter = { ...writer, async importFile() { return { ok: true, written: [] }; } };
  await assert.rejects(writeOwnIcons(folders, old, doc, docFile), /Update REDcode to 0\.10\.8/);
  const failed: IconWriter = { ...writer, async importFile() { return { ok: true, written: [], texture: null }; } };
  await assert.rejects(writeOwnIcons(folders, failed, doc, docFile), /could not import/);

  assert.deepEqual(await writeOwnIcons(folders, writer, withOwnIcon(withOwnIcon(doc, "item", false), "wheel", false), docFile), []);
  assert.equal(fs.existsSync(path.join(folders.raw, "edgehack", "icons", "mod_zap.png")), false, "no own icons: the earlier texture goes");
  assert.equal(fs.existsSync(path.join(folders.archive, "edgehack", "icons", "mod_zap.inkatlas")), false);
});

test("a missing picture says which icon to upload again", async () => {
  const dir = tmp();
  const doc = withOwnIcon(newDoc("mod", "Zap"), "status", true);
  const writer: IconWriter = { importFile: async () => ({ ok: true, written: [], texture: {} }), fromJson: async () => undefined };
  await assert.rejects(writeOwnIcons({ raw: dir, archive: dir }, writer, doc, path.join(dir, "d.quickhack.json")), /status icon's picture is missing/);
});

test("own icons go with a document to its new place", () => {
  const dir = tmp();
  const from = path.join(dir, "desk", "static.quickhack.json");
  const to = path.join(dir, "project", "mod_static.quickhack.json");
  fs.mkdirSync(path.dirname(iconFile(from, "static", "item")), { recursive: true });
  fs.writeFileSync(iconFile(from, "static", "item"), "png");
  copyOwnIcons(from, "static", to, "mod_static");
  assert.equal(fs.readFileSync(iconFile(to, "mod_static", "item"), "utf8"), "png");
  copyOwnIcons(path.join(dir, "none.quickhack.json"), "none", to, "mod_static");
  assert.equal(fs.existsSync(iconFile(to, "mod_static", "item")), true, "nothing to copy: the place is left as it is");
});
