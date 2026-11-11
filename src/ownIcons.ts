// A quickhack's own icons (H3b): PNGs kept beside its document, put together into one texture and an
// .inkatlas the mod ships, with UIIcon records naming each part. Free of VS Code, for H4's MCP server.
//
// H3b.1's spike settled the shape on game 2.5: the item card is 99 x 128 and the wheel and status icons
// 64 x 64 (the game's own parts); the texture has the game's UI setup (UI_TEXTURE); one texture in both
// of the atlas's slots is enough.
import * as fs from "node:fs";
import * as path from "node:path";
import { ICON_LOOKS, IconLook, QuickhackDoc } from "./document";
import { decodePng, encodePng, Image } from "./png";

/** A game path (backslashes, as the game's depot has them) inside a folder on disk, on any system. */
export const onDisk = (folder: string, gamePath: string): string => path.join(folder, ...gamePath.split("\\"));

/** Each look's size, and where it sits in the mod's texture. */
export const LOOKS: Record<IconLook, { width: number; height: number; x: number; y: number; label: string }> = {
  item: { width: 99, height: 128, x: 0, y: 0, label: "Item" },
  wheel: { width: 64, height: 64, x: 112, y: 0, label: "Wheel" },
  status: { width: 64, height: 64, x: 184, y: 0, label: "Status" },
};

/** The texture holding a quickhack's own icons. */
export const ATLAS_SIZE = 256;

/** The game's setup for UI atlas textures, as its quickhack and item icon atlases have it (REDbridge's `texture` option). */
export const UI_TEXTURE = {
  group: "TEXG_Generic_UI",
  compression: "TCM_QualityColor",
  rawFormat: "TRF_TrueColor",
  isGamma: true,
  hasMipchain: false,
  isStreamable: false,
} as const;

/** The folder of a document's own icons: `<id>.icons` beside it. */
export function iconsDir(docFile: string, id: string): string {
  return path.join(path.dirname(docFile), `${id}.icons`);
}

export function iconFile(docFile: string, id: string, look: IconLook): string {
  return path.join(iconsDir(docFile, id), `${look}.png`);
}

/** The atlas's part name for a look, and its UIIcon record's name (`UIIcon.<name>`). */
export function iconName(id: string, look: IconLook): string {
  return `edgehack_${id}_${look}`;
}

export function iconRecord(id: string, look: IconLook): string {
  return `UIIcon.${iconName(id, look)}`;
}

/** Depot paths of the mod's texture and atlas for a document. */
export function atlasPaths(id: string): { xbm: string; atlas: string; png: string } {
  return { xbm: `edgehack\\icons\\${id}.xbm`, atlas: `edgehack\\icons\\${id}.inkatlas`, png: `edgehack\\icons\\${id}.png` };
}

/** The looks a document has an own icon for. */
export function ownLooks(doc: QuickhackDoc): IconLook[] {
  return ICON_LOOKS.filter((l) => doc.ownIcons?.[l]);
}

/** TweakXL records naming each own icon's atlas part. */
export function iconRecords(doc: QuickhackDoc): string[] {
  const { atlas } = atlasPaths(doc.id);
  return ownLooks(doc).map((l) => `${iconRecord(doc.id, l)}:\n  $type: UIIcon\n  atlasResourcePath: ${atlas}\n  atlasPartName: ${iconName(doc.id, l)}\n`);
}

/** The texture: each look's image at its place. An image of another size is placed as it is, cut at its box. */
export function atlasImage(images: Partial<Record<IconLook, Image>>): Image {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (const look of ICON_LOOKS) {
    const img = images[look];
    if (!img) continue;
    const box = LOOKS[look];
    const w = Math.min(img.width, box.width);
    const h = Math.min(img.height, box.height);
    for (let y = 0; y < h; y++) {
      const from = y * img.width * 4;
      data.set(img.data.subarray(from, from + w * 4), ((box.y + y) * ATLAS_SIZE + box.x) * 4);
    }
  }
  return { width: ATLAS_SIZE, height: ATLAS_SIZE, data };
}

const ref = (value: string) =>
  value ? { DepotPath: { $type: "ResourcePath", $storage: "string", $value: value }, Flags: "Soft" } : { DepotPath: { $type: "ResourcePath", $storage: "uint64", $value: "0" }, Flags: "Soft" };

