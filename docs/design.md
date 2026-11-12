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
| **Copy Existing** | Pick a quickhack, then one of its effects (Short Circuit's EMP shock, Contagion's poison, Reboot Optics' blind). The effect comes with its status effect, damage and icon |
| **Status Effects** | Any status effect sorted as **Works on enemies**, searched by name, tag and type (Burning, Stunned, Blind, Poisoned, ...) |
| **Make New** | Built from parts, not picked whole: a damage over time (a damage type, damage a hit, seconds between hits, how long), a stat change while hacked (one stat from a list), a chance to apply a status effect. These are new status effects EDGEhack writes, from the game's own effector classes (H3.5). Spread is left out until it can be tested |

An added effect is **referenced** when it is unchanged (the YAML adds the game's record to the action's effect list) and **copied** as soon as the modder changes its duration, stacks or damage. The effects list shows which is which.

Combining has rules the editor checks, each as a warning, not a block:

- Two effects of the same `statusEffectType` may replace each other on the target. Two different burns ran side by side in H3.1's test, so Burning and Misc give no warning; other types are unverified.
- The same status effect twice on a tier, its own and an added one: one upload may count as two stacks, or as one. Unverified.
- A status effect with no duration may stay until something removes it. Unverified.
- Effects with `PlayerCooldown`, cyberware or boss-fight tags are V's or a boss's: shown only with **Show all**, with a warning if one goes on a target.
- The cooldown, the "was quickhacked" mark and the RAM cost always stay; they are not in the effects list.

The editor also shows **notes**, apart from the warnings. A warning means something may not work as the modder expects: the game may do something irregular, or nobody has seen it run. A note is the game working as designed, worth knowing when combining (the owner's distinction, 2026-11-07). Notes are grey with an info mark; warnings are yellow.

- An effect whose `AIData` needs a kind of NPC (humans only): the rest do not act it out, but the effect itself runs on them (a drone took Contagion's poison, Human only, and a bleed in H3.4's test). No message: that machines do not act out a poison is self-evident to players (the owner, 2026-11-07).
- A burn and Contagion's poison on one tier: Contagion Epic and better give V a passive in the cyberdeck (`EquipmentGLP.ContagionLvl3Passive`). A hit on a burning target removes every poison tagged `ContagionPoison`, and the game's own Epic and better poisons (`ContagionPoisonLvl3`, `Lvl4`, `Lvl4PlusPlus`, checked by record name) explode too (`Attacks.ContagionBurnCombo`). So a copy with changed numbers is removed without the explosion. Found in H3.4's test; without that Contagion in the deck, both ran for their whole time.
- **Poison and bleed stay off machines** (decided by the owner, 2026-11-07, after a drone took Triple Heat's poison and bleed in H3.4's test). The game keeps machines safe only per quickhack: Contagion cannot be uploaded to one, but its poison has no check of its own, so it reaches a machine through a hack that can (Overheat). In a quickhack EDGEhack builds, any poison or bleed (`statusEffectType` Poisoned or Bleeding) does no damage to androids, drones and mechs, and the editor shows a note saying EDGEhack does so: a deliberate change, more intuitive than the game's. How it is written, from H3.4b's spike (docs/testing.md): `immunityStats` is not checked when a quickhack applies an effect, but a `prereqRecord` on the damage effector is. So each poison and bleed gets its own copy of its damage effector with EDGEhack's own stat check (`StatPrereq`, `IsMechanical` LessOrEqual 0 on the Owner, as Overheat's `OverheatLevel2_inline9`). On a machine neither its damage nor its icon shows: seen on a drone and an android in H3.4b's test.

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
| **H3d Feature lines** | Passed in the game on 2026-11-11 (0.0.28). Proposed by the owner on 2026-11-11: bulleted lines of the modder's own in the item's tooltip, beside the game's, so a quickhack with a script can say what it does (see [H3d Feature lines: proposed](#h3d-feature-lines-proposed)) | Hand test, and in the game: the lines in the inventory's tooltip |
| **H4 Try Live and MCP** | Try Live through REDnode (after its spike and REDnode's editor channel work); the MCP server, running without VS Code, and Connect an Assistant, with tools for scripts and packing; EDGEchat's plugin and REDnode's attached servers as its two routes (see [MCP tools](#mcp-tools)) | Hand test and in-game test, with REDagent making a quickhack in the game |
| **H5 Library** | Add to Library and the Library view (after EDGEbuilder agrees the `quickhack` kind) | Hand test |
| **H6 First release** | 0.1.0 on the Marketplace, Open VSX, GitHub and Nexus Mods; the player guide; the README rule; the Nexus page. The owner chose on 2026-11-08 to release only after every phase above, as planned | The release gate: every hand test passed |

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
| **H3.4b Machines** | Poison and bleed in a quickhack EDGEhack builds do no damage to machines, with a note. A spike first, with REDnode's Console: `IsMechanical` as an immunity on the game's Epic poison and on Bleeding, then Triple Heat on a drone and on a human | Spike in the game, then by hand and in the game |
| **H3.5 Attack features** | Extra damage, a stat change while hacked, a chance to apply something else, each written as a new status effect from the game's own effector classes | By hand, then in the game |
| **H3.6 Get it** | A crafting spec and a vendor's stock. REDnode's Console stays the way to get one while testing | In the game |
| **H3.7 Desk** | The Desk view and folder. A quickhack made with no project open lands there | By hand |

The phase's test stays as written: a new quickhack crafted or bought, with two added effects working on an enemy.

**H3.2 built (2026-11-05):** `writeNewHack` in `src/tweaks.ts`, with `newHack` in the document and the shared script in `src/newHackScript.ts`, which every EDGEhack mod ships at the same path so only one copy loads. Each tier gets its own item and action, the hack one wheel entry and cooldown, and a tier whose damage or duration changes gets copies of its status effect and of the attack's chain (attack, effector, package). Everything goes in the record's own body, so nothing relies on the order TweakXL applies flats in. Spread and the Boss and Chimera actions are left out, since they point at the family's records; numbers against bosses give a warning. Run against the real REDbridge on all 18 families: all 749 game records they name exist, and a Rare Overheat's action matches the spike's, apart from the spike's two added effects. **Not yet run in the game:** this writer's own output, several tiers, and copied damage or duration. H3.3 tries it.

**H3.3 built (2026-11-06), EDGEhack 0.0.5:** **Clone and Modify** on the page and on a family or tier in the Quickhacks view, asking the name in VS Code's own box (the name must make a free id, and not the one a change to a game family takes). `src/projectDocs.ts` finds a project's documents, makes a new one and writes a document's mod files, with no VS Code. The mod files are written at once, since a save of an unchanged file writes nothing and Pack and Play would find none; Pack and Play now also waits for the files of a save. The Quickhacks view's **Project** group lists the project's documents, following them on disk. The new hack's editor drops the numbers against bosses and gives a Console line per tier until Get it (H3.6). The plan's `base` field was not needed: `family` with `newHack` says the same.

**H3.3 passed in the game (2026-11-06), on the owner's laptop:** the first run of the writer's own output. A new hack made in the editor, with several tiers and copied damage and duration, sits beside the family it came from in the deck and on the wheel, with its own RAM, numbers and a 15 s cooldown of its own, while the game's Overheat keeps its own. That settles the separate cooldown the spike could not show, since Overheat's is 0.0001 s.

**H3.4 built (2026-11-06), EDGEhack 0.0.6:** **Add Effect** on the editor, with the picker's two sources. `src/effects.ts` has the pool, the sorting, another quickhack's effects, the warnings and `resolveAdded`, which reads a document's added effects for the writer; `document.ts` has `effects` in the document, and `tweaks.ts` writes them. The document stores what was picked, not records per tier: `status`, or `from` and `effect` (the record's name with its tier taken out). So a game patch that renames a tier's record still resolves, and one that removes it gives a warning, not a failure.

**H3.4b built (2026-11-07), EDGEhack 0.0.9:** every added poison or bleed on the target (`hitsMachines` in `src/effects.ts`: `statusEffectType` Poisoned or Bleeding) is written as a copy on each tier, numbers changed or not, whose damage effector carries `prereqRecord: EDGEhack.<id>.NotMachine`, our own `StatPrereq` (`IsMechanical` LessOrEqual 0 on the Owner), written once per document (`Out.notMachine` in `src/tweaks.ts`). `keptOffMachines` says when it can be: applied by its status effect, with its damage in an effector of one of its packages. One that cannot, and does damage, gets a warning. The editor shows a note (the owner's distinction: a deliberate change is a note), the card says "A copy of its own on each tier, which keeps its damage off machines", with the tiers whose numbers changed, and the Contagion note says a copy ends without the explosion (the passive checks the game's record names). Checked: 72 unit tests; the smoke test; the real data on game 2.5, where 34 of the pool's poisons and bleeds are kept off machines, the 2 left do no damage, and the 93 game records the YAML names all exist. Passed in the game on 2026-11-07 (docs/testing.md, "H3.4b Machines"): a drone took only the burn, humans the poison and bleed, and with Contagion Epic in the cyberdeck the copied poison ended at the burn's first hit with no explosion. So the game takes a `$base` copy of an inline effector and package, which H3.3 had left open.

| Decided while building | Why |
|---|---|
| An effect from another quickhack **follows that quickhack's tiers**, by rank | Adding Contagion's poison should give a Rare hack the Rare poison. The owner's "on all tiers by default" still holds, with a box per tier to leave it off |
| The nearest tier that has the effect, at or below the rank first, never its place in a list | Short Circuit's EMP starts at Epic, and going by place gave a lower tier a weakspot effect for it. Checked on all 18 families |
| The first source offers what a quickhack does **to its target** | V's own (cooldowns, helper states the hack needs for itself) and what is made for a boss stay in the status effects, under **Show all** |
| Numbers per tier, each tier's copy its own | The decision "a column per tier"; two tiers can hold different numbers on one added effect |
| A status effect picked by itself gets one effect record of EDGEhack's; another quickhack's uses that quickhack's record | Unchanged, nothing of the game's is copied |
| An effect a game effector runs keeps its numbers | There is no plain status effect record to point at a copy; the card shows no field, and a document that sets one gets a warning |
| A change to a game quickhack gets its added effects on its Boss and Chimera actions too | The rule "a change applies to all three"; a new quickhack has none |

**H3.5 built (2026-11-07), EDGEhack 0.0.11:** the picker's third tab, **Make New** (named Build one until 0.0.14, when the owner also renamed the others Copy Existing and Status Effects), from what H3.5's spike found in the game (docs/testing.md, "H3.5 Attack features spike"). An added effect may carry `build` instead of `status` or `from`: `{ kind: "damage", damageType, sparks? }`, `{ kind: "stat", stat }` or `{ kind: "chance", applies }`, with its numbers per tier in `values` (`damage`, `every`, `duration`, `value`, `chance`), each starting from a default (`builtDefault` in `src/effects.ts`). Each tier gets status effects of EDGEhack's own, of type Misc, with a stacks group of 1 and an icon of the game's, written in `builtOnTier` in `src/tweaks.ts`:

| Card | Records on each tier | From the spike |
|---|---|---|
| Damage over time | A copy of the game's own damage over time of that type (`Attacks.ElectricDamageOverTime`, `ThermalDamageOverTime`, `ChemicalDamageOverTime`, `PhysicalDamageOverTime`; `DAMAGE_ATTACKS`) with the card's damage in place of the game's level curve; a `ContinuousAttackEffector` with the seconds between hits; its package, duration and status effect | A hit every 0.5 s for 8 s, and every 0.1 s with no bunching. Chemical and physical carry the machines check (H3.4b). Electric may show the game's sparks (`status_electrocuted`) as it starts, for a couple of seconds. EDGEhack 0.0.11 copied Overheat's attack for every type; its hand test showed that copy deals thermal damage whatever type it is given (EDGEhack 0.0.13 changed it) |
| Stat change | The stats in the status effect's package (`STAT_CHOICES`: values as the game's own enemy statuses use them; a "can" stat set to 0, with no number); its duration and status effect | Movement speed applied by the Console's check, but the enemy did not slow in the hand test: the game's scripts never read `MaxSpeed` for NPCs, so it left the list (0.0.13). Slowing one enemy needs its own time dilation, from a script, which slows everything it does |
| Chance to apply | A carrier status effect of 1 s whose package holds a plain `ApplyStatusEffectEffector` behind a copy of `Prereqs.SetChancePrereq` with the chance; a poison or bleed it applies is EDGEhack's copy, kept off machines | The game's `ApplyStatusEffectByChanceEffector` rolls only in `RepeatedAction`, when its prereq fires again, so it never rolled; run from the quickhack (`effectorToTrigger`) the plain one applied nothing. In a carrier: 4 of 5 at 50%, 0 of 4 at 0% |

