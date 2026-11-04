// The quickhack page's HTML, pure (no VS Code), so it can be checked outside the editor: the
// family in the modder's words, the numbers per tier, and one panel per tier.
import { mainEffect as mainOf } from "./read";
import type { Effect, Family, IconRef, Tier, Value } from "./read";

export const esc = (s: string | number | undefined): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function num(n: number): string {
  if (!isFinite(n)) return "until removed";
  return String(Math.round(n * 1000) / 1000);
}

/** A value with its unit, and what scales it as a tooltip. */
function value(v: Value | undefined, unit = ""): string {
  if (!v) return `<span class="none">none</span>`;
  const shown = isFinite(v.base) && unit ? `${num(v.base)} ${unit}` : num(v.base);
  return v.scaledBy.length ? `<span class="scaled" title="${esc(`Scaled in the game by ${v.scaledBy.join(", ")}`)}">${esc(shown)}<sup>*</sup></span>` : esc(shown);
}

function cooldown(t: Tier): string {
  if (!t.cooldown) return `<span class="none">none</span>`;
  if (t.cooldown.base < 0.01) return `<span class="none" title="${esc(`${t.cooldown.record}: ${t.cooldown.base} s`)}">none</span>`;
  return value(t.cooldown, "s");
}

/** The main effect: the first one on the target that is the quickhack's own. */
function mainEffect(t: Tier): Effect | undefined {
  return mainOf(t.effects);
}

/** Damage as the game's tooltip gives it, a second, with the tick beside it; or one hit. */
function dps(d: Effect["damage"][number]): string {
  const type = esc(d.type.toLowerCase());
  if (!d.every) return `${esc(num(d.perHit))} ${type}`;
  return `${esc(Math.ceil(d.perHit / d.every))} ${type} a second <span class="none">(${esc(num(d.perHit))} every ${esc(num(d.every))} s)</span>`;
}

function damage(e: Effect | undefined): string {
  if (!e?.damage.length) return `<span class="none">none</span>`;
  return e.damage.map(dps).join("<br>");
}

export function iconsOf(fam: Family): IconRef[] {
  const out: IconRef[] = [];
  for (const t of fam.tiers) {
    if (t.icons.item) out.push(t.icons.item);
    if (t.icons.wheel) out.push(t.icons.wheel);
    for (const e of t.effects) if (e.icon) out.push(e.icon);
  }
  return out;
}

export function img(icons: Map<string, string>, icon: IconRef | undefined, cls: string, alt: string): string {
  const src = icon && icons.get(`${icon.atlas}|${icon.part}`);
  return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" title="${esc(`${icon!.record}: ${icon!.part}`)}">` : `<span class="${cls} blank" title="no icon"></span>`;
}

function rec(path: string | undefined, label?: string): string {
  return path ? `<a href="#" class="rec" data-record="${esc(path)}" title="Open in REDcode">${esc(label ?? path)}</a>` : "";
}

export function render(fam: Family, start: number, icons: Map<string, string>): string {
  const top = fam.tiers[fam.tiers.length - 1];
  const tiers = fam.tiers;
  const kind = fam.kind === "people" ? "Quickhack" : fam.kind === "device" ? "Device hack" : "Vehicle hack";
  const tabs =
    tiers.length > 1
      ? `<nav class="tiers">${tiers.map((t, i) => `<button data-pick="${i}" data-tier="${i}">${esc(t.quality ?? `Tier ${i + 1}`)}</button>`).join("")}</nav>`
      : `<span data-pick="0" hidden></span>`;
  const head = tiers.map((t, i) => `<th data-tier="${i}">${esc(t.quality ?? `Tier ${i + 1}`)}</th>`).join("");
  const row = (label: string, cell: (t: Tier) => string, hint?: string) =>
    `<tr><th scope="row"${hint ? ` title="${esc(hint)}"` : ""}>${esc(label)}</th>${tiers.map((t, i) => `<td data-tier="${i}">${cell(t)}</td>`).join("")}</tr>`;
  const numbers = `<section><h2>Numbers</h2><table class="numbers"><thead><tr><th></th>${head}</tr></thead><tbody>
${row("RAM", (t) => value(t.ram), "Memory the upload costs")}
${row("Upload", (t) => value(t.upload, "s"), "Upload time")}
${row("Cooldown", cooldown)}
${row("Duration", (t) => value(mainEffect(t)?.duration, "s"), "How long its main effect lasts on the target")}
${row("Stacks", (t) => esc(mainEffect(t)?.stacks ?? "") || `<span class="none">none</span>`)}
${row("Damage", (t) => damage(mainEffect(t)))}
${tiers.some((t) => t.boss) ? row("Against bosses", (t) => (t.boss ? `${value(t.boss.ram)} RAM, ${value(t.boss.upload, "s")}` : `<span class="none">same</span>`), "The Boss action: its RAM and upload") : ""}
</tbody></table><p class="foot"><sup>*</sup> The game scales this number at run time; point at it to see by what.</p></section>`;
  const panels = tiers.map((t, i) => `<div class="tier" data-tier="${i}">${tierPanel(t, icons)}</div>`).join("");
  return `<main data-start="${start}">
<header class="hack">
  ${img(icons, top.icons.item ?? top.icons.wheel, "icon big", fam.name)}
  <div><h1>${esc(fam.name)}</h1><p class="sub">${esc(kind)}${fam.category && fam.category.toLowerCase() !== kind.toLowerCase() ? ` &middot; ${esc(fam.category)}` : ""} &middot; ${tiers.length} tier${tiers.length === 1 ? "" : "s"}</p></div>
  <p class="ro">The game's own quickhack.${fam.kind === "people" ? ` <button data-edit>Edit...</button>` : " Device and vehicle hacks are read-only for now."}</p>
</header>
${tabs}
${numbers}
${panels}
</main>`;
}

