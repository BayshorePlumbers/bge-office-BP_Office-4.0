const HTECHSAMA_STATE_KEY = "bs_htechSAMA_state_v1";
const HTECHSAMA_PRINT_PAYLOAD_KEY = "htechSAMA_print_payload_v1";
const HTECHSAMA_PRINT_RETURN_KEY = "htechSAMA_print_return_v1";
const HTECHSAMA_PRINT_PAGE_URL = "htechSAMA-print.html";
const HTECHSAMA_CALCULATOR_URL = "htechSAMA.html";
const PRINT_BUTTON_LOCK_MS = 2500;

(function () {
  if (window.__htechSAMA_initialized) return;
  window.__htechSAMA_initialized = true;

  const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const longDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

  const TECH_RATES = {
    "Aimel Mohammadi": 26,
    "Alberto Lopez": 31,
    "Glenn Harper": 45,
    "Jose Rodriguez (Chepe)": 31,
    "Kevin Perez": 31,
    "Ryan Felt": 52,
    "Ryan/Aimel": 67,
  };

  let baseOtherExpense = null;
  let saveTimer = null;
  let isSyncingCalculatorPrintSheet = false;

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

  function showEl(el) { if (el) el.classList.remove("is-hidden"); }
  function hideEl(el) { if (el) el.classList.add("is-hidden"); }

  function populateTechnicians(selectEl) {
    if (!selectEl) return;
    while (selectEl.options.length > 1) selectEl.remove(1);
    Object.keys(TECH_RATES).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }

  function ensureHintEl(input) {
    if (!input || !input.parentElement) return null;
    let hint = input.parentElement.querySelector(`.field-hint[data-for="${input.id}"]`);
    if (hint) return hint;

    hint = document.createElement("div");
    hint.className = "field-hint";
    hint.dataset.for = input.id || "";
    hint.textContent = "";
    input.insertAdjacentElement("afterend", hint);
    return hint;
  }

  function showHint(input, msg) {
    const hint = ensureHintEl(input);
    if (!hint) return;
    hint.textContent = msg || "";
    hint.classList.add("is-visible");
    input.classList.add("has-error");
    const fg = input.closest?.(".form-group");
    if (fg) fg.classList.add("has-error");
  }

  function clearHint(input) {
    const hint = ensureHintEl(input);
    if (!hint) return;
    hint.textContent = "";
    hint.classList.remove("is-visible");
    input.classList.remove("has-error");
    const fg = input.closest?.(".form-group");
    if (fg) fg.classList.remove("has-error");
  }

  function selectAllOnEdit(el) {
    if (!el) return;
    if (el.hasAttribute("readonly") || el.disabled) return;
    if (el.dataset.autoSelectAttached === "1") return;
    el.dataset.autoSelectAttached = "1";

    const selectNow = () => {
      try {
        const len = (el.value || "").length;
        el.setSelectionRange(0, len);
      } catch (_) {
        try { el.select(); } catch (_) {}
      }
    };

    const selectSoon = () => {
      requestAnimationFrame(() => {
        try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (_) {} }
        selectNow();
        setTimeout(selectNow, 0);
      });
    };

    el.addEventListener("pointerdown", selectSoon);
    el.addEventListener("pointerup", selectSoon);
    el.addEventListener("touchstart", selectSoon, { passive: true });
    el.addEventListener("click", selectSoon);
    el.addEventListener("focus", selectSoon);
  }

  function attachAutoSelectToAllEditables() {
    document.querySelectorAll("input, textarea, select").forEach(el => {
      if (el.hasAttribute("readonly") || el.disabled) return;
      if (el.tagName === "INPUT" && el.type === "hidden") return;
      selectAllOnEdit(el);
    });
  }

  function parseMoneyToNumber(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(n) {
    const x = Number(n || 0);
    return moneyFormatter.format(Number.isFinite(x) ? x : 0);
  }

  function wireMoneyInput(input) {
    if (!input) return;

    selectAllOnEdit(input);

    input.addEventListener("focus", () => {
      const n = parseMoneyToNumber(input.value);
      input.value = String(Number.isFinite(n) ? n : 0);
      try { input.setSelectionRange(0, (input.value || "").length); } catch (_) {}
    });

    input.addEventListener("input", () => {
      const n = parseMoneyToNumber(input.value);
      if (String(input.value).includes("-") || n < 0) showHint(input, "No negatives");
      else clearHint(input);
    });

    input.addEventListener("blur", () => {
      const n = parseMoneyToNumber(input.value);
      if (String(input.value).includes("-") || n < 0) {
        input.value = formatMoney(0);
        showHint(input, "No negatives");
      } else {
        input.value = formatMoney(n);
        clearHint(input);
      }
    });
  }

  function parseHoursToNumber(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function snapHalfHour(n) {
    return Math.round(n * 2) / 2;
  }

  function formatHours(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x) || x <= 0) return "0.00 hrs";
    return `${snapHalfHour(x).toFixed(2)} hrs`;
  }

  function wireHoursInput(input, { isPD = false } = {}) {
    if (!input) return;

    selectAllOnEdit(input);

    input.addEventListener("focus", () => {
      const n = parseHoursToNumber(input.value);
      input.value = String(Number.isFinite(n) ? n : 0);
      try { input.setSelectionRange(0, (input.value || "").length); } catch (_) {}
    });

    input.addEventListener("input", () => {
      const n = parseHoursToNumber(input.value);
      if (String(input.value).includes("-") || n < 0) {
        showHint(input, "No negatives");
        return;
      }
      if (isPD && n > 0 && n < 1) {
        showHint(input, "Min 1 hr");
        return;
      }
      clearHint(input);
    });

    input.addEventListener("blur", () => {
      let n = parseHoursToNumber(input.value);

      if (String(input.value).includes("-") || n < 0) {
        input.value = formatHours(0);
        showHint(input, "No negatives");
        return;
      }

      n = snapHalfHour(n);

      if (isPD) {
        if (n < 1) {
          n = 1;
          showHint(input, "Min 1 hr");
        } else {
          clearHint(input);
        }
      } else {
        clearHint(input);
      }

      input.value = formatHours(n);
    });
  }

  function todayLocalDate() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseFlexibleDateEnUS(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return null;

    if (/^\d{8}$/.test(s)) {
      const mm = Number(s.slice(0, 2));
      const dd = Number(s.slice(2, 4));
      const yy = Number(s.slice(4, 8));
      const dt = new Date(yy, mm - 1, dd);
      if (dt && dt.getFullYear() === yy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) return dt;
      return null;
    }

    if (/^\d{6}$/.test(s)) {
      const mm = Number(s.slice(0, 2));
      const dd = Number(s.slice(2, 4));
      let yy = Number(s.slice(4, 6));
      yy = yy >= 70 ? (1900 + yy) : (2000 + yy);
      const dt = new Date(yy, mm - 1, dd);
      if (dt && dt.getFullYear() === yy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) return dt;
      return null;
    }

    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const y = Number(iso[1]);
      const m = Number(iso[2]);
      const d = Number(iso[3]);
      const dt = new Date(y, m - 1, d);
      if (dt && dt.getFullYear() === y && dt.getMonth() === (m - 1) && dt.getDate() === d) return dt;
      return null;
    }

    const us = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (us) {
      const mm = Number(us[1]);
      const dd = Number(us[2]);
      let yy = Number(us[3]);
      if (us[3].length === 2) yy = yy >= 70 ? 1900 + yy : 2000 + yy;
      const dt = new Date(yy, mm - 1, dd);
      if (dt && dt.getFullYear() === yy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) return dt;
      return null;
    }

    const fallback = new Date(s);
    if (!isNaN(fallback.getTime())) return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
    return null;
  }

  function wireDateInput(input, { autofillToday = false } = {}) {
    if (!input) return;

    selectAllOnEdit(input);

    if (autofillToday && !String(input.value || "").trim()) {
      input.value = longDateFormatter.format(todayLocalDate());
    }

    input.addEventListener("blur", () => {
      const dt = parseFlexibleDateEnUS(input.value);
      if (!dt) {
        showHint(input, "Invalid date");
        return;
      }
      clearHint(input);
      input.value = longDateFormatter.format(dt);
    });
  }

  function titleCase(str) {
    const s = String(str ?? "").trim();
    if (!s) return "";
    return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }

  function wireTitleCase(input) {
    if (!input) return;
    selectAllOnEdit(input);
    input.addEventListener("blur", () => { input.value = titleCase(input.value); });
  }

  function openTipModal(title, text) {
    const backdrop = document.createElement("div");
    backdrop.className = "bs-tip-backdrop";

    const modal = document.createElement("div");
    modal.className = "bs-tip-modal";

    const card = document.createElement("div");
    card.className = "bs-tip-card";

    const h = document.createElement("div");
    h.className = "bs-tip-title";
    h.textContent = title;

    const p = document.createElement("div");
    p.className = "bs-tip-text";
    p.textContent = text;

    const actions = document.createElement("div");
    actions.className = "bs-tip-actions";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-primary";
    closeBtn.textContent = "Close";

    actions.appendChild(closeBtn);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(actions);
    modal.appendChild(card);

    function close() {
      document.body.classList.remove("bs-modal-open", "is-tip-open");
      try { backdrop.remove(); } catch (_) {}
      try { modal.remove(); } catch (_) {}
    }

    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    document.body.classList.add("bs-modal-open", "is-tip-open");
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

  const TIP_TEXT = {
    pd: { title: "Project Duration (PD)", text: "Enter the total project duration in hours (minimum 1 hour)." },
    labor: { title: "Total Hours", text: "Total Hours = Day1–Day5 + Additional + (1.5 × Overtime)." }
  };

  document.querySelectorAll(".tip-btn[data-tip]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-tip");
      const cfg = TIP_TEXT[key];
      if (!cfg) return;
      openTipModal(cfg.title, cfg.text);
    });
  });

  const jobTypeSelect = document.getElementById("jobType");
  const gniContainer = document.getElementById("gniContainer");
  const gniCheckbox = document.getElementById("gni");
  const swgcsContainer = document.getElementById("swgcsContainer");
  const swgcsHidden = document.getElementById("swgcs");
  const swgcsYesBtn = document.getElementById("swgcsYes");
  const swgcsNoBtn = document.getElementById("swgcsNo");
  const technicianSelect = document.getElementById("technicianSelect");
  const totalPriceInput = document.getElementById("tp");
  const dateInput = document.getElementById("date");
  const jobAddressInput = document.getElementById("ja");
  const projectDurationInput = document.getElementById("pd");
  const materialExpensesInput = document.getElementById("material");
  const otherExpensesInput = document.getElementById("oe");
  const ccFeeDisplay = document.getElementById("ccFeeDisplay");
  const oeTotalDisplay = document.getElementById("oeTotalDisplay");
  const totalHoursInput = document.getElementById("totalHours");
  const paymentReceivedHidden = document.getElementById("paymentReceived");
  const payRecYesBtn = document.getElementById("payRecYes");
  const payRecNoBtn = document.getElementById("payRecNo");
  const paymentMethodRow = document.getElementById("paymentMethodRow");
  const paymentMethodHidden = document.getElementById("paymentMethod");
  const payMethodCashBtn = document.getElementById("payMethodCash");
  const payMethodCheckBtn = document.getElementById("payMethodCheck");
  const payMethodCardBtn = document.getElementById("payMethodCard");
  const payMethodAccountsBtn = document.getElementById("payMethodAccounts");
  const cashAmountRow = document.getElementById("cashAmountRow");
  const cashAmountInput = document.getElementById("cashAmount");
  const checkNumberRow = document.getElementById("checkNumberRow");
  const checkNumberInput = document.getElementById("checkNumber");
  const cardFeeRow = document.getElementById("cardFeeRow");
  const cardFeeAddedHidden = document.getElementById("cardFeeAdded");
  const cardFeeYesBtn = document.getElementById("cardFeeYes");
  const cardFeeNoBtn = document.getElementById("cardFeeNo");
  const swInput = document.getElementById("sw");
  const whInput = document.getElementById("wh");
  const rdInput = document.getElementById("rd");
  const bppInput = document.getElementById("bpp");
  const kickerSpan = document.getElementById("kicker");
  const jobStatus = document.getElementById("jobStatus");
  const jobStatusTitle = document.getElementById("jobStatusTitle");
  const jobStatusDetail = document.getElementById("jobStatusDetail");
  const enteredTotalPriceHidden = document.getElementById("enteredTotalPrice");
  const updatedTotalPriceHidden = document.getElementById("updatedTotalPrice");
  const commissionAmountHidden = document.getElementById("commissionAmount");
  const totalCommissionHidden = document.getElementById("totalCommission");
  const profitBeforeKickerHidden = document.getElementById("profitBeforeKicker");
  const profitAfterKickerHidden = document.getElementById("profitAfterKicker");
  const calculateBtn = document.getElementById("calculateBtn");
  const printButton = document.getElementById("printButton");
  const printSheet = document.getElementById("printSheet");

  function setQaPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.classList.toggle("is-selected", !!pressed);
  }

  function setYesNoButtons(yesBtn, noBtn, hiddenInput, newValueYesNo) {
    hiddenInput.value = newValueYesNo;
    setQaPressed(yesBtn, newValueYesNo === "yes");
    setQaPressed(noBtn, newValueYesNo === "no");
  }

  function setChoiceButtons(buttons, hiddenInput, chosenValue) {
    hiddenInput.value = chosenValue;
    buttons.forEach(btn => {
      const isChosen = btn.dataset.value === chosenValue;
      setQaPressed(btn, isChosen);
    });
  }

  function updateGniVisibility() {
    if (jobTypeSelect.value === "company") {
      showEl(gniContainer);
    } else {
      hideEl(gniContainer);
      gniCheckbox.checked = false;
    }
  }

  function updateSwgcsVisibility() {
    const shouldShow = (jobTypeSelect.value === "technician" || jobTypeSelect.value === "sales");
    if (shouldShow) {
      showEl(swgcsContainer);
    } else {
      hideEl(swgcsContainer);
      swgcsHidden.value = "no";
      setQaPressed(swgcsYesBtn, false);
      setQaPressed(swgcsNoBtn, true);
    }
  }

  function updatePaymentVisibility() {
    const received = paymentReceivedHidden.value === "yes";

    if (received) showEl(paymentMethodRow);
    else hideEl(paymentMethodRow);

    if (!received) {
      paymentMethodHidden.value = "";
      [payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn].forEach(b => setQaPressed(b, false));

      hideEl(cashAmountRow);
      cashAmountInput.value = formatMoney(0);
      clearHint(cashAmountInput);

      hideEl(checkNumberRow);
      checkNumberInput.value = "";

      hideEl(cardFeeRow);
      cardFeeAddedHidden.value = "no";
      setQaPressed(cardFeeYesBtn, false);
      setQaPressed(cardFeeNoBtn, true);
    }
  }

  function updatePaymentMethodFollowups() {
    const method = paymentMethodHidden.value;

    if (method === "CASH") showEl(cashAmountRow);
    else {
      hideEl(cashAmountRow);
      cashAmountInput.value = formatMoney(0);
      clearHint(cashAmountInput);
    }

    if (method === "CHECK") showEl(checkNumberRow);
    else {
      hideEl(checkNumberRow);
      checkNumberInput.value = "";
    }

    if (method === "CARD") showEl(cardFeeRow);
    else {
      hideEl(cardFeeRow);
      cardFeeAddedHidden.value = "no";
      setQaPressed(cardFeeYesBtn, false);
      setQaPressed(cardFeeNoBtn, true);
    }

    updateOEDisplays();
  }

  function readMoneyInput(inputEl) {
    if (!inputEl) return 0;
    return Math.max(0, parseMoneyToNumber(inputEl.value));
  }

  function readHoursInput(inputEl) {
    if (!inputEl) return 0;
    return Math.max(0, snapHalfHour(parseHoursToNumber(inputEl.value)));
  }

  function getLaborValues() {
    return {
      day1: readHoursInput(document.getElementById("day1")),
      day2: readHoursInput(document.getElementById("day2")),
      day3: readHoursInput(document.getElementById("day3")),
      day4: readHoursInput(document.getElementById("day4")),
      day5: readHoursInput(document.getElementById("day5")),
      additionalHours: readHoursInput(document.getElementById("ah")),
      overtimeHours: readHoursInput(document.getElementById("toh")),
    };
  }

  function updateOEDisplays() {
    if (!ccFeeDisplay || !oeTotalDisplay) return;

    const enteredTP = readMoneyInput(totalPriceInput);
    const baseOE = (baseOtherExpense == null || !Number.isFinite(baseOtherExpense))
      ? readMoneyInput(otherExpensesInput)
      : baseOtherExpense;

    const paymentReceived = (paymentReceivedHidden.value === "yes");
    const method = (paymentMethodHidden.value || "");
    const feeAlreadyAdded = (cardFeeAddedHidden.value === "yes");

    const fee3pct = (paymentReceived && method === "CARD" && !feeAlreadyAdded) ? (0.03 * enteredTP) : 0;

    ccFeeDisplay.value = formatMoney(fee3pct);
    oeTotalDisplay.value = formatMoney(baseOE + fee3pct);
  }

  function saveState() {
    try {
      const data = {};
      document.querySelectorAll("input, textarea, select").forEach(el => {
        if (!el.id) return;
        if (el.type === "checkbox") data[el.id] = !!el.checked;
        else data[el.id] = el.value;
      });
      data.__baseOtherExpense = baseOtherExpense;
      sessionStorage.setItem(HTECHSAMA_STATE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function saveStateDebounced() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 150);
  }

  function restoreState() {
    try {
      const raw = sessionStorage.getItem(HTECHSAMA_STATE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      Object.keys(data || {}).forEach(id => {
        if (id.startsWith("__")) return;
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") el.checked = !!data[id];
        else el.value = data[id];
      });

      baseOtherExpense = (data.__baseOtherExpense == null) ? null : Number(data.__baseOtherExpense);

      setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, swgcsHidden.value === "yes" ? "yes" : "no");
      setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, paymentReceivedHidden.value === "yes" ? "yes" : "no");
      setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, cardFeeAddedHidden.value === "yes" ? "yes" : "no");

      [payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn].forEach(b => {
        b.dataset.value = b.dataset.value || b.textContent.trim();
      });

      const method = paymentMethodHidden.value || "";
      setChoiceButtons([payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn], paymentMethodHidden, method);

      updateGniVisibility();
      updateSwgcsVisibility();
      updatePaymentVisibility();
      updatePaymentMethodFollowups();
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildPrintSheetHTML() {

    const jobTypeText = jobTypeSelect.options[jobTypeSelect.selectedIndex]?.text || "";
    const getVal = (id) => document.getElementById(id)?.value ?? "";
    const paymentReceivedText = (paymentReceivedHidden.value === "yes") ? "Yes" : "No";
    const paymentMethodText = (paymentReceivedHidden.value === "yes") ? (paymentMethodHidden.value || "") : "";
    const cashAmountText = (paymentMethodHidden.value === "CASH") ? (cashAmountInput?.value || "") : "";
    const checkNumberText = (paymentMethodHidden.value === "CHECK") ? (checkNumberInput?.value || "") : "";
    const cardFeeText =
      (paymentMethodHidden.value === "CARD")
        ? ((cardFeeAddedHidden.value === "yes") ? "Yes (fee already added)" : "Not Added (automatic fee applied)")
        : "";

    const gniText =
      (jobTypeSelect.value === "company")
        ? (gniCheckbox.checked ? "Yes" : "No")
        : "N/A";

    const swgcsText =
      (jobTypeSelect.value === "sales" || jobTypeSelect.value === "technician")
        ? (swgcsHidden.value === "yes" ? "Yes" : "No")
        : "N/A";

    const day1 = getVal("day1");
    const day2 = getVal("day2");
    const day3 = getVal("day3");
    const day4 = getVal("day4");
    const day5 = getVal("day5");
    const ah = getVal("ah");
    const toh = getVal("toh");
    const totalHours = getVal("totalHours");
    const sw = getVal("sw");
    const wh = getVal("wh");
    const rd = getVal("rd");
    const bpp = getVal("bpp");
    const kickerText = kickerSpan?.textContent || "0.00";

    let qaRows = `
      <tr><th>Payment Received:</th><td>${escapeHtml(paymentReceivedText)}</td></tr>
    `;

    if (paymentReceivedHidden.value === "yes") {
      qaRows += `<tr><th>Payment Method:</th><td>${escapeHtml(paymentMethodText || "N/A")}</td></tr>`;

      if (paymentMethodHidden.value === "CASH") {
        qaRows += `<tr><th>Cash Amount:</th><td>${escapeHtml(cashAmountText || "N/A")}</td></tr>`;
      } else if (paymentMethodHidden.value === "CHECK") {
        qaRows += `<tr><th>Check Number:</th><td>${escapeHtml(checkNumberText || "N/A")}</td></tr>`;
      } else if (paymentMethodHidden.value === "CARD") {
        qaRows += `<tr><th>Card Fee Added:</th><td>${escapeHtml(cardFeeText || "N/A")}</td></tr>`;
      }
    }

    return `
      <div id="printRoot">
        <div class="print-header">
          <img src="BP.png" alt="BP logo" class="logo" />
          <h2>TECHNICIAN POTENTIAL KICKER</h2>
        </div>

        <div class="print-body">
          <div class="no-break details-section">
            <h3>DETAILS:</h3>
            <table class="input-data">
              <tr><th>Job Type:</th><td>${escapeHtml(jobTypeText)}</td></tr>
              <tr><th>Technician:</th><td>${escapeHtml(technicianSelect?.value || "")}</td></tr>
              <tr><th>GNI:</th><td>${escapeHtml(gniText)}</td></tr>
              <tr><th>S/W/G/CS:</th><td>${escapeHtml(swgcsText)}</td></tr>
              <tr><th>Job Address:</th><td>${escapeHtml(getVal("ja"))}</td></tr>
              <tr><th>Date:</th><td>${escapeHtml(getVal("date"))}</td></tr>
              <tr><th>Entered Total Price:</th><td>${escapeHtml(enteredTotalPriceHidden?.value || getVal("tp"))}</td></tr>
              <tr><th>Updated Total Price:</th><td>${escapeHtml(updatedTotalPriceHidden?.value || "")}</td></tr>
              <tr><th>Material Expenses:</th><td>${escapeHtml(getVal("material"))}</td></tr>
              <tr><th>Other Expenses (Base):</th><td>${escapeHtml(getVal("oe"))}</td></tr>
              <tr><th>Credit Card Fee (3%):</th><td>${escapeHtml(ccFeeDisplay?.value || "")}</td></tr>
              <tr><th>Other Expenses (Total):</th><td>${escapeHtml(oeTotalDisplay?.value || "")}</td></tr>
              <tr><th>Project Duration:</th><td>${escapeHtml(getVal("pd"))}</td></tr>
            </table>
          </div>

          <div class="no-break">
            <h3>QUESTIONS &amp; ANSWERS:</h3>
            <table class="input-data">
              ${qaRows}
            </table>
          </div>

          <div class="no-break">
            <h3>LABOR DETAILS:</h3>
            <table class="input-data">
              <tr><th>Day 1</th><th>Day 2</th><th>Day 3</th><th>Day 4</th></tr>
              <tr>
                <td>${escapeHtml(day1)}</td><td>${escapeHtml(day2)}</td><td>${escapeHtml(day3)}</td><td>${escapeHtml(day4)}</td>
              </tr>
            </table>

            <table class="input-data">
              <tr><th>Day 5</th><th>Additional Hours</th><th>Overtime Hours</th><th>Total Hours</th></tr>
              <tr>
                <td>${escapeHtml(day5)}</td><td>${escapeHtml(ah)}</td><td>${escapeHtml(toh)}</td><td>${escapeHtml(totalHours)}</td>
              </tr>
            </table>
          </div>

          <div class="no-break">
            <h3>FOR OFFICE USE ONLY:</h3>
            <table class="input-data">
              <tr><th>SW21/RP21</th><th>WH32</th><th>RD15/UL15</th><th>BPP%</th></tr>
              <tr>
                <td>${escapeHtml(sw)}</td><td>${escapeHtml(wh)}</td><td>${escapeHtml(rd)}</td><td>${escapeHtml(bpp)}</td>
              </tr>
            </table>
          </div>

          <div class="no-break commission-details-section">
            <h3>PAYOUTS:</h3>
            <table class="input-data">
              <tr><th>Kicker:</th><td>${escapeHtml(kickerText)}</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function syncCalculatorPrintSheet() {
    if (!printSheet || isSyncingCalculatorPrintSheet) return;

    isSyncingCalculatorPrintSheet = true;
    try {
      printSheet.innerHTML = buildPrintSheetHTML();
      printSheet.setAttribute("aria-hidden", "false");
    } finally {
      isSyncingCalculatorPrintSheet = false;
    }
  }

  function calculateReport() {
    const enteredPrice = readMoneyInput(totalPriceInput);
    const materialExpenses = readMoneyInput(materialExpensesInput);
    const otherExpenses = (baseOtherExpense == null || !Number.isFinite(baseOtherExpense))
      ? readMoneyInput(otherExpensesInput)
      : baseOtherExpense;

    const projectDuration = Math.max(1, snapHalfHour(readHoursInput(projectDurationInput)));

    const { day1, day2, day3, day4, day5, additionalHours, overtimeHours } = getLaborValues();
    const totalHours = snapHalfHour(day1 + day2 + day3 + day4 + day5 + additionalHours + (1.5 * overtimeHours));
    if (totalHoursInput) totalHoursInput.value = formatHours(totalHours);

    const techName = technicianSelect ? technicianSelect.value : "";
    const techRate = (techName && TECH_RATES[techName]) ? Number(TECH_RATES[techName]) : 0;

    if (!techName || !techRate) {
      showHint(technicianSelect, "Select a technician to calculate kicker.");

      kickerSpan.textContent = formatMoney(0);
      swInput.value = "";
      whInput.value = "";
      rdInput.value = "";
      bppInput.value = "";
      hideEl(jobStatus);

      jobStatus.classList.remove("is-bust");
      jobStatusTitle.textContent = "";
      jobStatusDetail.textContent = "";

      enteredTotalPriceHidden.value = formatMoney(enteredPrice);
      updatedTotalPriceHidden.value = formatMoney(0);
      profitBeforeKickerHidden.value = formatMoney(0);
      profitAfterKickerHidden.value = formatMoney(0);
      commissionAmountHidden.value = formatMoney(0);
      totalCommissionHidden.value = formatMoney(0);

      updateOEDisplays();
      syncCalculatorPrintSheet();
      return;
    } else {
      clearHint(technicianSelect);
    }

    let tpEffective = enteredPrice;

    const jobType = jobTypeSelect.value;
    const isGni = !!gniCheckbox.checked;
    const swgcs = (swgcsHidden.value || "no");

    if (jobType === "company") {
      if (isGni) tpEffective = tpEffective / 1.1;
    } else if (jobType === "sales") {
      tpEffective = tpEffective * (swgcs === "yes" ? 0.85 : 0.90);
    } else if (jobType === "technician") {
      tpEffective = tpEffective * (swgcs === "yes" ? 0.88 : 0.90);
    } else if (jobType === "office") {
      tpEffective = tpEffective * 0.97;
    } else if (jobType === "newtech") {
      tpEffective = tpEffective * 0.90;
    } else if (jobType === "hourlytech") {
      tpEffective = tpEffective * 0.95;
    }

    const paymentReceived = (paymentReceivedHidden.value === "yes");
    const method = (paymentMethodHidden.value || "");
    const feeAlreadyAdded = (cardFeeAddedHidden.value === "yes");

    const ccFee = (paymentReceived && method === "CARD" && !feeAlreadyAdded) ? (0.03 * enteredPrice) : 0;

    const totalSalary = techRate * projectDuration;
    const laborCost = totalHours * 95;
    const overheads = projectDuration * 290;
    const otherExpensesTotal = otherExpenses + ccFee;

    const profit =
      tpEffective
      - (materialExpenses * 1.2)
      - laborCost
      - otherExpensesTotal
      - totalSalary
      - overheads
      + (materialExpenses * 1.2 * 0.1667)
      + (laborCost * 0.4);

    const profper = enteredPrice > 0 ? (profit / enteredPrice) * 100 : 0;

    let tierRate = 0;
    if (profper >= 35.01 && profper <= 39.99) tierRate = 0.015;
    else if (profper >= 40.01 && profper <= 49.99) tierRate = 0.02;
    else if (profper >= 50.01 && profper <= 59.99) tierRate = 0.025;
    else if (profper >= 60.01) tierRate = 0.03;

    const tierKicker = tierRate > 0 ? (tierRate * tpEffective) : 0;
    const maxAllowed = Math.max(0, profit - (0.35 * enteredPrice));
    const kicker = Math.min(tierKicker, maxAllowed);

    const netProfit = profit - kicker;
    const nprofper = enteredPrice > 0 ? (netProfit / enteredPrice) * 100 : 0;

    const matPct = enteredPrice > 0 ? (materialExpenses / enteredPrice) * 100 : 0;
    const pctText = `${matPct.toFixed(2)}%`;
    swInput.value = pctText;
    whInput.value = pctText;
    rdInput.value = pctText;

    const bppPct = `${nprofper.toFixed(2)}%`;
    let bppEmoji = "";
    let bppMsg = "";

    if (nprofper < 10) { bppEmoji = "👎"; bppMsg = "JOB BUST. PLEASE SEE GM"; }
    else if (nprofper <= 19.99) { bppEmoji = "😬"; bppMsg = "MARGINAL PROFIT"; }
    else if (nprofper <= 29.99) { bppEmoji = "👍"; bppMsg = "GOOD WORK"; }
    else if (nprofper <= 39.99) { bppEmoji = "😀"; bppMsg = "NICE WORK"; }
    else if (nprofper <= 59.99) { bppEmoji = "⭐"; bppMsg = "GREAT WORK"; }
    else { bppEmoji = "🌟"; bppMsg = "EXCELLENT WORK"; }

    bppInput.value = `${bppPct} : ${bppEmoji} : ${bppMsg}`;
    kickerSpan.textContent = formatMoney(kicker);

    if (nprofper < 10) {
      showEl(jobStatus);
      jobStatus.classList.add("is-bust");
      jobStatusTitle.textContent = "Attention Required: Low Margin Job";
      jobStatusDetail.textContent = "This job is below the minimum margin threshold. Please review pricing, costs, and notes before submitting.";
    } else {
      hideEl(jobStatus);
      jobStatus.classList.remove("is-bust");
      jobStatusTitle.textContent = "";
      jobStatusDetail.textContent = "";
    }

    enteredTotalPriceHidden.value = formatMoney(enteredPrice);
    updatedTotalPriceHidden.value = formatMoney(tpEffective);
    profitBeforeKickerHidden.value = formatMoney(profit);
    profitAfterKickerHidden.value = formatMoney(netProfit);
    commissionAmountHidden.value = formatMoney(0);
    totalCommissionHidden.value = formatMoney(0);

    updateOEDisplays();
    syncCalculatorPrintSheet();
  }

  document.addEventListener("DOMContentLoaded", () => {
    populateTechnicians(technicianSelect);
    attachAutoSelectToAllEditables();

    wireMoneyInput(totalPriceInput);
    wireMoneyInput(materialExpensesInput);
    wireMoneyInput(cashAmountInput);
    wireMoneyInput(otherExpensesInput);

    otherExpensesInput.addEventListener("input", () => {
      baseOtherExpense = readMoneyInput(otherExpensesInput);
      updateOEDisplays();
    });

    otherExpensesInput.addEventListener("blur", () => {
      baseOtherExpense = readMoneyInput(otherExpensesInput);
      updateOEDisplays();
    });

    wireHoursInput(projectDurationInput, { isPD: true });
    ["day1","day2","day3","day4","day5","ah","toh"].forEach(id => {
      wireHoursInput(document.getElementById(id), { isPD: false });
    });

    wireDateInput(dateInput, { autofillToday: true });
    wireTitleCase(jobAddressInput);

    setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, "no");
    setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, "no");
    setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, "no");

    swgcsYesBtn.addEventListener("click", () => {
      setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, "yes");
      saveState();
      calculateReport();
    });

    swgcsNoBtn.addEventListener("click", () => {
      setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, "no");
      saveState();
      calculateReport();
    });

    payRecYesBtn.addEventListener("click", () => {
      setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, "yes");
      updatePaymentVisibility();
      updatePaymentMethodFollowups();
      saveState();
      calculateReport();
    });

    payRecNoBtn.addEventListener("click", () => {
      setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, "no");
      updatePaymentVisibility();
      updatePaymentMethodFollowups();
      saveState();
      calculateReport();
    });

    [
      [payMethodCashBtn, "CASH"],
      [payMethodCheckBtn, "CHECK"],
      [payMethodCardBtn, "CARD"],
      [payMethodAccountsBtn, "ACCOUNTS"],
    ].forEach(([btn, val]) => {
      btn.dataset.value = val;
      btn.addEventListener("click", () => {
        setChoiceButtons([payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn], paymentMethodHidden, val);
        updatePaymentMethodFollowups();
        saveState();
        calculateReport();
      });
    });

    cardFeeYesBtn.addEventListener("click", () => {
      setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, "yes");
      saveState();
      calculateReport();
    });

    cardFeeNoBtn.addEventListener("click", () => {
      setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, "no");
      saveState();
      calculateReport();
    });

    [gniCheckbox, jobTypeSelect].forEach(el => el.addEventListener("change", () => {
      updateGniVisibility();
      updateSwgcsVisibility();
      saveState();
      calculateReport();
    }));

    if (technicianSelect) {
      technicianSelect.addEventListener("change", () => {
        saveState();
        calculateReport();
      });
    }

    document.querySelectorAll("input, textarea, select").forEach(input => {
      input.addEventListener("input", () => {
        saveStateDebounced();
        calculateReport();
      });
      input.addEventListener("change", () => {
        saveStateDebounced();
        calculateReport();
      });
    });

    restoreState();

    [totalPriceInput, materialExpensesInput, otherExpensesInput, cashAmountInput].forEach(inp => {
      if (!inp) return;
      if (!String(inp.value || "").trim()) inp.value = formatMoney(0);
    });

    baseOtherExpense = (baseOtherExpense == null || !Number.isFinite(baseOtherExpense))
      ? readMoneyInput(otherExpensesInput)
      : baseOtherExpense;

    if (ccFeeDisplay && !String(ccFeeDisplay.value || "").trim()) ccFeeDisplay.value = formatMoney(0);
    if (oeTotalDisplay && !String(oeTotalDisplay.value || "").trim()) oeTotalDisplay.value = formatMoney(0);

    ["pd","day1","day2","day3","day4","day5","ah","toh"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!String(el.value || "").trim()) el.value = (id === "pd") ? "1.00 hrs" : "0.00 hrs";
    });

    if (dateInput && !String(dateInput.value || "").trim()) {
      dateInput.value = longDateFormatter.format(todayLocalDate());
    }

    updateGniVisibility();
    updateSwgcsVisibility();
    updatePaymentVisibility();
    updatePaymentMethodFollowups();
    calculateReport();
    updateOEDisplays();

    window.addEventListener("beforeprint", () => {
      calculateReport();
      document.body.classList.add("is-printing");
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("is-printing");
    });

    if (calculateBtn) {
      calculateBtn.addEventListener("click", () => {
        setButtonBusy(calculateBtn, "Calculating...");
        saveState();
        calculateReport();
        setTimeout(() => clearButtonBusy(calculateBtn), 400);
      });
    }

    if (printButton) {
      printButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (printButton.disabled) return;

        const ok = window.confirm(
          "I HEREBY CONFIRM THAT ALL THE DETAILS ENTERED ARE CORRECT AND I TAKE FULL RESPONSIBILITY OF THIS DOCUMENT."
        );
        if (!ok) return;

        setButtonBusy(printButton, "Preparing Print Page...");
        calculateReport();
        saveState();
        sessionStorage.setItem(HTECHSAMA_PRINT_PAYLOAD_KEY, buildPrintSheetHTML());
        sessionStorage.setItem(HTECHSAMA_PRINT_RETURN_KEY, HTECHSAMA_CALCULATOR_URL);

        setTimeout(() => {
          window.location.href = HTECHSAMA_PRINT_PAGE_URL;
        }, 120);

        setTimeout(() => {
        if (document.visibilityState === "visible") {
          clearButtonBusy(printButton);
        }
      }, PRINT_BUTTON_LOCK_MS);
      });
    }
  });
})();
