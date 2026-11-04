// Builds the Nexus Mods file from the packaged extension: dist/EDGEhack-<version>-nexus.zip with the
// .vsix, how to install it, and the license. Run after the vsix is packaged (npm run package, or the
// Release workflow's Package step), which uploads it to Nexus with Update Nexus Mods ticked.
//   node tools/nexus-zip.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { name, version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const vsix = [path.join(root, "dist", `${name}-${version}.vsix`), path.join(root, `${name}-${version}.vsix`)].find((p) => fs.existsSync(p));
const stage = path.join(root, "dist", "nexus");
const zip = path.join(root, "dist", `EDGEhack-${version}-nexus.zip`);

if (!vsix) throw new Error(`${name}-${version}.vsix is missing: package the extension first (npm run package)`);
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
fs.mkdirSync(stage, { recursive: true });

fs.copyFileSync(vsix, path.join(stage, path.basename(vsix)));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(stage, "LICENSE.txt"));
fs.writeFileSync(
  path.join(stage, "README.txt"),
  [
    `EDGEhack ${version}: the quickhack editor for Cyberpunk 2077, in VS Code.`,
    "",
    "This is a VS Code extension, not a game mod. Do not install it with Vortex.",
    "",
    "Install:",
    "  1. In VS Code (or VSCodium, or EDGEkit), open the Extensions view (Ctrl+Shift+X).",
    "  2. Click ... at its top, choose Install from VSIX..., and pick",
    `     ${path.basename(vsix)} from this folder.`,
    "  3. Open EDGEhack in the side bar.",
    "",
    "Or from a terminal:",
    `  code --install-extension ${path.basename(vsix)}`,
    "",
    "The same extension is on the VS Code Marketplace and Open VSX (search for",
    "EDGEhack), where it updates itself.",
    "",
    "Needs Windows 10 or 11, VS Code 1.90 or later, REDcode (installed with it),",
    "Cyberpunk 2077, and TweakXL and ArchiveXL in the game for the mods it makes.",
    "",
    "Docs: https://edgemodders.github.io/EDGEhack/",
    "Source and issues: https://github.com/Edgemodders/EDGEhack",
    "",
  ].join("\r\n"),
);

// Windows' own tar writes zip files (-a picks the format from the name); Git's tar does not.
const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
const packed = spawnSync(tar, ["-a", "-c", "-f", zip, ...fs.readdirSync(stage)], { cwd: stage, stdio: "inherit" });
if (packed.status !== 0) throw new Error("Zipping failed");
fs.rmSync(stage, { recursive: true, force: true });
console.log(`${zip}: ${(fs.statSync(zip).size / 1024).toFixed(0)} KB`);
