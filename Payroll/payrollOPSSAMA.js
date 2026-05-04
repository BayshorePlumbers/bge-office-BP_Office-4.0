document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // Bayshore Standard Utilities (HOURLY behavior)
  // =========================
  const STATE_KEY = 'payrollOPSSAMA_state_v1';
  const OPS_SAMA_PRINT_PAYLOAD_KEY = 'payrollOPSSAMA_print_payload_v1';
  const OPS_SAMA_PRINT_RETURN_KEY = 'payrollOPSSAMA_print_return_v1';
  const OPS_SAMA_PRINT_PAGE_URL = 'payrollOPSSAMA-print.html';
  const OPS_SAMA_CALCULATOR_URL = 'payrollOPSSAMA.html';

  const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const longDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  function showEl(el) { if (el) el.classList.remove('is-hidden'); }
  function hideEl(el) { if (el) el.classList.add('is-hidden'); }

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

  function ensureHintEl(input) {
    if (!input || !input.parentElement) return null;

    const id = `hint-${input.id || Math.random().toString(16).slice(2)}`;
    let hint = input.parentElement.querySelector(`.field-hint[data-for="${input.id}"]`);
    if (hint) return hint;

    hint = document.createElement('div');
    hint.className = 'field-hint';
    hint.dataset.for = input.id || '';
    hint.id = id;
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

  function selectAllOnEdit(el) {
    if (!el) return;
    if (el.hasAttribute('readonly') || el.disabled) return;
    if (el.dataset.autoSelectAttached === '1') return;
    el.dataset.autoSelectAttached = '1';

    const selectNow = () => {
      try {
        const len = (el.value || '').length;
        if (typeof el.setSelectionRange === 'function') {
          el.setSelectionRange(0, len);
        } else if (typeof el.select === 'function') {
          el.select();
        }
      } catch (_) {
        try { if (typeof el.select === 'function') el.select(); } catch (_) {}
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
    el.addEventListener('pointerup', handler);
    el.addEventListener('touchstart', handler, { passive: true });
  }

  // Money: allow sloppy typing; format on blur; no negatives
  function parseMoneyToNumber(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return 0;

    // Keep digits, dot, minus
    const cleaned = s.replace(/[^0-9.\-]/g, '');
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
    if (input.dataset.moneyWired === '1') return;
    input.dataset.moneyWired = '1';

    selectAllOnEdit(input);

    input.addEventListener('focus', () => {
      const n = parseMoneyToNumber(input.value);
      input.value = String(Number.isFinite(n) ? n : 0);
      try { input.setSelectionRange(0, (input.value || '').length); } catch (_) {}
    });

    input.addEventListener('input', () => {
      const n = parseMoneyToNumber(input.value);
      if (String(input.value).includes('-') || n < 0) {
        showHint(input, 'No negatives');
      } else {
        clearHint(input);
      }
    });

    input.addEventListener('blur', () => {
      const n = parseMoneyToNumber(input.value);
      if (String(input.value).includes('-') || n < 0) {
        input.value = formatMoney(0);
        showHint(input, 'No negatives');
      } else {
        input.value = formatMoney(n);
        clearHint(input);
      }
    });
  }

  // Hours: text input; snap to 0.5; format "12.5 hrs"; no negatives
  function snapHalfHour(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 2) / 2;
  }

  function formatHours(n) {
    const x = Number(n || 0);
    if (!Number.isFinite(x) || x <= 0) return '0.00 hrs';
    const snapped = snapHalfHour(x);
    return `${snapped.toFixed(2)} hrs`;
  }

  function parseHoursToNumber(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function wireHoursInput(input, { isPD = false } = {}) {
    if (!input) return;
    if (input.dataset.hoursWired === '1') return;
    input.dataset.hoursWired = '1';

    selectAllOnEdit(input);

    input.addEventListener('focus', () => {
      const n = parseHoursToNumber(input.value);
      input.value = String(Number.isFinite(n) ? n : 0);
      try { input.setSelectionRange(0, (input.value || '').length); } catch (_) {}
    });

    input.addEventListener('input', () => {
      const n = parseHoursToNumber(input.value);
      if (String(input.value).includes('-') || n < 0) {
        showHint(input, 'No negatives');
        return;
      }
      if (isPD && n > 0 && n < 1) {
        showHint(input, 'Min 1 hr');
        return;
      }
      clearHint(input);
    });

    input.addEventListener('blur', () => {
      let n = parseHoursToNumber(input.value);

      if (String(input.value).includes('-') || n < 0) {
        input.value = formatHours(0);
        showHint(input, 'No negatives');
        return;
      }

      if (isPD) {
        if (n <= 0 || n < 1) {
          n = 1;
          showHint(input, 'Min 1 hr');
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

  // Date: text input; autofill today (main date only); parse en-US; format "Dec 31, 2025"
  function todayLocalDate() {
    const d = new Date();
    // normalize to local midnight for stable formatting
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseFlexibleDateEnUS(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    const digits8 = s.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (digits8) {
      const mm = Number(digits8[1]);
      const dd = Number(digits8[2]);
      const yy = Number(digits8[3]);
      const dt = new Date(yy, mm - 1, dd);
      if (dt && dt.getFullYear() === yy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) return dt;
      return null;
    }

    const digits6 = s.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (digits6) {
      const mm = Number(digits6[1]);
      const dd = Number(digits6[2]);
      let yy = Number(digits6[3]);
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

    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
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
      const t = todayLocalDate();
      input.value = longDateFormatter.format(t);
    }

    input.addEventListener('blur', () => {
      const dt = parseFlexibleDateEnUS(input.value);
      if (!dt) {
        showHint(input, 'Invalid date');
        return;
      }
      clearHint(input);
      input.value = longDateFormatter.format(dt);
    });
  }

  // Title Case (Job Address) on blur
  function titleCase(str) {
    const s = String(str ?? '').trim();
    if (!s) return '';
    return s
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase());
  }

  function wireTitleCase(input) {
    if (!input) return;
    selectAllOnEdit(input);
    input.addEventListener('blur', () => {
      input.value = titleCase(input.value);
    });
  }

  // Tooltips (tap-friendly modal; class-based only)
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
    closeBtn.textContent = 'Close';

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
    pd: {
      title: 'Project Duration (PD)',
      text: 'Enter the total project duration in hours.'
    },
    labor: {
      title: 'Estimated ManHours',
      text: 'Man-hours (labor time).'
    }
  };

  // =========================
  // Grab elements
  // =========================
  const projectDurationInput = document.getElementById('pd');
  const totalPriceInput = document.getElementById('tp');
  const materialExpensesInput = document.getElementById('material');
  const otherExpensesInput = document.getElementById('oe');
  const calculateBtn = document.getElementById('calculateBtn');
  const printButton = document.getElementById('printButton');
  const bppField = document.getElementById('bpp');

  const jobStatus = document.getElementById('jobStatus');
  const jobStatusTitle = document.getElementById('jobStatusTitle');
  const jobStatusDetail = document.getElementById('jobStatusDetail');

  const jobTypeSelect = document.getElementById('jobType');

  // GNI UI (Company only)
  const gniContainer = document.getElementById('gniContainer');
  const gniCheckbox  = document.getElementById('gni');

  // S/W/G/CS UI (Technician + Sales only)
  const swgcsContainer = document.getElementById('swgcsContainer');
  const swgcsHidden = document.getElementById('swgcs'); // "yes" / "no" (default no)
  const swgcsYesBtn = document.getElementById('swgcsYes');
  const swgcsNoBtn  = document.getElementById('swgcsNo');

  // Payment UI
  const paymentReceivedHidden = document.getElementById('paymentReceived'); // "yes" / "no"
  const payRecYesBtn = document.getElementById('payRecYes');
  const payRecNoBtn  = document.getElementById('payRecNo');
  const payRecAccountBtn = document.getElementById('payRecAccount');

  const paymentMethodRow = document.getElementById('paymentMethodRow');
  const paymentMethodHidden = document.getElementById('paymentMethod'); // DEBIT/CASH/ONLINE/CARD/CHECK/""
  const payMethodDebitBtn = document.getElementById('payMethodDebit');
  const payMethodCashBtn = document.getElementById('payMethodCash');
  const payMethodOnlineBtn = document.getElementById('payMethodOnline');
  const payMethodCheckBtn = document.getElementById('payMethodCheck');
  const payMethodCardBtn = document.getElementById('payMethodCard');

  const cashAmountRow = document.getElementById('cashAmountRow');
  const cashAmountInput = document.getElementById('cashAmount');

  const checkNumberRow = document.getElementById('checkNumberRow');
  const checkNumberInput = document.getElementById('checkNumber');

  const cardFeeRow = document.getElementById('cardFeeRow');
  const cardFeeAddedHidden = document.getElementById('cardFeeAdded'); // "yes" / "no"
  const cardFeeYesBtn = document.getElementById('cardFeeYes');
  const cardFeeNoBtn  = document.getElementById('cardFeeNo');

  // On-screen output
  const kickerSpan = document.getElementById('kicker');

  // Hidden internal values (for print)
  const enteredTotalPriceHidden = document.getElementById('enteredTotalPrice');
  const updatedTotalPriceHidden = document.getElementById('updatedTotalPrice');
  const commissionAmountHidden = document.getElementById('commissionAmount');
  const totalCommissionHidden = document.getElementById('totalCommission');
  const profitBeforeKickerHidden = document.getElementById('profitBeforeKicker');
  const profitAfterKickerHidden = document.getElementById('profitAfterKicker');

  // =========================
  // QA Button Selection (HOURLY: blue highlight)
  // =========================
  function setQaPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    btn.classList.toggle('is-selected', !!pressed);
    // Remove legacy color classes if they exist
    btn.classList.remove('assisted', 'non-assisted');
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
  // Money + Hours + Date + TitleCase wiring (HOURLY)
  // =========================
  wireMoneyInput(totalPriceInput);
  wireMoneyInput(materialExpensesInput);
  wireMoneyInput(otherExpensesInput);
  wireMoneyInput(cashAmountInput);

  wireHoursInput(projectDurationInput, { isPD: true });
  ['day1','day2','day3','day4','day5','ah','toh'].forEach(id => {
    wireHoursInput(document.getElementById(id), { isPD: false });
  });

  const dateInput = document.getElementById('date');
  wireDateInput(dateInput, { autofillToday: true });

  const jobAddressInput = document.getElementById('ja');
  wireTitleCase(jobAddressInput);

  // Tooltips
  document.querySelectorAll('.tip-btn[data-tip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-tip');
      const cfg = TIP_TEXT[key];
      if (!cfg) return;
      openTipModal(cfg.title, cfg.text);
    });
  });

  // =========================
  // Labor multi-select + notes (Day 1-5 + AH)
  // =========================
  function normalizeWhitespace(s) {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function parseLaborEntries(raw) {
    // Format: "Name::Note||Name::Note"
    const text = String(raw ?? '').trim();
    if (!text) return [];
    return text.split('||').map(part => {
      const [name, note] = part.split('::');
      return {
        name: normalizeWhitespace(name),
        note: normalizeWhitespace(note)
      };
    }).filter(x => x.name.length > 0);
  }

  function serializeLaborEntries(entries) {
    return entries
      .map(e => `${normalizeWhitespace(e.name)}::${normalizeWhitespace(e.note)}`)
      .join('||');
  }

  function laborIds(day) {
    const isAh = String(day) === 'ah';
    return {
      hiddenId: isAh ? 'ahNames' : `day${day}Names`,
      listId: isAh ? 'ahLaborList' : `day${day}LaborList`,
      nameInputId: isAh ? 'ahNameInput' : `day${day}NameInput`,
      noteInputId: isAh ? 'ahNoteInput' : `day${day}NoteInput`
    };
  }

  function renderLaborList(day) {
    const ids = laborIds(day);
    const hidden = document.getElementById(ids.hiddenId);
    const listDiv = document.getElementById(ids.listId);
    if (!hidden || !listDiv) return;

    const entries = parseLaborEntries(hidden.value);

    if (entries.length === 0) {
      listDiv.innerHTML = `<div class="labor-empty">No labor added</div>`;
      return;
    }

    listDiv.innerHTML = entries.map((e, idx) => {
      const safeName = escapeHtml(e.name);
      const safeNote = escapeHtml(e.note);
      return `
        <div class="labor-item">
          <div class="labor-item-main">
            <span class="labor-item-name">${safeName}</span>
            ${e.note ? `<span class="labor-item-note"> — ${safeNote}</span>` : ``}
          </div>
          <button type="button" class="dynamic-button labor-remove-btn" data-day="${day}" data-index="${idx}">REMOVE</button>
        </div>
      `;
    }).join('');
  }

  function addLaborEntry(day, name, note) {
    const ids = laborIds(day);
    const hidden = document.getElementById(ids.hiddenId);
    if (!hidden) return;

    const n = normalizeWhitespace(name);
    const t = normalizeWhitespace(note);
    if (!n) return;

    const entries = parseLaborEntries(hidden.value);

    const exists = entries.some(e => e.name.toLowerCase() === n.toLowerCase() && e.note.toLowerCase() === t.toLowerCase());
    if (!exists) {
      entries.push({ name: n, note: t });
      hidden.value = serializeLaborEntries(entries);
    }

    renderLaborList(day);
  }

  function removeLaborEntry(day, index) {
    const ids = laborIds(day);
    const hidden = document.getElementById(ids.hiddenId);
    if (!hidden) return;

    const entries = parseLaborEntries(hidden.value);
    if (index < 0 || index >= entries.length) return;

    entries.splice(index, 1);
    hidden.value = serializeLaborEntries(entries);
    renderLaborList(day);
  }

  function wireLaborUI() {
    if (document.body.dataset.laborUiWired === '1') {
      [1, 2, 3, 4, 5, 'ah'].forEach(day => renderLaborList(day));
      return;
    }
    document.body.dataset.laborUiWired = '1';

    [1, 2, 3, 4, 5, 'ah'].forEach(day => renderLaborList(day));

    document.querySelectorAll('.labor-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.day;
        const ids = laborIds(day);
        const nameInput = document.getElementById(ids.nameInputId);
        const noteInput = document.getElementById(ids.noteInputId);
        if (!nameInput) return;

        addLaborEntry(day, nameInput.value, noteInput?.value || '');
        nameInput.value = '';
        if (noteInput) noteInput.value = '';
        nameInput.focus();

        saveState();
        calculateReport();
      });
    });

    [1, 2, 3, 4, 5, 'ah'].forEach(day => {
      const ids = laborIds(day);
      const nameInput = document.getElementById(ids.nameInputId);
      const noteInput = document.getElementById(ids.noteInputId);

      [nameInput, noteInput].forEach(el => {
        if (!el) return;
        selectAllOnEdit(el);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const n = nameInput?.value || '';
            const t = noteInput?.value || '';
            addLaborEntry(day, n, t);
            if (nameInput) nameInput.value = '';
            if (noteInput) noteInput.value = '';
            if (nameInput) nameInput.focus();
            saveState();
            calculateReport();
          }
        });
      });
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.labor-remove-btn');
      if (!btn) return;
      const day = btn.dataset.day;
      const index = Number(btn.dataset.index);
      removeLaborEntry(day, index);
      saveState();
      calculateReport();
    });
  }

  // =========================
  // Dynamic visibility (questions)
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
      paymentMethodHidden.value = '';
      [payMethodDebitBtn, payMethodCashBtn, payMethodOnlineBtn, payMethodCheckBtn, payMethodCardBtn].forEach(b => setQaPressed(b, false));

      hideEl(cashAmountRow);
      cashAmountInput.value = formatMoney(0);
      clearHint(cashAmountInput);

      hideEl(checkNumberRow);
      checkNumberInput.value = '';

      hideEl(cardFeeRow);
      cardFeeAddedHidden.value = 'yes';
      setQaPressed(cardFeeYesBtn, true);
      setQaPressed(cardFeeNoBtn, false);
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
      cardFeeAddedHidden.value = 'yes';
      setQaPressed(cardFeeYesBtn, true);
      setQaPressed(cardFeeNoBtn, false);
    }
  }

  // =========================
  // Reading values (critical: money strings must be parsed)
  // =========================
  function readMoneyInput(inputEl) {
    if (!inputEl) return 0;
    return Math.max(0, parseMoneyToNumber(inputEl.value));
  }

  function readHoursInput(inputEl) {
    if (!inputEl) return 0;
    return Math.max(0, parseHoursToNumber(inputEl.value));
  }

  function money2(n) {
    const x = Number(n || 0);
    return x.toFixed(2);
  }

  // =========================
  // Existing helper: retrieve labor input values
  // =========================
  const getLaborValues = () => {
    return {
      day1: snapHalfHour(readHoursInput(document.getElementById('day1'))),
      day2: snapHalfHour(readHoursInput(document.getElementById('day2'))),
      day3: snapHalfHour(readHoursInput(document.getElementById('day3'))),
      day4: snapHalfHour(readHoursInput(document.getElementById('day4'))),
      day5: snapHalfHour(readHoursInput(document.getElementById('day5'))),
      additionalHours: snapHalfHour(readHoursInput(document.getElementById('ah'))),
      overtimeHours: snapHalfHour(readHoursInput(document.getElementById('toh')))
    };
  };

  // =========================
  // Core calculation (LOGIC UNCHANGED)
  // =========================
  function computeUpdatedPriceAndCommission(effectiveEnteredPrice) {
    const jobType = jobTypeSelect.value;
    const isSwgcs = (swgcsHidden.value === 'yes');

    let updatedTotal = effectiveEnteredPrice;
    let commission = 0;

    if (jobType === 'company') {
      if (gniCheckbox.checked) {
        updatedTotal = effectiveEnteredPrice / 1.1;
        commission = effectiveEnteredPrice - updatedTotal;
      } else {
        updatedTotal = effectiveEnteredPrice;
        commission = 0;
      }
    } else if (jobType === 'office') {
      commission = 0.03 * effectiveEnteredPrice;
      updatedTotal = effectiveEnteredPrice - commission;
    } else if (jobType === 'technician') {
      const rate = isSwgcs ? 0.12 : 0.10;
      commission = rate * effectiveEnteredPrice;
      updatedTotal = effectiveEnteredPrice - commission;
    } else if (jobType === 'sales') {
      const rate = isSwgcs ? 0.15 : 0.10;
      commission = rate * effectiveEnteredPrice;
      updatedTotal = effectiveEnteredPrice - commission;
    } else if (jobType === 'newtech') {
      const rate = 0.10;
      commission = rate * effectiveEnteredPrice;
      updatedTotal = effectiveEnteredPrice - commission;
    }

    return { updatedTotal, commission };
  }

  function calculateReport() {
    const enteredPrice = readMoneyInput(totalPriceInput);
    const materialExpenses = readMoneyInput(materialExpensesInput);
    const otherExpenses = readMoneyInput(otherExpensesInput);

    // PD: enforce Bayshore minimum even if user calculates before blur
    const projectDuration = Math.max(1, snapHalfHour(readHoursInput(projectDurationInput)));
    if (projectDurationInput && document.activeElement !== projectDurationInput) {
      projectDurationInput.value = formatHours(projectDuration);
    }

    const { day1, day2, day3, day4, day5, additionalHours, overtimeHours } = getLaborValues();
    const totalHoursRaw = day1 + day2 + day3 + day4 + day5 + additionalHours + (1.5 * overtimeHours);
    const totalHours = snapHalfHour(totalHoursRaw);

    const totalHoursEl = document.getElementById('totalHours');
    if (totalHoursEl) totalHoursEl.value = formatHours(totalHours);

    // CARD fee adjustment (only if payment received + method CARD + fee NOT already added)
    let effectiveEnteredPrice = enteredPrice;

    // Hourly Technician Job: always reduce entered price by 5% for all calculations
    if (jobTypeSelect.value === 'hourlytech') {
      effectiveEnteredPrice = effectiveEnteredPrice * 0.95;
    }

    const paymentReceived = (paymentReceivedHidden.value === 'yes');
    const paymentMethod = paymentMethodHidden.value;
    const cardFeeAdded = (cardFeeAddedHidden.value === 'yes');

    if (paymentReceived && paymentMethod === 'CARD' && !cardFeeAdded) {
      // Apply 3% reduction AFTER any hourlytech reduction (precedence requirement)
      effectiveEnteredPrice = effectiveEnteredPrice * 0.97;
    }

    // Job type commission system (uses effectiveEnteredPrice)
    const { updatedTotal, commission } = computeUpdatedPriceAndCommission(effectiveEnteredPrice);

    const updatedTotalAfterTips = Math.max(0, updatedTotal);
    const totalCommission = commission;

    // Updated cost rules
    const laborCost = totalHours * 95;
    const overheads = projectDuration * 290;

    // Profit before kicker must subtract: materials, labor, overhead, other, commissions, tips
    // Material cost rule kept as existing: material * 1.2
    const profitBeforeKicker = updatedTotalAfterTips
      - (materialExpenses * 1.2)
      - laborCost
      - otherExpenses
      - overheads
      - commission;

    const initialBpp = updatedTotalAfterTips !== 0
      ? ((profitBeforeKicker / updatedTotalAfterTips) * 100)
      : 0;

    // JOB BUST (keep) — class-based (no inline styles)
    if (initialBpp < 10) {
      showEl(jobStatus);
      jobStatus.classList.add('is-bust');
      jobStatusTitle.textContent = 'Attention Required: Low Margin Job';
      jobStatusDetail.textContent = 'This job is below the minimum margin threshold. Please review pricing, costs, and notes before submitting.';
    } else {
      hideEl(jobStatus);
      jobStatus.classList.remove('is-bust');
      jobStatusTitle.textContent = '';
      jobStatusDetail.textContent = '';
    }

    // Kicker schedule (tiers) + cap so final BPP never below 35%
    let computedKicker = 0;
    if (initialBpp >= 35.01 && initialBpp <= 39.99) {
      computedKicker = 0.010 * updatedTotalAfterTips;
    } else if (initialBpp >= 40.01 && initialBpp <= 49.99) {
      computedKicker = 0.015 * updatedTotalAfterTips;
    } else if (initialBpp >= 50.01 && initialBpp <= 59.99) {
      computedKicker = 0.020 * updatedTotalAfterTips;
    } else if (initialBpp >= 60.01) {
      computedKicker = 0.025 * updatedTotalAfterTips;
    }

    // Only pay kicker if BPP > 35%
    let kicker = 0;
    if (initialBpp > 35) {
      const allowedKicker = Math.max(0, profitBeforeKicker - (0.35 * updatedTotalAfterTips));
      kicker = Math.min(computedKicker, allowedKicker);
    }

    const profitAfterKicker = profitBeforeKicker - kicker;
    const finalBpp = updatedTotalAfterTips !== 0
      ? ((profitAfterKicker / updatedTotalAfterTips) * 100)
      : 0;

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

    // Display BPP% (Bayshore Standard: percent + emoji + message)
    bppField.value = formatBppValue(finalBpp);

    // SW/WH/RD percentages (same as existing, but use UPDATED total as base)
    const sw = updatedTotalAfterTips !== 0 ? ((materialExpenses * 1.2) / updatedTotalAfterTips) * 100 : 0;
    document.getElementById('sw').value = sw.toFixed(2);
    document.getElementById('wh').value = sw.toFixed(2);
    document.getElementById('rd').value = sw.toFixed(2);

    // On-screen output rules: only show Kicker
    kickerSpan.textContent = formatMoney(kicker);

    // Store internal values for printing (now currency formatted like HOURLY)
    if (enteredTotalPriceHidden) enteredTotalPriceHidden.value = formatMoney(enteredPrice);
    if (updatedTotalPriceHidden) updatedTotalPriceHidden.value = formatMoney(updatedTotalAfterTips);
    if (commissionAmountHidden) commissionAmountHidden.value = formatMoney(commission);
    if (totalCommissionHidden) totalCommissionHidden.value = formatMoney(totalCommission);
    if (profitBeforeKickerHidden) profitBeforeKickerHidden.value = formatMoney(profitBeforeKicker);
    if (profitAfterKickerHidden) profitAfterKickerHidden.value = formatMoney(profitAfterKicker);

    syncCalculatorPrintSheet();
  }

  // =========================
  // Wire up dynamic question buttons (defaults)
  // =========================
  setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, 'no');
  setQaPressed(payRecYesBtn, false);
  setQaPressed(payRecNoBtn, true);
  setQaPressed(payRecAccountBtn, false);
  paymentReceivedHidden.value = 'no';
  setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, 'yes');

  // S/W/G/CS
  swgcsYesBtn.addEventListener('click', () => { setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, 'yes'); saveState(); calculateReport(); });
  swgcsNoBtn.addEventListener('click', () => { setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, 'no'); saveState(); calculateReport(); });

  // Payment Received
  payRecYesBtn.addEventListener('click', () => {
    paymentReceivedHidden.value = 'yes';
    setQaPressed(payRecYesBtn, true);
    setQaPressed(payRecNoBtn, false);
    setQaPressed(payRecAccountBtn, false);
    updatePaymentVisibility();
    updatePaymentMethodFollowups();
    saveState();
    calculateReport();
  });
  payRecNoBtn.addEventListener('click', () => {
    paymentReceivedHidden.value = 'no';
    setQaPressed(payRecYesBtn, false);
    setQaPressed(payRecNoBtn, true);
    setQaPressed(payRecAccountBtn, false);
    updatePaymentVisibility();
    updatePaymentMethodFollowups();
    saveState();
    calculateReport();
  });
  payRecAccountBtn.addEventListener('click', () => {
    paymentReceivedHidden.value = 'account';
    setQaPressed(payRecYesBtn, false);
    setQaPressed(payRecNoBtn, false);
    setQaPressed(payRecAccountBtn, true);
    updatePaymentVisibility();
    updatePaymentMethodFollowups();
    saveState();
    calculateReport();
  });

  // Payment method buttons
  [
    [payMethodDebitBtn, 'DEBIT'],
    [payMethodCashBtn, 'CASH'],
    [payMethodOnlineBtn, 'ONLINE'],
    [payMethodCheckBtn, 'CHECK'],
    [payMethodCardBtn, 'CARD']
  ].forEach(([btn, val]) => {
    btn.dataset.value = val;
    btn.addEventListener('click', () => {
      setChoiceButtons([payMethodDebitBtn, payMethodCashBtn, payMethodOnlineBtn, payMethodCheckBtn, payMethodCardBtn], paymentMethodHidden, val);
      updatePaymentMethodFollowups();
      saveState();
      calculateReport();
    });
  });

  // Card fee added?
  cardFeeYesBtn.addEventListener('click', () => { setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, 'yes'); saveState(); calculateReport(); });
  cardFeeNoBtn.addEventListener('click', () => { setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, 'no'); saveState(); calculateReport(); });

  // Inputs that impact report
  [gniCheckbox, jobTypeSelect].forEach(el => el.addEventListener('change', () => {
    updateGniVisibility();
    updateSwgcsVisibility();
    saveState();
    calculateReport();
  }));

  // Save state on general changes (debounced)
  let saveTimer = null;
  function saveStateDebounced() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 150);
  }

  document.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('input', () => { saveStateDebounced(); calculateReport(); });
    input.addEventListener('change', () => { saveStateDebounced(); calculateReport(); });
    if (!input.hasAttribute('readonly') && input.type !== 'hidden' && input.type !== 'checkbox') {
      selectAllOnEdit(input);
    }
  });

  // Initialize visibility on load
  updateGniVisibility();
  updateSwgcsVisibility();
  updatePaymentVisibility();
  updatePaymentMethodFollowups();
  wireLaborUI();

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
        if (el.type === 'checkbox') el.checked = !!data[id];
        else el.value = data[id];
      });

      // Re-sync QA buttons from hidden values
      setYesNoButtons(swgcsYesBtn, swgcsNoBtn, swgcsHidden, swgcsHidden.value === 'yes' ? 'yes' : 'no');

      setQaPressed(payRecYesBtn, paymentReceivedHidden.value === 'yes');
      setQaPressed(payRecNoBtn, paymentReceivedHidden.value === 'no');
      setQaPressed(payRecAccountBtn, paymentReceivedHidden.value === 'account');

      setYesNoButtons(cardFeeYesBtn, cardFeeNoBtn, cardFeeAddedHidden, cardFeeAddedHidden.value === 'no' ? 'no' : 'yes');

      [payMethodDebitBtn, payMethodCashBtn, payMethodOnlineBtn, payMethodCheckBtn, payMethodCardBtn].forEach(b => {
        b.dataset.value = b.dataset.value || b.textContent.trim();
      });
      const method = paymentMethodHidden.value || '';
      setChoiceButtons([payMethodDebitBtn, payMethodCashBtn, payMethodOnlineBtn, payMethodCheckBtn, payMethodCardBtn], paymentMethodHidden, method);

      updateGniVisibility();
      updateSwgcsVisibility();
      updatePaymentVisibility();
      updatePaymentMethodFollowups();
      [1, 2, 3, 4, 5, 'ah'].forEach(day => renderLaborList(day));

    } catch (_) {}
  }

  restoreState();

  // Initial formatting pass (so blanks become HOURLY defaults)
  // Money
  [totalPriceInput, materialExpensesInput, otherExpensesInput, cashAmountInput].forEach(inp => {
    if (!inp) return;
    if (!String(inp.value || '').trim()) inp.value = formatMoney(0);
  });
  // Hours
  ['pd','day1','day2','day3','day4','day5','ah','toh'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!String(el.value || '').trim()) el.value = (id === 'pd') ? '1.00 hrs' : '0.00 hrs';
  });
  // Date
  if (dateInput && !String(dateInput.value || '').trim()) {
    dateInput.value = longDateFormatter.format(todayLocalDate());
  }

  // Initial calc
  calculateReport();

  // Buttons
  calculateBtn.addEventListener('click', () => {
    setButtonBusy(calculateBtn, 'Generating...');
    saveState();
    calculateReport();
    setTimeout(() => clearButtonBusy(calculateBtn), 400);
  });

  window.addEventListener('beforeprint', () => {
    calculateReport();
    syncCalculatorPrintSheet();
    document.body.classList.add('is-printing');
  });

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('is-printing');
  });

  function buildPrintSheetHTML() {
    const baseUrl = new URL('.', window.location.href).href;
    const logoUrl = new URL(`BP.png?v=${Date.now()}`, baseUrl).href;

    const getVal = (id) => document.getElementById(id)?.value ?? '';
    const getChecked = (id) => !!document.getElementById(id)?.checked;

    function formatLaborForPrint(raw) {
      const entries = parseLaborEntries(raw);
      if (entries.length === 0) return '';
      return entries
        .map((e) => (e.note ? `${e.name} — ${e.note}` : `${e.name}`))
        .join('\n');
    }

    const jobTypeText = jobTypeSelect.options[jobTypeSelect.selectedIndex].text;
    const jobTypeVal = jobTypeSelect.value;

    const gniText =
      jobTypeVal === 'company' ? (getChecked('gni') ? 'Yes' : 'No') : 'N/A';

    const swgcsText =
      (jobTypeVal === 'technician' || jobTypeVal === 'sales')
        ? (swgcsHidden.value === 'yes' ? 'Yes' : 'No')
        : 'N/A';

    const paymentReceivedText =
      paymentReceivedHidden.value === 'yes' ? 'Yes' :
      paymentReceivedHidden.value === 'account' ? 'Bayshore Account' : 'No';

    const paymentMethodText =
      paymentReceivedHidden.value === 'yes'
        ? (
            paymentMethodHidden.value === 'DEBIT' ? 'Debit Card' :
            paymentMethodHidden.value === 'CASH' ? 'Cash' :
            paymentMethodHidden.value === 'ONLINE' ? 'Online' :
            paymentMethodHidden.value === 'CARD' ? 'Credit Card' :
            paymentMethodHidden.value === 'CHECK' ? 'Check' : ''
          )
        : '';

    const cashAmountText = getVal('cashAmount');
    const checkNumberText = getVal('checkNumber');
    const cardFeeAddedText =
      (paymentMethodHidden.value === 'CARD')
        ? (cardFeeAddedHidden.value === 'yes' ? 'Yes' : 'No')
        : '';

    let paymentRows = `<tr><th>Payment Received</th><td>${escapeHtml(paymentReceivedText)}</td></tr>`;

    if (paymentReceivedHidden.value === 'yes') {
      paymentRows += `<tr><th>Payment Method</th><td>${escapeHtml(paymentMethodText)}</td></tr>`;

      if (paymentMethodHidden.value === 'CASH') {
        paymentRows += `<tr><th>Cash Amount</th><td>${escapeHtml(cashAmountText)}</td></tr>`;
      } else if (paymentMethodHidden.value === 'CHECK') {
        paymentRows += `<tr><th>Check Number</th><td>${escapeHtml(checkNumberText)}</td></tr>`;
      } else if (paymentMethodHidden.value === 'CARD') {
        paymentRows += `<tr><th>Card Fee Added</th><td>${escapeHtml(cardFeeAddedText)}</td></tr>`;
      }
    }

    const enteredTotalPrice = enteredTotalPriceHidden?.value || getVal('tp');
    const kickerText = kickerSpan.textContent || '0.00';

    // Build compact A4-friendly sheet (matches the prior print content, just same-tab now)
    return `
      <div id="printRoot">
        <div class="print-header">
          <img src="${logoUrl}" alt="BP logo" class="logo">
          <h2>OPERATIONS PROJECT REPORT</h2>
        </div>

        <div class="print-body">

          <div class="no-break details-section">
            <h3>DETAILS:</h3>
            <table class="input-data">
              <tr><th>Job Type</th><td>${escapeHtml(jobTypeText)}</td></tr>
              <tr><th>GNI</th><td>${escapeHtml(gniText)}</td></tr>
              <tr><th>S/W/G/CS</th><td>${escapeHtml(swgcsText)}</td></tr>

              ${paymentRows}

              <tr><th>Job Address</th><td>${escapeHtml(getVal('ja'))}</td></tr>
              <tr><th>Date</th><td>${escapeHtml(getVal('date'))}</td></tr>

              <tr><th>Entered Total Price</th><td>${escapeHtml(enteredTotalPrice)}</td></tr>
              <tr><th>Material Expense</th><td>${escapeHtml(getVal('material'))}</td></tr>
              <tr><th>Other Expense</th><td>${escapeHtml(getVal('oe'))}</td></tr>
              <tr><th>Project Duration</th><td>${escapeHtml(getVal('pd'))}</td></tr>

              <tr><th>Notes</th><td>${escapeHtml(getVal('notes')).replace(/\r?\n/g, '<br/>')}</td></tr>
            </table>
          </div>

          <div class="no-break">
            <h3>LABOR DETAILS:</h3>

            <table class="input-data">
              <thead>
                <tr>
                  <th>Day 1 (Hrs)</th><th>Day 1 (Names)</th>
                  <th>Day 2 (Hrs)</th><th>Day 2 (Names)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(getVal('day1'))}</td>
                  <td>${escapeHtml(formatLaborForPrint(getVal('day1Names'))).replace(/\r?\n/g, '<br/>')}</td>
                  <td>${escapeHtml(getVal('day2'))}</td>
                  <td>${escapeHtml(formatLaborForPrint(getVal('day2Names'))).replace(/\r?\n/g, '<br/>')}</td>
                </tr>
              </tbody>
            </table>

            <table class="input-data">
              <thead>
                <tr>
                  <th>Day 3 (Hrs)</th><th>Day 3 (Names)</th>
                  <th>Day 4 (Hrs)</th><th>Day 4 (Names)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(getVal('day3'))}</td>
                  <td>${escapeHtml(formatLaborForPrint(getVal('day3Names'))).replace(/\r?\n/g, '<br/>')}</td>
                  <td>${escapeHtml(getVal('day4'))}</td>
                  <td>${escapeHtml(formatLaborForPrint(getVal('day4Names'))).replace(/\r?\n/g, '<br/>')}</td>
                </tr>
              </tbody>
            </table>

            <table class="input-data">
              <thead>
                <tr>
                  <th>Day 5 (Hrs)</th><th>Day 5 (Names)</th>
                  <th>Additional (Hrs)</th><th>Additional (Labor/Notes)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(getVal('day5'))}</td>
                  <td>${escapeHtml(formatLaborForPrint(getVal('day5Names'))).replace(/\r?\n/g, '<br/>')}</td>
                  <td>${escapeHtml(getVal('ah'))}</td>
                  <td>${escapeHtml(formatLaborForPrint(getVal('ahNames'))).replace(/\r?\n/g, '<br/>')}</td>
                </tr>
              </tbody>
            </table>

            <table class="input-data">
              <thead>
                <tr><th>Overtime Hours</th><th>Total Hours</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(getVal('toh'))}</td>
                  <td>${escapeHtml(getVal('totalHours'))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="no-break">
            <h3>FOR OFFICE USE ONLY:</h3>
            <table class="input-data">
              <tr><th>SW21/RP21</th><td>${escapeHtml(getVal('sw'))}</td><th>WH32</th><td>${escapeHtml(getVal('wh'))}</td></tr>
              <tr><th>RD15/UL15</th><td>${escapeHtml(getVal('rd'))}</td><th>BPP%</th><td>${escapeHtml(getVal('bpp'))}</td></tr>
            </table>
          </div>

          <div class="no-break">
            <h3>PAYOUTS:</h3>
            <table class="input-data">
              <tr><th>Kicker</th><td>${escapeHtml(kickerText)}</td></tr>
            </table>
          </div>

        </div>
      </div>
      `;
  }

  function syncCalculatorPrintSheet() {
    const sheet = document.getElementById('printSheet');
    if (!sheet) return;

    sheet.innerHTML = buildPrintSheetHTML();
    sheet.setAttribute('aria-hidden', 'false');
  }

  printButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (printButton.disabled) return;

    const userConfirmed = confirm('I HEREBY CONFIRM THAT ALL THE DETAILS ENTERED ARE CORRECT AND I TAKE FULL RESPONSIBILITY OF THIS DOCUMENT.');
    if (!userConfirmed) return;

    setButtonBusy(printButton, 'Preparing Print Page...');
    saveState();
    calculateReport();
    syncCalculatorPrintSheet();

    sessionStorage.setItem(OPS_SAMA_PRINT_PAYLOAD_KEY, buildPrintSheetHTML());
    sessionStorage.setItem(OPS_SAMA_PRINT_RETURN_KEY, OPS_SAMA_CALCULATOR_URL);

    setTimeout(() => {
      window.location.href = OPS_SAMA_PRINT_PAGE_URL;
    }, 120);
  });
});
