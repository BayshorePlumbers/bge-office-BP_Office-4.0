document.addEventListener('DOMContentLoaded', function() {
    const biddingForm = document.getElementById('biddingForm');
    biddingForm.addEventListener('input', calculateFinalPrice);
    biddingForm.addEventListener('change', calculateFinalPrice);

    document.getElementById('am').value = 'nr';

    // Add event listener for print button
    document.getElementById('printBtn').addEventListener('click', printEstimate);

    calculateFinalPrice(); // Calculate final price when the page loads
});


function calculateFinalPrice() {
    const ed = parseFloat(document.getElementById('ed').value) || 0;
    const method = document.getElementById('method').value.toLowerCase();
    const am = document.getElementById('am').value;
    const swr = document.getElementById('swr').checked;
    const landscape = document.getElementById('landscape').value.toLowerCase();
    const bm = document.getElementById('bm').value.toLowerCase();
    const pb = document.getElementById('pb').value.toLowerCase();
    const permits = document.getElementById('permits').value.toLowerCase();
    const depth = parseFloat(document.getElementById('depth').value) || 0;
    const others = parseFloat(document.getElementById('others').value) || 0;
    const discount = document.getElementById('discount').value;
    const dumping = parseFloat(document.getElementById('dumping').value) || 0;
    const financingOption = document.getElementById('financing').value;
    const finalPriceSpan = document.getElementById('finalPrice');

    let finalPrice = 0;

    // Define and calculate individual cost variables
    let othersCost = others * 1.2;
    let methodCost = (method === 'open trench') ? 960 * 1.2 : 1010 * 1.2;

    let amCost = 0;
    if (am === '1d') amCost = 85 * 8 * 1 * 1.2;
    else if (am === '2d') amCost = 85 * 8 * 2 * 1.2;
    else if (am === '3d') amCost = 85 * 8 * 3 * 1.2;

    let swrCost = swr ? 400 * 1.2 : 0;

    let landscapeCost = 0;
    if (method === 'open trench') {
        if (landscape === 'pavers') landscapeCost = 1200 * 1.2;
        else if (landscape === 'asphalt') landscapeCost = 350 * 1.2;
        else if (landscape === 'concrete') landscapeCost = 600 * 1.2;
    } else if (method === 'trenchless') {
        if (landscape === 'pavers') landscapeCost = 400 * 1.2;
        else if (landscape === 'asphalt') landscapeCost = 150 * 1.2;
        else if (landscape === 'concrete') landscapeCost = 100 * 1.2;
    }

    let bmCost = bm === 'base rock' ? 630 * 1.2 : 0;
    let pbCost = pb !== 'native soil' ? 90 * 1.2 : 0;

    let permitsCost = 0;
    if (permits === 'building') permitsCost = 1000;
    else if (permits === 'sidewalk') permitsCost = 900 * 1.2;
    else if (permits === 'sewer') permitsCost = 1000;
    else if (permits === 'bas') permitsCost = 2000;

    let depthCost = depth > 5 ? (depth - 5) * 1000 * 1.2 : 0;
    let dumpingCost = dumping * 60 * 1.2;
    let edCost = ed * 8 * 678 * 1.2;

    // Add all the costs to finalPrice
    finalPrice = othersCost + methodCost + amCost + swrCost + landscapeCost +
                 bmCost + pbCost + permitsCost + depthCost + dumpingCost + edCost;

    // Apply discounts
    if (discount === '5%') {
        finalPrice *= 0.95;
    } else if (discount === '10%') {
        finalPrice *= 0.9;
    }

    // Apply financing option adjustments
    if (financingOption === '2611') {
        finalPrice *= 1.05;
    } else if (financingOption === '9998') {
        finalPrice *= 1.055;
    }

    // Check if AFTER HOURS is enabled
    var afterHours = document.getElementById('afterHours').checked;
    
    // Final calculation logic
    if (afterHours) {
        finalPrice += finalPrice * 0.2; // Increase by 20%
    }

    // Display the final calculated price
    finalPriceSpan.textContent = '$' + finalPrice.toFixed(2);

    // Display the breakdown summary
    displayBreakdown(methodCost, amCost, swrCost, landscapeCost, bmCost, pbCost, permitsCost, depthCost, dumpingCost, edCost, othersCost);
}

function displayBreakdown(methodCost, amCost, swrCost, landscapeCost, bmCost, pbCost, permitsCost, depthCost, dumpingCost, edCost, othersCost) {
    let breakdown = `
        <strong>ESTIMATE SUMMARY:</strong><br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Method Cost: $${methodCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Additional Manpower Cost: $${amCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Sidewalk Repair Cost: $${swrCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Landscape Cost: $${landscapeCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Backfill Material Cost: $${bmCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Pipe Bedding Cost: $${pbCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Permits Cost: $${permitsCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Depth Adjustment Cost: $${depthCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Dumping Cost: $${dumpingCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Estimated Days Cost: $${edCost.toFixed(2)}<br>
        &nbsp;&nbsp;&nbsp;&nbsp;- Other Expenses: $${othersCost.toFixed(2)}
    `;
    document.getElementById('breakdown').innerHTML = breakdown;
}

function printEstimate() {
    // 1. Gather data from the current page
    const logoSrc = document.querySelector('.logo').src;
    const finalPrice = document.getElementById('finalPrice').textContent;

    // Instead of pulling the raw HTML from #breakdown, get the plain text
    // and parse it line-by-line like street.js
    const breakdownText = document.getElementById('breakdown').innerText;
    let breakdownRows = breakdownText.split('\n').filter(row => row.trim() !== '');

    // If the first line is "ESTIMATE SUMMARY:", remove it
    if (breakdownRows.length && breakdownRows[0].toUpperCase().includes("ESTIMATE SUMMARY:")) {
        breakdownRows.shift();
    }

    // 2. Build an HTML table from the breakdown lines
    let tableHTML = `
      <table class="input-data">
        <thead>
          <tr><th>Field Name</th><th>Cost / Value</th></tr>
        </thead>
        <tbody>
    `;
    breakdownRows.forEach(row => {
      // Each row might look like "- Method Cost: $123.45"
      // Remove leading dashes/spaces
      const cleanedRow = row.replace(/^[\s\-]+/, '');
      // Split at the first colon
      if (cleanedRow.includes(':')) {
        const parts = cleanedRow.split(':');
        const field = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        tableHTML += `<tr><td>${field}</td><td>${value}</td></tr>`;
      }
    });
    tableHTML += '</tbody></table>';

    // 3. Open a new window for print
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upper Lateral Estimate Summary</title>
        <!-- Use streetprint.css (or your merged CSS) so it prints the same as street.js -->
        <link rel="stylesheet" href="brandprint.css" type="text/css">
      </head>
      <body>
        <header>
          <!-- Logo and heading -->
          <img src="${logoSrc}" alt="Logo" class="logo">
          <h1>Estimate Summary - Upper Sewer Lateral Solutions</h1>
        </header>
        <div class="summary">
          <!-- Insert the table we just built -->
          ${tableHTML}
          <!-- Add the final price below the table -->
          <p><strong>Final Bidding Price:</strong> ${finalPrice}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    // Trigger print after a short delay
    setTimeout(() => {
      printWindow.print();
      // printWindow.close(); // optionally close the window after printing
    }, 300);
}