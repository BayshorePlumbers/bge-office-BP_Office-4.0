document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('calculateBtn').addEventListener('click', calculateFinalPrice);
  
    // Recalculate on input or change events
    var inputFields = document.querySelectorAll('input, select');
    inputFields.forEach(function(input) {
      input.addEventListener('input', calculateFinalPrice);
      input.addEventListener('change', calculateFinalPrice);
    });
  
    // Set up info-icon mousedown events for mobile/touch devices
var infoIcons = document.querySelectorAll('.info-icon');
infoIcons.forEach(function(icon) {
  icon.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    showInfoPopover(icon);
  });
});
  
    // Hide popover when clicking outside of it
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.info-icon') && !e.target.classList.contains('info-popover')) {
        hideInfoPopover();
      }
    });    
  
    // Print button event
    document.getElementById('printBtn').addEventListener('click', printEstimate);
  
    calculateFinalPrice();
});
  
// Show the info popover next to the clicked icon
function showInfoPopover(target) {
    var popover = document.getElementById('infoPopover');
    var infoText = target.getAttribute('data-info');
    popover.textContent = infoText;
    var rect = target.getBoundingClientRect();
    popover.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    popover.style.left = (rect.left + window.scrollX) + 'px';
    popover.style.display = 'block';
}
  
function hideInfoPopover() {
    document.getElementById('infoPopover').style.display = 'none';
}
  
function calculateFinalPrice() {
    var method = document.getElementById('method');
    var ed = parseFloat(document.getElementById('ed').value) || 0;
    var swr = document.getElementById('swr');
    var atr = document.getElementById('atr');
    var bm = document.getElementById('bm');
    var el = parseInt(document.getElementById('el').value) || 0;
    var ct = document.getElementById('ct');
    var scr = document.getElementById('scr');
    var depth = parseInt(document.getElementById('depth').value) || 0;
    var others = parseFloat(document.getElementById('others').value) || 0;
    var discount = document.getElementById('discount').value.toUpperCase();
    var checkbox5 = document.getElementById('checkbox5');
    var upperMethod = document.getElementById('upperMethod');
    var landscape = document.getElementById('landscape').value.toUpperCase();
    var ull = parseInt(document.getElementById('ull').value) || 0;
    var ubm = document.getElementById('ubm').value.toUpperCase();
    var am = parseInt(document.getElementById('am').value) || 0;
    var amDays = parseInt(document.getElementById('amDays').value) || 0;
    var tcGuys = parseInt(document.getElementById('tcGuys').value) || 0;
    var tcDays = parseInt(document.getElementById('tcDays').value) || 0;
    var financingOption = document.getElementById('financing').value;
    var finalPriceSpan = document.getElementById('finalPrice');
  
    // Base price starts at 3300
    var finalPrice = 3300;
    finalPrice += others * 1.2;
  
    // Calculate based on method and encroachment length
    if (method.value.toUpperCase() === 'OPEN TRENCH') {
      if (atr.checked) {
        switch (el) {
          case 10: finalPrice += 4300 * 1.2; break;
          case 20: finalPrice += 4300 * 1.2; break;
          case 25: finalPrice += 4800 * 1.2; break;
          case 30: finalPrice += 5800 * 1.2; break;
          case 35: finalPrice += 6800 * 1.2; break;
          case 40: finalPrice += 7800 * 1.2; break;
          default: console.log('Invalid Encroachment Length:', el);
        }
      } else {
        switch (el) {
          case 10: finalPrice += 4000 * 1.2; break;
          case 20: finalPrice += 4000 * 1.2; break;
          case 25: finalPrice += 4200 * 1.2; break;
          case 30: finalPrice += 5200 * 1.2; break;
          case 35: finalPrice += 6200 * 1.2; break;
          case 40: finalPrice += 7200 * 1.2; break;
          default: console.log('Invalid Encroachment Length:', el);
        }
      }
    } else if (method.value.toUpperCase() === 'TRENCHLESS') {
      finalPrice += atr.checked ? 5280 * 1.2 : 4410 * 1.2;
    } else {
      console.log('Invalid method:', method.value);
    }
  
    if (swr.checked) {
      finalPrice += 200;
    }
  
    if (bm.value.toUpperCase() === 'BASE ROCK' && method.value.toUpperCase() === 'OPEN TRENCH') {
      finalPrice += 480;
    } else if (bm.value.toUpperCase() === 'BASE ROCK' && method.value.toUpperCase() === 'TRENCHLESS') {
      finalPrice -= 400;
    }
  
    if (ct.checked) {
      finalPrice += 1800 * 1.2;
    }
  
    if (scr.checked) {
      finalPrice += 600 * 1.2;
    }
  
    if (depth >= 5) {
      finalPrice += (depth - 5) * 1000 * 1.2;
    }
  
    if (checkbox5.checked) {
      if (upperMethod.value.toUpperCase() === 'OPEN TRENCH') {
        finalPrice += 90 * ull * 1.2;
      } else if (upperMethod.value.toUpperCase() === 'TRENCHLESS') {
        finalPrice += 45 * ull * 1.2;
      }
      if (ubm === 'BASE ROCK') {
        finalPrice += 45 * ull * 1.2;
      }
      if (landscape === 'DIRT') {
        finalPrice += ull * 25 * 1.2;
      } else if ((method.value.toUpperCase() === 'OPEN TRENCH' && (landscape === 'PAVERS' || landscape === 'ASPHALT' || landscape === 'CONCRETE')) ||
                 (method.value.toUpperCase() === 'TRENCHLESS' && (landscape === 'PAVERS' || landscape === 'ASPHALT' || landscape === 'CONCRETE'))) {
        finalPrice += ull * (method.value.toUpperCase() === 'OPEN TRENCH' ? 90 : 45) * 1.2;
      }
    }
  
    // Additional Manpower cost calculation
    finalPrice += am * amDays * 8 * 85;
    // Traffic Control cost calculation
    finalPrice += tcGuys * tcDays * 8 * 85;
  
    if (discount === '5%') {
      finalPrice *= 0.95;
    } else if (discount === '10%') {
      finalPrice *= 0.9;
    }
  
    finalPrice += ed * 8 * 678;
  
    switch (financingOption.toLowerCase()) {
      case 'none':
      case '2832':
        break;
      case '2611':
        finalPrice *= 1.05;
        break;
      case '9998':
        finalPrice *= 1.055;
        break;
      default:
        console.log('Invalid financing option:', financingOption);
    }
  
    var afterHours = document.getElementById('afterHours').checked;
    if (afterHours) {
      finalPrice += finalPrice * 0.2;
    }
  
    finalPriceSpan.textContent = '$' + finalPrice.toFixed(2);
  
    displayBreakdown(method, bm, el, others, discount, swr, atr, ct, scr, depth, checkbox5, upperMethod, landscape, ull, ubm, am, amDays, tcGuys, tcDays, financingOption, ed, afterHours);
}
  
