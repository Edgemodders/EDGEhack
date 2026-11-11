// H3b.3: the game's item card emptied of its glyph (media/card.js), on a drawn stand-in card: no game
// art in the tests either.
import { test } from "node:test";
import * as assert from "node:assert/strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { emptyCard } = require("../media/card.js") as {
  emptyCard: (data: Uint8Array, w: number, h: number) => { data: Uint8ClampedArray; screen: Uint8Array; box: { x: number; y: number; width: number; height: number } } | null;
};

const W = 99;
const H = 128;
const BORDER = [0x5d, 0xf7, 0xff];
const GLYPH = [0x6c, 0xfd, 0xfd];
const SCREEN = (x: number): number[] => (x % 2 ? [0x15, 0x1c, 0x1c] : [0x18, 0x20, 0x20]);

/** A card like the game's: a lit border round a dark screen (x 10 to 95, y 22 to 107), the label plate's line at y 108 and its bottom edge at 118, a glyph in the screen. */
function card(withGlyph = true): Uint8Array {
  const p = new Uint8Array(W * H * 4);
  const set = (x: number, y: number, c: number[]): void => {
    p.set([...c, 255], (y * W + x) * 4);
  };
  for (let y = 18; y < 120; y++) for (let x = 6; x < 98; x++) set(x, y, SCREEN(x));
  for (let x = 6; x < 98; x++) {
    set(x, 20, BORDER);
    set(x, 21, BORDER);
    // The plate's bottom edge, broken in the middle by its label, as on the game's cards.
    if (x < 30 || x > 70) set(x, 118, BORDER);
  }
  for (let y = 20; y < 119; y++) {
    set(8, y, BORDER);
    set(9, y, BORDER);
    set(96, y, BORDER);
    set(97, y, BORDER);
  }
  for (let x = 29; x < 77; x++) set(x, 108, BORDER);
  if (withGlyph) for (let y = 30; y < 100; y++) for (let x = 30; x < 80; x++) if ((x - 55) ** 2 + (y - 65) ** 2 < 600) set(x, y, GLYPH);
  return p;
}

test("the glyph is taken out and the screen keeps its own texture; the border is left as it was", () => {
  const before = card();
  const got = emptyCard(before, W, H);
  assert.ok(got);
  const empty = card(false);
  for (let y = 22; y <= 107; y++)
    for (let x = 10; x <= 95; x++) {
      const i = (y * W + x) * 4;
      assert.deepEqual([...got.data.slice(i, i + 3)], [...empty.slice(i, i + 3)], `screen pixel ${x},${y}`);
    }
  for (const [x, y] of [[8, 64], [96, 64], [50, 20], [50, 108], [20, 118]]) {
    const i = (y * W + x) * 4;
    assert.deepEqual([...got.data.slice(i, i + 3)], BORDER, `border pixel ${x},${y}`);
  }
  assert.deepEqual([...before.slice(((65 * W) + 55) * 4, ((65 * W) + 55) * 4 + 3)], GLYPH, "the input is not changed");
});

test("the screen is found between the borders, down to the label plate's line", () => {
  const got = emptyCard(card(), W, H);
  assert.deepEqual(got?.box, { x: 10, y: 22, width: 86, height: 86 });
  assert.equal(got?.screen[64 * W + 50], 1);
  assert.equal(got?.screen[64 * W + 9], 0);
  assert.equal(got?.screen[108 * W + 50], 0);
});

test("a picture with no lit border has no screen", () => {
  assert.equal(emptyCard(new Uint8Array(W * H * 4), W, H), null);
});