| Decided with the owner (2026-11-07) | Why |
|---|---|
| No icon list per card | No status effect showed an icon over an enemy, not even the game's Blind. Each card still writes an icon of the game's (unverified whether it shows anywhere) |
| Damage a hit on the Numbers table's scale | Overheat's own is 3 + 20 = 23 a tick at Epic; the game lowers every quickhack's damage by the target's level and armor, so 3 showed as 1 |
| The damage numbers' colours, from `damage_types.inkstyle` and `main_colors.inkstyle` | Electric light blue (94, 246, 255), Thermal yellow-orange (240, 181, 55), Chemical green, Physical white. The yellow seen in the spike was thermal, from the copy of Overheat's attack: electric does show blue |
| Two built cards with one name are numbered (Electric damage over time 2) | In the hand test a type change landed on the first of two cards with the same title |
| Lasting sparks left open | Sparks replayed by each hit (a status with `shouldReapply`) showed red shooting sparks, not the blue arcs. Leads: Short Circuit's `PlayVFXEffector`, a replay timer at the animation's length |

Checked against the real REDbridge on game 2.5 (the session's scratchpad `h35/smoke.ts`): a new hack on Ping with all 17 kinds of card, and a change to Overheat; 57 game records named, all there; 604 records' fields compared with a game record of their type, none unknown; no game record changed but the actions' lists. 8 unit tests in `test/built.test.ts`.

Checked against the real REDbridge on game 2.5: every family as a source, 26 effects, each with every number changed, and all 355 game records the YAML names exist. **Not yet run in the game:** `$type: ObjectActionEffect`, a stacks copy, a status effect on V, and whether an added effect from another quickhack works beside the hack's own.

**What the spike answers:**

- Does `$base` copy a tier's inline records, or does the copy still point at the original's?
- Does a new `actionName` sit beside the family it came from in the deck and on the wheel, with its own cooldown?
- Do the Boss and Chimera actions need their own new names, and how does the game pick them? (This is the design's open question from H1.)
- Do the perks that name a family still reach a copy? Overheat's passive and its duration stat are tied to the `Overheat` tag.
- Do two effects of one type stack or replace each other, and which status effects work on an enemy?

**H3.1's result (2026-11-05, game 2.5): passed.** Spike Static, with its own `actionName` and `shardType` and the small script, sat beside Overheat on the wheel and worked on enemies. Both Overheat burns and the poison ran on one enemy at once, so two effects of one `statusEffectType` can sit side by side when they are different records, and a second upload of one record added a stack.

**Still open for H3:** whether `$base` copies inline records (the spike listed its effects by hand); how a boss's actions are picked; and perks tied to a family.

### H3.6 Get it: plan

Drafted on 2026-11-08 and **agreed with the owner the same day**, every recommendation below, with the spike first. Read from game 2.5's TweakDB and scripts; the spike's file is `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H36_spike` (docs/testing.md, "H3.6a Get it spike").

**How the game hands out a quickhack.** Each tier is either sold as it is or as a schematic, and a schematic is crafted:

| Record | What it is | Ping, as an example |
|---|---|---|
| `VendorItem` | One line in a vendor's stock: `item`, `quantity` (`Vendors.Always_Present`), `generationPrereqs` (a gate on V: Ping's Rare schematic, `Vendors.RareQuickhackSchematicsAvailability`, needs V at level 12 or more, or a cyberdeck of quality 4 or more) | Common is sold as the quickhack (`Vendors.NetrunnerTrainer_inline76`); Rare and Legendary as schematics; all three by the same 13 netrunners. Legendary++'s schematic is sold by one Kabuki tech store only |
| `Vendor` | A vendor; its `itemStock` lists its `VendorItem`s | `Vendors.wat_lch_netrunner_01` and 12 others |
| `ItemRecipe` | The schematic, an item tagged `Recipe`: buying it teaches the recipe (`ItemActionsHelper.LearnItem`). `craftingResult` names the quickhack it makes; its price group is `Price.RareQuickhackSchematics` and the like | `Items.Recipe_PingLvl2Program` |
| `CraftingPackage` on the quickhack's `CraftingData` | What crafting costs | Rare: 30 Rare quickhack components (`Items.QuickHackRareMaterial1`) |
| The craft book | The recipes V knows. A new game starts it from a `Craftable` record; a save keeps its own, so a recipe added to the start list never reaches an existing save | |

**The plan: a new quickhack's tier is got the way its family's tier is, by default.**

| Part | What EDGEhack writes, per tier | Editor |
|---|---|---|
| Sold as it is | A `VendorItem` of its own for the new item, a copy of the family's tier's entry (its gate), appended to the `itemStock` of every vendor that sells the family's tier | **Get it** per tier: where the game sells the family's tier, in words ("13 netrunners, Street Cred 40"), a **Sell it** box (on), and the Street Cred |
| Sold as a schematic | A schematic of its own (`Items.Recipe_EDGEhack_<id>_<tier>`, a copy of the family's tier's with `craftingResult` naming the new item and its name), and its `VendorItem` for the same vendors | The same row |
| Crafting | The new item keeps the family's crafting package unless the components change: then a package of its own | **Components** per tier, the game's amount beside it |
| Known from the start | Not in H3.6: an existing save keeps its own craft book, so it needs a script that teaches the recipe at load (H3c, with the scripts) | |

REDnode's Console stays the way to get one while testing, and the editor's **Give yourself one** lines stay.

**Steps.**

| Step | What | Test |
|---|---|---|
| **H3.6a Spike** | A hand-written file for Shock Ping's Rare: a schematic of its own, its stock entry at one netrunner near the owner, a crafting package with 1 component. Answers: does the vendor show it on an existing save (vendors keep their stock and restock on a timer: unverified when a new line appears), does buying teach the recipe, does the crafting menu craft the new quickhack | In the game, with the Console |
| **H3.6b Build** | The writer (`getIt` in `src/tweaks.ts`), the reader of where each family's tier is sold (`src/getit.ts`, no VS Code), the editor's **Get it** section, unit tests and the smoke check against the real records | By hand, then in the game: buy a schematic, craft the quickhack, and buy a Common one outright |

**Open questions, with recommendations:**

| Question | Recommendation |
|---|---|
| Copy the family's way of getting each tier by default? | Yes: a new quickhack shows up where players look for its family, behind the same gate |
| Let the components change? | Yes, the amount only, per tier; the component kind stays the game's for that quality |
| The price? | The game's price groups, as the copies give; a price box later if wanted |
| Known from the start? | Later, with H3c's scripts, as above |
| Also offer the schematic of a tier the game sells as it is (Common)? | No: copy the game's way. A box per tier can add it later |


**H3.6b built (2026-11-09), EDGEhack 0.0.15:** Get it, from what the spike found (docs/testing.md, "H3.6a Get it spike").

| Part | Where | What |
|---|---|---|
| Reading how the game hands out a tier | `src/getit.ts` | Once a session, through REDbridge: every `VendorItem` (item, gate), `Vendor` (its stock), `ItemRecipe` (its result) and `CraftingResult` (its item), about 100 ms after TweakDB has loaded; per family, each tier's stock lines, the schematic sold for it, its crafting package and component, and each gate in words (`gateWords`: V's level, Street Cred, the cyberdeck's quality, AND and OR) |
| Writing it | `writeNewHack` in `src/tweaks.ts` | Per tier: a copy of each stock line naming the new item; a copy of the schematic (`Items.Recipe_EDGEhack_<id>_<tier>`, with the new name and a copy of its result naming the new item) and of its stock lines; each vendor's stock appended once, under one key (`!append-once`); changed components as a crafting package and element of its own, set in the item's own record |
| The document | `getIt` by tier: `sell: false`, `components` | Missing: every tier is got the way the family's is |
| The editor | **Get it** on a new quickhack's page, per tier | How the game's tier is got, in words; **Sell it there**; **Components to craft it**, with the game's component and amount; the Console line for testing. The page opens at once and fills this in when the vendors are read |

| Found while building | Why it matters |
|---|---|
| A tier can be sold both ways: Ping's Rare is sold as it is by 8 vendors (V at level 15) and as a schematic by 13 (level 12) | The plan's table had each tier one way. Both are copied, each with its own gate |
| The gate is V's level or the cyberdeck's quality, not Street Cred | The plan's Street Cred field is not built: the copy keeps the game's gate. A gate of one's own would need records of its own, later if wanted |
| Common Ping's schematic exists but no vendor sells it | A schematic is written only when a vendor sells the family's |

Checked: 90 unit tests (9 new, `test/getit.test.ts`); against the real game (scratchpad `h36/smoke.ts`): Ping's four tiers read (13, 8 and 13, 11 and 13, 1 and 1 vendors), the YAML for a new quickhack from Ping names 71 game records, none missing, and 42 records' fields all exist on their types, with 13 vendors' stock appended; the page smoke test (`npm run smoke`, now with two Get it checks and a screenshot that no longer stops the run when the window is in the background).


**H3.7 built (2026-11-10), EDGEhack 0.0.16:** the Desk.

| Part | Where | What |
|---|---|---|
| The Desk's folder | `src/desk.ts` (no VS Code) | `%LOCALAPPDATA%\EDGEhack\desk\<id>.quickhack.asset\` with `asset.json` (`format`, `id`, `name`, `kind: "quickhack"`, `main`, `version`, the shared fields of EDGEbuilder's library.md) and `source\raw\edgehack\<id>.quickhack.json`. `EDGEHACK_DESK` moves it, for tests |
| Ids on the Desk | `deskNewHackDoc`, `deskChange` | A Desk document has no mod, so its id is its name alone (a new quickhack) or its family (a change). Its records' names are fixed only when it goes into a project, so a name changed on the Desk is the one the project gets |
| Add to Project | `projectPlace`, `writeToProject`; `QuickhackEditor.addToProject` | The document takes the project's id (the mod's name and the quickhack's), is written into the project, its mod files are written and the project's copy opens. The Desk keeps its own, as EDGEfab's does. Adding again replaces the project's copy after asking; a different document at that place is refused |
| Where new documents land | `QuickhackEditor.makeNew`, `edit` | With no project open, Clone and Modify and Edit go to the Desk. **Clone and Modify on the Desk** always does, project or not |
| The page on the Desk | `renderEditor(..., desk)`, `renderGetIt(..., desk)` | **Add to Project** in place of Pack and Play; Get it without its Console line, since the item's id changes in the project; a save raises the item's `version` and says no mod files were written |
| The Desk view | `src/deskView.ts` | The Desk's quickhacks, newest first, then a **Project** group as in the Quickhacks view (both views keep one for now). Add to Project (inline and in the menu), Duplicate (new quickhacks), Remove from the Desk (to the Recycle Bin, after asking). Add to Library waits for H5 |