function displayBreakdown(method, bm, el, others, discount, swr, atr, ct, scr, depth, checkbox5, upperMethod, landscape, ull, ubm, am, amDays, tcGuys, tcDays, financingOption, ed, afterHours) {
    let breakdown = `<strong>Estimate Summary:</strong><br>
      &nbsp;&nbsp;- Replacement/Installation Method: ${method.value}<br>
      &nbsp;&nbsp;- Backfill Material: ${bm.value}<br>
      &nbsp;&nbsp;- Encroachment Length: ${el} ft<br>
      &nbsp;&nbsp;- Other Expenses: $${others.toFixed(2)}<br>
      &nbsp;&nbsp;- Discount Applied: ${discount}<br>
      &nbsp;&nbsp;- Sidewalk Repair: ${swr.checked ? "Yes" : "No"}<br>
      &nbsp;&nbsp;- Asphalt T-Cut: ${atr.checked ? "Yes" : "No"}<br>
      &nbsp;&nbsp;- Compaction Test: ${ct.checked ? "Yes" : "No"}<br>
      &nbsp;&nbsp;- Seal Coat: ${scr.checked ? "Yes" : "No"}<br>
      &nbsp;&nbsp;- Depth: ${depth} ft<br>
      &nbsp;&nbsp;- Upper Lateral Included: ${checkbox5.checked ? "Yes" : "No"}<br>
      &nbsp;&nbsp;- Upper Method: ${upperMethod.value}<br>
      &nbsp;&nbsp;- Landscape: ${landscape}<br>
      &nbsp;&nbsp;- Upper Lateral Length: ${ull} ft<br>
      &nbsp;&nbsp;- Upper Backfill Material: ${ubm}<br>
      &nbsp;&nbsp;- Additional Manpower: ${am}<br>
      &nbsp;&nbsp;- Additional Manpower Days: ${amDays}<br>
      &nbsp;&nbsp;- Traffic Control Guys: ${tcGuys}<br>
      &nbsp;&nbsp;- Traffic Control Days: ${tcDays}<br>
      &nbsp;&nbsp;- Financing Option: ${financingOption}<br>
      &nbsp;&nbsp;- Estimated Days: ${ed} days<br>
      &nbsp;&nbsp;- After Hours: ${afterHours ? "Yes" : "No"}<br>`;
    document.getElementById('breakdown').innerHTML = breakdown;
}
  
