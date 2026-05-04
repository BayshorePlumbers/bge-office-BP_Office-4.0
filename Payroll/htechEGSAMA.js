// htech.js
document.addEventListener('DOMContentLoaded', () => {
  if (window.__htechEGSAMA_gold_initialized) return;
  window.__htechEGSAMA_gold_initialized = true;

  // =========================
  // Bayshore Standard Utilities (match payrollOPS behavior)
  // =========================
  const STATE_KEY = 'bs_htechEGSAMA_state_v1';
  const HTECH_EGSAMA_PRINT_PAYLOAD_KEY = 'htechEGSAMA_print_payload_v1';
  const HTECH_EGSAMA_PRINT_RETURN_KEY = 'htechEGSAMA_print_return_v1';
  const HTECH_EGSAMA_PRINT_PAGE_URL = 'htechEGSAMA-print.html';
  const HTECH_EGSAMA_CALCULATOR_URL = 'htechEGSAMA.html';
  const PRINT_BUTTON_LOCK_MS = 2500;

  const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const longDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function setButtonBusy(button, busyText) {
    if (!button) return;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }
    button.disabled = true;
    button.classList.add('is-busy');
    button.setAttribute('aria-disabled', 'true');
    button.textContent = busyText;
  }

  function clearButtonBusy(button) {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('is-busy');
    button.setAttribute('aria-disabled', 'false');
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }

  // OE base storage (user-editable base only; CC fee never overwrites base)
  let baseOtherExpense = null;

  function updateOEDisplays() {
    const ccEl = document.getElementById('ccFeeDisplay');
    const totalEl = document.getElementById('oeTotalDisplay');
    if (!ccEl || !totalEl) return;

    const tpNum = readMoneyInput(totalPriceInput);
    const baseOE = Number.isFinite(baseOtherExpense) ? baseOtherExpense : readMoneyInput(otherExpensesInput);

    const paymentReceived = (paymentReceivedHidden.value === 'yes');
    const method = (paymentMethodHidden.value || '');
    const feeAlreadyAdded = (cardFeeAddedHidden.value === 'yes');

    const fee3pct = 0.03 * tpNum;

    let ccFeeText = formatMoney(0);
    let totalOE = baseOE;

    if (paymentReceived && method === 'CARD') {
      if (!feeAlreadyAdded) {
        ccFeeText = formatMoney(fee3pct);
        totalOE = baseOE + fee3pct;
      } else {
        ccFeeText = `Ya agregado en el precio total (3% = ${formatMoney(fee3pct)})`;
        totalOE = baseOE;
      }
    }

    ccEl.value = ccFeeText;
    totalEl.value = formatMoney(totalOE);
  }

  // Technician rates (used only as salary expense for profit calc)
  // LOCKED: Only Edvin Garcia is allowed.
  const TECH_RATES = {
    'Edvin Garcia': 35,
  };

  function showEl(el) { if (el) el.classList.remove('is-hidden'); }
  function hideEl(el) { if (el) el.classList.add('is-hidden'); }

  function populateTechnicians(selectEl) {
    if (!selectEl) return;

    // Keep existing first option if present; but we want ONLY Edvin.
    while (selectEl.options.length > 0) selectEl.remove(0);

    const opt = document.createElement('option');
    opt.value = 'Edvin Garcia';
    opt.textContent = 'Edvin Garcia';
    opt.selected = true;
    selectEl.appendChild(opt);

    // Hard lock (in case HTML changes later)
    selectEl.disabled = true;
  }

  // -------------------------
  // Field hints (class-based only)
  // -------------------------
  function ensureHintEl(input) {
    if (!input || !input.parentElement) return null;
    let hint = input.parentElement.querySelector(`.field-hint[data-for="${input.id}"]`);
    if (hint) return hint;

    hint = document.createElement('div');
    hint.className = 'field-hint';
    hint.dataset.for = input.id || '';
    hint.textContent = '';
    input.insertAdjacentElement('afterend', hint);
    return hint;
  }

  function showHint(input, msg) {
    const hint = ensureHintEl(input);
    if (!hint) return;
    hint.textContent = msg || '';
    hint.classList.add('is-visible');
    input.classList.add('has-error');
  }

  function clearHint(input) {
    const hint = ensureHintEl(input);
    if (!hint) return;
    hint.textContent = '';
    hint.classList.remove('is-visible');
    input.classList.remove('has-error');
  }

  // -------------------------
  // Select-all on edit (iPad/Safari safe)
  // -------------------------
  function selectAllOnEdit(el) {
    if (!el) return;
    if (el.hasAttribute('readonly') || el.disabled) return;
    if (el.dataset.autoSelectAttached === '1') return;
    el.dataset.autoSelectAttached = '1';

    const selectNow = () => {
      try {
        if (typeof el.setSelectionRange === 'function') {
          el.setSelectionRange(0, (el.value || '').length);
        } else if (typeof el.select === 'function') {
          el.select();
        }
      } catch (_) {
        try { el.select(); } catch (_) {}
      }
    };

    const handler = () => {
      requestAnimationFrame(() => {
        try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (_) {} }
        selectNow();
        setTimeout(selectNow, 0);
      });
    };

    el.addEventListener('focus', handler);
    el.addEventListener('click', handler);
    el.addEventListener('pointerdown', handler);
    el.addEventListener('touchstart', handler, { passive: true });
  }

  // -------------------------
  // Money (sloppy typing allowed; format on blur; no negatives)
  // -------------------------
  function parseMoneyToNumber(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(n) {
    const x = Number(n || 0);
    return moneyFormatter.format(Number.isFinite(x) ? x : 0);
  }

    function beginEditMoney(input) {
    if (!input) return;
    const n = parseMoneyToNumber(input.value);
    input.value = String(Number.isFinite(n) ? n : 0);
  }

  function wireMoneyInput(input) {
    if (!input) return;

    selectAllOnEdit(input);

    input.addEventListener('focus', () => {
      // show raw numeric text while editing
      beginEditMoney(input);
      try { input.setSelectionRange(0, (input.value || '').length); } catch (_) {}
    });

    input.addEventListener('input', () => {
      const n = parseMoneyToNumber(input.value);
      if (String(input.value).includes('-') || n < 0) showHint(input, 'No se permiten negativos');
      else clearHint(input);
    });

    input.addEventListener('blur', () => {
      const n = parseMoneyToNumber(input.value);
      if (String(input.value).includes('-') || n < 0) {
        input.value = formatMoney(0);
        showHint(input, 'No se permiten negativos');
      } else {
        input.value = formatMoney(n);
        clearHint(input);
      }
    });
  }

  // -------------------------
  // Hours (snap to 0.5; format “12.50 hrs”; no negatives; PD min 1)
  // -------------------------
  function snapHalfHour(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 2) / 2;
  }

  function parseHoursToNumber(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatHours(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x) || x <= 0) return '0.00 hrs';
    const snapped = snapHalfHour(x);
    return `${snapped.toFixed(2)} hrs`;
  }

  function beginEditHours(input) {
    if (!input) return;
    const n = parseHoursToNumber(input.value);
    input.value = String(Number.isFinite(n) ? n : 0);
  }

  function wireHoursInput(input, { isPD = false } = {}) {
    if (!input) return;

    selectAllOnEdit(input);

    input.addEventListener('focus', () => {
      // show raw numeric text while editing
      beginEditHours(input);
      try { input.setSelectionRange(0, (input.value || '').length); } catch (_) {}
    });

    input.addEventListener('input', () => {
      const n = parseHoursToNumber(input.value);
      if (String(input.value).includes('-') || n < 0) {
        showHint(input, 'No se permiten negativos');
        return;
      }
      if (isPD && n > 0 && n < 1) {
        showHint(input, 'Mínimo 1 hora');
        return;
      }
      clearHint(input);
    });

    input.addEventListener('blur', () => {
      let n = parseHoursToNumber(input.value);

      if (String(input.value).includes('-') || n < 0) {
        input.value = formatHours(0);
        showHint(input, 'No se permiten negativos');
        return;
      }

      if (isPD) {
        if (n < 1) {
          n = 1;
          showHint(input, 'Mínimo 1 hora');
        } else {
          clearHint(input);
        }
      } else {
        clearHint(input);
      }

      n = snapHalfHour(n);
      input.value = formatHours(n);
    });
  }

  // -------------------------
  // Date (text; autofill today; parse flexible en-US; format “Dec 31, 2025”)
  // -------------------------
  function todayLocalDate() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseFlexibleDateEnUS(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    // 1) Digits-only: MMDDYYYY (required support)
    if (/^\d{8}$/.test(s)) {
      const mm = Number(s.slice(0, 2));
      const dd = Number(s.slice(2, 4));
      const yy = Number(s.slice(4, 8));
      const dt = new Date(yy, mm - 1, dd);
      if (dt && dt.getFullYear() === yy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) return dt;
      return null;
    }

    // 2) Digits-only: MMDDYY (optional support)
    if (/^\d{6}$/.test(s)) {
      const mm = Number(s.slice(0, 2));
      const dd = Number(s.slice(2, 4));
      let yy = Number(s.slice(4, 6));
      yy = yy >= 70 ? 1900 + yy : 2000 + yy;
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

    if (autofillToday && !String(input.value || '').trim()) {
      input.value = longDateFormatter.format(todayLocalDate());
    }

    input.addEventListener('blur', () => {
      const dt = parseFlexibleDateEnUS(input.value);
      if (!dt) {
        showHint(input, 'Fecha inválida');
        return;
      }
      clearHint(input);
      input.value = longDateFormatter.format(dt);
    });
  }

  // -------------------------
  // Title Case (Job Address) on blur
  // -------------------------
  function titleCase(str) {
    const s = String(str ?? '').trim();
    if (!s) return '';
    return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }

  function wireTitleCase(input) {
    if (!input) return;
    selectAllOnEdit(input);
    input.addEventListener('blur', () => { input.value = titleCase(input.value); });
  }

  // -------------------------
  // Tooltips (tap-friendly modal; class-based only)
  // -------------------------
  function openTipModal(title, text) {
    const backdrop = document.createElement('div');
    backdrop.className = 'bs-tip-backdrop';

    const modal = document.createElement('div');
    modal.className = 'bs-tip-modal';

    const card = document.createElement('div');
    card.className = 'bs-tip-card';

    const h = document.createElement('div');
    h.className = 'bs-tip-title';
    h.textContent = title;

    const p = document.createElement('div');
    p.className = 'bs-tip-text';
    p.textContent = text;

    const actions = document.createElement('div');
    actions.className = 'bs-tip-actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-primary';
    closeBtn.textContent = 'Cerrar';

    actions.appendChild(closeBtn);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(actions);
    modal.appendChild(card);

    function close() {
      try { backdrop.remove(); } catch (_) {}
      try { modal.remove(); } catch (_) {}
    }

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

  const TIP_TEXT = {
    pd: { title: 'Duración del proyecto (PD)', text: 'Ingrese la duración total del proyecto en horas (mínimo 1 hora).' },
    labor: { title: 'Horas totales', text: 'Horas totales = Día1–Día5 + Adicionales + (1.5 × Horas extra).' }
  };

  document.querySelectorAll('.tip-btn[data-tip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-tip');
      const cfg = TIP_TEXT[key];
      if (!cfg) return;
      openTipModal(cfg.title, cfg.text);
    });
  });

  // =========================
  // Grab elements
  // =========================
  const jobTypeSelect = document.getElementById('jobType');

  // Company only
  const gniContainer = document.getElementById('gniContainer');
  const gniCheckbox = document.getElementById('gni');

  // Technician/Sales only
  const swgcsContainer = document.getElementById('swgcsContainer');
  const swgcsHidden = document.getElementById('swgcs');
  const swgcsYesBtn = document.getElementById('swgcsYes');
  const swgcsNoBtn = document.getElementById('swgcsNo');

  // Technician
  const technicianSelect = document.getElementById('technicianSelect');
  const techSelectHint = document.getElementById('techSelectHint');

  // Inputs
  const totalPriceInput = document.getElementById('tp');
  const dateInput = document.getElementById('date');
  const jobAddressInput = document.getElementById('ja');

  const projectDurationInput = document.getElementById('pd');
  const materialExpensesInput = document.getElementById('material');
  const otherExpensesInput = document.getElementById('oe');

  // Labor
  const totalHoursInput = document.getElementById('totalHours');

  // Payment
  const paymentReceivedHidden = document.getElementById('paymentReceived');
  const payRecYesBtn = document.getElementById('payRecYes');
  const payRecNoBtn = document.getElementById('payRecNo');

  const paymentMethodRow = document.getElementById('paymentMethodRow');
  const paymentMethodHidden = document.getElementById('paymentMethod');
  const payMethodCashBtn = document.getElementById('payMethodCash');
  const payMethodCheckBtn = document.getElementById('payMethodCheck');
  const payMethodCardBtn = document.getElementById('payMethodCard');
  const payMethodAccountsBtn = document.getElementById('payMethodAccounts');

  const cashAmountRow = document.getElementById('cashAmountRow');
  const cashAmountInput = document.getElementById('cashAmount');

  const checkNumberRow = document.getElementById('checkNumberRow');
  const checkNumberInput = document.getElementById('checkNumber');

  const cardFeeRow = document.getElementById('cardFeeRow');
  const cardFeeAddedHidden = document.getElementById('cardFeeAdded');
  const cardFeeYesBtn = document.getElementById('cardFeeYes');
  const cardFeeNoBtn = document.getElementById('cardFeeNo');

  // Office use
  const swInput = document.getElementById('sw');
  const whInput = document.getElementById('wh');
  const rdInput = document.getElementById('rd');
  const bppInput = document.getElementById('bpp');

  // Outputs + status
  const kickerSpan = document.getElementById('kicker');
  const jobStatus = document.getElementById('jobStatus');
  const jobStatusTitle = document.getElementById('jobStatusTitle');
  const jobStatusDetail = document.getElementById('jobStatusDetail');

  // Hidden fields for print/debug
  const enteredTotalPriceHidden = document.getElementById('enteredTotalPrice');
  const updatedTotalPriceHidden = document.getElementById('updatedTotalPrice');
  const commissionAmountHidden = document.getElementById('commissionAmount');
  const totalCommissionHidden = document.getElementById('totalCommission');
  const profitBeforeKickerHidden = document.getElementById('profitBeforeKicker');
  const profitAfterKickerHidden = document.getElementById('profitAfterKicker');

  const calculateBtn = document.getElementById('calculateBtn');
  const printButton = document.getElementById('printButton');
  
  const printSheet = document.getElementById("printSheet");

  // =========================
  // QA Button Selection (match payrollOPS: aria-pressed + is-selected)
  // =========================
  function setQaPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    btn.classList.toggle('is-selected', !!pressed);
  }

  function setYesNoButtons(yesBtn, noBtn, hiddenInput, newValueYesNo) {
    hiddenInput.value = newValueYesNo; // "yes" or "no"
    setQaPressed(yesBtn, newValueYesNo === 'yes');
    setQaPressed(noBtn, newValueYesNo === 'no');
  }

  function setChoiceButtons(buttons, hiddenInput, chosenValue) {
    hiddenInput.value = chosenValue;
    buttons.forEach(btn => {
      const isChosen = btn.dataset.value === chosenValue;
      setQaPressed(btn, isChosen);
    });
  }

  // =========================
  // Visibility (Bayshore dynamic questions)
  // =========================
  function updateGniVisibility() {
    if (jobTypeSelect.value === 'company') {
      showEl(gniContainer);
    } else {
      hideEl(gniContainer);
      gniCheckbox.checked = false;
    }
  }

  function updateSwgcsVisibility() {
    const shouldShow = (jobTypeSelect.value === 'technician' || jobTypeSelect.value === 'sales');
    if (shouldShow) {
      showEl(swgcsContainer);
    } else {
      hideEl(swgcsContainer);
      swgcsHidden.value = 'no';
      setQaPressed(swgcsYesBtn, false);
      setQaPressed(swgcsNoBtn, true);
    }
  }

  function updatePaymentVisibility() {
    const received = paymentReceivedHidden.value === 'yes';

    if (received) showEl(paymentMethodRow);
    else hideEl(paymentMethodRow);

    if (!received) {
      // reset dependent fields
      paymentMethodHidden.value = '';
      [payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn].forEach(b => setQaPressed(b, false));

      hideEl(cashAmountRow);
      cashAmountInput.value = formatMoney(0);
      clearHint(cashAmountInput);

      hideEl(checkNumberRow);
      checkNumberInput.value = '';

      hideEl(cardFeeRow);
      cardFeeAddedHidden.value = 'no';
      setQaPressed(cardFeeYesBtn, false);
      setQaPressed(cardFeeNoBtn, true);
    }
  }

  function updatePaymentMethodFollowups() {
    const method = paymentMethodHidden.value;

    if (method === 'CASH') showEl(cashAmountRow);
    else {
      hideEl(cashAmountRow);
      cashAmountInput.value = formatMoney(0);
      clearHint(cashAmountInput);
    }

    if (method === 'CHECK') showEl(checkNumberRow);
    else {
      hideEl(checkNumberRow);
      checkNumberInput.value = '';
    }

    if (method === 'CARD') showEl(cardFeeRow);
    else {
      hideEl(cardFeeRow);
      cardFeeAddedHidden.value = 'no';
      setQaPressed(cardFeeYesBtn, false);
      setQaPressed(cardFeeNoBtn, true);
    }
  }

  // =========================
  // Read helpers (money/hrs parsed from formatted strings)
  // =========================
  function readMoneyInput(inputEl) {
    if (!inputEl) return 0;
    return Math.max(0, parseMoneyToNumber(inputEl.value));
  }

  function readHoursInput(inputEl) {
    if (!inputEl) return 0;
    return Math.max(0, parseHoursToNumber(inputEl.value));
  }

  function getLaborValues() {
    return {
      day1: readHoursInput(document.getElementById('day1')),
      day2: readHoursInput(document.getElementById('day2')),
      day3: readHoursInput(document.getElementById('day3')),
      day4: readHoursInput(document.getElementById('day4')),
      day5: readHoursInput(document.getElementById('day5')),
      additionalHours: readHoursInput(document.getElementById('ah')),
      overtimeHours: readHoursInput(document.getElementById('toh')),
    };
  }

  // =========================
  // Core calculation (LOGIC KEPT from your htech.js)
  // =========================
  function calculateReport() {
    const enteredPrice = readMoneyInput(totalPriceInput);
    const materialExpenses = readMoneyInput(materialExpensesInput);
    const otherExpenses = readMoneyInput(otherExpensesInput);

    // Keep OE displays synced (display-only; does not change calculator math)
    updateOEDisplays();

    // PD must be >= 1 and snapped to 0.5 (enforced by input wiring too)
    const projectDuration = Math.max(1, readHoursInput(projectDurationInput));

    // totalHours = day1..day5 + AH + (1.5 * OT)
    const { day1, day2, day3, day4, day5, additionalHours, overtimeHours } = getLaborValues();
    const totalHours = day1 + day2 + day3 + day4 + day5 + additionalHours + (1.5 * overtimeHours);
    if (totalHoursInput) totalHoursInput.value = formatHours(totalHours);

    // Technician required (now locked to Edvin)
    const techName = technicianSelect ? technicianSelect.value : '';
    const techRate = (techName && TECH_RATES[techName]) ? Number(TECH_RATES[techName]) : 0;

    if (!techName || !techRate) {
      if (techSelectHint) {
        techSelectHint.textContent = 'El técnico es requerido para calcular el kicker.';
        techSelectHint.classList.add('is-visible');
      }
      kickerSpan.textContent = formatMoney(0);
      swInput.value = '';
      whInput.value = '';
      rdInput.value = '';
      bppInput.value = '';
      hideEl(jobStatus);

      enteredTotalPriceHidden.value = formatMoney(enteredPrice);
      updatedTotalPriceHidden.value = formatMoney(0);
      profitBeforeKickerHidden.value = formatMoney(0);
      profitAfterKickerHidden.value = formatMoney(0);
      commissionAmountHidden.value = formatMoney(0);
      totalCommissionHidden.value = formatMoney(0);
      saveState();
      syncCalculatorPrintSheet();
      return;
    } else if (techSelectHint) {
      techSelectHint.textContent = '';
      techSelectHint.classList.remove('is-visible');
    }

    // 1) TP_effective by job type rules
    let tpEffective = enteredPrice;

    const jobType = jobTypeSelect.value;
    const isGni = !!gniCheckbox.checked;
    const swgcs = (swgcsHidden.value || 'no');

    if (jobType === 'company') {
      if (isGni) tpEffective = tpEffective / 1.1;
    } else if (jobType === 'sales') {
      tpEffective = tpEffective * (swgcs === 'yes' ? 0.85 : 0.90);
    } else if (jobType === 'technician') {
      tpEffective = tpEffective * (swgcs === 'yes' ? 0.88 : 0.90);
    } else if (jobType === 'office') {
      tpEffective = tpEffective * 0.97;
    } else if (jobType === 'newtech') {
      tpEffective = tpEffective * 0.90;
    } else if (jobType === 'hourlytech') {
      tpEffective = tpEffective * 0.95;
    }

    // 2) card fee adjustment AFTER job type
    const paymentReceived = (paymentReceivedHidden.value === 'yes');
    const method = (paymentMethodHidden.value || '');
    const feeAlreadyAdded = (cardFeeAddedHidden.value === 'yes');

    if (paymentReceived && method === 'CARD' && !feeAlreadyAdded) {
      tpEffective = tpEffective * 0.97;
    }

    // Expenses
    const totalSalary = techRate * projectDuration;
    const laborCost = totalHours * 95;
    const overheads = projectDuration * 290;

    // Profit formula (kept)
    const profit =
      tpEffective
      - (materialExpenses * 1.2)
      - laborCost
      - otherExpenses
      - totalSalary
      - overheads
      + (materialExpenses * 1.2 * 0.1667)
      + (laborCost * 0.4);

    const profper = enteredPrice > 0 ? (profit / enteredPrice) * 100 : 0;

    // Kicker tiers based on profper; kicker dollars = tierRate * TP_effective
    let tierRate = 0;
    if (profper >= 35.01 && profper <= 39.99) tierRate = 0.015;
    else if (profper >= 40.01 && profper <= 49.99) tierRate = 0.02;
    else if (profper >= 50.01 && profper <= 59.99) tierRate = 0.025;
    else if (profper >= 60.01) tierRate = 0.03;

    const tierKicker = tierRate > 0 ? (tierRate * tpEffective) : 0;

    // 35% cap
    const maxAllowed = Math.max(0, profit - (0.35 * enteredPrice));
    const kicker = Math.min(tierKicker, maxAllowed);

    const netProfit = profit - kicker;
    const nprofper = enteredPrice > 0 ? (netProfit / enteredPrice) * 100 : 0;

    // Office-use % fields
    const matPct = enteredPrice > 0 ? (materialExpenses / enteredPrice) * 100 : 0;
    const pctText = `${matPct.toFixed(2)}%`;
    swInput.value = pctText;
    whInput.value = pctText;
    rdInput.value = pctText;

        // BPP% = percent + emoji + message (Spanish)
    const bppPct = `${nprofper.toFixed(2)}%`;

    let bppEmoji = '';
    let bppMsg = '';

    if (nprofper < 10) { bppEmoji = '👎'; bppMsg = 'TRABAJO PERDIDO. Ver al GM'; }
    else if (nprofper <= 19.99) { bppEmoji = '😬'; bppMsg = 'GANANCIA MARGINAL'; }
    else if (nprofper <= 29.99) { bppEmoji = '👍'; bppMsg = 'BUEN TRABAJO'; }
    else if (nprofper <= 39.99) { bppEmoji = '😀'; bppMsg = 'MUY BUEN TRABAJO'; }
    else if (nprofper <= 59.99) { bppEmoji = '⭐'; bppMsg = 'EXCELENTE TRABAJO'; }
    else { bppEmoji = '🌟'; bppMsg = 'TRABAJO SOBRESALIENTE'; }

    bppInput.value = `${bppPct} : ${bppEmoji} : ${bppMsg}`;

    // Print must be English-only: store an English BPP line for print
    const bppPrintEnEl = document.getElementById('bppPrintEn');
    if (bppPrintEnEl) {
      let bppMsgEn = '';
      if (nprofper < 10) bppMsgEn = 'LOST JOB. See GM';
      else if (nprofper <= 19.99) bppMsgEn = 'MARGINAL PROFIT';
      else if (nprofper <= 29.99) bppMsgEn = 'GOOD JOB';
      else if (nprofper <= 39.99) bppMsgEn = 'VERY GOOD JOB';
      else if (nprofper <= 59.99) bppMsgEn = 'EXCELLENT JOB';
      else bppMsgEn = 'OUTSTANDING JOB';

      bppPrintEnEl.value = `${nprofper.toFixed(2)}% : ${bppEmoji} : ${bppMsgEn}`;
    }

    // Output
    kickerSpan.textContent = formatMoney(kicker);

    // Status box (Spanish)
    if (nprofper < 10) {
      showEl(jobStatus);
      jobStatus.classList.add('is-bust');
      jobStatusTitle.textContent = 'Atención: Trabajo con margen bajo';
      jobStatusDetail.textContent = 'Este trabajo está por debajo del margen mínimo. Revise precio, costos y notas antes de enviar.';
    } else {
      hideEl(jobStatus);
      jobStatus.classList.remove('is-bust');
      jobStatusTitle.textContent = '';
      jobStatusDetail.textContent = '';
    }

    // Hidden fields (for print/debug)
    enteredTotalPriceHidden.value = formatMoney(enteredPrice);
    updatedTotalPriceHidden.value = formatMoney(tpEffective);
    profitBeforeKickerHidden.value = formatMoney(profit);
    profitAfterKickerHidden.value = formatMoney(netProfit);
    commissionAmountHidden.value = formatMoney(0);
    totalCommissionHidden.value = formatMoney(0);

    saveState();
    syncCalculatorPrintSheet();
  }

  // =========================
  // Wiring: inputs + dynamic buttons
  // =========================
  wireMoneyInput(totalPriceInput);
  wireMoneyInput(materialExpensesInput);

  // Base OE rule: keep base stored on blur; never overwrite base with CC fee
  if (otherExpensesInput) {
    otherExpensesInput.addEventListener('focus', () => {
      otherExpensesInput.dataset.editing = 'true';
      const n = Number.isFinite(baseOtherExpense) ? baseOtherExpense : readMoneyInput(otherExpensesInput);
      otherExpensesInput.value = String(Number.isFinite(n) ? n : 0);
      try { otherExpensesInput.setSelectionRange(0, (otherExpensesInput.value || '').length); } catch (_) {}
    });

    otherExpensesInput.addEventListener('blur', () => {
      otherExpensesInput.dataset.editing = 'false';
      const n = parseMoneyToNumber(otherExpensesInput.value);
      if (String(otherExpensesInput.value).includes('-') || n < 0) {
        baseOtherExpense = 0;
        otherExpensesInput.value = formatMoney(0);
        showHint(otherExpensesInput, 'No se permiten negativos');
      } else {
        baseOtherExpense = Number.isFinite(n) ? n : 0;
        otherExpensesInput.value = formatMoney(baseOtherExpense);
        clearHint(otherExpensesInput);
      }
      updateOEDisplays();
    });

    otherExpensesInput.addEventListener('input', () => {
      // while editing, update displays using typed base
      const typed = parseMoneyToNumber(otherExpensesInput.value);
      baseOtherExpense = (Number.isFinite(typed) ? typed : 0);
      updateOEDisplays();
    });
  }
  wireMoneyInput(cashAmountInput);

  wireHoursInput(projectDurationInput, { isPD: true });
  ['day1','day2','day3','day4','day5','ah','toh'].forEach(id => {
    wireHoursInput(document.getElementById(id), { isPD: false });
  });

  wireDateInput(dateInput, { autofillToday: true });
  wireTitleCase(jobAddressInput);

  setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, 'no');
  setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, 'no');
  setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, 'no');

  swgcsYesBtn.addEventListener('click', () => { setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, 'yes'); calculateReport(); });
  swgcsNoBtn.addEventListener('click', () => { setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, 'no'); calculateReport(); });

  payRecYesBtn.addEventListener('click', () => {
    setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, 'yes');
    updatePaymentVisibility();
    updatePaymentMethodFollowups();
    calculateReport();
    updateOEDisplays();
  });
  
  payRecNoBtn.addEventListener('click', () => {
    setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, 'no');
    updatePaymentVisibility();
    updatePaymentMethodFollowups();
    calculateReport();
    updateOEDisplays();
  });

  // Payment method buttons (keep hidden values EXACTLY: CASH/CHECK/CARD/ACCOUNTS)
  [
    [payMethodCashBtn, 'CASH'],
    [payMethodCheckBtn, 'CHECK'],
    [payMethodCardBtn, 'CARD'],
    [payMethodAccountsBtn, 'ACCOUNTS'],
  ].forEach(([btn, val]) => {
    btn.dataset.value = val;
    btn.addEventListener('click', () => {
      setChoiceButtons([payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn], paymentMethodHidden, val);
      updatePaymentMethodFollowups();
      calculateReport();
      updateOEDisplays();
    });
  });

  cardFeeYesBtn.addEventListener('click', () => { setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, 'yes'); calculateReport(); updateOEDisplays(); });
  cardFeeNoBtn.addEventListener('click', () => { setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, 'no'); calculateReport(); updateOEDisplays(); });

  [gniCheckbox, jobTypeSelect].forEach(el => el.addEventListener('change', () => {
    updateGniVisibility();
    updateSwgcsVisibility();
    calculateReport();
    updateOEDisplays();
  }));

  // Lock technician selection defensively
  if (technicianSelect) {
    technicianSelect.value = 'Edvin Garcia';
    technicianSelect.disabled = true;
  }

  let saveTimer = null;
  function saveStateDebounced() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 150);
  }

  document.querySelectorAll('input, textarea, select').forEach(input => {
    if (input.type !== 'hidden') {
      input.addEventListener('input', () => { saveStateDebounced(); calculateReport(); });
      input.addEventListener('change', () => { saveStateDebounced(); calculateReport(); });
    }
    if (!input.hasAttribute('readonly')) selectAllOnEdit(input);
  });

  // Init
  populateTechnicians(technicianSelect);

  updateGniVisibility();
  updateSwgcsVisibility();
  updatePaymentVisibility();
  updatePaymentMethodFollowups();

  // =========================
  // State restore (best-effort)
  // =========================
  function saveState() {
    try {
      const data = {};
      document.querySelectorAll('input, textarea, select').forEach(el => {
        if (!el.id) return;
        if (el.type === 'checkbox') data[el.id] = !!el.checked;
        else data[el.id] = el.value;
      });
      sessionStorage.setItem(STATE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function restoreState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      Object.keys(data || {}).forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // Never allow technician to be restored to anything else
        if (id === 'technicianSelect') return;

        if (el.type === 'checkbox') el.checked = !!data[id];
        else el.value = data[id];
      });

      setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, swgcsHidden.value === 'yes' ? 'yes' : 'no');
      setYesNoButtons(payRecYesBtn, payRecNoBtn, paymentReceivedHidden, paymentReceivedHidden.value === 'yes' ? 'yes' : 'no');
      setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, cardFeeAddedHidden.value === 'yes' ? 'yes' : 'no');

      // Keep payment method dataset values fixed (never derive from UI text)
      payMethodCashBtn.dataset.value = 'CASH';
      payMethodCheckBtn.dataset.value = 'CHECK';
      payMethodCardBtn.dataset.value = 'CARD';
      payMethodAccountsBtn.dataset.value = 'ACCOUNTS';

      const method = paymentMethodHidden.value || '';
      setChoiceButtons([payMethodCashBtn, payMethodCheckBtn, payMethodCardBtn, payMethodAccountsBtn], paymentMethodHidden, method);

      updateGniVisibility();
      updateSwgcsVisibility();
      updatePaymentVisibility();
      updatePaymentMethodFollowups();

      // Re-lock technician
      if (technicianSelect) {
        technicianSelect.value = 'Edvin Garcia';
        technicianSelect.disabled = true;
      }
    } catch (_) {}
  }

  restoreState();

  [totalPriceInput, materialExpensesInput, otherExpensesInput, cashAmountInput].forEach(inp => {
    if (!inp) return;
    if (!String(inp.value || '').trim()) inp.value = formatMoney(0);
  });

  ['pd','day1','day2','day3','day4','day5','ah','toh'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!String(el.value || '').trim()) el.value = (id === 'pd') ? '1.00 hrs' : '0.00 hrs';
  });

  if (dateInput && !String(dateInput.value || '').trim()) {
    dateInput.value = longDateFormatter.format(todayLocalDate());
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  
  function syncCalculatorPrintSheet() {
    if (!printSheet) return;
    printSheet.innerHTML = `<div id="printRoot">${buildPrintSheetHTML()}</div>`;
    printSheet.classList.add('is-hidden');
    printSheet.setAttribute('aria-hidden', 'true');
  }

  calculateReport();

  window.addEventListener('beforeprint', () => {
    calculateReport();
    syncCalculatorPrintSheet();
    if (printSheet) {
      printSheet.classList.remove('is-hidden');
      printSheet.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('is-printing');
  });

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('is-printing');
    if (printSheet) {
      printSheet.classList.add('is-hidden');
      printSheet.setAttribute('aria-hidden', 'true');
    }
  });

  if (calculateBtn) {
    calculateBtn.addEventListener('click', () => {
      if (calculateBtn.disabled) return;
      setButtonBusy(calculateBtn, 'Calculando...');
      calculateReport();
      setTimeout(() => clearButtonBusy(calculateBtn), 400);
    });
  }

  if (printButton) {
    printButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (printButton.disabled) return;

      const ok = window.confirm(
        'CONFIRMO QUE TODA LA INFORMACIÓN INGRESADA ES CORRECTA Y ASUMO TODA LA RESPONSABILIDAD DE ESTE DOCUMENTO.'
      );
      if (!ok) return;

      setButtonBusy(printButton, 'Preparando impresión...');
      calculateReport();
      syncCalculatorPrintSheet();

      sessionStorage.setItem(HTECH_EGSAMA_PRINT_PAYLOAD_KEY, buildPrintSheetHTML());
      sessionStorage.setItem(HTECH_EGSAMA_PRINT_RETURN_KEY, HTECH_EGSAMA_CALCULATOR_URL);

      setTimeout(() => {
        window.location.href = HTECH_EGSAMA_PRINT_PAGE_URL;
      }, 120);

      setTimeout(() => {
        clearButtonBusy(printButton);
      }, PRINT_BUTTON_LOCK_MS);
    });
  }

  // NOTE: buildPrintSheetHTML left exactly as your original (English print)
  function buildPrintSheetHTML() {

    const JOB_TYPE_LABEL_EN = {
        company: "Company Job",
        office: "Office (Ali / Karen)",
        technician: "Technician (Eddie / Solis)",
        sales: "Sales (Bo)",
        newtech: "New Technician (Omar / Rafael)",
        hourlytech: "Hourly Technician",
    };

    const jobTypeText = JOB_TYPE_LABEL_EN[jobTypeSelect.value] || "";

    const getVal = (id) => document.getElementById(id)?.value ?? "";

    const paymentReceivedText = (paymentReceivedHidden.value === "yes") ? "Yes" : "No";

    const PAYMENT_METHOD_LABEL_EN = {
      CASH: "Cash",
      CHECK: "Check",
      CARD: "Card",
      ACCOUNTS: "Accounts",
    };

    const paymentMethodCode = (paymentReceivedHidden.value === "yes") ? (paymentMethodHidden.value || "") : "";
    const paymentMethodText = paymentMethodCode ? (PAYMENT_METHOD_LABEL_EN[paymentMethodCode] || paymentMethodCode) : "";

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
    const bpp = getVal("bppPrintEn") || getVal("bpp");

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
      <div class="print-header">
        <img src="BP.png" alt="BP logo" class="logo">
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
              <tr><th>Card Fee (3%):</th><td>${escapeHtml(cardFeeText || getVal("ccFeeDisplay"))}</td></tr>
              <tr><th>Other Expenses (Total):</th><td>${escapeHtml(getVal("oeTotalDisplay"))}</td></tr>

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
    `;
  }
});
