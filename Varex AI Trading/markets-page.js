(() => {
  "use strict";
  async function start() {
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
    const permittedInterval = window.VarexMarketWorkspace.intervals.some((item) => item.id === requestedInterval) ? requestedInterval : "60";
    const login = new URL("/trading/", window.location.origin);
    login.searchParams.set("auth", "signup"); login.searchParams.set("next", "markets");
    login.searchParams.set("symbol", initial); login.searchParams.set("interval", permittedInterval);
    const transport = window.varexTradingRequest;
    if (typeof transport !== "function") { window.location.replace(login.href); return; }
    let profile;
    try {
      const sessionResponse = await transport("/api/auth/get-session", { method: "GET" });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session?.user) { window.location.replace(login.href); return; }
      const accessResponse = await transport("/api/trading?action=access", { method: "GET" });
      const access = await accessResponse.json();
      if (!accessResponse.ok || !access?.profile?.id || access.profile.status !== "active") { window.location.replace(login.href); return; }
      profile = access.profile;
    } catch {
      target.innerHTML = '<div class="mw-empty"><h2>يلزم تسجيل الدخول</h2><p>تعذر التحقق من جلسة الحساب. افتح صفحة التسجيل أو حاول مجدداً.</p><a href="/trading/?auth=signup">فتح صفحة التسجيل</a></div>';
      return;
    }
    const workspace = window.VarexMarketWorkspace.mount(target, {
      initialSymbol: initial, interval: permittedInterval, authenticated: true, canTrade: false,
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
    window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
