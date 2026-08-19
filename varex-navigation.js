
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

    init() {
      this.render();
      this.refreshActive();
      if(typeof varexAddSidebarActions==="function") varexAddSidebarActions();

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
