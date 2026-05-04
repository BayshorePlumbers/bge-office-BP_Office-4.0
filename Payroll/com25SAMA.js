/* com.js (Bayshore Standard aligned) */

/* Global flag for dynamic credit fee addition */
let addCreditFee = false;

/* Global variables to store question answers */
let paymentReceived = "";      // "Yes" | "No" | "BAYSHORE ACCOUNT"
let paymentMethod = "";        // "Debit Card" | "Cash" | "Online" | "Credit Card" | "Check"
let creditCardFeeAnswer = "";  // "Not Added (automatic fee applied)" | "Yes (fee already added)"

/* Assisted sale flag */
let managerialAssistanceUsed = false;

/* Base OE storage (user-editable base) */
let baseOtherExpense = null;

const COM25SAMA_PRINT_PAYLOAD_KEY = "com25SAMA_print_payload_v1";
const COM25SAMA_PRINT_RETURN_KEY = "com25SAMA_return_v1";
const COM25SAMA_PRINT_PAGE_URL = "com25SAMA-print.html";
const COM25SAMA_CALCULATOR_URL = "com25SAMA.html";

const PRINT_BUTTON_LOCK_MS = 2500;

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

/* ---------- Helpers (Bayshore Standard) ---------- */

function beginEditHours(el) {
  // show raw numeric text while editing
  const n = parseHours(el.value);
  el.value = (Number.isFinite(n) ? n : 0).toString();
}

function beginEditMoney(el) {
  const n = parseMoney(el.value);
  el.value = (Number.isFinite(n) ? n : 0).toString();
}

function show(el) { el.classList.remove("is-hidden"); }
function hide(el) { el.classList.add("is-hidden"); }