// Updated Print Function (using external print.css)
function printEstimate() {
  // 1. Gather the data from the current page
  const logoElem = document.querySelector('.logo');
  const logoSrc = logoElem ? logoElem.src : '';
  const finalPrice = document.getElementById('finalPrice').textContent;
  const breakdownText = document.getElementById('breakdown').innerText;
  let breakdownRows = breakdownText.split('\n').filter(row => row.trim() !== '');
  
  // Remove any "Estimate Summary:" line if present
  if (breakdownRows.length && breakdownRows[0].includes("Estimate Summary:")) {
    breakdownRows.shift();
  }
  
  // Build table rows for the breakdown
  let tableHTML = `
    <table class="input-data">
      <thead>
        <tr>
          <th>Input Fields</th>
          <th>Input Values</th>
        </tr>
      </thead>
      <tbody>
  `;
  breakdownRows.forEach(row => {
    // Remove any leading dashes or whitespace
    const cleanedRow = row.replace(/^\s*[-\s]+/, '');
    if (cleanedRow.includes(':')) {
      const parts = cleanedRow.split(':');
      const field = parts[0].trim();
      const value = parts.slice(1).join(':').trim();
      tableHTML += `<tr><td>${field}</td><td>${value}</td></tr>`;
    }
  });
  tableHTML += '</tbody></table>';
  
  // 2. Open a new window for print preview and write the print template
  const printWindow = window.open('', 'PrintPreview', 'width=800,height=600');
  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Street Project Estimate Summary</title>
      <link rel="stylesheet" href="brandprint.css" type="text/css">
    </head>
    <body>
      <header>
        <div class="logo-container">
          <!-- Inline style as backup to ensure small logo -->
          <img src="${logoSrc}" alt="Logo" class="logo" style="max-width:50px;">
        </div>
        <h1>Estimate Summary - Street Project Bidding Calculator</h1>
      </header>
      <div class="summary">
        ${tableHTML}
        <div class="final-price">
          Final Bidding Price: ${finalPrice}
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  
  // 3. Trigger print after a brief delay
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

// Utility to extract number from formatted currency
function extractNumeric(text) {
  return Number(text.replace(/[^0-9.-]+/g, ""));
}

// Estimate labor cost (3-person crew, 8 hrs/day, $75/hr/person)
function estimateLaborCost(estimatedDays) {
  return estimatedDays * 8 * 3 * 95;
}

// Commission logic reused from com.js
function extractNumeric(text) {
  return Number(text.replace(/[^0-9.-]+/g, ""));
}

function estimateLaborCost(estimatedDays) {
  return estimatedDays * 8 * 3 * 95; // 3-man crew, 8 hrs/day, $95/hr
}

function calculateTechnicianCommission(totalPrice, materialCost, otherExpenses, estimatedDays) {
  const profit = totalPrice - materialCost - otherExpenses;
  const profitPercentage = profit / totalPrice;

  let baseCommission = 0;
  let kicker = 0;

  if (totalPrice <= 539 && estimatedDays <= 1) {
    baseCommission = 60;
  } else if (totalPrice <= 980 && estimatedDays <= 2) {
    baseCommission = 150;
  } else {
    baseCommission = profit * 0.10;
    if (profitPercentage > 0.25) {
      kicker = profit * 0.05;
    }
  }

  return { totalCommission: baseCommission + kicker, baseCommission, kicker };
}

function calculateBPP({
  finalPrice,
  material,
  other,
  labor,
  permits,
  equipment,
  rentals,
  commission,
  kicker
}) {
  const totalCosts = material + other + labor + permits + equipment + rentals + commission + kicker;
  const profit = finalPrice - totalCosts;
  const bpp = (profit / finalPrice) * 100;
  return bpp.toFixed(2);
}

function performAllCalculations() {
  const finalPrice = extractNumeric(document.getElementById('finalPrice')?.textContent || "0");
  if (finalPrice <= 0) return;

  // Automatically captured material cost from your internal calculator
  const material = typeof materialTotal !== "undefined" ? materialTotal : 0;

  const other = Number(document.getElementById('others')?.value || 0);
  const permits = Number(document.getElementById('permits')?.value || 0);
  const equipment = Number(document.getElementById('equipment')?.value || 0);
  const rentals = Number(document.getElementById('rentals')?.value || 0);
  const estimatedDays = Number(document.getElementById('ed')?.value || 0);
  const labor = estimateLaborCost(estimatedDays);

  const { totalCommission, baseCommission, kicker } = calculateTechnicianCommission(
    finalPrice, material, other, estimatedDays
  );

  const bpp = calculateBPP({
    finalPrice,
    material,
    other,
    labor,
    permits,
    equipment,
    rentals,
    commission: baseCommission,
    kicker: kicker
  });

  // Update outputs
  const techCommissionEl = document.getElementById('techCommission');
  if (techCommissionEl) techCommissionEl.textContent = `$${totalCommission.toFixed(2)}`;

  const bppDisplayEl = document.getElementById('bppDisplay');
  if (bppDisplayEl) bppDisplayEl.textContent = `${bpp}%`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#biddingForm input, #biddingForm select').forEach(el => {
    el.addEventListener('input', performAllCalculations);
  });
  performAllCalculations();
});
