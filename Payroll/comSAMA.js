let addCreditFee = false;

let paymentReceived = "";
let paymentMethod = "";
let creditCardFeeAnswer = "";

let managerialAssistanceUsed = false;

let baseOtherExpense = null;

const COMSAMA_PRINT_PAYLOAD_KEY = "comSAMA_print_payload_v1";
const COMSAMA_PRINT_RETURN_KEY = "comSAMA_print_return_v1";
const COMSAMA_PRINT_PAGE_URL = "comSAMA-print.html";
const COMSAMA_CALCULATOR_URL = "comSAMA.html";
const COMSAMA_STATE_KEY = "comSAMA_state_v1";

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

function beginEditHours(el) {
  const n = parseHours(el.value);
  el.value = (Number.isFinite(n) ? n : 0).toString();
}

function beginEditMoney(el) {
  const n = parseMoney(el.value);
  el.value = (Number.isFinite(n) ? n : 0).toString();
}

function show(el) { if (el) el.classList.remove("is-hidden"); }
function hide(el) { if (el) el.classList.add("is-hidden"); }

function setSelectedAnswer(qNum, answer) {
  document.querySelectorAll(`.qa-btn[data-q="${qNum}"]`).forEach(b => {
    const isOn = b.getAttribute("data-a") === answer;
    b.classList.toggle("is-selected", isOn);
    b.setAttribute("aria-pressed", isOn ? "true" : "false");
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
  if (el && el.dataset && el.dataset.autoSelectAttached === "1") return;
  if (el && el.dataset) el.dataset.autoSelectAttached = "1";

  const selectNow = () => {
    try {
      const len = (el.value || "").length;
      el.setSelectionRange(0, len);
    } catch (_) {
      try { el.select(); } catch (_) {}
    }
  };

  const selectSoon = () => {
    try {
      requestAnimationFrame(() => {
        try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (_) {} }
        selectNow();
        setTimeout(selectNow, 0);
      });
    } catch (_) {}
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

function parseMoneyField(el) {
  const n = parseMoney(el.value);
  return n < 0 ? 0 : n;
}

function formatMoneyField(el) {
  const raw = parseMoney(el.value);

  if (raw < 0) {
    el.classList.add("has-error");
    setInlineHint(el, "No negatives");
    el.value = formatMoneyUSD(0);
    return 0;
  }

  el.classList.remove("has-error");
  setInlineHint(el, "");
  const n = parseMoneyField(el);
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
  let raw = parseHours(el.value);

  if (raw < 0) {
    el.classList.add("has-error");
    setInlineHint(el, "No negatives");
    el.value = formatHoursDisplay(0);
    return 0;
  }

  el.classList.remove("has-error");

  let n = snapHalfHour(raw);

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

function createStrictDate(year, monthIndex, day) {
  const d = new Date(year, monthIndex, day);
  if (
    !Number.isFinite(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function parseFlexibleDate(value) {
  const v = String(value || "").trim();
  if (!v) return null;

  if (/^\d{8}$/.test(v)) {
    const mm = parseInt(v.slice(0, 2), 10);
    const dd = parseInt(v.slice(2, 4), 10);
    const yy = parseInt(v.slice(4, 8), 10);
    return createStrictDate(yy, mm - 1, dd);
  }

  if (/^\d{6}$/.test(v)) {
    const mm = parseInt(v.slice(0, 2), 10);
    const dd = parseInt(v.slice(2, 4), 10);
    let yy = parseInt(v.slice(4, 6), 10);
    yy += 2000;
    return createStrictDate(yy, mm - 1, dd);
  }

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yy = parseInt(iso[1], 10);
    const mm = parseInt(iso[2], 10);
    const dd = parseInt(iso[3], 10);
    return createStrictDate(yy, mm - 1, dd);
  }

  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const mm = parseInt(slash[1], 10);
    const dd = parseInt(slash[2], 10);
    let yy = parseInt(slash[3], 10);
    if (yy < 100) yy += 2000;
    return createStrictDate(yy, mm - 1, dd);
  }

  return null;
}

function writeCanon() {
  const pr = document.getElementById("canon_paymentReceived");
  const pm = document.getElementById("canon_paymentMethod");
  const cf = document.getElementById("canon_creditFeeAdded");

  if (pr) {
    pr.value =
      paymentReceived === "Yes" ? "yes" :
      paymentReceived === "No" ? "no" :
      paymentReceived === "BAYSHORE ACCOUNT" ? "account" : "";
  }

  if (pm) {
    pm.value =
      paymentMethod === "Debit Card" ? "debit" :
      paymentMethod === "Cash" ? "cash" :
      paymentMethod === "Online" ? "online" :
      paymentMethod === "Credit Card" ? "creditCard" :
      paymentMethod === "Check" ? "check" : "";
  }

  if (cf) {
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

  if (qNum <= 2) {
    creditCardFeeAnswer = "";
    addCreditFee = false;

    const checkEl = document.getElementById("checkNumber");
    if (checkEl) checkEl.value = "";

    const cashEl = document.getElementById("cashAmount");
    if (cashEl) cashEl.value = "$0.00";

    clearSelectedFrom(3);

    const qc = document.getElementById("questionCheck");
    const qcash = document.getElementById("questionCash");
    const q3 = document.getElementById("question3");
    hide(qc);
    hide(qcash);
    hide(q3);
  }

  writeCanon();
}

function syncQuestionVisibility() {
  const q1 = document.getElementById("question1");
  const q2 = document.getElementById("question2");
  const q3 = document.getElementById("question3");
  const qc = document.getElementById("questionCheck");
  const qcash = document.getElementById("questionCash");

  show(q1);

  if (paymentReceived !== "Yes") {
    hide(q2);
    hide(q3);
    hide(qc);
    hide(qcash);
    return;
  }

  show(q2);

  if (!paymentMethod) {
    hide(q3);
    hide(qc);
    hide(qcash);
    return;
  }

  hide(qc);
  hide(qcash);

  if (paymentMethod === "Check") {
    show(qc);
    hide(q3);
    return;
  }

  if (paymentMethod === "Cash") {
    show(qcash);
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

function applyTipBubbles() {
  document.querySelectorAll(".tip-btn").forEach(btn => {
    const text = btn.getAttribute("data-tip") || "";
    const bubble = document.createElement("div");
    bubble.className = "tip-bubble is-hidden";
    bubble.textContent = text;
    btn.dataset.tipId = `tip_${Math.random().toString(36).slice(2)}`;
    bubble.dataset.tipFor = btn.dataset.tipId;
    btn.parentElement.appendChild(bubble);
  });

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

    allBubbles.forEach(b => b.classList.add("is-hidden"));
  }, true);
}

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

  sessionStorage.setItem(COMSAMA_STATE_KEY, JSON.stringify(data));
}

function restoreFormState() {
  const raw = sessionStorage.getItem(COMSAMA_STATE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    const form = document.getElementById("commissionForm");

    if (form) {
      form.querySelectorAll("input, select, textarea").forEach(el => {
        if (!el.id) return;
        if (!(el.id in data)) return;
        if (typeof data[el.id] === "string") el.value = data[el.id];
      });
    }

    paymentReceived = data.__paymentReceived || "";
    paymentMethod = data.__paymentMethod || "";
    creditCardFeeAnswer = data.__creditCardFeeAnswer || "";
    addCreditFee = !!data.__addCreditFee;
    managerialAssistanceUsed = !!data.__managerialAssistanceUsed;
    baseOtherExpense = (data.__baseOtherExpense == null) ? null : Number(data.__baseOtherExpense);

    const _pr = (document.getElementById("canon_paymentReceived")?.value || "").trim();
    const _pm = (document.getElementById("canon_paymentMethod")?.value || "").trim();
    const _cf = (document.getElementById("canon_creditFeeAdded")?.value || "").trim();
    if (_pr || _pm || _cf) readCanon();

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

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPrintSheetHTML() {
  const technicianName = document.getElementById("tn").value;
  const jobAddress = document.getElementById("ja").value;
  const invoiceNumber = document.getElementById("in").value;
  const date = document.getElementById("date").value;

  const projectHours = document.getElementById("pd").value;
  const materialExpenses = document.getElementById("material").value;
  const oeBase = document.getElementById("oe").value;
  const ccFee = document.getElementById("ccFee") ? document.getElementById("ccFee").value : "$0.00";
  const totalOEPrint = document.getElementById("totalOE") ? document.getElementById("totalOE").value : oeBase;
  const totalPrice = document.getElementById("tp").value;
  const notes = document.getElementById("notes").value;

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
          <tr><th>Other Expense (Base):</th><td>${escapeHtml(oeBase)}</td></tr>
          <tr><th>CC Fee (3%):</th><td>${escapeHtml(ccFee)}</td></tr>
          <tr><th>Total OE:</th><td>${escapeHtml(totalOEPrint)}</td></tr>
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
  `;
}

function syncCalculatorPrintSheet() {
  const sheet = document.getElementById("printSheet");
  if (!sheet) return;

  sheet.innerHTML = `<div id="printRoot">${buildPrintSheetHTML()}</div>`;
}

document.addEventListener("DOMContentLoaded", function () {
  if (window.__comsama_gold_initialized) return;
  window.__comsama_gold_initialized = true;

  applyTipBubbles();
  attachAutoSelectToAllEditables();
  restoreFormState();

  calculateCommission();

  window.addEventListener("beforeprint", () => {
    calculateCommission();
    syncCalculatorPrintSheet();
    document.body.classList.add("is-printing");
  });

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("is-printing");
  });

  const dateEl = document.getElementById("date");
  if (dateEl) {
    if (!dateEl.value) {
      dateEl.value = formatDateLong(new Date());
    }

    selectAllOnFocus(dateEl);

    dateEl.addEventListener("blur", () => {
      const raw = String(dateEl.value || "").trim();

      if (!raw) {
        setInlineHint(dateEl, "");
        dateEl.value = formatDateLong(new Date());
        return;
      }

      const d = parseFlexibleDate(raw);
      if (!d) {
        dateEl.classList.add("has-error");
        setInlineHint(dateEl, "Invalid date");
        return;
      }

      dateEl.classList.remove("has-error");
      setInlineHint(dateEl, "");
      dateEl.value = formatDateLong(d);
    });
  }

  const tnEl = document.getElementById("tn");
  const jaEl = document.getElementById("ja");
  if (tnEl) tnEl.addEventListener("blur", () => tnEl.value = titleCase(tnEl.value));
  if (jaEl) jaEl.addEventListener("blur", () => jaEl.value = titleCase(jaEl.value));
  if (tnEl) selectAllOnFocus(tnEl);
  if (jaEl) selectAllOnFocus(jaEl);

  const inEl = document.getElementById("in");
  const notesEl = document.getElementById("notes");
  const checkNumberEl = document.getElementById("checkNumber");

  if (inEl) selectAllOnFocus(inEl);
  if (notesEl) selectAllOnFocus(notesEl);
  if (checkNumberEl) selectAllOnFocus(checkNumberEl);

  ["tp", "material", "oe", "cashAmount"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    selectAllOnFocus(el);

    el.addEventListener("focus", () => {
      el.dataset.editing = "true";

      if (id === "oe" && addCreditFee) {
        el.value = String(Number.isFinite(baseOtherExpense) ? baseOtherExpense : 0);
      } else {
        beginEditMoney(el);
      }

      try { el.setSelectionRange(0, (el.value || "").length); } catch (_) {}
    });

    el.addEventListener("blur", () => {
      el.dataset.editing = "false";
      const val = formatMoneyField(el);
      if (id === "oe") {
        baseOtherExpense = val;
      }
      calculateCommission();
    });

    el.addEventListener("input", () => calculateCommission());
  });

  ["pd", "day1", "day2", "day3", "day4", "day5", "ah", "toh"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    selectAllOnFocus(el);

    el.addEventListener("focus", () => {
      beginEditHours(el);
      try { el.setSelectionRange(0, (el.value || "").length); } catch (_) {}
    });

    el.addEventListener("blur", () => {
      if (id === "pd") formatHoursField(el, { min: 1 });
      else formatHoursField(el);
      calculateCommission();
    });

    el.addEventListener("input", () => calculateCommission());
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".qa-btn");
    if (!btn) return;

    const q = parseInt(btn.getAttribute("data-q"), 10);
    const a = btn.getAttribute("data-a");
    if (!q || !a) return;

    handleAnswer(a, q);
  });

  const managerialButton = document.getElementById("managerialAssistanceBtn");
  if (managerialButton) {
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

      const salesLabelInner = document.getElementById("salesCommissionLabel");
      if (salesLabelInner) salesLabelInner.classList.toggle("is-hidden", !managerialAssistanceUsed);

      calculateCommission();
    });
  }

  const calcBtn = document.getElementById("calculateBtn");
  if (calcBtn) {
    calcBtn.addEventListener("click", function () {
      setButtonBusy(calcBtn, "Calculating...");
      calculateCommission();
      setTimeout(() => clearButtonBusy(calcBtn), 400);
    });
  }

  const printButton = document.getElementById("printButton");
  let printButtonUnlockTimer = null;

  if (printButton) {
    printButton.addEventListener("click", function (event) {
      event.preventDefault();
      if (printButton.disabled) return;

      const msg =
        "I hereby confirm that all contents of this report are true and correct. I take full responsibility of the contents of this documents.";

      const ok = window.confirm(msg);
      if (!ok) return;

      if (paymentReceived === "Yes" && paymentMethod === "Cash") {
        const cashEl = document.getElementById("cashAmount");
        const cash = cashEl ? parseMoneyField(cashEl) : 0;
        if (cash <= 0) {
          alert("Enter Cash Amount.");
          return;
        }
      }

      setButtonBusy(printButton, "Preparing Print Page...");
      calculateCommission();
      saveFormState();

      sessionStorage.setItem(COMSAMA_PRINT_PAYLOAD_KEY, buildPrintSheetHTML());
      sessionStorage.setItem(COMSAMA_PRINT_RETURN_KEY, COMSAMA_CALCULATOR_URL);

      if (printButtonUnlockTimer) {
        clearTimeout(printButtonUnlockTimer);
      }

      printButtonUnlockTimer = setTimeout(() => {
        clearButtonBusy(printButton);
      }, PRINT_BUTTON_LOCK_MS);

      setTimeout(() => {
        window.location.href = COMSAMA_PRINT_PAGE_URL;
      }, 120);
    });
  }

  syncQuestionVisibility();
  calculateCommission();
});

function calculateCommission() {
  const tpEl = document.getElementById("tp");
  const materialEl = document.getElementById("material");
  const oeEl = document.getElementById("oe");

  if (!tpEl || !materialEl || !oeEl) return;

  const tp = parseMoneyField(tpEl);
  const material = parseMoneyField(materialEl);

  const oeIsEditing = oeEl.dataset.editing === "true";
  const oeTyped = parseMoneyField(oeEl);

  if (baseOtherExpense === null || !Number.isFinite(baseOtherExpense)) {
    baseOtherExpense = oeTyped || 0;
  }

  const baseForCalc = oeIsEditing ? oeTyped : baseOtherExpense;

  const creditCardFee = addCreditFee ? (0.03 * tp) : 0;
  const totalOE = baseForCalc + creditCardFee;

  const ccFeeEl = document.getElementById("ccFee");
  const totalOEEl = document.getElementById("totalOE");

  if (ccFeeEl) ccFeeEl.value = formatMoneyUSD(creditCardFee);
  if (totalOEEl) totalOEEl.value = formatMoneyUSD(totalOE);

  if (!oeIsEditing) {
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

  if (pdEl && document.activeElement !== pdEl) {
    pdEl.value = formatHoursDisplay(pd);
  }

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

  if (tp < 539) {
    baseCommission = 60;
  } else if (tp >= 539 && tp < 540) {
    baseCommission = 114.21;
  } else {
    baseCommission = computeBaseCommissionByProfit(profitPercentage, grossAmount);
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

  if (technicianCommission < 60) technicianCommission = 60;

  document.getElementById("totalCommission").textContent = formatMoneyUSD(technicianCommission);

  const finalProfit = grossAmount - overheads - baseCommission;
  const finalProfitPercentage = tp !== 0 ? (finalProfit / tp) * 100 : 0;

  let bppMsg = "";
  if (finalProfitPercentage < 10) bppMsg = "👎: JOB BUST. PLEASE SEE GM";
  else if (finalProfitPercentage <= 19.99) bppMsg = "😬: MARGINAL PROFIT";
  else if (finalProfitPercentage <= 29.99) bppMsg = "👍: GOOD WORK";
  else if (finalProfitPercentage <= 39.99) bppMsg = "😀: NICE WORK";
  else if (finalProfitPercentage <= 59.99) bppMsg = "⭐: GREAT WORK";
  else bppMsg = "🌟: EXCELLENT WORK";

  const bppDisplay = `${finalProfitPercentage.toFixed(2)}% : ${bppMsg}`;
  document.getElementById("bpp").value = bppDisplay;

  const sw = (tp > 0) ? (((material * 1.2) / tp) * 100) : 0;
  const swSafe = Number.isFinite(sw) ? sw : 0;
  document.getElementById("sw").value = swSafe.toFixed(2);
  document.getElementById("wh").value = swSafe.toFixed(2);
  document.getElementById("rd").value = swSafe.toFixed(2);

  writeCanon();
  syncCalculatorPrintSheet();
}

function computeBaseCommissionByProfit(profitPercentage, grossAmount) {
  if (profitPercentage >= 25) return 0.2119 * grossAmount;
  if (profitPercentage >= 20) return 0.20 * grossAmount;
  if (profitPercentage >= 15) return 0.175 * grossAmount;
  if (profitPercentage >= 10) return 0.15 * grossAmount;
  if (profitPercentage >= 5) return 0.10 * grossAmount;
  return 0.05 * grossAmount;
}