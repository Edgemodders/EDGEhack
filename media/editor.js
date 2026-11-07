// The quickhack editor's page: sends each change to the host, which edits the document, and shows what
// the host sends back. VS Code's undo works on the document, so the inputs follow the document.
(() => {
  const vscode = acquireVsCodeApi();
  const q = (s) => document.querySelector(s);
  const all = (s) => [...document.querySelectorAll(s)];
  let selected = Number(q("main")?.dataset.start ?? 0);

  function pick(i) {
    selected = i;
    for (const el of all("[data-tier]")) el.classList.toggle("on", el.dataset.tier === String(i));
    vscode.postMessage({ tier: i });
  }

  function mark(input) {
    input.classList.toggle("changed", input.value !== "" && input.value !== input.dataset.game);
  }

  function selectedKey() {
    return q(`button[data-pick="${selected}"]`)?.dataset.key;
  }

  // The picker's status effects: kept here and filtered as the modder types.
  let pool = [];
  const KINDS = { enemy: "Works on enemies", v: "V's own", boss: "Boss fights", other: "The rest" };
  const SHOWN = 300;

  function showTab(tab) {
    for (const b of all("[data-effect-tab]")) b.classList.toggle("on", b.dataset.effectTab === tab);
    for (const p of all("[data-effect-pane]")) p.hidden = p.dataset.effectPane !== tab;
  }

  function row(title, sub, data, src) {
    const b = document.createElement("button");
    b.className = "effect-row";
    Object.assign(b.dataset, data);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      b.appendChild(img);
    }
    const name = document.createElement("b");
    name.textContent = title;
    b.appendChild(name);
    const small = document.createElement("small");
    small.textContent = sub;
    b.appendChild(small);
    return b;
  }

  function drawPool() {
    const box = q("[data-effect-list]");
    box.innerHTML = "";
    const words = q("[data-effect-search]").value.toLowerCase().split(/\s+/).filter(Boolean);
    const type = q("[data-effect-type]").value;
    const showAll = q("[data-effect-all]").checked;
    const found = pool.filter((p) => {
      if (!showAll && p.kind !== "enemy") return false;
      if (type && p.type !== type) return false;
      const text = `${p.name} ${p.uiName ?? ""} ${p.type ?? ""} ${p.tags.join(" ")} ${p.path}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    let kind;
    for (const p of found.slice(0, SHOWN)) {
      if (p.kind !== kind) {
        kind = p.kind;
        const h = document.createElement("h3");
        h.textContent = KINDS[kind];
        box.appendChild(h);
      }
      // The game often names an effect after its type, or the record after both.
      const names = [...new Set([p.uiName, p.type])].filter((n) => n && n !== p.name);
      const facts = [...names, p.used ? "used by the game's quickhacks or grenades" : undefined, p.path].filter(Boolean);
      box.appendChild(row(p.name, facts.join(" \u00b7 "), { addStatus: p.path, on: p.kind === "v" ? "V" : "target" }));
    }
    if (found.length > SHOWN) {
      const more = document.createElement("p");
      more.className = "foot";
      more.textContent = `${found.length - SHOWN} more. Search to narrow them.`;
      box.appendChild(more);
    } else if (!found.length) {
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "Nothing matches.";
      box.appendChild(none);
    }
  }

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.set) {
      const text = el.type !== "number";
      vscode.postMessage({ set: { field: el.dataset.set, value: el.value === "" ? undefined : text ? el.value : Number(el.value), game: text ? el.dataset.game : Number(el.dataset.game) } });
    } else if (el.dataset.field) {
      vscode.postMessage({ setTier: { tier: el.dataset.tierKey, field: el.dataset.field, value: el.value === "" ? undefined : Number(el.value), game: Number(el.dataset.game) } });
    } else if (el.dataset.addedOn) {
      vscode.postMessage({ addedOn: { id: el.dataset.addedOn, tier: el.dataset.addedTier, on: el.checked } });
    } else if (el.dataset.addedWho) {
      vscode.postMessage({ addedWho: { id: el.dataset.addedWho, on: el.value } });
    } else if (el.dataset.added) {
      vscode.postMessage({ addedValue: { id: el.dataset.added, tier: el.dataset.addedTier, field: el.dataset.addedField, value: el.value === "" ? undefined : Number(el.value), game: Number(el.dataset.game) } });
    }
    if (el.matches("[data-effect-type], [data-effect-all]")) drawPool();
    mark(el);
  });

  document.addEventListener("input", (ev) => {
    if (ev.target.matches("[data-effect-search]")) drawPool();
  });

  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-add-effect]")) vscode.postMessage({ addEffect: true });
    if (ev.target.closest("[data-effect-close]")) q("[data-effect-picker]").hidden = true;
    const tab = ev.target.closest("[data-effect-tab]");
    if (tab) showTab(tab.dataset.effectTab);
    const fam = ev.target.closest("[data-effect-pick-family]");
    if (fam) {
      for (const b of all("[data-effect-pick-family]")) b.classList.toggle("on", b === fam);
      vscode.postMessage({ pickFamily: fam.dataset.effectPickFamily });
    }
    const from = ev.target.closest("[data-add-from]");
    if (from) {
      vscode.postMessage({ addFrom: { from: from.dataset.addFrom, effect: from.dataset.effect } });
      q("[data-effect-picker]").hidden = true;
    }
    const st = ev.target.closest("[data-add-status]");
    if (st) {
      vscode.postMessage({ addStatus: { status: st.dataset.addStatus, on: st.dataset.on } });
      q("[data-effect-picker]").hidden = true;
    }
    const gone = ev.target.closest("[data-added-remove]");
    if (gone) vscode.postMessage({ removeAdded: gone.dataset.addedRemove });
    const allTiers = ev.target.closest("[data-added-all]");
    if (allTiers) vscode.postMessage({ addedAll: { id: allTiers.dataset.addedAll, tier: selectedKey(), field: allTiers.dataset.addedField } });
    const t = ev.target.closest("[data-pick]");
    if (t) pick(Number(t.dataset.pick));
    const r = ev.target.closest("[data-record]");
    if (r) {
      ev.preventDefault();
      vscode.postMessage({ open: r.dataset.record });
    }
    const a = ev.target.closest("[data-apply-all]");
    if (a) vscode.postMessage({ applyAll: { field: a.dataset.applyAll, tier: selectedKey() } });
    const i = ev.target.closest("[data-icon]");
    if (i) vscode.postMessage({ chooseIcon: i.dataset.icon });
    const ir = ev.target.closest("[data-icon-reset]");
    if (ir) vscode.postMessage({ setIcon: { which: ir.dataset.iconReset } });
    const c = ev.target.closest("[data-choice]");
    if (c) {
      vscode.postMessage({ setIcon: { which: q("[data-picker]").dataset.which, value: c.dataset.choice } });
      q("[data-picker]").hidden = true;
    }
    if (ev.target.closest("[data-picker-close]")) q("[data-picker]").hidden = true;
    if (ev.target.closest("[data-pack]")) vscode.postMessage({ pack: true });
  });

  window.addEventListener("message", ({ data: m }) => {
    if (m.doc) {
      for (const el of all("[data-set]")) {
        if (el === document.activeElement) continue;
        const v = m.doc[el.dataset.set];
        el.value = v === undefined || v === null ? "" : String(v);
        mark(el);
      }
      for (const el of all("[data-field]")) {
        if (el === document.activeElement) continue;
        const v = m.doc.tiers?.[el.dataset.tierKey]?.[el.dataset.field];
        el.value = v === undefined || v === null ? "" : String(v);
        mark(el);
      }
      if (q("[data-title]")) q("[data-title]").textContent = m.doc.name || m.familyName;
    }
    if (typeof m.effectsHtml === "string") {
      // The card's input keeps the keyboard's place across the redraw.
      const focused = document.activeElement?.closest?.("[data-effects]") ? document.activeElement : undefined;
      const place = focused && ["added", "addedOn", "addedAll", "addedRemove", "addedWho"].map((k) => focused.dataset[k] && `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${focused.dataset[k]}"]`).find(Boolean);
      const more = focused?.dataset.addedTier ? `[data-added-tier="${focused.dataset.addedTier}"]` : "";
      const field = focused?.dataset.addedField ? `[data-added-field="${focused.dataset.addedField}"]` : "";
      q("[data-effects]").innerHTML = m.effectsHtml;
      for (const el of all("[data-added]")) mark(el);
      pick(selected);
      if (place) document.querySelector(`[data-effects] ${place}${more}${field}`)?.focus();
    }
    if (m.effectPicker) {
      pool = m.effectPicker.pool;
      const box = q("[data-effect-families]");
      box.innerHTML = "";
      for (const f of m.effectPicker.families) {
        const b = document.createElement("button");
        b.dataset.effectPickFamily = f.key;
        b.title = f.name;
        if (f.src) {
          const img = document.createElement("img");
          img.src = f.src;
          img.alt = "";
          b.appendChild(img);
        }
        const name = document.createElement("span");
        name.textContent = f.name;
        b.appendChild(name);
        box.appendChild(b);
      }
      const types = [...new Set(pool.map((p) => p.type).filter(Boolean))].sort();
      const select = q("[data-effect-type]");
      select.innerHTML = '<option value="">Every type</option>';
      for (const t of types) {
        const o = document.createElement("option");
        o.value = t;
        o.textContent = t;
        select.appendChild(o);
      }
      q("[data-effect-family]").innerHTML = "";
      q("[data-effect-family-title]").textContent = "Pick a quickhack to see its effects. An effect you add follows that quickhack's tiers.";
      q("[data-effect-picker]").hidden = false;
      showTab("hack");
      drawPool();
    }
    if (m.effectFamily) {
      q("[data-effect-family-title]").textContent = `${m.effectFamily.name}'s effects. Shown at its highest tier; each of your tiers takes the same tier of ${m.effectFamily.name}, or the nearest below.`;
      const box = q("[data-effect-family]");
      box.innerHTML = "";
      for (const e of m.effectFamily.effects) box.appendChild(row(e.name, e.summary, { addFrom: m.effectFamily.key, effect: e.key }, e.src));
      if (!m.effectFamily.effects.length) box.textContent = "It has no effects of its own to add.";
    }
    if (m.iconShown) {
      const figure = q(`[data-icon-figure="${m.iconShown.which}"]`);
      const img = figure?.querySelector("img");
      if (img && m.iconShown.src) img.src = m.iconShown.src;
      const big = q(".icon.big");
      if (m.iconShown.which === "item" && big && m.iconShown.src) big.src = m.iconShown.src;
      figure?.classList.toggle("changed", !!m.iconShown.changed);
      const reset = figure?.querySelector("[data-icon-reset]");
      if (reset) reset.hidden = !m.iconShown.changed;
    }
    if (typeof m.status === "string") {
      const s = q("[data-status]");
      s.textContent = m.status;
      s.classList.toggle("bad", !!m.bad);
    }
    for (const [field, list] of [["warnings", "[data-warnings]"], ["notes", "[data-notes]"]]) {
      if (!m[field]) continue;
      q(list).innerHTML = "";
      for (const w of m[field]) {
        const li = document.createElement("li");
        li.textContent = w;
        q(list).appendChild(li);
      }
    }
    if (m.picker) {
      const p = q("[data-picker]");
      p.dataset.which = m.picker.which;
      p.hidden = false;
      q("[data-picker-title]").textContent = m.picker.title;
      const grid = q("[data-picker-grid]");
      grid.innerHTML = "";
      for (const c of m.picker.choices) {
        const b = document.createElement("button");
        b.dataset.choice = c.value;
        b.title = c.value;
        const img = document.createElement("img");
        img.src = c.src;
        img.alt = c.label;
        b.appendChild(img);
        grid.appendChild(b);
      }
    }
  });

  for (const el of all("[data-set], [data-field], [data-added]")) mark(el);
  pick(selected);
})();
