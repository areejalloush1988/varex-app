(() => {
  "use strict";

  const markets = {
    "BTC/USDT": {
      name: "Bitcoin",
      icon: "₿",
      price: 67284.4,
      change: 2.84,
      points: [64120,64380,64210,64840,65110,64930,65420,65890,65640,66220,66010,66580,66940,66710,67284],
      signal: "فرصة شراء",
      side: "buy",
      confidence: 87,
      entry: 67180,
      target: 69450,
      stop: 65920
    },
    "ETH/USDT": {
      name: "Ethereum",
      icon: "Ξ",
      price: 3584.9,
      change: 1.62,
      points: [3420,3452,3434,3478,3492,3468,3510,3542,3520,3568,3550,3574,3598,3571,3585],
      signal: "قيد المراقبة",
      side: "buy",
      confidence: 68,
      entry: 3565,
      target: 3690,
      stop: 3498
    },
    "XAU/USD": {
      name: "Gold",
      icon: "Au",
      price: 2371.2,
      change: .48,
      points: [2340,2348,2344,2351,2358,2355,2362,2360,2366,2364,2370,2368,2374,2369,2371],
      signal: "فرصة شراء",
      side: "buy",
      confidence: 79,
      entry: 2368,
      target: 2402,
      stop: 2349
    },
    "EUR/USD": {
      name: "Euro",
      icon: "€",
      price: 1.0842,
      change: -.21,
      points: [1.089,1.088,1.087,1.088,1.086,1.085,1.086,1.085,1.084,1.085,1.083,1.084,1.085,1.084,1.0842],
      signal: "فرصة بيع",
      side: "sell",
      confidence: 74,
      entry: 1.0842,
      target: 1.0795,
      stop: 1.0871
    }
  };

  const state = {
    symbol: "BTC/USDT",
    side: "buy",
    analysisCycle: 0,
    trades: [
      { id: 1, symbol: "BTC/USDT", side: "buy", amount: 1250, price: 66140, status: "مفتوحة", pnl: 21.62 },
      { id: 2, symbol: "XAU/USD", side: "buy", amount: 800, price: 2359.7, status: "مفتوحة", pnl: 8.34 },
      { id: 3, symbol: "ETH/USDT", side: "sell", amount: 650, price: 3612.4, status: "مغلقة", pnl: 13.18 }
    ]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const byId = (id) => document.getElementById(id);

  function formatPrice(symbol, value, compact = false) {
    if (symbol === "EUR/USD") return Number(value).toFixed(4);
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2
    }).format(value);
  }

  function setToday() {
    const label = new Intl.DateTimeFormat("ar-AE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Asia/Dubai"
    }).format(new Date());
    byId("todayLabel").textContent = label;
  }

  function buildChart(points) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(max - min, 1);
    const coords = points.map((value, index) => {
      const x = 16 + index * (728 / (points.length - 1));
      const y = 218 - ((value - min) / span) * 185;
      return [x, y];
    });
    const line = coords.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [lastX] = coords[coords.length - 1];
    const [firstX] = coords[0];
    byId("chartLine").setAttribute("d", line);
    byId("chartArea").setAttribute("d", `${line} L${lastX.toFixed(1)},220 L${firstX.toFixed(1)},220 Z`);
  }

  function updateMarket(symbol) {
    const market = markets[symbol];
    if (!market) return;
    state.symbol = symbol;
    byId("assetSymbol").textContent = symbol;
    byId("assetName").textContent = market.name;
    byId("coinIcon").textContent = market.icon;
    byId("assetPrice").textContent = `$${formatPrice(symbol, market.price)}`;
    byId("ticketPrice").textContent = `$${formatPrice(symbol, market.price)}`;
    byId("ticketSymbol").textContent = symbol;
    byId("highPrice").textContent = `$${formatPrice(symbol, Math.max(...market.points), true)}`;
    byId("lowPrice").textContent = `$${formatPrice(symbol, Math.min(...market.points), true)}`;
    const change = byId("assetChange");
    change.textContent = `${market.change >= 0 ? "+" : ""}${market.change.toFixed(2)}%`;
    change.className = market.change >= 0 ? "positive" : "negative";
    $$(".asset-tabs button").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.symbol === symbol)));

    const signal = $(".signal-card p strong");
    signal.textContent = `${market.side === "buy" ? "↗" : "↘"} ${market.signal}`;
    signal.className = market.side === "buy" ? "positive" : "negative";
    const confidence = market.confidence + (state.analysisCycle % 2 ? 2 : 0);
    byId("confidenceValue").textContent = `${confidence}%`;
    byId("confidenceRing").style.setProperty("--confidence", `${confidence * 3.6}deg`);
    const levelValues = $$(".levels strong");
    levelValues[0].textContent = `$${formatPrice(symbol, market.entry)}`;
    levelValues[1].textContent = `$${formatPrice(symbol, market.target)}`;
    levelValues[2].textContent = `$${formatPrice(symbol, market.stop)}`;
    buildChart(market.points);
    updateEstimatedLoss();
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    byId("toastText").textContent = message;
    byId("toast").classList.add("show");
    toastTimer = setTimeout(() => byId("toast").classList.remove("show"), 2700);
  }

  function setTradeSide(side) {
    state.side = side;
    $$("[data-trade-side]").forEach((button) => button.classList.toggle("active", button.dataset.tradeSide === side));
    const execute = byId("executeTrade");
    execute.textContent = `فتح صفقة ${side === "buy" ? "شراء" : "بيع"} تجريبية`;
    execute.classList.toggle("sell", side === "sell");
  }

  function updateEstimatedLoss() {
    const amount = Number(byId("tradeAmount").value) || 0;
    const risk = Number(byId("riskRange").value) || 0;
    byId("riskValue").textContent = `${risk.toFixed(1)}%`;
    byId("estimatedLoss").textContent = `-$${(amount * risk / 100).toFixed(2)}`;
    $$("[data-amount]").forEach((button) => button.classList.toggle("active", Number(button.dataset.amount) === amount));
  }

  function openTradeCount() {
    return state.trades.filter((trade) => trade.status === "مفتوحة").length;
  }

  function renderTrades() {
    const list = byId("tradesList");
    list.innerHTML = state.trades.slice(0, 4).map((trade) => {
      const sideLabel = trade.side === "buy" ? "شراء" : "بيع";
      const arrow = trade.side === "buy" ? "↗" : "↘";
      const statusClass = trade.status === "مغلقة" ? "closed" : "";
      return `<div class="trade-item">
        <span class="trade-direction ${trade.side}">${arrow}</span>
        <span class="trade-symbol"><strong>${trade.symbol}</strong><small>${sideLabel} · $${trade.amount.toLocaleString("en-US")}</small></span>
        <span class="trade-price"><small>سعر الدخول</small><strong>$${formatPrice(trade.symbol, trade.price)}</strong></span>
        <span class="trade-status ${statusClass}">${trade.status}</span>
        <strong class="trade-pnl ${trade.pnl >= 0 ? "positive" : "negative"}">${trade.pnl === 0 ? "$0.00" : `${trade.pnl > 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`}</strong>
      </div>`;
    }).join("");
    const count = openTradeCount();
    byId("openTradesCount").textContent = String(count);
    byId("remainingTrades").textContent = `متبقي ${Math.max(0, 3 - count)} ضمن الخطة`;
  }

  function executeDemoTrade() {
    const amount = Number(byId("tradeAmount").value);
    if (!Number.isFinite(amount) || amount < 25) {
      showToast("أدخل مبلغاً تجريبياً لا يقل عن 25 دولاراً");
      return;
    }
    if (amount > 1250) {
      showToast("الحد الأقصى لحجم الصفقة التجريبية هو 1,250 دولاراً");
      return;
    }
    if (openTradeCount() >= 3) {
      showToast("تم الوصول إلى الحد الأقصى: 3 صفقات مفتوحة");
      return;
    }
    state.trades.unshift({
      id: Date.now(),
      symbol: state.symbol,
      side: state.side,
      amount,
      price: markets[state.symbol].price,
      status: "مفتوحة",
      pnl: 0
    });
    renderTrades();
    showToast(`تم فتح صفقة ${state.side === "buy" ? "شراء" : "بيع"} تجريبية على ${state.symbol}`);
  }

  function toggleMenu(open) {
    byId("sidebar").classList.toggle("open", open);
    byId("drawerBackdrop").classList.toggle("show", open);
  }

  function runAnalysis() {
    const button = byId("analyzeButton");
    button.disabled = true;
    button.classList.add("loading");
    button.innerHTML = "<span>↻</span> جاري تحليل السوق...";
    window.setTimeout(() => {
      state.analysisCycle += 1;
      updateMarket(state.symbol);
      button.disabled = false;
      button.classList.remove("loading");
      button.innerHTML = "<span>↻</span> تحليل السوق الآن";
      showToast("اكتمل تحليل السوق وتحديث الإشارة");
    }, 850);
  }

  $$(".asset-tabs button").forEach((button) => button.addEventListener("click", () => updateMarket(button.dataset.symbol)));
  $$("[data-trade-side]").forEach((button) => button.addEventListener("click", () => setTradeSide(button.dataset.tradeSide)));
  $$("[data-amount]").forEach((button) => button.addEventListener("click", () => {
    byId("tradeAmount").value = button.dataset.amount;
    updateEstimatedLoss();
  }));
  $$("[data-pick]").forEach((button) => button.addEventListener("click", () => {
    updateMarket(button.dataset.pick);
    if (button.dataset.side) setTradeSide(button.dataset.side);
    byId("tradeTicket").scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  $$(".toggle").forEach((button) => button.addEventListener("click", () => {
    const enabled = !button.classList.contains("on");
    button.classList.toggle("on", enabled);
    button.setAttribute("aria-checked", String(enabled));
  }));
  byId("tradeAmount").addEventListener("input", updateEstimatedLoss);
  byId("riskRange").addEventListener("input", updateEstimatedLoss);
  byId("maxAmount").addEventListener("click", () => { byId("tradeAmount").value = "1250"; updateEstimatedLoss(); });
  byId("executeTrade").addEventListener("click", executeDemoTrade);
  byId("analyzeButton").addEventListener("click", runAnalysis);
  byId("menuButton").addEventListener("click", () => toggleMenu(true));
  byId("closeMenu").addEventListener("click", () => toggleMenu(false));
  byId("drawerBackdrop").addEventListener("click", () => toggleMenu(false));

  setToday();
  updateMarket(state.symbol);
  updateEstimatedLoss();
  renderTrades();
})();
