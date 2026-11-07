---
title: Design
---

# EDGEhack design

**Draft 1, agreed by the owner on 2026-11-04** ("Your design looks good, I think we can proceed"), with the recommendation in each open question taken as the answer. H1 is under way.

EDGEhack is the EDGE platform's quickhack editor for Cyberpunk 2077: a VS Code extension (`edgemodders.edgehack`) with its own activity bar icon. Open any quickhack in the game and see and change everything about it: its name, icon, tier, RAM cost, upload time, cooldown, duration, damage, and the effects it applies. Make new quickhacks, and add buffs, debuffs and attack features to one, taken from other quickhacks or from any of the game's status effects that can be applied to an enemy.

## What the owner asked for (2026-11-04)

| Ask | Where in this design |
|---|---|
| A top-level extension with its own activity bar icon | [Views](#views) |
| A **Desk** and a **Library** | [Desk and Library](#desk-and-library) |
| The game's quickhacks as a view: Game Assets filtered to quickhacks, or simply "Quickhacks" | [Views](#views): one view named **Quickhacks** |
| Clicking a quickhack anywhere in the tools (REDcode or any other) opens the editor | [Opening a quickhack from anywhere](#opening-a-quickhack-from-anywhere) |
| See and change the icon, the name and every attribute | [The editor](#the-editor) |
| Add new buffs, debuffs or attack features, combining effects from other quickhacks or any status effect that can be applied to enemies | [Adding effects](#adding-effects) |
| The repo, build and brand scaffolding | Done with this draft (H0) |

## How the game builds a quickhack

Read on game 2.5 on 2026-11-04 through REDbridge (`tweakdb.record`, `tweakdb.records`, the game's own `tweakdb_ep1.bin`), and from the game's scripts for how the quickhack list is made (`RPGManager.GetPlayerQuickHackListWithQuality`, still in 2.5's types). A quickhack is **TweakDB records only**: no archive file holds one. Its icons are the only part that lives in archives, as parts of `.inkatlas` files.

### The chain of records

Overheat at tier 3 (`Items.OverheatLvl2Program`) as the example:

| Record | Type | What it holds |
|---|---|---|
| `Items.OverheatLvl2Program` | `Item`, `itemType` = `ItemType.Prt_Program` | The thing in the inventory: `displayName` (LocKey#27962 "Overheat"), `localizedDescription` (the flavour text), `quality` (`Quality.Rare`), `iconPath` (`quickhack_overheat`), `objectActions`, `OnAttach` and `OnEquip` (packages while it sits in the cyberdeck), `CraftingData`, `buyPrice` and `sellPrice`, `tags`, `shardType` |
| `QuickHack.OverheatLvl2Hack` | `ObjectAction` | What happens when it is used: `actionName` (`Overheat`), `hackCategory` (`HackCategory.DamageHack`), `activationTime` (upload: `QuickHackUpload` +2), `costs` (RAM), `instigatorPrereqs` (V has a cyberdeck, the cooldown is not running), `targetActivePrereqs` (who it works on), `startEffects`, `completionEffects`, `objectActionUI`, `priority`, `awarenessCost`, `isQuickHack`, `objectActionType` (`PuppetQuickHack`) |
| `QuickHack.BaseOverheatHack_inline5`, `QuickHack.MemoryIncreaseTier4` | `StatPoolCost` | RAM: 3 from the base hack plus 3 for the tier, each scaled by cost modifiers (V's RAM cost reduction, the target's hacking resistance) |
| `QuickHack.OverheatLvl2Hack_inline3` | `ObjectActionEffect` | One effect: a `recipient` (`Target` or `Instigator`) and either a `statusEffect` or an `effectorToTrigger` |
| `BaseStatusEffect.OverheatLevel2` | `StatusEffect` | The debuff on the target: `duration`, `maxStacks`, `packages`, `gameplayTags` (`Debuff`, `DoT`, `Quickhack`, `Overheat`), `statusEffectType` (`Burning`), `immunityStats` (`BurningImmunity`), `uiData` (name and icon on the target's status bar), `VFX`, `SFX`, `AIData` (how the NPC reacts) |
| `BaseStatusEffect.OverheatLevel2_inline3` | `ContinuousAttackEffector` | The damage: every 0.25 s an attack, `Attacks.OverheatQuickHackAttackLevel2` (`Attack_GameEffect`, thermal, 15.625 a hit, hit flags `QuickHack`, `Overheat`, `DamageOverTime`) |
| `BaseStatusEffect.OverheatCooldown` | `StatusEffect` on V | The cooldown: put on V by a start effect, checked by `instigatorPrereqs` |
| `Interactions.OverheatHack` | `InteractionBase` | The quickhack wheel's entry: `caption` (the name), `captionIcon` (`ChoiceCaptionParts.OverheatIcon` → `UIIcon.Overheat`, part `Overheat` of `quickhacks_icons.inkatlas`), `description` (the wheel's text) |
| `EquipmentGLP.OverheatProgramLvl2` | `GameplayLogicPackage` | The tooltip line for the tier (`UIData.localizedDescription`) |
| `EquipmentGLP.OverheatPassiveLvl2` | `GameplayLogicPackage` | A passive while it is in the deck: Overheat's lasts longer when a hit lands on a burning target |
| `Items.Recipe_OverheatLvl2Program` | `ItemRecipe` | The crafting spec; `Items.OverheatLvl2CraftingPackage` lists the components |

Every quickhack shares four effects (`QuickHack.QuickHack_inline2`, `_inline6`, `_inline8`, `_inline9`): armor down while hacked, refresh Ping, the target marked as quickhacked, and V's short upload status. A change to a shared record changes every quickhack, so EDGEhack must copy a shared record before changing it (see [Writing a mod](#writing-a-mod)).

### Tiers, families and variants

| Fact | What it means for EDGEhack |
|---|---|
| A quickhack comes in tiers, one item each: `Items.OverheatProgram` (Common), `OverheatLvl1Program` (Uncommon), `Lvl2` (Rare), `Lvl3` (Epic), `Lvl4` (Legendary), `Lvl4PlusPlus` (Legendary++) | The editor shows a **family** with a column per tier. The Quickhacks view groups by family |
| Each item's `objectActions` lists its own action **and every lower tier's** | The game keeps one action per `actionName` and type (`RemoveDuplicatedHacks`); the last listed wins. A new tier must list the lower ones too, as the game's do |
| Each tier has three actions: the normal one, `Boss…` and `Chimera…` (`QuickHack.BossOverheatLvl2Hack`, `actionName` `BossOverheat`), with their own effects | How the game picks the Boss or Chimera action for a target is **unverified** (not in the script code read so far). The editor shows them as "against bosses" under the normal action, and a change applies to all three unless the modder splits them |
| Spread (Overheat spreads to nearby enemies when V has a way to spread it: the Spillover perk with Overclock active, Copy-Paste, or a cyberdeck's ability) is two more actions per tier (`…HackSpread`) started by `SpreadInitEffector` and `SpreadEffector` | Spread is one switch in the editor; EDGEhack keeps the Spread actions in step |
| Icons: the item's (`iconPath` → `UIIcon.quickhack_overheat`, in `item_icons21.inkatlas`), the wheel's (`UIIcon.Overheat`, in `quickhacks_icons.inkatlas`), and the status effect's (`uiData.iconPath`, on the target's status bar) | The editor shows all three, each picked separately, with "same as the item" as the default for a new quickhack |
| Texts live in five places: the item's `displayName` and `localizedDescription`, the wheel's `caption` and `description`, the tier's tooltip line in `OnAttach` | The editor has one **Name** and one **Description** that fill them all, with "different text on the wheel" as an option |

### The pools to pick from

| Pool | Count in 2.5 | Notes |
|---|---|---|
| Quickhack items (`ItemType.Prt_Program`) | 92 | 18 families a player sees (Blackwall Gateway, Reboot Optics, Synapse Burnout, Request Backup, Sonic Shock, Contagion, Cyberware Malfunction, Short Circuit, Detonate Grenade, Cripple Movement, Cyberpsychosis, Memory Wipe, Overheat, Ping, Suicide, System Collapse, Weapon Glitch, Bait), plus internal items with no name (`Items.CyberdeckProgram`, `Items.QuickHackUnlock`, the category items such as `Items.DamageHack`) and a quest's copy of Ping. Blackwall Gateway names its tiers after `Program` (`Items.BlackWallProgramLvl2`) |
| Quickhack actions (`isQuickHack`) | 417 | 299 on people (`QuickHack.*`), 66 on devices (`DeviceAction.*`), 47 used by enemy netrunners on V (`AIQuickHack.*`), 5 on vehicles |
| Status effects | 1,679 | 515 tagged `Debuff`, 635 with UI data. Grouped by `statusEffectType`: Misc 1,075, PlayerCooldown 65, PassiveBuff 52, Blind 44, Burning 37, Berserk 36, Wounded 33, Jam 25, Stunned 23, Poisoned 23, EMP 23, ... |
| Effectors | 3,734 in about 70 classes | Most used: `ApplyStatGroupEffector`, `ApplyStatusEffectEffector`, `ModifyStatPoolValueEffector`, `SpreadEffector`, `ModifyDamageEffector`, `TriggerContinuousAttackEffector`, `RemoveStatusEffectsEffector` |

Not every status effect works on an enemy: many are V's own (cooldowns, cyberware buffs, `PlayerCooldown`), some belong to a boss fight (`Chimera.*`, `AdamSmasher.*`, `Oda.*`), some need an NPC state (`AIData` prerequisites such as `NPCType.Human`). The picker sorts them into **Works on enemies**, **V's own** and **Boss fights**, from their tags, type, prefix and where the game already uses them (an effect some quickhack or grenade already puts on a target is the safest pick). The sorting rules are part of H3 and are checked in the game.

## Writing a mod

A quickhack mod is plain files a modder can read:

| Part | Format | Needs |
|---|---|---|
| Records (changes and new ones) | TweakXL YAML in `r6/tweaks/<mod>/` | TweakXL |
| New names and descriptions | An ArchiveXL `onscreens` file, keys the mod owns | ArchiveXL |
| New icons | An `.inkatlas` and its `.xbm`, packed in the mod's archive, listed in the `.xl` file | ArchiveXL |
| Behaviour no record can express | REDnode functions ([H3c Scripts](#h3c-scripts-plan)); one small shared script, if [H3's spike](#h3-plan) confirms new quickhacks need it | REDnode, for a mod with functions; redscript, for a new quickhack |

**EDGEhack's own document.** The modder's work is a `<name>.quickhack.json` file in the project's `source/raw/edgehack/` (or on the Desk): what the quickhack starts from, what changed, the effects added, the texts and icons. EDGEhack writes the YAML, the `onscreens` file and the atlas from it, into REDcode's project, on **Add to Project** and on every save after that. The written YAML carries a header saying it is made by EDGEhack. This is EDGEwave's way (`.edgewave` document, rendered WAV) and EDGEquest's. The reasons: the YAML for one quickhack spans many records with generated names; a document in the modder's words survives a change of how EDGEhack writes it; and a modder can still open and read the YAML.

**Changing a game quickhack** writes TweakXL changes to its own records (`Items.OverheatLvl2Program: { … }`). Records it shares with other quickhacks (the four common effects, `BaseOverheat_inline0` that every Overheat tier uses) are copied under the mod's names first and the copy is changed, so nothing else changes by accident. A copy is a new record id, so the YAML stays small: only what differs.

**A new quickhack** is a copy of a family under the mod's own ids (`Items.EDGEhack_<Name>Program`, `QuickHack.EDGEhack_<Name>Hack`, ...) with TweakXL's `$base`, then the changes. It also has to reach the enemy's own list of hacks ([H3: plan](#h3-plan)). And it needs a way into V's hands: a crafting spec V knows from the start, a vendor's stock, or a gift through REDnode's console while testing. The editor's **Get it** section picks one.

Names given to new records are fixed once written (saves and other mods refer to them); renaming the quickhack later changes only its texts.

## The editor

A custom editor for `.quickhack.json`, opened from the Quickhacks view, the Desk, the Library, REDcode, or another tool. For a game quickhack with no document yet, it opens a read-only view of the game's records, with **Edit** (makes the document on the Desk) and **Clone and Modify**.

Words are the modder's, not TweakDB's. The page:

| Section | What it shows and changes | Records behind it |
|---|---|---|
| Header | Icon, name, category (Damage, Control, Covert, Ultimate, Device), the family's tiers as tabs or columns | `displayName`, `hackCategory`, `quality` |
| Texts | Name, description, wheel text, the tier's tooltip line | `displayName`, `localizedDescription`, `objectActionUI.caption`/`description`, `OnAttach` UI data |
| Icons | Item icon, wheel icon, the status icon on the target | `iconPath`, `captionIcon`, `uiData.iconPath` |
| Costs | RAM, upload time, cooldown | `costs`, `activationTime`, the cooldown status effect's `duration` |
| Effects | One row per effect on the target or on V: what it is, how long, how many stacks, damage per tick and type, its icon | `completionEffects`, `startEffects`, the status effects and their packages |
| Works on | Humans, mechanical, drones; bosses (with the boss variant's own numbers); what stops it (immunity, already uploading) | `targetActivePrereqs`, the Boss and Chimera actions |
| Spread | On or off, how far, how many | The Spread actions and effectors |
| While equipped | Passive bonuses while it is in the deck | `OnEquip` packages |
| Get it | Crafting spec, vendor, price | `CraftingData`, recipes, `buyPrice`/`sellPrice` |
| Advanced | Every record behind the page, read-only, each opening in REDcode's record page | The whole chain |

Numbers show the game's values next to the changed ones, and each tier's value, so a modder can see the curve. A number that is a formula in the game (cost scaled by the target's resistance) shows the base value and says what scales it.

## Adding effects

**Add Effect** opens a picker with three sources:

| Source | What a pick adds |
|---|---|
| **From another quickhack** | Pick a quickhack, then one of its effects (Short Circuit's EMP shock, Contagion's poison, Reboot Optics' blind). The effect comes with its status effect, damage and icon |
| **Status effects** | Any status effect sorted as **Works on enemies**, searched by name, tag and type (Burning, Stunned, Blind, Poisoned, ...) |
| **Attack features** | Built from parts, not picked whole: extra damage (an attack every N seconds, a damage type), a stat change while hacked (armor, accuracy, speed), spread, a chance to apply something else. These are new status effects EDGEhack writes, from the game's own effector classes |

An added effect is **referenced** when it is unchanged (the YAML adds the game's record to the action's effect list) and **copied** as soon as the modder changes its duration, stacks or damage. The effects list shows which is which.

Combining has rules the editor checks, each as a warning, not a block:

- Two effects of the same `statusEffectType` may replace each other on the target. Two different burns ran side by side in H3.1's test, so Burning and Misc give no warning; other types are unverified.
- The same status effect twice on a tier, its own and an added one: one upload may count as two stacks, or as one. Unverified.
- A status effect with no duration may stay until something removes it. Unverified.
- Effects with `PlayerCooldown`, cyberware or boss-fight tags are V's or a boss's: shown only with **Show all**, with a warning if one goes on a target.
- The cooldown, the "was quickhacked" mark and the RAM cost always stay; they are not in the effects list.

The editor also shows **notes**, apart from the warnings. A warning means something may not work as the modder expects: the game may do something irregular, or nobody has seen it run. A note is the game working as designed, worth knowing when combining (the owner's distinction, 2026-11-07). Notes are grey with an info mark; warnings are yellow.

- An effect whose `AIData` needs a kind of NPC (humans only) has no reaction on the rest, but the effect itself runs on them: a drone took Contagion's poison (Human only) and a bleed in H3.4's test.
- A burn and Contagion's poison on one tier: Contagion Epic and better give V a passive in the cyberdeck (`EquipmentGLP.ContagionLvl3Passive`). A hit on a burning target removes every poison tagged `ContagionPoison`, and the game's own Epic and better poisons (`ContagionPoisonLvl3`, `Lvl4`, `Lvl4PlusPlus`, checked by record name) explode too (`Attacks.ContagionBurnCombo`). So a copy with changed numbers is removed without the explosion. Found in H3.4's test; without that Contagion in the deck, both ran for their whole time.

## Views

The activity bar container **EDGEhack** (icon: a quickhack shard in the HUD brackets) with three views:

| View | What it lists | Actions |
|---|---|---|
| **Desk** | Quickhacks being worked on that are not in a project yet, newest first; then a **Project** group with the open REDcode project's quickhacks | Open, Add to Project, Add to Library, Duplicate, Remove |
| **Library** | The shared EDGE Library's `quickhack` items | Open, Add to Project, Copy to the Desk |
| **Quickhacks** | The game's quickhacks: People (by category, then family, then tier), Devices, Vehicles. A filter as REDcode's. Each family shows its icon and name | Open (read-only view), Edit, Clone and Modify, Open in REDcode (the record page) |

"Quickhacks" rather than "Game Assets": the view lists TweakDB records, not archive files, and "Game Assets" in REDcode and EDGEwave means archive files. Enemy netrunners' hacks (`AIQuickHack.*`) are left out at first.

## Desk and Library

Following the shared rules in EDGEbuilder's `docs/library.md` (draft 3):

- **Desk:** `%LOCALAPPDATA%\EDGEhack\desk\<name>.quickhack.asset\`, already in the Library's item shape, as EDGEfab's Desk is, so Add to Library is a copy. Each folder has `asset.json` and `source/raw/edgehack/<name>.quickhack.json`; written YAML and atlas only appear once it goes into a project. A quickhack made with no project open lands on the Desk.
- **Library:** the shared root in `%APPDATA%\EDGE\library.json`, items `<name>.quickhack.asset/` with `asset.json` (`kind: "quickhack"`, `main` the `.quickhack.json`). The kind `quickhack` is new: EDGEbuilder owns the list of kinds, so EDGEhack asks there with a `request` issue (to agree with the owner first). Add to Project writes the came-from note `source/library.json` as the shared rules say.

## Opening a quickhack from anywhere

Today there is no shared way: REDcode calls other tools' commands it knows by name (`edgewave.openSound`, `edgemat.openMesh`), and other tools add menu entries to REDcode's views by `viewItem`. REDcode's TweakDB view marks every record the same way (`tweakRecord`), so a menu entry cannot show only on quickhacks.

Proposed, in two steps:

1. **H1, with no change elsewhere:** EDGEhack's command `edgehack.openQuickhack` takes a record path or id, a REDcode tree node, a REDcode record page's record, or a `.quickhack.json` URI, and finds the family from any record in the chain (the item, any tier's action, a Boss or Spread action, the recipe). EDGEhack adds **Open in EDGEhack** to REDcode's TweakDB view menu for every record, and the command says "not a quickhack" for the rest. Other EDGE tools can call the command.
2. **A REDcode request, an open contract for every EDGE tool:** each tool declares in its `package.json` what it opens, and REDcode reads it from `vscode.extensions.all` without starting the tool:

   ```json
   "edgemodders": {
     "opens": [
       { "tweakdb": { "type": "Item", "flat": "itemType", "is": "ItemType.Prt_Program" }, "command": "edgehack.openQuickhack" },
       { "tweakdb": { "type": "ObjectAction", "flat": "isQuickHack", "is": true }, "command": "edgehack.openQuickhack" },
       { "files": "**/*.quickhack.json", "command": "edgehack.openQuickhack" }
     ]
   }
   ```

   REDcode then shows **Open in EDGEhack** first on a matching record, in its TweakDB view, its record page and its search results, and a click on a quickhack opens EDGEhack. The same contract would cover EDGEwave's sounds and EDGEmat's materials, which are hard-coded in REDcode today. To file on REDcode once the owner agrees the shape.

## Trying it in the game

Two ways, both through REDnode:

| Way | How | When |
|---|---|---|
| **Pack and Play** | REDcode packs the project (YAML in `r6/tweaks`, the archive with icons and texts) and starts the game | H2: works today, the game restarted for each change |
| **Try Live** | EDGEhack sends the records to the running game through REDnode, which writes them with TweakXL (`tweakdb.set`, `clone`, `create`; undone when the try ends), gives the quickhack to V and refreshes V's quickhack list | H4: needs REDnode work |

Try Live needs from REDnode (REDnode issues, to file when H4 starts):

- TweakDB writes on REDnode's **editor channel** (`%LOCALAPPDATA%\REDnode\editor.json`), which today has only `info`, `sound.play` and `sound.stop`: `POST /editor/tweakdb.apply` with a batch of records, undone on `/editor/tweakdb.reset` or when the editor goes away. An in-game **Allow** for the editor, as planned for archives.
- A refresh of V's quickhack list: the game caches it (`PlayerPuppet.GetCachedQuickHackList`, `ChacheQuickHackList`). Whether TweakDB changes reach an equipped quickhack without unequipping it is **unverified**; H4 starts with a spike.
- New icons need an archive swap (REDswap, through `archives.reload`); new texts in an `onscreens` file may need a game restart (**unverified**).

## MCP tools

EDGEhack gets an MCP server in H4, so REDagent, and Claude Code through EDGEchat, can make and change quickhacks. Every editor feature has a tool, and every tool's result can be opened in the editor. Agreed with the owner on 2026-11-06, with the routes and the rule below.

| Tool | What it does | Asks first |
|---|---|---|
| `hack_find` | Search the game's and the project's quickhacks | No |
| `hack_describe` | A quickhack in the editor's words | No |
| `hack_effects` | The effect pool, sorted, and the parts attack features are built from | No |
| `hack_new`, `hack_edit` | Make or change a quickhack, writing the document. Added effects and attack features go through these | Yes |
| `hack_script` | Write a quickhack's scan check or on-land function (H3c) | Yes: it is code that runs in the player's game |
| `hack_pack` | Pack a finished quickhack, so it can reach the game | Yes |
| `hack_try` | Try Live | Yes |

`hack_script` and `hack_pack` are the two names added on 2026-11-06, for what the first list lacked. Whether `hack_pack` wraps REDcode's `project_pack` or calls REDbridge itself is settled in H4.

### Two routes to the server

The server runs without VS Code, as EDGEmat's npm package does, because REDagent runs inside the game and cannot count on an open editor.

| Assistant | How it gets the tools | What H4 does |
|---|---|---|
| **Claude Code, through EDGEchat** | The plugin lists each EDGE server, with one settings form | Publish the server on npm and add it to EDGEchat's plugin. The server's own tool text explains the tools, as EDGEmat's does; a skill only if that proves too little |
| **REDagent** | REDnode ships EDGEmat's server and starts it for in-game assistants (`packages/overlay/attached.js`), with the game folder and REDbridge. Its tools show in the Tools Manager | A `request` issue on REDnode, filed when H4 starts, to attach EDGEhack's server the same way, and REDagent's briefing learns the tools. It reaches players with a REDnode release |

An assistant in the game has no REDcode project open. `hack_new` with no project lands on the Desk (H3.7), so how REDagent's quickhack gets from there into a project to pack is settled in H4.

### Logic outside the editor

Anything a tool needs stays free of VS Code. This holds from H3.3 on, so H3 to H3c do not have to be moved apart later.

| Where | State on 2026-11-06 |
|---|---|
| `catalog`, `document`, `icons`, `newHackScript`, `png`, `projectFiles`, `quickhack`, `read`, `records`, `tweaks` | Free of VS Code. They take only types from `redcode.ts`, so those types move to a file of their own in H4 |
| `hub.ts`, `editor.ts` | Import VS Code, and hold two small pieces a tool needs: finding and caching a family (`hub.ts`), and writing a saved document into the project (`editor.ts`, `writeTweaks` then `writeProject`). Both move out by H4 |
| `BridgeClient`, `ProjectRef` | Interfaces, filled by REDcode today. The server fills them itself, from the REDbridge and folders it is given |

## What EDGEhack depends on

| Part | For | Required |
|---|---|---|
| REDcode (`edgemodders.redcode-cyberpunk`, API 1) | The game folder, REDbridge, the project, Pack and Play, the record pages | Yes, as `extensionDependencies` (the Quickhacks view needs REDbridge) |
| REDbridge | TweakDB reads (`tweakdb.*`), texts (`loc.*`), icons (`texture.toPng` for atlas parts), packing | Yes, through REDcode |
| TweakXL and ArchiveXL | In the player's game, for the mods EDGEhack makes | Yes, in the mod's requirements |
| REDnode | Try Live (H4); a quickhack's functions (H3c) | No, except in the player's game for a mod with functions |
| EDGE Library | The Library view | No: never required |

New REDbridge needs, if any, are asked for as `request` issues on REDbridge. One is likely in H5: building an `.inkatlas` from images.

## Phases

Each phase ends with a hand test by the owner (and an in-game test where marked); the next phase starts after it passes.

| Phase | What | Test |
|---|---|---|
| **H0 Scaffold** | This draft: the repo, the release workflow, the brand, the docs site, the design. An empty extension with the three views | Done when the owner agrees the design |
| **H1 Read** | The Quickhacks view (families, tiers, icons, filter); the editor read-only for game quickhacks: every section above, with the game's values per tier and the effects resolved into words; Open in EDGEhack from REDcode's TweakDB view; `edgehack.openQuickhack`; the open contract filed on REDcode | Hand test |
| **H2 Edit** | The `.quickhack.json` document; edit a game quickhack's texts, icons (picked from the game's atlases), costs, durations and damage; shared records copied; YAML and `onscreens` written into REDcode's project; Pack and Play | Hand test, and in the game: a changed Overheat shows the new name, icon and numbers and burns as set |
| **H3 New and Effects** | Make a new quickhack from a family; Add Effect from other quickhacks and status effects (the sorted pool); attack features; Get it (crafting spec, vendor); the Desk | Hand test, and in the game: a new quickhack crafted or bought, with two added effects working on an enemy |
| **H3b Own icons** | Each icon can be picked from the game, uploaded, or generated from a text prompt (see [Own icons](#own-icons-h3b)); the image goes into an atlas the mod ships | Hand test, and in the game: a new quickhack with its own icons in the inventory, on the wheel and on the target |
| **H3c Scripts** | Two REDnode functions on a quickhack: a scan check (enabled or disabled per enemy) and on land (any logic). REDnode's `quickhacks` API, then the page's Scripts section (see [H3c Scripts: plan](#h3c-scripts-plan)). Its spike runs with H3's | Hand test, and in the game: a new quickhack disabled on the wrong enemy, with extra damage on land by the enemy's health |
| **H4 Try Live and MCP** | Try Live through REDnode (after its spike and REDnode's editor channel work); the MCP server, running without VS Code, and Connect an Assistant, with tools for scripts and packing; EDGEchat's plugin and REDnode's attached servers as its two routes (see [MCP tools](#mcp-tools)) | Hand test and in-game test, with REDagent making a quickhack in the game |
| **H5 Library** | Add to Library and the Library view (after EDGEbuilder agrees the `quickhack` kind) | Hand test |
| **H6 First release** | 0.1.0 on the Marketplace, Open VSX, GitHub and Nexus Mods; the player guide; the README rule; the Nexus page | The release gate: every hand test passed |

Device and vehicle quickhacks are read in H1 and edited after H3, once the people's ones work.

### H1: built

Built on 2026-11-04 in EDGEhack 0.0.2, with 0.0.3 fixing the page's broken icons. **Passed the owner's hand test on 2026-11-04** ([Tests, "H1 Read"](testing.html#h1-read)).

| Part | File | What it does |
|---|---|---|
| REDcode's contract | `src/redcode.ts` | The parts of `REDcodeApi` 1 and its bridge client EDGEhack uses, copied as interfaces; `extensionDependencies` on REDcode |
| Records | `src/records.ts` | Reads records one at a time through REDcode's REDbridge (`tweakdb.record` with LocKey texts), kept in memory; LocKeys held as plain strings (UI data, prerequisites' failure texts) through `loc.get` |
| Reader | `src/read.ts` | A family's tiers in the editor's words: texts, the three icons, RAM, upload, cooldown, effects (status effects with duration, stacks, damage per hit, stat changes; effectors by kind), Works on, Spread, passives, the crafting spec, the Boss and Chimera actions, and every record read |
| Catalog | `src/catalog.ts` | Two `tweakdb.records` calls: the families (items of `ItemType.Prt_Program` with a name and an action of their own), and the device and vehicle hacks (captions from their wheel entries) |
| Icons | `src/icons.ts`, `src/png.ts` | The atlas as JSON (`cr2w.toJson`), its texture as PNG (`texture.toPng`), the part cut out in EDGEhack and kept in its storage folder; never shipped |
| Quickhacks view | `src/quickhacksView.ts` | People (by category, family, tier), Devices, Vehicles; the game's icons; Filter, Refresh, Open the Record in REDcode |
| The page | `src/page.ts`, `src/pageHtml.ts`, `media/page.css` | One panel per family: tier tabs, the Numbers table with a column per tier, and the tier's Texts, Icons, Effects, Works on, Spread, While equipped, Get it and Advanced; record links open REDcode's record page |
| Open from anywhere | `edgehack.openQuickhack` | Takes a record path or id, a family key, a REDcode TweakDB view node, or `{ record }`; finds the family from any record of it. **Open in EDGEhack** on every record in REDcode's TweakDB view |

Checked outside VS Code on game 2.5 through the real REDbridge (the session's scratchpad `qh/e2e.ts`): the catalog in about 12 s with TweakDB's first load, 18 families with every tier, 63 device and 4 vehicle hacks, each family read in 10 to 25 ms after that, 36 icons cut. The page rendered for Overheat and a device hack in headless Chrome (`qh/pageshot.ts`). 17 unit tests on made-up records.

Found while building it:

- Some items are not tiers: `Items.PingLvl3Program`, `Items.WhistleProgram` and `Items.CommsCallInProgram` have no action of their own (only a `counterpart`). The catalog leaves out an item with no action of its own, so Ping has four tiers and Bait six.
- An attack's damage adds up several modifiers: Overheat's tier 3 attack is 3 (the base attack's) plus 20 (its own), 23 a hit.
- The spread is plumbing in the effect lists (`SpreadInitEffector`, `SpreadEffector` and the `…HackSpread` actions): the page says it in Spread and leaves it out of Effects.
- Tooltips hold the game's placeholders (`{float_0}`, `{int_0}`), filled from stats at run time. The page shows them as they are for now.
- Three device hacks are captioned `!OBSOLETE` and one vehicle hack is a base record with no name; the view leaves them out.

### H2: plan

**Agreed with the owner on 2026-11-04.** It changes three things in this design, marked below.

**Numbers are written as differences (changed from "copy shared records first").** Each number the game adds up from modifiers gets one more modifier from the mod, holding the difference; the game's own records stay as they are. The game builds its tiers the same way (`QuickHack.MemoryIncreaseTier4` adds 3 RAM). This keeps the YAML short, needs no copies of shared records, and lets several mods add up rather than overwrite each other. Whether a negative difference works (RAM lowered) is the spike's main question.

| Number | What is written | Reach |
|---|---|---|
| RAM | `costs: - !append` a new `StatPoolCost` holding the difference | One tier |
| Upload | `activationTime: - !append` a new constant `QuickHackUpload` modifier | One tier |
| Damage | The attack's `statModifiers: - !append` a new constant damage modifier | One tier (attacks are per tier) |
| Duration | The status effect's `duration` pointed at a new group: the old modifiers plus the difference | The status effect, per tier where the game has one per tier; the page says so where tiers share one |
| Cooldown | The difference appended to the cooldown's duration group | **The whole family** (changed: its tiers share one cooldown status effect) |
| Against bosses | The same difference on the Boss and Chimera actions, unless the modder sets their own | Follows the tier |

**What belongs to the family, not a tier (changed from "a column per tier" for these).** The game shares these records across tiers, so the page shows them once: the name, the wheel text and the wheel icon (`Interactions.OverheatHack`, `ChoiceCaptionParts.OverheatIcon`), and the cooldown. The item's name, description and icon are set on every tier's item from the one value. Tooltip lines stay per record, since tiers list them cumulatively.

**Texts:** new keys in the mod's own `onscreens` file (REDbridge's `loc.newFile` makes it and its `.xl`), named `EDGEhack-<Mod>-<Field>`, and written in the YAML as `LocKey#EDGEhack-<Mod>-<Field>`, TweakXL's explicit form. Tooltip lines keep the game's placeholders (`{float_0}`); the editor warns when one is removed.

**Icons:** picked from the game's own `UIIcon` records. `iconPath` on the items, `texturePartID` on the wheel's caption part.

**The document's home (changed from "on the Desk").** In H2 a document needs an open REDcode project: `source/raw/edgehack/<name>.quickhack.json`, with the YAML in `source/resources/r6/tweaks/<mod>/<name>.yaml`. The Desk comes in H3 as planned, and takes over the case of no project.

**H2a's result (2026-11-04, game 2.5):** passed. The difference approach works, a negative one included, and the tooltip and the wheel show the changed numbers. `LocKey#<secondary key>` works.

**Fixes the spike showed, for H2c:** the page's Duration must work out modifiers that read the effect's own stats (Overheat is 5 s, not 2 s: `OverheatDurationIncrease` adds 3), and the page should give damage a second beside damage a tick, as the game's tooltip does.

**Steps:**

| Step | What | Test |
|---|---|---|
| **H2a Spike** | A hand-written test mod on Overheat, before any UI is built: a new name and wheel text, a new item icon and wheel icon, RAM up on one tier and **down** on another, upload down, damage up, duration up | In the game, by the owner: every change shows and works, in the inventory, on the wheel and on an enemy |
| **H2b Writer** | `src/tweaks.ts`, pure: a document and the game's records in, YAML and `onscreens` entries out. Unit tests on made-up records; a check that the output for a real family matches what the spike proved | Automated |
| **H2c Editor** | The custom editor for `.quickhack.json`: the page with inputs, the game's value beside each changed one, "apply to all tiers", icon pickers, undo through VS Code; **Edit** on the read-only page makes the document; each save writes the files into the project | Hand test, then in the game through Pack and Play |

The spike's YAML, to be packed with its `onscreens` file:

```yaml
# Numbers, as differences. Rare tier unless noted.
EDGEhack.Spike.RamUp:
  $type: gamedataStatPoolCost_Record
  statPool: BaseStatPools.Memory
  costMods: [EDGEhack.Spike.RamUpMod]
EDGEhack.Spike.RamUpMod: { $type: ConstantStatModifier, value: 2, modifierType: Additive, statType: BaseStats.Memory }
QuickHack.OverheatLvl2Hack.costs:
  - !append EDGEhack.Spike.RamUp

# The same with value -3 on QuickHack.OverheatLvl4Hack: RAM 9 becomes 6.

EDGEhack.Spike.UploadDown: { $type: ConstantStatModifier, value: -1, modifierType: Additive, statType: BaseStats.QuickHackUpload }
QuickHack.OverheatLvl2Hack.activationTime:
  - !append EDGEhack.Spike.UploadDown

EDGEhack.Spike.DamageUp: { $type: ConstantStatModifier, value: 50, modifierType: Additive, statType: BaseStats.ThermalDamage }
Attacks.OverheatQuickHackAttackLevel2.statModifiers:
  - !append EDGEhack.Spike.DamageUp

EDGEhack.Spike.DurationUp: { $type: ConstantStatModifier, value: 6, modifierType: Additive, statType: BaseStats.MaxDuration }
EDGEhack.Spike.Duration:
  $type: StatModifierGroup
  statModsLimit: -1
  statModifiers: [BaseStatusEffect.BaseOverheat_inline1, BaseStatusEffect.BaseOverheat_inline2, EDGEhack.Spike.DurationUp]
BaseStatusEffect.OverheatLevel2.duration: EDGEhack.Spike.Duration

# Texts and icons, for the family.
Items.OverheatLvl2Program.displayName: LocKey#EDGEhack-Spike-Name
Interactions.OverheatHack.caption: LocKey#EDGEhack-Spike-Name
Interactions.OverheatHack.description: LocKey#EDGEhack-Spike-Wheel
Items.OverheatLvl2Program.iconPath: quickhack_overload
ChoiceCaptionParts.OverheatIcon.texturePartID: UIIcon.OverLoad
```

What the spike answers:

- Does a negative difference lower RAM and upload, or does the game ignore or misread it?
- Does the wheel and the item's tooltip show the changed RAM, upload and damage, or do some read elsewhere?
- Does `LocKey#<secondary key>` work on the item's name and the wheel's caption and text?
- Does a quickhack already in the cyberdeck pick up the change on a fresh game start?
- Do the Boss versions keep their own numbers when only the normal action changes? (The spike changes only the normal one on purpose.)
- Whichever Boss or normal action the game uses on an ordinary enemy (H1's open question) shows here too.

### H2b and H2c: built

Built on 2026-11-04 in EDGEhack 0.0.4; passed the owner's tests, in the game too, on 2026-11-05 ([Tests, "H2c Edit"](testing.html#h2c-edit)).

| Part | File | What it does |
|---|---|---|
| The document | `src/document.ts` | `<mod>_<family>.quickhack.json` in the project's `source/raw/edgehack`: what the modder wants each number to be, not the difference, so a game patch keeps the modder's number. Missing means the game's |
| The writer | `src/tweaks.ts` | A document and the game's records in; YAML and text entries out. Differences on RAM, upload, damage and duration; Boss and Chimera actions get the same difference, or their own for RAM and upload. Warns when tiers that share a record want different changes |
| The project's files | `src/projectFiles.ts` | The YAML in `source/resources/r6/tweaks/<mod>/`, removed when the document changes nothing; texts merged into the project's `onscreens` file, keeping everyone else's. It leaves alone a YAML it did not make |
| The editor | `src/editor.ts`, `src/editorHtml.ts`, `media/editor.js` | A custom editor on the document's text, so VS Code's undo, save and dirty marker work. Messages run one at a time, each from the document's current text. **Edit** on the read-only page makes the document |
| The icon pickers | `Hub.quickhackIcons` | The game's `UIIcon.quickhack_*` for the item, the parts of `quickhacks_icons.inkatlas` for the wheel |
| The reader's fixes from H2a | `src/read.ts`, `src/pageHtml.ts` | A modifier reading the effect's own stat is worked out, so Overheat's duration is 5 s as in the game. Damage shows a second beside a hit |

**The smoke test** (`npm run smoke`, `tools/smoke/`) runs VS Code, the built extension and the real REDbridge on the game, with a stand-in REDcode holding a scratch project, and drives the pages over DevTools. It exists because of two bugs nothing else could catch: icons refused by the webview (0.0.2), and two quick changes losing one (found by its first run). Its second run passed every check. It stands in for REDcode's Pack and Play, so the real one is for the hand test.

### Two places, two numbers

Found in H2c's in-game test (2026-11-05): Rare at 11 s and 1 s upload in the inventory read 8 s and 0.455 s in the scanner's Hacking tab. Read in game 2.5's scripts; the upload and duration numbers fit, but the steps below were not each measured in the game. **No enemy changed these numbers.** The game works them out in two ways:

| Number | Inventory | Hacking tab |
|---|---|---|
| Upload | The hack's own modifiers: 2 - 1 = 1 s | The same, then V's upload reductions (`QuickHackUploadTimeDecrease` and the queue's two stats): 0.455 s here. The real upload uses these reductions too. The target's level is in the formula, but its curve (`pl_diff_to_upload_time_modifier`) is 0 everywhere in 2.5 |
| Duration | The duration group, with no object to read a stat from (2 + 6 = 8 s), plus the 3 s of `OverheatDurationIncrease` found in the effect's packages: 11 s | The same group on the target, whose `OverheatDurationIncrease` is 0 until it burns: 8 s |

So the tab's upload includes V's bonuses and the inventory's does not. For duration, the inventory's 11 s is likely the real burn, since the effect's package gives the target those 3 s while it burns and the effect has `dynamicDuration` (unverified: the burn was not timed). A game Overheat should show the same split: Epic, left alone, 5 s and 2 s in the inventory, and by these formulas 2 s and 0.91 s in the tab on this save (not checked). EDGEhack's page shows the inventory's numbers, so the two agree there.

### The player's line (H2d): dropped

**Dropped by the owner on 2026-11-04**, after its second spike: "it's fine this way". The game's tab stays as it is, and the Player line field is not built. What follows is kept for if it ever comes back: the first spike worked on every hack, and the second, on marked hacks only, showed no line on any hack (not looked into; likely the mark, a new flat on a game record, never read as true). The wheel text stays editable in H2c, and the page says it shows only for a hack whose tab has no effects list.


Asked for by the owner on 2026-11-04: a quickhack can give the player a short one-line description, in red, above the bullets of effects in the scanner's **Hacking** tab.

**The game already has this, suppressed** (the owner's idea, confirmed the same day). The tab's layout in game 2.5 (`base\gameplay\gui\widgets\scanning\scandetails.inkwidget`) has a `description` panel beside the `effects` panel, in one vertical panel, in this order: `damage`, `hackTypeWrapper`, `details`, `effects`, `description`. Only the controller keeps them apart (`QuickHackDescriptionGameController.OnQuickHackDataChanged`, read in the 2.31 scripts, the class and its method in 2.5's types): if the effects list is visible, it hides the description. The list shows when `DEV_useLongScanTooltips` is on and the hack has abilities to list.

So no new widget is needed, and the text is the one the record already holds (`Interactions.<...>.description`). It takes a very small script:

| Part | How |
|---|---|
| The script | redscript, a `@wrapMethod` of `OnQuickHackDataChanged`: after the game's own code, make the description visible with its text, tint it red, and move the `description` panel above `effects` |
| The text | The action's own wheel text, which the editor already edits. The **Player line** is that field. The editor refuses placeholders in it (`{float_0}`), since the tab shows them as written |
| The one copy | Every mod using it needs the same script, so it is one file at one path, `r6/scripts/EDGEhack/PlayerLine.reds` |
| Safety | One compile error stops every script in the game, so it is checked with redscript-cli against a copy of `final.redscripts`, with and without Codeware's scripts, before any test, as REDnode does |

**Decided by the owner on 2026-11-04, after the first spike: the line shows only on quickhacks made with EDGEhack, as a perk.** The first version showed it on every quickhack, and everything fit, but the game's own lines show their placeholders as written (Memory Wipe's literal `{float_0}`) and repeat what the bullets say, which may be why the game hid them. An action shows the line when it has the flat `edgehackLine: true`, which EDGEhack writes on a hack with a **Player line**, Boss and Chimera actions included. The script puts its changes back on an unmarked hack, since the tab's widgets are shared by every hack.

**If the panels overflow** (the owner's idea, 2026-11-04: make the quickhack tooltips and panels scrollable rather than let them run off the screen). The game has scroll areas (`inkScrollArea`, in its full-screen menus: codex, crafting, shards, settings), but none in `scandetails.inkwidget`, and no tooltip or scanner script uses one. A scroll area can be added by script, as a parent of the panel, but something must drive it: the scanner's list and the inventory's tooltips take no scroll input of their own, and the mouse wheel and arrow keys may already move the selection in the list (unverified). Built only if the spike shows a need, panel by panel, and judged by how cluttered the screen feels in the game. The options to try, in order (the owner, 2026-11-04):

1. **Automatic scrolling:** a capped height with a slow scroll, needing no input.
2. **A floating side panel** holding only the description, so the tab keeps its size.
3. A key of its own to scroll, only if neither of those feels right.

**The game's own lines (read on 2026-11-04):** the top tiers' run from 54 characters (Reboot Optics) to 292 (Blackwall Gateway); some are flavour text rather than a description (Blackwall Gateway, Contagion, Bait), and two hold placeholders (`{float_0}`: Memory Wipe, Synapse Burnout) that the tab may show as written.

**Built: the spike** (`r6/scripts/EDGEhack/PlayerLine.reds`, in `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H2d`). The first version passed in the game on every hack; the second, on marked hacks only, waits for its run ([Tests, "H2d Spike, second version"](testing.html#h2d-spike-second-version)). redscript-cli found no errors in either against a copy of 2.5's scripts. Then the field in the editor (H2c). **Unverified:** that TweakXL takes a new flat on a game record (`edgehackLine`).

### H3: plan

Agreed with the owner on 2026-11-05. Read from game 2.5's scripts and TweakDB; nothing here has run in the game yet.

**A new quickhack needs more than a copy of its records.** The game builds the scan's list by matching V's hacks against the **target's own list**, by `actionName`: `ScriptedPuppet.SendQuickhackCommands` reads the character record's `objectActions`, and a hack of V's with no match shows locked. So:

| Way | What happens | Verdict |
|---|---|---|
| Keep the family's `actionName` | Matches every enemy at once, but the game keeps one action per name, so the new hack **replaces** that family in the deck instead of sitting beside it | Fine as a quick fallback, not what "a new quickhack" means |
| A new `actionName`, added by YAML | 5,796 of the game's 6,762 character records carry a quickhack in their own list (41 different lists), so the YAML would add thousands of lines, and it would miss other mods' characters | No |
| A new `actionName`, added by a small script when the game asks for a target's actions (a wrap on `GetAllChoices`) | One small script, shared by every EDGEhack mod, adds the new hacks in V's deck. Works on modded characters too | **Recommended, if the spike passes.** New quickhacks then need redscript |
| A new `actionName`, added by a TweakXL scriptable tweak at the game's start | The same loop over every character, at each start | The second choice |

**The deck has its own rule, found in the spike's first run (2026-11-05):** it holds one hack of each `shardType` and removes any other with the same value (`RemoveOtherShards`), and a `$base` copy keeps its base's. So a new quickhack needs its own `shardType` as well as its own `actionName`.

This changes the decision "Behaviour beyond records: out of scope": a new quickhack needs this one script. It goes through redscript-cli against 2.5's scripts, with and without Codeware, before any test, since one compile error stops every script in the game.

**Steps:**

| Step | What | Test |
|---|---|---|
| **H3.1 Spike** | A hand-written new quickhack, as H2a was: a copy of Overheat with TweakXL's `$base`, a new `actionName`, two added effects, its own cooldown. It tries the routes above and answers the questions below | In the game, by the owner, in one session with H3c.1 |
| **H3.2 Writer** | `src/tweaks.ts` learns new records: each tier's item, action and status effect under the mod's ids, with their own `actionName` and `shardType`, the wheel's records and the shared script | Automated, against what the spike proved |
| **H3.3 New** | **Clone and Modify** on the page and in the Quickhacks view. The document gains `base` and new-hack fields, and the Quickhacks view shows a Project group | By hand |
| **H3.4 Add Effect** | The picker's first two sources: another quickhack's effects and the sorted status effects, referenced until changed and then copied, with the warnings in [Adding effects](#adding-effects) | By hand, then in the game |
| **H3.5 Attack features** | Extra damage, a stat change while hacked, a chance to apply something else, each written as a new status effect from the game's own effector classes | By hand, then in the game |
| **H3.6 Get it** | A crafting spec and a vendor's stock. REDnode's Console stays the way to get one while testing | In the game |
| **H3.7 Desk** | The Desk view and folder. A quickhack made with no project open lands there | By hand |

The phase's test stays as written: a new quickhack crafted or bought, with two added effects working on an enemy.

**H3.2 built (2026-11-05):** `writeNewHack` in `src/tweaks.ts`, with `newHack` in the document and the shared script in `src/newHackScript.ts`, which every EDGEhack mod ships at the same path so only one copy loads. Each tier gets its own item and action, the hack one wheel entry and cooldown, and a tier whose damage or duration changes gets copies of its status effect and of the attack's chain (attack, effector, package). Everything goes in the record's own body, so nothing relies on the order TweakXL applies flats in. Spread and the Boss and Chimera actions are left out, since they point at the family's records; numbers against bosses give a warning. Run against the real REDbridge on all 18 families: all 749 game records they name exist, and a Rare Overheat's action matches the spike's, apart from the spike's two added effects. **Not yet run in the game:** this writer's own output, several tiers, and copied damage or duration. H3.3 tries it.

**H3.3 built (2026-11-06), EDGEhack 0.0.5:** **Clone and Modify** on the page and on a family or tier in the Quickhacks view, asking the name in VS Code's own box (the name must make a free id, and not the one a change to a game family takes). `src/projectDocs.ts` finds a project's documents, makes a new one and writes a document's mod files, with no VS Code. The mod files are written at once, since a save of an unchanged file writes nothing and Pack and Play would find none; Pack and Play now also waits for the files of a save. The Quickhacks view's **Project** group lists the project's documents, following them on disk. The new hack's editor drops the numbers against bosses and gives a Console line per tier until Get it (H3.6). The plan's `base` field was not needed: `family` with `newHack` says the same.

**H3.3 passed in the game (2026-11-06), on the owner's laptop:** the first run of the writer's own output. A new hack made in the editor, with several tiers and copied damage and duration, sits beside the family it came from in the deck and on the wheel, with its own RAM, numbers and a 15 s cooldown of its own, while the game's Overheat keeps its own. That settles the separate cooldown the spike could not show, since Overheat's is 0.0001 s.

**H3.4 built (2026-11-06), EDGEhack 0.0.6:** **Add Effect** on the editor, with the picker's two sources. `src/effects.ts` has the pool, the sorting, another quickhack's effects, the warnings and `resolveAdded`, which reads a document's added effects for the writer; `document.ts` has `effects` in the document, and `tweaks.ts` writes them. The document stores what was picked, not records per tier: `status`, or `from` and `effect` (the record's name with its tier taken out). So a game patch that renames a tier's record still resolves, and one that removes it gives a warning, not a failure.

| Decided while building | Why |
|---|---|
| An effect from another quickhack **follows that quickhack's tiers**, by rank | Adding Contagion's poison should give a Rare hack the Rare poison. The owner's "on all tiers by default" still holds, with a box per tier to leave it off |
| The nearest tier that has the effect, at or below the rank first, never its place in a list | Short Circuit's EMP starts at Epic, and going by place gave a lower tier a weakspot effect for it. Checked on all 18 families |
| The first source offers what a quickhack does **to its target** | V's own (cooldowns, helper states the hack needs for itself) and what is made for a boss stay in the status effects, under **Show all** |
| Numbers per tier, each tier's copy its own | The decision "a column per tier"; two tiers can hold different numbers on one added effect |
| A status effect picked by itself gets one effect record of EDGEhack's; another quickhack's uses that quickhack's record | Unchanged, nothing of the game's is copied |
| An effect a game effector runs keeps its numbers | There is no plain status effect record to point at a copy; the card shows no field, and a document that sets one gets a warning |
| A change to a game quickhack gets its added effects on its Boss and Chimera actions too | The rule "a change applies to all three"; a new quickhack has none |

Checked against the real REDbridge on game 2.5: every family as a source, 26 effects, each with every number changed, and all 355 game records the YAML names exist. **Not yet run in the game:** `$type: ObjectActionEffect`, a stacks copy, a status effect on V, and whether an added effect from another quickhack works beside the hack's own.

**What the spike answers:**

- Does `$base` copy a tier's inline records, or does the copy still point at the original's?
- Does a new `actionName` sit beside the family it came from in the deck and on the wheel, with its own cooldown?
- Do the Boss and Chimera actions need their own new names, and how does the game pick them? (This is the design's open question from H1.)
- Do the perks that name a family still reach a copy? Overheat's passive and its duration stat are tied to the `Overheat` tag.
- Do two effects of one type stack or replace each other, and which status effects work on an enemy?

**H3.1's result (2026-11-05, game 2.5): passed.** Spike Static, with its own `actionName` and `shardType` and the small script, sat beside Overheat on the wheel and worked on enemies. Both Overheat burns and the poison ran on one enemy at once, so two effects of one `statusEffectType` can sit side by side when they are different records, and a second upload of one record added a stack.

**Still open for H3:** whether `$base` copies inline records (the spike listed its effects by hand); how a boss's actions are picked; and perks tied to a family.

### Own icons (H3b)

Asked for by the owner on 2026-11-04: a new quickhack can have its own icons, uploaded or generated. It comes right after H3, since a new quickhack is where it is wanted. Own icons were in H5; they move here.

Each of the three icons has **Pick from the game**, **Upload** and **Generate**. The game draws them differently, so each look has its own pre-baked prompt, and the modder's words are only what the glyph shows:

| Look | Where the game shows it | In the game | Size in the atlas |
|---|---|---|---|
| **Item** | Inventory, crafting, vendors | A portrait shard card: a dark frame with gold pins along the top, a teal-edged screen, a glyph in cyan line art on the screen | 99 x 128 (`quickhack_overheat`) |
| **Wheel** | The quickhack wheel | The same glyph alone: white line art on nothing | 64 x 64 (`Overheat`) |
| **Status** | The target's status bar | A simple solid white symbol on nothing | To read from the game in H3b |

**Generate:** a click asks for text ("a skull made of static") and sends the look's prompt with that text to the configured service. The result shows beside the game's icon at its real size, with **Keep** and **Try Again**; nothing is written until Keep.

| Part | How |
|---|---|
| The service | OpenAI's GPT Image, with the model listed by the key's own account (`gpt-image*`), as EDGEmat does. The modder's own key and credits; nothing is sent until they click, and each click is a paid image |
| The key | The shared store (`%APPDATA%\Edgemodders\keys\openai.txt`, DPAPI), through a copy of REDnode's `tools/keys/keys.mjs`. A modder with no key is asked once, and it is saved for every EDGE tool |
| The prompts | Fixed, in `src/iconPrompts.ts`, one per look: the look, the colours, the framing and "no text". **Show the Prompt** shows the whole prompt sent |
| One glyph, three looks | **Generate All** makes the Item first, then the other two from it as a reference image (`v1/images/edits`, as EDGEmat's `editImage`), so they show the same glyph. Three paid images; the button says so |
| Transparency | The Wheel and Status looks are asked for in white on solid black, and the black becomes transparent in EDGEhack, whatever the model's own transparency does |

**Upload** takes a PNG or JPG and goes through the same preview and fit. It is used as it is; a white-on-black image for Wheel or Status gets the same black-to-transparent step, offered as a switch.

**Into the game:** the image is fitted to the look's size and imported as an `.xbm` (REDbridge's `project.import`). An `.inkatlas` with one part per icon is written (`cr2w.fromJson`), and new `UIIcon` records point to it from the YAML. REDbridge looks enough for this; a `request` issue goes there if not.

**Unverified, to settle in H3b:** how close a fixed prompt gets to the game's look, which needs real generated images and the owner's eye, so the prompts will be tuned in that phase's test; the Status look's size; whether the atlas needs a 1080p texture as well as the 4K one the game's have.

### H3c Scripts: plan

Asked for by the owner on 2026-11-05: a quickhack can carry two REDnode functions, for what records cannot say. Agreed the same day. Read from game 2.5's scripts; nothing here has run in the game yet.

| Function | When | Gets | Does |
|---|---|---|---|
| **Scan check** (`canUse`) | While V scans an enemy, for each hack with a check | The enemy | Returns true or false: the hack shows enabled or disabled on that enemy |
| **On land** (`onLand`) | When the upload finishes on the enemy | The enemy | Runs any logic: more damage, more effects, damage worked out from the enemy's state |

A modder's file:

```js
import { quickhacks } from "rednode";

quickhacks.define("Items.EDGEhack_StaticSkullProgram", {
  canUse(target) {
    return target.isHuman;
  },
  async onLand(target, hack) {
    if (target.healthPercent < 50) await target.damage(40 * hack.tier, "Electric");
  },
});
```

The names and `target`'s fields are a first sketch. `target` folds the common reads and changes into one object, with `api` still there for the rest.

**The catch in the scan check.** The game builds the scan's list in one go on its own thread, and REDnode mods run outside the game (Tier 2), so it cannot wait for an answer. A game call costs about a frame (I1 measured it). Tier 1, which could answer at once, is not built (P4). So the check asks, remembers and refreshes:

1. A small REDnode script wraps `TranslateChoicesIntoQuickSlotCommands`. For a hack with a check and no answer yet, it sets `m_isLocked` with the text "Checking" and sends REDnode an event with the target. The event carries a small snapshot (level, health, kind, tags), so a plain check needs no game call.
2. The mod's function answers. The script remembers the answer per target and hack, and asks the game to rebuild the list (`QuickhackModule.RequestRefreshQuickhackMenu`, which works only while that target's panel is open).
3. Each later rebuild shows the remembered answer and asks again, and refreshes only if the answer changed, so it cannot loop.
4. With no answer within 1 s (the mod is off, it threw, it hung), the game's own result stands and the log says why.

The spike measured answers in 0 to 0.03 s from the snapshot, and 0.06 s with three game calls. **The owner's note from it (2026-11-05):** that is too quick to read. Of the times tried, only 1 s gave enough time to notice and read "Checking". So it holds for 1 s the first time V scans an enemy, whatever the answer, with no wait on later scans; that also keeps a usable hack locked for that second. Tried in a fight and **kept by the owner on 2026-11-05**. If a mod needs it shorter, a setting can come with the API. Should a future check need to be instant, the same function could move to Tier 1 with no change for modders.

**On land** has no such catch: nothing waits for it. A wrap on `ScriptableDeviceAction.CompleteAction` (people's hacks use it, and the game skips it if the target is dead) sends the event, and the function runs a frame or two later. It adds to what the hack does and cannot cancel it. The check for a hack that should not land at all is the scan check.

**Who builds what:**

| Part | Where |
|---|---|
| The script, the event carrying an entity and hack, `quickhacks` in the `rednode` package, and a test app | **REDnode**: open to any mod, not only EDGEhack's. A `request` issue there once this is agreed, with its own version and in-game test |
| A **Scripts** section on the page, with **Create** and **Open** for each function, and a text for "disabled" | **EDGEhack** |
| `scripts` in the document, naming the file and functions | **EDGEhack**. The modder owns that file and EDGEhack never rewrites it |
| The mod's REDnode package, in `source/resources/red4ext/plugins/REDnode/apps/<mod>/` | **EDGEhack** writes its manifest. That Pack and Play installs it is **unverified** |

A mod needs REDnode only if it has a script. EDGEhack's own requirement doesn't change.

**Steps:**

| Step | What | Test |
|---|---|---|
| **H3c.1 Spike** | A REDnode test app with the two wraps, on the game's own Overheat. It measures the time to an answer and how "Checking" looks, and answers the questions below | In the game, by the owner, in one session with H3.1 |
| **H3c.2 REDnode's `quickhacks`** | The API, docs, types, a sample, and a package stopping cleanly (its checks go, the game's results come back) | In the game |
| **H3c.3 EDGEhack's Scripts** | The section, the document's fields, the package and a starter file with its types | By hand |
| **H3c.4 Together** | A new quickhack with both: disabled on the wrong enemy, and extra damage on land by the enemy's health | In the game |

**What the spike answers:**

- Does a locked entry with our own text behave like the game's, and can the list be rebuilt that often without a flicker?
- Does the panel rebuild while the scan's slow motion runs, and do REDnode's calls keep their pace there?
- Does spread reach `CompleteAction`? Spread uses separate actions (`…HackSpread`), so `onLand` may need a `hack.spread` flag, or may not fire at all.
- Do Boss and Chimera actions reach both wraps under the family's item?
- What makes `target.damage` count as V's attack, so kills and experience go to V? A hand-built `gameHitEvent` crashed the game on 2026-11-05 (a null read, cause unverified): don't use it without finding out why. Lowering the health pool with V as instigator works, and a status effect from V is the next to try.

**H3c.1's result (2026-11-05, game 2.5): passed.** Both wraps and the fallback work with no REDnode change, and a locked entry shows our text as the game's do. 90 rebuilds in about 4 minutes, with no loop. Lowering the health pool from a function works, and a kill that way looked normal. A hand-built `gameHitEvent` crashed the game.

**Still open for H3c.2:** a status effect from a function (built, not run); whose kill a function's damage counts as (V is at the level cap, so experience could not show it); spread, not run yet, since nothing V has spread Overheat in that test (a way to spread: the Spillover perk with Overclock active, Copy-Paste, or a cyberdeck's ability); Boss and Chimera actions.

**Agreed with the owner on 2026-11-05:**

- The order: the spikes H3.1 and H3c.1 in one game session, then H3, H3b, H3c, H4.
- While a check has no answer, the hack shows locked, with "Checking".
- With no answer within 1 s, the game's own result stands, and the log says why.
- People only for now, since devices build their list in other code and are edited after 0.1.0 anyway.
- One script per family, with the tier passed in.
- A fixed "disabled" text set in the editor, since the function returns only true or false.

A `canUse` that reads the game a lot is slower to answer than one using the snapshot, and the docs will say so.

## Decisions

Agreed with the owner on 2026-11-04: the recommendation is the answer in each row.

| Question | Decided |
|---|---|
| EDGEhack's own `.quickhack.json` document that writes the YAML, or edit TweakXL YAML directly? | The document (see [Writing a mod](#writing-a-mod)) |
| Edit one tier at a time, or the family with a column per tier? | The family, with a column per tier, and "apply to all tiers" on each number |
| Should a change to a game quickhack touch its Boss and Chimera variants too? | Yes by default, with "against bosses" values shown and editable separately |
| The open contract on REDcode (`"edgemodders": { "opens": [...] }`): file it? | Yes, after H1's menu entry works, so the request shows a working consumer |
| The Library kind `quickhack` on EDGEbuilder: file it? | Yes, before H5 |
| Device and vehicle quickhacks in the first release? | Read in H1, edit after 0.1.0 |
| Behaviour beyond records (redscript) | Out of scope until a quickhack idea needs it. Changed by the owner's scripts request on 2026-11-05: see [H3c Scripts](#h3c-scripts-plan) |
| REDnode's editor channel with TweakDB writes (for Try Live) | File it on REDnode at H4, after the refresh spike |
| How REDagent and EDGEchat reach the MCP server (2026-11-06) | A server that runs without VS Code, in EDGEchat's plugin and among REDnode's attached servers, with logic kept free of VS Code from H3.3 on (see [MCP tools](#mcp-tools)) |

## Unverified, to settle in their phases

- How the game picks a quickhack's Boss or Chimera action for a target (H1).
- Whether TweakXL takes a LocKey by an `onscreens` secondary key for `displayName` and `caption`, and the exact syntax (H2).
- Whether two effects of the same status effect type stack or replace each other on a target (H3).
- Which status effects work on enemies without a quest or boss state (H3, from the game's own uses first, then in the game).
- How a new `actionName` reaches every enemy's list, and whether `$base` copies a tier's inline records (H3.1).
- How quickly a scan check can answer, and how "Checking" looks in the panel (H3c.1).
- Whether TweakDB changes reach an equipped quickhack without unequipping it, and how to refresh V's cached quickhack list (H4 spike).
- Whether new `onscreens` texts can load without a game restart (H4).
- How a quickhack REDagent makes in the game gets from the Desk into a project to pack (H4).
