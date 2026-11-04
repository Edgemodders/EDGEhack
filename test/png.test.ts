import { test } from "node:test";
import * as assert from "node:assert/strict";
import { crop, decodePng, encodePng } from "../src/png";
import { atlasParts } from "../src/icons";

/** A 4 x 2 image: each pixel's red is its x, green its y. */
function grid() {
  const data = new Uint8Array(4 * 2 * 4);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) data.set([x * 60, y * 100, 7, 255], (y * 4 + x) * 4);
  return { width: 4, height: 2, data };
}

test("a PNG written is read back the same", () => {
  const img = grid();
  const back = decodePng(encodePng(img));
  assert.equal(back.width, 4);
  assert.equal(back.height, 2);
  assert.deepEqual([...back.data], [...img.data]);
});

test("crop cuts a UV rectangle, top to bottom", () => {
  const part = crop(grid(), { left: 0.5, right: 1, top: 0.5, bottom: 1 });
  assert.equal(part.width, 2);
  assert.equal(part.height, 1);
  assert.deepEqual([...part.data], [120, 100, 7, 255, 180, 100, 7, 255]);
});

test("not a PNG is refused", () => {
  assert.throws(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])), /Not a PNG/);
});

test("an atlas's parts come from its first slot with a texture", () => {
  const json = {
    Data: {
      RootChunk: {
        slots: {
          Elements: [
            { texture: { DepotPath: { $value: "0" } }, parts: [] },
            {
              texture: { DepotPath: { $value: "base\\gui\\zap.xbm" } },
              parts: [{ partName: { $value: "Zap" }, clippingRectInUVCoords: { Left: 0, Top: 0.5, Right: 0.25, Bottom: 1 } }],
            },
          ],
        },
      },
    },
  };
  const atlas = atlasParts(json);
  assert.equal(atlas?.texture, "base\\gui\\zap.xbm");
  assert.deepEqual(atlas?.parts.get("Zap"), { left: 0, top: 0.5, right: 0.25, bottom: 1 });
  assert.equal(atlasParts({}), undefined);
});
