// The game's quickhack item card, emptied (H3b.3): Generate draws the Item's glyph on the card of the
// quickhack it comes from, read from the player's own game, so no game art ships with EDGEhack. Plain
// JavaScript with no DOM, so the page loads it as a script and the unit tests require it.
(function (root) {
  /** A pixel is part of the lit cyan border (or the glyph, or the label). */
  function litAt(p, i) {
    return p[i + 1] > 150 && p[i + 2] > 150;
  }

  /**
   * The card with its glyph taken out, and its screen.
   *
   * The screen is found from the lit border: its rows run from under the top border down to the label
   * plate's line (the lowest row lit across the middle third), and each row from the left border's inner
   * edge to the right border's. Inside it, a pixel that differs from its column's empty background is
   * glyph; each glyph pixel, grown by one, takes the nearest empty pixel above or below it in the same
   * column, so the screen's own texture carries on.
   *
   * @param {Uint8ClampedArray|Uint8Array} data RGBA pixels, `width` x `height`; not changed
   * @returns {{ data: Uint8ClampedArray, screen: Uint8Array, box: { x: number, y: number, width: number, height: number } } | null}
   *   the emptied pixels, the screen as a mask (1 inside), and its bounds; null when no screen is found
   */
  function emptyCard(data, width, height) {
    const w = width;
    const h = height;
    const at = (x, y) => (y * w + x) * 4;
    const lit = (x, y) => litAt(data, at(x, y));
    const mid = w >> 1;
    let top = 0;
    while (top < h && !lit(mid, top)) top++;
    while (top < h && lit(mid, top)) top++;
    if (top >= h) return null;
    // The label plate's line: the lowest row lit across the middle third (the plate's own bottom edge is
    // broken there by its label).
    let plate = -1;
    const third = [Math.round(w * 0.35), Math.round(w * 0.65)];
    for (let y = h - 1; y > top; y--) {
      let n = 0;
      for (let x = third[0]; x < third[1]; x++) if (lit(x, y)) n++;
      if (n >= third[1] - third[0] - 2) plate = y;
      else if (plate >= 0 && y < plate - 1) break;
    }
    if (plate < 0) return null;
    const y0 = top;
    const y1 = plate - 1;
    const edges = [];
    for (let y = 0; y < h; y++) {
      let l = 0;
      while (l < w && !lit(l, y)) l++;
      while (l < w && lit(l, y)) l++;
      let r = w - 1;
      while (r > 0 && !lit(r, y)) r--;
      while (r > 0 && lit(r, y)) r--;
      edges.push([l, r]);
    }
    const inside = (x, y) => y >= y0 && y <= y1 && x >= edges[y][0] && x <= edges[y][1];
    const screen = new Uint8Array(w * h);
    let bx0 = w, bx1 = -1;
    for (let y = y0; y <= y1; y++)
      for (let x = 0; x < w; x++)
        if (inside(x, y)) {
          screen[y * w + x] = 1;
          bx0 = Math.min(bx0, x);
          bx1 = Math.max(bx1, x);
        }
    if (bx1 < bx0 || y1 - y0 < 8) return null;

    // Each column's empty colour: the median of its screen pixels that look like background.
    const bgLike = (i) => {
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      return m >= 0x0d && m <= 0x3c;
    };
    const col = [];
    for (let x = 0; x < w; x++) {
      const v = [[], [], []];
      for (let y = y0; y <= y1; y++) if (screen[y * w + x] && bgLike(at(x, y))) for (let c = 0; c < 3; c++) v[c].push(data[at(x, y) + c]);
      col.push(v.map((a) => (a.sort((p, q) => p - q), a.length ? a[a.length >> 1] : 0x16)));
    }
    const glyph = new Uint8Array(w * h);
    for (let y = y0; y <= y1; y++)
      for (let x = 0; x < w; x++) {
        if (!screen[y * w + x]) continue;
        const i = at(x, y);
        if (Math.abs(data[i] - col[x][0]) > 14 || Math.abs(data[i + 1] - col[x][1]) > 14 || Math.abs(data[i + 2] - col[x][2]) > 14) glyph[y * w + x] = 1;
      }
    const grown = new Uint8Array(w * h);
    for (let y = y0; y <= y1; y++)
      for (let x = 1; x < w - 1; x++)
        if (screen[y * w + x])
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (glyph[(y + dy) * w + x + dx]) grown[y * w + x] = 1;
    const out = new Uint8ClampedArray(data);
    for (let y = y0; y <= y1; y++)
      for (let x = 0; x < w; x++) {
        if (!grown[y * w + x]) continue;
        let src = -1;
        for (let d = 1; d <= y1 - y0 && src < 0; d++)
          for (const yy of [y - d, y + d]) if (src < 0 && yy >= y0 && yy <= y1 && screen[yy * w + x] && !grown[yy * w + x]) src = at(x, yy);
        const j = at(x, y);
        if (src >= 0) for (let c = 0; c < 4; c++) out[j + c] = data[src + c];
        else {
          out[j] = col[x][0];
          out[j + 1] = col[x][1];
          out[j + 2] = col[x][2];
          out[j + 3] = 255;
        }
      }
    return { data: out, screen, box: { x: bx0, y: y0, width: bx1 - bx0 + 1, height: y1 - y0 + 1 } };
  }

  const api = { emptyCard };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.edgehackCard = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