Checked: 100 unit tests (10 new, `test/desk.test.ts`); the page smoke test with 14 Desk checks (made on the Desk with no mod files, saved there with its version raised, Add to Project with the project's id and its mod files, Duplicate, the view's rows), in a scratch Desk.

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

**Steps (2026-11-10, after H3.7; the owner asked to finish EDGEhack first, for its release):**

| Step | What | Test |
|---|---|---|
| **H3b.1 Spike** | A script, not EDGEhack: our own test art imported as an `.xbm` with the game's UI texture setup, an `.inkatlas` with three parts, and `UIIcon` records pointing the game's Overheat at them. Answers: do our parts show on the item, the wheel and the target; how big the status icon is drawn; whether one texture in both of the atlas's slots is enough | In the game |
| **H3b.2 Upload** | Upload on each icon (with the black-to-transparent switch for Wheel and Status), the fit to each look's size, and the atlas, texture and `UIIcon` records written on save | By hand, then in the game |
| **H3b.3 Generate** | Generate and Generate All through OpenAI's GPT Image, the key from the shared store, Show the Prompt, Keep and Try Again | By hand: the owner judges the prompts' looks |

**What the game's atlases are (read with REDbridge 0.12.1 on game 2.5):** the item icons are 99 x 128 parts of 2048-wide atlases (`quickhack_overheat` in `item_icons21.inkatlas`, reached through the item's `iconPath`, a `UIIcon.<iconPath>` record); the wheel icons are 64 x 64 parts of `quickhacks_icons.inkatlas` (512 x 384), reached through the wheel entry's caption part (`ChoiceCaptionParts.OverheatIcon.texturePartID`); the status icon is the status effect's `StatusEffectUIData.iconPath` (Overheat's `burning_icon`). Each atlas has a 4K texture in slot 0 and a 1080p one in slot 1, with `isSingleTextureMode` on. Their textures: group `TEXG_Generic_UI`, compression `TCM_QualityColor`, `TRF_TrueColor`, gamma, no mipmaps, not streamed. REDbridge's `project.import` sets all of that with its `texture` option (0.12.0); REDcode's API does not pass that option yet, so EDGEhack needs it there (a `request` issue on REDcode, at H3b.2).

**H3b.1 built (2026-11-10):** the script is in the session's scratchpad (`h3b/spike.py`); its output in `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H3b_spike\out` (`archive\pc\mod\EDGEhack_H3b_spike.archive`, 12 KB, and `r6\tweaks\EDGEhack_H3b_spike.yaml`). A 256 x 256 texture holds an item card (99 x 128: a dark frame, gold pins, a teal-edged screen, a cyan bolt in a ring), a wheel glyph (64 x 64, a white bolt in a ring) and a status symbol (64 x 64, a solid white bolt); the atlas puts the same texture in both slots. The texture read back through REDbridge as drawn.

**H3b.1's result (2026-11-10, game 2.5, dev PC): passed, every step.** Our item card showed in the inventory and the crafting menu at the size of the game's cards, the wheel glyph on the quickhack wheel, and our status symbol on the hacked enemy. What it settles for H3b.2: the item card is 99 x 128 and the wheel and status icons 64 x 64; one texture in both of the atlas's slots is enough (no separate 1080p texture); the texture setup above works; new `UIIcon` records reach all three places (an item's `iconPath`, a caption part's `texturePartID`, a status effect UI's `iconPath`). Found on the way: another mod changing the same quickhack's icons wins over EDGEhack's file (the owner's EDGEhack_Test1 changed Overheat's), as with any TweakXL change.

