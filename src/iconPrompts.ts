// Generate's fixed prompts (H3b.3; design, "Own icons (H3b)"): one per look, saying the look, the
// colours, the framing and "no text"; the modder's words are only what the glyph shows. The Item is
// only its glyph, flat in the game's cyan, which the page puts on the quickhack frame in
// `images/quickhack.png`. Generate All draws the Item first, then the Wheel and Status from its glyph
// as a reference picture, so they show the same glyph. The prompts are tuned by the owner's eye in the hand test. No VS Code.
import type { IconLook } from "./document";
import type { ImageSize } from "./imageService";

/** Where the modder's words go in a template. */
export const WORDS = "{words}";

export interface PromptLook {
  /** The prompt from words alone. */
  alone: string;
  /** The prompt with the Item's picture as the reference (Generate All); none for the Item itself. */
  fromItem?: string;
  /** The size GPT Image draws it at. */
  size: ImageSize;
  /** How the picture goes into the look's size: the Item card fills it (cut at the edges), the others fit inside it. */
  fit: "cover" | "contain";
  /** Asked for on black, which becomes see-through. */
  black: boolean;
  /** The one flat colour the glyph is painted in, whatever shade came back: its brightness becomes the opacity. */
  color?: string;
  /**
   * The frame the glyph goes on (the Item): a picture in the extension's `images` folder at the look's
   * size, and the box the glyph is fitted into, a little larger than the screen: the page clips the glyph
   * to the screen, so what reaches past it is cut by the border. OpenAI draws only the glyph.
   */
  frame?: { file: string; x: number; y: number; width: number; height: number };
}

/** The Item glyph's colour, the game's quickhack cyan. */
export const GLYPH_COLOR = "#50cdd2";

const NO_TEXT = "No text, no letters, no numbers, no logos, no watermark.";

export const PROMPTS: Record<IconLook, PromptLook> = {
  item: {
    alone:
      `A single glyph of ${WORDS} for a Cyberpunk 2077 quickhack icon, in clean line art of an even weight, ` +
      `in one solid flat colour, cyan ${GLYPH_COLOR}, centred and filling about four fifths of the picture, on a solid pure black background. ` +
      `Completely flat: no lighting, no shading, no gradient, no glow, no 3D, no texture. Only the glyph: no frame, no border, no card, no screen. Readable when small. ${NO_TEXT}`,
    size: "1024x1024",
    fit: "contain",
    black: true,
    color: GLYPH_COLOR,
    frame: { file: "quickhack.png", x: 12, y: 21, width: 76, height: 76 },
  },
  wheel: {
    alone:
      `A Cyberpunk 2077 quickhack wheel icon: one simple glyph of ${WORDS}, drawn in clean white line art of an even weight, ` +
      "centred and filling about four fifths of the picture, on a solid pure black background. " +
      `Flat: no shading, no gradient, no glow, no frame, no circle around it. Readable at 64 by 64 pixels. ${NO_TEXT}`,
    fromItem:
      `This picture is a glyph of ${WORDS} in cyan on black. Draw that same glyph again, ` +
      "in clean white line art of an even weight, centred and filling about four fifths of the picture, on a solid pure black background. " +
      `Flat: no shading, no gradient, no glow, no frame, no circle around it. ${NO_TEXT}`,
    size: "1024x1024",
    fit: "contain",
    black: true,
  },
  status: {
    alone:
      `A Cyberpunk 2077 status effect icon: one bold, simple, solid white silhouette of ${WORDS}, ` +
      "centred and filling about four fifths of the picture, on a solid pure black background. " +
      `A filled flat shape, not an outline: no shading, no gradient, no glow, no frame. Readable at 32 by 32 pixels. ${NO_TEXT}`,
    fromItem:
      `This picture is a glyph of ${WORDS} in cyan on black. Draw that same glyph again as one bold, simple, solid white silhouette, ` +
      "centred and filling about four fifths of the picture, on a solid pure black background. " +
      `A filled flat shape, not an outline: no shading, no gradient, no glow, no frame. ${NO_TEXT}`,
    size: "1024x1024",
    fit: "contain",
    black: true,
  },
};

/** The modder's words as they go into a prompt: one line, at most 300 characters. */
export function cleanWords(words: string): string {
  return words.replace(/\s+/g, " ").trim().slice(0, 300);
}

/** The whole prompt sent for a look: from words alone, or from the Item's picture. */
export function promptFor(look: IconLook, words: string, fromItem = false): string {
  const w = cleanWords(words);
  if (!w) throw new Error("Say what the icon shows first, such as \"a skull made of static\".");
  const p = PROMPTS[look];
  const template = fromItem && p.fromItem ? p.fromItem : p.alone;
  return template.split(WORDS).join(w);
}
