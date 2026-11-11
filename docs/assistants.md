---
title: Assistants (MCP)
---

# <span class="y">Assistants</span> (MCP)

EDGEhack has an MCP server, so an AI assistant such as Claude Code can make and change quickhacks with you. It can find and read the game's quickhacks, make new ones, change their costs, texts and effects, write their scripts, pack the mod, and try it live in the running game. The server runs without VS Code, and reads the game from your own install through REDbridge.

## Connecting Claude Code

1. In VS Code, open EDGEhack's Desk view, then its **...** menu, and pick **Connect an Assistant (MCP)...**. The command palette has it too.
2. Pick **Connect Claude Code**. It registers EDGEhack for every Claude Code session.
3. Start a new Claude Code session in the folder of your WolvenKit project. Claude Code's `/mcp` lists `edgehack` with its eight tools.

The other choices copy the command, or a JSON entry for another MCP client, or show the server file. VS Code's own agents (1.101 and later) see the tools without this.

The server works in the project of the folder it starts in. A call can name another project. With no project, new quickhacks go on EDGEhack's Desk, as they do in the editor.

## What it can do

| Tool | What it does | Asks first |
|---|---|---|
| `hack_find` | Searches the game's quickhacks, and the quickhack documents in the project, on the Desk and in the EDGE Library | No |
| `hack_describe` | A game quickhack's tiers in plain words (RAM, upload, damage, duration, effects), or a document with what it changes, its warnings and its script | No |
| `hack_effects` | The status effects it can add, another quickhack's own effects, and what EDGEhack builds: damage over time, a stat change, a chance to apply | No |
| `hack_new` | A new quickhack from a game family (Clone and Modify), a document for changes to a family, or a Desk or Library quickhack added to the project | Yes |
| `hack_edit` | Changes a document, as the editor's page does: costs per tier or on every tier, texts, icons, cooldown, added effects, Get it, feature lines. Writes the mod files | Yes |
| `hack_script` | Writes a quickhack's scan check (`canUse`) or on-land function (`onLand`), which REDnode runs in the game | Yes |
| `hack_pack` | Packs the project into its packed folder, as REDcode's Pack does. It does not install the mod | Yes |
| `hack_try` | Try Live: the quickhack's records in the running game through REDnode, with no packing. `stop` puts the game back | Yes |

Claude Code asks you before every call of a tool marked **Asks first**, in every permission mode. Every answer names the document's file: open it in VS Code to see the change in EDGEhack's editor.

## What it needs

| Part | Why |
|---|---|
| REDbridge and .NET 10 | They read the game's files. REDcode or REDnode's Mod Manager fetch both. The server finds the newest copy |
| Cyberpunk 2077, game 2.5 | The server reads the game's quickhacks from your install. It finds Steam's, or the one REDcode or EDGEdeck is set to |
| REDnode 0.62.0 or later | Only for `hack_try`. Scripts run with REDnode 0.61.1 or later |

## Without VS Code

The same server is the npm package `@edgemodders/edgehack-mcp`, from EDGEhack's first release. Any MCP client runs it over stdio:

```
claude mcp add --scope user edgehack -- npx -y @edgemodders/edgehack-mcp
```

| Option | Variable | What it sets |
|---|---|---|
| `--project <folder or .cpmodproj>` | `EDGEHACK_PROJECT` | The WolvenKit project |
| `--bridge <REDbridge.exe or its folder>` | `REDBRIDGE_EXE` | REDbridge |
| `--game <folder>` | `EDGEHACK_GAME_PATH` | The game |

In the game, REDnode will start the server for its own assistant, REDagent, and share the game's REDbridge with it (H4.6). REDnode gives it a token for that start only, on 127.0.0.1.
