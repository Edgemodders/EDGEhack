---
title: Dev setup
---

# Dev setup

EDGEhack follows the EDGE platform's shared setup: [REDnode's dev setup](https://edgemodders.github.io/REDnode/dev-setup.html) installs Git, Node and VS Code, and sets the per-repository Git identity. This page lists what EDGEhack adds. Whenever a tool is installed or the setup changes, update this page in the same change, with exact versions and commands.

| Tool | Version | Why |
|---|---|---|
| Node | 24 (24.11.1 tested), npm 11.14.1 | Builds the extension |
| VS Code | 1.90 or later | Runs it |
| Python | 3.13.9 tested | `tools/brand/badges.py` (the README badges) |
| Chrome or Edge | Any recent | `tools/brand/render.ps1` renders the banner, social image, Nexus picture and icon headless |
| REDcode | 0.10.5 or later, from H1 on | The game folder, REDbridge, the project and Pack and Play. EDGEhack reads TweakDB through REDcode's REDbridge |
| Cyberpunk 2077 | 2.5 | The quickhacks EDGEhack reads; TweakXL and ArchiveXL in it for the mods it makes |

## Build

```powershell
git clone https://github.com/Edgemodders/EDGEhack.git
cd EDGEhack
npm install
npm run typecheck
npm run build       # bundles src/ to dist/extension.js
npm test            # unit tests (test/*.test.ts)
```

Press **F5** with the repository open in VS Code to run the extension in an Extension Development Host: **Run EDGEhack** in `.vscode/launch.json` builds first. The **Check** workflow typechecks, builds and tests every push to `main`.

## Package and release

```powershell
npm run package     # edgehack-<version>.vsix in the repo root (git-ignored)
npm run nexus-zip   # dist/EDGEhack-<version>-nexus.zip from that .vsix
```

Releases are made by the **Release** workflow on GitHub (Actions > Release > Run workflow), never from a terminal, and only after every hand test of the release has passed ([Tests](testing.html)). Before a release run:

1. Rename **Unreleased** in `CHANGELOG.md` to `## <version> (<date>)` and start a new empty one.
2. Update README.md's status line (`**Status: <version> released on <date>** ...`) and the `status` entry in `tools/brand/badges.py`, then `python -I tools/brand/badges.py docs/assets/brand/badges`, and the README's `<img alt>` for the badge.
3. For Nexus: the page must exist (there is none yet) and be in `nexus/nexus.json` ([nexus/README.md](https://github.com/Edgemodders/EDGEhack/blob/main/nexus/README.md)). To run the Nexus commands on a PC, check out [EDGErepo](https://github.com/Edgemodders/EDGErepo) beside this repo; the release workflow clones it by itself.

The workflow needs the Edgemodders organisation secrets `VSCE_PAT` (Marketplace), `OVSX_PAT` (Open VSX) and `NEXUS_KEY` (Nexus). If they are limited to selected repositories, EDGEhack must be added to them. **Verify publish tokens** (Actions) checks the two store tokens without publishing.

## Brand

```powershell
.\tools\brand\render.ps1    # banner, social, nexus and icon PNGs, then the badges
```

The sources are `tools/brand/brand.html` (banner `?banner`, social `?social`, Nexus `?nexus`) and `tools/brand/icon.html`. After a render, upload `docs/assets/brand/social.png` in the repo's Settings > General > Social preview (by hand: GitHub has no API for it).

## Git identity

Set per repository, never globally, as on every EDGE repository:

```powershell
git config user.name CyberbuildsAI
git config user.email 340969962+CyberbuildsAI@users.noreply.github.com
git config credential.https://github.com.username CyberbuildsAI
```
