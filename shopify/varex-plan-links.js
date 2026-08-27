(function () {
  "use strict";

  const planHost = "https://app.varexapp.com/plans/";
  const products = {
    "varex-cashier": { app: "cashier", theme: "navy" },
    "varex-real-estate": { app: "real-estate", theme: "teal" },
    "varex-car-rental": { app: "car-rental", theme: "royal" },
    "varex-restaurant": { app: "restaurant", theme: "clay" },
    "varex-cafe": { app: "cafe", theme: "coffee" },
    "varex-women-salon": { app: "women-salon", theme: "rose" },
    "varex-men-salon": { app: "men-salon", theme: "sky" },
    "varex-pharmacy": { app: "pharmacy", theme: "emerald" },
    "varex-shipping": { app: "shipping", theme: "coffee" },
    "varex-construction": { app: "construction", theme: "gold" },
    "varex-perfumes-cosmetics": { app: "perfumes-cosmetics", theme: "berry" },
    "varex-cafeteria": { app: "cafeteria", theme: "orange" }
  };

  function language() {
    return String(document.documentElement.lang || "ar").toLowerCase().startsWith("en") ? "en" : "ar";
  }

  function productHandle(value) {
    try {
      const url = new URL(value, location.href);
      const match = url.pathname.match(/^\/products\/([^/?#]+)/i);
      return match && products[match[1]] ? match[1] : "";
    } catch (_) {
      return "";
    }
  }

  function overviewUrl(handle) {
    const url = new URL(planHost);
    url.searchParams.set("app", products[handle].app);
    url.searchParams.set("theme", products[handle].theme);
    url.searchParams.set("lang", language());
    return url.href;
  }

  function rewriteLinks(scope) {
    (scope || document).querySelectorAll('a[href*="/products/"]').forEach((link) => {
      const handle = productHandle(link.href);
      if (!handle) return;
      link.href = overviewUrl(handle);
      link.dataset.varexPlanOverview = products[handle].app;
    });
  }

  const current = productHandle(location.href);
  if (current) {
    location.replace(overviewUrl(current));
    return;
  }

  function start() {
    rewriteLinks(document);
    new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('a[href*="/products/"]')) rewriteLinks(node.parentElement || node);
        else rewriteLinks(node);
      }));
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
