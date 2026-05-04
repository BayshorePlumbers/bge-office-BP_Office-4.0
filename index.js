// index.js — launcher logic (search + category filters + favorites)
(function () {
  const searchInput = document.getElementById("bpSearchInput");
  const clearBtn = document.getElementById("bpClearBtn");
  const emptyState = document.getElementById("bpEmptyState");

  const cards = Array.from(document.querySelectorAll("#bpGrid .bp-card"));
  const filters = Array.from(document.querySelectorAll(".bp-filter"));

  const FAV_KEY = "bp_favorites_v1";
  let activeFilter = "all";

  function loadFavs() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveFavs(set) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
    } catch (_) {}
  }

  let favs = loadFavs();

  function setFilterUI(value) {
    filters.forEach((btn) => {
      const on = btn.getAttribute("data-filter") === value;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function applyFavUI() {
    cards.forEach((card) => {
      const id = card.getAttribute("data-id") || "";
      const isFav = id && favs.has(id);

      card.classList.toggle("is-favorite", isFav);

      const pin = card.querySelector(".bp-pin");
          if (pin) {
      pin.classList.toggle("is-on", isFav);   // ✅ makes star turn blue
      pin.setAttribute("aria-pressed", isFav ? "true" : "false");
      pin.setAttribute("title", isFav ? "Unpin" : "Pin");
    }
    });
  }

  function matchesFilter(card) {
    const id = (card.getAttribute("data-id") || "").trim();
    const cat = (card.getAttribute("data-cat") || "").trim().toLowerCase();

    if (activeFilter === "all") return true;
    if (activeFilter === "favorites") return id && favs.has(id);
    return cat === activeFilter;
  }

  function matchesSearch(card, q) {
    if (!q) return true;
    const hay = (
      (card.textContent || "") +
      " " +
      (card.getAttribute("data-keywords") || "")
    ).toLowerCase();
    return hay.includes(q);
  }

  function applyFilters() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const ok = matchesFilter(card) && matchesSearch(card, q);
      card.style.display = ok ? "" : "none";
      if (ok) visible += 1;
    });

    if (emptyState) {
      emptyState.classList.toggle("is-hidden", visible !== 0);
      emptyState.setAttribute("aria-hidden", visible !== 0 ? "true" : "false");
    }
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
    searchInput.addEventListener("change", applyFilters);
  }

  // Clear
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      activeFilter = "all";
      setFilterUI(activeFilter);
      applyFilters();
    });
  }

  // Category chips
  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-filter") || "all";
      setFilterUI(activeFilter);
      applyFilters();
    });
  });

  // Pins (favorites) — IMPORTANT: stop anchor navigation
  cards.forEach((card) => {
    const pin = card.querySelector(".bp-pin");
    if (!pin) return;

    pin.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const id = card.getAttribute("data-id") || "";
      if (!id) return;

      if (favs.has(id)) favs.delete(id);
      else favs.add(id);

      saveFavs(favs);
      applyFavUI();
      applyFilters();
    });

    pin.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Init
  setFilterUI(activeFilter);
  applyFavUI();
  applyFilters();
})();