/** The .inkatlas as WolvenKit JSON: the texture in both slots, one part per look (cr2w.fromJson writes it). */
export function atlasJson(id: string, looks: IconLook[]): string {
  const parts = looks.map((l) => {
    const b = LOOKS[l];
    return {
      $type: "inkTextureAtlasMapper",
      clippingRectInPixels: { $type: "Rect", bottom: 0, left: 0, right: 0, top: 0 },
      clippingRectInUVCoords: { $type: "RectF", Bottom: (b.y + b.height) / ATLAS_SIZE, Left: b.x / ATLAS_SIZE, Right: (b.x + b.width) / ATLAS_SIZE, Top: b.y / ATLAS_SIZE },
      partName: { $type: "CName", $storage: "string", $value: iconName(id, l) },
    };
  });
  const slot = (texture: string, withParts: boolean) => ({ $type: "inkTextureSlot", parts: withParts ? parts : [], slices: [], texture: ref(texture) });
  const { xbm } = atlasPaths(id);
  return JSON.stringify({
    Header: { WolvenKitVersion: "10.0.0", WKitJsonVersion: "0.0.9", GameVersion: 2500, DataType: "CR2W" },
    Data: {
      Version: 195,
      BuildVersion: 0,
      RootChunk: {
        $type: "inkTextureAtlas",
        activeTexture: "StaticTexture",
        cookingPlatform: "PLATFORM_PC",
        dynamicTexture: ref(""),
        dynamicTextureSlot: { $type: "inkDynamicTextureSlot", parts: [], texture: ref("") },
        isSingleTextureMode: 1,
        parts: [],
        slices: [],
        slots: { Elements: [slot(xbm, true), slot(xbm, true), slot("", false)] },
        texture: ref(""),
        textureResolution: "UltraHD_3840_2160",
      },
      EmbeddedFiles: [],
    },
  });
}

/** What writing a project's icon files needs: REDcode's import with the texture option, and REDbridge's JSON writer. */
export interface IconWriter {
  /** REDcodeApi.importFile with `texture` (REDcode #25, in 0.10.8): answers the setup read back (null with no .xbm written), with no `texture` field at all from an older REDcode. */
  importFile(file: string, texture: typeof UI_TEXTURE): Promise<{ ok: boolean; written: string[]; texture?: unknown | null }>;
  fromJson(outFile: string, json: string): Promise<unknown>;
}

export interface IconFolders {
  /** The project's source/raw and source/archive folders. */
  raw: string;
  archive: string;
}

/**
 * Writes a document's texture and atlas into the project: the PNG into source/raw, imported as an .xbm
 * with the UI setup, and the .inkatlas beside it. With no own icons, removes what an earlier save wrote.
 * Answers the files created.
 */
export async function writeOwnIcons(folders: IconFolders, writer: IconWriter, doc: QuickhackDoc, docFile: string): Promise<string[]> {
  const looks = ownLooks(doc);
  const paths = atlasPaths(doc.id);
  const png = onDisk(folders.raw, paths.png);
  const xbm = onDisk(folders.archive, paths.xbm);
  const atlas = onDisk(folders.archive, paths.atlas);
  if (!looks.length) {
    for (const f of [png, xbm, atlas]) fs.rmSync(f, { force: true });
    return [];
  }
  const images: Partial<Record<IconLook, Image>> = {};
  for (const look of looks) {
    const file = iconFile(docFile, doc.id, look);
    if (!fs.existsSync(file)) throw new Error(`The ${LOOKS[look].label.toLowerCase()} icon's picture is missing (${file}). Upload it again, or use the game's.`);
    images[look] = decodePng(fs.readFileSync(file));
  }
  const created = [png, xbm, atlas].filter((f) => !fs.existsSync(f));
  fs.mkdirSync(path.dirname(png), { recursive: true });
  fs.writeFileSync(png, encodePng(atlasImage(images)));
  const r = await writer.importFile(png, UI_TEXTURE);
  if (!("texture" in r)) throw new Error("This REDcode does not set a texture's setup on import, which the icons need. Update REDcode to 0.10.8 or later.");
  if (!r.ok || !r.texture) throw new Error(`REDcode could not import the icons' texture (${png}).`);
  fs.mkdirSync(path.dirname(atlas), { recursive: true });
  await writer.fromJson(atlas, atlasJson(doc.id, looks));
  return created;
}

/** Copies a document's own icons folder to another document's place (Add to Project, Duplicate). */
export function copyOwnIcons(fromDoc: string, fromId: string, toDoc: string, toId: string): void {
  const from = iconsDir(fromDoc, fromId);
  if (!fs.existsSync(from)) return;
  const to = iconsDir(toDoc, toId);
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) if (f.toLowerCase().endsWith(".png")) fs.copyFileSync(path.join(from, f), path.join(to, f));
}
