/* bp-ui.js — Bayshore shared UI helpers (starter, no dependencies) */
(function () {
  // ---- Date chip helper ----
  const dateChip = document.getElementById("bpDateChip");
  if (dateChip) {
    const now = new Date();
    dateChip.textContent = now.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  // ---- Image fallback helper ----
  // Use: <img data-bp-fallback="assets/img/thumbnails/BP.png" ...>
  document.querySelectorAll("img").forEach((img) => {
    const fallback = img.getAttribute("data-bp-fallback");
    if (!fallback) return;

    img.addEventListener(
      "error",
      () => {
        img.src = fallback;
      },
      { once: true }
    );
  });

  // ---- Focus-select helper (for calculators later) ----
  // Apply to inputs with: class="bp-selectall"
  function selectAllOnFocus(e) {
    const el = e.target;
    if (!el || typeof el.select !== "function") return;
    try { el.select(); } catch (_) {}
  }
  document.addEventListener("focusin", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("bp-selectall")) {
      selectAllOnFocus(e);
    }
  });

  // ---- Optional search filter helper (index-style) ----
  // Mark container items with: data-bp-filter-item and data-keywords
  const search = document.getElementById("bpSearchInput");
  if (search) {
    const items = Array.from(document.querySelectorAll("[data-bp-filter-item]"));
    const apply = () => {
      const q = (search.value || "").trim().toLowerCase();
      items.forEach((item) => {
        const hay = ((item.textContent || "") + " " + (item.getAttribute("data-keywords") || "")).toLowerCase();
        item.style.display = hay.includes(q) ? "" : "none";
      });
    };
    search.addEventListener("input", apply);
  }
})();
