(function () {
  "use strict";

  // ---------- DOM helper ----------
  const $ = (id) => document.getElementById(id);

  // ---------- Helpers ----------
  function clampMin0(n) {
    return n < 0 ? 0 : n;
  }

  function toNumber(val) {
    if (val === null || val === undefined) return 0;
    const s = String(val).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function money(n) {
    const v = Number.isFinite(n) ? n : 0;
    return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function setMoneyText(el, n) {
    if (!el) return;
    el.textContent = money(n);
  }

  function setButtonBusy(button, busyText) {
    if (!button) return;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }
    button.disabled = true;
    button.classList.add("is-busy");
    button.setAttribute("aria-disabled", "true");
    button.textContent = busyText;
  }

  function clearButtonBusy(button) {
    if (!button) return;
    button.disabled = false;
    button.classList.remove("is-busy");
    button.setAttribute("aria-disabled", "false");
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }

  // ---------- Bayshore Standard: session state save/restore + dedicated same-tab print page ----------
  const BS_STATE_KEY = "bs_payrollEDSOSAMA_state_v1";
  const EDSOSAMA_PRINT_PAYLOAD_KEY = "payrollEDSOSAMA_print_payload_v1";
  const EDSOSAMA_PRINT_RETURN_KEY = "payrollEDSOSAMA_print_return_v1";
  const EDSOSAMA_PRINT_PAGE_URL = "payrollEDSOSAMA-print.html";
  const EDSOSAMA_CALCULATOR_URL = "payrollEDSOSAMA.html";
  const PRINT_BUTTON_LOCK_MS = 2500;

  function getStateIds() {
    return [
      "csulYes","csulNo","csulValue",
      "tn","ja","date","potentialStart",
      "tp","material","oe",
      "pd","day1","day2","day3","day4","day5","ah","toh",
      "totalHours","sw","wh","rd","bpp"
    ];
  }

  function saveState() {
    const ids = getStateIds();
    const state = {};
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;

      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "radio") state[id] = !!el.checked;
      else state[id] = el.value ?? "";
    });

    try { sessionStorage.setItem(BS_STATE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function restoreState() {
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(BS_STATE_KEY) || "null"); } catch (_) {}
    if (!state) return;

    Object.keys(state).forEach((id) => {
      const el = $(id);
      if (!el) return;

      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "radio") el.checked = !!state[id];
      else el.value = String(state[id] ?? "");
    });

    // Re-sync derived UI + formatting
    syncToggleStyles();

    // Re-apply standard formatting on restored values
    formatMoneyToInput(els.tp);
    formatMoneyToInput(els.material);
    formatMoneyToInput(els.oe);

    formatHoursToInput(els.pd, { min: 1, minHint: "Min 1 hr" });
    ["day1","day2","day3","day4","day5","ah","toh"].forEach((id) => {
      const el = $(id);
      if (el) formatHoursToInput(el, { min: 0, minHint: "" });
    });

    // Recompute outputs
    recalc();
  }

  function wireStateAutoSave() {
    // save on any user change (inputs + radios)
    document.addEventListener("input", (e) => {
      const t = e.target;
      if (!t) return;
      if (t.matches && t.matches("input, textarea, select")) saveState();
    }, true);

    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!t) return;
      if (t.matches && t.matches("input, textarea, select")) saveState();
    }, true);
  }

  // ---------- Bayshore Standard: inline hints ----------
  function ensureHintEl(forEl) {
    if (!forEl || !forEl.parentElement) return null;
    const parent = forEl.parentElement;
    let hint = parent.querySelector(`.field-hint[data-for="${forEl.id}"]`);
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "field-hint";
      hint.dataset.for = forEl.id;
      parent.appendChild(hint);
    }
    return hint;
  }

  function showHint(forEl, msg) {
    const hint = ensureHintEl(forEl);
    if (!hint) return;
    hint.textContent = msg || "";
    hint.classList.toggle("is-visible", !!msg);
    if (msg) forEl.classList.add("has-error");
    else forEl.classList.remove("has-error");
  }

  // ---------- Bayshore Standard: select-all (iPad/Safari reliable) ----------
  function selectAllSafe(el) {
    if (!el || el.readOnly || el.disabled) return;
    const doSelect = () => {
      try { el.focus({ preventScroll: true }); } catch (_) {}
      const v = el.value || "";
      try {
        el.select();
        try { el.setSelectionRange(0, v.length); } catch (_) {}
      } catch (_) {
        try { el.setSelectionRange(0, v.length); } catch (_) {}
      }
    };
    requestAnimationFrame(() => setTimeout(doSelect, 0));
  }

  function wireSelectAll(el) {
    if (!el) return;
    const handler = () => selectAllSafe(el);
    el.addEventListener("pointerdown", handler, { passive: true });
    el.addEventListener("touchstart", handler, { passive: true });
    el.addEventListener("focus", handler);
    el.addEventListener("click", handler);
  }

  function wireSelectAllForAllEditableInputs() {
    const inputs = Array.from(document.querySelectorAll("input, textarea")).filter((el) => {
      if (el.tagName === "TEXTAREA") return !el.readOnly && !el.disabled;
      if (el.tagName !== "INPUT") return false;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "hidden" || type === "radio" || type === "checkbox" || type === "button" || type === "submit") return false;
      return !el.readOnly && !el.disabled;
    });
    inputs.forEach(wireSelectAll);
  }

  // ---------- Bayshore Standard: Money (type normally, format on blur only) ----------
  function parseMoney(val) {
    const n = toNumber(val);
    return Number.isFinite(n) ? n : 0;
  }

  function beginEditMoney(el) {
    if (!el) return;
    const n = parseMoney(el.value);
    el.value = (Number.isFinite(n) ? n : 0).toString();
  }

  function beginEditHours(el) {
    if (!el) return;
    const n = parseHours(el.value);
    el.value = (Number.isFinite(n) ? n : 0).toString();
  }

  function formatMoneyToInput(el) {
    if (!el) return;
    const raw = String(el.value || "");
    const n = parseMoney(raw);

    if (n < 0) {
      el.value = money(0);
      showHint(el, "No negatives");
      return;
    }
    showHint(el, "");

    const finalN = raw.trim() === "" ? 0 : n;
    el.value = money(finalN);
  }

  function getMoneyDollars(el) {
    if (!el) return 0;
    const n = parseMoney(el.value);
    return n < 0 ? 0 : n;
  }

  function wireMoneyField(el, onChange) {
    if (!el) return;

    el.addEventListener("focus", () => {
      // Bayshore Standard: show raw number while editing (no $ or commas)
      beginEditMoney(el);
      // keep selection stable after value swap
      try { el.setSelectionRange(0, (el.value || "").length); } catch (_) {}
    });

    el.addEventListener("input", () => {
      const n = parseMoney(el.value);
      if (n < 0) showHint(el, "No negatives");
      else showHint(el, "");
      if (typeof onChange === "function") onChange();
    });

    el.addEventListener("blur", () => {
      formatMoneyToInput(el);
      if (typeof onChange === "function") onChange();
    });
  }

  // ---------- Bayshore Standard: Hours (snap 0.5, display “X hrs”) ----------
  function normalizeHours(n) {
    return Number.isFinite(n) ? n : 0;
  }

  function snapHalfHour(n) {
    const v = normalizeHours(n);
    return Math.round(v * 2) / 2;
  }

  function formatHoursDisplay(n) {
    const snapped = snapHalfHour(n);
    return `${snapped.toFixed(2)} hrs`;
  }

  function parseHours(val) {
    const s = String(val || "").replace(/hrs?/gi, "");
    return toNumber(s);
  }

  function formatHoursToInput(el, { min = 0, minHint = "" } = {}) {
    if (!el) return 0;
    const raw = String(el.value || "");
    const n0 = parseHours(raw);

    if (n0 < 0) {
      el.value = formatHoursDisplay(0);
      showHint(el, "No negatives");
      return 0;
    }

    let n = raw.trim() === "" ? 0 : n0;
    n = snapHalfHour(n);

    if (n < min) {
      n = min;
      if (minHint) showHint(el, minHint);
      else showHint(el, "");
    } else {
      showHint(el, "");
    }

    el.value = formatHoursDisplay(n);
    return n;
  }

  function getHours(el) {
    if (!el) return 0;
    const n = snapHalfHour(parseHours(el.value));
    return n < 0 ? 0 : n;
  }

  function wireHoursField(el, opts, onChange) {
    if (!el) return;

    el.addEventListener("focus", () => {
      // Bayshore Standard: show raw number while editing (no “hrs”)
      beginEditHours(el);
      try { el.setSelectionRange(0, (el.value || "").length); } catch (_) {}
    });

    el.addEventListener("input", () => {
      const n = parseHours(el.value);
      if (n < 0) showHint(el, "No negatives");
      else showHint(el, "");
      if (typeof onChange === "function") onChange();
    });

    el.addEventListener("blur", () => {
      formatHoursToInput(el, opts);
      if (typeof onChange === "function") onChange();
    });
  }

  // ---------- Bayshore Standard: Date (text, today autofill, “Dec 31, 2025”) ----------
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function formatDateLong(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function parseDateFlexibleEnUS(input) {
    const s = String(input || "").trim();
    if (!s) return null;

    // 1) Digits-only: MMDDYYYY (required)
    if (/^\d{8}$/.test(s)) {
      const mm = parseInt(s.slice(0, 2), 10);
      const dd = parseInt(s.slice(2, 4), 10);
      const yy = parseInt(s.slice(4, 8), 10);
      const d = new Date(yy, mm - 1, dd);
      if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
      return null;
    }

    // 2) Digits-only: MMDDYY (optional)
    if (/^\d{6}$/.test(s)) {
      const mm = parseInt(s.slice(0, 2), 10);
      const dd = parseInt(s.slice(2, 4), 10);
      let yy = parseInt(s.slice(4, 6), 10);
      yy += (yy >= 70 ? 1900 : 2000);
      const d = new Date(yy, mm - 1, dd);
      if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
      return null;
    }

    // 3) YYYY-MM-DD (explicit)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const yy = parseInt(s.slice(0, 4), 10);
      const mm = parseInt(s.slice(5, 7), 10);
      const dd = parseInt(s.slice(8, 10), 10);
      const d = new Date(yy, mm - 1, dd);
      if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
      return null;
    }

    // 4) MM/DD/YYYY or M/D/YYYY (also accept - or .)
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const mm = parseInt(m[1], 10);
      const dd = parseInt(m[2], 10);
      let yy = parseInt(m[3], 10);
      if (yy < 100) yy += 2000;
      const d = new Date(yy, mm - 1, dd);
      if (d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd) return d;
      return null;
    }

    // 5) Last resort: Date constructor
    const native = new Date(s);
    if (!isNaN(native.getTime())) return native;

    return null;
  }

  function wireDateField(el, { autofillToday = false } = {}) {
    if (!el) return;
    if (autofillToday && !String(el.value || "").trim()) {
      el.value = formatDateLong(new Date());
    }
    el.addEventListener("blur", () => {
      const raw = String(el.value || "");
      if (!raw.trim()) {
        if (autofillToday) {
          showHint(el, "");
          el.value = formatDateLong(new Date());
        } else {
          showHint(el, "");
        }
        return;
      }
      const d = parseDateFlexibleEnUS(raw);
      if (!d) {
        showHint(el, "Invalid date");
        return;
      }
      showHint(el, "");
      el.value = formatDateLong(d);
    });
  }

  // ---------- Bayshore Standard: Title Case on blur ----------
  function toTitleCase(s) {
    const str = String(s || "").trim();
    if (!str) return "";

    const lowerWords = new Set(["a","an","and","as","at","but","by","for","from","in","of","on","or","the","to","via","with"]);

    // Split by spaces but keep multiple spaces stable enough for inputs
    const parts = str.split(/\s+/);

    const titled = parts.map((word, idx) => {
      const w = word.toLowerCase();

      // Keep words with digits mostly as-is (e.g., "2B", "101-A")
      if (/[0-9]/.test(word)) {
        // still title-case letter runs around digits
        return word.replace(/[A-Za-z]+/g, (seg) => seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase());
      }

      // Keep common small words lowercase unless first word
      if (idx !== 0 && lowerWords.has(w)) return w;

      // Handle O'Neil, McDonald, hyphenated
      return w
        .split("-")
        .map((chunk) =>
          chunk
            .split("'")
            .map((c) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : ""))
            .join("'")
        )
        .join("-");
    });

    return titled.join(" ");
  }

  function wireTitleCase(el) {
    if (!el) return;
    el.addEventListener("blur", () => {
      const v = String(el.value || "");
      if (!v.trim()) return;
      el.value = toTitleCase(v);
    });
  }

  // ---------- Bayshore Standard: Tooltips (tap friendly) ----------
  const TOOLTIP_TEXT = {
    pd: "Total duration of the project in hrs.",
    labor: "Man-hours (labor time)."
  };

  function wireTooltips() {
    let open = null;

  function close() {
    if (open) {
      open.backdrop.remove();
      open.modal.remove();
      open = null;
    }
    document.body.classList.remove("bs-modal-open");
  }

    function openModal(title, text) {
      close();

      const backdrop = document.createElement("div");
      backdrop.className = "bs-tip-backdrop";

      const modal = document.createElement("div");
      modal.className = "bs-tip-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");

      const card = document.createElement("div");
      card.className = "bs-tip-card";

      const h = document.createElement("div");
      h.className = "bs-tip-title";
      h.textContent = title || "Info";

      const p = document.createElement("div");
      p.className = "bs-tip-text";
      p.textContent = text || "";

      const actions = document.createElement("div");
      actions.className = "bs-tip-actions";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-print"; // outline style, matches Gold print button
      btn.textContent = "Close";
      btn.addEventListener("click", close);

      actions.appendChild(btn);
      card.appendChild(h);
      card.appendChild(p);
      card.appendChild(actions);
      modal.appendChild(card);

      backdrop.addEventListener("click", close);
      modal.addEventListener("click", (e) => {
        // click outside card closes
        if (e.target === modal) close();
      });

      document.body.classList.add("bs-modal-open");
      document.body.appendChild(backdrop);
      document.body.appendChild(modal);

      // Esc closes
      const onKey = (e) => {
        if (e.key === "Escape") close();
      };
      document.addEventListener("keydown", onKey, { once: true });

      open = { backdrop, modal };
    }

    document.addEventListener(
      "pointerdown",
      (e) => {
        const btn = e.target.closest && e.target.closest(".tip-btn");
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const key = btn.getAttribute("data-tip");
        const text = TOOLTIP_TEXT[key] || "";
        if (!text) return;

        // Optional titles for consistency
        const title =
          key === "pd" ? "Estimated Project Duration" :
          key === "labor" ? "Estimated ManHours" :
          "Info";

        openModal(title, text);
      },
      true
    );
  }

  // ---------- Allowed technicians (ONLY these two) ----------
  const ALLOWED_TECHS = ["Brian Solis"];

  function isAllowedTechName(name) {
    return ALLOWED_TECHS.includes((name || "").trim());
  }

  function requireValidTechOrAlert() {
    const v = (els.tn && els.tn.value ? els.tn.value.trim() : "");
    if (isAllowedTechName(v)) return true;

    alert('Sales Rep Name must be exactly "Brian Solis".');
    if (els.tn) {
      els.tn.value = "";
      els.tn.focus();
    }
    return false;
  }

  // Type-ahead: as user types a prefix, auto-complete to the first match
  function wireTechNameTypeahead() {
    if (!els.tn) return;

    els.tn.addEventListener("input", () => {
      const raw = els.tn.value || "";
      const typed = raw.trim();

      if (typed.length === 0) return;

      const lower = typed.toLowerCase();
      const match = ALLOWED_TECHS.find((n) => n.toLowerCase().startsWith(lower));
      if (!match) return;

      if (match === raw) return;

      const caret = els.tn.selectionStart;
      if (caret !== raw.length) return;

      els.tn.value = match;
      try {
        els.tn.setSelectionRange(typed.length, match.length);
      } catch (_) {}
    });

    els.tn.addEventListener("blur", () => {
      const v = (els.tn.value || "").trim();
      if (v.length === 0) return;
      if (!isAllowedTechName(v)) {
        els.tn.value = "";
      }
    });
  }

  // ---------- Elements ----------
  const els = {
    csulYes: $("csulYes"),
    csulNo: $("csulNo"),
    csulValue: $("csulValue"),

    tn: $("tn"),
    ja: $("ja"),
    date: $("date"),
    potentialStart: $("potentialStart"),

    tp: $("tp"),
    material: $("material"),
    oe: $("oe"),

    pd: $("pd"),
    day1: $("day1"),
    day2: $("day2"),
    day3: $("day3"),
    day4: $("day4"),
    day5: $("day5"),
    ah: $("ah"),
    toh: $("toh"),
    totalHours: $("totalHours"),

    sw: $("sw"),
    wh: $("wh"),
    rd: $("rd"),
    bpp: $("bpp"),

    totalCommission: $("totalCommission"),

        calculateBtn: $("calculateBtn"),
        printButton: $("printButton"),

    // Bayshore Standard print container (same-tab)
    printSheet: $("printSheet"),
  };

  // ---------- CSUL toggle ----------
  function isCSULSelected() {
    return !!(els.csulYes && els.csulYes.checked);
  }

  // HOURLY-style: JS only syncs hidden value (CSS handles visuals)
  function syncToggleStyles() {
    const yes = isCSULSelected();
    if (els.csulValue) els.csulValue.value = yes ? "yes" : "no";
  }

  function wireToggle() {
    if (els.csulYes) {
      els.csulYes.addEventListener("change", () => {
        syncToggleStyles();
        recalc();
      });
    }
    if (els.csulNo) {
      els.csulNo.addEventListener("change", () => {
        syncToggleStyles();
        recalc();
      });
    }
  }

  // ---------- Project Duration (HOURLY rule): min 1 hr ----------
  function normalizePD(raw) {
    let v = snapHalfHour(clampMin0(toNumber(raw)));
    if (v < 1) v = 1;
    return v;
  }

  function wirePD() {
    if (!els.pd) return;
    wireHoursField(els.pd, { min: 1, minHint: "Min 1 hr" }, recalc);

    if (!String(els.pd.value || "").trim()) els.pd.value = "1";
    formatHoursToInput(els.pd, { min: 1, minHint: "" });
  }

  // ---------- Total Hours ----------
  function calcTotalHours() {
    const day1 = getHours(els.day1);
    const day2 = getHours(els.day2);
    const day3 = getHours(els.day3);
    const day4 = getHours(els.day4);
    const day5 = getHours(els.day5);
    const ah = getHours(els.ah);
    const toh = getHours(els.toh);

    // keep existing OT logic (1.5x)
    const totalRaw = clampMin0(day1 + day2 + day3 + day4 + day5 + ah + 1.5 * toh);

    // Bayshore Standard: totals display in 0.5 increments
    const total = snapHalfHour(totalRaw);

    if (els.totalHours) els.totalHours.value = formatHoursDisplay(total);
    return total;
  }

  // ---------- BP% message ----------
  function bppMessage(pct) {
    if (pct < 10) return "👎: JOB BUST. PLEASE SEE GM";
    if (pct <= 19.99) return "😬: MARGINAL PROFIT";
    if (pct <= 29.99) return "👍: GOOD WORK";
    if (pct <= 39.99) return "😀: NICE WORK";
    if (pct <= 59.99) return "⭐: GREAT WORK";
    return "🌟: EXCELLENT WORK";
  }

  function formatBppValue(pct) {
  const p = Number.isFinite(pct) ? pct : 0;
  return `${p.toFixed(2)}% ${bppMessage(p)}`;
}

  // ---------- Main calculation (EDSO LOGIC KEPT) ----------
  function recalc() {
    const tp = getMoneyDollars(els.tp);
    const material = getMoneyDollars(els.material);
    const oe = getMoneyDollars(els.oe);

    const pd = normalizePD(els.pd ? els.pd.value : 0);
    const totalHours = calcTotalHours();

    const overheads = pd * 290;

    // EDSO rule: 12% if CSUL YES, else 10%
    const commissionRate = isCSULSelected() ? 0.12 : 0.10;
    const salesCommission = tp * commissionRate;

    const grossAmount = tp - material * 1.2 - totalHours * 95 - oe;
    const finalProfit = grossAmount - overheads - salesCommission;
    const pct = tp !== 0 ? (finalProfit / tp) * 100 : 0;

    if (els.bpp) els.bpp.value = formatBppValue(pct);

    const swPct = tp !== 0 ? ((material * 1.2) / tp) * 100 : 0;
    if (els.sw) els.sw.value = swPct.toFixed(2);
    if (els.wh) els.wh.value = swPct.toFixed(2);
    if (els.rd) els.rd.value = swPct.toFixed(2);

    setMoneyText(els.totalCommission, salesCommission);
    syncCalculatorPrintSheet();
  }

    // =========================================================
  // PRINTING (Bayshore Standard — SAME TAB)
  // - Build print-only HTML into #printSheet
  // - body.is-printing gates payrollprint.css to show only #printSheet
  // - A4 one-page fit via body class-only scale steps
  // - Restore via afterprint + matchMedia fallback + 20s last resort
  // =========================================================

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildPrintSheetHTML() {
    const logoSrc = "BP.png";

    const salesRepName = escHtml((els.tn && els.tn.value) || "");
    const jobAddress = escHtml((els.ja && els.ja.value) || "");
    const date = escHtml((els.date && els.date.value) || "");
    const potentialStart = escHtml((els.potentialStart && els.potentialStart.value) || "");

    const projectHours = formatHoursDisplay(normalizePD(els.pd ? els.pd.value : 0));
    const materialExpenses = money(getMoneyDollars(els.material));
    const otherExpenses = money(getMoneyDollars(els.oe));
    const totalPrice = money(getMoneyDollars(els.tp));

    const day1 = escHtml((els.day1 && els.day1.value) || "0");
    const day2 = escHtml((els.day2 && els.day2.value) || "0");
    const day3 = escHtml((els.day3 && els.day3.value) || "0");
    const day4 = escHtml((els.day4 && els.day4.value) || "0");
    const day5 = escHtml((els.day5 && els.day5.value) || "0");
    const additionalHours = escHtml((els.ah && els.ah.value) || "0");
    const overtimeHours = escHtml((els.toh && els.toh.value) || "0");
    const totalHours = escHtml((els.totalHours && els.totalHours.value) || "0");

    const sw = escHtml((els.sw && els.sw.value) || "0.00");
    const wh = escHtml((els.wh && els.wh.value) || "0.00");
    const rd = escHtml((els.rd && els.rd.value) || "0.00");
    const bpp = escHtml((els.bpp && els.bpp.value) || "");

    const csulText = isCSULSelected() ? "YES (12%)" : "NO (10%)";
    const salesCommission = money(getMoneyDollars(els.tp) * (isCSULSelected() ? 0.12 : 0.10));

    // No inline styles; rely on payrollprint.css classes
    return `
      <div id="printRoot">
        <div class="print-header">
          <img src="${logoSrc}" alt="BP logo" class="logo">
          <h2>SALES COMMISSION DOCUMENT</h2>
        </div>

        <div class="print-body">
          <div class="no-break details-section">
            <h3>DETAILS:</h3>
            <table class="input-data">
              <tr><th>Sales Rep Name:</th><td>${salesRepName}</td></tr>
              <tr><th>Job Address:</th><td>${jobAddress}</td></tr>
              <tr><th>Date:</th><td>${date}</td></tr>
              <tr><th>Potential Start Date:</th><td>${potentialStart}</td></tr>
              <tr><th>Estimated Project Duration:</th><td>${projectHours}</td></tr>
              <tr><th>Estimated Material Expenses:</th><td>${materialExpenses}</td></tr>
              <tr><th>Estimated Other Expenses:</th><td>${otherExpenses}</td></tr>
              <tr><th>Estimated Total Price:</th><td>${totalPrice}</td></tr>
            </table>
          </div>

          <div class="no-break">
            <h3>ESTIMATED LABOR DETAILS:</h3>
            <table class="input-data">
              <tr><th>Day 1</th><th>Day 2</th><th>Day 3</th><th>Day 4</th></tr>
              <tr><td>${day1}</td><td>${day2}</td><td>${day3}</td><td>${day4}</td></tr>
            </table>

            <table class="input-data">
              <tr><th>Day 5</th><th>Additional Hours</th><th>Total Overtime Hours</th><th>Total Hours</th></tr>
              <tr><td>${day5}</td><td>${additionalHours}</td><td>${overtimeHours}</td><td>${totalHours}</td></tr>
            </table>
          </div>

          <div class="no-break">
            <h3>FOR OFFICE USE ONLY:</h3>
            <table class="input-data">
              <tr><th>SW21/RP21</th><th>WH32</th><th>RD15/UL15</th><th>BPP%</th></tr>
              <tr><td>${sw}</td><td>${wh}</td><td>${rd}</td><td>${bpp}</td></tr>
            </table>
          </div>

          <div class="no-break commission-details-section">
            <h3>COMMISSION DETAILS:</h3>
            <table class="input-data">
              <tr><th>S/W/G/CS Selection:</th><td>${csulText}</td></tr>
              <tr><th>Sales Commission:</th><td>${salesCommission}</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function syncCalculatorPrintSheet() {
    if (!els.printSheet) return;
    els.printSheet.innerHTML = buildPrintSheetHTML();
    els.printSheet.setAttribute("aria-hidden", "false");
  }

  function launchDedicatedPrintPage() {
    if (!els.printSheet) return;

    recalc();
    saveState();

    sessionStorage.setItem(EDSOSAMA_PRINT_PAYLOAD_KEY, els.printSheet.innerHTML);
    sessionStorage.setItem(EDSOSAMA_PRINT_RETURN_KEY, EDSOSAMA_CALCULATOR_URL);

    setTimeout(() => {
      window.location.href = EDSOSAMA_PRINT_PAGE_URL;
    }, 120);
  }

  // ---------- Wiring ----------
  function wireActionButtons() {
    if (els.calculateBtn) {
      els.calculateBtn.addEventListener("click", () => {
        if (!requireValidTechOrAlert()) return;
        if (els.calculateBtn.disabled) return;

        setButtonBusy(els.calculateBtn, "Calculating...");
        recalc();
        saveState();

        setTimeout(() => clearButtonBusy(els.calculateBtn), 400);
      });
    }

    if (els.printButton) {
      els.printButton.addEventListener("click", () => {
        if (!requireValidTechOrAlert()) return;
        if (els.printButton.disabled) return;

        setButtonBusy(els.printButton, "Preparing Print Page...");
        launchDedicatedPrintPage();

        setTimeout(() => clearButtonBusy(els.printButton), PRINT_BUTTON_LOCK_MS);
      });
    }
  }

  // ---------- Init ----------
  function initDefaults() {
    if (els.tn) {
      // Gold Template: NEVER overwrite restored state
      els.tn.readOnly = false;
      // Only set a default if empty (keeps restore intact)
      if (!String(els.tn.value || "").trim()) els.tn.value = "";
    }

    // Bayshore Standard wiring (match HOURLY)
    wireSelectAllForAllEditableInputs();
    wireTooltips();
    wireTitleCase(els.tn);
    wireTitleCase(els.ja);
    wireDateField(els.date, { autofillToday: true });
    wireDateField(els.potentialStart, { autofillToday: false });

    // Money wiring + initialize display (match HOURLY)
    wireMoneyField(els.tp, recalc);
    wireMoneyField(els.material, recalc);
    wireMoneyField(els.oe, recalc);

    if (els.tp && !String(els.tp.value || "").trim()) els.tp.value = "$0.00";
    if (els.material && !String(els.material.value || "").trim()) els.material.value = "$0.00";
    if (els.oe && !String(els.oe.value || "").trim()) els.oe.value = "$0.00";

    // Hours wiring + initialize display (match HOURLY)
    if (els.pd && !String(els.pd.value || "").trim()) els.pd.value = "1";
    wirePD();

    ["day1", "day2", "day3", "day4", "day5", "ah", "toh"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      wireHoursField(el, { min: 0, minHint: "" }, recalc);
      if (!String(el.value || "").trim()) el.value = "0";
      formatHoursToInput(el, { min: 0, minHint: "" });
    });

    if (els.totalHours && !String(els.totalHours.value || "").trim()) {
      els.totalHours.value = formatHoursDisplay(0);
    }

    // Office-use defaults (restore-safe)
    if (els.sw && !String(els.sw.value || "").trim()) els.sw.value = "0.00";
    if (els.wh && !String(els.wh.value || "").trim()) els.wh.value = "0.00";
    if (els.rd && !String(els.rd.value || "").trim()) els.rd.value = "0.00";
    if (els.bpp && !String(els.bpp.value || "").trim()) els.bpp.value = "0.00% 👎: JOB BUST. PLEASE SEE GM";

    syncToggleStyles();
    wireTechNameTypeahead();

    // Start autosave for all fields (required)
    wireStateAutoSave();

    // Ensure state is saved at least once on boot
    saveState();

    window.addEventListener("beforeprint", () => {
      recalc();
      syncCalculatorPrintSheet();
      document.body.classList.add("is-printing");
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("is-printing");
    });
  }

  // Restore prior session (required) before applying defaults
  restoreState();

  // boot
  initDefaults();
  wireToggle();
  wireActionButtons();

  recalc();
})();
