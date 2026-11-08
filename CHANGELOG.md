# Changelog

What changed in each EDGEhack release, for players. Each release takes its notes from its section here: the GitHub release, the Marketplace's changelog tab and the version's changelog on the Nexus Mods page.

How to keep it (the Edgemodders convention):

- With each change a player would notice, add a line under **Unreleased**, in its group: **New**, **Changed**, **Fixed** or **Other**. One change per line. Leave out test-only changes.
- Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty **Unreleased** above it.
- Links are full URLs, since the same text goes to GitHub and Nexus.

## Unreleased

**New**

- **Add Effect** in the quickhack editor: add another quickhack's effect, which follows that quickhack's tiers, or any status effect, sorted by who it works on and searchable by name, tag and type. Each added effect can be left off some tiers, and has its own duration, stacks and damage per tier; a changed number gives that tier a copy of its own. The editor warns about combinations that may not work, and notes what the game does with others, as it should (a burn ends Contagion's poison when V has Contagion Epic or better).
- **Build one** in Add Effect: a damage over time (Electric, Thermal, Chemical or Physical, with damage a hit, seconds between hits and how long; electric can show the game's sparks as it starts), a stat change while hacked (movement speed, accuracy, armor, a resistance, evasion, detection, time between shots, or no sprinting, jumping, cover or calling for help), or a chance to apply any status effect, each with its numbers per tier. Chemical and physical damage stay off machines, as an added poison or bleed does.
- When EDGEhack adds a file to your project (a quickhack's YAML, its texts file, the shared script), a message names it, with **Open** to see it as text.
- A poison or bleed added to a quickhack keeps its damage off machines (androids, drones and mechs), which the game would let it hit through a quickhack that can target them. The editor says so in a note.
- **Clone and Modify** on a quickhack's page and in the Quickhacks view: a new quickhack beside the game's, with its own name, item per tier, wheel entry and cooldown, which leaves the game's quickhack as it is. Spread and the versions for bosses are left out for now.
- The Quickhacks view lists the open project's quickhacks in a Project group at the top.
- The EDGEhack side bar with its Desk, Library and Quickhacks views (Desk and Library empty until their phases).
- The Quickhacks view: the game's quickhacks by category, family and tier, with their icons, then device and vehicle hacks; a filter.
- The quickhack page (read-only): a quickhack's texts, icons, RAM, upload, cooldown, duration and damage for every tier, its effects in plain words, who it works on, spread, what it does while equipped, its crafting spec, and every record behind it, each opening in REDcode.
- Edit a game quickhack: its name, description, wheel text, item and wheel icons (from the game's own), RAM, upload, duration, damage and cooldown, per tier where the game allows, with All tiers and the game's value beside each. Each save writes a TweakXL and ArchiveXL mod into your REDcode project; Pack and Play is on the page.
- Open in EDGEhack on any record in REDcode's TweakDB view, and the command EDGEhack: Open a Quickhack..., which take any record of a quickhack (any tier, its Boss, Chimera or Spread action, its crafting spec).
