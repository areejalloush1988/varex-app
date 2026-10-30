(() => {
  "use strict";

  const storageKey = "varex.trading.theme";
  const root = document.documentElement;
  const normalizeTheme = (value) => value === "light" ? "light" : "dark";

  function updateButtons() {
    const isLight = root.dataset.theme === "light";
    const label = isLight ? "الليلي" : "النهاري";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `تفعيل الوضع ${label}`);
      button.title = `تفعيل الوضع ${label}`;
      const icon = button.querySelector("[data-theme-icon]");
      const text = button.querySelector("[data-theme-label]");
      if (icon) icon.textContent = isLight ? "☾" : "☀";
      if (text) text.textContent = label;
    });
  }

  function applyTheme(value, persist = false) {
    const theme = normalizeTheme(value);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) {
      try { localStorage.setItem(storageKey, theme); } catch {}
    }
    updateButtons();
  }

  let savedTheme = "dark";
  try { savedTheme = localStorage.getItem(storageKey) || "dark"; } catch {}
  // Run in the document head so a saved daytime palette is applied before paint.
  applyTheme(savedTheme);

  document.addEventListener("DOMContentLoaded", updateButtons, { once: true });
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-theme-toggle]")) return;
    applyTheme(root.dataset.theme === "light" ? "dark" : "light", true);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) applyTheme(event.newValue);
  });
})();
