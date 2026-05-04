/* heater.js — SAM 3.0 compliant
   - No innerHTML injection for breakdown
   - No new-window printing
   - Uses shared print CSS via window.print()
   - Keeps all math/logic intact
*/

document.addEventListener('DOMContentLoaded', function () {
  const inputFields = document.querySelectorAll('#biddingForm input, #biddingForm select');
  inputFields.forEach(function (input) {
    input.addEventListener('input', calculateFinalPrice);
    input.addEventListener('change', calculateFinalPrice);
  });

  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', printEstimate);
  }

  // Initial calculation on page load
  calculateFinalPrice();
});

function calculateFinalPrice() {
  const et = parseFloat(document.getElementById('et').value) || 0;
  const material = parseFloat(document.getElementById('material').value) || 0;
  const am = parseFloat(document.getElementById('am').value) || 0;
  const others = parseFloat(document.getElementById('others').value) || 0;
  const discount = document.getElementById('discount').value;
  const permits = document.getElementById('permits').checked;
  const financingOption = document.getElementById('financing').value;
  const finalPriceSpan = document.getElementById('finalPrice');

  // Calculate various costs (UNCHANGED)
  const materialCost = material * 1.5;
  const manpowerCost = am * et * 85;
  const othersCost = others * 1.2;
  const permitsCost = permits ? 1000 : 0;
  const estimatedTimeCost = et * 490;

  const totalCost = materialCost + manpowerCost + othersCost + permitsCost + estimatedTimeCost;
  let discountValue = 0;
  let finalPrice = 0;

  // Apply discount (UNCHANGED)
  if (discount === '5%') {
    discountValue = totalCost * 0.05;
    finalPrice = totalCost - discountValue;
  } else if (discount === '10%') {
    discountValue = totalCost * 0.1;
    finalPrice = totalCost - discountValue;
  } else {
    finalPrice = totalCost;
  }

  // Financing adjustments (UNCHANGED)
  if (financingOption === '2611') {
    finalPrice *= 1.05;
  } else if (financingOption === '9998') {
    finalPrice *= 1.055;
  }

  // After hours (UNCHANGED)
  const afterHours = document.getElementById('afterHours').checked;
  if (afterHours) {
    finalPrice += finalPrice * 0.2; // 20% increase
  }

  // Show final price
  finalPriceSpan.textContent = '$' + finalPrice.toFixed(2);

  // Display breakdown (SAFE DOM)
  displayBreakdown({
    materialCost,
    manpowerCost,
    othersCost,
    permitsCost,
    estimatedTimeCost,
    discountValue
  });
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
    ['Material Cost', money(data.materialCost)],
    ['Additional Manpower Cost', money(data.manpowerCost)],
    ['Other Expenses', money(data.othersCost)],
    ['Permits Cost', money(data.permitsCost)],
    ['Estimated Time Cost', money(data.estimatedTimeCost)],
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
  // SAM 3.0 standard: print this page using shared print CSS.
  window.print();
}
