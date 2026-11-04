---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEhack: how to run it again, what to expect, and what it showed. Each phase ends with a hand test by the owner ([design, "Phases"](design.html#phases)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-04.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | H0, H1 | 2026-11-04 | Pass, 17 tests |
| Quickhack names against game 2.5 | By script, read only | H0 | 2026-11-04 | All 92 quickhack items read: 18 families a player sees and the Cyberdeck item; 7 internal items with other names left out, as they should be |
| [H1 outside VS Code](#h1-outside-vs-code) | By script, read only, the real REDbridge on game 2.5 | H1 | 2026-11-04 | Pass: 18 families with every tier, 63 device and 4 vehicle hacks, 36 icons, no problems |
| [H1 Read](#h1-read) | By hand, installed .vsix | H1 | 2026-11-04 | Pass, all 18 steps (EDGEhack 0.0.3) |
| [H2a Spike](#h2a-spike) | By hand, in the game | H2 | 2026-11-04 | Pass: name, icons, RAM up and down, upload, damage and duration all worked |
| [H2d Spike](#h2d-spike) | By hand, in the game | H2 | 2026-11-04 | The line works and fits, but the game's own lines show `{float_0}` and repeat the bullets: on hacks marked by EDGEhack only |
| [H2d Spike, second version](#h2d-spike-second-version) | By hand, in the game | H2 | 2026-11-04 | No line on any hack. The owner dropped the player's line; not looked into |

## Waiting for a hand test

None.

## H2d Spike, second version

The line only on hacks marked by EDGEhack (the owner's choice after the first version, below). In the EDGEdeck library as **EDGEhack H2d spike v2**: the script, and a small YAML that marks only Rare Overheat (`edgehackLine: true` on `QuickHack.OverheatLvl2Hack`). Checked with redscript-cli: no errors alone, none in this file with Codeware's scripts. Keep **EDGEhack H2a spike** on, since it holds the line's text, and the first version off.

**Before you start:** deploy with the game closed.

| Step | Do | Expect |
|---|---|---|
| Timer | In REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below | Marks in the Mod log |
| 1 | Load the save. Put **Rare Overheat** in the cyberdeck, with **Contagion** and **Memory Wipe**. Scan an enemy, and highlight Rare Overheat on the **Hacking** tab | "EDGEhack's spike: this text comes from the mod." in red, above the bullets. This is the mark working |
| 2 | Highlight **Memory Wipe**, then **Contagion** | No red line and no `{float_0}`: the tab as the game shows it, bullets only. This is the marked hack's change put back |
| 3 | Go back and forth between Rare Overheat and Contagion several times | The line comes and goes with the hack, and is always above the bullets. Nothing stays red, jumps or changes order |
| 4 | Swap Rare Overheat for **Epic Overheat**, and highlight it | No line: Epic is not marked, though it shares its text with Rare |
| 5 | Scan a device, such as a camera, and highlight a hack on it | The tab as the game shows it |
| 6 | Quit the game | Tell me anything that looked wrong. I read TweakXL's and redscript's logs |

**After:** turn the spikes off in EDGEdeck and deploy, if you don't want to keep them.

## H2d Spike

The player's line, a hand-written script ([design, "The player's line (H2d)"](design.html#the-players-line-h2d)): every quickhack's description in red, above its effects in the scanner's **Hacking** tab. Checked first with redscript-cli against a copy of the game's scripts: no errors alone, and none in this file with Codeware's scripts. It is in the EDGEdeck library as **EDGEhack H2d spike**: one file, `r6/scripts/EDGEhack/PlayerLine.reds`, which needs redscript. Leave **EDGEhack H2a spike** on for this test.

**Before you start:** deploy with the game closed. If the game shows a script error at start, or scripts stop working, turn the mod off and tell me: that's what the compile check is there to prevent, but the CLI is not the game's own compiler.

The hacks are the worst cases for crowding: the longest lines and the most bullets.

| Step | Do | Expect |
|---|---|---|
| Timer | In REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below | Marks in the Mod log |
| 1 | Load the save. In the launcher, switch on **Console**. Run `await game.player.addItem("Items.BlackWallProgramLvl4")`, then the same with `Items.ContagionLvl4PlusPlusProgram`, `Items.CommsNoiseLvl4PlusPlusProgram`, `Items.MemoryWipeLvl4PlusPlusProgram` and `Items.BlindLvl4PlusPlusProgram`. Keep the Overheat Rare from H2a | The quickhacks in the backpack |
| 2 | Put them in the cyberdeck, as many as it holds, with the Overheat Rare first. Scan an enemy and highlight it in the wheel, on the **Hacking** tab | "EDGEhack's spike: this text comes from the mod." in red, above the effect bullets. That also settles the test text from H2a |
| 3 | Highlight **Reboot Optics** | The shortest line: "Resets a target's optics, causing temporary blindness." How does it look? |
| 4 | Highlight **Sonic Shock** | The most bullets (6) with a line of 82 characters. Does it all fit on screen? |
| 5 | Highlight **Contagion** | A long line (242 characters) that is flavour text rather than a description. Does it fit? Does it read well? |
| 6 | Highlight **Blackwall Gateway** | The longest line (292 characters). This is the worst case for length |
| 7 | Highlight **Memory Wipe** | Its line holds a placeholder: does it show a number, or a literal `{float_0}`? |
| 8 | Move between hacks a few times, and scan a device, such as a camera | The line follows the highlighted hack. A device hack shows its own line, or none. Nothing flickers or jumps |
| 9 | Quit the game | Tell me how crowded it feels, and which hacks looked wrong. A screenshot of the worst one would help |

**After:** turn both spikes off in EDGEdeck and deploy, if you don't want to keep them.

| Run | Result |
|---|---|
| 2026-11-04, by the owner, on the dev PC's game 2.5 | The text all fits, including the longest line and the most bullets. Step 7: Memory Wipe's line showed a literal `{float_0}`, and it repeated what the bullets say. The owner's decision: off for the game's own hacks, on for EDGEhack's. No script errors in the logs. The timer was not used |

## H2a Spike

A hand-written test mod on Overheat, before any editor is built ([design, "H2: plan"](design.html#h2-plan)). The zip is `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H2a\EDGEhack_H2a_spike.zip`, built by a script from the plan's YAML with its `onscreens` file. It needs TweakXL and ArchiveXL, which are on in the dev PC's loadout, and REDnode's Console to give the items.

**Before you start:** add the zip in EDGEdeck, turn it on and deploy. Use a save you don't mind testing on: the mod changes only TweakDB, and turning it off undoes it, but the items you give yourself stay in that save.

| Step | Do | Expect |
|---|---|---|
| Timer | In REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below | Marks in the Mod log |
| 1 | Load the save. In the launcher, switch on **Console**. Run `await game.player.addItem("Items.OverheatLvl2Program")`, then the same with `Items.OverheatLvl3Program` and `Items.OverheatLvl4Program` | Three quickhacks in the backpack |
| 2 | Look at them in the inventory | Rare: named **Spike Heat**, with Short Circuit's item icon. Its tooltip's RAM, upload and damage: note what they say (8, about 1 s, much higher?). Epic and Legendary: still named Overheat, with Overheat's icon |
| 3 | Put only the **Rare** one in the cyberdeck (the game shows one Overheat at a time), find an enemy, scan them and look at the wheel | Named **Spike Heat**, Short Circuit's wheel icon, the text "EDGEhack's spike: this text comes from the mod.", RAM **8** (6 before) |
| 4 | Upload it on an enemy | The upload takes about **1 s** (2 before). They burn for about **8 s** (2 before) and take heavy damage, about 65 a tick four times a second |
| 5 | Swap to **Epic** in the deck and look at the wheel | RAM 7 and upload 2 s as in the game: the tier the mod leaves alone. The name, wheel icon and text are still the spike's, since the wheel's record is shared |
| 6 | Swap to **Legendary** and look at the wheel | RAM **6** (9 before): the negative difference |
| 7 | If a boss or tough named enemy is handy, look at the wheel on them. Skip it if not | Their numbers, if they differ: the Boss action's are unchanged |
| 8 | Quit the game | Tell me what differed. I read TweakXL's log for anything it refused |

**After:** turn the mod off in EDGEdeck and deploy.

| Run | Result |
|---|---|
| 2026-11-04, by the owner, on the dev PC's game 2.5 | Pass. The tooltip's numbers: Rare 263 damage a second (65.625 x 4), 11 s, upload 1 s; Epic, left alone, 92 a second, 5 s, 2 s. Steps 4 to 6 as expected, with Legendary at RAM 6, so a negative difference works. TweakXL's log has no errors. The wheel text did not show because the tab hides its description while the effects list shows (see the player's line). The timer was not used; nothing depended on it. The expected durations in steps 4 were wrong: the base is 5 s, since Overheat adds 3 s from its own stat |

## H1 Read

EDGEhack 0.0.3, built on 2026-11-04 (0.0.2 showed broken images on the page: the webview refused the icons, since the storage folder was allowed under its vscode-userdata URI). Read only: nothing is written to the game, a project or REDcode. The game does not need to run.

**Before you start:** REDcode 0.10.5 or later installed in VS Code, with its game folder set (REDcode's side bar works). Install EDGEhack from the repo's build:

```powershell
code --install-extension "E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.3.vsix"
```

Then reload VS Code (**Developer: Reload Window**).

| Step | Do | Expect |
|---|---|---|
| 1 | Look at the activity bar | A new icon: a chip with a lightning bolt in the HUD brackets. Hovering it says EDGEhack |
| 2 | Click it | Three views: **Desk** and **Library**, each with a short text saying which phase fills it, and **Quickhacks** |
| 3 | Wait for the Quickhacks view | A progress bar while it reads, up to about 15 seconds the first time (REDbridge loads TweakDB), less if REDcode's TweakDB view was opened already. Then **People** (open), **Devices** and **Vehicles** |
| 4 | Look under People | Four categories: Control Hack, Covert Hack, Damage Hack, Ultimate Hack. 18 quickhacks in all, each with the game's item icon and its number of tiers (Overheat: 6 tiers, Ping: 4, Blackwall Gateway: 3) |
| 5 | Open Overheat's arrow | Six tiers: Common, Uncommon, Rare, Epic, Legendary, Legendary++, each with its record (`OverheatProgram` ... `OverheatLvl4PlusPlusProgram`) |
| 6 | Click **Overheat** | A tab opens: Overheat's icon in a yellow frame, "Quickhack · Damage Hack · 6 tiers", "Read-only: the game's own quickhack", six tier buttons with **Legendary++** lit |
| 7 | Look at Numbers | One column per tier. RAM 3, 4, 6, 7, 9, 9; Upload 2 s; Cooldown none; Duration 2 s; Damage from 7.15 to 29.875 thermal every 0.25 s; Against bosses with each tier's RAM and 3 s |
| 8 | Point at a RAM number with a small `*` | A tooltip: "Scaled in the game by V's Memory Cost Reduction, its own Memory Cost Modifier, the target's Hacking Resistance, ..." |
| 9 | Click **Rare** | The Rare column turns yellow, and the panels below show Rare: Texts (name, description, wheel text, tooltip lines), Icons (Item, Wheel, and the burning icon "on the target's status bar"), Effects (Overheat: on the target, Burning, lasts 2 s, stacks 2, 15.625 thermal damage every 0.25 s), Works on (three conditions), Spread, While equipped, Get it (crafting spec: 30 Tier 3 Quickhack Components) |
| 10 | Click **record** beside the Overheat effect | REDcode's record page opens on `BaseStatusEffect.OverheatLevel2` |
| 11 | Back on the Overheat tab, open **Every quickhack also** and **Advanced** | Five shared effects; then about 75 records, each a link to REDcode |
| 12 | In the Quickhacks view, click the **Epic** tier under Short Circuit | Short Circuit's tab opens with **Epic** lit; its effects show Overload Level 3 (150 electric) and EMP (4.8 electric every 0.2 s, with its stat changes) |
| 13 | Click the funnel in the view's title, type `memory` | Only Memory Wipe is left, under Covert Hack. The view's title says the filter. Clear it with the button that replaced the funnel |
| 14 | Open **Devices** and click **Broadcast: Suicide** | A tab: "Device hack · 1 tier", RAM 6, upload 0.5 s, the wheel icon, no item icon, "Comes with the cyberdeck" |
| 15 | Open REDcode's side bar, its **TweakDB** view, filter it for `BossOverheatLvl2Hack` and right-click the record | **Open in EDGEhack** is in the menu; it opens (or shows) the Overheat tab |
| 16 | In REDcode's TweakDB view, right-click any record that is not a quickhack (filter for `Items.money`) and choose **Open in EDGEhack** | A message: "Items.money is not a quickhack ..." |
| 17 | Command Palette: **EDGEhack: Open a Quickhack...**, type `Items.BlindLvl2Program` | Reboot Optics opens with **Rare** lit |
| 18 | Right-click **Contagion** in the Quickhacks view, choose **Open the Record in REDcode** | REDcode's record page opens on Contagion's top tier item |

| Run | Result |
|---|---|
| 2026-11-04, EDGEhack 0.0.2 | Stopped at the page: every icon on it was a broken image (the webview refused them, the storage folder being allowed under its vscode-userdata URI). The tree showed its icons |
| 2026-11-04, EDGEhack 0.0.3 | Pass, all 18 steps, by the owner |

## H1 outside VS Code

The reader, catalog and icons bundled from `src/` and run against the real REDbridge (REDbridge 0.11.0 on game 2.5), read only. The scripts are in the session's scratchpad (`qh/e2e.ts`, `qh/pageshot.ts`); to run again, rebuild them from this description: a small JSON-RPC client over REDbridge's stdio standing in for REDcode's bridge client, then `readCatalog`, `readFamily` for every family, `readAction` for a few device hacks, `Icons.file` for each tier's icons, and the page's `render` written to an HTML file for headless Chrome.

| Run | Result |
|---|---|
| 2026-11-04, first | 18 families, 66 device and 5 vehicle hacks, every family read; three families short of a tier (items with no action of their own counted), Overheat's damage read 3 from Epic up (only the first modifier), three `!OBSOLETE` device hacks listed |
| 2026-11-04, second, after the fixes | 18 families with every tier, 63 device and 4 vehicle hacks, Overheat 23 thermal at Epic, 36 icons cut, no problems. The page for Overheat and Broadcast: Suicide looked right in headless Chrome |

## Type check, build and unit tests

```powershell
npm run typecheck
npm run build
npm test
```

The **Check** workflow runs the same on every push to `main`. The tests are pure: no VS Code and no game. They read made-up records in the game's shape (`test/fixture.ts`), never game data.
