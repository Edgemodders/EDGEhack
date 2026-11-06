# EDGE<span class="y">hack</span> docs

EDGEhack is a VS Code extension that edits Cyberpunk 2077's quickhacks. Open any quickhack and see its name, icon, tier, RAM, upload time, cooldown, duration, damage and effects in plain words; change them; make new quickhacks with buffs, debuffs and attack features from other quickhacks or the game's own status effects. It writes the mod as TweakXL and ArchiveXL files into a REDcode project.

| Document | What it covers |
|---|---|
| [Design](design.html) | How the game builds a quickhack, the editor, adding effects, the views, the Desk and Library, opening a quickhack from any tool, trying it in the game, the phases and the open questions |
| [Tests](testing.html) | Every test, with its steps for running again |
| [Dev setup](dev-setup.html) | Building, packaging and releasing EDGEhack |
| [Changelog](changelog.html) | What changed in each release |

## Roadmap status

As of 2026-11-05. Each phase ends with a hand test by the owner, and an in-game test where it changes the game.

| Phase | Status |
|---|---|
| H0 Scaffold | Built 2026-11-04: the repo, the release workflow, the brand, the docs site, an empty extension with its three views, and the design (draft 1), agreed by the owner the same day |
| H1 Read | Done 2026-11-04: the Quickhacks view, the read-only quickhack page and Open in EDGEhack from REDcode passed the hand test (EDGEhack 0.0.3) |
| H2 Edit | Done 2026-11-05: editing a game quickhack's texts, icons and numbers passed the hand test and the in-game test (EDGEhack 0.0.4). The player's line (H2d) tried and dropped by the owner |
| H3 New and Effects | Next: plan written 2026-11-05, to agree with the owner, starting with a spike |
| H3b Own icons | Not started: pick, upload or generate each icon (asked for by the owner on 2026-11-04) |
| H3c Scripts | Proposed 2026-11-05: two REDnode functions on a quickhack, a scan check per enemy and on land. Plan to agree; its spike runs with H3's |
| H4 Try Live and MCP | Not started |
| H5 Library | Not started |
| H6 First release | Not started |

EDGEhack is not affiliated with CD Projekt RED. Source code and issues: [github.com/Edgemodders/EDGEhack](https://github.com/Edgemodders/EDGEhack)
