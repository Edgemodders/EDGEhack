# Changelog

What changed in each EDGEhack release, for players. Each release takes its notes from its section here: the GitHub release, the Marketplace's changelog tab and the version's changelog on the Nexus Mods page.

How to keep it (the Edgemodders convention):

- With each change a player would notice, add a line under **Unreleased**, in its group: **New**, **Changed**, **Fixed** or **Other**. One change per line. Leave out test-only changes.
- Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty **Unreleased** above it.
- Links are full URLs, since the same text goes to GitHub and Nexus.

## Unreleased

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
