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
    return q(`td[data-tier="${selected}"] input`)?.dataset.tierKey;
  }

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.set) {
      const text = el.type !== "number";
      vscode.postMessage({ set: { field: el.dataset.set, value: el.value === "" ? undefined : text ? el.value : Number(el.value), game: text ? el.dataset.game : Number(el.dataset.game) } });
    } else if (el.dataset.field) {
      vscode.postMessage({ setTier: { tier: el.dataset.tierKey, field: el.dataset.field, value: el.value === "" ? undefined : Number(el.value), game: Number(el.dataset.game) } });
    }
    mark(el);
  });

  document.addEventListener("click", (ev) => {
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
    if (m.warnings) {
      q("[data-warnings]").innerHTML = "";
      for (const w of m.warnings) {
        const li = document.createElement("li");
        li.textContent = w;
        q("[data-warnings]").appendChild(li);
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

  for (const el of all("[data-set], [data-field]")) mark(el);
  pick(selected);
})();
