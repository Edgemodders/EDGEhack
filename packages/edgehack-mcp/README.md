# EDGEhack MCP server

[EDGEhack](https://edgemodders.github.io/EDGEhack/), the quickhack editor for Cyberpunk 2077, for AI assistants over MCP. An assistant can find and read the game's quickhacks, make new ones, change their costs, texts and effects, write their scripts, pack the mod, and try it live in the running game. It reads the game from your own install, through REDbridge.

It runs without VS Code. In VS Code, EDGEhack's **Connect an Assistant (MCP)...** command registers it with Claude Code for you.

## What it needs

| Part | Why |
|---|---|
| Node 20 or later | It runs the server |
| Cyberpunk 2077, game 2.5 | It reads the game's quickhacks from your own install |
| [REDbridge](https://github.com/Edgemodders/REDbridge) and .NET 10 | They read the game's files. REDcode in VS Code or REDnode's Mod Manager fetch both |
| A WolvenKit project | For mod files. Without one, new quickhacks go on EDGEhack's Desk |
| [REDnode](https://www.nexusmods.com/cyberpunk2077/mods/35419) 0.62.0 or later | Only for `hack_try` (in the running game) and for scripts (0.61.1) |

## Connect it

Claude Code, from the folder of your WolvenKit project:

```
claude mcp add --scope user edgehack -- npx -y @edgemodders/edgehack-mcp
```

Any other MCP client runs `npx -y @edgemodders/edgehack-mcp` over stdio.

| Option | Variable | What it sets |
|---|---|---|
| `--project <folder or .cpmodproj>` | `EDGEHACK_PROJECT` | The WolvenKit project. Default: a project in the folder the server runs in; each call can also name one |
| `--bridge <REDbridge.exe or its folder>` | `REDBRIDGE_EXE` | REDbridge. Default: REDcode's setting, then the newest copy REDnode, EDGEdeck or REDcode fetched |
| `--game <folder>` | `EDGEHACK_GAME_PATH` | The game. Default: REDcode's or EDGEdeck's setting, then Steam's libraries |

Inside the game, REDnode starts the server for its own assistants and gives it the game's REDbridge (`REDNODE_BRIDGE_URL` and `REDNODE_BRIDGE_TOKEN`, a token for that start only, on 127.0.0.1), so no second REDbridge runs.

## Tools

| Tool | What it does | Asks first |
|---|---|---|
| `hack_find` | Searches the game's quickhacks and the documents in the project and on the Desk | No |
| `hack_describe` | A game quickhack's tiers in plain words, or a document with what it changes | No |
| `hack_effects` | The status effects to add, another quickhack's effects, and what EDGEhack can build | No |
| `hack_new` | A new quickhack from a game family, a document for changes to a family, or a Desk quickhack added to the project | Yes |
| `hack_edit` | Changes a document (costs, texts, icons, cooldown, effects, Get it, feature lines) and writes its mod files | Yes |
| `hack_script` | Writes a quickhack's scan check or on-land function, run by REDnode in the game | Yes |
| `hack_pack` | Packs the project into its packed folder | Yes |
| `hack_try` | Try Live: the quickhack in the running game through REDnode, with no packing; `stop` puts the game back | Yes |

Claude Code asks you before every call of a tool marked Asks first, in every permission mode. Every answer names the document's file, which opens in EDGEhack's editor in VS Code.

## License

MIT. The third-party notices for the bundled packages are in `THIRD-PARTY-NOTICES.txt`.