function setSelectedAnswer(qNum, answer) {
  document.querySelectorAll(`.qa-btn[data-q="${qNum}"]`).forEach(b => {
    const on = b.getAttribute("data-a") === answer;
    b.classList.toggle("is-selected", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function clearSelectedFrom(qNum) {
  [qNum, qNum + 1, qNum + 2, qNum + 3].forEach(q => {
    document.querySelectorAll(`.qa-btn[data-q="${q}"]`).forEach(b => {
      b.classList.remove("is-selected");
      b.setAttribute("aria-pressed", "false");
    });
  });
}

function selectAllOnFocus(el) {
  // Prevent duplicate listener attachment (important for iPad stability)
  if (el && el.dataset && el.dataset.autoSelectAttached === "1") return;
  if (el && el.dataset) el.dataset.autoSelectAttached = "1";

  const selectNow = () => {
    try {
      const len = (el.value || "").length;
      // setSelectionRange is more reliable on iOS than select()
      el.setSelectionRange(0, len);
    } catch (_) {
      try { el.select(); } catch (_) {}
    }
  };

  const selectSoon = () => {
    try {
      // iOS needs a tick AFTER focus is established
      requestAnimationFrame(() => {
        try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch(_){} }
        selectNow();
        // and sometimes one more tick
        setTimeout(selectNow, 0);
      });
    } catch (_) {}
  };

  // Use pointer events first (best for iPad + desktop)
  el.addEventListener("pointerdown", selectSoon);
  el.addEventListener("pointerup", selectSoon);

  // Fallbacks
  el.addEventListener("touchstart", selectSoon, { passive: true });
  el.addEventListener("click", selectSoon);
  el.addEventListener("focus", selectSoon);
}

function attachAutoSelectToAllEditables() {
  document.querySelectorAll("input, textarea, select").forEach(el => {
    if (el.hasAttribute("readonly") || el.disabled) return;
    if (el.tagName === "INPUT" && el.type === "hidden") return;
    selectAllOnFocus(el);
  });
}

function setInlineHint(el, msg) {
  const id = `${el.id}-hint`;
  let hint = document.getElementById(id);
  if (!hint) {
    hint = document.createElement("div");
    hint.id = id;
    hint.className = "field-hint";
    el.insertAdjacentElement("afterend", hint);
  }
  hint.textContent = msg || "";
  hint.classList.toggle("is-visible", !!msg);
}

function parseMoney(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function formatMoneyUSD(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function updateOEDisplays({ tp, baseOE }) {
  const ccEl = document.getElementById("ccFeeDisplay");
  const totalEl = document.getElementById("oeTotalDisplay");
  if (!ccEl || !totalEl) return;

  const fee3pct = 0.03 * tp;

  // Default: show $0.00 unless fee is being applied
  let ccText = formatMoneyUSD(0);
  let total = baseOE;

  // Only meaningful when payment method is Credit Card
  if (paymentMethod === "Credit Card") {
    if (addCreditFee) {
      // Not added => we apply it
      ccText = formatMoneyUSD(fee3pct);
      total = baseOE + fee3pct;
    } else if (creditCardFeeAnswer) {
      // Fee already included in TP => show verification message
      ccText = `Already Added in the Total Price (3% = ${formatMoneyUSD(fee3pct)})`;
      total = baseOE; // don't add again
    }
  }

  ccEl.value = ccText;
  totalEl.value = formatMoneyUSD(total);
}

function parseMoneyField(el) {
  const n = parseMoney(el.value);
  return n < 0 ? 0 : n;
}
function formatMoneyField(el) {
  // Detect negatives from RAW input so the hint actually works
  const raw = parseMoney(el.value);

  if (raw < 0) {
    setInlineHint(el, "No negatives");
    el.value = formatMoneyUSD(0);
    return 0;
  }

  const n = parseMoneyField(el); // safe/clamped for final value
  setInlineHint(el, "");
  el.value = formatMoneyUSD(n);
  return n;
}

function parseHours(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function snapHalfHour(n) {
  // nearest 0.5
  return Math.round(n * 2) / 2;
}
function formatHoursDisplay(n) {
  const v = Number.isFinite(n) ? n : 0;
  const snapped = snapHalfHour(v);
  return `${snapped.toFixed(2)} hrs`;
}
function formatHours(n) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toFixed(2)} hrs`;
}
function parseHoursField(el) {
  const n = parseHours(el.value);
  return n < 0 ? 0 : n;
}
function formatHoursField(el, { min = null } = {}) {
  let n = parseHours(el.value);

  if (n < 0) {
  setInlineHint(el, "No negatives");
  el.value = formatHoursDisplay(0);
  return 0;
}

  n = snapHalfHour(n);

  if (min != null && n < min) {
    n = min;
    setInlineHint(el, "Min 1 hr");
  } else {
    setInlineHint(el, "");
  }

  el.value = formatHoursDisplay(n);
  return n;
}

function titleCase(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, s => s.toUpperCase());
}

function formatDateLong(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function parseFlexibleDate(value) {
  const v = String(value || "").trim();
  if (!v) return null;

  function buildValidDate(year, monthOneBased, day) {
    const y = Number(year);
    const m = Number(monthOneBased);
    const d = Number(day);

    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;

    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== m || dt.getDate() !== d) return null;

    return dt;
  }

  // 1) Digits-only: MMDDYYYY (REQUIRED)
  if (/^\d{8}$/.test(v)) {
    const mm = parseInt(v.slice(0, 2), 10);
    const dd = parseInt(v.slice(2, 4), 10);
    const yy = parseInt(v.slice(4, 8), 10);
    const d = buildValidDate(yy, mm, dd);
    if (d) return d;
  }

  // 2) Digits-only: MMDDYY (optional)
  if (/^\d{6}$/.test(v)) {
    const mm = parseInt(v.slice(0, 2), 10);
    const dd = parseInt(v.slice(2, 4), 10);
    let yy = parseInt(v.slice(4, 6), 10);
    yy += (yy >= 70 ? 1900 : 2000);
    const d = buildValidDate(yy, mm, dd);
    if (d) return d;
  }

  // 3) YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yy = parseInt(iso[1], 10);
    const mm = parseInt(iso[2], 10);
    const dd = parseInt(iso[3], 10);
    const d = buildValidDate(yy, mm, dd);
    if (d) return d;
  }

  // 4) MM/DD/YYYY or M/D/YYYY
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const mm = parseInt(us[1], 10);
    const dd = parseInt(us[2], 10);
    let yy = parseInt(us[3], 10);
    if (yy < 100) yy += 2000;
    const d = buildValidDate(yy, mm, dd);
    if (d) return d;
  }

  return null;
}

/* ---------- Dynamic Questions ---------- */
function writeCanon() {
  const pr = document.getElementById("canon_paymentReceived");
  const pm = document.getElementById("canon_paymentMethod");
  const cf = document.getElementById("canon_creditFeeAdded");

  if (pr) pr.value =
    paymentReceived === "Yes" ? "yes" :
    paymentReceived === "No" ? "no" :
    paymentReceived === "BAYSHORE ACCOUNT" ? "account" : "";

  if (pm) pm.value =
    paymentMethod === "Debit Card" ? "debit" :
    paymentMethod === "Cash" ? "cash" :
    paymentMethod === "Online" ? "online" :
    paymentMethod === "Credit Card" ? "creditCard" :
    paymentMethod === "Check" ? "check" : "";

  if (cf) {
    // Only meaningful for Credit Card
    if (paymentMethod !== "Credit Card") cf.value = "";
    else cf.value = addCreditFee ? "no" : (creditCardFeeAnswer ? "yes" : "");
  }
}

function readCanon() {
  const pr = (document.getElementById("canon_paymentReceived")?.value || "").trim();
  const pm = (document.getElementById("canon_paymentMethod")?.value || "").trim();
  const cf = (document.getElementById("canon_creditFeeAdded")?.value || "").trim();

  paymentReceived =
    pr === "yes" ? "Yes" :
    pr === "no" ? "No" :
    pr === "account" ? "BAYSHORE ACCOUNT" : "";

  paymentMethod =
    pm === "debit" ? "Debit Card" :
    pm === "cash" ? "Cash" :
    pm === "online" ? "Online" :
    pm === "creditCard" ? "Credit Card" :
    pm === "check" ? "Check" : "";

  if (paymentMethod === "Credit Card") {
    if (cf === "no") {
      addCreditFee = true;
      creditCardFeeAnswer = "Not Added (automatic fee applied)";
    } else if (cf === "yes") {
      addCreditFee = false;
      creditCardFeeAnswer = "Yes (fee already added)";
    }
  }
}

function clearDependentFromQuestion(qNum) {
  // If Q1 changes, clear Q2+Q3 and followups
  if (qNum <= 1) {
    paymentMethod = "";
    creditCardFeeAnswer = "";
    addCreditFee = false;
    const checkEl = document.getElementById("checkNumber");
    if (checkEl) checkEl.value = "";
    const cashEl = document.getElementById("cashAmount");
    if (cashEl) cashEl.value = "$0.00";
    clearSelectedFrom(2);
  }

    // If Q2 changes, clear Q3 + clear followup inputs and hide them
  if (qNum <= 2) {
    creditCardFeeAnswer = "";
    addCreditFee = false;

    const checkEl = document.getElementById("checkNumber");
    if (checkEl) checkEl.value = "";

    const cashEl = document.getElementById("cashAmount");
    if (cashEl) cashEl.value = "$0.00";

    clearSelectedFrom(3);

    // Force-hide followups immediately (prevents “sticky” check/cash UI)
    const qc = document.getElementById("questionCheck");
    const qcash = document.getElementById("questionCash");
    const q3 = document.getElementById("question3");
    if (qc) hide(qc);
    if (qcash) hide(qcash);
    if (q3) hide(q3);
  }
  writeCanon();
}  

function syncQuestionVisibility() {
  const q1 = document.getElementById("question1");
  const q2 = document.getElementById("question2");
  const q3 = document.getElementById("question3");
  const qc = document.getElementById("questionCheck");
  const qcash = document.getElementById("questionCash");

  // Q1 always visible
  show(q1);

  // If not received or account → hide downstream
  if (paymentReceived !== "Yes") {
    hide(q2); hide(q3);
    if (qc) hide(qc);
    if (qcash) hide(qcash);
    return;
  }

  // Payment received YES: Q2 stays visible always
  show(q2);

  // No method yet
  if (!paymentMethod) {
    hide(q3);
    if (qc) hide(qc);
    if (qcash) hide(qcash);
    return;
  }

  // Reset followups first
  if (qc) hide(qc);
  if (qcash) hide(qcash);

  if (paymentMethod === "Check") {
    if (qc) show(qc);
    hide(q3);
    return;
  }

  if (paymentMethod === "Cash") {
    if (qcash) show(qcash);
    hide(q3);
    return;
  }

  if (paymentMethod === "Credit Card") {
    show(q3);
    return;
  }

  hide(q3);
}

function handleAnswer(answer, questionNumber) {
  if (questionNumber === 1) {
    clearDependentFromQuestion(1);

    if (answer === "yes") {
      paymentReceived = "Yes";
    } else if (answer === "no") {
      paymentReceived = "No";
    } else {
      paymentReceived = "BAYSHORE ACCOUNT";
    }
  }

  if (questionNumber === 2) {
    clearDependentFromQuestion(2);

    if (answer === "creditCard") paymentMethod = "Credit Card";
    else if (answer === "debit") paymentMethod = "Debit Card";
    else if (answer === "cash") paymentMethod = "Cash";
    else if (answer === "online") paymentMethod = "Online";
    else if (answer === "check") paymentMethod = "Check";
  }

  if (questionNumber === 3) {
    if (answer === "no") {
      addCreditFee = true;
      creditCardFeeAnswer = "Not Added (automatic fee applied)";
    } else {
      addCreditFee = false;
      creditCardFeeAnswer = "Yes (fee already added)";
    }
  }

  setSelectedAnswer(questionNumber, answer);
  syncQuestionVisibility();
  writeCanon();
  calculateCommission();
}

/* ---------- Tips (tap-friendly) ---------- */

function applyTipBubbles() {
  // Create bubbles once
  document.querySelectorAll(".tip-btn").forEach(btn => {
    const text = btn.getAttribute("data-tip") || "";
    const bubble = document.createElement("div");
    bubble.className = "tip-bubble is-hidden";
    bubble.textContent = text;
    btn.dataset.tipId = `tip_${Math.random().toString(36).slice(2)}`;
    bubble.dataset.tipFor = btn.dataset.tipId;
    btn.parentElement.appendChild(bubble);
  });

  // Toggle on button click
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".tip-btn");
    const allBubbles = document.querySelectorAll(".tip-bubble");

    if (btn) {
      e.preventDefault();
      const id = btn.dataset.tipId;
      allBubbles.forEach(b => {
        const isMine = b.dataset.tipFor === id;
        b.classList.toggle("is-hidden", !isMine ? true : !b.classList.contains("is-hidden"));
      });
      return;
    }

    // Click outside => close all
    allBubbles.forEach(b => b.classList.add("is-hidden"));
  }, true);
}

/* ---------- Print state save/restore ---------- */

function saveFormState() {
  writeCanon();

  const form = document.getElementById("commissionForm");
  const data = {};

  if (form) {
    form.querySelectorAll("input, select, textarea").forEach(el => {
      if (!el.id) return;
      if (el.type === "button" || el.type === "submit" || el.type === "reset") return;
      data[el.id] = el.value;
    });
  }

  data.__paymentReceived = paymentReceived;
  data.__paymentMethod = paymentMethod;
  data.__creditCardFeeAnswer = creditCardFeeAnswer;
  data.__addCreditFee = addCreditFee;
  data.__managerialAssistanceUsed = managerialAssistanceUsed;
  data.__baseOtherExpense = baseOtherExpense;

  sessionStorage.setItem("com25SAMA_state_v1", JSON.stringify(data));
}

function restoreFormState() {
    const raw = sessionStorage.getItem("com25SAMA_state_v1");
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    Object.keys(data).forEach(k => {
      if (k.startsWith("__")) return;
      const el = document.getElementById(k);
      if (el && typeof data[k] === "string") el.value = data[k];
    });

    paymentReceived = data.__paymentReceived || "";
    paymentMethod = data.__paymentMethod || "";
    creditCardFeeAnswer = data.__creditCardFeeAnswer || "";
    addCreditFee = !!data.__addCreditFee;

    // Also restore hidden canonical values if present (authoritative)
    const _pr = (document.getElementById("canon_paymentReceived")?.value || "").trim();
    const _pm = (document.getElementById("canon_paymentMethod")?.value || "").trim();
    const _cf = (document.getElementById("canon_creditFeeAdded")?.value || "").trim();
    if (_pr || _pm || _cf) readCanon();

    managerialAssistanceUsed = !!data.__managerialAssistanceUsed;
    baseOtherExpense = (data.__baseOtherExpense == null) ? null : Number(data.__baseOtherExpense);

    // Repaint selections
    clearSelectedFrom(1);
    if (paymentReceived === "Yes") setSelectedAnswer(1, "yes");
    else if (paymentReceived === "No") setSelectedAnswer(1, "no");
    else if (paymentReceived === "BAYSHORE ACCOUNT") setSelectedAnswer(1, "account");

    if (paymentMethod === "Debit Card") setSelectedAnswer(2, "debit");
    if (paymentMethod === "Cash") setSelectedAnswer(2, "cash");
    if (paymentMethod === "Online") setSelectedAnswer(2, "online");
    if (paymentMethod === "Credit Card") setSelectedAnswer(2, "creditCard");
    if (paymentMethod === "Check") setSelectedAnswer(2, "check");

    if (paymentMethod === "Credit Card" && creditCardFeeAnswer) {
      setSelectedAnswer(3, addCreditFee ? "no" : "yes");
    }

    // Assisted toggle UI
        const managerialButton = document.getElementById("managerialAssistanceBtn");
    if (managerialButton) {
      managerialButton.innerText = managerialAssistanceUsed ? "ASSISTED SALE" : "NON-ASSISTED SALE";
      managerialButton.classList.toggle("assisted", managerialAssistanceUsed);
      managerialButton.classList.toggle("non-assisted", !managerialAssistanceUsed);
    }

    const salesLabel = document.getElementById("salesCommissionLabel");
    if (salesLabel) salesLabel.classList.toggle("is-hidden", !managerialAssistanceUsed);

    writeCanon();
    syncQuestionVisibility();
    calculateCommission();
  } catch (_) {}
}

/* ---------- Main ---------- */

  function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// keep this function fully outside DOMContentLoaded
function buildPrintSheetHTML() {
  const technicianName = document.getElementById("tn").value;
  const jobAddress = document.getElementById("ja").value;
  const invoiceNumber = document.getElementById("in").value;
  const date = document.getElementById("date").value;

  const projectHours = document.getElementById("pd").value;
  const materialExpenses = document.getElementById("material").value;
  const oe = document.getElementById("oe").value;
  const totalPrice = document.getElementById("tp").value;
  const notes = document.getElementById("notes").value;

  const tpNum = parseMoney(totalPrice);
  const baseOENum = Number.isFinite(baseOtherExpense) ? baseOtherExpense : parseMoney(oe);

  const fee3pct = 0.03 * tpNum;
  const ccFeeNum = addCreditFee ? fee3pct : 0;
  const totalOENum = baseOENum + ccFeeNum;

  const baseOEText = formatMoneyUSD(baseOENum);

  let ccFeeText = formatMoneyUSD(ccFeeNum);

  if (paymentMethod === "Credit Card" && !addCreditFee && creditCardFeeAnswer) {
    ccFeeText = `Already Added in the Total Price (3% = ${formatMoneyUSD(fee3pct)})`;
  }

  const totalOEText = formatMoneyUSD(totalOENum);

  const day1 = document.getElementById("day1").value;
  const day2 = document.getElementById("day2").value;
  const day3 = document.getElementById("day3").value;
  const day4 = document.getElementById("day4").value;
  const day5 = document.getElementById("day5").value;
  const additionalHours = document.getElementById("ah").value;
  const overtimeHours = document.getElementById("toh").value;
  const totalHours = document.getElementById("totalHours").value;

  const sw = document.getElementById("sw").value;
  const wh = document.getElementById("wh").value;
  const rd = document.getElementById("rd").value;
  const bpp = document.getElementById("bpp").value;

  const totalCommission = document.getElementById("totalCommission").textContent;

  const salesCommissionRow = managerialAssistanceUsed
    ? `<tr><th>Sales Commission:</th><td>${escapeHtml(document.getElementById("salesCommission").textContent)}</td></tr>`
    : "";

  let additionalRow = "";

  if (paymentReceived === "No" || paymentReceived === "BAYSHORE ACCOUNT") {
    additionalRow = `<tr><th>Payment Received:</th><td>${escapeHtml(paymentReceived)}</td></tr>`;
  } else if (paymentMethod === "Check") {
    const checkNumber = document.getElementById("checkNumber").value || "N/A";
    additionalRow =
      `<tr><th>Payment Received:</th><td>${escapeHtml(paymentReceived || "N/A")}</td></tr>
       <tr><th>Payment Method:</th><td>${escapeHtml(paymentMethod || "N/A")}</td></tr>
       <tr><th>Check Number:</th><td>${escapeHtml(checkNumber)}</td></tr>`;
  } else if (paymentMethod === "Cash") {
    const cashAmount = document.getElementById("cashAmount").value || "N/A";
    additionalRow =
      `<tr><th>Payment Received:</th><td>${escapeHtml(paymentReceived || "N/A")}</td></tr>
       <tr><th>Payment Method:</th><td>${escapeHtml(paymentMethod || "N/A")}</td></tr>
       <tr><th>Cash Amount:</th><td>${escapeHtml(cashAmount)}</td></tr>`;
  } else if (paymentMethod === "Credit Card") {
    additionalRow =
      `<tr><th>Payment Received:</th><td>${escapeHtml(paymentReceived || "N/A")}</td></tr>
       <tr><th>Payment Method:</th><td>${escapeHtml(paymentMethod || "N/A")}</td></tr>
       <tr><th>Credit Card Fee Added:</th><td>${escapeHtml(creditCardFeeAnswer || "N/A")}</td></tr>`;
  } else {
    additionalRow =
      `<tr><th>Payment Received:</th><td>${escapeHtml(paymentReceived || "N/A")}</td></tr>
       <tr><th>Payment Method:</th><td>${escapeHtml(paymentMethod || "N/A")}</td></tr>`;
  }

  return `
    <div id="printRoot">
      <div class="print-header">
        <img src="BP.png" alt="BP logo" class="logo">
        <h2>TECHNICIAN COMMISSION DOCUMENT</h2>
      </div>

      <div class="print-body">
        <div class="no-break details-section">
          <h3>DETAILS:</h3>
          <table class="input-data">
            <tr><th>Technician's Name:</th><td>${escapeHtml(technicianName)}</td></tr>
            <tr><th>Job Address:</th><td>${escapeHtml(jobAddress)}</td></tr>
            <tr><th>Invoice Number:</th><td>${escapeHtml(invoiceNumber)}</td></tr>
            <tr><th>Date:</th><td>${escapeHtml(date)}</td></tr>
            <tr><th>Project Hours:</th><td>${escapeHtml(projectHours)}</td></tr>
            <tr><th>Material Expenses:</th><td>${escapeHtml(materialExpenses)}</td></tr>
            <tr><th>Other Expenses (Base):</th><td>${escapeHtml(baseOEText)}</td></tr>
            <tr><th>Credit Card Fee (3%):</th><td>${escapeHtml(ccFeeText)}</td></tr>
            <tr><th>Other Expenses (Total):</th><td>${escapeHtml(totalOEText)}</td></tr>
            <tr><th>Total Price:</th><td>${escapeHtml(totalPrice)}</td></tr>
            <tr><th>Job Description/Notes:</th><td>${escapeHtml(notes)}</td></tr>
          </table>
        </div>

        <div class="no-break">
          <h3>QUESTIONS &amp; ANSWERS:</h3>
          <table class="input-data">
            ${additionalRow}
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
            <tr><th>Day 5</th><th>Additional Hours</th><th>Total Overtime Hours</th><th>Total Hours</th></tr>
            <tr>
              <td>${escapeHtml(day5)}</td><td>${escapeHtml(additionalHours)}</td><td>${escapeHtml(overtimeHours)}</td><td>${escapeHtml(totalHours)}</td>
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
          <h3>COMMISSION DETAILS:</h3>
          <table class="input-data">
            <tr><th>Technician Commission:</th><td>${escapeHtml(totalCommission)}</td></tr>
            ${salesCommissionRow}
          </table>
        </div>
      </div>
    </div>
  `;
}

function syncCalculatorPrintSheet() {
  const printSheet = document.getElementById("printSheet");
  if (!printSheet) return;

  printSheet.innerHTML = buildPrintSheetHTML();
  printSheet.setAttribute("aria-hidden", "false");
}

document.addEventListener("DOMContentLoaded", function () {
  if (window.__com25SAMA_gold_initialized) return;
  window.__com25SAMA_gold_initialized = true;

  applyTipBubbles();
  attachAutoSelectToAllEditables();
  restoreFormState();

  // Normalize formats on first load (required: money + hours + OE displays)
  calculateCommission();

  // Date standard (text input)
  const dateEl = document.getElementById("date");
  if (dateEl) {
    // Autofill today if empty
    if (!dateEl.value) {
      dateEl.value = formatDateLong(new Date());
    }

    selectAllOnFocus(dateEl);

    dateEl.addEventListener("blur", () => {
      const raw = String(dateEl.value || "").trim();

      if (!raw) {
        const today = new Date();
        setInlineHint(dateEl, "");
        dateEl.value = formatDateLong(today);
        return;
      }

      const d = parseFlexibleDate(raw);
      if (!d) {
        setInlineHint(dateEl, "Invalid date");
        return;
      }
      setInlineHint(dateEl, "");
      dateEl.value = formatDateLong(d);
    });
  }

  // Title Case on blur
  const tnEl = document.getElementById("tn");
  const jaEl = document.getElementById("ja");
  if (tnEl) tnEl.addEventListener("blur", () => tnEl.value = titleCase(tnEl.value));
  if (jaEl) jaEl.addEventListener("blur", () => jaEl.value = titleCase(jaEl.value));
  if (tnEl) selectAllOnFocus(tnEl);
  if (jaEl) selectAllOnFocus(jaEl);

  // Auto-select all editable inputs + format rules
  ["tp","material","oe","cashAmount"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    selectAllOnFocus(el);

    el.addEventListener("focus", () => {
    el.dataset.editing = "true";

    if (id === "oe" && addCreditFee) {
        // edit BASE only
        el.value = String(Number.isFinite(baseOtherExpense) ? baseOtherExpense : 0);
    } else {
        beginEditMoney(el); // <--- strip $ and commas while editing
    }

    // reinforce selection after we changed the value
    try { el.setSelectionRange(0, (el.value || "").length); } catch (_) {}
    });

    el.addEventListener("blur", () => {
      el.dataset.editing = "false";
      const val = formatMoneyField(el);
      if (id === "oe") {
        // Commit BASE on blur (Standard: editing changes Base only)
        baseOtherExpense = val;
      }
      calculateCommission();
    });

    // Don’t reformat on every keystroke. Just recalc.
    el.addEventListener("input", () => calculateCommission());
  });

    // Hours fields (0.5 increments only; pd min 1 hr)
  ["pd","day1","day2","day3","day4","day5","ah","toh"].forEach(id => {
    const el = document.getElementById(id);
        if (!el) return;

        selectAllOnFocus(el);

        el.addEventListener("focus", () => {
            beginEditHours(el);     // strip "hrs" while editing
            // do NOT call selectAllOnFocus here (it already attached above)
            try { el.setSelectionRange(0, (el.value || "").length); } catch (_) {}
        });

        el.addEventListener("blur", () => {
            if (id === "pd") formatHoursField(el, { min: 1 });
            else formatHoursField(el);
            calculateCommission();
        });

        el.addEventListener("input", () => calculateCommission());
    });

  // Q button system (no inline onclicks)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qa-btn");
    if (!btn) return;

    const q = parseInt(btn.getAttribute("data-q"), 10);
    const a = btn.getAttribute("data-a");
    if (!q || !a) return;

    handleAnswer(a, q);
  });

  // Assisted / Non-assisted
  const managerialButton = document.getElementById("managerialAssistanceBtn");
  if (managerialButton) {
    // Respect restored state instead of forcing non-assisted on load
    managerialButton.innerText = managerialAssistanceUsed ? "ASSISTED SALE" : "NON-ASSISTED SALE";
    managerialButton.classList.toggle("assisted", managerialAssistanceUsed);
    managerialButton.classList.toggle("non-assisted", !managerialAssistanceUsed);

    const salesLabel = document.getElementById("salesCommissionLabel");
    if (salesLabel) salesLabel.classList.toggle("is-hidden", !managerialAssistanceUsed);

    managerialButton.addEventListener("click", function (event) {
      event.preventDefault();
      managerialAssistanceUsed = !managerialAssistanceUsed;
      this.innerText = managerialAssistanceUsed ? "ASSISTED SALE" : "NON-ASSISTED SALE";
      managerialButton.classList.toggle("assisted", managerialAssistanceUsed);
      managerialButton.classList.toggle("non-assisted", !managerialAssistanceUsed);

      const salesLabel = document.getElementById("salesCommissionLabel");
      if (salesLabel) salesLabel.classList.toggle("is-hidden", !managerialAssistanceUsed);

      calculateCommission();
    });
  }

      // Calculate button
      const calcBtn = document.getElementById("calculateBtn");
        if (calcBtn) {
          calcBtn.addEventListener("click", function () {
          setButtonBusy(calcBtn, "Calculating...");
          calculateCommission();
          setTimeout(() => clearButtonBusy(calcBtn), 400);
        });
      }

        const printButton = document.getElementById("printButton");

        if (printButton) {
          printButton.addEventListener("click", function (event) {
            event.preventDefault();
            if (printButton.disabled) return;

            const msg =
              "I hereby confirm that all contents of this report are true and correct. I take full responsibility of the contents of this documents.";

            const ok = window.confirm(msg);
            if (!ok) return;

            setButtonBusy(printButton, "Preparing Print Page...");
            calculateCommission();
            saveFormState();

            sessionStorage.setItem(COM25SAMA_PRINT_PAYLOAD_KEY, buildPrintSheetHTML());
            sessionStorage.setItem(COM25SAMA_PRINT_RETURN_KEY, COM25SAMA_CALCULATOR_URL);

            setTimeout(() => {
              window.location.href = COM25SAMA_PRINT_PAGE_URL;
            }, 120);
          });
        }

        window.addEventListener("beforeprint", () => {
          calculateCommission();
          document.body.classList.add("is-printing");
        });

        window.addEventListener("afterprint", () => {
          document.body.classList.remove("is-printing");
        });
      });

/* ---------- Commission math (UNCHANGED logic, only input parsing/display fixes) ---------- */

function calculateCommission() {
  const tpEl = document.getElementById("tp");
  const materialEl = document.getElementById("material");
  const oeEl = document.getElementById("oe");

  if (!tpEl || !materialEl || !oeEl) return; // safety for future clones

  const tp = parseMoneyField(tpEl);
  const material = parseMoneyField(materialEl);

  // OE Standard: Edit BASE only
  const oeIsEditing = oeEl.dataset.editing === "true";
  const oeTyped = parseMoneyField(oeEl);

  if (baseOtherExpense === null || !Number.isFinite(baseOtherExpense)) {
    baseOtherExpense = oeTyped || 0;
  }

  const baseForCalc = oeIsEditing ? oeTyped : baseOtherExpense;

  const creditCardFee = addCreditFee ? (0.03 * tp) : 0;
  const totalOE = baseForCalc + creditCardFee;
  updateOEDisplays({ tp, baseOE: baseForCalc });

  if (!oeIsEditing) {
    // Requirement: on-screen OE field ALWAYS shows BASE only.
    oeEl.value = formatMoneyUSD(baseOtherExpense);
  }

  const day1 = parseHoursField(document.getElementById("day1"));
  const day2 = parseHoursField(document.getElementById("day2"));
  const day3 = parseHoursField(document.getElementById("day3"));
  const day4 = parseHoursField(document.getElementById("day4"));
  const day5 = parseHoursField(document.getElementById("day5"));
  const ah = parseHoursField(document.getElementById("ah"));
  const toh = parseHoursField(document.getElementById("toh"));
  const pdEl = document.getElementById("pd");
        let pd = snapHalfHour(parseHoursField(pdEl));
        if (pd < 1) pd = 1;

        // keep display consistent even if user never blurred
        if (pdEl && document.activeElement !== pdEl) {
        pdEl.value = formatHoursDisplay(pd);
    }

    // Total hours must respect 0.5 increments (even after overtime multiplier)
  const totalHoursRaw = day1 + day2 + day3 + day4 + day5 + ah + (1.5 * toh);
  const totalHours = snapHalfHour(totalHoursRaw);

  document.getElementById("totalHours").value = formatHoursDisplay(totalHours);

  const grossAmount = tp - (material * 1.2) - (totalHours * 95) - totalOE;
  const overheads = pd * 290;

  let profitPercentage = 0;
  if (tp !== 0) {
    profitPercentage = ((grossAmount - overheads) / tp) * 100;
  }

    let baseCommission = 0;

    /*
    FINAL COMMISSION RULES FOR COM25:
    1) If tp < 539 → commission = $60 flat
    2) If 539 <= tp < 540 → commission = $114.21 flat
    3) If tp >= 540 → commission = 25% of grossAmount
    4) Commission should never be negative
    5) If commission becomes negative, fallback commission =
       max($60, 5% of grossAmount)
    6) pd must never increase fallback commission
  */
  if (tp < 539) {
    baseCommission = 0.25 * grossAmount;

  } else if (tp >= 539 && tp < 540) {
    baseCommission = 134.75;

  } else {
    baseCommission = 0.25 * grossAmount;
  }

  let technicianCommission;
  const salesCommission = managerialAssistanceUsed ? (0.02 * tp) : 0;

  if (managerialAssistanceUsed) {
    technicianCommission = baseCommission - salesCommission;
    document.getElementById("salesCommission").textContent = formatMoneyUSD(salesCommission);
  } else {
    technicianCommission = baseCommission;
    document.getElementById("salesCommission").textContent = "";
  }

    if (technicianCommission < 0) {
    const fallbackGrossCommission = 0.05 * grossAmount;
    technicianCommission = Math.max(60, fallbackGrossCommission);
  }

  document.getElementById("totalCommission").textContent = formatMoneyUSD(technicianCommission);

  // BPP%: true net company profit after ALL expenses, including ACTUAL commission payout
  const totalCommissionExpense = managerialAssistanceUsed
    ? (technicianCommission + salesCommission)
    : technicianCommission;

  const finalProfit = grossAmount - overheads - totalCommissionExpense;
  const finalProfitPercentage = tp !== 0 ? (finalProfit / tp) * 100 : 0;

    let bppMessage = "";
  if (finalProfitPercentage < 10) bppMessage = "👎: JOB BUST. PLEASE SEE GM";
  else if (finalProfitPercentage <= 19.99) bppMessage = "😬: MARGINAL PROFIT";
  else if (finalProfitPercentage <= 29.99) bppMessage = "👍: GOOD WORK";
  else if (finalProfitPercentage <= 39.99) bppMessage = "😀: NICE WORK";
  else if (finalProfitPercentage <= 59.99) bppMessage = "⭐: GREAT WORK";
  else bppMessage = "🌟: EXCELLENT WORK";

  document.getElementById("bpp").value = `${finalProfitPercentage.toFixed(2)}% ${bppMessage}`;

  const sw = (tp > 0) ? (((material * 1.2) / tp) * 100) : 0;
  const swSafe = Number.isFinite(sw) ? sw : 0;
  document.getElementById("sw").value = swSafe.toFixed(2);
  document.getElementById("wh").value = swSafe.toFixed(2);
  document.getElementById("rd").value = swSafe.toFixed(2);

  syncCalculatorPrintSheet();
}