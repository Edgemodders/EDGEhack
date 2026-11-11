// Generate (H3b.3): one look's picture from the modder's words, through OpenAI's GPT Image, with the
// look's fixed prompt. With the Item's picture as a reference (Generate All), the Wheel and Status are
// drawn as edits of it, so all three show the same glyph. No VS Code, so H4's MCP server can use it.
import type { IconLook } from "./document";
import { PROMPTS, promptFor } from "./iconPrompts";
import { CallOptions, editImage, generateImage, Quality } from "./imageService";

export interface GenerateOptions extends CallOptions {
  model: string;
  quality?: Quality;
}

export interface Generated {
  look: IconLook;
  /** The picture as the service drew it (PNG, 1024 wide); the page fits it to the look's size. */
  png: Buffer;
  /** The whole prompt sent. */
  prompt: string;
  model: string;
}

/** Draws one look. `reference` is the Item's picture, for the Wheel and Status of Generate All. */
export async function generateLook(look: IconLook, words: string, opts: GenerateOptions, reference?: Buffer): Promise<Generated> {
  const fromItem = !!reference && look !== "item";
  const prompt = promptFor(look, words, fromItem);
  const size = PROMPTS[look].size;
  const png = fromItem ? await editImage(opts.model, prompt, reference!, size, opts) : await generateImage(opts.model, prompt, size, opts);
  return { look, png, prompt, model: opts.model };
}
