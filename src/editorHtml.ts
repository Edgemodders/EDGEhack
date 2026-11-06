// The quickhack editor's HTML, pure (no VS Code): the document's values in inputs, the game's beside
// them, and below them the read-only panels of what the game has. Each input names what it sets; the
// page's script (media/editor.js) sends the changes to the host, which edits the document.
import type { QuickhackDoc, TierField } from "./document";
import { mainEffect, type Family, type Tier } from "./read";
import { esc, img, tierPanel } from "./pageHtml";
import { newItemPath } from "./tweaks";

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

export function renderEditor(fam: Family, doc: QuickhackDoc, icons: EditorIcons, start: number): string {
  const tiers = fam.tiers;
  const top = tiers[tiers.length - 1];
  const head = tiers.map((t, i) => `<th data-tier="${i}"><button data-pick="${i}" data-tier="${i}">${esc(t.quality ?? `Tier ${i + 1}`)}</button></th>`).join("");
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
${getIt}
<h2 class="game">What the game has for this tier</h2>
${panels}
</main>`;
}
