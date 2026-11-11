// Generate's fixed prompts (H3b.3; design, "Own icons (H3b)"): one per look, saying the look, the
// colours, the framing and "no text"; the modder's words are only what the glyph shows. Generate All
// draws the Item first, then the Wheel and Status from it as a reference picture, so they show the
// same glyph. The prompts are tuned by the owner's eye in the hand test. No VS Code.
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
  /** Asked for in white on black, which becomes see-through. */
  black: boolean;
}

const NO_TEXT = "No text, no letters, no numbers, no logos, no watermark.";

export const PROMPTS: Record<IconLook, PromptLook> = {
  item: {
    alone:
      "A Cyberpunk 2077 quickhack item icon, seen straight on: an upright portrait shard card that fills the whole picture edge to edge. " +
      "A dark charcoal frame with a row of small gold pins along its top edge, and in the middle a dark screen with a thin teal edge. " +
      `On the screen, in glowing cyan line art: ${WORDS}. ` +
      `Flat, clean game interface art, high contrast, readable when small. Nothing outside the card. ${NO_TEXT}`,
    size: "1024x1536",
    fit: "cover",
    black: false,
  },
  wheel: {
    alone:
      `A Cyberpunk 2077 quickhack wheel icon: one simple glyph of ${WORDS}, drawn in clean white line art of an even weight, ` +
      "centred and filling about four fifths of the picture, on a solid pure black background. " +
      `Flat: no shading, no gradient, no glow, no frame, no circle around it. Readable at 64 by 64 pixels. ${NO_TEXT}`,
    fromItem:
      `This picture is a quickhack card with a glyph of ${WORDS} on its screen. Draw that same glyph alone, ` +
      "in clean white line art of an even weight, centred and filling about four fifths of the picture, on a solid pure black background. " +
      `Leave out the card, its frame, pins and screen. Flat: no shading, no gradient, no glow, no circle around it. ${NO_TEXT}`,
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
      `This picture is a quickhack card with a glyph of ${WORDS} on its screen. Draw that same glyph alone as one bold, simple, solid white silhouette, ` +
      "centred and filling about four fifths of the picture, on a solid pure black background. " +
      `Leave out the card, its frame, pins and screen. A filled flat shape, not an outline: no shading, no gradient, no glow. ${NO_TEXT}`,
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
