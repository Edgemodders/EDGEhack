// The quickhack editor's HTML, pure (no VS Code): the document's values in inputs, the game's beside
// them, and below them the read-only panels of what the game has. Each input names what it sets; the
// page's script (media/editor.js) sends the changes to the host, which edits the document.
import type { QuickhackDoc, TierField } from "./document";
import { ADDED_FIELDS, type AddedField } from "./document";
import { mainEffect, tierKey, type Family, type IconRef, type Tier } from "./read";
import { esc, img, rec, tierPanel } from "./pageHtml";
import { newItemPath } from "./tweaks";
import { addedGameValue, effectSummary, worthAdding, type ResolvedAdded } from "./effects";

/** What the game has for one of a tier's numbers, or undefined when the tier has none to change. */
export function gameValue(t: Tier, field: TierField): number | undefined {
  const main = mainEffect(t.effects);
  switch (field) {
    case "ram":
      return t.ram?.base;
    case "upload":
      return t.upload?.base;
    case "damage":
      return main?.damage[0]?.perHit;
    case "duration":
      return main?.duration && isFinite(main.duration.base) ? main.duration.base : undefined;
    case "bossRam":
      return t.boss?.ram?.base;
    case "bossUpload":
      return t.boss?.upload?.base;
  }
}

const key = (t: Tier): string => t.item ?? t.action;

const ROWS: { field: TierField; label: string; unit: string; hint?: string }[] = [
  { field: "ram", label: "RAM", unit: "" },
  { field: "upload", label: "Upload", unit: "s" },
  { field: "duration", label: "Duration", unit: "s", hint: "How long its main effect lasts on the target. Tiers that share a status effect share this" },
  { field: "damage", label: "Damage a hit", unit: "", hint: "For damage over time, a tick. The game's tooltip gives it a second" },
  { field: "bossRam", label: "Against bosses: RAM", unit: "", hint: "Left empty, a boss gets the same change as the tier" },
  { field: "bossUpload", label: "Against bosses: upload", unit: "s", hint: "Left empty, a boss gets the same change as the tier" },
];

function numberCell(doc: QuickhackDoc, t: Tier, i: number, field: TierField): string {
  const game = gameValue(t, field);
  if (game === undefined) return `<td data-tier="${i}"><span class="none">none</span></td>`;
  const value = doc.tiers[key(t)]?.[field];
  return `<td data-tier="${i}"><input type="number" min="0" step="any" data-tier-key="${esc(key(t))}" data-field="${field}" data-game="${esc(game)}" placeholder="${esc(game)}" value="${value === undefined ? "" : esc(value)}"></td>`;
}

export interface EditorIcons {
  /** Icons of the game's records, by atlas|part, as the read-only panels use. */
  all: Map<string, string>;
  /** What the document's icons show now. */
  item?: string;
  wheel?: string;
}

function iconChoice(which: "item" | "wheel", label: string, src: string | undefined, changed: boolean): string {
  const shown = src ? `<img class="icon" src="${esc(src)}" alt="${esc(label)}">` : `<span class="icon blank"></span>`;
  return `<figure data-icon-figure="${which}"${changed ? ' class="changed"' : ""}>${shown}<figcaption>${esc(label)}<br>
<button data-icon="${which}">Change...</button> <button data-icon-reset="${which}"${changed ? "" : " hidden"}>Game's</button></figcaption></figure>`;
}

const ADDED_ROWS: Record<AddedField, { label: string; unit: string; hint?: string }> = {
  duration: { label: "Duration", unit: "s" },
  stacks: { label: "Stacks", unit: "", hint: "How many times it can stack on the target" },
  damage: { label: "Damage a hit", unit: "", hint: "For damage over time, a tick" },
};

/** Which record each tier uses: the game's, or a copy with changed numbers. */
function usesWhat(fam: Family, r: ResolvedAdded): string {
  const copied = fam.tiers.filter((t) => {
    if (r.entry.off?.includes(tierKey(t))) return false;
    const values = r.entry.values?.[tierKey(t)];
    return !!values && ADDED_FIELDS.some((f) => values[f] !== undefined && values[f] !== addedGameValue(r.byTier.get(tierKey(t)), f));
  });
  if (!copied.length) return "Uses the game's record.";
  const names = copied.map((t) => t.quality ?? t.rank).join(", ");
  return copied.length === fam.tiers.length ? "A copy of its own on every tier." : `A copy of its own on ${names}; the game's record elsewhere.`;
}

