// A WolvenKit project read from its .cpmodproj (H4.4), for EDGEhack outside VS Code, where REDcode's
// API is not there to give the open one. The reading follows REDcode's (MIT; extensions/redcode/src/project.ts).

import * as fs from "node:fs";
import * as path from "node:path";
import type { ProjectRef } from "./types";

const unescapeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** The project of a .cpmodproj file, or of the first one directly inside a folder. Throws when there is none. */
export function projectAt(fileOrDir: string): ProjectRef {
  let file = path.resolve(fileOrDir);
  if (fs.statSync(file).isDirectory()) {
    const found = fs.readdirSync(file).find((e) => e.toLowerCase().endsWith(".cpmodproj"));
    if (!found) throw new Error(`${file} has no .cpmodproj file: it is not a WolvenKit project.`);
    file = path.join(file, found);
  }
  const xml = fs.readFileSync(file, "utf8");
  const get = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? unescapeXml(m[1].trim()) : "";
  };
  const name = get("Name") || path.basename(file, path.extname(file));
  const dir = path.dirname(file);
  return {
    name,
    modName: get("ModName") || name,
    file,
    dir,
    archive: path.join(dir, "source", "archive"),
    raw: path.join(dir, "source", "raw"),
    resources: path.join(dir, "source", "resources"),
    packed: path.join(dir, "packed"),
  };
}
