
/* =========================================================
   VAREX CENTRAL NAVIGATION
   File: varex-navigation.js
   مسؤول عن القائمة المركزية والتنقل وتحديد الصفحة النشطة
========================================================= */

(function () {
  "use strict";

  const VAREX_NAVIGATION = {
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

      const classifyHeaderItems = () => {
        Array.from(topInfo.children).forEach(item => {
          const itemIsClock = item.id === "currentDate" || item.id === "currentTime";
          const clockValue = itemIsClock
            ? item
            : item.querySelector("#currentDate, #currentTime");

          item.classList.toggle("varex-mobile-clock-chip", Boolean(clockValue));
          item.classList.toggle("varex-mobile-aux-chip", !clockValue);
          item.classList.toggle(
            "varex-mobile-clock-wrapper",
            Boolean(clockValue && clockValue !== item)
          );
        });
      };

      classifyHeaderItems();

      if (!topInfo.__varexHeaderObserver) {
        topInfo.__varexHeaderObserver = new MutationObserver(classifyHeaderItems);
        topInfo.__varexHeaderObserver.observe(topInfo, { childList: true });
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
