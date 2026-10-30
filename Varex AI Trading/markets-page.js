(() => {
  "use strict";
  function start() {
    const target = document.getElementById("publicMarkets");
    if (!target) return;
    if (!window.VarexMarketWorkspace) {
      target.innerHTML = '<div class="mw-empty"><h2>تعذر تحميل مساحة الأسواق</h2><p>تحقق من الاتصال وأعد تحميل الصفحة.</p></div>';
      return;
    }
    const query = new URLSearchParams(window.location.search);
    const requested = query.get("symbol") || query.get("tvwidgetsymbol");
    const requestedInterval = query.get("interval");
    const initial = window.VarexMarketWorkspace.getMarket(requested)?.id || "EURUSD";
    const workspace = window.VarexMarketWorkspace.mount(target, {
      initialSymbol: initial, interval: requestedInterval, authenticated: false,
      onSelect({ id, interval }) {
        const url = new URL(window.location.href);
        url.searchParams.set("symbol", id); url.searchParams.set("interval", interval);
        url.searchParams.delete("tvwidgetsymbol");
        window.history.replaceState(null, "", url);
        const market = window.VarexMarketWorkspace.getMarket(id);
        document.title = `${market.label} — الأسواق والتحليل | VAREX`;
      },
    });
    window.addEventListener("pagehide", (event) => { if (!event.persisted) workspace.destroy(); });
    window.addEventListener("pageshow", (event) => { if (event.persisted) workspace.refresh(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
