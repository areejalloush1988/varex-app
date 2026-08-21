
/* =========================================================
   VAREX CENTRAL NAVIGATION
   File: varex-navigation.js
   مسؤول عن القائمة المركزية والتنقل وتحديد الصفحة النشطة
========================================================= */

(function () {
  "use strict";

  const VAREX_NAVIGATION = {
    feedbackKeys: {
      sound: "varex_sound_enabled",
      vibration: "varex_vibration_enabled"
    },

    feedbackLevelKeys: {
      sound: "varex_sound_level",
      vibration: "varex_vibration_level"
    },

    pages: [
      {
        id: "dashboard",
        title: "لوحة التحكم",
        titleEn: "Dashboard",
        icon: "▦",
        href: "./index.html"
      },
      {
        id: "pos",
        title: "شاشة المبيعات",
        titleEn: "Point of Sale",
        icon: "🛒",
        href: "./pos.html"
      },
      {
        id: "products",
        title: "المنتجات والمخزون",
        titleEn: "Products & Inventory",
        icon: "📦",
        href: "./products.html"
      },
      {
        id: "purchases",
        title: "المشتريات",
        titleEn: "Purchases",
        icon: "🧾",
        href: "./purchases.html"
      },
      {
        id: "suppliers",
        title: "الموردون",
        titleEn: "Suppliers",
        icon: "🚚",
        href: "./suppliers.html"
      },
      {
        id: "customers",
        title: "العملاء",
        titleEn: "Customers",
        icon: "👥",
        href: "./customers.html"
      },
      {
        id: "accounts",
        title: "الحسابات",
        titleEn: "Accounts",
        icon: "💰",
        href: "./accounts.html"
      },
      {
        id: "employees",
        title: "الموظفون",
        titleEn: "Employees",
        icon: "👤",
        href: "./employees.html"
      },
      {
        id: "branches",
        title: "الفروع",
        titleEn: "Branches",
        icon: "🏢",
        href: "./branches.html"
      },
      {
        id: "transfers",
        title: "تحويلات المخزون",
        titleEn: "Stock Transfers",
        icon: "🔄",
        href: "./transfers.html"
      },
      {
        id: "shifts",
        title: "الورديات",
        titleEn: "Shifts",
        icon: "🕒",
        href: "./shifts.html"
      },
      {
        id: "reports",
        title: "التقارير",
        titleEn: "Reports",
        icon: "📊",
        href: "./reports.html"
      },
      {
        id: "tax-return",
        title: "الإقرار الضريبي",
        titleEn: "Tax Return",
        icon: "🧮",
        href: "./tax-return.html"
      },
      {
        id: "users",
        title: "المستخدمون والصلاحيات",
        titleEn: "Users & Permissions",
        icon: "👥",
        href: "./users.html"
      },
      {
        id: "notifications",
        title: "الإشعارات",
        titleEn: "Notifications",
        icon: "🔔",
        href: "./notifications.html"
      },
      {
        id: "activity",
        title: "سجل النشاط",
        titleEn: "Activity Log",
        icon: "📋",
        href: "./activity.html"
      },
      {
        id: "subscription",
        title: "الاشتراك والترخيص",
        titleEn: "Subscription & Licensing",
        icon: "💎",
        href: "./subscription.html"
      },
      {
        id: "settings",
        title: "الإعدادات",
        titleEn: "Settings",
        icon: "⚙️",
        href: "./setting.html"
      }
    ],

    feedbackLevel(type) {
      const key = this.feedbackLevelKeys[type];
      if (!key) return "off";
      const saved = localStorage.getItem(key);
      if (["off", "low", "high"].includes(saved)) return saved;

      const legacy = localStorage.getItem(this.feedbackKeys[type]);
      if (legacy === "0") return "off";
      return type === "sound" ? "high" : "low";
    },

    feedbackEnabled(type) {
      return this.feedbackLevel(type) !== "off";
    },

    setFeedbackLevel(type, level) {
      if (!this.feedbackLevelKeys[type] || !["off", "low", "high"].includes(level)) return;
      localStorage.setItem(this.feedbackLevelKeys[type], level);
      localStorage.setItem(this.feedbackKeys[type], level === "off" ? "0" : "1");
    },

    setFeedbackEnabled(type, enabled) {
      this.setFeedbackLevel(type, enabled ? (type === "sound" ? "high" : "low") : "off");
    },

    currentLanguage() {
      return window.VAREXI18N?.getLanguage?.() === "en" ||
        localStorage.getItem("varex_language") === "en"
        ? "en"
        : "ar";
    },

    feedbackIcon(type, level) {
      const enabled = level !== "off";
      if (type === "sound") {
        return enabled
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4z"/><path d="m17 10 5 5M22 10l-5 5"/></svg>';
      }
      return enabled
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 7h4M3 9l-1 3 1 3M21 9l1 3-1 3M10 17h4"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 7h4M10 17h4M4 4l16 16"/></svg>';
    },

    feedbackLabel(type, level, language = this.currentLanguage()) {
      const labels = {
        sound: {
          ar: { off: "الصوت متوقف", low: "الصوت منخفض", high: "الصوت مرتفع" },
          en: { off: "Sound Off", low: "Low Sound", high: "High Sound" }
        },
        vibration: {
          ar: { off: "الاهتزاز متوقف", low: "اهتزاز خفيف", high: "اهتزاز قوي" },
          en: { off: "Vibration Off", low: "Light Vibration", high: "Strong Vibration" }
        }
      };
      return labels[type]?.[language]?.[level] || level;
    },

    playFeedbackSound(kind = "tap", force = false) {
      const level = this.feedbackLevel("sound");
      if (!force && level === "off") return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        if (!this.feedbackAudioContext) {
          this.feedbackAudioContext = new AudioContextClass();
        }
        const context = this.feedbackAudioContext;
        const play = () => {
          const now = context.currentTime;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const tones = {
            tap: [560, 0.045, 0.034],
            enabled: [720, 0.08, 0.046],
            disabled: [330, 0.07, 0.04],
            success: [820, 0.12, 0.052],
            notification: [680, 0.15, 0.052],
            warning: [280, 0.14, 0.048]
          };
          const [frequency, duration, baseVolume] = tones[kind] || tones.tap;
          const effectiveLevel = level === "off" && force ? "high" : level;
          const volume = Math.min(0.12, baseVolume * (effectiveLevel === "high" ? 1.75 : 0.78));
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(now);
          oscillator.stop(now + duration + 0.01);
        };

        if (context.state === "suspended") {
          context.resume().then(play).catch(() => {});
        } else {
          play();
        }
      } catch (error) {
        console.debug("VAREX feedback sound unavailable", error);
      }
    },

    playFeedbackVibration(pattern = 12, force = false) {
      const level = this.feedbackLevel("vibration");
      if (level === "off") return;
      if (!force && !this.feedbackEnabled("vibration")) return;
      if (typeof navigator.vibrate !== "function") return;
      try {
        const scale = level === "high" ? 2.25 : 0.8;
        const adjusted = Array.isArray(pattern)
          ? pattern.map((value, index) => index % 2 === 0 ? Math.max(8, Math.round(value * scale)) : value)
          : Math.max(8, Math.round(Number(pattern || 12) * scale));
        navigator.vibrate(adjusted);
      } catch (error) {
        console.debug("VAREX vibration unavailable", error);
      }
    },

    playInteractionVibration(pattern = 12) {
      this.playFeedbackVibration(pattern);
    },

    updateFeedbackControls() {
      const language = this.currentLanguage();
      document.querySelectorAll("[data-varex-feedback-toggle]").forEach(button => {
        const type = button.dataset.varexFeedbackToggle;
        const level = this.feedbackLevel(type);
        const enabled = level !== "off";
        const label = this.feedbackLabel(type, level, language);
        button.classList.toggle("is-enabled", enabled);
        button.dataset.level = level;
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        button.innerHTML = this.feedbackIcon(type, level) +
          '<span class="varex-feedback-level" aria-hidden="true">' +
          (level === "high" ? "H" : level === "low" ? "L" : "×") +
          '</span><span class="varex-feedback-arrow" aria-hidden="true">⌄</span>';
      });

      document.querySelectorAll("[data-varex-feedback-option]").forEach(option => {
        const type = option.dataset.varexFeedbackType;
        const level = option.dataset.varexFeedbackOption;
        option.textContent = this.feedbackLabel(type, level, language);
        option.classList.toggle("is-selected", this.feedbackLevel(type) === level);
      });
    },

    setupFeedbackControls() {
      const topInfo = document.querySelector(".topbar .top-info");
      if (!topInfo || topInfo.querySelector(".varex-feedback-controls")) return;

      const controls = document.createElement("div");
      controls.className = "varex-feedback-controls";
      controls.setAttribute("data-varex-no-translate", "true");

      ["vibration", "sound"].forEach(type => {
        const selector = document.createElement("div");
        selector.className = "varex-feedback-selector";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "varex-feedback-button";
        button.dataset.varexFeedbackToggle = type;
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          document.querySelectorAll(".varex-feedback-selector.open").forEach(item => {
            if (item !== selector) item.classList.remove("open");
          });
          selector.classList.toggle("open");
        });

        const menu = document.createElement("div");
        menu.className = "varex-feedback-menu";
        ["off", "low", "high"].forEach(level => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "varex-feedback-option";
          option.dataset.varexFeedbackType = type;
          option.dataset.varexFeedbackOption = level;
          option.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            this.setFeedbackLevel(type, level);
            selector.classList.remove("open");
            if (type === "sound") this.playFeedbackSound(level === "off" ? "disabled" : "enabled", true);
            if (type === "vibration" && level !== "off") this.playFeedbackVibration(20, true);
            if (type === "vibration") this.playFeedbackSound("tap");
            this.updateFeedbackControls();
            window.dispatchEvent(new CustomEvent("varex-feedback-changed", {
              detail: {
                sound: this.feedbackEnabled("sound"),
                vibration: this.feedbackEnabled("vibration"),
                soundLevel: this.feedbackLevel("sound"),
                vibrationLevel: this.feedbackLevel("vibration")
              }
            }));
          });
          menu.appendChild(option);
        });

        selector.append(button, menu);
        controls.appendChild(selector);
      });

      const languageControl = topInfo.querySelector(".language-selector, .varex-i18n-switch");
      if (languageControl) languageControl.after(controls);
      else topInfo.prepend(controls);

      this.updateFeedbackControls();

      if (!document.documentElement.dataset.varexFeedbackReady) {
        document.documentElement.dataset.varexFeedbackReady = "true";
        document.addEventListener("pointerdown", event => {
          if (event.button !== undefined && event.button !== 0) return;
          const target = event.target.closest?.(
            'a[href],button,[role="button"],select,input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],.module'
          );
          if (!target || target.disabled || target.closest(".varex-feedback-controls,.language-selector")) return;
          this.playFeedbackSound("tap");
          // Page navigation stays physically steady; vibration remains available
          // for actions and controls according to the selected feedback level.
          if (!target.closest('a[href],.sidebar .nav')) this.playInteractionVibration(10);
        }, { passive: true, capture: true });
      }

      window.addEventListener("storage", () => this.updateFeedbackControls());
      window.addEventListener("varex-language-changed", () => this.updateFeedbackControls());
      document.addEventListener("click", () => {
        document.querySelectorAll(".varex-feedback-selector.open").forEach(item => item.classList.remove("open"));
      });
      window.VAREX_FEEDBACK = {
        tap: () => {
          this.playFeedbackSound("tap");
          this.playInteractionVibration(10);
        },
        success: () => {
          this.playFeedbackSound("success");
          this.playFeedbackVibration([18, 35, 22]);
        },
        notification: () => {
          this.playFeedbackSound("notification");
          this.playFeedbackVibration([20, 45, 20]);
        },
        warning: () => {
          this.playFeedbackSound("warning");
          this.playFeedbackVibration([35, 55, 35]);
        },
        soundEnabled: () => this.feedbackEnabled("sound"),
        vibrationEnabled: () => this.feedbackEnabled("vibration"),
        soundLevel: () => this.feedbackLevel("sound"),
        vibrationLevel: () => this.feedbackLevel("vibration")
      };
    },

    updateUnifiedHeader() {
      const language = this.currentLanguage();
      const system = document.querySelector("[data-varex-header-system]");
      const switchUser = document.querySelector("[data-varex-header-switch-user]");
      const languageName = document.getElementById("currentLanguage");
      const languageButton = document.getElementById("languageButton");

      if (system) system.querySelector("span:last-child").textContent = language === "en" ? "System" : "النظام";
      if (switchUser) switchUser.querySelector("span:last-child").textContent = language === "en" ? "Switch User" : "تبديل المستخدم";
      if (languageName) languageName.textContent = language === "en" ? "English" : "العربية";
      if (languageButton) languageButton.setAttribute("aria-label", language === "en" ? "Select language" : "اختيار اللغة");

      document.querySelectorAll(".language-option[data-language]").forEach(option => {
        option.classList.toggle("active", option.dataset.language === language);
      });
      document.querySelectorAll('input[type="date"],input[type="datetime-local"],input[type="time"]').forEach(input => {
        input.lang = language === "en" ? "en-GB" : "ar-AE";
      });
      this.updateFeedbackControls();
    },

    setupUnifiedHeader() {
      if (window.Capacitor?.isNativePlatform?.()) return;
      const topInfo = document.querySelector(".topbar .top-info");
      if (!topInfo || topInfo.dataset.varexUnified === "true") return;

      topInfo.dataset.varexUnified = "true";
      topInfo.classList.add("varex-unified-header");

      const time = document.createElement("div");
      time.className = "info-chip varex-header-clock varex-header-time";
      time.id = "currentTime";
      time.textContent = "—";

      const date = document.createElement("div");
      date.className = "info-chip varex-header-clock varex-header-date";
      date.id = "currentDate";
      date.textContent = "—";

      const system = document.createElement("a");
      system.className = "info-chip varex-header-action varex-header-system";
      system.href = "./systems.html";
      system.dataset.varexHeaderSystem = "true";
      system.setAttribute("data-varex-no-translate", "true");
      system.innerHTML = '<span aria-hidden="true">▦</span><span>النظام</span>';
      system.addEventListener("click", () => sessionStorage.removeItem("varex_active_system"));

      const switchUser = document.createElement("button");
      switchUser.type = "button";
      switchUser.className = "info-chip varex-header-action varex-top-switch-user";
      switchUser.dataset.varexHeaderSwitchUser = "true";
      switchUser.setAttribute("data-varex-no-translate", "true");
      switchUser.innerHTML = '<span aria-hidden="true">👥</span><span>تبديل المستخدم</span>';
      switchUser.addEventListener("click", event => {
        event.preventDefault();
        if (typeof window.varexSwitchUser === "function") window.varexSwitchUser();
        else location.href = "./users.html";
      });

      const languageSelector = document.createElement("div");
      languageSelector.className = "language-selector varex-header-language";
      languageSelector.id = "languageSelector";
      languageSelector.setAttribute("data-varex-no-translate", "true");
      languageSelector.innerHTML =
        '<button type="button" class="language-button" id="languageButton" aria-haspopup="true" aria-expanded="false">' +
          '<span aria-hidden="true">🌐</span><span id="currentLanguage">العربية</span><span class="language-arrow" aria-hidden="true">▼</span>' +
        '</button>' +
        '<div class="language-menu" role="menu">' +
          '<button type="button" class="language-option" data-language="ar" role="menuitem"><span>العربية</span><span class="language-code">AR</span></button>' +
          '<button type="button" class="language-option" data-language="en" role="menuitem"><span>English</span><span class="language-code">EN</span></button>' +
        '</div>';

      const languageButton = languageSelector.querySelector("#languageButton");
      languageButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const open = languageSelector.classList.toggle("open");
        languageButton.setAttribute("aria-expanded", String(open));
      });
      languageSelector.querySelectorAll(".language-option").forEach(option => {
        option.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const next = option.dataset.language === "en" ? "en" : "ar";
          languageSelector.classList.remove("open");
          languageButton.setAttribute("aria-expanded", "false");
          localStorage.setItem("varex_language", next);
          localStorage.setItem("varex_launcher_language", next);
          if (window.VAREXI18N?.setLanguage) window.VAREXI18N.setLanguage(next);
          else location.reload();
        });
      });

      const legacyUsers = document.createElement("span");
      legacyUsers.className = "varex-header-legacy-users";
      legacyUsers.setAttribute("aria-hidden", "true");
      legacyUsers.innerHTML = '<span id="topUserName"></span><span id="currentUserName"></span><span id="settingsUserName"></span><span id="currentAccount"></span><span id="currentUser"></span>';

      topInfo.replaceChildren(time, date, system, switchUser, languageSelector, legacyUsers);
      document.addEventListener("click", event => {
        if (!languageSelector.contains(event.target)) {
          languageSelector.classList.remove("open");
          languageButton.setAttribute("aria-expanded", "false");
        }
      });
      window.addEventListener("varex-language-changed", () => {
        this.render();
        this.updateUnifiedHeader();
      });
      this.updateUnifiedHeader();
    },

    normalizeFileName(path) {
      let value = String(path || "")
        .split("?")[0]
        .split("#")[0]
        .replace(/\\/g, "/");

      value = value.substring(value.lastIndexOf("/") + 1);

      if (!value) value = "index.html";

      return decodeURIComponent(value).toLowerCase();
    },

    getCurrentPage() {
      return this.normalizeFileName(window.location.pathname);
    },

    isActive(pageHref) {
      const current = this.getCurrentPage();
      const target = this.normalizeFileName(pageHref);

      if (current === target) return true;

      if (
        (current === "" || current === "/") &&
        target === "index.html"
      ) {
        return true;
      }

      return false;
    },

    createItem(page) {
      const link = document.createElement("a");

      link.href = page.href;
      link.dataset.varexPage = page.id;

      if (this.isActive(page.href)) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.textContent = page.icon;

      const title = document.createElement("span");
      title.className = "nav-title";
      title.textContent = this.currentLanguage() === "en" ? page.titleEn : page.title;

      link.appendChild(icon);
      link.appendChild(title);

      return link;
    },

    render() {
      const nav = document.querySelector(".sidebar .nav");

      if (!nav) return;

      const savedScroll = Number(sessionStorage.getItem("varex_sidebar_scroll") || nav.scrollTop || 0);

      nav.innerHTML = "";

      const fragment = document.createDocumentFragment();

      this.pages.forEach(page => {
        fragment.appendChild(this.createItem(page));
      });

      nav.appendChild(fragment);
      requestAnimationFrame(() => {
        nav.scrollTop = savedScroll;
      });

      if (!nav.dataset.varexScrollMemory) {
        nav.dataset.varexScrollMemory = "true";
        nav.addEventListener("scroll", () => {
          sessionStorage.setItem("varex_sidebar_scroll", String(nav.scrollTop));
        }, { passive: true });
      }
    },

    refreshActive() {
      const current = this.getCurrentPage();

      document
        .querySelectorAll(".sidebar .nav a")
        .forEach(link => {
          const target = this.normalizeFileName(
            link.getAttribute("href")
          );

          const active = current === target;

          link.classList.toggle("active", active);

          if (active) {
            link.setAttribute("aria-current", "page");
          } else {
            link.removeAttribute("aria-current");
          }
        });
    },

    setupMobileDrawer() {
      const sidebar = document.querySelector(".sidebar");
      const topbar = document.querySelector(".topbar");

      if (!sidebar || !topbar) return;
      if (document.querySelector(".varex-mobile-menu-button")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "varex-mobile-menu-button";
      button.setAttribute("aria-label", "فتح القائمة الرئيسية");
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = "<span aria-hidden=\"true\">☰</span>";

      const backdrop = document.createElement("div");
      backdrop.className = "varex-mobile-backdrop";
      backdrop.setAttribute("aria-hidden", "true");

      const setOpen = open => {
        document.body.classList.toggle("varex-menu-open", Boolean(open));
        button.setAttribute("aria-expanded", open ? "true" : "false");
        button.setAttribute(
          "aria-label",
          open ? "إغلاق القائمة الرئيسية" : "فتح القائمة الرئيسية"
        );
        button.querySelector("span").textContent = open ? "×" : "☰";
      };

      button.addEventListener("click", () => {
        setOpen(!document.body.classList.contains("varex-menu-open"));
      });

      backdrop.addEventListener("click", () => setOpen(false));
      sidebar.addEventListener("click", event => {
        if (event.target.closest("a")) setOpen(false);
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
      });

      const desktopQuery = window.matchMedia("(min-width: 821px)");
      const resetDesktop = event => {
        if (event.matches) setOpen(false);
      };
      if (desktopQuery.addEventListener) {
        desktopQuery.addEventListener("change", resetDesktop);
      } else if (desktopQuery.addListener) {
        desktopQuery.addListener(resetDesktop);
      }

      topbar.prepend(button);
      document.body.appendChild(backdrop);
    },

    setupMobileHeader() {
      const topbar = document.querySelector(".topbar");
      const topInfo = topbar?.querySelector(".top-info");

      if (!topbar || !topInfo) return;

      topbar.classList.add("varex-compact-mobile-header");
      topInfo.classList.add("varex-mobile-top-info");

      // Some legacy pages force these properties inline. The central mobile
      // header owns them now so every page behaves consistently.
      ["display", "visibility", "opacity", "width"].forEach(property => {
        topInfo.style.removeProperty(property);
      });

      const formatClock = () => {
        const now = new Date();
        const dateElement = document.getElementById("currentDate");
        const timeElement = document.getElementById("currentTime");
        const setClockText = (element, value) => {
          if (element && element.textContent !== value) {
            element.textContent = value;
          }
        };

        try {
          const dateParts = Object.fromEntries(
            new Intl.DateTimeFormat("en-GB", {
              timeZone: "Asia/Dubai",
              year: "numeric",
              month: "2-digit",
              day: "2-digit"
            })
              .formatToParts(now)
              .map(part => [part.type, part.value])
          );
          const timeParts = Object.fromEntries(
            new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Dubai",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true
            })
              .formatToParts(now)
              .map(part => [part.type, part.value])
          );

          if (dateElement) {
            setClockText(
              dateElement,
              `${dateParts.day}/${dateParts.month}/${dateParts.year}`
            );
          }
          if (timeElement) {
            setClockText(
              timeElement,
              `${timeParts.hour}:${timeParts.minute} ${String(timeParts.dayPeriod || "").toUpperCase()}`
            );
          }
        } catch (error) {
          if (dateElement) {
            setClockText(dateElement, now.toLocaleDateString("en-GB"));
          }
          if (timeElement) {
            setClockText(
              timeElement,
              now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
              })
            );
          }
        }
      };

      const classifyHeaderItems = () => {
        Array.from(topInfo.children).forEach(item => {
          const itemIsClock = item.id === "currentDate" || item.id === "currentTime";
          const clockValue = itemIsClock
            ? item
            : item.querySelector("#currentDate, #currentTime");

          item.classList.toggle("varex-mobile-clock-chip", Boolean(clockValue));
          item.classList.toggle("varex-mobile-aux-chip", !clockValue);
          item.classList.toggle(
            "varex-date-chip",
            Boolean(clockValue?.id === "currentDate")
          );
          item.classList.toggle(
            "varex-time-chip",
            Boolean(clockValue?.id === "currentTime")
          );
          item.classList.toggle(
            "varex-mobile-clock-wrapper",
            Boolean(clockValue && clockValue !== item)
          );

          if (clockValue && clockValue !== item) {
            Array.from(item.childNodes).forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
          }
        });
      };

      classifyHeaderItems();
      formatClock();

      if (!topInfo.__varexHeaderObserver) {
        topInfo.__varexHeaderObserver = new MutationObserver(classifyHeaderItems);
        topInfo.__varexHeaderObserver.observe(topInfo, { childList: true });
      }

      if (!topInfo.__varexClockObserver) {
        topInfo.__varexClockObserver = new MutationObserver(formatClock);
        [
          document.getElementById("currentDate"),
          document.getElementById("currentTime")
        ]
          .filter(Boolean)
          .forEach(element => {
            topInfo.__varexClockObserver.observe(element, {
              childList: true,
              characterData: true,
              subtree: true
            });
          });
      }

      if (!window.__varexUnifiedClockTimer) {
        window.__varexUnifiedClockTimer = window.setInterval(formatClock, 1000);
      }
    },

    setupNativeBackButton() {
      const appPlugin = window.Capacitor?.Plugins?.App;
      if (!appPlugin?.addListener || window.__varexNativeBackReady) return;

      window.__varexNativeBackReady = true;
      appPlugin.addListener("backButton", ({ canGoBack } = {}) => {
        if (document.body.classList.contains("varex-menu-open")) {
          document.body.classList.remove("varex-menu-open");
          const button = document.querySelector(".varex-mobile-menu-button");
          if (button) {
            button.setAttribute("aria-expanded", "false");
            button.setAttribute("aria-label", "فتح القائمة الرئيسية");
            const icon = button.querySelector("span");
            if (icon) icon.textContent = "☰";
          }
          return;
        }

        if (canGoBack || history.length > 1) {
          history.back();
        } else if (appPlugin.exitApp) {
          appPlugin.exitApp();
        }
      });
    },

    init() {
      this.render();
      this.refreshActive();
      this.setupMobileDrawer();
      this.setupUnifiedHeader();
      this.setupFeedbackControls();
      this.setupMobileHeader();
      if (window.Capacitor?.isNativePlatform?.()) {
        document.documentElement.classList.add("varex-native-app");
      }
      this.setupNativeBackButton();
      if(typeof varexAddSidebarActions==="function")varexAddSidebarActions();

      document.documentElement.classList.add(
        "varex-navigation-ready"
      );
    }
  };

  window.VAREX_NAVIGATION = VAREX_NAVIGATION;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => VAREX_NAVIGATION.init(),
      { once: true }
    );
  } else {
    VAREX_NAVIGATION.init();
  }
})();
