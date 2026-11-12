<p align="center">
  <img src="docs/assets/brand/banner.png" alt="EDGEhack: the EDGE platform's quickhack editor for VS Code. Open any quickhack, change its name, icon, costs and effects, or build a new one from the game's own status effects." width="100%">
</p>

<p align="center">
  <a href="https://edgemodders.github.io/EDGEhack/"><img src="docs/assets/brand/badges/docs.svg" alt="docs: read the docs"></a>
  <img src="docs/assets/brand/badges/status.svg" alt="status: 0.1.1 released">
  <img src="docs/assets/brand/badges/game.svg" alt="game: Cyberpunk 2077">
  <img src="docs/assets/brand/badges/vscode.svg" alt="runs in: VS Code">
  <a href="LICENSE"><img src="docs/assets/brand/badges/license.svg" alt="license: MIT"></a>
</p>

A quickhack editor for Cyberpunk 2077, as a VS Code extension in the EDGE family:

- **Open any quickhack**, from its own Quickhacks view or by clicking one in REDcode or another EDGE tool, and see everything about it in plain words: name, icon, tier, RAM, upload time, cooldown, duration, damage and the effects it applies.
- **Change it:** texts, icons, costs and numbers, for one tier or the whole family.
- **Make new ones:** start from a game quickhack and add buffs, debuffs and attack features, taken from other quickhacks or from the effects the game can put on enemies.
- **Icons of your own:** upload a picture for the item, the wheel and the icon over a hacked target, or have OpenAI's GPT Image draw them from your words, with your own OpenAI key.
- **Scripts:** give a quickhack its own logic in JavaScript, which REDnode runs in the game: on whom it can be used, and what more it does when it lands.
- **Feature lines:** bullets of your own in the item's tooltip, to say what it does (passed in the game).
- **Try Live:** see a change in the running game at once, without packing, and put it back with Stop (passed in the game).
- **A mod you can read:** EDGEhack writes TweakXL and ArchiveXL files into your REDcode project, and REDcode packs and plays it.

**[Guide](https://edgemodders.ai/wiki/edgehack/)** &middot; [Docs](https://edgemodders.github.io/EDGEhack/) &middot; [Design](docs/design.md) &middot; [Changelog](CHANGELOG.md) &middot; [Tests](docs/testing.md)

> [!NOTE]
> **Status: 0.1.1 released on 2026-11-11, for game 2.5**, the first on the VS Code Marketplace (0.1.0 reached GitHub and Open VSX only), a preview. Generate's OpenAI key is kept in VS Code's own secret storage. Open any quickhack in plain words, change it, or Clone and Modify it into a new one with effects from any other, icons of your own (uploaded or drawn by OpenAI) and scripts run by REDnode; try it live in the running game; keep it in the EDGE Library; and let Claude Code or REDagent make quickhacks with you. On the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=edgemodders.edgehack), [Open VSX](https://open-vsx.org/extension/edgemodders/edgehack), [GitHub releases](https://github.com/Edgemodders/EDGEhack/releases) and npm (`@edgemodders/edgehack-mcp`). [Guide](https://edgemodders.ai/wiki/edgehack/)

## Repo layout

| Folder | What |
|---|---|
| `src/` | The extension: `extension.ts` (commands), `catalog.ts`, `records.ts` and `read.ts` (quickhacks from TweakDB in plain words), `icons.ts` and `png.ts` (icons cut from the game's atlases), `quickhacksView.ts`, `page.ts` and `pageHtml.ts` (the quickhack page), `document.ts`, `tweaks.ts` and `projectFiles.ts` (a document to the mod's files), `effects.ts` (added effects), `getit.ts` (selling and crafting), `desk.ts` and `deskView.ts` (the Desk), `ownIcons.ts` (icons of your own), `scripts.ts` (a quickhack's script and the mod's REDnode package), `iconPrompts.ts`, `imageService.ts`, `generate.ts` and `openaiKey.ts` (Generate), `editor.ts` and `editorHtml.ts` (the editor), `redcode.ts` (REDcode's API) |
| `media/` | The pages' styles, the editor's script, and `card.js` (the game's item card emptied of its glyph, for Generate) |
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
