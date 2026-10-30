(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VarexMarketWorkspace = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // A public research catalogue. These identifiers never expand the execution API.
  const categories = Object.freeze([
    { id: "all", label: "الكل" }, { id: "forex", label: "الفوركس" },
    { id: "indices", label: "المؤشرات" }, { id: "commodities", label: "السلع" },
    { id: "metals", label: "المعادن" }, { id: "stocks", label: "الأسهم" },
    { id: "crypto", label: "العملات الرقمية" }, { id: "favorites", label: "★ المفضّلة" },
  ].map(Object.freeze));
  const catalogue = Object.freeze([
    ["EURUSD", "EUR / USD", "اليورو / الدولار", "forex", "OANDA:EURUSD", "OANDA", "زوج عملات", "FX"],
    ["GBPUSD", "GBP / USD", "الجنيه الإسترليني / الدولار", "forex", "OANDA:GBPUSD", "OANDA", "زوج عملات", "FX"],
    ["USDJPY", "USD / JPY", "الدولار / الين الياباني", "forex", "OANDA:USDJPY", "OANDA", "زوج عملات", "FX"],
    ["USDCHF", "USD / CHF", "الدولار / الفرنك السويسري", "forex", "OANDA:USDCHF", "OANDA", "زوج عملات", "FX"],
    ["USDCAD", "USD / CAD", "الدولار / الدولار الكندي", "forex", "OANDA:USDCAD", "OANDA", "زوج عملات", "FX"],
    ["AUDUSD", "AUD / USD", "الدولار الأسترالي / الدولار", "forex", "OANDA:AUDUSD", "OANDA", "زوج عملات", "FX"],
    ["NZDUSD", "NZD / USD", "الدولار النيوزيلندي / الدولار", "forex", "OANDA:NZDUSD", "OANDA", "زوج عملات", "FX"],
    ["EURGBP", "EUR / GBP", "اليورو / الجنيه الإسترليني", "forex", "OANDA:EURGBP", "OANDA", "زوج عملات", "FX"],
    ["EURJPY", "EUR / JPY", "اليورو / الين الياباني", "forex", "OANDA:EURJPY", "OANDA", "زوج عملات", "FX"],
    ["GBPJPY", "GBP / JPY", "الجنيه الإسترليني / الين", "forex", "OANDA:GBPJPY", "OANDA", "زوج عملات", "FX"],
    ["USDTRY", "USD / TRY", "الدولار / الليرة التركية", "forex", "OANDA:USDTRY", "OANDA", "زوج عملات", "FX"],
    ["USDZAR", "USD / ZAR", "الدولار / الراند الجنوب أفريقي", "forex", "OANDA:USDZAR", "OANDA", "زوج عملات", "FX"],
    ["SPX500", "S&P 500", "مؤشر ستاندرد آند بورز 500", "indices", "FOREXCOM:SPX500", "FOREX.com", "CFD مرجعي على مؤشر", "US"],
    ["US30", "Dow Jones", "مؤشر داو جونز", "indices", "FOREXCOM:US30", "FOREX.com", "CFD مرجعي على مؤشر", "US"],
    ["NAS100", "Nasdaq 100", "مؤشر ناسداك 100", "indices", "FOREXCOM:NAS100", "FOREX.com", "CFD مرجعي على مؤشر", "US"],
    ["UK100", "FTSE 100", "مؤشر فوتسي البريطاني", "indices", "TVC:UKX", "TVC", "مؤشر", "UK"],
    ["DAX", "DAX", "مؤشر داكس الألماني", "indices", "XETR:DAX", "XETRA", "مؤشر", "DE"],
    ["NIKKEI", "Nikkei 225", "مؤشر نيكاي الياباني", "indices", "TVC:NI225", "TVC", "مؤشر", "JP"],
    ["WTI", "WTI Oil", "نفط غرب تكساس", "commodities", "TVC:USOIL", "TVC", "مرجع سعر النفط", "OIL"],
    ["BRENT", "Brent Oil", "نفط برنت", "commodities", "TVC:UKOIL", "TVC", "مرجع سعر النفط", "OIL"],
    ["NATGAS", "Natural Gas", "الغاز الطبيعي", "commodities", "NYMEX:NG1!", "NYMEX", "عقد آجل مستمر", "GAS"],
    ["WHEAT", "Wheat", "القمح", "commodities", "CBOT:ZW1!", "CBOT", "عقد آجل مستمر", "W"],
    ["CORN", "Corn", "الذرة", "commodities", "CBOT:ZC1!", "CBOT", "عقد آجل مستمر", "C"],
    ["XAUUSD", "XAU / USD", "الذهب / الدولار", "metals", "OANDA:XAUUSD", "OANDA", "معدن مقابل الدولار", "Au"],
    ["XAGUSD", "XAG / USD", "الفضة / الدولار", "metals", "OANDA:XAGUSD", "OANDA", "معدن مقابل الدولار", "Ag"],
    ["AAPL", "AAPL", "أبل", "stocks", "NASDAQ:AAPL", "NASDAQ", "سهم أمريكي", "A"],
    ["MSFT", "MSFT", "مايكروسوفت", "stocks", "NASDAQ:MSFT", "NASDAQ", "سهم أمريكي", "M"],
    ["NVDA", "NVDA", "إنفيديا", "stocks", "NASDAQ:NVDA", "NASDAQ", "سهم أمريكي", "N"],
    ["AMZN", "AMZN", "أمازون", "stocks", "NASDAQ:AMZN", "NASDAQ", "سهم أمريكي", "a"],
    ["GOOGL", "GOOGL", "ألفابت — جوجل", "stocks", "NASDAQ:GOOGL", "NASDAQ", "سهم أمريكي", "G"],
    ["META", "META", "ميتا", "stocks", "NASDAQ:META", "NASDAQ", "سهم أمريكي", "M"],
    ["TSLA", "TSLA", "تسلا", "stocks", "NASDAQ:TSLA", "NASDAQ", "سهم أمريكي", "T"],
    ["JPM", "JPM", "جي بي مورغان", "stocks", "NYSE:JPM", "NYSE", "سهم أمريكي", "J"],
    ["XOM", "XOM", "إكسون موبيل", "stocks", "NYSE:XOM", "NYSE", "سهم أمريكي", "X"],
    ["V", "V", "فيزا", "stocks", "NYSE:V", "NYSE", "سهم أمريكي", "V"],
    ["SAP", "SAP", "إس إيه بي", "stocks", "XETR:SAP", "XETRA", "سهم ألماني", "S"],
    ["HSBA", "HSBA", "إتش إس بي سي", "stocks", "LSE:HSBA", "LSE", "سهم بريطاني", "H"],
    ["TOYOTA", "7203", "تويوتا", "stocks", "TSE:7203", "Tokyo", "سهم ياباني", "T"],
    ["TENCENT", "0700", "تينسنت", "stocks", "HKEX:0700", "HKEX", "سهم هونغ كونغ", "T"],
    ["BTC-USD", "BTC / USD", "بيتكوين", "crypto", "COINBASE:BTCUSD", "Coinbase", "عملة رقمية", "₿", "BTC-USD"],
    ["ETH-USD", "ETH / USD", "إيثريوم", "crypto", "COINBASE:ETHUSD", "Coinbase", "عملة رقمية", "Ξ", "ETH-USD"],
    ["SOL-USD", "SOL / USD", "سولانا", "crypto", "COINBASE:SOLUSD", "Coinbase", "عملة رقمية", "S", "SOL-USD"],
    ["ADA-USD", "ADA / USD", "كاردانو", "crypto", "COINBASE:ADAUSD", "Coinbase", "عملة رقمية", "A", "ADA-USD"],
  ].map(([id, label, name, category, tvSymbol, provider, kind, icon, executionSymbol]) =>
    Object.freeze({ id, label, name, category, tvSymbol, provider, kind, icon, executionSymbol: executionSymbol || null })));
  const intervals = Object.freeze([
    { id: "1", label: "1 دقيقة", technical: "1m", seconds: 60 },
    { id: "5", label: "5 د", technical: "5m", seconds: 300 },
    { id: "15", label: "15 د", technical: "15m", seconds: 900 },
    { id: "60", label: "ساعة", technical: "1h", seconds: 3600 },
    { id: "240", label: "4 ساعات", technical: "4h", seconds: 14400 },
    { id: "D", label: "يوم", technical: "1D", seconds: 86400 },
    { id: "W", label: "أسبوع", technical: "1W", seconds: null, calendarPeriod: "week" },
    { id: "M", label: "شهر", technical: "1M", seconds: null, calendarPeriod: "month" },
  ].map(Object.freeze));
  const STORAGE_KEY = "varex.trading.researchWatchlist.v1";
  const DEFAULT_FAVORITES = ["EURUSD", "XAUUSD", "SPX500", "AAPL", "BTC-USD"];
  const instances = new WeakMap();
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  const normalizeSearch = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[\s/:_-]+/g, "");
  const getMarket = (value) => typeof value === "string"
    ? catalogue.find((item) => item.id === value || item.tvSymbol === value) || null : null;
  function filterMarkets({ query = "", category = "all", favorites = [] } = {}) {
    const search = normalizeSearch(query), saved = new Set(favorites);
    return catalogue.filter((item) =>
      (category === "all" || (category === "favorites" ? saved.has(item.id) : item.category === category)) &&
      (!search || normalizeSearch(`${item.id} ${item.label} ${item.name} ${item.tvSymbol}`).includes(search)));
  }
  function readFavorites(storage) {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw === null || raw === undefined) return [...DEFAULT_FAVORITES];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? [...new Set(parsed.filter((id) => getMarket(id)?.id === id))] : [...DEFAULT_FAVORITES];
    } catch { return [...DEFAULT_FAVORITES]; }
  }
  function widgetConfig(type, item, interval, theme) {
    if (!catalogue.includes(item)) throw new Error("Unknown research instrument");
    const period = intervals.find((entry) => entry.id === interval);
    if (!period) throw new Error("Unknown chart interval");
    const appearance = theme === "light" ? "light" : "dark";
    if (type === "chart") return {
      autosize: true, symbol: item.tvSymbol, interval: period.id, timezone: "Asia/Dubai",
      theme: appearance, style: "1", locale: "ar_AE", allow_symbol_change: false,
      hide_top_toolbar: true, hide_side_toolbar: false, hide_legend: true, withdateranges: false,
      save_image: false, calendar: false, support_host: "https://www.tradingview.com",
      backgroundColor: appearance === "light" ? "#FFFFFF" : "#081D36",
      gridColor: appearance === "light" ? "rgba(8,29,54,0.07)" : "rgba(255,255,255,0.06)",
    };
    if (type === "technical") return {
      interval: period.technical, width: "100%", height: "100%", isTransparent: true,
      symbol: item.tvSymbol, showIntervalTabs: false, displayMode: "single",
      locale: "ar_AE", colorTheme: appearance,
    };
    throw new Error("Unknown widget type");
  }
  function number(value, digits = 4) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(value) < .01 ? 8 : digits }).format(value);
  }
  function formatTime(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return "—";
    return new Date(value).toLocaleString("ar-AE", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" });
  }
  function indicatorCard(label, value, detail) {
    return `<div class="mw-indicator"><label>${esc(label)}</label><strong dir="ltr">${esc(value)}</strong><small>${esc(detail)}</small></div>`;
  }
  function analysisHtml(result) {
    const calendar = result?.calendarPeriod === "week" || result?.calendarPeriod === "month";
    if (calendar && (result.status === "unavailable" || !Object.values(result.indicators).some((indicator) => indicator.available))) {
      return `<div class="mw-empty"><b>غير متاح لهذه الفترة</b><p>المصدر الحالي يوفر ${esc(result.candleCount || 0)} شمعة تقويمية مكتملة؛ لا تكفي لحساب المؤشرات. يظل شارت وملخص TradingView متاحين بحسب بيانات المزوّد.</p><p>المصدر: ${esc(result.source)} · حدود الفترات بتوقيت UTC.</p></div>`;
    }
    if (!result || result.status === "unavailable") return '<div class="mw-empty"><b>البيانات غير متاحة حالياً</b><p>أعد المحاولة لتحميل شموع فعلية وحساب المؤشرات.</p></div>';
    const i = result.indicators, a = result.agreement;
    const stateLabel = { ready: "شموع مكتملة", insufficient: "تاريخ جزئي", stale: "بيانات قديمة" }[result.status];
    const direction = { bullish: "ميل صاعد", bearish: "ميل هابط", neutral: "قراءات متباينة" }[result.direction];
    const rsiLabel = { overbought: "تشبّع شرائي", oversold: "تشبّع بيعي", neutral: "ضمن النطاق المتوسط" }[i.rsi14.zone] || "لا تتوفر قراءة";
    const available = (indicator, value) => indicator.available ? number(value) : "—";
    return `<div class="mw-analysis-summary">
      <span class="mw-state ${esc(result.status)}">${esc(stateLabel)}</span>
      <h3>${esc(result.status === "stale" ? "قراءة تاريخية: " + direction : direction)}</h3>
      <p>${a.bullish} صاعدة · ${a.bearish} هابطة · ${a.neutral} محايدة، من ${a.total} قراءات متاحة.</p>
      <small>آخر شمعة مغلقة: ${esc(formatTime(result.asOf))} · توقيت دبي</small>
    </div>
    <div class="mw-indicator-grid">
      ${indicatorCard("EMA 20", available(i.ema20, i.ema20.value), "متوسط أُسّي — 20 شمعة")}
      ${indicatorCard("EMA 50", available(i.ema50, i.ema50.value), i.ema50.available ? "متوسط أُسّي — 50 شمعة" : "يلزم 50 شمعة مكتملة")}
      ${indicatorCard("RSI 14", available(i.rsi14, i.rsi14.value), rsiLabel)}
      ${indicatorCard("MACD", available(i.macd, i.macd.histogram), i.macd.available ? `الخط ${number(i.macd.line)} · الإشارة ${number(i.macd.signal)}` : "يلزم تاريخ أطول")}
      ${indicatorCard("ATR 14", available(i.atr14, i.atr14.value), i.atr14.available ? `${number(i.atr14.percentOfClose, 2)}% من الإغلاق · قياس التذبذب` : "قياس التذبذب")}
      ${indicatorCard("إغلاق الشمعة", number(result.lastClose), `${result.candleCount} شمعة مكتملة`)}
    </div>
    ${result.missingIndicatorDetails?.length ? `<p class="mw-footnote">غير متاح لهذه الفترة من السجل الحالي: ${result.missingIndicatorDetails.map((missing) => `${esc(missing.label)} (${esc(missing.availableBars)} / ${esc(missing.requiredBars)} شمعة${missing.reason === "invalid_calculation" ? "؛ تعذر الحساب" : ""})`).join(" · ")}.</p>` : ""}
    <div class="mw-support-levels">
      <span><small>دعم مُقاس</small><b dir="ltr">${available(i.supportResistance, i.supportResistance.support)}</b></span>
      <span><small>مقاومة مُقاسة</small><b dir="ltr">${available(i.supportResistance, i.supportResistance.resistance)}</b></span>
    </div>
    <ul class="mw-reasons">${result.reasons.slice(0, 6).map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>
    <p class="mw-footnote">المصدر: ${esc(result.source)}. الدعم والمقاومة نطاق 20 شمعة سابقة. عدد القراءات المتفقة ليس احتمال ربح.</p>`;
  }
  function guideHtml(item) {
    return `<div class="mw-analysis-summary"><span class="mw-badge">${esc(item.label)}</span><h3>اقرأ الصورة كاملة</h3>
      <p>ملخص TradingView يجمّع المتوسطات المتحركة ومؤشرات الزخم للأصل والفترة المحدّدين.</p></div>
      <div class="mw-indicator-grid">
        ${indicatorCard("الاتجاه", "EMA / SMA", "موقع السعر واتجاه المتوسطات المتحركة")}
        ${indicatorCard("الزخم", "RSI / MACD", "قوة الحركة واحتمال ضعف الزخم")}
        ${indicatorCard("المستويات", "دعم / مقاومة", "راجع القمم والقيعان على الشارت")}
        ${indicatorCard("الفترة الزمنية", "متزامنة", "اختر الفترة من الأزرار فوق الشارت")}
      </div>
      <ul class="mw-reasons"><li>تقارب القراءات يقوّي وصف الاتجاه؛ اختلافها يعني أن الصورة مختلطة.</li>
      <li>التشبّع الشرائي أو البيعي وحده لا يعني انعكاساً مؤكّداً.</li>
      <li>قد تتأخر بيانات البورصات أو تكون بعض الرموز غير متاحة لدى المزوّد.</li></ul>
      <p class="mw-footnote">القيم والنتيجة الفعلية داخل أداة المزوّد. الحساب التفصيلي المحلي في VAREX متاح حالياً للعملات الرقمية الأربع.</p>`;
  }

  function mount(container, options = {}) {
    if (!container?.ownerDocument) throw new Error("A workspace container is required");
    instances.get(container)?.destroy();
    const document = container.ownerDocument, window = document.defaultView;
    let storage;
    try { storage = window.localStorage; } catch {}
    const state = {
      item: getMarket(options.initialSymbol) || getMarket("EURUSD"),
      interval: intervals.some((p) => p.id === options.interval) ? options.interval : "60",
      category: "all", query: "", favorites: readFavorites(storage), destroyed: false,
      requestId: 0, controller: null, timer: null, result: null, resultKey: "",
    };
    const widgetCleanups = [];
    const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const selectedKey = () => `${state.item.id}:${state.interval}`;
    function clearWidgets() { widgetCleanups.splice(0).forEach((cleanup) => cleanup()); }
    function notifySelection() { options.onSelect?.({ id: state.item.id, interval: state.interval }); }
    function renderList() {
      const found = filterMarkets({ query: state.query, category: state.category, favorites: state.favorites });
      container.querySelector("[data-mw-count]").textContent = `${found.length} / ${catalogue.length} سوق`;
      container.querySelector("[data-mw-list]").innerHTML = found.length ? found.map((item) => {
        const saved = state.favorites.includes(item.id), active = state.item.id === item.id;
        return `<div class="mw-market-row${active ? " active" : ""}">
          <button type="button" class="mw-select" data-mw-symbol="${esc(item.id)}" aria-pressed="${active}" aria-label="عرض ${esc(item.name)}">
            <span class="mw-symbol-icon" aria-hidden="true">${esc(item.icon)}</span>
            <span class="mw-market-name"><strong><bdi>${esc(item.label)}</bdi></strong><small>${esc(item.name)}</small></span>
            <span class="mw-market-meta">${esc(item.provider)}</span>
          </button><button type="button" class="mw-favorite" data-mw-favorite="${esc(item.id)}" aria-pressed="${saved}" aria-label="${saved ? "إزالة" : "إضافة"} ${esc(item.name)} ${saved ? "من" : "إلى"} المفضّلة">${saved ? "★" : "☆"}</button>
        </div>`;
      }).join("") : '<div class="mw-empty"><b>لا توجد أسواق مطابقة</b><p>جرّب رمزاً آخر أو غيّر القسم. أضف أسواقاً للمفضّلة باستخدام النجمة.</p></div>';
      container.querySelectorAll("[data-mw-category]").forEach((button) => {
        const active = button.dataset.mwCategory === state.category;
        button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
      });
    }
    function embedWidget(target, type) {
      const config = widgetConfig(type, state.item, state.interval, theme());
      const name = type === "chart" ? "advanced-chart" : "technical-analysis";
      const box = document.createElement("div");
      box.className = "tradingview-widget-container mw-widget-container";
      const host = document.createElement("div");
      host.className = "tradingview-widget-container__widget mw-widget-host";
      const script = document.createElement("script");
      script.type = "text/javascript"; script.async = true;
      script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
      script.textContent = JSON.stringify(config);
      const notice = document.createElement("div");
      notice.className = "mw-widget-notice"; notice.setAttribute("role", "status");
      notice.textContent = "جاري تحميل أداة العرض…";
      box.append(host, script); target.replaceChildren(box, notice);
      let disposed = false;
      const warn = () => {
        if (disposed) return;
        notice.hidden = false;
        notice.innerHTML = `تعذر تحميل الأداة. <a href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(state.item.tvSymbol)}" target="_blank" rel="noopener noreferrer">فتح الرسم لدى المزوّد ↗</a>`;
      };
      script.addEventListener("error", warn, { once: true });
      const timer = window.setTimeout(() => { if (!box.querySelector("iframe")) warn(); }, 18000);
      const observer = new window.MutationObserver(() => {
        const iframe = box.querySelector("iframe");
        if (!iframe) return;
        iframe.title = `${type === "chart" ? "شارت" : "تحليل فني"} ${state.item.label} — TradingView`;
        iframe.addEventListener("load", () => { if (!disposed) notice.hidden = true; }, { once: true });
        notice.hidden = true; // The provider itself displays data/loading/unavailable states.
        window.clearTimeout(timer); observer.disconnect();
      });
      observer.observe(box, { childList: true, subtree: true });
      widgetCleanups.push(() => { disposed = true; observer.disconnect(); window.clearTimeout(timer); });
    }
    function drawWidgets() {
      clearWidgets();
      embedWidget(container.querySelector("[data-mw-chart]"), "chart");
      embedWidget(container.querySelector("[data-mw-technical]"), "technical");
    }
    function renderMain() {
      const item = state.item;
      const action = item.executionSymbol
        ? options.authenticated
          ? options.canTrade ? '<button type="button" class="mw-trade-link" data-mw-trade>فتح لوحة الأوامر الورقية ←</button>' : '<span class="mw-badge">صلاحية الحساب: عرض فقط</span>'
          : '<a class="mw-trade-link" href="/trading/">تسجيل الدخول لفتح لوحة الأوامر ←</a>'
        : '<span class="mw-badge">متاح للعرض والتحليل</span>';
      container.querySelector("[data-mw-main]").innerHTML = `
        <header class="mw-main-top"><div class="mw-instrument"><span class="mw-symbol-icon" aria-hidden="true">${esc(item.icon)}</span><div><h2><bdi>${esc(item.label)}</bdi></h2><p>${esc(item.name)} · ${esc(item.kind)}</p></div></div>
          <div class="mw-source"><span class="mw-badge">${esc(item.provider)}</span><small>عرض البيانات عبر TradingView</small></div></header>
        <div class="mw-controls"><div class="mw-intervals" role="group" aria-label="الفترة الزمنية للشارت والتحليل">${intervals.map((p) => `<button type="button" data-mw-interval="${p.id}" class="${state.interval === p.id ? "active" : ""}" aria-pressed="${state.interval === p.id}">${p.label}</button>`).join("")}</div><button type="button" class="mw-button" data-mw-refresh>↻ تحديث التحليل</button></div>
        <section class="mw-chart" data-mw-chart aria-label="الشارت التفاعلي"></section>
        <div class="mw-provider-credit"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">الشارت والتحليل العام بواسطة TradingView ↗</a><span>السعر والتأخير يظهران لدى المزوّد</span></div>
        <section class="mw-analysis-layout" aria-label="تحليل السوق">
          <article class="mw-panel"><header class="mw-panel-head"><div><h3>ملخص التحليل الفني</h3><p>${esc(item.label)} · ${esc(intervals.find((p) => p.id === state.interval).label)}</p></div><span class="mw-badge">TradingView</span></header><div class="mw-technical-widget" data-mw-technical></div></article>
          <article class="mw-panel"><header class="mw-panel-head"><div><h3>${item.executionSymbol ? "تحليل VAREX للشموع" : "كيف تقرأ التحليل؟"}</h3><p>${item.executionSymbol ? "حساب مباشر من شموع مكتملة" : "الاتجاه والزخم والمستويات"}</p></div></header><div data-mw-analysis>${item.executionSymbol ? '<div class="mw-empty" role="status">جاري تحميل الشموع وحساب المؤشرات…</div>' : guideHtml(item)}</div></article>
        </section>
        <section class="mw-action-panel"><div><h3>${item.executionSymbol ? "من المتابعة إلى لوحة الأوامر" : "حالة التنفيذ لهذا السوق"}</h3><p>${item.executionSymbol ? "فتح اللوحة يجهّز اختيار السوق فقط. أوامر Binance الحقيقية تستخدم أزواج USDT وقد يختلف سعرها عن شارت USD." : "هذا الأصل للمراقبة والتحليل حالياً. لم يُربط وسيط تنفيذ لهذا السوق في VAREX."}</p></div>${action}</section>`;
      drawWidgets();
      if (state.resultKey === selectedKey() && state.result) container.querySelector("[data-mw-analysis]").innerHTML = analysisHtml(state.result);
    }
    function schedule() {
      window.clearTimeout(state.timer);
      if (!state.destroyed && state.item.executionSymbol && document.visibilityState !== "hidden") {
        state.timer = window.setTimeout(() => refreshAnalysis(false), 60000);
      }
    }
    async function refreshAnalysis(force = false) {
      const key = selectedKey(), item = state.item, requestId = ++state.requestId;
      state.controller?.abort(); window.clearTimeout(state.timer);
      state.controller = null;
      if (!item.executionSymbol || state.destroyed) return;
      const target = container.querySelector("[data-mw-analysis]");
      const button = container.querySelector("[data-mw-refresh]");
      if (!window.VarexMarketData || !window.VarexMarketAnalysis) {
        target.innerHTML = '<div class="mw-empty"><b>تعذر تحميل أدوات التحليل</b><p>أعد تحميل الصفحة. يظل شارت المزوّد متاحاً.</p></div>';
        return;
      }
      const controller = new window.AbortController();
      state.controller = controller;
      if (button) { button.disabled = true; button.textContent = "جاري التحديث…"; }
      try {
        const data = await window.VarexMarketData.loadCandles({ symbol: item.executionSymbol, interval: state.interval, signal: controller.signal, force });
        if (state.destroyed || requestId !== state.requestId || key !== selectedKey()) return;
        const result = window.VarexMarketAnalysis.analyzeCandles({ ...data, now: Date.now() });
        state.result = result; state.resultKey = key;
        container.querySelector("[data-mw-analysis]").innerHTML = analysisHtml(result);
      } catch (error) {
        if (state.destroyed || requestId !== state.requestId || controller.signal.aborted) return;
        // Never leave an earlier reading on screen as though a refresh succeeded.
        state.result = null; state.resultKey = "";
        container.querySelector("[data-mw-analysis]").innerHTML = error?.code === "period_unavailable"
          ? '<div class="mw-empty"><b>غير متاح لهذه الفترة</b><p>لا تتوفر شموع تقويمية مكتملة في السجل الحالي. يظل شارت وملخص TradingView متاحين بحسب بيانات المزوّد.</p></div>'
          : '<div class="mw-empty"><b>تعذر جلب الشموع الحالية</b><p>لم يُنشأ تحليل بديل. اضغط «تحديث التحليل» للمحاولة مجدداً.</p></div>';
      } finally {
        if (!state.destroyed && requestId === state.requestId) {
          const currentButton = container.querySelector("[data-mw-refresh]");
          if (currentButton) { currentButton.disabled = false; currentButton.textContent = "↻ تحديث التحليل"; }
          state.controller = null; schedule();
        }
      }
    }
    function select(value, interval = state.interval) {
      const item = getMarket(value);
      if (!item || !intervals.some((p) => p.id === interval)) return false;
      state.controller?.abort(); state.requestId++; window.clearTimeout(state.timer);
      state.item = item; state.interval = interval; state.result = null; state.resultKey = "";
      renderList(); renderMain(); notifySelection(); refreshAnalysis(false);
      return true;
    }
    function click(event) {
      const button = event.target.closest?.("button");
      if (!button || !container.contains(button)) return;
      if (button.dataset.mwFavorite) {
        const id = getMarket(button.dataset.mwFavorite)?.id;
        if (!id) return;
        state.favorites = state.favorites.includes(id) ? state.favorites.filter((value) => value !== id) : [...state.favorites, id];
        try { storage?.setItem(STORAGE_KEY, JSON.stringify(state.favorites)); } catch {}
        renderList();
        container.querySelector(`[data-mw-favorite="${id}"]`)?.focus({ preventScroll: true });
        return;
      }
      if (button.dataset.mwCategory && categories.some((c) => c.id === button.dataset.mwCategory)) {
        state.category = button.dataset.mwCategory; renderList(); return;
      }
      if (button.dataset.mwSymbol) return select(button.dataset.mwSymbol);
      if (button.dataset.mwInterval) return select(state.item.id, button.dataset.mwInterval);
      if (button.hasAttribute("data-mw-refresh")) {
        if (state.item.executionSymbol) return refreshAnalysis(true);
        drawWidgets(); return;
      }
      if (button.hasAttribute("data-mw-trade") && options.authenticated && options.canTrade && state.item.executionSymbol) {
        options.onTrade?.(state.item.executionSymbol);
      }
    }
    function input(event) {
      if (!event.target.matches?.("[data-mw-search]")) return;
      state.query = event.target.value; renderList();
    }
    function visibility() {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(state.timer); state.controller?.abort();
      } else if (state.item.executionSymbol) refreshAnalysis(false);
    }
    container.innerHTML = `<div class="mw-shell">
      <aside class="mw-sidebar" aria-label="قائمة الأسواق"><header class="mw-sidebar-head"><h2>الأسواق</h2><span class="mw-badge">${catalogue.length}</span></header>
        <label class="mw-search-wrap"><span class="sr-only">البحث عن سوق بالاسم أو الرمز</span><input data-mw-search type="search" placeholder="ابحث: ذهب، EURUSD، أبل…" autocomplete="off" aria-label="البحث عن سوق بالاسم أو الرمز"></label>
        <nav class="mw-categories" aria-label="أقسام الأسواق">${categories.map((c) => `<button type="button" data-mw-category="${c.id}" aria-pressed="${c.id === state.category}" class="${c.id === state.category ? "active" : ""}">${esc(c.label)}</button>`).join("")}</nav>
        <p class="mw-results-count" data-mw-count aria-live="polite"></p><div class="mw-list" data-mw-list></div>
        <p class="mw-footnote">المفضّلة محفوظة على هذا الجهاز. اختر السوق لعرض السعر والشارت والتحليل من مصدره.</p>
      </aside><div class="mw-main" data-mw-main></div></div>`;
    container.addEventListener("click", click); container.addEventListener("input", input);
    document.addEventListener("visibilitychange", visibility);
    let lastTheme = theme();
    const themeObserver = new window.MutationObserver(() => {
      if (theme() === lastTheme || state.destroyed) return;
      lastTheme = theme(); drawWidgets();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const api = {
      select,
      refresh: () => { if (state.item.executionSymbol) return refreshAnalysis(true); drawWidgets(); },
      selection: () => ({ id: state.item.id, interval: state.interval }),
      destroy: () => {
        state.destroyed = true; state.requestId++; state.controller?.abort();
        window.clearTimeout(state.timer); clearWidgets(); themeObserver.disconnect();
        container.removeEventListener("click", click); container.removeEventListener("input", input);
        document.removeEventListener("visibilitychange", visibility);
        instances.delete(container);
      },
    };
    instances.set(container, api);
    renderList(); renderMain(); notifySelection(); refreshAnalysis(false);
    return api;
  }
  return Object.freeze({ catalogue, categories, intervals, getMarket, filterMarkets, readFavorites, widgetConfig, analysisHtml, mount });
});
