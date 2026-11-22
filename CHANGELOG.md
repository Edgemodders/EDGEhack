# Changelog

What changed in each EDGEhack release, for players. Each release takes its notes from its section here: the GitHub release, the Marketplace's changelog tab and the version's changelog on the Nexus Mods page.

How to keep it (the Edgemodders convention):

- With each change a player would notice, add a line under **Unreleased**, in its group: **New**, **Changed**, **Fixed** or **Other**. One change per line. Leave out test-only changes.
- Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty **Unreleased** above it.
- With the rename, write the section's **Nexus summary** under its heading: an HTML comment that starts `<!-- nexus` and ends `-->`, with one short plain line per change a player would notice, each starting `New:`, `Changed:`, `Fixed:`, `Other:` or `Needs:`, at most 120 characters and 12 lines, no markdown. Nexus shows each line as one entry in a small text field and cannot edit it once posted. The comment hides it on GitHub; the release workflow posts it with a "Full changelog" link and stops if it is missing or too long (EDGErepo's README, "Nexus changelogs").
- Links are full URLs, since the same text goes to GitHub.

## Unreleased

## 0.1.3 (2026-11-22)

<!-- nexus
Changed: Generate's OpenAI key lives in REDcode's Keys, the key store every EDGE tool shares
Changed: A key kept in VS Code's secret storage moves to REDcode's Keys by itself, once
Changed: After Don't Allow, Generate says how to undo it instead of asking for the key again
Changed: Generate's errors show in the Generate box, just above Generate
Needs: REDcode 0.10.16 or later and REDbridge 0.18.0 or later for the shared key store
-->

**Changed**

- Generate's OpenAI key is in REDcode's **Keys**, the key store every EDGE tool shares ([#3](https://github.com/Edgemodders/EDGEhack/issues/3)). REDcode asks once whether EDGEhack may read it, and with no key set asks for it in its own password box, saved for every tool. A key EDGEhack kept in VS Code's secret storage moves there by itself, once. **Set the OpenAI Key** opens REDcode's box; **Clear the OpenAI Key** points to REDcode's Keys, where Remove Key is. With a REDcode older than the store, the key stays in VS Code's secret storage as before. `OPENAI_API_KEY` in the environment still wins. After **Don't Allow**, Generate says how to undo it (Forget Tool Permissions for Keys in REDcode's Keys) instead of opening the password box again, with a REDcode that has `keys.status`. Needs REDcode 0.10.16 and REDbridge 0.18.0.
- Generate's errors, such as OpenAI refusing the key, show in the Generate box under what the icon shows, just above Generate, instead of at the top of the page.

## 0.1.2 (2026-11-11)

<!-- nexus
Changed: New name, EDGEhack: Cyberpunk 2077 Game Mod Editor, and a description saying it edits the game's quickhacks
-->

**Changed**

- EDGEhack's name in the extension lists is now "EDGEhack: Cyberpunk 2077 Game Mod Editor", and its description and Marketplace page say plainly that it is a mod editor for the video game Cyberpunk 2077, where quickhacks are in-game abilities, and not a security or hacking tool. Nothing else changed.

## 0.1.1 (2026-11-11)

**Changed**

- Generate's OpenAI key is kept in VS Code's own encrypted secret storage, for EDGEhack only, and asked for once the first time you Generate; `OPENAI_API_KEY` in the environment still wins. EDGEhack no longer reads or writes the EDGE tools' shared key store, so a key saved there by another EDGE tool is asked for again. **EDGEhack: Set the OpenAI Key...** and **Clear the OpenAI Key...** work on EDGEhack's own copy.

**Other**

- The VS Code Marketplace refused 0.1.0 and 0.1.1 ("suspicious content", with no reason given); both are on GitHub and Open VSX, and 0.1.1 on Nexus Mods. The Marketplace listing is being sorted out.

## 0.1.0 (2026-11-11)

The first release, for game 2.5. A preview: every part below passed its tests, in the game where it changes the game. Guide: https://edgemodders.ai/wiki/edgehack/

**New**

- **The Quickhacks view:** the game's quickhacks by category, family and tier, with their icons, then device and vehicle hacks, with a filter. **Open in EDGEhack** on any record in REDcode's TweakDB view, and **EDGEhack: Open a Quickhack...**, open any record of a quickhack.
- **A quickhack in plain words:** every tier's texts, icons, RAM, upload time, cooldown, duration and damage, its effects, and what scales each number in the game.
- **Edit** a game quickhack: its name, description, wheel text, icons, RAM, upload, duration, damage and cooldown, for one tier or every tier at once (**All tiers**). Your numbers are kept as numbers, so they survive game patches.
- **Clone and Modify:** a new quickhack beside the game's, with its own records, cooldown and action name, which enemies take. Its **Get it** sells and crafts each tier the way the game's tier it started from is.
- **Add Effect:** another quickhack's effect, which follows that quickhack's tiers (**Copy Existing**); any status effect, on the target or on V (**Status Effects**); or one EDGEhack builds (**Make New**): a damage over time, a stat change while hacked, or a chance to apply. Poison and bleed are kept off machines.
- **Icons of your own:** **Upload** a picture for the Item, Wheel and Status icons, fitted to the game's size, or **Generate** one with OpenAI's GPT Image from your words, with your own OpenAI key. **Generate All** draws all three with one glyph.
- **Scripts:** a quickhack's own logic in JavaScript, which REDnode (0.61.1 or later) runs in the game: a scan check that decides per person whether it is usable, and a function when it lands.
- **Feature lines:** bullets of your own in the item's tooltip, from a tier up.
- **Try Live:** a quickhack's changes in the running game through REDnode (0.62.0 or later), with no packing, after you allow EDGEhack in the game; a new quickhack's tier goes in V's backpack, and **Stop** puts the game back.
- **The Desk:** quickhacks you work on outside a project, with **Add to Project**, **Duplicate** and **Remove**.
- **The EDGE Library:** **Add to Library** keeps a quickhack for good, in folders of your own, in the Library every EDGE tool shares; the **Library** view opens, adds to a project, copies to the Desk and removes them, and **Refresh from Library** takes a newer version into a project.
- **Assistants:** an MCP server, `@edgemodders/edgehack-mcp` on npm, lets Claude Code make and change quickhacks with you (**EDGEhack: Connect an Assistant (MCP)...**); REDagent gets the same tools in the game through REDnode. Every change asks you first.
- **Remove from Project** takes a quickhack's document and mod files out of a project (to the Recycle Bin), and its texts out of the onscreens file.
