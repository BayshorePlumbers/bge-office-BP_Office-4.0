// send-pdf.js

function apiBase() {
  // Use configured base if provided (e.g., http://localhost:8080 when HTML is file:// or different origin)
  return (window.EXPENSE_SHEET_SETTINGS && window.EXPENSE_SHEET_SETTINGS.apiBase) || "";
}

function ensurePrintAreaUpToDate() {
  if (typeof window.refreshPrintArea === "function") {
    try { window.refreshPrintArea(); } catch (e) { console.warn("refreshPrintArea failed", e); }
  }
}

// ----- helpers -----
function getPdfSourceEl() {
  const sel = window.EXPENSE_SHEET_SETTINGS?.pdfSelector || "#print-area";
  return document.querySelector(sel) || document.body;
}

// Branding wrapper (PDF only; Print remains untouched)
function buildPdfDomForExport() {
  const src = getPdfSourceEl();
  const clone = src.cloneNode(true);

  const wrap = document.createElement("div");
  wrap.style.padding = "12pt";
  wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";

  const branding = window.EXPENSE_SHEET_SETTINGS?.pdfBranding;
  if (branding?.enable) {
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "12pt";
    header.style.marginBottom = "8pt";
    header.innerHTML = `
      <img src="${branding.logoSrc}" alt="Bayshore" style="height:48px;"/>
      <div style="font-weight:700;font-size:14pt">${window.EXPENSE_SHEET_SETTINGS?.appName || ""}</div>
    `;
    wrap.appendChild(header);
  }

  wrap.appendChild(clone);

  if (branding?.enable) {
    const footer = document.createElement("div");
    footer.style.marginTop = "12pt";
    footer.style.fontSize = "9pt";
    footer.style.textAlign = "center";
    footer.style.opacity = "0.8";
    footer.textContent = branding.footerText || "";
    wrap.appendChild(footer);
  }

  return wrap;
}

function htmlToPdfBytes() {
  return new Promise((resolve, reject) => {
    // NEW: build hidden print content first
    ensurePrintAreaUpToDate();

    const srcEl = buildPdfDomForExport();
    const opt = {
      margin: [10,10,10,10],
      filename: (window.EXPENSE_SHEET_SETTINGS?.filename?.() || "Bayshore_Field_Ticket.pdf"),
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "pt", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] } // helps multipage
    };
    html2pdf().from(srcEl).set(opt).toPdf().get("pdf").then(pdf => {
      const arr = pdf.output("arraybuffer");
      resolve(new Uint8Array(arr));
    }).catch(reject);
  });
}

async function makePdfBase64() {
  const bytes = await htmlToPdfBytes();
  return btoa(String.fromCharCode(...bytes));
}

// ----- Actions -----
// "Download PDF" → save to Google Drive (per your requirement)
async function downloadPdf() {
  try {
    const filename = window.EXPENSE_SHEET_SETTINGS?.filename?.() || "Bayshore_Field_Ticket.pdf";
    const base64 = await makePdfBase64();

    const res = await fetch(`${apiBase()}/api/upload-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, pdfBase64: base64 })
    });

    if (!res.ok) throw new Error(`Upload failed ${res.status}`);
    const out = await res.json();
    alert("Saved to Google Drive.\n\nOpen link:\n" + out.url);
  } catch (err) {
    console.error(err);
    alert("Could not save PDF to Drive.");
  }
}

async function sendPdfToManagers() {
  try {
    const filename = window.EXPENSE_SHEET_SETTINGS?.filename?.() || "Bayshore_Field_Ticket.pdf";
    const base64 = await makePdfBase64();
    const recipients = window.EXPENSE_SHEET_RECIPIENTS || { phones: [], emails: [] };
    const subject = window.EXPENSE_SHEET_SETTINGS?.emailSubject || "New Field Ticket";
    const body = window.EXPENSE_SHEET_SETTINGS?.emailBody || "See attached and link.";

    const res = await fetch(`${apiBase()}/api/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        pdfBase64: base64,
        recipients,
        emailSubject: subject,
        emailBody: body
      })
    });

    if (!res.ok) throw new Error(`Send failed ${res.status}`);
    const out = await res.json();
    alert("Sent! Link: " + out.url);
  } catch (err) {
    console.error(err);
    alert("Could not send PDF.");
  }
}
