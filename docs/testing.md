---
title: Tests
---

# <span class="y">Tests</span>

Every test run on EDGEhack: how to run it again, what to expect, and what it showed. Each phase ends with a hand test by the owner ([design, "Phases"](design.html#phases)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-11.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | H0, H1, H2, H3 | 2026-11-11 | Pass, 129 tests |
| Quickhack names against game 2.5 | By script, read only | H0 | 2026-11-04 | All 92 quickhack items read: 18 families a player sees and the Cyberdeck item; 7 internal items with other names left out, as they should be |
| [H1 outside VS Code](#h1-outside-vs-code) | By script, read only, the real REDbridge on game 2.5 | H1 | 2026-11-04 | Pass: 18 families with every tier, 63 device and 4 vehicle hacks, 36 icons, no problems |
| [H1 Read](#h1-read) | By hand, installed .vsix | H1 | 2026-11-04 | Pass, all 18 steps (EDGEhack 0.0.3) |
| [H2c Edit](#h2c-edit) | By hand, then in the game | H2 | 2026-11-05 | Pass, Parts A and B (EDGEhack 0.0.4). The Hacking tab's upload and duration differ from the inventory's: the game's own doing |
| [H3.1 and H3c.1 Spikes](#h31-and-h3c1-spikes) | By hand, in the game | H3, H3c | 2026-11-05 | Pass, on game 2.5: a new quickhack beside Overheat, and both functions. A status effect from a function and spread were not run |
| [H3.3 New](#h33-new) | By hand, then in the game | H3 | 2026-11-06 | Pass |
| [H3c.4 Together](#h3c4-together) | By hand, then in the game | H3c | 2026-11-11 | Pass, all 9 steps (EDGEhack 0.0.27, REDnode 0.61.1, on the laptop): Pack and Play installs the mod's REDnode package, and REDnode runs its script |
| [H3c.3 Scripts](#h3c3-scripts) | By hand, in VS Code | H3c | 2026-11-11 | Pass, all 9 steps (EDGEhack 0.0.26, on the laptop), with two fixes in 0.0.27 |
| [H3b.3 Generate: progress notification](#h3b3-generate-progress-notification) | By hand, in VS Code | H3b | 2026-11-11 | Pass, all 4 steps (EDGEhack 0.0.25, on the laptop) |
| [H3b.3 Generate](#h3b3-generate) | By hand, then in the game | H3b | 2026-11-11 | Pass, all 10 steps (EDGEhack 0.0.24, on the laptop) |
| [H3.7c Remove from Project](#h37c-remove-from-project) | By hand, in VS Code | H3 | 2026-11-10 | Pass, all 6 steps (EDGEhack 0.0.20) |
| [H3b.2 Upload](#h3b2-upload) | By hand, then in the game | H3b | 2026-11-10 | Pass, all 10 steps (EDGEhack 0.0.19, with REDcode's test build from main e9b5e7b) |
| [H3b.1 Own icons spike](#h3b1-own-icons-spike) | By hand, in the game | H3b | 2026-11-10 | Pass, steps 1 to 6: our item card, wheel glyph and status symbol all showed |
| [H3.7b Desk icons](#h37b-desk-icons) | By hand, in VS Code | H3 | 2026-11-10 | Pass, all 5 steps (EDGEhack 0.0.18) |
| [H3.7 Desk](#h37-desk) | By hand, in VS Code | H3 | 2026-11-10 | Pass, all 10 steps (EDGEhack 0.0.16). The owner asked for a trash can on each entry and a plus on Add to Project's icon: H3.7b |
| [H3.6b Get it](#h36b-get-it) | By hand in VS Code, then in the game | H3 | 2026-11-10 | Pass, Parts A and B (EDGEhack 0.0.15) |
| [H3.6a Get it spike](#h36a-get-it-spike) | By hand, in the game, with a hand-written file and REDnode's Console | H3 | 2026-11-09 | Pass: a vendor shows a new schematic on an existing save at once, buying teaches it, crafting makes the new hack; a crafting cost set from another file does not take |
| [H3.5 Build one](#h35-build-one) | By hand in VS Code, then in the game | H3 | 2026-11-09 | Pass, the drone check too |
| [H3.5 Attack features spike](#h35-attack-features-spike) | By hand, in the game, with a hand-written file and REDnode's Console | H3 | 2026-11-07 | Done: findings for the build |
| [H3.4b Machines](#h34b-machines) | By hand, then in the game | H3 | 2026-11-07 | Pass (EDGEhack 0.0.9): a drone and an android took only the burn, with no poison or bleed icon; humans the burn, poison and bleed |
| [H3.4b Machines spike](#h34b-machines-spike) | By hand, in the game, with REDnode's Console | H3 | 2026-11-07 | An immunity did nothing; a check on the damage effector stopped the damage on a drone, not on a human |
| [H3.4 Add Effect](#h34-add-effect) | By hand, then in the game | H3 | 2026-11-07 | Pass, Parts A and B (EDGEhack 0.0.6). The poison beside a burn is ended by Contagion Epic's passive, a game rule, now a note; a drone took the poison and the bleed |
| [Smoke test](#smoke-test) | Automated: real VS Code, REDbridge and game; a stand-in REDcode | H2, H3 | 2026-11-07 | Pass, every check (EDGEhack 0.0.9) |
| [H2a Spike](#h2a-spike) | By hand, in the game | H2 | 2026-11-04 | Pass: name, icons, RAM up and down, upload, damage and duration all worked |
| [H2d Spike](#h2d-spike) | By hand, in the game | H2 | 2026-11-04 | The line works and fits, but the game's own lines show `{float_0}` and repeat the bullets: on hacks marked by EDGEhack only |
| [H2d Spike, second version](#h2d-spike-second-version) | By hand, in the game | H2 | 2026-11-04 | No line on any hack. The owner dropped the player's line; not looked into |

## Waiting for a hand test

Nothing.

## H3c.4 Together

EDGEhack 0.0.27 and REDnode 0.61.1 (the update zip from REDnode's quickhack test), in VS Code, then in the game. Gen Test gets both functions: disabled on anything but a person, and extra damage when it lands on someone below half health. This also settles whether Pack and Play installs the mod's REDnode package. Steps 1 to 3 check 0.0.27's two fixes from H3c.3.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.27.vsix` and reload (or F5 at 0.0.27). Open **Gen Test**. If its Scripts section shows a file from H3c.3, **Open** it; otherwise **Add** on Scan check | The script opens in one tab beside the page |
| 2 | **Add** on On land (or **Open** if it is there) | The same tab shows `onLand`: no second tab |
| 3 | Make the file read as below, save it. Type `People only` in **A disabled hack says**, then Ctrl+S on the page | The page shows **Open** on both rows. The status line ends "…, and the mod's REDnode package." |
| 4 | With the game closed, **Pack and Play** | The game folder has `red4ext\plugins\REDnode\apps\edgehack_test1\` with `main.mjs`, `rednode-app.json`, `quickhacks.d.ts` and the script. If not, say what is there |
| 5 | Start the game and load a save. In REDnode's launcher (F10), find the mod's package, **EDGEhack_Test1 quickhacks** (the project's mod name, then "quickhacks"), in the Mod Manager and switch it on; switch on **Console** too. Run Gen Test's **Get it** line for the Epic tier in the Console, and put Gen Test in the cyberdeck | The Mod log has no error from it |
| 6 | F10 to close the overlay, scan a person | Gen Test shows "Checking..." for about a second, then usable |
| 7 | Scan a drone, a robot or a turret, if one is handy | Gen Test disabled, with "People only" |
| 8 | Upload Gen Test on a person at full health | It works as Overheat does. The Mod log says "Gen Test landed on a person at 100% health (tier 4)" |
| 9 | Upload it on a person below half health (shoot them first) | The Mod log adds "Extra damage: below half health", and they take a big extra hit or die |

The script for step 3:

```js
export function canUse(target, hack) {
  return target.isHuman;
}

export async function onLand(target, hack) {
  console.log(`Gen Test landed on a person at ${Math.round(target.healthPercent)}% health (tier ${hack.tier})`);
  if (target.healthPercent < 50) {
    await target.damage(50 * hack.tier);
    console.log("Extra damage: below half health");
  }
}
```

Keep the JSDoc lines above each function if you like; they give the completion.

Then quit the game and say what differed. I read REDnode's logs.

| Run | Result |
|---|---|
| 2026-11-11, by the owner, on the laptop, EDGEhack 0.0.27 with REDnode 0.61.1, project EDGEhack_Tests, its new quickhack Spike Prime (Legendary++) in place of Gen Test | **Pass**, all steps. Pack and Play installed the package (`edgehack_tests`), REDnode ran it: "landed on a person at 49% health (tier 6)", then "Extra damage: below half health" in the Mod log (the line says Gen Test because the step's script names it). Tier 6 is right for Legendary++, so a new quickhack's tiers come through. REDnode's own Quickhack test was on beside it, defining the game's Overheat: no clash, since a new quickhack has hacks of its own. Seen during the run: the quickhack's tab kept its dirty dot after one Ctrl+S (the save itself was logged); the owner's checks afterwards (Ctrl+S again, close and reopen) found it saving normally, so it is not reproduced. Likely an unsaved state kept over the update's reload (unverified) |

## H3c.3 Scripts

EDGEhack 0.0.26, in VS Code (the game comes in H3c.4). The Scripts section gives a quickhack its own logic: a scan check (`canUse`) and an on-land function (`onLand`), in a JavaScript file of yours that REDnode 0.61.1 or later runs in the game ([REDnode's Quickhack functions](https://edgemodders.github.io/REDnode/quickhacks.html)). Use the Gen Test quickhack from H3b.3, or any quickhack in EDGEhack_Test1.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.26.vsix` and reload (or F5 in the repo at 0.0.26). Open **Gen Test** in EDGEhack_Test1, scroll to **Scripts** | Two rows, **Scan check** `canUse` and **On land** `onLand`, each with **Add**, and a note that it needs REDnode 0.61.1 in the game |
| 2 | **Add** on Scan check | A file opens beside the page, `source/resources/red4ext/plugins/REDnode/apps/edgehack_test1/<the quickhack's id>.mjs`, with a header saying it is yours and `canUse` returning true. The row now says **Open**, and **A disabled hack says** shows under the rows |
| 3 | Back on the quickhack's page, Ctrl+S | The status line ends "…, and the mod's REDnode package." The same folder now has `main.mjs`, `rednode-app.json` and `quickhacks.d.ts`. `main.mjs` names Gen Test's own items (`Items.EDGEhack_…`), lowest tier first |
| 4 | In the script, type `target.` inside `canUse` | Completion lists `isHuman`, `healthPercent`, `damage` and the rest, with their notes |
| 5 | Change `return true;` to `return target.isHuman;`, save the script. Then **Add** on On land | `onLand` is added at the end of the same file; your change to `canUse` is still there |
| 6 | Type `People only` into **A disabled hack says**, click away, Ctrl+S on the page | `main.mjs` has `disabledText: "People only"` |
| 7 | In the script, delete the whole `canUse` function and save the script | The page's Scan check row shows **Add** again |
| 8 | **Remove** (beside the file name), then Ctrl+S on the page | The status line says the file stays. `main.mjs`, `rednode-app.json` and `quickhacks.d.ts` are gone; the script file is still there |
| 9 | Open a quickhack on the Desk, scroll to Scripts | "On the Desk: add it to a project first." and no buttons |

Then say what differed, and anything on the page you would change.

| Run | Result |
|---|---|
| 2026-11-11, by the owner, on the laptop, EDGEhack 0.0.26 | Pass, all 9 steps. Two fixes in 0.0.27: after **Remove** the section did not redraw until the page was left and come back to (the page skipped redraws while anything in the section had focus, and the button keeps it; now only the text box stops it, and the smoke test focuses the button and checks the redraw); **Add** on On land opened a second tab of the script beside the first (now the tab the script has is used, and with unsaved changes there the function goes into that editor rather than under it on disk). Both checked again in H3c.4's steps 1 and 2 |


## H3b.3 Generate: progress notification

EDGEhack 0.0.25, asked for by the owner after H3b.3's run (2026-11-11): a generation shows in a progress notification with **Cancel**, so a modder who goes to another tab sees it end or stops it there. Two paid images in all (step 1 and step 4); steps 2 and 3 cancel before an image is charged only if OpenAI has not finished it.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.25.vsix` and reload (or F5 in the repo at 0.0.25). Open **Gen Test**, **Generate All...**, type any words, **Generate** | A notification at the bottom right: "EDGEhack: generating Gen Test's icons", with "Item (1 of 3): one paid image, up to a minute…", a bar that moves, and **Cancel**. The message moves on to Wheel (2 of 3) and Status (3 of 3), and the notification closes when the three results show |
| 2 | Item: **Generate...**, **Generate**, then click another file's tab so the page is out of sight. Press **Cancel** on the notification | The notification closes. Back on the page, the status line says "Cancelled." and no result shows |
| 3 | Item: **Generate...**, **Generate**, then **Cancel** on the page itself | The notification closes too |
| 4 | Item: **Generate...**, **Generate**, then click another file's tab and wait | When the picture is ready, a notification says "EDGEhack: Gen Test's Item icon is ready. Keep the ones you like." with **Show**. **Show** brings the page back, with the result there |

Then say what differed.

| Run | Result |
|---|---|
| 2026-11-11, by the owner, on the laptop, EDGEhack 0.0.25 | Pass, all 4 steps |

## H3b.3 Generate

EDGEhack 0.0.24 (0.0.22 renamed the icons' **Game's** button to **Original**; 0.0.23 draws the Item as a flat cyan glyph on a frame; 0.0.24 takes the frame from the game's own card of the quickhack, with its glyph taken out, since 0.0.23's frame was narrower than the game's) with REDcode 0.10.8 (released on 2026-11-10; REDcode's test build from H3b.2 works too). Then in the game. Each Generate is a paid image on your OpenAI account (Generate All is three). You judge the looks: the prompts are fixed in `src/iconPrompts.ts` and get tuned from what you see.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.24.vsix` and reload (or press F5 in the repo at 0.0.24). Open EDGEhack_Test1 in REDcode, **Clone and Modify** Overheat as **Gen Test** | Each icon has **Generate...**, and **Generate All...** is under the three icons |
| 2 | Wheel: **Generate...**. Type `a skull made of static`, then open **Show the Prompt** | A panel titled "Generate the Wheel icon" says it is one paid image. The prompt shown holds your words and changes as you type |
| 3 | Press **Generate** | With no OpenAI key in the EDGE tools' shared store, VS Code asks for it once in a password box (it is then in REDnode's Keys too). Within about a minute a result shows: **Shown now** (the game's wheel icon) beside **Generated**, both at 64 x 64, the glyph white on nothing |
| 4 | **Try Again** | Another picture replaces it |
| 5 | **Keep** | The Wheel icon shows it; the status line says "Wheel icon kept. Save to write it into the mod." |
| 6 | **Generate All...**, type words of your own, **Generate** | The Item comes first, then the Wheel and Status, each beside the icon shown now. The Item is the game's own card for this quickhack (gold pins on top, the label at the bottom, the same shape as **Shown now**) with its glyph gone and yours on its screen, flat in one cyan (`#50cdd2`), with no lighting or shading, and nothing over the border. The Wheel and Status show the same glyph |
| 7 | Look at each at its real size against the game's | Say what is off in each look (the card, the line art, the silhouette), with a screenshot: this tunes the prompts |
| 8 | **Keep All**, then Ctrl+S | The three icons show the generated pictures; the save names the texture and atlas as in H3b.2, no error |
| 9 | Item: **Generate...**, **Generate**, then **Cancel** while it runs | The status line says "Cancelled." and no result shows |
| 10 | Pack and Play, start the game, load a save. Switch on **Console** in REDnode's launcher and run the line **Get it** shows on Gen Test's page for the Epic tier. Look at Gen Test in the inventory, on the quickhack wheel, and on a hacked enemy | The generated item card, wheel glyph and status symbol show where the game's do |

Then say what differed, with screenshots of the generated icons you would change.

| Run | Result |
|---|---|
| 2026-11-11, by the owner, on the laptop (F5 from the repo), EDGEhack 0.0.24 | Pass, all 10 steps. During the run: the button **Game's** became **Original** (0.0.22); the Item became a flat `#50cdd2` glyph on a frame (0.0.23); the owner's frame (`images/quickhack.png`) was narrower than the game's card (76 against 90 pixels wide, measured from a screenshot), so 0.0.24 draws the glyph on the game's own card read from the player's game, emptied of its glyph, and the frame image left the repo. Asked for after the run: a progress notification with Cancel (0.0.25, its own test above) |


## H3.7c Remove from Project

EDGEhack 0.0.20, in VS Code only, asked for by the owner on 2026-11-10: a trash can on each quickhack of the Desk view's Project group. Keep the REDcode test build from H3b.2 installed.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.20.vsix` and reload. In the Desk view, hover a quickhack in **Project: EDGEhack_Test1** | A trash can at the right of its row; its tooltip says **Remove from Project...** |
| 2 | Press it on **Icon Test** (from H3b.2) | A dialog lists what goes to the Recycle Bin: its document, its `.icons` folder, its YAML, and its icons' texture and atlas. It says its texts leave the onscreens file and a Desk copy stays |
| 3 | Press **Cancel** | Nothing changes |
| 4 | Press the trash can again and **Remove from Project** | Icon Test leaves the Project group (in the Quickhacks view too), its tab closes if open, and the files are in the Recycle Bin |
| 5 | Open the project's onscreens file in REDcode (source/archive, `localization/en-us.json`) | No `EDGEhack-edgehack_test1_icon_test-` entries; the other quickhacks' entries are there |
| 6 | Hover a quickhack on the Desk itself (not in the Project group) | Its trash can still says **Remove from the Desk...** |

Then say what differed.

| Run | Result |
|---|---|
| 2026-11-10, EDGEhack 0.0.20, dev PC | **Pass**, all 6 steps |

## H3b.2 Upload

EDGEhack 0.0.19 with REDcode 0.10.8 (a build from REDcode's main until it is released: it has REDcode #25, the texture setup on import). Then in the game. Have three pictures ready, PNG or JPG: any picture for the item, and two white symbols on black for the wheel and the status icon.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `E:\Modding\Cyberpunk 2077\EDGEhack\dist\edgehack-0.0.19.vsix`, and REDcode's test build over the store's: `code --install-extension "E:\Modding\Cyberpunk 2077\REDcode\dist\redcode-cyberpunk-main-e9b5e7b.vsix" --force` (its version still reads 0.10.7). Run **Developer: Reload Window**, open EDGEhack_Test1 in REDcode. **Clone and Modify** Overheat as **Icon Test** | Its page has three icons: Item, Wheel and Status, each with Upload; Wheel and Status have **Black is see-through** |
| 2 | Item: **Upload...** your item picture | It shows in the Item box, fitted inside 99 x 128 without stretching |
| 3 | Wheel: tick **Black is see-through**, then **Upload...** a white symbol on black | It shows as the white symbol with no black around it |
| 4 | Status: the same with the other white symbol | The same |
| 5 | Ctrl+S | A message names three files added: `edgehack/icons/<id>.png` in source/raw, and the `.xbm` and `.inkatlas` in source/archive. No error on the page |
| 6 | Pack and Play, start the game, load a save. Switch on **Console** in REDnode's launcher and run the line **Get it** shows on Icon Test's page for the Epic tier (`await game.player.addItem("Items.EDGEhack_...")`) | V has Icon Test |
| 7 | Hover Icon Test in the inventory's quickhacks, then find it in the crafting menu | Your item picture on its card, at the game's size |
| 8 | Scan an enemy, upload Icon Test | Your wheel symbol on its wheel entry; your status symbol on the enemy where the game shows Overheat's burning icon. Overheat itself, if V has it, keeps the game's icons |
| 9 | Quit. Back in VS Code, press **Original** under Status, then Ctrl+S | The status icon goes back to the game's; the texture keeps the other two |
| 10 | In the EDGEhack side bar, hover the **Desk** view's title and press its **+** (**Clone and Modify on the Desk...**). Pick a quickhack and give it a name. On its page, upload an item picture and press Ctrl+S. Then right-click it in the Desk view, **Duplicate...**, and on the original's page press **Add to Project** | The copy and the project's document both show the same item picture |

Then say what differed, with a screenshot of any icon that looks wrong.

| Run | Result |
|---|---|
| 2026-11-10, EDGEhack 0.0.19, REDcode main e9b5e7b, dev PC, game 2.5 | **Pass**, all 10 steps: the first real call of REDcode's `importFile` with `texture` from EDGEhack |

## H3b.1 Own icons spike

In the game, no EDGEhack needed. The files are in `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H3b_spike\out`: Claude copies them into the game folder with your OK (`archive\pc\mod\EDGEhack_H3b_spike.archive` and `r6\tweaks\EDGEhack_H3b_spike.yaml`). They give the game's own **Overheat** our test icons: a cyan bolt in a ring on a dark card with gold pins (item), a white bolt in a ring (wheel), a solid white bolt (status).

| Step | Do | Expect |
|---|---|---|
| 1 | Load a save. If V has no Overheat, switch on **Console** in REDnode's launcher and run `await game.player.addItem('Items.OverheatLvl3Program')` | |
| 2 | Open the inventory, then the cyberdeck's quickhacks, and hover Overheat | The card with the cyan bolt, at the size of the other quickhacks' cards, not stretched or cut |
| 3 | Open the crafting menu's quickhack tab and find Overheat | The same card |
| 4 | Scan an enemy and look at the quickhack wheel | Overheat's entry shows the white bolt in a ring, the size of the others |
| 5 | Upload Overheat on the enemy | Say what shows where the game showed its burning icon on the enemy: the solid white bolt, the game's icon, or nothing |
| 6 | Quit the game | Claude removes the two files after, so Overheat is the game's again |

Then say what differed, with a screenshot of any icon that looks wrong.

| Run | Result |
|---|---|
| 2026-11-10, dev PC, game 2.5 | **Pass**, steps 1 to 6, with EDGEhack_Test1 switched off in EDGEdeck (its own Overheat change won over the spike's icons at first). The spike's files went to the Recycle Bin after |


## H3.7b Desk icons

EDGEhack 0.0.18, in VS Code only, asked for after H3.7's run: a trash can on each Desk entry, and Add to Project with the new-file icon EDGEfab's Desk uses (0.0.17 had a drawn project board with a plus; the owner chose EDGEfab's as cleaner).

| Step | Do | Expect |
|---|---|---|
| 1 | Install `edgehack-0.0.18.vsix` and reload VS Code. Hover a quickhack on the Desk | Two icons at the right of its row: Add to Project (a page with a plus, as on EDGEfab's Desk), then a trash can, rightmost |
| 2 | Hover the trash can | Its tooltip says **Remove from the Desk...** |
| 3 | Press it, then **Cancel** | It asks first; Cancel leaves the entry |
| 4 | Press it again and confirm | The entry leaves the Desk, its tab closes if open, and it is in the Recycle Bin |
| 5 | Hover an entry of the **Project** group | No trash can on project entries |

| Run | Result |
|---|---|
| 2026-11-10, EDGEhack 0.0.18 | **Pass**, all 5 steps |


## H3.7 Desk

EDGEhack 0.0.16, in VS Code only. The Desk: quickhacks outside any project. Keep EDGEhack_Test1 open in REDcode until step 8.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `edgehack-0.0.16.vsix` and reload VS Code. Open the EDGEhack side bar | The **Desk** view has a **+** in its title bar, and lists **Project: EDGEhack_Test1** with Shock Ping |
| 2 | Press the Desk's **+**, pick **Overheat**, and name it **Desk Heat** | Its editor opens: "On the Desk: it writes no mod files until you add it to a project", and an **Add to Project** button where Pack and Play was. The Desk lists Desk Heat, "new, from Overheat", above the Project group. No `desk_heat` file appears in the project |
| 3 | Pick **Rare**, set RAM to 2, press **Ctrl+S** | The page says "Saved on the Desk". Get it has no Console line: it says the line shows once the quickhack is in a project |
| 4 | Right-click Desk Heat in the Desk view, **Duplicate...**, keep "Desk Heat copy" | The copy opens, with RAM 2 on Rare. The Desk lists both, the copy first |
| 5 | On Desk Heat's page, press **Add to Project** | A message names `edgehack_test1_desk_heat.yaml` added to the project. The project's copy opens, with **Pack and Play** and a Console line in Get it, RAM 2 on Rare. The Project group lists Desk Heat; the Desk still has its own |
| 6 | In the Desk view, press the inline **Add to Project** icon on Desk Heat. Press **Cancel**, then do it again and press **Replace** | It asks before replacing the project's copy. Cancel changes nothing; Replace writes it again |
| 7 | Right-click Desk Heat copy, **Remove from the Desk...**, confirm | It leaves the Desk, its tab closes, and it is in the Recycle Bin |
| 8 | Run **REDcode: Close Project** from the Command Palette. In the Quickhacks view right-click **Ping**, **Clone and Modify...**, name it **Loose Ping** | The box says it goes on the Desk. Loose Ping opens on the Desk, with Add to Project |
| 9 | Open the game's **Short Circuit** page from the Quickhacks view and press **Edit** | A change to Short Circuit opens on the Desk; the Desk lists it as "changes Short Circuit" |
| 10 | On Loose Ping's page press **Add to Project** | A message asks you to open a project first. Then open EDGEhack_Test1 again |

Then say what differed. Loose Ping and the Short Circuit change can be removed from the Desk afterwards.

| Run | Result |
|---|---|
| 2026-11-10, EDGEhack 0.0.16 | **Pass**, all 10 steps. Asked for after it: a hover trash can on each Desk entry, and Add to Project's icon with a plus (H3.7b, EDGEhack 0.0.18, with EDGEfab's new-file icon) |

## H3.6b Get it

EDGEhack 0.0.15. A new quickhack sold and crafted the way the game's tier it started from is. Shock Ping in EDGEhack_Test1 is the quickhack.

**Part A, in VS Code.**

| Step | Do | Expect |
|---|---|---|
| 1 | Install `edgehack-0.0.15.vsix` and reload VS Code. Open Shock Ping's editor | A **Get it** section near the bottom. At first it may say "Reading where the game sells it..." for a few seconds |
| 2 | Pick **Rare** in the Numbers header | Get it says the game's Rare Ping is sold as it is by 8 vendors, once V is level 15 or more (or has a cyberdeck of quality 4 or more), and its schematic by 13 vendors, once V is level 12 or more. **Sell it there** is ticked. **Components to craft it** shows 30, "Tier 3 Quickhack Components" |
| 3 | Pick **Common** | Sold as it is by 13 vendors, with no gate; its components 25 |
| 4 | On Rare, set **Components to craft it** to 2. On Legendary++, untick **Sell it there**. Press **Ctrl+S** | The page says it saved |
| 5 | Open the YAML (the message's **Open**, or `source/resources/r6/tweaks/EDGEhack_Test1/edgehack_test1_shock_ping.yaml`) | `Vendors.EDGEhack_edgehack_test1_shock_ping_PingProgram` and the others, `Items.Recipe_EDGEhack_edgehack_test1_shock_ping_PingLvl2Program`, a block per vendor ending in `.itemStock:` with `- !append-once` lines, and `CraftingData:` in the Rare item's own block. Nothing for Legendary++ in any vendor's stock |

**Part B, in the game.** Quit the game first, click **Pack and Play**, then start the game and load a save where V is level 15 or more.

| Step | Do | Expect |
|---|---|---|
| 6 | Go to Edge Net in Kabuki, or another netrunner who sells Ping, and open the shop | Shock Ping as a quickhack (Common, and Rare if V is level 15 or more), and a Rare Shock Ping schematic, beside Ping's. Legendary shows only once V is level 32 or more |
| 7 | Buy the Common Shock Ping quickhack | It is in the backpack: Shock Ping, Common |
| 8 | Buy the Rare Shock Ping schematic, then open **Crafting**, on its quickhacks tab | Shock Ping, Rare, asking for 2 components. If you lack them, switch on **Console** in the launcher and run `game.player.addItem("Items.QuickHackRareMaterial1", 2)` |
| 9 | Craft it, equip it and upload it on an enemy | It works as before: a chance to blind and blue electric numbers |
| 10 | Look for a Legendary++ Shock Ping at the Kabuki tech store that sells Ping's Legendary++ schematic | It is not there: Sell it there was off |

Then quit the game and say what differed.

| Run | Result |
|---|---|
| 2026-11-10, EDGEhack 0.0.15, on the laptop, game 2.5 | Pass: every step of Parts A and B as written. The new quickhack had to be made with Clone and Modify first, since Get it shows only on a new quickhack's page |

## H3.6a Get it spike

Answers three questions for H3.6 Get it (design, "H3.6 Get it: plan"): does a vendor show a new stock line on an existing save, does buying a schematic of EDGEhack's teach the recipe, and does the crafting menu craft the new quickhack. The file is hand-written: `E:\Modding\Cyberpunk 2077\Projects\EDGEhack_H36_spike\r6\tweaks\EDGEhack_H36_spike.yaml`, copied into the game's `r6\tweaks`. It needs the project EDGEhack_Test1 installed, with its Shock Ping.

What the file does:

| Part | What |
|---|---|
| Schematic | `Items.Recipe_EDGEhack_H36_ShockPing_Rare`, a copy of Ping's Rare schematic that crafts Shock Ping's Rare tier, named Shock Ping |
| Stock line | A copy of Ping's (V at level 12 or more, or a cyberdeck of quality 4 or more), appended to the 13 vendors that sell Ping's Rare schematic, Edge Net in Kabuki among them |
| Crafting | Shock Ping Rare costs 1 Rare quickhack component instead of 30, set as a flat on the record EDGEhack_Test1's file makes |

| Step | Do | Expect |
|---|---|---|
| 0 | With the game closed, the spike's file goes into the game's `r6\tweaks` (Claude copies it, with your OK) | |
| 1 | Start the game and load a save where V is level 12 or more. Switch on **Console** in the launcher and run `await tweakdb.type("Items.Recipe_EDGEhack_H36_ShockPing_Rare")` | `gamedataItemRecipe_Record`: the file loaded. `null` means it did not: stop and say so |
| 2 | Run `await tweakdb.get("Items.EDGEhack_edgehack_test1_shock_ping_PingLvl2Program.CraftingData")` | The crafting package's id: note what it says |
| 3 | Go to Edge Net in Kabuki (or any netrunner you know sells quickhack schematics) and open their shop | A **Shock Ping** schematic beside Ping's, Rare. Note its name, price and picture |
| 4 | If it is not there: leave, skip time by 24 hours (sit or sleep, Wait), and open the shop again | Say whether it showed then |
| 5 | Buy it | It leaves the shop |
| 6 | In the Console run `const book = await (await (await api.GameInstance.GetScriptableSystemsContainer(game.instance)).Get("CraftingSystem")).GetPlayerCraftBook(); await book.KnowsRecipe("Items.EDGEhack_edgehack_test1_shock_ping_PingLvl2Program")` | `true`: V knows the recipe |
| 7 | Open **Crafting**, the quickhacks tab | Shock Ping, Rare, with its cost. Note how many components it asks for: 1 if step 2's change took, 30 if not |
| 8 | If you lack them, run `game.player.addItem("Items.QuickHackRareMaterial1", 30)`, then craft one | A Shock Ping Rare in the backpack |
| 9 | Equip it in the cyberdeck and upload it on an enemy | The Rare tier's effects: blind at its chance and the electric numbers, as in H3.5 |
| 10 | If step 3 and step 4 found no schematic: run `game.player.addItem("Items.Recipe_EDGEhack_H36_ShockPing_Rare", 1)`, then step 6 again | Whether a schematic given by the Console teaches the recipe too |

Then quit the game and say what differed. Claude moves the spike's file to the Recycle Bin after.

| Run | Result |
|---|---|
| 2026-11-09, dev PC, game 2.5, REDnode 0.59.0 | **Pass**, steps 1 to 9 as written. The schematic was in the shop at once on an existing save, so no restock was needed; buying it taught the recipe (`KnowsRecipe` true); the crafting menu crafted Shock Ping Rare, and it worked on an enemy. Step 2 gave `0x0000001DC7C7B066`, which is `Items.PingLvl2CraftingPackage`, the game's own: the crafting package set as a flat from the spike's file, on a record EDGEhack_Test1's file makes, did not take, so crafting asked for 30 components. H3.6b writes the package in the item's own record, as planned |

## H3.5 Build one

EDGEhack 0.0.11, 0.0.12 for the message about added files, and 0.0.13 for Part C: the third tab of **Add Effect**, which builds a damage over time, a stat change while hacked or a chance to apply a status effect, from what the spike below proved. The writer ran against the real game records (design, "H3.5 built"); this checks it by hand and in the game.

**Before you start:**

- Install: `code --install-extension edgehack-0.0.11.vsix`, then **Developer: Reload Window**.
- Open a WolvenKit project in REDcode. The H3.4 test's project is fine.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Ping**, click **Clone and Modify...** on its page, type `Shock Ping`, and press Enter | A new tab with its editor, four tiers: Common, Rare, Legendary, Legendary++ |
| 2 | Scroll down to **Added effects**, click **Add Effect...** | The panel has three tabs: **Copy Existing**, **Status Effects** and **Make New** |
| 3 | Click **Make New** | Three rows: **Damage over time**, **Stat change while hacked**, **Chance to apply** |
| 4 | Click **Damage over time** | The panel closes. A card **Electric damage over time**, "Built by EDGEhack: a status effect of its own on each tier", **Damage type** Electric, a **Sparks as it starts** box, and rows **Damage a hit** (10), **Seconds between hits** (0.5) and **Duration** (8) in grey on every tier |
| 5 | Tick **Sparks as it starts**. In **Damage a hit**, type `40` under **Common** and press Tab | The box stays ticked. The field turns yellow |
| 6 | Click **Common** in the Numbers table's header, then **All tiers** on the card's **Damage a hit** row | Every tier shows 40 |
| 7 | Click **Add Effect...**, **Make New**, **Stat change while hacked** | A card **Movement speed** with a **Stat** list, a row **Movement speed (times normal)** at 0.5 and **Duration** at 10 |
| 8 | Change **Stat** to **Cannot sprint** | The card is now **Cannot sprint**, with only the **Duration** row |
| 9 | Change **Stat** back to **Movement speed** | The value row comes back, at 0.5 |
| 10 | Click **Add Effect...**, **Make New**, **Chance to apply** | The **Status Effects** tab, with a line "Pick the status effect the roll applies" above the search |
| 11 | Search `blind`, and click the row named **Blind** | A card **Chance to apply Blind** with its record, and a row **Chance (%)** at 25 |
| 12 | Type `100` under **Common** in **Chance**, press Tab, click **Common** in the header, then **All tiers** on that row | Every tier shows 100 |
| 13 | Click **Add Effect...**, **Make New**, **Damage over time**, then change its **Damage type** to **Chemical** | The card is **Chemical damage over time**, with no **Sparks** box, and says "Its damage stays off machines". At the top of the page, a grey note says EDGEhack keeps poison, bleed, and chemical and physical damage over time off machines |
| 14 | Press **Ctrl+S** | The line under the title says what it saved. In the project, `source/resources/r6/tweaks/<your mod>/<your mod>_shock_ping.yaml` has records ending `_a1_PingProgram_Tick` and `_a3_PingProgram_Chance` |

**The message about added files (EDGEhack 0.0.12).** Install `edgehack-0.0.12.vsix` the same way first.

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Short Circuit**, then **Clone and Modify...**, type `Toast Test`, and press Enter | The editor opens, and a message in VS Code's corner: "EDGEhack added a file to the project: source/resources/r6/tweaks/<your mod>/<your mod>_toast_test.yaml", with **Open** |
| 2 | Click **Open** in the message | The YAML opens as text in a new tab, beside the editor |
| 3 | Back on Toast Test's editor, type `20` under any tier's **RAM** and press **Ctrl+S** | No message this time: the file was there already |
| 4 | Delete the Toast Test document and its YAML from the project if you like | |

**Part B, in the game**

First: quit the game if it is running. Click **Pack and Play** at the top of the page, then start the game and load a save with enemies nearby.

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below, so the Marks' numbers match the steps'.

| Step | Do | Expect |
|---|---|---|
| 1 | In the launcher, switch on **Console**. On the page in VS Code, click **Common** in the Numbers table's header, copy the line from **Give yourself one** and run it in the Console. Put Shock Ping (Common) in the cyberdeck, and take the game's own Ping out | Shock Ping on the wheel when you scan an enemy |
| 2 | Upload it on an enemy | Sparks on the enemy as it starts. Yellow electric numbers and green chemical numbers about every half second for about 8 s |
| 3 | Paste the line below into the Console without pressing Enter, upload Shock Ping on a fresh enemy, and press Enter as soon as the upload finishes, crosshair on the enemy | `blind: true` |
| 4 | Watch an enemy you uploaded it on while it walks or runs | It moves at about half its speed for about 10 s |
| 5 | If a drone or robot is around, upload it there. Skip this if not, and still press Mark | Yellow numbers only: no green chemical ones |

```
const ses = await api.GameInstance.GetStatusEffectSystem(game.instance); const t = await (await api.GameInstance.GetTargetingSystem(game.instance)).GetLookAtObject(await api.GetPlayer(game.instance), false, false); const id = await t.GetEntityID(); ({ blind: await ses.HasStatusEffect(id, "BaseStatusEffect.Blind") })
```

Then quit the game, and say what differed. If something failed, the lines with errors from TweakXL's log and `r6/logs/redscript_rCURRENT.log` help.

**Part C, damage types (EDGEhack 0.0.13).** Each damage card now copies the game's own attack of its type. One card per tier, so each enemy shows one colour.

| Step | Do | Expect |
|---|---|---|
| 1 | Install `edgehack-0.0.13.vsix` and reload VS Code. Open Shock Ping's editor | The Movement speed card says `speed is not a stat EDGEhack offers`, and a warning says so at the top. The damage cards read **Chemical damage over time** and **Electric damage over time** |
| 2 | Click **Remove** on the Movement speed card. Add two more: **Add Effect...**, **Make New**, **Damage over time**, then set the new card's **Damage type** to **Thermal**; once more for **Physical** | Four damage cards, each with its own type in its title |
| 3 | On each damage card's **On this tier** row, leave one box ticked: Chemical on **Common**, Electric on **Rare**, Thermal on **Legendary**, Physical on **Legendary++** | |
| 4 | Press **Ctrl+S**. Quit the game, click **Pack and Play**, then start the game and load a save with enemies | |
| 5 | Switch on **Console**. For each tier, click it in the Numbers header in VS Code and run its **Give yourself one** line in the Console | Four Shock Pings in the backpack |
| 6 | Upload the Common one on a human | Green numbers |
| 7 | Upload the Rare one on another | Light blue numbers |
| 8 | Upload the Legendary one on another | Yellow-orange numbers |
| 9 | Upload the Legendary++ one on another | White numbers |
| 10 | If a drone or robot is around, upload the Common one on it | No numbers |

If a step shows no numbers: aim at that enemy, run the line below, and upload within a second or two. For 15 s it writes the enemy's status effects to REDnode's mod log every half second, so Claude can read them after.

```
const ses = await api.GameInstance.GetStatusEffectSystem(game.instance); const t = await (await api.GameInstance.GetTargetingSystem(game.instance)).GetLookAtObject(await api.GetPlayer(game.instance), false, false); const id = await t.GetEntityID(); for (let i = 0; i < 30; i++) { const r = await ses.GetAppliedEffects(id, api.$out); const ids = await Promise.all(r.out.appliedEffects.map(async (e) => String(await (await e.GetRecord()).GetID()))); console.log(`watch ${i}: ${ids.join(" ")}`); await new Promise((ok) => setTimeout(ok, 500)); }
```

| Run | Result |
|---|---|
| 2026-11-08, EDGEhack 0.0.11, dev PC, Part A | **Pass**, every step as written. The owner asked for a message naming each file a save adds to the project, with **Open** (built in 0.0.12) |
| 2026-11-08, EDGEhack 0.0.11, dev PC, Part B | Steps 1 and 3 **pass**: Shock Ping on the wheel, `blind: true` (the chance route from the file, as from the Console). Step 2: only yellow numbers. The saved document shows why: step 13's type change landed on the **first** damage card (a1: Chemical, 40 a hit, sparks set), and the fourth (a4) stayed Electric at 10, so the yellow numbers were a4's. Whether the editor sent the change to the wrong card is open: both cards were titled Electric damage over time. Still, a1's chemical damage showed no numbers on a human, with its records as designed (a chemical attack, the tick behind EDGEhack's machines check): to settle in the next run. Step 4: not seen, since the blinded enemy stood still. Step 5: no drone near. Both go in the next run |
| 2026-11-08, EDGEhack 0.0.12, dev PC, Console checks on the same build | Both damage statuses were on the enemy (`chemical: true, electric: true`), yet only yellow numbers came, with the damage numbers set to Individual too. The game's colours (`damage_types.inkstyle`, `main_colors.inkstyle`): Electric light blue, **Thermal yellow-orange**, Chemical green, Physical white. So both built cards dealt thermal damage: they copied Overheat's attack, and the copy deals thermal whatever type it is given. With the electric card's tick pointed at the game's own `Attacks.ElectricDamageOverTime`, its numbers showed **blue** at once. Changes from the Console to the chemical card's tick (prereq, timing, tag, attack) showed no difference, unexplained. Triple Heat (H3.4's quickhack, rebuilt) still showed burn, poison and bleed numbers. Step 3 of the next run: an alerted enemy with the stat change moved at normal speed, running for cover: `MaxSpeed` does not slow an enemy. Pack and Play while the game runs swaps the archive only: a new quickhack's records need a restart |
| 2026-11-08, EDGEhack 0.0.13, dev PC, Part C | **Pass**, steps 1 to 9 as written: the Movement speed card said it is no longer offered; with one damage card per tier, Common showed green (chemical, with the machines check, on a human), Rare light blue (electric), Legendary yellow-orange (thermal), Legendary++ white (physical). Step 10 (a drone) not run: none near. **H3.5 passes**, with the drone check for chemical and physical damage left for the next in-game test |
| 2026-11-09, EDGEhack 0.0.14, dev PC, Part C step 10 | **Pass**: on a drone, the Common tier (chemical) and the Legendary++ tier (physical) showed no damage numbers. H3.5 is done |

## H3.5 Attack features spike

Can EDGEhack write status effects of its own, from nothing, for H3.5's three kinds of attack feature? The file [`tools/spikes/edgehack_h35_spike.yaml`](https://github.com/Edgemodders/EDGEhack/blob/main/tools/spikes/edgehack_h35_spike.yaml) gives the game's own Ping (Common) four extra effects on its target. Ping Epic (`Items.PingLvl3Program`) is deprecated in 2.5 and has no quickhack, which the first run found. Ping is used rather than Overheat because a burning enemy flails about, which would hide a change in speed.

| Effect | What it is | What it checks |
|---|---|---|
| Shock | Electric damage, 3 a hit every 0.5 s for 8 s, with the electric icon | A damage over time in a status effect written from nothing |
| Slow | Movement speed ×0.3 for 15 s, with the lowered-stats icon | A stat change in a status effect written from nothing |
| Jam | The game's chance part (`ApplyStatusEffectByChanceEffector`) run straight from the quickhack, 100%, applying Weapon Malfunction | Whether a quickhack can roll a chance with no status effect around it |
| Blind | The same chance part inside a carrier status effect of 1 s, 100%, applying Blind | The way the game's EMP does it |

**Before you start:** quit the game. Copy `edgehack_h35_spike.yaml` into the game's `r6\tweaks` folder. Start the game and load a save with enemies nearby.

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below. Switch on **Console** in the launcher.

| Step | Do | Expect |
|---|---|---|
| 1 | Run `await game.player.addItem("Items.PingProgram")` in the Console, and put Ping (Common) in the cyberdeck | The Console answers without an error |
| 2 | Upload Ping on an enemy | Yellow numbers about every half second for about 8 s (the game's colour for an electric damage over time). Say which icons show over the enemy: shock, lowered stats, jammed weapon, blinded |
| 3 | Watch that enemy for 15 s | It moves at about a third of its speed; it acts blinded; its weapon jams when it shoots. Say which of these you saw |
| 4 | Run `await tweakdb.set("EDGEhack.Spike.ShockTick.delayTime", 0.1)`, then upload Ping on another enemy | `true`, then numbers five times as often. Say whether they keep up or bunch together |
| 5 | Run `await tweakdb.set("EDGEhack.Spike.JamChance.value", 0.5)` and `await tweakdb.set("EDGEhack.Spike.BlindChance.value", 0.5)`, then upload Ping on four more enemies | `true` twice. Count how many got a jammed weapon and how many were blinded: about half of each, if the roll works |

Then quit the game, remove `edgehack_h35_spike.yaml` from `r6\tweaks`, and say what differed. If an effect did not show at all, the lines with errors from TweakXL's log help.

| Run | Result |
|---|---|
| 1 (2026-11-07, dev PC, file for Ping Epic) | Stopped at step 2: Ping Epic did not show on the quickhack wheel. It is deprecated in 2.5 (`deprecated: true`, no quickhack); the spike moved to Ping Common. TweakXL read the file with no errors |
| 2 (2026-11-07, dev PC, Ping Common, effects linked from the Console) | **Shock: pass.** A hit every 0.5 s for 8 s; at 0.1 s they kept up with no bunching. Each hit showed 1, not 3 (the game lowers it; Overheat's attack has a second, larger damage part). The numbers were **yellow**: the game shows an electric damage over time in yellow, and Short Circuit's direct electric hit in white, so no electric hit is blue; the colour comes from the game's damage number display, not TweakDB. A running total above the head and each hit beside it is the game's own display. **Slow: applied** (the Console's status check said so); the slower walk was not seen, the enemy being out of combat. **Icons:** none over the enemy, not even the game's own Blind; status icons may show only on V's bar (unverified). **Jam and Blind with `ApplyStatusEffectByChanceEffector`: fail.** Neither applied, on the enemy or on V. The game's script rolls that effector only in `RepeatedAction`, when its prereq fires again, so with an always-true prereq it never rolls (the game's EMP jam uses it the same way). **Fixed from the Console:** the plain `ApplyStatusEffectEffector` behind the game's `SetChancePrereq` (`setChance`), inside the carrier: Blind applied on 4 of 5 enemies at 50% and 0 of 4 at 0%. Run straight from the quickhack (`effectorToTrigger`), the same parts applied nothing, so a chance needs a carrier status. **Sparks:** the game's `status_electrocuted` on the shock status showed for a couple of seconds at the start only. Closing the Console undid its TweakDB changes (REDnode undoes a stopped package's changes), which turned Ping back to the game's own once. **Sparks replayed on each hit** (each hit applying a 1 s status with a copy of `status_electrocuted` set to `shouldReapply`): red or orange shooting sparks, like a broken wire, not the blue arcs; with a hit every 2 s the same, so the restart was not cutting it off. Not used. **Decided with the owner:** chance cards use a carrier with `SetChancePrereq`; electric damage gets a Sparks switch with the blue one-time sparks; lasting sparks stay open (leads: Short Circuit's `PlayVFXEffector`, a replay timer); the icon list per card is dropped; blue damage numbers would need a script mod, planned separately |

## H3.4b Machines

EDGEhack 0.0.9: an added poison or bleed keeps its damage off machines. Uses the Triple Heat quickhack from H3.4's test.

**Before you start:** `code --install-extension edgehack-0.0.9.vsix`, then **Developer: Reload Window**. Open the project with Triple Heat in REDcode.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view's Project group, open **Triple Heat** | Under the title, grey notes with an info mark: one that EDGEhack keeps poison and bleed damage off machines, one that Contagion Epic in the cyberdeck ends this quickhack's poison at a burn's first hit, without the explosion |
| 2 | Scroll down to **Added effects** | The **Poison** card says "A copy of its own on each tier, which keeps its damage off machines. Numbers changed on Rare." The **Bleeding** card says the same without the last sentence |
| 3 | Press **Ctrl+S**, then open the YAML file under `source/resources/r6/tweaks/` | A record ending `.NotMachine` with `$type: StatPrereq`, and records ending `_Effector` with `prereqRecord:` naming it |

**Part B, in the game**

First: quit the game if it is running. Click **Pack and Play** on Triple Heat's page, start the game, and load a save. Keep every Contagion of Epic or better out of V's cyberdeck until step 5. Triple Heat's Rare, Epic and Legendary from H3.4's test are still in the backpack (if not, give them with the page's **Give yourself one** lines in REDnode's Console).

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below. Switch on **Console** in the launcher for step 5.

| Step | Do | Expect |
|---|---|---|
| 1 | Put Triple Heat's Epic in the cyberdeck and upload it on a drone | Burn only: no green or white numbers. Say whether a poison or bleed icon shows |
| 2 | Upload it on a human | Burn, green poison numbers for about 8 s, and white bleed numbers |
| 3 | Swap it for its Rare, and upload it on another human | The poison lasts about 20 s, well after the burn ends |
| 4 | If an android or a mech is around, upload the Epic on it. Skip this if not, and still press Mark | Burn only |
| 5 | Run `await game.player.addItem("Items.ContagionLvl3Program")` in the Console, put that Contagion in the cyberdeck beside Triple Heat's Epic, and upload Triple Heat on another human | One green number, then the poison ends, with no large red explosion. Take the Contagion out after |

Then quit the game and say what differed. If something failed, the lines with errors from TweakXL's log help.

| Run | Result |
|---|---|
| 2026-11-07, EDGEhack 0.0.9, the laptop, game 2.5 | **Pass**, Parts A and B, every step as written. Step 1: the drone showed no poison or bleed numbers and no poison or bleed icon. Step 4: an android, the same. Step 5: with Contagion Epic in the cyberdeck, one green number, then the poison ended with no explosion, as the note says. So the game takes a `$base` copy of an inline effector and package, which H3.3 had left open |

## H3.4b Machines spike

Can a poison or a bleed be kept off machines? Run with REDnode's Console in a session with Triple Heat installed (H3.4's test) and no Contagion of Epic or better in V's cyberdeck. Each change lasts until the Console stops or the game quits.

Timer: switch on **Test timer**, press **Start**, and **Mark** after each step.

| Step | Do | Expect |
|---|---|---|
| 1 | Run `await tweakdb.set("BaseStatusEffect.ContagionPoisonLvl3.immunityStats", ["BaseStats.PoisonImmunity", "BaseStats.IsMechanical"])` | `true` |
| 2 | Run `await tweakdb.set("BaseStatusEffect.Bleeding.immunityStats", ["BaseStats.BleedingImmunity", "BaseStats.IsMechanical"])` | `true` |
| 3 | Upload Triple Heat's Epic on a drone | Say which numbers show |
| 4 | Run `await tweakdb.set("BaseStatusEffect.ContagionPoisonLvl3_inline3.prereqRecord", "BaseStatusEffect.OverheatLevel2_inline8")` (Overheat's check: a Human NPC) | `true` |
| 5 | Run `await tweakdb.set("BaseStatusEffect.Bleeding_inline8.prereqRecord", "BaseStatusEffect.OverheatLevel2_inline9")` (Overheat's check: `IsMechanical` is 0) | `true` |
| 6 | Upload Triple Heat's Epic on a fresh drone | Say which numbers show |
| 7 | Upload it on a human | Say which numbers show |

| Run | Result |
|---|---|
| 2026-11-07, EDGEhack 0.0.6's Triple Heat, the laptop, game 2.5 | Steps 1 and 2 answered `true`, but step 3's drone still took the poison and the bleed: `immunityStats` is not checked when a quickhack applies an effect. Steps 4 and 5 answered `true`; step 6's drone took only the burn, so both checks stop the damage, and drones carry the `IsMechanical` stat. Step 7's human took the burn, the poison and the bleed. H3.4b uses the stat check (machines exactly) on its own copies of the damage effectors |

## H3.4 Add Effect

EDGEhack 0.0.6: adding effects to a new quickhack. The smoke test has already driven these pages, and the writer ran against every family; this checks them by hand, with the real REDcode, and for the first time in the game.

**Before you start:**

- Install: `code --install-extension edgehack-0.0.6.vsix`, then **Developer: Reload Window**. REDcode must be 0.10.5 or later.
- Open a WolvenKit project in REDcode. The H3.3 test's project is fine.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Overheat**, click **Clone and Modify...** on its page, type `Triple Heat`, and press Enter | A new tab with its editor |
| 2 | On that page, scroll down to **Added effects**, below the Numbers table. Click **Add Effect...** | A panel opens with two tabs. **Copy Existing** shows 17 quickhacks with their icons: every family but Overheat |
| 3 | Click **Contagion** in the panel | Below the icons, one row: **Poison**, on the target, Poisoned, with how long it lasts and its damage |
| 4 | Click that row | The panel closes. A card for **Poison**: "From Contagion, following its tiers", "Uses the game's record", a row of ticked boxes **On this tier**, then Duration, Stacks and Damage a hit per tier. |
| 5 | Click **Add Effect...**, then the **Status Effects** tab | A long list under **Works on enemies**. At its end, a line saying how many more there are |
| 6 | In the search box above the list, type `smasher` | "Nothing matches" |
| 7 | Tick **Show all** beside the search box | Rows under **Boss fights** |
| 8 | Untick **Show all**, and change the search to `bleeding` | A shorter list. Each row has a name, what the game calls it where that differs, and its record |
| 9 | Click the row named **Bleeding** | A second card, with **Goes on** set to **the target** |
| 10 | Click **Add Effect...**, then **Status Effects**. Tick **Show all**, search `optical camo player buff common`, and click the row named **Optical Camo Player Buff Common** | A third card, with **Goes on** set to **V**, and no warning about it |
| 11 | On that third card's **On this tier** row, clear every box except **Epic** | The boxes stay as you left them |
| 12 | On the **Poison** card, in the **Duration** row, type `20` under **Rare**, and press Tab | The field turns yellow. The card says "A copy of its own on Rare; the game's record elsewhere" |
| 13 | On the **Bleeding** card, clear the box under **Legendary**. Click an empty spot on the page, then press **Ctrl+Z** | The box comes back ticked. Press **Ctrl+Y**: it clears again |
| 14 | Press **Ctrl+S** | The line under the title says what it saved. In the project, `source/resources/r6/tweaks/<your mod>/<your mod>_triple_heat.yaml` has a record ending `_a1_OverheatLvl2Program` |

**Part B, in the game**

First: quit the game if it is running. Take any Contagion of Epic or better out of V's cyberdeck: its passive ends a poison on a burning enemy at its first hit (see the first run below). Click **Pack and Play** at the top of the page, then start the game, and say if it does something other than you expect (REDcode packs the project and installs it). Load a save.

Timer: in REDnode's launcher (F10), switch on **Test timer**, press **Start**, and **Mark** after each step below, so the Marks' numbers match the steps'.

| Step | Do | Expect |
|---|---|---|
| 1 | In the launcher, switch on **Console**. On the page in VS Code, in the Numbers table, click **Rare** in its header row, and copy the line from **Give yourself one**. Run it in the Console. Do the same for **Epic** and **Legendary** | Three Triple Heat quickhacks in the backpack |
| 2 | Put Triple Heat's Rare in the cyberdeck, scan an enemy, and upload it | They burn, are poisoned and bleed. The poison lasts about 20 s, well after the burn ends. Say what you see, and what the enemy's status icons show |
| 3 | Swap it for its Epic, and upload it on another enemy | Burn, poison for about 8 s and a bleed. V goes invisible for a moment; say what happens if not |
| 4 | Swap it for its Legendary, and upload it on another enemy | Burn and poison, no bleed, and V stays visible |
| 5 | If a drone or robot is around, upload it there. Skip this if not, and still press Mark | Say whether it takes the poison and the bleed. The page's warning leaves this unverified |
| 6 | Run `await game.player.addItem("Items.OverheatLvl2Program")` in the Console, put it in the cyberdeck, and upload the game's own Overheat on another enemy | Only a burn, for the game's time. Nothing added reaches the game's quickhack |

Then quit the game, and say what differed. If something failed, the lines with errors from TweakXL's log and `r6/logs/redscript_rCURRENT.log` help.

| Run | Result |
|---|---|
| 2026-11-07, EDGEhack 0.0.6, the laptop, game 2.5 | **Part A: pass**, every step. Seen: Chromium drew the checkboxes in its own blue, not the theme's (fixed after), and the owner asked to rename **Make a New One From This** to **Clone and Modify** (done after). **Part B, steps 2 and 3:** burn and bleed numbers, but one green poison number only, on Rare (the 20 s copy) and on Epic (the game's record); Epic's was followed by a large red number. With the damage numbers set to individual, the same. A Contagion with an added bleed showed green and white numbers together, so the poison works from another hack. Cause, from the records: `EquipmentGLP.ContagionLvl3Passive`, which Contagion Epic and better give V in the cyberdeck. A hit on a burning target that has any poison tagged `ContagionPoison` removes it, and with the game's own `ContagionPoisonLvl3`, `Lvl4` or `Lvl4PlusPlus` it also triggers `Attacks.ContagionBurnCombo` (thermal, 5 m). With V's Legendary Contagion out of the deck, a new **Heat Plague** (Overheat plus Contagion's poison, game records) showed green numbers for the poison's whole time. EDGEhack had no fault; the editor now shows a note (not a warning: the game works as designed) about a burn and Contagion's poison on one tier. **Steps 4 to 6: pass.** Legendary burned and poisoned with no bleed and V stayed visible. A drone took Triple Heat's poison and bleed (the effect runs on a kind of NPC its AIData leaves out; EDGEhack 0.0.8 drops the message about it, as players expect that). The game's own Overheat only burned. **H3.4 passes** |

## H3.3 New

EDGEhack 0.0.5: making a new quickhack, and the first run of the writer's own output in the game, with several tiers and copied damage and duration. The smoke test has already driven these pages; this checks them by hand, with the real REDcode, and in the game.

**Before you start:**

- Install: `code --install-extension edgehack-0.0.5.vsix`, then **Developer: Reload Window**. REDcode must be 0.10.5 or later.
- Open a WolvenKit project in REDcode, a new test one. The mod goes into it.

**Part A, in VS Code**

| Step | Do | Expect |
|---|---|---|
| 1 | In the Quickhacks view, click **Overheat** | The read-only page, with **Edit...** and **Clone and Modify...** |
| 2 | Click **Clone and Modify...** and type `!!!` | VS Code's box asks for a name, and says it needs a letter or a digit |
| 3 | Replace it with `Overheat` | It refuses: that name would take the file for changes to the game's Overheat |
| 4 | Replace it with `Spike Static`, and press Enter | A new tab, `<your mod>_spike_static.quickhack.json`. The line under the title says it is a new quickhack started from Overheat. No "Against bosses" rows. A **Give yourself one** section with a Console line |
| 5 | Look at the top of the Quickhacks view | **Project: <your project>**, with **Spike Static**, "new, from Overheat" |
| 6 | Right-click **Contagion** in the view, choose **Clone and Modify...**, then press Esc | The box asks for a name. Esc makes nothing |
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
| 6 | Under Icons, Item: **Change...**, and pick Short Circuit's. Wheel: **Change...**, and pick Short Circuit's | The picker shows the game's icons. A pick shows at once, with a **Original** button to undo it |
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