function addedCard(fam: Family, r: ResolvedAdded, icons: Map<string, string>): string {
  const id = esc(r.entry.id);
  const top = [...r.byTier.values()].pop();
  if (!top) {
    return `<div class="added" data-added-card="${id}"><p class="none">${esc(r.problem ?? r.name)}</p><button data-added-remove="${id}">Remove</button></div>`;
  }
  const head = fam.tiers.map((t, i) => `<th data-tier="${i}">${esc(t.quality ?? `Tier ${i + 1}`)}</th>`).join("");
  const onRow = `<tr><th scope="row" title="Clear a box to leave this effect off that tier">On this tier</th>${fam.tiers
    .map((t, i) => {
      const key = tierKey(t);
      return `<td data-tier="${i}">${r.byTier.has(key) ? `<input type="checkbox" data-added-on="${id}" data-added-tier="${esc(key)}"${r.entry.off?.includes(key) ? "" : " checked"}>` : `<span class="none">none</span>`}</td>`;
    })
    .join("")}</tr>`;
  const rows = ADDED_FIELDS.filter((f) => [...r.byTier.values()].some((e) => addedGameValue(e, f) !== undefined))
    .map((f) => {
      const row = ADDED_ROWS[f];
      const cells = fam.tiers
        .map((t, i) => {
          const key = tierKey(t);
          const game = addedGameValue(r.byTier.get(key), f);
          if (game === undefined) return `<td data-tier="${i}"><span class="none">none</span></td>`;
          const value = r.entry.values?.[key]?.[f];
          return `<td data-tier="${i}"><input type="number" min="0" step="any" data-added="${id}" data-added-tier="${esc(key)}" data-added-field="${f}" data-game="${esc(game)}" placeholder="${esc(game)}" value="${value === undefined ? "" : esc(value)}"></td>`;
        })
        .join("");
      return `<tr><th scope="row"${row.hint ? ` title="${esc(row.hint)}"` : ""}>${esc(row.label)}${row.unit ? ` <span class="none">(${row.unit})</span>` : ""}<button class="all" data-added-all="${id}" data-added-field="${f}" title="Give every tier the selected tier's change">All tiers</button></th>${cells}</tr>`;
    })
    .join("");
  const who = r.entry.from
    ? ""
    : `<label class="who">Goes on <select data-added-who="${id}"><option value="target"${top.on === "target" ? " selected" : ""}>the target</option><option value="V"${top.on === "V" ? " selected" : ""}>V</option></select></label>`;
  const icon = top.icon && icons.has(`${top.icon.atlas}|${top.icon.part}`) ? top.icon : undefined;
  return `<div class="added" data-added-card="${id}">
<div class="effect">${img(icons, icon, "icon small", r.name)}<div>
<b>${esc(r.name)}</b> ${rec(top.status ?? top.record, "record")} <button class="remove" data-added-remove="${id}">Remove</button>
<p class="facts">${r.sourceName ? `From ${esc(r.sourceName)}, following its tiers. ` : ""}${esc(effectSummary(top))}</p>
<p class="facts" data-added-uses>${esc(usesWhat(fam, r))}</p>
${who}
</div></div>
<table class="numbers"><thead><tr><th></th>${head}</tr></thead><tbody>${onRow}${rows}</tbody></table>
</div>`;
}

/** Every icon the added effects show, for the host to find. */
export function addedIcons(added: ResolvedAdded[]): IconRef[] {
  const out: IconRef[] = [];
  for (const r of added) for (const e of r.byTier.values()) if (e.icon) out.push(e.icon);
  return out;
}

/** The added effects' cards: sent again whenever the document changes. */
export function renderAddedEffects(fam: Family, added: ResolvedAdded[], icons: Map<string, string>): string {
  if (!added.length) return `<p class="none">None yet. It has the effects below, from the game's ${esc(fam.name)}.</p>`;
  return added.map((r) => addedCard(fam, r, icons)).join("\n");
}

