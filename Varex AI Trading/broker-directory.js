(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VarexAccounts = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const catalogue = Object.freeze([
    { id: "binance", label: "Binance", shortLabel: "Binance", kind: "عملات رقمية · Spot", capability: "execution",
      description: "عرض رصيد Binance Spot وتنفيذ الأوامر المدعومة بعد تفعيل التداول الحقيقي والتأكيد اليدوي لكل أمر.",
      officialUrl: "https://www.binance.com/", guideUrl: "https://developers.binance.com/docs/binance-spot-api-docs" },
    { id: "capital", label: "Capital.com", shortLabel: "Capital", kind: "حساب تجريبي أو حقيقي", capability: "account_view",
      description: "ربط حساب Capital.com التجريبي أو الحقيقي لعرض الرصيد والمراكز المفتوحة. إرسال أوامر عقود الفروقات غير متاح داخل VAREX حالياً.",
      officialUrl: "https://capital.com/", guideUrl: "https://open-api.capital.com/" },
    { id: "amana", label: "Amana — أمانة", shortLabel: "أمانة", kind: "منصة تداول", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. إضافة الربط تتطلب تكاملاً خاصاً مع المنصة أو الوسيط؛ يمكنك مراجعة خياراتها من الموقع الرسمي.",
      officialUrl: "https://amana.app/", guideUrl: "https://amana.app/platforms/metaquotes" },
    { id: "iqoption", label: "IQ Option", shortLabel: "IQ Option", kind: "منصة تداول", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. اختيار الاسم هنا يعرض معلومات المنصة فقط ولا ينشئ اتصالاً بحسابك.",
      officialUrl: "https://iqoption.com/", guideUrl: "" },
    { id: "olymptrade", label: "Olymp Trade", shortLabel: "Olymp", kind: "منصة تداول", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. سيظهر الربط بعد إضافة تكامل يدعم قراءة الحساب أو تنفيذ الأوامر.",
      officialUrl: "https://olymptrade.com/", guideUrl: "" },
    { id: "pocketoption", label: "Pocket Option", shortLabel: "Pocket", kind: "منصة تداول", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. يمكنك الاطلاع على خدمات المنصة من موقعها الرسمي.",
      officialUrl: "https://pocketoption.com/", guideUrl: "" },
    { id: "hedg", label: "HEDG", shortLabel: "HEDG", kind: "منصة تداول", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. عرض الأسواق والشارت في VAREX لا يعني ربط حساب HEDG أو تنفيذ الأوامر فيه.",
      officialUrl: "https://hedg.com/en/", guideUrl: "https://hedg.com/en/trading/platforms/webtrader/" },
    { id: "mt4", label: "MetaTrader 4", shortLabel: "MT4", kind: "برنامج تداول عبر وسيط", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. يحتاج الربط إلى تكامل مع حساب الوسيط وخادم MetaTrader أو جسر خاص.",
      officialUrl: "https://www.metatrader4.com/", guideUrl: "" },
    { id: "mt5", label: "MetaTrader 5", shortLabel: "MT5", kind: "برنامج تداول عبر وسيط", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. يحتاج الربط إلى تكامل مع حساب الوسيط وخادم MetaTrader أو جسر خاص.",
      officialUrl: "https://www.metatrader5.com/", guideUrl: "" },
    { id: "other", label: "منصة أخرى", shortLabel: "أخرى", kind: "تكامل إضافي", capability: "unavailable",
      description: "غير متاح داخل VAREX حالياً. يظهر خيار الربط عندما يُضاف تكامل خاص بالمنصة المطلوبة.",
      officialUrl: "", guideUrl: "" },
  ].map((provider) => Object.freeze(provider)));

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const getProvider = (id) => typeof id === "string" ? catalogue.find((provider) => provider.id === id) || null : null;
  const statusLabel = (provider) => provider.capability === "execution" ? "تنفيذ Spot"
    : provider.capability === "account_view" ? "عرض الحساب" : "غير متاح حالياً";
  const initials = (provider) => ({ binance: "B", capital: "C", amana: "أ", iqoption: "IQ", olymptrade: "O",
    pocketoption: "P", hedg: "H", mt4: "4", mt5: "5", other: "+" })[provider.id];

  function renderChoices(options = {}) {
    const input = options && typeof options === "object" ? options : {};
    const balance = typeof input.demoBalance === "number" && Number.isFinite(input.demoBalance) && input.demoBalance >= 0 ? input.demoBalance : 25000;
    const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(balance);
    const active = input.active === "linked" ? "linked" : "demo", canConnect = input.canConnect !== false;
    return '<section class="va-choice-grid" aria-label="اختيار نوع الحساب">'
      + '<article class="va-choice-card' + (active === "demo" ? ' va-is-active' : '') + '" data-account-card="demo">'
      + '<div class="va-choice-top"><span class="va-choice-icon" aria-hidden="true">◉</span><span class="va-choice-kicker">تعلّم وتجربة</span>'
      + (active === "demo" ? '<span class="va-selected-tag">الخيار المحدد</span>' : '') + '</div>'
      + '<h2>حساب تجريبي</h2><p>جرّب فتح الصفقات وإغلاقها برصيد افتراضي. تُحفظ تجربتك وصفقاتك داخل حسابك في VAREX.</p>'
      + '<div class="va-demo-balance"><span>رصيد البداية للحساب التجريبي</span><strong dir="ltr">' + escape(amount) + ' <small>USD</small></strong></div>'
      + '<p class="va-choice-note">يبدأ الحساب الجديد بعد إنشاء حساب VAREX أو تسجيل الدخول.</p>'
      + '<button class="va-button va-button-primary" type="button" data-account-choice="demo">بدء الحساب التجريبي <span aria-hidden="true">←</span></button></article>'
      + '<article class="va-choice-card' + (active === "linked" ? ' va-is-active' : '') + '" data-account-card="linked">'
      + '<div class="va-choice-top"><span class="va-choice-icon" aria-hidden="true">↗</span><span class="va-choice-kicker">حسابك لدى المنصة</span>'
      + (active === "linked" ? '<span class="va-selected-tag">الخيار المحدد</span>' : '') + '</div>'
      + '<h2>ربط حساب منصة تداول</h2><p>اختر منصتك، ثم أكمل الربط من حساب VAREX. يظهر نوع التكامل المتاح لكل منصة قبل المتابعة.</p>'
      + '<div class="va-integrations"><bdi>Binance</bdi><span aria-hidden="true">·</span><bdi>Capital.com</bdi><small>تنفيذ Spot · عرض حساب Capital.com</small></div>'
      + '<p class="va-choice-note">' + (canConnect ? 'بيانات الربط تُدخل بعد تسجيل الدخول إلى VAREX.' : 'يمكنك استعراض المنصات؛ ربط الحساب يحتاج صلاحية تداول.') + '</p>'
      + '<button class="va-button va-button-secondary" type="button" data-account-choice="connect">اختيار المنصة <span aria-hidden="true">←</span></button></article></section>';
  }

  function externalLink(url, text) {
    return url ? '<a class="va-button va-button-quiet" href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(text) + ' <span aria-hidden="true">↗</span></a>' : "";
  }

  function providerDetail(provider, currentProvider) {
    const supported = provider.capability !== "unavailable";
    const current = supported && currentProvider === provider.id;
    const featureItems = provider.id === "binance"
      ? ["عرض رصيد Spot وصلاحيات الاتصال", "تنفيذ الأوامر المدعومة بعد تفعيل التداول الحقيقي والتأكيد اليدوي", "إدارة الاتصال من حساب VAREX"]
      : provider.id === "capital"
        ? ["اختيار حساب تجريبي أو حقيقي لدى Capital.com", "عرض الرصيد والمراكز المفتوحة", "أوامر عقود الفروقات غير متاحة داخل VAREX حالياً"]
        : ["لا يوجد اتصال مفعّل بهذه المنصة داخل VAREX", "لن تُطلب بيانات الوصول لمنصة غير مدمجة"];
    return '<article class="va-provider-detail" data-broker-detail="' + provider.id + '" aria-live="polite">'
      + '<span class="va-detail-kicker">المنصة المحددة</span><div class="va-detail-heading"><span class="va-monogram va-monogram-large" aria-hidden="true">' + initials(provider) + '</span>'
      + '<div><h3><bdi>' + escape(provider.label) + '</bdi></h3><span class="va-status va-status-' + provider.capability + '">' + statusLabel(provider) + '</span></div></div>'
      + (current ? '<p class="va-current-provider">هذه المنصة محددة في حسابك.</p>' : "")
      + '<p class="va-detail-description">' + escape(provider.description) + '</p>'
      + '<ul class="va-feature-list">' + featureItems.map((text) => '<li>' + escape(text) + '</li>').join("") + '</ul>'
      + (supported ? '<a class="va-button va-button-primary va-connection-entry" data-broker-connect="' + provider.id + '" href="/trading/?account=connect&amp;provider=' + provider.id + '">'
        + (provider.id === "capital" ? "متابعة ربط الحساب للعرض" : "متابعة ربط الحساب") + ' <span aria-hidden="true">←</span></a>'
        + '<p class="va-entry-note">المتابعة من حساب VAREX بعد تسجيل الدخول.</p>'
        : '<div class="va-unavailable-note">غير متاح داخل VAREX حالياً</div>')
      + '<div class="va-official-links">' + externalLink(provider.officialUrl, "الموقع الرسمي")
      + externalLink(provider.guideUrl, supported ? "الدليل الرسمي" : "معلومات المنصة") + '</div></article>';
  }

  function renderDirectory(options = {}) {
    const input = options && typeof options === "object" ? options : {};
    const selected = getProvider(input.selectedId) || getProvider("capital");
    const query = typeof input.query === "string" ? input.query : "";
    const term = query.trim().toLocaleLowerCase("en");
    const providers = catalogue.filter((provider) => [provider.label, provider.shortLabel, provider.kind, provider.id]
      .join(" ").toLocaleLowerCase("en").includes(term));
    const currentProvider = getProvider(input.currentProvider)?.id || "";
    const choices = providers.map((provider) => '<button class="va-provider-button' + (provider.id === selected.id ? ' va-provider-selected' : '')
      + '" type="button" data-broker-provider="' + provider.id + '" aria-pressed="' + (provider.id === selected.id) + '">'
      + '<span class="va-monogram" aria-hidden="true">' + initials(provider) + '</span><span class="va-provider-copy"><b><bdi>' + escape(provider.label)
      + '</bdi></b><small>' + escape(provider.kind) + '</small><span class="va-status va-status-' + provider.capability + '">' + statusLabel(provider) + '</span></span></button>').join("");
    return '<section class="va-directory" aria-label="دليل منصات التداول"><div class="va-directory-heading"><div><h2>اختر منصة التداول</h2>'
      + '<p>لكل منصة نوع تكامل واضح: تنفيذ، عرض حساب، أو تكامل غير متاح حالياً.</p></div>'
      + '<label class="va-search"><span class="va-sr-only">ابحث عن منصة التداول</span><span aria-hidden="true">⌕</span>'
      + '<input type="search" data-broker-search placeholder="ابحث عن اسم المنصة" value="' + escape(query) + '" autocomplete="off" spellcheck="false"></label></div>'
      + '<div class="va-directory-layout"><div><p class="va-results-count" aria-live="polite">' + providers.length + ' منصات في القائمة</p>'
      + '<div class="va-provider-list">' + (choices || '<p class="va-no-results">لا توجد منصة مطابقة. جرّب اسماً آخر.</p>') + '</div></div>'
      + providerDetail(selected, currentProvider) + '</div></section>';
  }

  return Object.freeze({ catalogue, getProvider, renderChoices, renderDirectory });
});
