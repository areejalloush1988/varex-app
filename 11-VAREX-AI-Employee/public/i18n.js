(() => {
  'use strict';

  const STORAGE_KEY = 'varex-ai-locale-v1';
  const locales = [
    { code: 'ar', name: 'العربية', dir: 'rtl' },
    { code: 'en', name: 'English', dir: 'ltr' },
    { code: 'ur', name: 'اردو', dir: 'rtl' },
    { code: 'fa', name: 'فارسی', dir: 'rtl' },
    { code: 'zh', name: '中文', dir: 'ltr' },
    { code: 'ko', name: '한국어', dir: 'ltr' },
    { code: 'it', name: 'Italiano', dir: 'ltr' },
    { code: 'es', name: 'Español', dir: 'ltr' },
    { code: 'he', name: 'עברית', dir: 'rtl' },
    { code: 'fr', name: 'Français', dir: 'ltr' },
    { code: 'ru', name: 'Русский', dir: 'ltr' },
    { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  ];
  const localeByCode = new Map(locales.map(locale => [locale.code, locale]));
  let current = localeByCode.has(localStorage.getItem(STORAGE_KEY)) ? localStorage.getItem(STORAGE_KEY) : 'ar';
  let dictionary = {};

  function interpolate(value, variables = {}) {
    return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
  }

  function t(key, fallback = key, variables = {}) {
    return interpolate(dictionary[key] ?? fallback, variables);
  }

  function translate(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = t(element.dataset.i18n, element.textContent);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      element.placeholder = t(element.dataset.i18nPlaceholder, element.placeholder || '');
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(element => {
      element.setAttribute('aria-label', t(element.dataset.i18nAria, element.getAttribute('aria-label') || ''));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(element => {
      element.title = t(element.dataset.i18nTitle, element.title || '');
    });
  }

  function fillLocaleSelects() {
    document.querySelectorAll('[data-locale-select]').forEach(select => {
      const selected = current;
      select.replaceChildren(...locales.map(locale => {
        const option = document.createElement('option');
        option.value = locale.code;
        option.textContent = locale.name;
        return option;
      }));
      select.value = selected;
    });
  }

  async function setLocale(code, options = {}) {
    const locale = localeByCode.get(code) || localeByCode.get('ar');
    const response = await fetch(`/locales/${locale.code}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('LOCALE_LOAD_FAILED');
    const payload = await response.json();
    dictionary = payload.strings || {};
    current = locale.code;
    document.documentElement.lang = locale.code;
    document.documentElement.dir = locale.dir;
    document.body.dataset.locale = locale.code;
    if (options.persist !== false) localStorage.setItem(STORAGE_KEY, locale.code);
    fillLocaleSelects();
    translate(document);
    window.dispatchEvent(new CustomEvent('varex:localechange', { detail: { code: locale.code, dir: locale.dir } }));
    return locale.code;
  }

  async function initialize() {
    fillLocaleSelects();
    try { await setLocale(current, { persist: false }); }
    catch (_) {
      current = 'ar';
      dictionary = {};
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    }
  }

  const ready = initialize();
  window.VarexI18n = Object.freeze({ locales, ready, setLocale, translate, t, get locale() { return current; } });
})();
