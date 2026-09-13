(() => {
  "use strict";

  const THEME_KEY = "varex_pharmacy_theme";
  const LANGUAGE_KEY = "varex_pharmacy_language";
  const SOUND_KEY = "varex_pharmacy_sound";
  const languageButton = document.getElementById("languageButton");
  const languageLabel = document.getElementById("languageLabel");
  const themeButton = document.getElementById("themeButton");
  const themeLabel = document.getElementById("themeLabel");
  const soundLabel = document.getElementById("soundLabel");

  let language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ar";
  let theme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";

  function refreshControlLabels() {
    const soundOn = localStorage.getItem(SOUND_KEY) !== "off";
    languageLabel.textContent = language === "ar" ? "العربية" : "English";
    themeLabel.textContent = language === "ar"
      ? (theme === "dark" ? "المظهر الداكن" : "المظهر الفاتح")
      : (theme === "dark" ? "Dark theme" : "Light theme");
    soundLabel.textContent = language === "ar"
      ? (soundOn ? "الصوت" : "صامت")
      : (soundOn ? "Sound" : "Muted");
  }

  function applyLanguage(nextLanguage) {
    language = nextLanguage === "en" ? "en" : "ar";
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
    document.body.dataset.language = language;
    document.querySelectorAll("[data-ar][data-en]").forEach(node => {
      node.textContent = language === "ar" ? node.dataset.ar : node.dataset.en;
    });
    refreshControlLabels();
  }

  function applyTheme(nextTheme) {
    theme = nextTheme === "dark" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, theme);
    document.body.classList.toggle("theme-dark", theme === "dark");
    themeButton.classList.toggle("active", theme === "dark");
    themeButton.setAttribute("aria-pressed", String(theme === "dark"));
    refreshControlLabels();
  }

  languageButton?.addEventListener("click", () => applyLanguage(language === "ar" ? "en" : "ar"));
  themeButton?.addEventListener("click", () => applyTheme(theme === "light" ? "dark" : "light"));
  document.getElementById("soundToggle")?.addEventListener("click", () => setTimeout(refreshControlLabels, 0));

  applyTheme(theme);
  applyLanguage(language);
})();
