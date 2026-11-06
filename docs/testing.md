---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEhack: how to run it again, what to expect, and what it showed. Each phase ends with a hand test by the owner ([design, "Phases"](design.html#phases)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-06.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | H0, H1, H2, H3 | 2026-11-06 | Pass, 70 tests |
| Quickhack names against game 2.5 | By script, read only | H0 | 2026-11-04 | All 92 quickhack items read: 18 families a player sees and the Cyberdeck item; 7 internal items with other names left out, as they should be |
| [H1 outside VS Code](#h1-outside-vs-code) | By script, read only, the real REDbridge on game 2.5 | H1 | 2026-11-04 | Pass: 18 families with every tier, 63 device and 4 vehicle hacks, 36 icons, no problems |
| [H1 Read](#h1-read) | By hand, installed .vsix | H1 | 2026-11-04 | Pass, all 18 steps (EDGEhack 0.0.3) |
| [H2c Edit](#h2c-edit) | By hand, then in the game | H2 | 2026-11-05 | Pass, Parts A and B (EDGEhack 0.0.4). The Hacking tab's upload and duration differ from the inventory's: the game's own doing |
| [H3.1 and H3c.1 Spikes](#h31-and-h3c1-spikes) | By hand, in the game | H3, H3c | 2026-11-05 | Pass, on game 2.5: a new quickhack beside Overheat, and both functions. A status effect from a function and spread were not run |
| [H3.3 New](#h33-new) | By hand, then in the game | H3 | 2026-11-06 | Pass |
| [H3.4 Add Effect](#h34-add-effect) | By hand, then in the game | H3 | | Waiting |
| [Smoke test](#smoke-test) | Automated: real VS Code, REDbridge and game; a stand-in REDcode | H2, H3 | 2026-11-06 | Pass, every check |
| [H2a Spike](#h2a-spike) | By hand, in the game | H2 | 2026-11-04 | Pass: name, icons, RAM up and down, upload, damage and duration all worked |
| [H2d Spike](#h2d-spike) | By hand, in the game | H2 | 2026-11-04 | The line works and fits, but the game's own lines show `{float_0}` and repeat the bullets: on hacks marked by EDGEhack only |
| [H2d Spike, second version](#h2d-spike-second-version) | By hand, in the game | H2 | 2026-11-04 | No line on any hack. The owner dropped the player's line; not looked into |

## Waiting for a hand test

- [H3.4 Add Effect](#h34-add-effect), EDGEhack 0.0.6.

## H3.4 Add Effect

EDGEhack 0.0.6: adding effects to a new quickhack. The smoke test has already driven these pages, and the writer ran against every family; this checks them by hand, with the real REDcode, and for the first time in the game.

**Before you start:**

- Install: `code --install-extension edgehack-0.0.6.vsix`, then **Developer: Reload Window**. REDcode must be 0.10.5 or later.
- Open a WolvenKit project in REDcode. The H3.3 test's project is fine.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Overheat**, click **Make a New One From This...** on its page, type `Triple Heat`, and press Enter | A new tab with its editor |
| 2 | On that page, scroll down to **Added effects**, below the Numbers table. Click **Add Effect...** | A panel opens with two tabs. **From another quickhack** shows 17 quickhacks with their icons: every family but Overheat |
| 3 | Click **Contagion** in the panel | Below the icons, one row: **Poison**, on the target, Poisoned, with how long it lasts and its damage |
| 4 | Click that row | The panel closes. A card for **Poison**: "From Contagion, following its tiers", "Uses the game's record", a row of ticked boxes **On this tier**, then Duration, Stacks and Damage a hit per tier. At the top of the page, a yellow warning that only Human NPCs react to it |
| 5 | Click **Add Effect...**, then the **Status effects** tab | A long list under **Works on enemies**. At its end, a line saying how many more there are |
| 6 | In the search box above the list, type `smasher` | "Nothing matches" |
| 7 | Tick **Show all** beside the search box | Rows under **Boss fights** |
| 8 | Untick **Show all**, and change the search to `bleeding` | A shorter list. Each row has a name, what the game calls it where that differs, and its record |
| 9 | Click the row named **Bleeding** | A second card, with **Goes on** set to **the target** |
| 10 | Click **Add Effect...**, then **Status effects**. Tick **Show all**, search `optical camo player buff common`, and click the row named **Optical Camo Player Buff Common** | A third card, with **Goes on** set to **V**, and no warning about it |
| 11 | On that third card's **On this tier** row, clear every box except **Epic** | The boxes stay as you left them |
| 12 | On the **Poison** card, in the **Duration** row, type `20` under **Rare**, and press Tab | The field turns yellow. The card says "A copy of its own on Rare; the game's record elsewhere" |
| 13 | On the **Bleeding** card, clear the box under **Legendary**. Click an empty spot on the page, then press **Ctrl+Z** | The box comes back ticked. Press **Ctrl+Y**: it clears again |
| 14 | Press **Ctrl+S** | The line under the title says what it saved. In the project, `source/resources/r6/tweaks/<your mod>/<your mod>_triple_heat.yaml` has a record ending `_a1_OverheatLvl2Program` |

**Part B, in the game**

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below.

| Step | Do | Expect |
|---|---|---|
| 15 | Quit the game if it is running. Click **Pack and Play** at the top of the page, then start the game. Say if it does something other than you expect | REDcode packs the project and installs it |
| 16 | Load a save. In the launcher, switch on **Console**. On the page, in the Numbers table, click **Rare** in its header row, and copy the line from **Give yourself one**. Run it in the Console. Do the same for **Epic** and **Legendary** | Three Triple Heat quickhacks in the backpack |
| 17 | Put Triple Heat's Rare in the cyberdeck, scan an enemy, and upload it | They burn, are poisoned and bleed. The poison lasts about 20 s, well after the burn ends. Say what you see, and what the enemy's status icons show |
| 18 | After the fight or on another enemy, swap it for its Epic, and upload it | Burn, poison for about 8 s and a bleed. V goes invisible for a moment, or says what happens instead |
| 19 | Swap it for its Legendary, and upload it on another enemy | Burn and poison, no bleed, and V stays visible |
| 20 | If a drone or robot is around, upload it there. Skip this if not | Say whether it takes the poison and the bleed. The page's warning leaves this unverified |
| 21 | Run `await game.player.addItem("Items.OverheatLvl2Program")` in the Console, put it in the cyberdeck, and upload the game's own Overheat on another enemy | Only a burn, for the game's time. Nothing added reaches the game's quickhack |
| 22 | Quit the game | Say what differed. If something failed, the lines with errors from TweakXL's log and `r6/logs/redscript_rCURRENT.log` help |

| Run | Result |
|---|---|

## H3.3 New

EDGEhack 0.0.5: making a new quickhack, and the first run of the writer's own output in the game, with several tiers and copied damage and duration. The smoke test has already driven these pages; this checks them by hand, with the real REDcode, and in the game.

**Before you start:**

- Install: `code --install-extension edgehack-0.0.5.vsix`, then **Developer: Reload Window**. REDcode must be 0.10.5 or later.
- Open a WolvenKit project in REDcode, a new test one. The mod goes into it.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Overheat** | The read-only page, with **Edit...** and **Make a New One From This...** |
| 2 | Click **Make a New One From This...** and type `!!!` | VS Code's box asks for a name, and says it needs a letter or a digit |
| 3 | Replace it with `Overheat` | It refuses: that name would take the file for changes to the game's Overheat |
| 4 | Replace it with `Spike Static`, and press Enter | A new tab, `<your mod>_spike_static.quickhack.json`. The line under the title says it is a new quickhack started from Overheat. No "Against bosses" rows. A **Give yourself one** section with a Console line |
| 5 | Look at the top of the Quickhacks view | **Project: <your project>**, with **Spike Static**, "new, from Overheat" |
| 6 | Right-click **Contagion** in the view, choose **Make a New One From This...**, then press Esc | The box asks for a name. Esc makes nothing |
| 7 | On Spike Static's page, click **Rare** in the Numbers table | The Console line now names `..._OverheatLvl2Program` |
| 8 | Rare's RAM: `8`. Rare's Duration: `11`. Rare's Damage a hit: `65`. Legendary's RAM: `6`. Cooldown for every tier: `15`. Name: `Spike Prime`. Then **Ctrl+S** | Changed fields turn yellow. The line under the title says what it saved. The view's Project group now says **Spike Prime** |
| 9 | In the project, look under `source/resources/r6` | `tweaks/<your mod>/<your mod>_spike_static.yaml`, and `scripts/EDGEhack/NewQuickhacks.reds` |

**Part B, in the game**

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step.

| Step | Do | Expect |
|---|---|---|
| 10 | Quit the game if it is running. Click **Pack and Play** on the page, then start the game. Say if it does something other than you expect | REDcode packs the project and installs it. New records and the script load at the start |
| 11 | Load a save. In the launcher, switch on **Console**. Run the Console line for Rare and for Legendary, from the page's **Give yourself one**, then `await game.player.addItem("Items.OverheatLvl2Program")` | Three quickhacks in the backpack |
| 12 | Look at Spike Prime's Rare in the inventory | Named **Spike Prime**, with Overheat's icon. Tooltip: about 260 damage a second, 11 s or more, RAM 8. Overheat's Rare keeps the game's numbers |
| 13 | Put Spike Prime's Rare and Overheat's Rare in the cyberdeck | Both stay |
| 14 | Scan an enemy, and look at the wheel | **Spike Prime** and **Overheat** side by side, both usable, Spike Prime at RAM 8 |
| 15 | Upload Spike Prime on the enemy | It burns. Then Spike Prime is on cooldown for about 15 s |
| 16 | While it cools down, upload Overheat on another enemy | Overheat is not on cooldown, costs its own RAM, and burns for the game's time |
| 17 | After the fight, swap Spike Prime's Rare for its Legendary, and scan again | Spike Prime at RAM 6, with Legendary's damage |
| 18 | Quit the game | Say what differed. If something failed, the lines with errors from TweakXL's log and `r6/logs/redscript_rCURRENT.log` help |

| Run | Result |
|---|---|
| 2026-11-06, by the owner on the laptop, EDGEhack 0.0.5 | Pass: Parts A and B went as written, by the owner's report. The logs were not read here |

## H3.1 and H3c.1 Spikes

Two hand-written test mods, run in one session ([design, "H3: plan"](design.html#h3-plan) and ["H3c Scripts: plan"](design.html#h3c-scripts-plan)). They are in the EDGEdeck library as **EDGEhack H3.1 spike v2** (a new quickhack, Spike Static) and **EDGEhack H3c.1 spike v3** (the app **EDGEhack scripts spike** with its script). Sources and zips are in `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H3_spike`. Checked first: redscript-cli found no errors in either script, alone or with Codeware's, and the app's rules passed in plain Node against a stand-in `rednode`, 15 checks. None of it has run in the game before this test.

**Before you start:** with the game closed, deploy in EDGEdeck, with v2 on and the first version off. That adds the two spikes and takes out **EDGEhack_Test1** (Part A's Test Heat), so Overheat is the game's own again. If the game shows a script error at the start, turn both spikes off, deploy, and tell me.

**Each time you change a rule in the app:** press F10, click the button, press F10, then scan an enemy again.

| Step | Do | Expect |
|---|---|---|
| Timer | In REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below | Marks in the Mod log |
| 1 | Load a save. In the launcher, switch on **Console** and **EDGEhack scripts spike**. In the Console, run `await game.player.addItem("Items.EDGEhack_H31Program")`, then the same with `Items.OverheatLvl2Program` | Two quickhacks in the backpack. The spike's window opens, and its log says "Watching" |
| 2 | Look at **Spike Static** in the inventory | That name, Short Circuit's item icon, Rare, and the spike's description |
| 3 | Put Spike Static and Rare Overheat in the cyberdeck, then scan an enemy | **Both** on the wheel, side by side, both usable. Spike Static shows Short Circuit's wheel icon. If it is missing or locked, tell me what it says |
| 4 | Upload Spike Static on the enemy, and watch them for 15 s | They burn and are poisoned. The spike's log lists what is on them each second until it ends |
| 5 | Right after, look at both on the wheel, on another enemy | Spike Static is on cooldown, Overheat is not. Then upload Overheat: it works as usual |
| 6 | In the spike's window, press **No**. Scan a new enemy, and watch Overheat and Spike Static as the wheel opens | A brief "Checking...", then both disabled, with "Not on this enemy (spike)". Say how the brief part looks: not noticeable, a flicker, or annoying |
| 7 | Try to upload one of them | It will not upload |
| 8 | Press **Yes**, then scan a new enemy | Usable. Did you see "Checking..." at all? |
| 9 | Press **Humans**. Scan a person, then a drone or a robot, if one is handy | Usable on the person, disabled on the machine |
| 10 | Press **Slow**, then scan a new enemy | "Checking..." for about a third of a second, then disabled. Is that wait acceptable? |
| 11 | Press **Reads**, then scan a new enemy | Disabled, like step 6. The log shows how long three game calls took |
| 12 | Press **Silent**, then scan a new enemy | "Checking..." for about 1 s, then usable: no answer, so the game's own result stands |
| 13 | Press **Throws**, then scan a new enemy | The same as step 12, and the log says it threw |
| 14 | Press **Yes**. In the launcher, switch **EDGEhack scripts spike** off, then scan a new enemy. Then switch it back on | "Checking..." for about 1 s, then usable: a mod that is off cannot lock a hack |
| 15 | Press **Pool**, then upload Overheat on an enemy with plenty of health | It works as usual, and the log's health drops by a further 30 on arrival |
| 16 | Press **Effect**, then upload Overheat on another enemy | They burn, and are poisoned too. The log lists the poison, from V's function |
| 17 | Press **Pool kill**, then upload Overheat on another enemy | They die. The log gives V's experience before and after. Does the kill show as V's, as a normal one does? |
| 18 | If V has a way to spread Overheat (the Spillover perk with Overclock active, Copy-Paste, or a cyberdeck's ability), press **Nothing** and upload it into a group. Skip this if not | The log says whether a "Landed" line came for each enemy it spread to |
| 19 | Press **Nothing**, **Hold** and **Yes**. Get into a fight, scan a new enemy, and try to upload as soon as you can | "Checking..." for 1 s, then usable. Does a second's wait on each new enemy feel acceptable in a fight? |
| 20 | Press **No**, then scan a new enemy | "Checking..." for 1 s, then "Not on this enemy (spike)". Scan the same enemy again: no wait this time |
| 21 | Press **Counts** in the spike's window, then quit the game | Tell me anything that looked wrong. I read TweakXL's, redscript's and REDnode's logs |

**After:** turn the two spikes off in EDGEdeck and deploy, unless you want them for the next step. EDGEhack_Test1 stays in the library, off.

| Run | Result |
|---|---|
| 2026-11-05, first, by the owner, on the dev PC's game 2.5 | Stopped at step 3: Spike Static and Overheat replaced each other in the deck, since the copy kept `shardType: Overheat`. Both scripts compiled in the game, TweakXL's log has no errors, and the items and step 2 were fine. Fixed in **EDGEhack H3.1 spike v2** (the first version stays in the library, off) |
| 2026-11-05, second, by the owner, steps 1 to 15 passed | Spike Static sat beside Overheat on the wheel and worked, with both Overheat burns and the poison on the enemy at once. Answers took 0 to 0.03 s from the snapshot, 0.06 s with three game calls, 0.31 to 0.34 s with Slow. Silent, Throws and the app switched off all fell back as planned. **The game crashed at the old step 16**, a hand-built `gameHitEvent` from a function (null read inside the game, cause unverified). The owner confirmed steps 1 to 15 worked as written, and that of the "Checking..." times, only step 12's 1 s gave enough time to notice and read it. That method is gone in **H3c.1 spike v3**, which adds a **Hold** switch to try 1 s with a real answer, and the app now keeps trying until V is in the world, since at first it stopped trying during the load. Step 5's cooldown could not be checked: Overheat's is 0.0001 s, so the copy's is too |
| 2026-11-05, third, by the owner, on v3, steps 17 to 21 | Pass, no crash, and TweakXL's log has no errors. **Pool kill** killed an enemy and the owner noted it looked normal. Hold and Yes, then Hold and No, as the steps say; the owner: "everything seemed to work fine". The Counts line: 90 rebuilds, 84 asks, none gave up, in about 4 minutes, so the list did not loop. **Not run:** step 16's **Effect** (no line for it in the log), and step 18, since V lacks the spread perk. Experience did not change on any kill, even a normal one (V is at the level cap), so it could not show whose kill it was |

## H2c Edit

EDGEhack 0.0.4: editing a game quickhack, writing the mod, and playing it. The smoke test has already driven these pages; this checks them by hand, with the real REDcode, and in the game.

**Before you start:**

- In EDGEdeck, turn **EDGEhack H2a spike** and **EDGEhack H2d spike v2** off and deploy: they change the same records.
- Install: `code --install-extension "E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.4.vsix"`, then **Developer: Reload Window**.
- Open a WolvenKit project in REDcode, a new test one. The mod goes into it.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Overheat** | The read-only page. Duration reads 5 s for every tier, as the game's tooltip does. Damage reads a second first, then a tick: 63 thermal a second (15.625 every 0.25 s) at Rare |
| 2 | Click **Edit...** | A new tab, `<your mod>_overheat.quickhack.json`, with Texts, Icons and Numbers. The fields show the game's values, greyed |
| 3 | Name: `Test Heat`. Rare's RAM: `8`. Rare's Upload: `1`. Rare's Duration: `11`. Rare's Damage a hit: `65` | Each changed field turns yellow. The title follows the name. The tab shows it is unsaved |
| 4 | Press **Ctrl+Z**, then **Ctrl+Y** | The last change goes and comes back |
| 5 | Legendary's RAM: `6` | Yellow: lower than the game's 9 |
| 6 | Under Icons, Item: **Change...**, and pick Short Circuit's. Wheel: **Change...**, and pick Short Circuit's | The picker shows the game's icons. A pick shows at once, with a **Game's** button to undo it |
| 7 | Click **Rare** in the table, then **All tiers** under Upload. Then **Ctrl+Z** | Every tier's upload drops by 1, then back. Tiers keep their own curve: it adds the change, not the number |
| 8 | **Ctrl+S** | The line under the title says what it saved. In the Project view: the YAML under `source/resources/r6/tweaks/<your mod>/`, an `.xl` under `source/resources`, and the texts under `source/archive/<your mod>/localization` |
| 9 | Open the YAML | "Made by EDGEhack" at the top; only what you changed; RAM `value: 2` on Rare and `value: -3` on Legendary |

**Part B, in the game**

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step.

| Step | Do | Expect |
|---|---|---|
| 10 | Click **Pack and Play** on the page. Say if it does something other than you expect | REDcode packs the project and gets it into the game. Restart the game if it was running: TweakDB changes load at the start |
| 11 | Load a save. In the launcher, switch on **Console**, and run `await game.player.addItem("Items.OverheatLvl2Program")`, then the same with `Items.OverheatLvl4Program` | Two quickhacks in the backpack. If you still have them from the spikes, no need |
| 12 | Look at Rare in the inventory | Named **Test Heat**, with Short Circuit's item icon. Tooltip: about 260 damage a second, 11 s, upload 1 s |
| 13 | Put Rare in the cyberdeck, scan an enemy, and look at the wheel and the Hacking tab | **Test Heat**, Short Circuit's wheel icon, RAM 8 |
| 14 | Upload it on an enemy | About 1 s to upload; burns for about 11 s |
| 15 | Swap to Legendary | RAM 6 |
| 16 | Quit the game | Tell me what differed. I read TweakXL's log |

| Run | Result |
|---|---|
| 2026-11-04, Part A, by the owner | Pass |
| 2026-11-05, Part B, by the owner, on the dev PC's game 2.5 | Pass, with the project `EDGEhack_Test1`. TweakXL's log reads the YAML with no errors. One observation: in the scanner's Hacking tab, Rare showed 8 s and 0.455 s upload, against 11 s and 1 s in the inventory ([design, "Two places, two numbers"](design.html#two-places-two-numbers)). The timer was not used; nothing depended on it |

## Smoke test

```powershell
npm run build
npm run smoke
```

Runs VS Code (EDGEwave's cached test build when there is one, so it stays apart from the VS Code in use), the built extension and the real REDbridge on the real game, with a stand-in REDcode (`tools/smoke/stub`) holding a scratch project in `%TEMP%\ehsmoke`. It only reads the game. `EH_BRIDGE`, `EH_GAME` and `EH_CODE` name another REDbridge, game or VS Code. Screenshots land in the scratch folder.

It checks that images really load on both pages, the numbers against the game's tooltip, a record link, Edit making the document, inputs reaching the document, a save writing the YAML, the `.xl` and the texts, undo and redo, All tiers, the icon picker, the game's value clearing a change, and Pack and Play asking REDcode to pack. For a new quickhack: the page's button and a name typed in VS Code's box, the document, the mod files written at once with the shared script, no game record changed, the editor's differences, the changed numbers in place when it packs, a used name refused, and the view's Project group.

| Run | Result |
|---|---|
| 2026-11-04, first | Four failures, one bug: two quick changes lost one, since each edit started from a copy of the document that was not yet up to date |
| 2026-11-04, second, with edits one at a time | Pass, every check |
| 2026-11-06, with new quickhacks (EDGEhack 0.0.5) | Pass, every check |

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
