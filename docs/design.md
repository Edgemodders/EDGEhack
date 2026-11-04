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
| Spread (Overheat spreads to nearby enemies with the right perk) is two more actions per tier (`…HackSpread`) started by `SpreadInitEffector` and `SpreadEffector` | Spread is one switch in the editor; EDGEhack keeps the Spread actions in step |
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
| Behaviour no record can express | redscript (a custom effector class) | Out of scope until asked for |

**EDGEhack's own document.** The modder's work is a `<name>.quickhack.json` file in the project's `source/raw/edgehack/` (or on the Desk): what the quickhack starts from, what changed, the effects added, the texts and icons. EDGEhack writes the YAML, the `onscreens` file and the atlas from it, into REDcode's project, on **Add to Project** and on every save after that. The written YAML carries a header saying it is made by EDGEhack. This is EDGEwave's way (`.edgewave` document, rendered WAV) and EDGEquest's. The reasons: the YAML for one quickhack spans many records with generated names; a document in the modder's words survives a change of how EDGEhack writes it; and a modder can still open and read the YAML.

**Changing a game quickhack** writes TweakXL changes to its own records (`Items.OverheatLvl2Program: { … }`). Records it shares with other quickhacks (the four common effects, `BaseOverheat_inline0` that every Overheat tier uses) are copied under the mod's names first and the copy is changed, so nothing else changes by accident. A copy is a new record id, so the YAML stays small: only what differs.

**A new quickhack** is a copy of a family under the mod's own ids (`Items.EDGEhack_<Name>Program`, `QuickHack.EDGEhack_<Name>Hack`, ...) with TweakXL's `$base`, then the changes. A new quickhack also needs a way into V's hands: a crafting spec V knows from the start, a vendor's stock, or a gift through REDnode's console while testing. The editor's **Get it** section picks one.

Names given to new records are fixed once written (saves and other mods refer to them); renaming the quickhack later changes only its texts.

## The editor

A custom editor for `.quickhack.json`, opened from the Quickhacks view, the Desk, the Library, REDcode, or another tool. For a game quickhack with no document yet, it opens a read-only view of the game's records, with **Edit** (makes the document on the Desk) and **Make a New One From This**.

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

- Two effects of the same `statusEffectType` (two Burning effects) replace each other on the target rather than stack. Unverified per type; checked in H3.
- An effect whose `AIData` needs a kind of NPC (humans only) does nothing to the rest.
- Effects with `PlayerCooldown`, cyberware or boss-fight tags are V's or a boss's: shown only with **Show all**.
- The cooldown, the "was quickhacked" mark and the RAM cost always stay; they are not in the effects list.

## Views

The activity bar container **EDGEhack** (icon: a quickhack shard in the HUD brackets) with three views:

| View | What it lists | Actions |
|---|---|---|
| **Desk** | Quickhacks being worked on that are not in a project yet, newest first; then a **Project** group with the open REDcode project's quickhacks | Open, Add to Project, Add to Library, Duplicate, Remove |
| **Library** | The shared EDGE Library's `quickhack` items | Open, Add to Project, Copy to the Desk |
| **Quickhacks** | The game's quickhacks: People (by category, then family, then tier), Devices, Vehicles. A filter as REDcode's. Each family shows its icon and name | Open (read-only view), Edit, Make a New One From This, Open in REDcode (the record page) |

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

