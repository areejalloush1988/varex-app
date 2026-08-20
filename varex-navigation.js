
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

    pages: [
      {
        id: "dashboard",
        title: "لوحة التحكم",
        icon: "▦",
        href: "./index.html"
      },
      {
        id: "pos",
        title: "شاشة المبيعات",
        icon: "🛒",
        href: "./pos.html"
      },
      {
        id: "products",
        title: "المنتجات والمخزون",
        icon: "📦",
        href: "./products.html"
      },
      {
        id: "purchases",
        title: "المشتريات",
        icon: "🧾",
        href: "./purchases.html"
      },
      {
        id: "suppliers",
        title: "الموردون",
        icon: "🚚",
        href: "./suppliers.html"
      },
      {
        id: "customers",
        title: "العملاء",
        icon: "👥",
        href: "./customers.html"
      },
      {
        id: "accounts",
        title: "الحسابات",
        icon: "💰",
        href: "./accounts.html"
      },
      {
        id: "employees",
        title: "الموظفون",
        icon: "👤",
        href: "./employees.html"
      },
      {
        id: "branches",
        title: "الفروع",
        icon: "🏢",
        href: "./branches.html"
      },
      {
        id: "transfers",
        title: "تحويلات المخزون",
        icon: "🔄",
        href: "./transfers.html"
      },
      {
        id: "shifts",
        title: "الورديات",
        icon: "🕒",
        href: "./shifts.html"
      },
      {
        id: "reports",
        title: "التقارير",
        icon: "📊",
        href: "./reports.html"
      },
      {
        id: "tax-return",
        title: "الإقرار الضريبي",
        icon: "🧮",
        href: "./tax-return.html"
      },
      {
        id: "users",
        title: "المستخدمون والصلاحيات",
        icon: "👥",
        href: "./users.html"
      },
      {
        id: "notifications",
        title: "الإشعارات",
        icon: "🔔",
        href: "./notifications.html"
      },
      {
        id: "activity",
        title: "سجل النشاط",
        icon: "📋",
        href: "./activity.html"
      },
      {
        id: "subscription",
        title: "الاشتراك والترخيص",
        icon: "💎",
        href: "./subscription.html"
      },
      {
        id: "settings",
        title: "الإعدادات",
        icon: "⚙️",
        href: "./setting.html"
      }
    ],

    feedbackEnabled(type) {
      const key = this.feedbackKeys[type];
      if (!key) return false;
      const saved = localStorage.getItem(key);
      return saved === null ? true : saved !== "0";
    },

    setFeedbackEnabled(type, enabled) {
      const key = this.feedbackKeys[type];
      if (!key) return;
      localStorage.setItem(key, enabled ? "1" : "0");
    },

    currentLanguage() {
      return window.VAREXI18N?.getLanguage?.() === "en" ||
        localStorage.getItem("varex_language") === "en"
        ? "en"
        : "ar";
    },

    feedbackIcon(type, enabled) {
      if (type === "sound") {
        return enabled
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4z"/><path d="m17 10 5 5M22 10l-5 5"/></svg>';
      }
      return enabled
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 7h4M3 9l-1 3 1 3M21 9l1 3-1 3M10 17h4"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="16" rx="2"/><path d="M10 7h4M10 17h4M4 4l16 16"/></svg>';
    },

    playFeedbackSound(kind = "tap", force = false) {
      if (!force && !this.feedbackEnabled("sound")) return;
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
            tap: [560, 0.038, 0.026],
            enabled: [720, 0.075, 0.034],
            disabled: [330, 0.06, 0.028],
            success: [820, 0.11, 0.04],
            notification: [680, 0.14, 0.04],
            warning: [280, 0.13, 0.035]
          };
          const [frequency, duration, volume] = tones[kind] || tones.tap;
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
      if (!force && !this.feedbackEnabled("vibration")) return;
      if (typeof navigator.vibrate !== "function") return;
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        console.debug("VAREX vibration unavailable", error);
      }
    },

    updateFeedbackControls() {
      const language = this.currentLanguage();
      document.querySelectorAll("[data-varex-feedback-toggle]").forEach(button => {
        const type = button.dataset.varexFeedbackToggle;
        const enabled = this.feedbackEnabled(type);
        const labels = type === "sound"
          ? {
              ar: enabled ? "الصوت مفعّل — اضغط لإيقافه" : "الصوت متوقف — اضغط لتشغيله",
              en: enabled ? "Sound is on — tap to mute" : "Sound is off — tap to enable"
            }
          : {
              ar: enabled ? "الاهتزاز مفعّل — اضغط لإيقافه" : "الاهتزاز متوقف — اضغط لتشغيله",
              en: enabled ? "Vibration is on — tap to disable" : "Vibration is off — tap to enable"
            };

        button.classList.toggle("is-enabled", enabled);
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
        button.setAttribute("aria-label", labels[language]);
        button.setAttribute("title", labels[language]);
        button.innerHTML = this.feedbackIcon(type, enabled) + '<span class="varex-feedback-state" aria-hidden="true"></span>';
      });
    },

    setupFeedbackControls() {
      const topInfo = document.querySelector(".topbar .top-info");
      if (!topInfo || topInfo.querySelector(".varex-feedback-controls")) return;

      const controls = document.createElement("div");
      controls.className = "varex-feedback-controls";
      controls.setAttribute("data-varex-no-translate", "true");

      ["sound", "vibration"].forEach(type => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "varex-feedback-button";
        button.dataset.varexFeedbackToggle = type;
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const wasEnabled = this.feedbackEnabled(type);
          const enabled = !wasEnabled;

          if (type === "sound") {
            this.playFeedbackSound(enabled ? "enabled" : "disabled", true);
          }
          this.setFeedbackEnabled(type, enabled);
          if (type === "vibration" && enabled) this.playFeedbackVibration(24, true);
          else if (type === "sound") this.playFeedbackVibration(10);

          this.updateFeedbackControls();
          window.dispatchEvent(new CustomEvent("varex-feedback-changed", {
            detail: {
              sound: this.feedbackEnabled("sound"),
              vibration: this.feedbackEnabled("vibration")
            }
          }));
        });
        controls.appendChild(button);
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
          if (!target || target.disabled || target.closest("[data-varex-feedback-toggle]")) return;
          this.playFeedbackSound("tap");
          this.playFeedbackVibration(10);
        }, { passive: true, capture: true });
      }

      window.addEventListener("storage", () => this.updateFeedbackControls());
      window.addEventListener("varex-language-changed", () => this.updateFeedbackControls());
      window.VAREX_FEEDBACK = {
        tap: () => {
          this.playFeedbackSound("tap");
          this.playFeedbackVibration(10);
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
        vibrationEnabled: () => this.feedbackEnabled("vibration")
      };
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
      title.textContent = page.title;

      link.appendChild(icon);
      link.appendChild(title);

      return link;
    },

    render() {
      const nav = document.querySelector(".sidebar .nav");

      if (!nav) return;

      nav.innerHTML = "";

      const fragment = document.createDocumentFragment();

      this.pages.forEach(page => {
        fragment.appendChild(this.createItem(page));
      });

      nav.appendChild(fragment);
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