export function tierPanel(t: Tier, icons: Map<string, string>, options: { texts?: boolean } = {}): string {
  // The spread's own effectors (Spread Init, Spread) are plumbing: the Spread section says it.
  const own = t.effects.filter((e) => !e.shared && !e.cooldown && !(e.spread && !e.status && !e.damage.length));
  const shared = t.effects.filter((e) => e.shared);
  const texts = `<section><h2>Texts</h2><dl>
<dt>Name</dt><dd>${esc(t.name)}</dd>
${t.description ? `<dt>Description</dt><dd>${esc(t.description)}</dd>` : ""}
${t.wheelName && t.wheelName !== t.name ? `<dt>On the wheel</dt><dd>${esc(t.wheelName)}</dd>` : ""}
${t.wheelDescription ? `<dt>Wheel text</dt><dd>${esc(t.wheelDescription)}</dd>` : ""}
${t.tooltip.length ? `<dt>Tooltip</dt><dd>${t.tooltip.map((l) => `<p>${esc(l)}</p>`).join("")}</dd>` : ""}
</dl></section>`;
  const iconSection = `<section><h2>Icons</h2><div class="icons">
${t.item ? `<figure>${img(icons, t.icons.item, "icon", "Item icon")}<figcaption>Item${t.icons.item ? `<br><small>${esc(t.icons.item.part)}</small>` : ""}</figcaption></figure>` : ""}
<figure>${img(icons, t.icons.wheel, "icon", "Wheel icon")}<figcaption>Wheel${t.icons.wheel ? `<br><small>${esc(t.icons.wheel.part)}</small>` : ""}</figcaption></figure>
${own.filter((e) => e.icon).map((e) => `<figure>${img(icons, e.icon, "icon", e.name)}<figcaption>${esc(e.name)}<br><small>on the target's status bar</small></figcaption></figure>`).join("")}
</div></section>`;
  const effects = `<section><h2>Effects</h2>${own.length ? own.map((e) => effectCard(e, icons)).join("") : `<p class="none">No effects of its own.</p>`}
${shared.length ? `<details><summary>Every quickhack also (${shared.length})</summary>${shared.map((e) => effectCard(e, icons)).join("")}</details>` : ""}</section>`;
  const worksOn = `<section><h2>Works on</h2>${t.notWhen.length ? `<p>Cannot be used when:</p><ul>${t.notWhen.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : `<p class="none">No conditions on the target.</p>`}
${t.boss || t.chimera ? `<p>Against bosses it uses ${[rec(t.boss?.record, "its Boss action"), rec(t.chimera?.record, "its Chimera action")].filter(Boolean).join(" and ")}.</p>` : ""}</section>`;
  const spread = `<section><h2>Spread</h2><p>${t.spread ? "Spreads to nearby enemies (with the perk that allows it)." : `<span class="none">Does not spread.</span>`}</p></section>`;
  const passives = `<section><h2>While equipped</h2>${
    t.passives.length
      ? `<ul>${t.passives.map((p) => `<li>${rec(p.record, p.name)}${p.effectors.length ? `: ${esc(p.effectors.join(", "))}` : ""}${p.stats.length ? ` (${p.stats.map((s) => `${esc(s.stat)} ${esc(num(s.value))}`).join(", ")})` : ""}</li>`).join("")}</ul>`
      : `<p class="none">Nothing while it sits in the cyberdeck.</p>`
  }</section>`;
  const getIt = `<section><h2>Get it</h2>${
    t.recipe
      ? `<p>Crafting spec ${rec(t.recipe.record)}${t.recipe.components.length ? `: ${t.recipe.components.map((c) => `${esc(c.amount)} ${esc(c.name)}`).join(", ")}` : ""}.</p>`
      : `<p class="none">${t.item ? "No crafting spec." : "Comes with the cyberdeck: device and vehicle hacks have no item."}</p>`
  }</section>`;
  const advanced = `<section><details><summary>Advanced: ${t.records.length} records behind this tier</summary><ul class="records">${t.records
    .slice()
    .sort()
    .map((p) => `<li>${rec(p)}</li>`)
    .join("")}</ul></details></section>`;
  // A device or vehicle hack has no item: nothing sits in the cyberdeck for it.
  return `<div class="cols"><div>${options.texts === false ? "" : texts}${options.texts === false ? "" : iconSection}${worksOn}${spread}</div><div>${effects}${t.item ? passives : ""}${getIt}</div></div>${advanced}`;
}

function effectCard(e: Effect, icons: Map<string, string>): string {
  const facts: string[] = [];
  facts.push(e.on === "V" ? "on V" : "on the target");
  facts.push(e.when === "start" ? "as the upload starts" : "when the upload completes");
  if (e.type) facts.push(e.type);
  if (e.duration) facts.push(`lasts ${value(e.duration, "s")}`);
  if (e.stacks && e.stacks > 1) facts.push(`stacks ${esc(e.stacks)}`);
  const lines: string[] = [];
  for (const d of e.damage) lines.push(`${dps(d)} damage`);
  for (const s of e.stats) lines.push(`${esc(s.stat)} ${s.value >= 0 ? "+" : ""}${esc(num(s.value))}${s.how !== "Additive" ? ` (${esc(s.how)})` : ""}`);
  if (e.spread) lines.push("starts the spread to nearby enemies");
  return `<div class="effect">${img(icons, e.icon, "icon small", e.name)}<div>
<b>${esc(e.name)}</b> ${rec(e.status ?? e.record, "record")}
<p class="facts">${facts.join(" &middot; ")}</p>
${lines.length ? `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}
${e.tags.length ? `<p class="tags">${e.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
</div></div>`;
}