As EDGEmat and EDGEwave do, an MCP server comes with the extension (H4), so REDagent or Claude can work on quickhacks: `hack_find` (search the game's and the project's quickhacks), `hack_describe` (a quickhack in the editor's words), `hack_effects` (the effect pool, sorted), `hack_edit` and `hack_new` (change or make one, writing the document; ask first), `hack_try` (Try Live; ask first). Every editor feature has a tool, and every tool's result can be opened in the editor.

## What EDGEhack depends on

| Part | For | Required |
|---|---|---|
| REDcode (`edgemodders.redcode-cyberpunk`, API 1) | The game folder, REDbridge, the project, Pack and Play, the record pages | Yes, as `extensionDependencies` (the Quickhacks view needs REDbridge) |
| REDbridge | TweakDB reads (`tweakdb.*`), texts (`loc.*`), icons (`texture.toPng` for atlas parts), packing | Yes, through REDcode |
| TweakXL and ArchiveXL | In the player's game, for the mods EDGEhack makes | Yes, in the mod's requirements |
| REDnode | Try Live (H4) | No |
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
| **H4 Try Live and MCP** | Try Live through REDnode (after its spike and REDnode's editor channel work); the MCP server and Connect an Assistant | Hand test and in-game test |
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

### The player's line (H2d)

Asked for by the owner on 2026-11-04: a quickhack can give the player a short one-line description, in red, above the bullets of effects in the scanner's **Hacking** tab.

**The game already has this, suppressed** (the owner's idea, confirmed the same day). The tab's layout in game 2.5 (`base\gameplay\gui\widgets\scanning\scandetails.inkwidget`) has a `description` panel beside the `effects` panel, in one vertical panel, in this order: `damage`, `hackTypeWrapper`, `details`, `effects`, `description`. Only the controller keeps them apart (`QuickHackDescriptionGameController.OnQuickHackDataChanged`, read in the 2.31 scripts, the class and its method in 2.5's types): if the effects list is visible, it hides the description. The list shows when `DEV_useLongScanTooltips` is on and the hack has abilities to list.

So no new widget is needed, and the text is the one the record already holds (`Interactions.<...>.description`). It takes a very small script:

| Part | How |
|---|---|
| The script | redscript, a `@wrapMethod` of `OnQuickHackDataChanged`: after the game's own code, make the description visible with its text, tint it red, and move the `description` panel above `effects` |
| The text | The action's own wheel text, which the editor already edits. The **Player line** is that field |
| The one copy | Every mod using it needs the same script, so it is one file at one path, `r6/scripts/EDGEhack/PlayerLine.reds` |
| Safety | One compile error stops every script in the game, so it is checked with redscript-cli against a copy of `final.redscripts`, with and without Codeware's scripts, before any test, as REDnode does |

**Decided by the owner on 2026-11-04:** the line shows on **every quickhack**, the game's own text included. If the tab gets overcrowded, it is turned off: the spike is there to see.

**If the panels overflow** (the owner's idea, 2026-11-04: make the quickhack tooltips and panels scrollable rather than let them run off the screen). The game has scroll areas (`inkScrollArea`, in its full-screen menus: codex, crafting, shards, settings), but none in `scandetails.inkwidget`, and no tooltip or scanner script uses one. A scroll area can be added by script, as a parent of the panel, but something must drive it: the scanner's list and the inventory's tooltips take no scroll input of their own, and the mouse wheel and arrow keys may already move the selection in the list (unverified). Built only if the spike shows a need, panel by panel, and judged by how cluttered the screen feels in the game. The options to try, in order (the owner, 2026-11-04):

1. **Automatic scrolling:** a capped height with a slow scroll, needing no input.
2. **A floating side panel** holding only the description, so the tab keeps its size.
3. A key of its own to scroll, only if neither of those feels right.

**The game's own lines (read on 2026-11-04):** the top tiers' run from 54 characters (Reboot Optics) to 292 (Blackwall Gateway); some are flavour text rather than a description (Blackwall Gateway, Contagion, Bait), and two hold placeholders (`{float_0}`: Memory Wipe, Synapse Burnout) that the tab may show as written.

**Built: the spike** (`r6/scripts/EDGEhack/PlayerLine.reds`, in `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H2d`), waiting for its run ([Tests, "H2d Spike"](testing.html#h2d-spike)). redscript-cli found no errors in it against a copy of 2.5's scripts, which also shows the method and fields exist in 2.5. Then the field in the editor (H2c). **Unverified:** how the moved panel and its `line` rectangle look; how long a line fits; whether a tint reaches a rich text box.

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
| Behaviour beyond records (redscript) | Out of scope until a quickhack idea needs it |
| REDnode's editor channel with TweakDB writes (for Try Live) | File it on REDnode at H4, after the refresh spike |

## Unverified, to settle in their phases

- How the game picks a quickhack's Boss or Chimera action for a target (H1).
- Whether TweakXL takes a LocKey by an `onscreens` secondary key for `displayName` and `caption`, and the exact syntax (H2).
- Whether two effects of the same status effect type stack or replace each other on a target (H3).
- Which status effects work on enemies without a quest or boss state (H3, from the game's own uses first, then in the game).
- Whether TweakDB changes reach an equipped quickhack without unequipping it, and how to refresh V's cached quickhack list (H4 spike).
- Whether new `onscreens` texts can load without a game restart (H4).
