# EDGE<span class="y">hack</span> docs

EDGEhack is a VS Code extension that edits Cyberpunk 2077's quickhacks. Open any quickhack and see its name, icon, tier, RAM, upload time, cooldown, duration, damage and effects in plain words; change them; make new quickhacks with buffs, debuffs and attack features from other quickhacks or the game's own status effects. It writes the mod as TweakXL and ArchiveXL files into a REDcode project.

| Document | What it covers |
|---|---|
| [Guide](https://edgemodders.ai/wiki/edgehack/) | For modders, on the EDGEweb wiki: install, your first quickhack, the editor, scripts, Try Live, the Desk and the Library, assistants, troubleshooting |
| [Design](design.html) | How the game builds a quickhack, the editor, adding effects, the views, the Desk and Library, opening a quickhack from any tool, trying it in the game, the phases and the open questions |
| [Assistants (MCP)](assistants.html) | EDGEhack's MCP server: connecting Claude Code, and what an assistant can do with quickhacks |
| [Tests](testing.html) | Every test, with its steps for running again |
| [Dev setup](dev-setup.html) | Building, packaging and releasing EDGEhack |
| [Changelog](changelog.html) | What changed in each release |

## Roadmap status

As of 2026-11-11. Each phase ends with a hand test by the owner, and an in-game test where it changes the game.

| Phase | Status |
|---|---|
| H0 Scaffold | Built 2026-11-04: the repo, the release workflow, the brand, the docs site, an empty extension with its three views, and the design (draft 1), agreed by the owner the same day |
| H1 Read | Done 2026-11-04: the Quickhacks view, the read-only quickhack page and Open in EDGEhack from REDcode passed the hand test (EDGEhack 0.0.3) |
| H2 Edit | Done 2026-11-05: editing a game quickhack's texts, icons and numbers passed the hand test and the in-game test (EDGEhack 0.0.4). The player's line (H2d) tried and dropped by the owner |
| H3 New and Effects | Done 2026-11-10: Clone and Modify (H3.3), Add Effect and Machines (H3.4, H3.4b), Build one (H3.5), Get it (H3.6) and the Desk (H3.7) all passed their tests, in the game where they change it |
| H3b Own icons | Done 2026-11-11: Upload (H3b.2) and Generate with OpenAI (H3b.3) passed, in the game too (EDGEhack 0.0.25) |
| H3c Scripts | Done 2026-11-11: REDnode's quickhack functions (REDnode 0.61.1), the Scripts section (H3c.3) and Pack and Play with the mod's REDnode package (H3c.4) passed in the game (EDGEhack 0.0.27) |
| H3d Feature lines | Done 2026-11-11: bullets of the modder's own in the item's tooltip passed in the game (EDGEhack 0.0.28) |
| H4 Try Live and MCP | Under way: Try Live (H4.1 to H4.3) passed in the game on 2026-11-11 (EDGEhack 0.0.29, REDnode 0.62.1); live names parked. H4.4, the core outside VS Code, built and checked on 2026-11-11. H4.5, the MCP server and Connect an Assistant, passed its hand test with Claude Code on 2026-11-11 (EDGEhack 0.0.30). H4.6, REDagent in the game (REDnode 0.63.0, REDagent 0.4.2), passed in the game on 2026-11-11. **H4 is done** |
| H5 Library | Done 2026-11-11: passed its hand test (EDGEhack 0.0.31). Plan agreed with the owner on 2026-11-11 (design, "H5 Library: plan"): two fixes from H4, the `quickhack` kind on EDGEbuilder, Add to Library, the Library view, Refresh from Library, and assistants listing and taking from it |
| H6 First release | Plan agreed with the owner on 2026-11-11 (design, "H6 First release: plan") |

EDGEhack is not affiliated with CD Projekt RED. Source code and issues: [github.com/Edgemodders/EDGEhack](https://github.com/Edgemodders/EDGEhack)
