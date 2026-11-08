<p align="center">
  <img src="docs/assets/brand/banner.png" alt="EDGEhack: the EDGE platform's quickhack editor for VS Code. Open any quickhack, change its name, icon, costs and effects, or build a new one from the game's own status effects." width="100%">
</p>

<p align="center">
  <a href="https://edgemodders.github.io/EDGEhack/"><img src="docs/assets/brand/badges/docs.svg" alt="docs: read the docs"></a>
  <img src="docs/assets/brand/badges/status.svg" alt="status: H3 in progress">
  <img src="docs/assets/brand/badges/game.svg" alt="game: Cyberpunk 2077">
  <img src="docs/assets/brand/badges/vscode.svg" alt="runs in: VS Code">
  <a href="LICENSE"><img src="docs/assets/brand/badges/license.svg" alt="license: MIT"></a>
</p>

A quickhack editor for Cyberpunk 2077, as a VS Code extension in the EDGE family:

- **Open any quickhack**, from its own Quickhacks view or by clicking one in REDcode or another EDGE tool, and see everything about it in plain words: name, icon, tier, RAM, upload time, cooldown, duration, damage and the effects it applies.
- **Change it:** texts, icons, costs and numbers, for one tier or the whole family.
- **Make new ones:** start from a game quickhack and add buffs, debuffs and attack features, taken from other quickhacks or from the game's status effects that work on enemies.
- **A mod you can read:** EDGEhack writes TweakXL and ArchiveXL files into your REDcode project, and REDcode packs and plays it.

**[Docs](https://edgemodders.github.io/EDGEhack/)** &middot; [Design](docs/design.md) &middot; [Changelog](CHANGELOG.md) &middot; [Tests](docs/testing.md)

> [!NOTE]
> **Status: H3 New and Effects in progress, 2026-11-08 (EDGEhack 0.0.14).** Clone and Modify makes a new quickhack beside the game's, and Add Effect adds another quickhack's effect or any status effect (both passed in the game), or builds a damage over time, a stat change or a chance to apply (built, awaiting its test). Edit a game quickhack's texts, icons and numbers, and it writes a TweakXL and ArchiveXL mod into your REDcode project. The Quickhacks view lists the game's quickhacks with their icons; the read-only quickhack page shows every tier's texts, icons, costs and effects in plain words; Open in EDGEhack works from REDcode's TweakDB view. The design, with the phases H1 to H6, is agreed: [docs/design.md](docs/design.md). Nothing is released yet.

## Repo layout

| Folder | What |
|---|---|
| `src/` | The extension: `extension.ts` (commands), `catalog.ts`, `records.ts` and `read.ts` (quickhacks from TweakDB in plain words), `icons.ts` and `png.ts` (icons cut from the game's atlases), `quickhacksView.ts`, `page.ts` and `pageHtml.ts` (the quickhack page), `document.ts`, `tweaks.ts` and `projectFiles.ts` (a document to the mod's files), `editor.ts` and `editorHtml.ts` (the editor), `redcode.ts` (REDcode's API) |
| `media/` | The pages' styles, and the editor's script |
| `test/` | Unit tests, `npm test` |
| `docs/` | The docs site, published at https://edgemodders.github.io/EDGEhack/ |
| `nexus/` | The Nexus Mods page's source and upload settings |
| `tools/` | `brand/` renders the banner, icon and badges; `release-notes.mjs` and `nexus-zip.mjs` serve the Release workflow; `release/readme-check.mjs` and `nexus/` are shared with the other EDGE repos |

## Build

```powershell
npm install
npm run typecheck
npm run build
npm test
```

Press F5 in VS Code to run it. More in [Dev setup](docs/dev-setup.md).

| You need | Why |
|---|---|
| Windows 10 or 11, Cyberpunk 2077 on PC | EDGEhack reads the game's TweakDB |
| VS Code 1.90 or later | EDGEhack is a VS Code extension |
| REDcode, with REDbridge | The game folder, TweakDB reads, the project, Pack and Play (from H1) |
| TweakXL and ArchiveXL in the game | For the mods EDGEhack makes |

Not affiliated with CD Projekt RED.
