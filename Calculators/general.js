/* general.js — SAM 3.0 compliant
   - No innerHTML injection for breakdown
   - No new-window printing
   - Uses shared print CSS via window.print()
   - Keeps all math/logic intact
*/

document.addEventListener('DOMContentLoaded', function () {
  const inputFields = document.querySelectorAll('input, select');
  inputFields.forEach(function (input) {
    input.addEventListener('input', calculateFinalPrice);
    input.addEventListener('change', calculateFinalPrice);
  });

  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', printEstimate);
  }

  calculateFinalPrice(); // Initial calculation on page load
});

function calculateFinalPrice() {
  const pdu = document.getElementById('pdu').value.toUpperCase();
  const epd = parseFloat(document.getElementById('epd').value) || 0;
  const material = parseFloat(document.getElementById('material').value) || 0;
  const rentals = parseFloat(document.getElementById('rentals').value) || 0;
  const am = parseInt(document.getElementById('am').value, 10) || 0;

  const permits = Array.from(
    document.querySelectorAll('#permits input[name="permits"]:checked')
  ).map(input => input.value);

  const discount = document.getElementById('discount').value;
  const financingOption = document.getElementById('financing').value;
  const finalPriceSpan = document.getElementById('finalPrice');

  let finalPrice = 0;

  // Calculate project duration cost and other fixed multipliers
  const projectDurationCost = pdu === 'DAYS' ? epd * 8 * 490 : epd * 490;
  const materialCost = material * 2;
  const rentalCost = rentals * 1.5;

  // Calculate machinery/equipment cost using checkboxes
  let machineryCost = 0;
  const selectedMachines = [];
  const machineCheckboxes = document.querySelectorAll('.machine:checked');

  machineCheckboxes.forEach(function (checkbox) {
    const price = parseFloat(checkbox.getAttribute('data-price')) || 0;

    // If the unit is DAYS, multiply daily cost by duration; if HOURS, assume 8 hours per day conversion.
    if (pdu === 'DAYS') {
      machineryCost += price * epd;
    } else {
      machineryCost += (price / 8) * epd;
    }

    selectedMachines.push(checkbox.value);
  });

  // Calculate labor cost
  const laborCost = pdu === 'DAYS' ? am * epd * 8 * 85 : am * epd * 85;

  // Calculate permits cost
  let permitsCost = 0;
  permits.forEach(permit => {
    switch (permit) {
      case 'building':
        permitsCost += 1000;
        break;
      case 'encroachment':
        permitsCost += 3300;
        break;
      case 'sewer':
        permitsCost += 1000;
        break;
      default:
        break;
    }
  });

  // Sum up all costs to compute total cost
  const totalCost = projectDurationCost + materialCost + rentalCost + machineryCost + laborCost + permitsCost;
  let discountValue = 0;

  // Apply discounts if applicable
  if (discount === '5%') {
    discountValue = totalCost * 0.05;
    finalPrice = totalCost - discountValue;
  } else if (discount === '10%') {
    discountValue = totalCost * 0.1;
    finalPrice = totalCost - discountValue;
  } else {
    finalPrice = totalCost;
  }

  // Financing adjustments
  if (financingOption === '2611') {
    finalPrice *= 1.05;
  } else if (financingOption === '9998') {
    finalPrice *= 1.055;
  }

  // Increase by 20% if AFTER HOURS is enabled
  const afterHours = document.getElementById('afterHours').checked;
  if (afterHours) {
    finalPrice += finalPrice * 0.2;
  }

  // Update the displayed final price
  finalPriceSpan.textContent = '$' + finalPrice.toFixed(2);

  // Display the breakdown summary including selected machinery details (SAFE DOM)
  displayBreakdown({
    projectDurationCost,
    materialCost,
    rentalCost,
    machineryCost,
    laborCost,
    permitsCost,
    discountValue,
    selectedMachines
  });
}

function displayBreakdown(data) {
  const breakdownEl = document.getElementById('breakdown');
  if (!breakdownEl) return;

  // Clear previous content safely
  while (breakdownEl.firstChild) breakdownEl.removeChild(breakdownEl.firstChild);

  // Create a simple table that prints cleanly (bp-calculator.css already styles table.input-data)
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

  const machineList = data.selectedMachines.length ? data.selectedMachines.join(', ') : 'None';

  const rows = [
    ['Project Duration Cost', money(data.projectDurationCost)],
    ['Material Cost', money(data.materialCost)],
    ['Rental Cost', money(data.rentalCost)],
    ['Machinery/Equipment Cost', money(data.machineryCost)],
    ['Selected Machinery/Equipment', machineList],
    ['Labor Cost', money(data.laborCost)],
    ['Permits Cost', money(data.permitsCost)],
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
