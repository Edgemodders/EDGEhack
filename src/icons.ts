// Icons for quickhacks: an atlas part cut out of its texture as a small PNG. REDbridge reads the
// atlas (cr2w.toJson) and writes its texture as PNG (texture.toPng); EDGEhack cuts the part out
// (png.ts) and keeps both in its storage folder, so each atlas is converted once. Never shipped or
// committed: these are the game's own pictures, made on the player's machine.
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { BridgeClient } from "./types";
import type { IconRef } from "./read";
import { crop, decodePng, encodePng, Image, UvRect } from "./png";

interface Atlas {
  texture: string;
  parts: Map<string, UvRect>;
}

/** The parts of an atlas's first texture slot, from its WolvenKit JSON. */
export function atlasParts(json: unknown): Atlas | undefined {
  const root = (json as { Data?: { RootChunk?: Record<string, unknown> } })?.Data?.RootChunk;
  const slots = (root?.slots as { Elements?: unknown[] } | undefined)?.Elements ?? [];
  for (const slot of slots as { texture?: { DepotPath?: { $value?: string } }; parts?: unknown[] }[]) {
    const texture = slot.texture?.DepotPath?.$value;
    if (!texture || texture === "0" || !slot.parts?.length) continue;
    const parts = new Map<string, UvRect>();
    for (const p of slot.parts as { partName?: { $value?: string }; clippingRectInUVCoords?: Record<string, number> }[]) {
      const name = p.partName?.$value;
      const uv = p.clippingRectInUVCoords;
      if (name && uv) parts.set(name, { left: uv.Left, top: uv.Top, right: uv.Right, bottom: uv.Bottom });
    }
    return { texture, parts };
  }
  return undefined;
}

export class Icons {
  private readonly atlases = new Map<string, Promise<Atlas | undefined>>();
  private readonly images = new Map<string, Promise<Image>>();
  private readonly files = new Map<string, Promise<string | undefined>>();

  constructor(
    private readonly dir: string,
    private readonly bridge: () => Promise<BridgeClient>,
    private readonly log: (line: string) => void,
  ) {}

  /** The PNG file of an icon, made on first use; undefined when the atlas or part is missing. */
  file(icon: IconRef | undefined): Promise<string | undefined> {
    if (!icon) return Promise.resolve(undefined);
    const key = `${icon.atlas}|${icon.part}`;
    let p = this.files.get(key);
    if (!p) {
      p = this.make(icon).catch((e: unknown) => {
        this.log(`Icon ${icon.record} (${icon.part} in ${icon.atlas}): ${e instanceof Error ? e.message : String(e)}`);
        return undefined;
      });
      this.files.set(key, p);
    }
    return p;
  }

  private async make(icon: IconRef): Promise<string | undefined> {
    const out = path.join(this.dir, "icons", `${hash(icon.atlas)}-${icon.part.replace(/[^\w.-]/g, "_")}.png`);
    if (fs.existsSync(out)) return out;
    const atlas = await this.atlas(icon.atlas);
    const uv = atlas?.parts.get(icon.part);
    if (!atlas || !uv) {
      this.log(`Icon ${icon.record}: no part ${icon.part} in ${icon.atlas}`);
      return undefined;
    }
    const image = await this.image(atlas.texture);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, encodePng(crop(image, uv)));
    return out;
  }

  private atlas(depot: string): Promise<Atlas | undefined> {
    let p = this.atlases.get(depot);
    if (!p) {
      p = (async () => {
        const result = await (await this.bridge()).toJson(depot);
        let json: unknown = result.json ?? (result.file ? fs.readFileSync(result.file, "utf8") : undefined);
        if (typeof json === "string") json = JSON.parse(json);
        return atlasParts(json);
      })();
      this.atlases.set(depot, p);
      p.catch(() => this.atlases.delete(depot));
    }
    return p;
  }

  private image(texture: string): Promise<Image> {
    let p = this.images.get(texture);
    if (!p) {
      p = (async () => {
        const png = path.join(this.dir, "atlas", `${hash(texture)}.png`);
        if (!fs.existsSync(png)) {
          fs.mkdirSync(path.dirname(png), { recursive: true });
          await (await this.bridge()).toPng(texture, png);
        }
        return decodePng(fs.readFileSync(png));
      })();
      this.images.set(texture, p);
      p.catch(() => this.images.delete(texture));
    }
    return p;
  }
}

function hash(s: string): string {
  return createHash("sha1").update(s.toLowerCase()).digest("hex").slice(0, 12);
}
