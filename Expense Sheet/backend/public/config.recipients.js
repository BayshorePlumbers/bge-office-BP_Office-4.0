// config.recipients.js
window.EXPENSE_SHEET_RECIPIENTS = {
  phones: [
    "+16504415961", // Jesus (Ops)
    "+16503156549", // Marin (GM)
    "+16505182254", // Luis (Supply)
    "+12038029476"  // Ali (Office)
  ],
  emails: [
    "jesus@bayshoreplumbers.com",
    "marin@bayshoreplumbers.com",
    "luis@bayshoreplumbers.com",
    "ali@bayshoreplumbers.com",
    "solutions@bayshoreplumbers.com"
  ]
};

window.EXPENSE_SHEET_SETTINGS = {
  appName: "Bayshore M.E.P. Cart",
  pdfSelector: "#print-area", // if not found, send-pdf.js will fall back to document.body

  // Set API base if your page is NOT served from the same origin as the backend.
  // If you're opening the HTML as a file:// or from a different port, uncomment this line:
 apiBase: "http://localhost:8080",

  // Build filename: YYYYMMDD_Technician Name_Job Address.pdf
  filename: () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const yyyymmdd = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;

    const tech =
      (document.querySelector("#technician-name")?.value ||
       document.querySelector("[data-tech-name]")?.textContent ||
       document.querySelector(".tech-name")?.textContent ||
       "Technician").trim().replace(/\s+/g, " ");

    const addr =
      (document.querySelector("#job-address")?.value ||
       document.querySelector("[data-job-address]")?.textContent ||
       document.querySelector(".job-address")?.textContent ||
       "Job Address").trim().replace(/\s+/g, " ");

    const safe = (s) => s.replace(/[\/\\:*?\"<>|]/g, " ").trim();
    return `${yyyymmdd}_${safe(tech)}_${safe(addr)}.pdf`;
  },

  pdfBranding: {
    enable: true,
    logoSrc: "BP.png", // ensure BP.png is alongside your HTML
    footerText: "© Bayshore Plumbers 2025 • All rights reserved"
  },

  emailSubject: "New Field Materials & Expense Ticket",
  emailBody: "Team, a new field ticket has been submitted. PDF attached and link included."
};