**H3b.2 built (2026-11-10), EDGEhack 0.0.19:**

| Part | Where | What |
|---|---|---|
| The document | `ownIcons` in `src/document.ts` (`ICON_LOOKS`, `withOwnIcon`) | `{ item?, wheel?, status? }`, true where the look has its own picture; the pictures are PNGs beside the document in `<id>.icons/` |
| The mod's files | `src/ownIcons.ts` (no VS Code) | `LOOKS` (sizes and places in a 256 x 256 texture), `atlasImage`, `atlasJson` (the texture in both slots), `iconRecords`, `writeOwnIcons`: the texture into `source/raw/edgehack/icons/<id>.png`, imported through REDcode with `UI_TEXTURE`, and `source/archive/edgehack/icons/<id>.inkatlas` through REDbridge; with no own icons, an earlier save's files go. A REDcode answer with no `texture` field is too old (REDcode 0.10.8 has it, REDcode #25) |
| The records | `src/tweaks.ts` | `UIIcon.edgehack_<id>_<look>` records; an own item or wheel icon wins over a picked one (`itemIconOf`, `wheelIconOf`). Status: a change sets the main effect's UI record's `iconPath`; a new quickhack copies its main status effect with its own UI record (`copyStatus`'s `icon`), so the game's keeps its icon. With no status effect of its own, a warning says the status icon shows nowhere |
| The page | `src/editorHtml.ts`, `media/editor.js` | A Status figure (Upload and Game's, no picker), Upload on each, Black is see-through on Wheel and Status; the fit (contain, centred, on nothing) and the black-to-transparent step run in the page's canvas, which reads PNG and JPG. Own pictures show as data URLs (the page's policy allows `data:` images) |
| Desk | `src/desk.ts` | Duplicate and Add to Project take the pictures along (`copyOwnIcons`) |

Checked: 107 unit tests (7 new, `test/ownIcons.test.ts`); the smoke test uploads a white square on black to the wheel through the page's file input, and checks the fitted 64 x 64 picture, the `.xbm` (imported with the UI setup through REDbridge 0.12.1, in the stand-in REDcode), the atlas, the YAML, and Game's removing them. **H3b.2 passed its hand test and in the game on 2026-11-10** (EDGEhack 0.0.19, with REDcode's test build from main): the uploaded item, wheel and status icons showed on a new quickhack, the game's Overheat kept its own, and Duplicate and Add to Project carried the pictures.

**Remove from Project (2026-11-10, EDGEhack 0.0.20, asked for by the owner):** the Desk view's Project rows get a trash can (`edgehack.project.remove`, inline and in the menu). After a modal that lists them, the document, its `.icons` folder, its YAML and its icons' texture and atlas go to the Recycle Bin (`projectFilesOf` in `src/projectDocs.ts`), and its texts leave the onscreens file (`removeTexts` in `src/projectFiles.ts`). The shared script stays, since other documents may need it. Passed its hand test on 2026-11-10.

**H3b.3 built (2026-11-10), EDGEhack 0.0.21:**

| Part | Where | What |
|---|---|---|
| The prompts | `src/iconPrompts.ts` (no VS Code) | `PROMPTS`: per look, the prompt from words alone and (Wheel, Status) the one drawn from the Item's picture, the size asked for (1024 x 1024), the fit (inside the look) and on black. The Item is only its glyph, flat in the game's cyan `#50cdd2` (`GLYPH_COLOR`, `color`), which the page paints flat (each pixel's brightness against the brightest becomes its opacity, the colour is always `#50cdd2`), and draws on the game's own item card of the quickhack it comes from (`frame: true`), read from the player's game as **Shown now** is, so no game art ships with EDGEhack. `media/card.js` (`emptyCard`, plain JavaScript the page loads and the unit tests require) finds the card's screen from its lit border (under the top border, down to the label plate's line, the lowest row lit across the middle third, between the side borders' inner edges) and takes the glyph out: a pixel that differs from its column's median background is glyph, and each one, grown by a pixel, takes the nearest empty pixel above or below it, so the screen's texture carries on. The new glyph is fitted into the screen's bounds and clipped to it (0.0.23 asked for the glyph on a frame; 0.0.24 drew it on the game's card, since the owner's frame, `images/quickhack.png`, was narrower than the game's: 76 against 90 pixels wide); `promptFor`, `cleanWords` (one line, 300 characters at most) |
| The progress | `src/editor.ts` | A run shows in a progress notification (`withProgress`, cancellable): the look and its number of the three, a bar that moves on the clock (GPT Image says nothing until the picture is done: each image an equal share, filled to nine tenths over about a minute), and **Cancel**, which stops the run as the page's Cancel does. With the page out of sight when it ends, an information (or warning) notification says so, with **Show**, which brings the page back (0.0.25, asked for by the owner after the hand test) |
| The service | `src/imageService.ts`, `src/generate.ts` (no VS Code) | OpenAI's `v1/models` (`gpt-image*`, newest first, mini last), `v1/images/generations`, and `v1/images/edits` with the Item's picture as the reference, after EDGEmat's `imageServices.ts`; errors in words, a 3-minute limit and Cancel. `generateLook` draws one look |
| The key and model | `src/openaiKey.ts`, `src/keys.mjs` (REDnode's `tools/keys/keys.mjs`, copied unchanged) | The key from the shared store (`openai`), asked for once in a password box and saved there; **EDGEhack: Set the OpenAI Key** and **Clear the OpenAI Key**. Settings `edgehack.generate.model` (empty: the newest the account lists) and `edgehack.generate.quality` (default medium) |
| The page | `src/editorHtml.ts`, `media/editor.js`, `src/editor.ts` | **Generate...** on each icon and **Generate All...**; the panel with the words, the cost, **Show the Prompt** (the whole prompt as typed), and each result fitted in the page's canvas (black made see-through for Wheel and Status) at its real size beside the icon shown now, with **Keep**, **Try Again** and the prompt sent; **Keep All** with two or more. Keep goes through Upload's path, so nothing is written before it. A run goes outside the page's message queue, one at a time, and the page stays editable |

Checked: 117 unit tests (9 new, `test/generate.test.ts`, against a stand-in server); the smoke test runs Generate All against a stand-in OpenAI (13 checks: the prompts shown, one generation and two edits from it, each result fitted, nothing kept before Keep, Try Again, Keep All, the save). Unverified until the hand test: real images from OpenAI, and how close the prompts get to the game's looks.

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

**H3c.2's result (2026-11-11, REDnode 0.61.1): passed** (REDnode's docs/quickhacks.md): `quickhacks.define(items, { canUse, onLand, disabledText, hold })`, `target.damage` and `target.addEffect` from V (a status effect from a function works; a kill by `damage` looked normal), the functions gone when the package stops and set again after a load. Spread was not run, and Boss and Chimera versions were not tried: both unverified. A define finds an item's hacks from their ids, so EDGEhack's TweakXL records work the same way.


**H3c.3 built (2026-11-11), EDGEhack 0.0.26:**

| Part | Where | What |
|---|---|---|
| The package | `src/scripts.ts` (no VS Code) | The mod's REDnode package in the project, `source/resources/red4ext/plugins/REDnode/apps/<package>/` (the mod's name in REDnode's id letters, `packageId`), so Pack and Play installs it with the rest. A script file per quickhack, `<id>.mjs`, is the modder's: **Add** makes it, or appends the function it lacks, and never changes what is there (`addFunction`). EDGEhack's own files, written again at each save and taken away with the last script (`writeScriptPackage`): `main.mjs` (every quickhack of the project with a script, `quickhacks.define(items, { canUse, onLand, disabledText })` with the functions its file exports, each define's failure logged on its own), `rednode-app.json` (`requires: { rednode: ">=0.61.1" }`) and `quickhacks.d.ts` (the types the files' JSDoc names). A `main.mjs` or manifest EDGEhack did not make is left alone, with an error |
| The items | `itemsOf` | The family's items lowest tier first: the game's for a change to a family, the mod's own (`Items.EDGEhack_<id>_<tier>`) for a new quickhack, so `hack.tier` is the tier from 1 |
| The document | `src/document.ts` | `scripts: { file, disabledText? }`, `withScripts` |
| The save | `src/projectDocs.ts` | `writeDocFiles` writes the package from every document of the project (`scriptEntries`, with the one being saved in place of its saved copy) when given `familyOf`, as the editor's three saves are; Remove from Project writes it again without the document. A document whose script file is missing is left out, and the save says so |
| The page | `src/editorHtml.ts` (`renderScripts`), `media/editor.js`, `src/editor.ts` | The Scripts section: a row per function with **Add** or **Open** (at the function's line, beside the page), the file's name with **Remove** (the file stays), and **A disabled hack says** once there is a scan check. It reads the file's exports again when a script is saved or the page comes back. On the Desk it asks for a project first |

Checked: 129 unit tests (9 new in `test/scripts.test.ts`, one of them importing a written `main.mjs` against a stand-in `rednode` package); the smoke test adds a scan check, sets the text, saves through Pack and Play, reads `main.mjs` and the manifest, and removes the script (6 checks). Unverified until H3c.4: that Pack and Play installs the package into the game, and REDnode running it there. **Passed its hand test on 2026-11-11** (0.0.26); 0.0.27 redraws the section after Remove at once and opens the script in the tab it already has. **H3c.4 passed in the game the same day** (0.0.27 with REDnode 0.61.1): Pack and Play installs the package and REDnode runs it, with a new quickhack's tiers right, so H3c is done. Spread reaching `onLand` is still unverified (REDnode's docs/quickhacks.md).

**Still open for H3c.2 (before its run):** a status effect from a function (built, not run); whose kill a function's damage counts as (V is at the level cap, so experience could not show it); spread, not run yet, since nothing V has spread Overheat in that test (a way to spread: the Spillover perk with Overclock active, Copy-Paste, or a cyberdeck's ability); Boss and Chimera actions.

**Agreed with the owner on 2026-11-05:**

- The order: the spikes H3.1 and H3c.1 in one game session, then H3, H3b, H3c, H4.
- While a check has no answer, the hack shows locked, with "Checking".
- With no answer within 1 s, the game's own result stands, and the log says why.
- People only for now, since devices build their list in other code and are edited after 0.1.0 anyway.
- One script per family, with the tier passed in.
- A fixed "disabled" text set in the editor, since the function returns only true or false.

A `canUse` that reads the game a lot is slower to answer than one using the snapshot, and the docs will say so.

### H3d Feature lines: proposed, built and passed

Proposed by the owner on 2026-11-11: "When a modder adds a custom script, they would want to share those details through the quickhack's popup description card, where there is usually a short bulleted list of the main features of the quickhack." To agree, after H4.1's spike answers the open point.

**How the game makes those lines (2.5).** Each line of a quickhack item's tooltip is a UI-only gameplay package on the item's `OnAttach` (`EquipmentGLP.OverheatProgramLvl2`: no effectors, stats or stat pools), whose `UIData` (`EquipmentGLP.OverheatProgramLvl2_inline0`, a `GameplayLogicPackageUIData`) holds the text in `localizedDescription` (a String, here `LocKey#51323`), an `iconPath` (`ability_offensive`) and `floatValues` for the text's `{float_0}` placeholders. A tier's item lists the lines of the tiers below it too, so the lines build up tier by tier. EDGEhack reads them today (the read-only panel's **Tooltip**) and leaves them as they are.

| Part | What |
|---|---|
| The page | A **Feature lines** list in the Texts section: each line a text, and the tier it starts from (Common by default), with Add and Remove. The game's own lines shown above it, read-only. The Scripts section offers **Add a line** once a function is there |
| The records | Per line, a package and its UI data, copies of the family's own first line's records (so the icon matches), with the text; appended to the `OnAttach` of the items from its tier up. For a change to a game quickhack, on the game's items; for a new one, on its own |
| The text | A key in the mod's `onscreens` file, as the other texts are; or plain text, if the spike shows it works without a LocKey |

Unverified, for the spike and the test: a line from a plain text; whether a line shows in the scanner's **Hacking** tab too (that list comes from elsewhere, see [The player's line](#the-players-line-h2d-dropped)).

**H3d built (2026-11-11), EDGEhack 0.0.28**, after H4.1's spike showed a line from plain text works (no icon shows on it, as on the game's own lines, the owner saw):

| Part | Where | What |
|---|---|---|
| The document | `src/document.ts` | `lines: [{ text, from? }]`, plain text (folded to one line, `LINE_MAX` 160 characters), `from` the tier's item (missing: the first); `withLines` |
| The reading | `src/read.ts` | A tier's `lists.onAttach`, and `lineBase`: its first tooltip line's package and UI data |
| The records | `src/tweaks.ts` (`featureLines`) | Per line, `<prefix>.Line<n>_UI` (a copy of the family's line's UI data with the text) and `<prefix>.Line<n>` (a copy of its package, with no effectors, stats, stat pools or items). For a change to a game quickhack, appended to the `OnAttach` of the game's items from the line's tier up; for a new one, in its own items' `OnAttach` after the family's lines. An empty line writes nothing |
| The page | `src/editorHtml.ts` (`renderLines`), `media/editor.js`, `src/editor.ts` | **Feature lines** in Texts: the top tier's own lines dimmed, then each line's text, its tier (**Common and up** and so on) and **Remove**; **Add a line** puts the cursor in a new box. The Scripts section's note points to it |

Checked: 135 unit tests (6 new, `test/lines.test.ts`); the smoke test adds a line from Rare up through the page, saves, reads the records and the appends (none below Rare), and removes it (7 checks). **Passed its test in the game on 2026-11-11** (0.0.28, dev PC): the lines show after the game's, from their tier up, and go when removed.

### H4 Try Live and MCP: plan

Written on 2026-11-11 after H3c passed, for the owner to agree. H4 has two halves: **Try Live** (change a quickhack and see it in the running game, without packing) and the **MCP server** (assistants make and change quickhacks). Try Live goes first, since the server's `hack_try` is Try Live.

**What the game's scripts say (2.5).** V's quickhacks are a list of action records cached on a blackboard (`PlayerQuickHackData.CachedQuickHackList`, `PlayerPuppet.GetCachedQuickHackList`), built from the cyberdeck's items when empty (`RPGManager`), and emptied by `PlayerPuppet.ChacheQuickHackListCleanup(player)`: the game runs it when a cyberdeck is equipped, a program is put in or taken out, and at each load. It is a static script function, so REDnode's `api` can call it: the refresh may need no REDnode change. REDnode's `tweakdb.set` already applies a changed record (TweakXL's update) and undoes a package's changes when it stops. TweakXL's `Reload` (the CET console's `TweakXL.Reload()`) is not declared to scripts (`TweakXL.Global.reds` has only `Require` and `Version`); whether REDnode's `rtti.call` reaches it is unverified.

| Step | What | Test |
|---|---|---|
| **H4.1 Try Live spike** | A REDnode app, **EDGEhack Try Live spike** (`Projects/EDGEhack_H4_spike`), on the game's Overheat (Rare) through REDnode's existing calls: more RAM, Contagion's poison added, the item renamed, V's cached list cleared, TweakXL's reload tried, and a new quickhack made live (a cloned item and action) and given. It answers the questions below | In the game, by the owner |
| **H4.2 REDnode's Try Live** | **Passed in game on 2026-11-11** (REDnode 0.62.0, [#44](https://github.com/Edgemodders/REDnode/issues/44); REDnode's docs, "Try Live: changing the game from a tool"). A `request` issue on REDnode, filed with the spike's answers: TweakDB writes on the editor channel (`POST /editor/tweakdb.apply` with a batch, `/editor/tweakdb.reset`, undone when the editor goes away), the refresh of V's list, giving an item, and an in-game **Allow** for an editor, as planned for archives | REDnode's own in-game test |
| **H4.3 EDGEhack's Try Live** | **Try Live** on the quickhack's page: its records sent to the running game, V given the quickhack (the tier picked), the list refreshed; **Stop** undoes it. Own icons by an archive swap (REDswap); new texts are unverified (the `onscreens` file is in the archive) | Hand test, and in the game: a change shows on the wheel without packing |
| **H4.4 The core outside VS Code** | **Built and checked on 2026-11-11** (see "H4.4 built"). `hub.ts`'s family cache and the save path into code free of VS Code; `redcode.ts`'s types in a file of their own; a REDbridge client of EDGEhack's own for the server | Unit and smoke tests: nothing changes for the modder |
| **H4.5 The MCP server** | **Passed its hand test on 2026-11-11** (EDGEhack 0.0.30; see "H4.5 built"). `@edgemodders/edgehack-mcp` on npm, running without VS Code: `hack_find`, `hack_describe`, `hack_effects`, `hack_new`, `hack_edit`, `hack_script`, `hack_pack`, `hack_try` (see [MCP tools](#mcp-tools)); **Connect an Assistant**; EDGEchat's plugin lists it (a `request` issue on EDGEchat) | Hand test with Claude Code |
| **H4.6 REDagent in the game** | **Passed in the game on 2026-11-11** (REDagent made Agent Heat on the Desk and tried it live; its name showed as its text key until packed, the known limit): REDnode 0.63.0 starts the server for in-game assistants, as it does EDGEmat's, on its shared REDbridge ([REDnode #45](https://github.com/Edgemodders/REDnode/issues/45); REDnode's docs, "EDGEhack's tools (H4.6)"); REDagent 0.4.2's briefing knows the tools. A test build takes the server from this repo's `packages/edgehack-mcp`; a REDnode release only once it is on npm (H6) | In the game: REDagent makes a quickhack and tries it live |

**What the spike answers:**

- Does a line of our own show in the item's tooltip, from a plain text with no LocKey (for [H3d](#h3d-feature-lines-proposed))?
- Does a change to an equipped hack's action (its RAM cost, its effects) show on the next scan with nothing else, after **Refresh list** (the game's own clear), only after taking it out of the cyberdeck and back, or only after a load?
- Does an item's changed name show in the inventory at once?
- Can REDnode call TweakXL's reload?
- Does a quickhack made in the running game (a cloned item and action) reach the backpack and the cyberdeck, and work?
- Is everything back after the spike stops (REDnode's undo), once the list is refreshed?

**H4.1's result (2026-11-11, REDnode 0.61.1 and 0.61.2, laptop): passed.** Everything Try Live needs works in the running game through REDnode's existing calls:

| Question | Answer |
|---|---|
| A change to an equipped hack's action | Its RAM cost showed on the next scan with nothing else. An added completion effect (Contagion's poison) worked after **Refresh list** (the game's `ChacheQuickHackListCleanup`) |
| An item's name | Showed in the inventory at once. It needed REDnode 0.61.2: `tweakdb.set` could not write a text key (`gamedataLocKeyWrapper`) before |
| A line of our own in the item's tooltip | Showed, from plain text with no LocKey: a UI-only package (copied from the family's line) with its UI data, appended to `OnAttach` ([H3d](#h3d-feature-lines-proposed)) |
| TweakXL's reload | Callable through REDnode's `rtti.call` (answered nothing in 1.9 s); not needed |
| A quickhack made live | A cloned item and action, given with `game.player.addItem`: in the backpack, in the cyberdeck, on the wheel with its own RAM cost, and working |
| Undo | REDnode's journal put every flat back when the spike stopped; records made with `clone` stay until the game closes, harmless once nothing names them |

So Try Live writes the document's records through REDnode (`tweakdb.clone` and `set`), undone when it stops, and refreshes V's list after a change to the actions' effects: the first decision below is settled that way.

**H4.3 built (2026-11-11), EDGEhack 0.0.29**, on REDnode 0.62.1:

| Part | Where | What |
|---|---|---|
| The ops | `src/tryLive.ts` (no VS Code) | `yamlToOps`: the YAML `writeTweaks` makes, the same Pack and Play installs, read as the editor channel's ops: a `$type` record a create and a set per field, a `$base` record a clone and its sets, a value a set, `!append` lists an append. Only EDGEhack's own shapes; anything else throws |
| The calls | `src/tryLive.ts` | `editorCall` reads REDnode's `editor.json` (`EDGEHACK_REDNODE_EDITOR` for the tests) and says in words when there is no game or an older REDnode; `tryLive` puts the last try back, applies, refreshes V's quickhacks and gives a new quickhack's item; `stopTrying` |
| The page | `src/editorHtml.ts`, `media/editor.js`, `src/editor.ts` | **Try Live** beside Pack and Play (on the Desk too: the records come from the document, not the project), then **Try Again** and **Stop**. A new quickhack's selected tier is given to V. One try at a time, outside the message queue, since the first waits for the player's Allow. A save while it is on sends the records again; closing the page stops it. Texts written in EDGEhack and own icons show as last packed, and the page says so |

REDnode 0.62.1 keeps a record an earlier try made (TweakDB cannot remove one) and sets its flats again, so a try can be sent again in one session. **Passed in the game on 2026-11-11** (dev PC, Icon Test): numbers, a feature line and an added effect live, the selected tier given, Stop back; a name written in EDGEhack stays as last packed (the known limit). Later, if wanted: live names through Codeware's localization providers, or an archive swap with the onscreens file (both unverified).

**Live names spike (2026-11-11, REDnode 0.62.2 and 0.62.3, dev PC): a name cannot be changed this way.** Codeware adds its providers' texts only when the game loads its text tables (`Localization_LoadOnScreens`, address hash 3550098299; Codeware's `LocalizationService`), so REDnode hooked the same load (through RED4ext, chained with Codeware's) and kept the tables: four on game 2.5 (62,229 entries, then 7, 66 and 10,276; 62,375 after Codeware's and ArchiveXL's merges). An entry changed in the base table (Overheat's `LocKey#27962`, found and changed) and a new key added there (under its FNV-1a 32 and 64 numbers, as Codeware adds them) were both left unseen: the game's own lookup (`GetLocalizedText`) still gave "Overheat", and nothing for the new key, and the inventory did not change; TweakXL's reload changed nothing. So the game indexes the tables at load and looks names up in its own copy. A live name would need that index rebuilt, which takes a static reading of the game's localization code: not done. **Parked:** Try Live keeps its known limit (names and descriptions written in EDGEhack show after Pack and Play). The spike app is in `Projects/EDGEhack_H4_names_spike`. Checked: 140 unit tests (5 new in `test/tryLive.test.ts`, the real YAML of a change and of a new quickhack among them, every record made before its flats are set); the smoke test drives Try Live, a save while live and Stop against a stand-in editor channel (5 checks).

**H4.4 built (2026-11-11)**, no version raise (nothing a modder sees changes):

| Part | Where | What |
|---|---|---|
| The types | `src/types.ts` | REDbridge's answers, the `BridgeClient` EDGEhack calls (with `importFile` and `pack` added, for writing icons and for `hack_pack`), `ProjectRef`. `redcode.ts` keeps only REDcode's API |
| The core | `src/core.ts` | `HackCore`: the catalog, families, records, icons, effect pool and Get it, each read once and kept until `refresh()`, over any REDbridge, with a plain log and `onRefresh` listeners. `Hub` (`src/hub.ts`) is now the core with REDcode's bridge, the output channel and VS Code's event |
| The save path | `src/save.ts` | `saveDocFiles(core, project, doc, icons)`: family, Get it for a new quickhack (left out, and said, when it cannot be read), added effects, then `writeDocFiles`. The editor's save, Clone and Modify and Add to Project call it. `bridgeIconWriter` writes own icons through REDbridge itself (`project.import` with the UI texture setup), for outside VS Code; inside it, icons still go through REDcode's API, which shows them in its Project view |
| EDGEhack's REDbridge | `src/redbridge.ts` | `RedBridge` starts REDbridge.exe on the first call (with `--game` and `DOTNET_ROOT`), speaks JSON-RPC on its stdio, fails waiting calls when it ends and starts again on the next one. `rednodeBridge()` uses REDnode's shared one when REDnode starts the server (`REDNODE_BRIDGE_URL` and `REDNODE_BRIDGE_TOKEN`, REDnode #40: 127.0.0.1 only, a token per start). `clientOver` gives both REDcode's method names |
| Finding things | `src/locate.ts`, `src/project.ts` | `findBridge` (an option, `REDBRIDGE_EXE`, REDcode's setting, then the newest copy REDnode, EDGEdeck or REDcode fetched, then PATH), `findDotnet`, `findGame` (an option, `EDGEHACK_GAME_PATH`, REDcode's and EDGEdeck's settings, then Steam's libraries), VS Code's settings read from their file; `projectAt` reads a `.cpmodproj` |

Two small fixes came with the move: a failed read of the game's icon list is tried again on the next call (it stayed failed until Refresh), and a family read that fails after a Refresh no longer drops the new read of it. A unit test walks every import from the core's files and fails if any reaches `vscode`, so the rule since H3.3 is checked. Checked: 162 unit tests (22 new), the smoke test's 135 checks, and a script on the real REDbridge and game with no VS Code (docs/testing.md, "H4.4 The core outside VS Code"). The REDnode shared bridge is checked against a stand-in only; its real use comes with H4.6. Next: H4.5, the MCP server.

**H4.5 built (2026-11-11), EDGEhack 0.0.30:**

| Part | Where | What |
|---|---|---|
| The tools' logic | `src/tools.ts`, `src/edits.ts`, `src/pack.ts` (no VS Code, no MCP SDK) | One function per tool over the core. `applyChanges` makes `hack_edit`'s list of changes through the page's own document helpers, with the game's value beside each, so a number set to the game's goes back to it; the first change that cannot be made throws, with nothing saved. A tier is named by its item, its quality or its place. `applyToAll` moved here from `editor.ts`. `packProject` packs as REDcode's Pack does for a plain archive mod (MIT, its non-REDmod path) |
| The server | `packages/edgehack-mcp/src/server.ts` | The eight tools with zod inputs; the reads marked read-only, the five that change something with Claude Code's `anthropic/requiresUserInteraction`, so it asks before every call. REDnode's shared REDbridge when REDnode starts it, else its own (H4.4's `RedBridge`). The project: the call's, then `--project`, then the folder it runs in; none means the Desk |
| The build | `esbuild.mjs` | One file with the MCP SDK 1.32.1 and zod 4.6.7 inside (zod 3 has a high advisory), at EDGEhack's version, as `packages/edgehack-mcp/dist/server.cjs` and `dist/mcp/edgehack-mcp.cjs` in the extension, each with `THIRD-PARTY-NOTICES.txt` made from the bundle's inputs |
| Connect an Assistant | `src/mcp.ts` | EDGEmat's: the server copied to `%LOCALAPPDATA%\EDGEhack\server\edgehack-mcp.cjs` at each start, registered with VS Code's own MCP support where there is one, and **Connect an Assistant (MCP)...** (command palette, the Desk view's menu) running `claude mcp add --scope user edgehack` or copying it or a JSON entry |
| npm | `.github/workflows/release.yml`, `packages/edgehack-mcp/` | The `npm` job publishes `@edgemodders/edgehack-mcp` with provenance after a release (NPM_TOKEN), skipping a version npm has; the first publish comes with EDGEhack's first release (H6) |

Settled here, as the design left open: `hack_pack` packs through REDbridge itself (with no REDcode outside VS Code) and does not install; a Desk quickhack gets into a project through `hack_new` with `desk_file` (Add to Project, asking before it replaces the project's copy), so no ninth tool. Checked: 172 unit tests (10 new, over the fixture), an MCP client (the SDK's own, over stdio) on the built server with the real REDbridge and game (33 checks: every tool, the ask flags, refusals in words, a scratch project and Desk; docs/testing.md, "H4.5 The MCP server"), the smoke test's 135 checks. EDGEchat's `request` issue is [EDGEchat #4](https://github.com/Edgemodders/EDGEchat/issues/4): list the server once EDGEhack 0.1.0 puts it on npm. **Passed the owner's hand test with Claude Code on 2026-11-11** (steps 1 to 7; Try Live through the server left for later). Next: H4.6.

**Decided by the owner on 2026-11-11** (the recommendation, first in each row, in all four):

| Question | Options |
|---|---|
| How Try Live writes the records | **Settle it from the spike.** Leaning towards REDnode writing the records the document makes, undone when Try Live stops, since TweakXL's reload re-reads every mod's tweaks and cannot take a record away |
| `hack_pack` | **REDbridge's packing, called by the server itself**, since the server runs without VS Code; or wrap REDcode's (only with VS Code open) |
| A quickhack REDagent makes in the game | **It lives on the Desk and is tried live; the player adds it to a project in VS Code to pack** (Add to Project exists); or the server packs Desk quickhacks into a project of their own |
| The order | **H4.1 to H4.3 (Try Live), then H4.4 to H4.6 (MCP)**; or the MCP server first, with `hack_try` later |

### H5 Library: plan

Written on 2026-11-11 after H4 passed. **Agreed with the owner on 2026-11-11**, with every recommendation below. The Library is the EDGE platform's shared warehouse of finished work (EDGEbuilder's [shared rules](https://edgemodders.github.io/EDGEbuilder/library.html#shared-rules)): a modder keeps quickhacks there, organised in folders of their own, and takes them into any project. It is never required: a modder without one works on the Desk and in projects as now.

What the rules already settle for quickhacks:

| Rule | For a quickhack |
|---|---|
| One root, in `%APPDATA%\EDGE\library.json` | Read as every tool does. If there is none, the first Add to Library asks where, offering `Documents\EDGE Library`, as REDcode's Add to Library does |
| The folders are the modder's | Add to Library offers the folder last used, or another; EDGEhack never makes folders of its own |
| Use the game path | Not offered: a quickhack is TweakDB records, with no game path |
| Items describe themselves | `<name>.quickhack.asset/`, the shape the Desk's folders already have: `asset.json` (`format`, `id`, `name`, `kind: "quickhack"`, `main`, `version`) and `source/raw/edgehack/<id>.quickhack.json`, with its own icons beside it (`<id>.icons/`). So Add to Library is a copy |
| The kind | `quickhack` is new, and EDGEbuilder keeps the list of kinds: a `request` issue there first. Its `main` is the document's path in the item, since a quickhack has no game path |
| The came-from note | Add to Project from the Library writes the project's `source/library.json` entry (`id`, `kind: "quickhack"`, `path`, `version`, `added`, `by: "edgehack"`, `files`), keeping other tools' entries, as EDGEbuilder's `bake.ts` does |

The steps:

| Step | Delivers | Ends with |
|---|---|---|
| **H5.0 Two fixes from H4** | **Built on 2026-11-11** (EDGEhack 0.0.31: `liveLimits` in `src/tryLive.ts`, used by the editor and `hack_try`; `hack_edit`'s description asks for one call per request; REDagent 0.4.3's briefing the same). Try Live's note on a quickhack never packed says it shows its text key (`LocKey#...`) as its name until Pack and Play and a restart, in the editor and in `hack_try`'s answer (it said "as last packed"). REDagent's briefing: all of one request's changes in one `hack_edit` call (H4.6 saw four calls, each asking, for one sentence; REDagent 0.4.3) | Unit tests; checked in the next game run |
| **H5.1 The kind** | [EDGEbuilder #5](https://github.com/Edgemodders/EDGEbuilder/issues/5), filed 2026-11-11, for the `quickhack` kind, in `docs/library.md`'s items table and the wiki's Library page. Building does not wait for it: the shape is the Desk's, which the rules allow | The issue filed, with the owner's agreement |
| **H5.2 Add to Library** | On a Desk quickhack (inline and in its menu) and on a project's quickhack: the root asked the first time, then the folder picker with the last folder first, then a copy of the item. A project's document is made project-free on the way, as a Desk document is (its id from its name alone). Adding the same quickhack again finds it by its `id` and asks before replacing the Library's copy, raising its version | `src/library.ts` (no VS Code: the root, folders, items, the came-from note), unit tests |
| **H5.3 The Library view** | The Library's folders, with only the folders that hold quickhacks and the way to them, each quickhack with its family's icon. **Open** (the editor; a save raises the item's version, as on the Desk), **Add to Project** (the project's names, its mod files written, the came-from note), **Copy to the Desk**, **Reveal in File Explorer**, **Remove from Library** (to the Recycle Bin, after asking). With no root: a welcome text saying Add to Library sets it up | Unit tests, the smoke test, a hand test |
| **H5.4 Refresh from Library** | In a project, the Project group marks a quickhack whose Library item has a newer version than the came-from note says, found by `id`; **Refresh from Library** copies it over after asking (the project's own changes to it are lost) and writes its mod files | The hand test |
| **H5.5 Assistants** | `hack_find` lists the Library's quickhacks (`where: "library"`); `hack_new` with a Library file and a project adds it to the project, with the came-from note, as Add to Project does. Adding to the Library stays the modder's, in VS Code, since the folders are theirs | The MCP client check |

The hand test: a Desk quickhack added to a new Library (the root asked, a folder made by the modder in the picker), then opened, changed and saved there; added to EDGEhack_Test1, the came-from note written; changed again in the Library and refreshed into the project; a project quickhack added to the Library; Copy to the Desk; Remove from Library. In the game: the refreshed quickhack after Pack and Play.

**Decision points** (the owner agreed every recommendation, 2026-11-11):

| Question | Recommended |
|---|---|
| The Library's copy of a Desk quickhack: the same `id` as the Desk's, or a new one? | The same. The Desk is the work in progress of that item, so adding it again updates the Library's copy (after asking) instead of making a second |
| Add to Library from a project's quickhack too, not only from the Desk? | Yes. A finished mod's quickhacks are the ones most worth keeping |
| A Library quickhack edited in place, or read-only with Copy to the Desk to change it? | In place, with each save raising its version, as EDGEbuilder edits scenes only in the Library; Refresh then carries the change into projects |
| Refresh from Library in H5, or later? | In H5, for quickhacks: it is what makes one Library item serve several mods |
| Assistants adding to the Library? | Not in H5: they list it and take from it. The folders are the modder's |
| Remove from Library | To the Recycle Bin, after asking; a project that took it keeps its copy |

**H5 built (2026-11-11), EDGEhack 0.0.31, with H5.0:**

| Part | Where | What |
|---|---|---|
| The Library | `src/library.ts` (no VS Code) | The root (`%APPDATA%\EDGE\library.json`; `EDGE_LIBRARY_CONFIG` for tests), the modder's folders and `safeFolder`, after REDcode's `library.ts`. `libraryItems` walks the root for `*.quickhack.asset` (other kinds and bakes passed over); `addToLibrary` copies a document and its own icons as an item, keeping the asset id it came with (a Desk item's, or a project's came-from note's) and replacing an item with that id where it is, version raised, only when asked; `projectFreeId` takes a project's mod name off the document's id; `savedInLibrary` raises the version at each save. The came-from note (`source/library.json`, after EDGEbuilder's `bake.ts`): `noteQuickhack` writes EDGEhack's entry and keeps the others; `libraryToProject` is Add to Project; `newerInLibrary` finds a project's quickhacks with a newer Library version, by id, then path |
| The Desk | `src/desk.ts` | `deskAsset` reads a Desk item's `asset.json`; `deskCopy` is Copy to the Desk, with the Library item's asset id |
| The editor | `src/editor.ts`, `src/editorHtml.ts` | A Library document is outside any project, as a Desk one (`placeOfFile`): its page offers Add to Project and says it is in the Library; a save raises its version and writes no mod files; Add to Project from it writes the came-from note and asks before replacing the project's copy |
| The Library view | `src/libraryView.ts` | The folders that hold quickhacks and the way to them, each item with its family's icon and version. Follows the root's file and the root |
| The commands | `src/libraryCommands.ts` | Add to Library (Desk rows, inline and in the menu; the Project group's rows), with the root asked the first time and the folder picker (last folder first, New Folder...); Open, Add to Project, Copy to the Desk, Reveal in File Explorer, Remove from Library (Recycle Bin, after asking); Refresh from Library on a Project row marked newer. Script arguments for the smoke test, as the Desk's |
| Assistants | `src/tools.ts`, the server's text | `placeOf` knows a Library document; `hack_find` lists the Library's quickhacks with their version and folder; `hack_edit` on one raises its version; `hack_new` with `desk_file` a Library document adds it to a project with the came-from note |

**Passed the owner's hand test on 2026-11-11** (all 10 steps; the folder picker's first-time click fixed on the way). Checked: 184 unit tests (10 new: `test/library.test.ts` and the tools' Library paths); the smoke test's 147 checks (12 new: Add to Library into a folder, Add to Project with the note, a save in the Library raising its version and marking the project's copy, the Library view's rows, Refresh from Library, adding the Desk's copy again, Copy to the Desk, Remove from Library); the MCP client check's 33. A row's accessible label in a VS Code tree is its tooltip, so the smoke test checks the marks there. [EDGEbuilder #5](https://github.com/Edgemodders/EDGEbuilder/issues/5) is done (EDGEbuilder 7d8b1a1, the wiki 8beaf1a); closing it is the owner's.

### H6 First release: plan

Written on 2026-11-11 after H5 passed. **Agreed with the owner on 2026-11-11**, with their notes: the Nexus description is written again for what EDGEhack has now, and the owner adds screenshots there; after the release, a dossier of the wiki's screenshots with their file names, as EDGEbuilder's, so the owner's pictures land where the pages already name them. EDGEhack 0.1.0 on the VS Code Marketplace, Open VSX, GitHub and Nexus Mods (page 37293), with its MCP server on npm. The release gate holds: every hand test of the changes passed. All five release secrets reach the repo (`VSCE_PAT`, `OVSX_PAT`, `NEXUS_KEY`, `NPM_TOKEN`, `RELEASE_TOKEN`), and the docs site builds from GitHub Actions.

| Step | Delivers | Ends with |
|---|---|---|
| **H6.1 The last game check** | **Passed on 2026-11-11** (docs/testing.md, "H6.1 The last game check"). The release gate is met. H5.0's two fixes in the game, with REDagent 0.4.3 deployed: REDagent makes a quickhack with three changes asked for in one sentence (one ask card), and Try Live's note on a new quickhack in the editor and in REDagent's answer | The owner's short run |
| **H6.2 The player guide** | **Done 2026-11-11:** eight pages at https://edgemodders.ai/wiki/edgehack/, each naming its screenshots (`/assets/shots/edgehack/`), shown as placeholders until there (EDGEweb's `shot.html`); EDGEhack on EDGEweb's home and platform pages. A guide for modders, from opening a quickhack to releasing the mod: the Quickhacks view, the editor (texts, numbers, Apply to all), Clone and Modify, Add Effect and Build one, Get it, own icons (Upload, Generate), Scripts, Feature lines, Try Live, Pack and Play, the Desk, the Library, assistants. Pictures from the smoke test's screenshots, which the owner can replace | The guide pages, linked from the README, the Marketplace page and Nexus |
| **H6.3 The store pages** | `README.marketplace.md` and `nexus/description.bbcode` written again for what EDGEhack is now (pulled from Nexus first, so the owner's own edits are kept), the README's status line and badge for 0.1.0, the changelog's 0.1.0 section (the Unreleased list, which holds everything since H0) | The owner reads them |
| **H6.4 The release run** | Version 0.1.0 in EDGEhack and its server, then the release workflow with Make a release and Update Nexus Mods, started when the owner asks: the Marketplace, Open VSX, the GitHub release with the vsix and the Nexus zip, Nexus's first main file, and npm's first `@edgemodders/edgehack-mcp` | Each place checked after the run |
| **H6.5 After it** | EDGEchat lists the server ([EDGEchat #4](https://github.com/Edgemodders/EDGEchat/issues/4), a nudge to its session); REDnode pins `@edgemodders/edgehack-mcp` 0.1.0 and ships it from its next release, so players' REDagent gets the tools; REDagent's next release with 0.4.3's briefing; the wiki's EDGEhack pages | Each repo's own release |

**Decision points, with a recommendation each:**

| Question | Recommended |
|---|---|
| Where the player guide lives | On the EDGEweb wiki (edgemodders.ai/wiki/edgehack/), as the other EDGE tools' user pages are, with the docs site keeping the design and the tests and linking to it. Each screenshot is named in its page (`/assets/shots/edgehack/<page>-<what>.webp`) and shows as a placeholder until the file is there |
| Pictures | The smoke test's screenshots now (it already takes the Quickhacks view, the Desk and the Library); the owner swaps in their own where they want, as with Sound Tools' page |
| The Nexus page's files | The Nexus zip only (the vsix inside, with install steps), as EDGEdeck's and EDGEwave's pages have; Mod Manager Download off, since it is a VS Code extension |
| Version | 0.1.0, still marked preview on the Marketplace (`"preview": true`), since the phases are done but the tool is new |

## In-game add-on: the Netrunner bench (proposed)

The owner's idea of 2026-11-10: quickhack crafting in the game, on the crafting screen's quickhack tab, whose middle panel is empty but for a placeholder picture. A REDnode app, released on its own, that reuses EDGEhack's parts. Not scheduled; its place in the order is to be agreed.

What the player does: names the quickhack they craft, and adds effects to it, other quickhacks' effects and added ones. Each effect has a component cost and a skill cost. V's Netrunner skill level is the budget: a recipe scoring 54 cannot be crafted while Netrunner is 50, until effects come off.

**The owner's answers (2026-11-10):**

| Question | Answer |
|---|---|
| Does a craft change the recipe for later crafts? | No. Each craft is one instance with its own choices |
| Which quickhacks? | The game's own only, not ones made with EDGEhack |
| How are effect costs set? | By a rule, which modders can override in EDGEhack. The bench must not need EDGEhack: EDGEhack is for modders, the bench is for players |
| Is the name per crafted item, or the recipe's? | Per crafted item |
| Native ink or an overlay panel? | Native ink only. Overlay apps that act like part of the game's UI (shown on a game event or a click on a game button, with the game's cursor carried across, no F10) come as a REDnode ticket of the owner's |

**What it needs (unverified, from what is known today):** clicks and text input in the game's own UI, REDnode's I3 Input, which is not built; per-item effects applied when the hack lands (REDnode #42's `onLand`), keyed by the crafted item and kept with the save; reading V's Netrunner skill; taking the extra components at craft time; and the parts of EDGEhack it reuses (the effect pool, the cost rule) in a core that runs without VS Code, reading TweakDB live in the game instead of through REDbridge. A spike first: draw in the crafting screen's middle panel, read the Netrunner level, find an id for each crafted item, and give one item its own name.

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
- Whether TweakXL takes `setChance` on a `$base` copy of `Prereqs.SetChancePrereq` as the Console's set did, and whether a plain-text `displayName` shows anywhere (H3.5).
- Whether a status effect's icon shows over an enemy at all (H3.5's spike saw none, not even the game's Blind).
