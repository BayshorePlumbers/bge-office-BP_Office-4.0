/* liner.js — SAM 3.0 compliant
   - No CDNs, no unsafe-inline assumptions
   - No alert()
   - No innerHTML injection for breakdown
   - No new-window printing
   - Uses window.print() with shared print CSS
   - Keeps all pricing logic/math intact
*/

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('linerForm');

  document.querySelectorAll('#linerForm input, #linerForm select').forEach((element) => {
    element.addEventListener('input', calculateTotal);
    element.addEventListener('change', calculateTotal);
  });

  const calcBtn = document.getElementById('calculateBtn');
  if (calcBtn) {
    calcBtn.addEventListener('click', calculateTotal);
  }

  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', printEstimate);
  }

  // Initial render
  calculateTotal();

  // If browser tries to submit due to Enter key, prevent it
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      calculateTotal();
    });
  }
});

function calculateTotal() {
  const lengthInput = document.getElementById('length');
  const totalPriceEl = document.getElementById('totalPrice');

  // Validate: if empty or invalid, do not calculate (no alerts)
  const rawLength = (lengthInput && lengthInput.value !== '') ? Number(lengthInput.value) : null;
  const length = (rawLength !== null) ? Math.trunc(rawLength) : 0;

  if (!lengthInput || rawLength === null || !Number.isFinite(rawLength) || rawLength < 1) {
    if (totalPriceEl) totalPriceEl.textContent = '$0.00';
    displayBreakdown({
      basePrice: 0,
      houseCleanOut: 0,
      propertyLineCleanOut: 0,
      landscape: 0,
      reInstate: 0,
      buildingPermit: 0,
      otherExpenses: 0,
      discountValue: 0,
      reInstateCost: 0
    });
    return;
  }

  const houseCleanOut = getCheckboxValue('houseCleanOut', 1500);
  const propertyLineCleanOut = getCheckboxValue('propertyLineCleanOut', 2500);
  const landscape = parseInt(document.getElementById('landscape').value, 10) || 0;
  const reInstate = parseInt(document.getElementById('reInstate').value, 10) || 0;
  const buildingPermit = getCheckboxValue('buildingPermit', 350);
  const otherExpenses = parseFloat(document.getElementById('otherExpenses').value) || 0;

  // Calculate base price based on length (UNCHANGED)
  const basePrice = calculateBasePrice(length);

  const reInstateCost = reInstate * 1500;

  // Calculate total cost (UNCHANGED)
  let totalCost = basePrice + houseCleanOut + propertyLineCleanOut + landscape +
    reInstateCost + buildingPermit + otherExpenses;

  let discountValue = 0;
  const discount = document.getElementById('discount')?.value || 'no discount';

  // Apply discount (UNCHANGED)
  if (discount === '5%') {
    discountValue = totalCost * 0.05;
    totalCost -= discountValue;
  } else if (discount === '10%') {
    discountValue = totalCost * 0.1;
    totalCost -= discountValue;
  }

  // After Hours adjustment (UNCHANGED)
  const afterHours = document.getElementById('afterHours').checked;
  if (afterHours) {
    totalCost += totalCost * 0.2;
  }

  // Format total cost as currency (UNCHANGED output format intent)
  const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost);
  document.getElementById('totalPrice').innerText = formattedTotal;

  // Display breakdown summary (SAFE DOM)
  displayBreakdown({
    basePrice,
    houseCleanOut,
    propertyLineCleanOut,
    landscape,
    reInstate,
    buildingPermit,
    otherExpenses,
    discountValue,
    reInstateCost
  });
}

function calculateBasePrice(length) {
  if (length <= 5) return 4000;
  if (length === 6) return 4000 + 460;
  if (length === 7) return 4000 + 460 * 2;
  if (length === 8) return 4000 + 460 * 3;
  if (length === 9) return 4000 + 460 * 4;
  if (length === 10) return 5000;
  if (length === 11) return 5000 + 460;
  if (length === 12) return 5000 + 460 * 2;
  if (length === 13) return 5000 + 460 * 3;
  if (length >= 14) return 460 * length;
  return 5000 + (length - 10) * 460;
}

function getCheckboxValue(id, cost) {
  const el = document.getElementById(id);
  return el && el.checked ? cost : 0;
}

function displayBreakdown(data) {
  const breakdownEl = document.getElementById('breakdown');
  if (!breakdownEl) return;

  // Clear previous content safely
  while (breakdownEl.firstChild) breakdownEl.removeChild(breakdownEl.firstChild);

  // Build a table that matches bp-calculator.css (table.input-data)
  const table = document.createElement('table');
  table.className = 'input-data';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  const th1 = document.createElement('th');
  th1.textContent = 'Field Name';

  const th2 = document.createElement('th');
  th2.textContent = 'Cost / Value';

  headRow.appendChild(th1);
  headRow.appendChild(th2);
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');

  const rows = [
    ['Base Price', money(data.basePrice)],
    ['House Clean Out', money(data.houseCleanOut)],
    ['Property Line Clean Out', money(data.propertyLineCleanOut)],
    ['Landscape', money(data.landscape)],
    [`Re-Instate (${data.reInstate})`, money(data.reInstateCost)],
    ['Building Permit', money(data.buildingPermit)],
    ['Other Expenses', money(data.otherExpenses)],
    ['Discount Applied', '-' + money(data.discountValue)]
  ];

  rows.forEach(([field, value]) => {
    const tr = document.createElement('tr');

    const td1 = document.createElement('td');
    td1.textContent = field;

    const td2 = document.createElement('td');
    td2.textContent = value;

    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  breakdownEl.appendChild(table);
}

function money(n) {
  const num = Number(n) || 0;
  return '$' + num.toFixed(2);
}

function printEstimate() {
  window.print();
}