export function renderEditor(fam: Family, doc: QuickhackDoc, icons: EditorIcons, start: number, added: ResolvedAdded[] = []): string {
  const tiers = fam.tiers;
  const top = tiers[tiers.length - 1];
  const head = tiers.map((t, i) => `<th data-tier="${i}"><button data-pick="${i}" data-tier="${i}" data-key="${esc(tierKey(t))}">${esc(t.quality ?? `Tier ${i + 1}`)}</button></th>`).join("");
  // A new quickhack has no Boss or Chimera action of its own, so nothing to set against bosses.
  const rows = ROWS.filter((r) => !(doc.newHack && (r.field === "bossRam" || r.field === "bossUpload")))
    .filter((r) => tiers.some((t) => gameValue(t, r.field) !== undefined))
    .map(
      (r) =>
        `<tr><th scope="row"${r.hint ? ` title="${esc(r.hint)}"` : ""}>${esc(r.label)}${r.unit ? ` <span class="none">(${r.unit})</span>` : ""}<button class="all" data-apply-all="${r.field}" title="Give every tier the selected tier's change">All tiers</button></th>${tiers.map((t, i) => numberCell(doc, t, i, r.field)).join("")}</tr>`,
    )
    .join("\n");
  const cooldown = top.cooldown;
  const cooldownRow = cooldown
    ? `<p class="family"><label>Cooldown for every tier (s): <input type="number" min="0" step="any" data-set="cooldown" data-game="${esc(cooldown.base)}" placeholder="${cooldown.base < 0.01 ? "none" : esc(cooldown.base)}" value="${doc.cooldown === undefined ? "" : esc(doc.cooldown)}"></label></p>`
    : `<p class="family none">No cooldown: this quickhack's tiers have none to change.</p>`;
  const panels = tiers.map((t, i) => `<div class="tier" data-tier="${i}">${tierPanel(t, icons.all, { texts: false })}</div>`).join("");
  const about = doc.newHack
    ? `A new quickhack, started from the game's ${esc(fam.name)}, which it leaves as it is. Empty fields keep ${esc(fam.name)}'s value. Spread and the versions for bosses are left out for now.`
    : `A change to the game's ${esc(fam.name)}. Empty fields keep the game's value.`;
  // Until Get it (H3.6), a line for REDnode's Console, for the tier selected above.
  const getIt = doc.newHack
    ? `<section><h2>Give yourself one</h2>
<p class="foot">Crafting and vendors come later. For now, in REDnode's Console, for the tier selected above:</p>
${tiers.map((t, i) => (t.item ? `<div class="tier" data-tier="${i}"><code data-give>await game.player.addItem("${esc(newItemPath(doc, t))}")</code></div>` : "")).join("")}
</section>`
    : "";
  return `<main data-start="${start}" class="edit"${doc.newHack ? " data-new-hack" : ""}>
<header class="hack">
  ${icons.item ? `<img class="icon big" src="${esc(icons.item)}" alt="">` : img(icons.all, top.icons.item ?? top.icons.wheel, "icon big", fam.name)}
  <div><h1 data-title>${esc(doc.name || fam.name)}</h1><p class="sub">Quickhack${fam.category ? ` &middot; ${esc(fam.category)}` : ""} &middot; ${tiers.length} tier${tiers.length === 1 ? "" : "s"}</p></div>
  <p class="ro">${about} <b data-status>Each save writes the mod's files into the project.</b></p>
  <p class="actions"><button data-pack>Pack and Play</button></p>
  <ul class="warnings" data-warnings></ul>
  <ul class="notes" data-notes></ul>
</header>
<section class="cols"><div>
<h2>Texts</h2>
<dl class="texts">
<dt>Name</dt><dd><input type="text" data-set="name" data-game="${esc(top.name)}" placeholder="${esc(top.name)}" value="${esc(doc.name ?? "")}"></dd>
<dt>Description</dt><dd><textarea rows="3" data-set="description" data-game="${esc(top.description ?? "")}" placeholder="${esc(top.description ?? "")}">${esc(doc.description ?? "")}</textarea></dd>
<dt>Wheel text</dt><dd><textarea rows="2" data-set="wheelText" data-game="${esc(top.wheelDescription ?? "")}" placeholder="${esc(top.wheelDescription ?? "")}">${esc(doc.wheelText ?? "")}</textarea>
<p class="foot">The game shows this only for a hack whose Hacking tab has no effects list.</p></dd>
</dl>
</div><div>
<h2>Icons</h2>
<div class="icons">${iconChoice("item", "Item", icons.item ?? (top.icons.item && icons.all.get(`${top.icons.item.atlas}|${top.icons.item.part}`)), !!doc.itemIcon)}${iconChoice("wheel", "Wheel", icons.wheel ?? (top.icons.wheel && icons.all.get(`${top.icons.wheel.atlas}|${top.icons.wheel.part}`)), !!doc.wheelIcon)}</div>
<div class="picker" data-picker hidden><p data-picker-title></p><div class="grid" data-picker-grid></div><button data-picker-close>Close</button></div>
</div></section>
<section><h2>Numbers</h2>
${cooldownRow}
<table class="numbers"><thead><tr><th></th>${head}</tr></thead><tbody>
${rows}
</tbody></table>
<p class="foot">Each field shows the game's value until you change it. The game also scales some of these at run time, by V's perks and the target's resistance.</p>
</section>
<section><h2>Added effects</h2>
<p class="family"><button data-add-effect>Add Effect...</button></p>
<div class="effect-picker" data-effect-picker hidden>
  <nav class="tiers"><button data-effect-tab="hack">From another quickhack</button><button data-effect-tab="status">Status effects</button><button data-effect-close>Close</button></nav>
  <div data-effect-pane="hack" hidden><div class="grid families" data-effect-families></div><p class="foot" data-effect-family-title></p><div data-effect-family></div></div>
  <div data-effect-pane="status" hidden>
    <p class="filters"><input type="search" data-effect-search placeholder="Search by name, tag or type"> <select data-effect-type><option value="">Every type</option></select> <label><input type="checkbox" data-effect-all> Show all</label></p>
    <p class="foot">Shows what works on enemies, with those the game's own quickhacks and grenades use first. <b>Show all</b> adds V's own, boss fights and the rest.</p>
    <div class="effect-list" data-effect-list></div>
  </div>
</div>
<div data-effects>${renderAddedEffects(fam, added, icons.all)}</div>
<p class="foot">An added effect uses the game's record until you change a number on a tier: that tier then gets a copy of its own, which changes nothing else in the game. The cooldown, the RAM cost and the "was quickhacked" mark always stay.${doc.newHack ? "" : ` It also goes on ${esc(fam.name)}'s versions for bosses.`}</p>
</section>
${getIt}
<h2 class="game">What the game has for this tier</h2>
${panels}
</main>`;
}
