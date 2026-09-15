(() => {
  'use strict';

  const API_URL = '/api';
  const SESSION_KEY = 'varex-ai-private-session-v2';
  const DEVELOPER_EMAIL = 'areejalloush1988@gmail.com';
  const state = { session: null, user: null, org: null, member: null, agents: [], tasks: [], leads: [], approvals: [], integrations: [], integrationReadiness: null, messages: [], knowledge: [], subscriptions: [], adminSubscriptions: [] };
  const plans = {
    developer: { name: 'حساب المطوّر', price: 'مجاني دائم', agents: null, tasks: 120000, cycle: 'developer' },
    pending: { name: 'الاشتراك مطلوب', price: 'اختر باقة مدفوعة', agents: 0, tasks: 1, cycle: 'pending' },
    solo: { name: 'موظف واحد', price: '899 درهم شهرياً', agents: 1, tasks: 3000, cycle: 'monthly' },
    team3: { name: '3 موظفين', price: '1,699 درهم شهرياً', agents: 3, tasks: 10000, cycle: 'monthly' },
    team5: { name: '5 موظفين', price: '2,699 درهم شهرياً', agents: 5, tasks: 25000, cycle: 'monthly' },
    team10: { name: '10 موظفين', price: '4,499 درهم شهرياً', agents: 10, tasks: 60000, cycle: 'monthly' },
    unlimited: { name: 'غير محدود', price: 'من 6,999 درهم شهرياً', agents: null, tasks: 120000, cycle: 'monthly' }
  };
  const customerPlanCodes = new Set(['solo', 'team3', 'team5', 'team10', 'unlimited']);
  const planNameToCode = Object.fromEntries(Object.entries(plans).map(([code, item]) => [item.name, code]));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const json = value => JSON.stringify(value);
  const toast = $('#toast');
  let toastTimer;
  let facebookSdkPromise = null;
  let whatsappSignupEvent = null;
  let whatsappSignupContext = null;
  let whatsappSignupContextPromise = null;
  let whatsappSignupContextExpiresAt = 0;
  let whatsappSignupPreparationError = '';
  let whatsappSignupInFlight = false;
  let whatsappSignupAttempt = 0;
  let integrationPopup = null;
  let integrationPopupTimer = null;
  let pendingIntegration = null;
  let integrationResultHandled = false;
  const integrationChannel = 'BroadcastChannel' in window ? new BroadcastChannel('varex-integration') : null;
  const providerNames = { whatsapp: 'WhatsApp Business', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' };
  const THEME_KEY = 'varex-ai-theme-v1';
  const themes = {
    navy: { name: 'Navy', primary: '#091433', secondary: '#3157ed', accent: '#6a5cff', soft: '#eef2ff', ink: '#17213c', background: '#f3f6fb' },
    emerald: { name: 'Emerald', primary: '#064e3b', secondary: '#10b981', accent: '#34d399', soft: '#ecfdf5', ink: '#123d32', background: '#f2faf7' },
    cyan: { name: 'Cyan', primary: '#164e63', secondary: '#06b6d4', accent: '#22d3ee', soft: '#ecfeff', ink: '#16444f', background: '#f2fbfc' },
    mauve: { name: 'Mauve', primary: '#5b315e', secondary: '#a855a5', accent: '#c084c1', soft: '#fdf4ff', ink: '#45294a', background: '#fbf6fc' },
    terracotta: { name: 'Terracotta', primary: '#7c2d12', secondary: '#c65d3b', accent: '#ea8b6b', soft: '#fff7ed', ink: '#5d2e20', background: '#fcf7f3' },
    'burnt-orange': { name: 'Burnt Orange', primary: '#7c3a06', secondary: '#d97706', accent: '#f59e0b', soft: '#fff7ed', ink: '#5c3213', background: '#fcf8f2' },
    red: { name: 'Red', primary: '#7f1d1d', secondary: '#dc2626', accent: '#f87171', soft: '#fef2f2', ink: '#5f2424', background: '#fcf5f5' },
    'royal-blue': { name: 'Royal Blue', primary: '#172554', secondary: '#2563eb', accent: '#60a5fa', soft: '#eff6ff', ink: '#1e315f', background: '#f3f7fc' },
    indigo: { name: 'Indigo', primary: '#312e81', secondary: '#6366f1', accent: '#818cf8', soft: '#eef2ff', ink: '#2f315d', background: '#f4f5fc' },
    coffee: { name: 'Coffee', primary: '#4a2c20', secondary: '#9a6a45', accent: '#c49a75', soft: '#faf5f0', ink: '#3d2b24', background: '#f8f5f2' },
    graphite: { name: 'Graphite', primary: '#27272a', secondary: '#71717a', accent: '#a1a1aa', soft: '#f4f4f5', ink: '#27272a', background: '#f5f5f6' },
    'steel-blue': { name: 'Steel Blue', primary: '#263f55', secondary: '#527a9b', accent: '#7fa5c2', soft: '#f0f6fa', ink: '#243d50', background: '#f3f7f9' },
    plum: { name: 'Plum', primary: '#581c4f', secondary: '#a21caf', accent: '#d946ef', soft: '#fdf4ff', ink: '#4d2347', background: '#faf5fb' },
    gray: { name: 'Gray', primary: '#374151', secondary: '#6b7280', accent: '#9ca3af', soft: '#f3f4f6', ink: '#27313f', background: '#f5f6f7' },
    fuchsia: { name: 'Fuchsia', primary: '#701a75', secondary: '#d946ef', accent: '#e879f9', soft: '#fdf4ff', ink: '#59205d', background: '#fbf5fc' },
    coral: { name: 'Coral', primary: '#7f2d2d', secondary: '#f9736d', accent: '#fb9a91', soft: '#fff1f2', ink: '#5f2d32', background: '#fcf5f6' }
  };
  let activeTheme = localStorage.getItem(THEME_KEY) in themes ? localStorage.getItem(THEME_KEY) : 'navy';
  let selectedConversationKey = '';
  const commandExamples = {
    ar: { agent: 'أضف موظف: Lina | موظف مبيعات', print: 'طباعة', copy: 'انسخ: VAREX AI', integrations: 'افحص البوابات' },
    en: { agent: 'add employee: Lina | Sales employee', print: 'print', copy: 'copy: VAREX AI', integrations: 'check integrations' },
    ur: { agent: 'ملازم شامل کریں: Lina | سیلز ملازم', print: 'پرنٹ', copy: 'کاپی: VAREX AI', integrations: 'گیٹ وے کی حالت' },
    fa: { agent: 'افزودن کارمند: Lina | کارمند فروش', print: 'چاپ', copy: 'کپی: VAREX AI', integrations: 'وضعیت درگاه‌ها' },
    zh: { agent: '添加员工: Lina | 销售员工', print: '打印', copy: '复制: VAREX AI', integrations: '网关状态' },
    ko: { agent: '직원 추가: Lina | 영업 직원', print: '인쇄', copy: '복사: VAREX AI', integrations: '연결 상태' },
    it: { agent: 'aggiungi dipendente: Lina | Addetta vendite', print: 'stampa', copy: 'copia: VAREX AI', integrations: 'stato integrazioni' },
    es: { agent: 'añadir empleado: Lina | Ventas', print: 'imprimir', copy: 'copiar: VAREX AI', integrations: 'estado de integraciones' },
    he: { agent: 'הוסף עובד: Lina | מכירות', print: 'הדפס', copy: 'העתק: VAREX AI', integrations: 'מצב החיבורים' },
    fr: { agent: 'ajouter un employé : Lina | Ventes', print: 'imprimer', copy: 'copier : VAREX AI', integrations: 'état des intégrations' },
    ru: { agent: 'добавить сотрудника: Lina | Продажи', print: 'печать', copy: 'копировать: VAREX AI', integrations: 'статус интеграций' },
    tr: { agent: 'çalışan ekle: Lina | Satış çalışanı', print: 'yazdır', copy: 'kopyala: VAREX AI', integrations: 'entegrasyon durumu' }
  };
  const i18n = () => window.VarexI18n;
  const t = (key, fallback, variables) => i18n()?.t(key, fallback, variables) ?? fallback ?? key;
  const currentLocale = () => i18n()?.locale || 'ar';

  function applyTheme(code, persist = true) {
    const normalized = themes[code] ? code : 'navy';
    const theme = themes[normalized];
    activeTheme = normalized;
    const root = document.documentElement;
    root.dataset.theme = normalized;
    root.style.setProperty('--navy', theme.primary);
    root.style.setProperty('--navy-2', theme.primary);
    root.style.setProperty('--blue', theme.secondary);
    root.style.setProperty('--indigo', theme.accent);
    root.style.setProperty('--soft', theme.soft);
    root.style.setProperty('--ink', theme.ink);
    root.style.setProperty('--bg', theme.background);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.primary);
    if (persist) localStorage.setItem(THEME_KEY, normalized);
    $$('.theme-swatch').forEach(button => button.classList.toggle('active', button.dataset.theme === normalized));
  }

  function renderThemeCatalog() {
    const catalog = $('#themeCatalog'); if (!catalog) return;
    catalog.replaceChildren(...Object.entries(themes).map(([code, theme]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `theme-swatch ${code === activeTheme ? 'active' : ''}`; button.dataset.theme = code;
      button.innerHTML = `<span class="theme-colors"><span style="background:${theme.primary}"></span><span style="background:${theme.secondary}"></span><span style="background:${theme.accent}"></span><span style="background:${theme.soft}"></span></span><b>${safe(theme.name)}</b>`;
      button.addEventListener('click', async () => {
        applyTheme(code);
        if (state.org) {
          try { const [org] = await rest('ai_organizations', { method: 'PATCH', query: `id=eq.${state.org.id}`, body: { ui_theme: code } }); state.org = org; }
          catch (error) { notify(error.message, true); return; }
        }
        notify(t('theme.saved', 'تم تطبيق المظهر وحفظه.'));
      });
      return button;
    }));
  }

  function notify(message, error = false) {
    toast.textContent = message;
    toast.style.background = error ? '#b63847' : '';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function showIntegrationModal(provider, message = '', actionLabel = '') {
    const modal = $('#integrationModal');
    if (!modal) return;
    const name = providerNames[provider] || 'الحساب';
    const logo = $('#integrationModalLogo');
    const network = $('#integrationModalNetwork');
    if (logo) { logo.src = `/brands/${provider}.svg`; logo.alt = name; }
    if (network) network.className = `network ${({ whatsapp: 'wa', instagram: 'ig', facebook: 'fb', tiktok: 'tt' })[provider] || ''} integration-auth-logo`;
    $('#integrationModalTitle').textContent = `ربط ${name}`;
    $('#integrationModalMessage').textContent = message || 'VAREX AI ما زال مفتوحاً. أكمل تسجيل الدخول في نافذة المزود الرسمية، وسترجع النتيجة إلى التطبيق تلقائياً.';
    const action = $('#continueIntegrationModal');
    if (action) {
      action.hidden = !actionLabel;
      action.disabled = false;
      action.textContent = actionLabel || 'فتح نافذة الربط الرسمية';
    }
    const dismiss = $('#hideIntegrationModal');
    if (dismiss) dismiss.textContent = actionLabel ? 'إلغاء' : 'العودة إلى VAREX';
    modal.classList.add('open');
  }

  function hideIntegrationModal() { $('#integrationModal')?.classList.remove('open'); }

  function cancelIntegrationModal() {
    if (integrationPopup && !integrationPopup.closed) {
      hideIntegrationModal();
      return;
    }
    const button = pendingIntegration?.button;
    const previousLabel = pendingIntegration?.previousLabel;
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = previousLabel || 'ربط الحساب';
    }
    pendingIntegration = null;
    hideIntegrationModal();
  }

  function clearIntegrationPopup(closeWindow = false) {
    clearInterval(integrationPopupTimer);
    integrationPopupTimer = null;
    if (closeWindow && integrationPopup && !integrationPopup.closed) integrationPopup.close();
    integrationPopup = null;
    pendingIntegration = null;
    hideIntegrationModal();
  }

  function showIntegrationResult(result, provider) {
    const name = providerNames[provider] || 'الحساب';
    if (result === 'connected') notify(`تم ربط ${name} الخاص بهذه المساحة بنجاح`);
    else if (result === 'action_required') notify(`تم تسجيل الدخول إلى ${name}، لكن يلزم اختيار حساب تجاري صالح`, true);
    else notify(`لم يكتمل ربط ${name}. أعد المحاولة من صفحة ربط الحسابات.`, true);
  }

  async function finishIntegrationPopup(payload) {
    if (integrationResultHandled) return;
    const result = String(payload?.integration || 'error');
    const reportedProvider = String(payload?.provider || '');
    const provider = providerNames[reportedProvider] ? reportedProvider : pendingIntegration?.provider;
    if (!provider) return;
    const pendingButton = pendingIntegration?.button;
    const previousLabel = pendingIntegration?.previousLabel;
    integrationResultHandled = true;
    clearIntegrationPopup(true);
    try {
      state.integrations = await rest('ai_integrations', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      renderIntegrations();
      await audit('integration_oauth_returned', 'integration', null, { provider, result });
    } catch (_) {
      if (pendingButton?.isConnected) {
        pendingButton.disabled = false;
        pendingButton.textContent = previousLabel || 'ربط الحساب';
      }
    }
    showIntegrationResult(result, provider);
  }

  if (integrationChannel) integrationChannel.addEventListener('message', event => { void finishIntegrationPopup(event.data); });

  window.addEventListener('message', event => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (event.origin === location.origin && payload?.type === 'VAREX_INTEGRATION_CALLBACK') {
        void finishIntegrationPopup(payload);
        return;
      }
      const facebookOrigin = event.origin === 'https://facebook.com' || event.origin === 'https://www.facebook.com' || event.origin.endsWith('.facebook.com');
      if (!facebookOrigin) return;
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;
      const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
      whatsappSignupEvent = {
        type: 'WA_EMBEDDED_SIGNUP',
        event: String(payload.event || ''),
        data: {
          waba_id: String(data.waba_id || ''),
          business_id: String(data.business_id || ''),
          phone_number_id: String(data.phone_number_id || '')
        }
      };
    } catch (_) { /* Ignore unrelated cross-window messages. */ }
  });

  function loadFacebookSdk(appId, graphVersion) {
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      return Promise.resolve(window.FB);
    }
    if (facebookSdkPromise) return facebookSdkPromise;
    facebookSdkPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { facebookSdkPromise = null; reject(new Error('تعذر تحميل بوابة ميتا')); }, 15000);
      const previousInit = window.fbAsyncInit;
      window.fbAsyncInit = () => {
        if (typeof previousInit === 'function') previousInit();
        window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
        clearTimeout(timeout);
        resolve(window.FB);
      };
      if (!document.getElementById('facebook-jssdk')) {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.src = 'https://connect.facebook.net/ar_AR/sdk.js';
        script.onerror = () => { clearTimeout(timeout); facebookSdkPromise = null; reject(new Error('تعذر تحميل بوابة ميتا')); };
        document.head.appendChild(script);
      }
    });
    return facebookSdkPromise;
  }

  async function waitForWhatsAppSignupEvent() {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      if (whatsappSignupEvent?.event) return whatsappSignupEvent;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  async function finishWhatsAppSignup(context, code) {
    const sessionEvent = await waitForWhatsAppSignupEvent();
    if (!sessionEvent) throw new Error('لم تصل نتيجة ربط واتساب من ميتا؛ أعد المحاولة');
    if (sessionEvent.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') throw new Error('اختر ربط حساب WhatsApp Business الحالي للمحافظة على الرقم والمحادثات');
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
    const response = await fetch(`${API_URL}/integrations/complete/meta-sdk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' },
      body: json({ provider: 'whatsapp', organization_id: state.org.id, oauth_state: context.oauth_state, code, session_event: sessionEvent })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'تعذر إكمال ربط واتساب');
    state.integrations = await rest('ai_integrations', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
    renderIntegrations();
    await audit('integration_oauth_completed', 'integration', null, { provider: 'whatsapp', coexistence: true });
    notify(result.connected ? 'تم ربط WhatsApp Business مع الحفاظ على الرقم والمحادثات' : 'تم الربط، وتحتاج ميتا إكمال إعداد الحساب التجاري');
  }

  function whatsappIntegrationRecord() {
    return state.integrations.find(item => item.provider === 'whatsapp');
  }

  function integrationButtonLabel(record) {
    return !record ? 'ربط الحساب' : record.status === 'connected' ? 'إعادة الربط' : record.status === 'action_required' ? 'إكمال الربط' : 'ربط الحساب';
  }

  function whatsappSignupIsReady() {
    return Boolean(
      whatsappSignupContext &&
      window.FB &&
      state.org?.id &&
      whatsappSignupContext.organization_id === state.org.id &&
      whatsappSignupContextExpiresAt > Date.now() + 30000
    );
  }

  async function prepareWhatsAppSignup() {
    if (!state.session?.access_token || !state.org?.id) return null;
    if (whatsappSignupIsReady()) return whatsappSignupContext;
    if (whatsappSignupContextPromise) return whatsappSignupContextPromise;

    whatsappSignupPreparationError = '';
    whatsappSignupContextPromise = (async () => {
      if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
      const params = new URLSearchParams({ provider: 'whatsapp', organization_id: state.org.id });
      let response = await fetch(`${API_URL}/integrations/start?${params}`, { headers: { Authorization: `Bearer ${state.session.access_token}` } });
      if (response.status === 401) {
        await refreshSession();
        response = await fetch(`${API_URL}/integrations/start?${params}`, { headers: { Authorization: `Bearer ${state.session.access_token}` } });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر تجهيز ربط واتساب');
      if (data.flow !== 'whatsapp_embedded_signup') throw new Error('إعداد ربط واتساب غير مكتمل');
      await loadFacebookSdk(data.app_id, data.graph_version);
      whatsappSignupContext = { ...data, organization_id: state.org.id };
      whatsappSignupContextExpiresAt = Date.now() + 8 * 60 * 1000;
      return whatsappSignupContext;
    })();

    try {
      return await whatsappSignupContextPromise;
    } catch (error) {
      whatsappSignupContext = null;
      whatsappSignupContextExpiresAt = 0;
      whatsappSignupPreparationError = error.message || 'تعذر تجهيز ربط واتساب';
      throw error;
    } finally {
      whatsappSignupContextPromise = null;
    }
  }

  function launchWhatsAppSignup(context, button, previousLabel) {
    if (whatsappSignupInFlight) {
      notify('محاولة ربط WhatsApp مفتوحة الآن. أكملها أو أغلقها قبل إعادة المحاولة.');
      return;
    }
    whatsappSignupEvent = null;
    const sdk = window.FB;
    if (!sdk) throw new Error('لم تجهز نافذة ميتا بعد؛ اضغط الزر مرة ثانية');
    const attempt = ++whatsappSignupAttempt;
    whatsappSignupInFlight = true;
    button.disabled = true;
    button.textContent = 'أكمل الربط داخل Meta';
    let callbackReceived = false;
    let codeReceived = false;
    const resetTimer = setTimeout(() => {
      if (callbackReceived || attempt !== whatsappSignupAttempt) return;
      whatsappSignupInFlight = false;
      pendingIntegration = null;
      whatsappSignupContext = null;
      whatsappSignupContextExpiresAt = 0;
      button.disabled = false;
      button.textContent = 'إعادة تجهيز الربط';
      hideIntegrationModal();
      notify('انتهت مهلة الربط من Meta من دون نتيجة. اضغط إعادة تجهيز الربط مرة واحدة.', true);
    }, 10 * 60 * 1000);

    try {
      sdk.login(async response => {
        if (callbackReceived || attempt !== whatsappSignupAttempt) return;
        callbackReceived = true;
        clearTimeout(resetTimer);
        let completed = false;
        try {
          const code = String(response?.authResponse?.code || '');
          if (!code) throw new Error('أغلقت Meta الربط أو لم تُرجع نتيجة؛ لم يكتمل ربط WhatsApp');
          codeReceived = true;
          button.textContent = 'جارٍ حفظ الربط...';
          await finishWhatsAppSignup(context, code);
          completed = true;
        } catch (error) { notify(error.message, true); }
        finally {
          whatsappSignupInFlight = false;
          pendingIntegration = null;
          hideIntegrationModal();
          button.disabled = false;
          if (!completed) button.textContent = codeReceived ? 'إعادة تجهيز الربط' : previousLabel;
          if (codeReceived) {
            whatsappSignupContext = null;
            whatsappSignupContextExpiresAt = 0;
          }
        }
      }, {
        config_id: context.config_id,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          version: 'v4',
          featureType: 'whatsapp_business_app_onboarding'
        }
      });
    } catch (error) {
      callbackReceived = true;
      clearTimeout(resetTimer);
      whatsappSignupInFlight = false;
      pendingIntegration = null;
      hideIntegrationModal();
      button.disabled = false;
      button.textContent = previousLabel;
      throw error;
    }
  }

  function setLoading(show) { $('#authLoading').classList.toggle('show', show); }
  function showError(target, message) { target.textContent = message; target.classList.toggle('show', Boolean(message)); }
  function saveSession(session) {
    state.session = session;
    state.user = session?.user || null;
    if (session) localStorage.setItem(SESSION_KEY, json(session)); else localStorage.removeItem(SESSION_KEY);
  }

  async function authRequest(path, body) {
    const response = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || 'تعذر إكمال تسجيل الدخول');
    return data;
  }

  async function refreshSession() {
    if (!state.session?.refresh_token) throw new Error('انتهت الجلسة');
    const fresh = await authRequest('refresh', { refresh_token: state.session.refresh_token });
    saveSession(fresh);
    return fresh;
  }

  async function refreshIntegrationReadiness(retry = true) {
    if (!state.session?.access_token || !state.org?.id) return;
    const params = new URLSearchParams({ organization_id: state.org.id });
    const response = await fetch(`${API_URL}/integrations/readiness?${params}`, {
      headers: { Authorization: `Bearer ${state.session.access_token}` }
    });
    if (response.status === 401 && retry) {
      await refreshSession();
      return refreshIntegrationReadiness(false);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'تعذر فحص جاهزية قنوات التواصل');
    state.integrationReadiness = result.providers || {};
    renderIntegrations();
  }

  function isVarexAdmin() {
    return String(state.user?.email || '').trim().toLowerCase() === DEVELOPER_EMAIL;
  }

  function isDeveloperAccount() { return isVarexAdmin(); }

  async function adminRequest(path, { method = 'GET', body, retry = true } = {}) {
    if (!state.session?.access_token) throw new Error('يلزم تسجيل الدخول');
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
    const response = await fetch(`${API_URL}/admin/${path}`, {
      method,
      headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : json(body)
    });
    if (response.status === 401 && retry) { await refreshSession(); return adminRequest(path, { method, body, retry: false }); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'تعذر حفظ إعداد Meta');
    return data;
  }

  async function refreshMetaAdminStatus() {
    const panel = $('#metaAdminPanel');
    if (!panel) return;
    panel.hidden = !isVarexAdmin();
    if (panel.hidden) return;
    if (!$('#syncExistingWhatsApp')) {
      const recoveryRow = document.createElement('div');
      recoveryRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap';
      recoveryRow.innerHTML = '<button class="btn btn-light" id="syncExistingWhatsApp" type="button">ربط حساب واتساب الموجود</button><span id="whatsappSyncStatus" class="status follow">جاهز للاستعادة</span>';
      panel.append(recoveryRow);
      $('#syncExistingWhatsApp').addEventListener('click', () => syncExistingWhatsApp());
    }
    const status = $('#metaSecretStatus');
    const details = $('#metaReadinessDetails');
    status.textContent = 'جارٍ التحقق...';
    status.className = 'status follow';
    try {
      const result = await adminRequest('meta-status');
      status.textContent = result.configured ? 'بوابة Meta مفعّلة' : 'بانتظار المفتاح';
      status.className = `status ${result.configured ? 'qualified' : 'follow'}`;
      if (details) {
        const checks = [
          `Facebook وInstagram: ${result.configured ? 'جاهز' : 'غير مكتمل'}`,
          `WhatsApp: ${result.whatsapp_configured ? 'جاهز للربط' : 'غير مكتمل'}`,
          `Webhook واتساب: ${result.whatsapp_webhook_configured ? 'مفعّل' : 'غير مكتمل'}`,
          `TikTok: ${result.tiktok_configured ? result.tiktok_callback_mode === 'direct' ? 'جاهز للربط' : 'رابط رجوع خارجي يحتاج تحقق' : 'غير مكتمل'}`,
          `Graph API: ${result.graph_version || 'غير محدد'}`
        ];
        details.textContent = checks.join(' • ');
      }
    } catch (error) {
      status.textContent = 'تعذر التحقق';
      status.className = 'status new';
      if (details) details.textContent = 'تعذر قراءة حالة القنوات الآن.';
    }
  }

  async function saveMetaSecret() {
    const input = $('#metaAppSecret'), button = $('#saveMetaSecret');
    const appSecret = input.value.trim();
    if (appSecret.length < 20 || /\s/.test(appSecret)) { notify('أدخل المفتاح السري الصحيح لتطبيق Meta', true); input.focus(); return; }
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';
    try {
      await adminRequest('meta-secret', { method: 'POST', body: { app_secret: appSecret } });
      input.value = '';
      await refreshMetaAdminStatus();
      notify('تم حفظ المفتاح وتفعيل بوابة Meta');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'حفظ وتفعيل الربط'; }
  }

  async function syncExistingWhatsApp(buttonOverride = null) {
    const button = buttonOverride instanceof HTMLElement ? buttonOverride : $('#syncExistingWhatsApp');
    const status = buttonOverride instanceof HTMLElement
      ? $('.connection-state', buttonOverride.closest('.integration'))
      : $('#whatsappSyncStatus');
    if (!button || !status || !state.org?.id) return;
    button.disabled = true;
    button.textContent = 'جارٍ ربط الحساب...';
    status.textContent = 'جارٍ التحقق من Meta';
    status.className = 'status follow';
    try {
      const result = await adminRequest('whatsapp-sync-existing', { method: 'POST', body: { organization_id: state.org.id } });
      state.integrations = await rest('ai_integrations', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      renderIntegrations();
      status.textContent = result.connected ? 'تم ربط الحساب' : 'يحتاج إكمالاً';
      status.className = `status ${result.connected ? 'qualified' : 'follow'}`;
      notify(result.connected ? 'تم ربط حساب WhatsApp الموجود داخل VAREX' : 'تم العثور على الحساب ويحتاج إكمال الإعداد');
    } catch (error) {
      status.textContent = 'يحتاج صلاحية واتساب';
      status.className = 'status new';
      notify(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'ربط حساب واتساب الموجود';
    }
  }

  async function rest(table, { method = 'GET', query = '', body, prefer = 'return=representation', retry = true } = {}) {
    if (!state.session?.access_token) throw new Error('يلزم تسجيل الدخول');
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
    const response = await fetch(`${API_URL}/data/${table}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json',
        Prefer: prefer
      },
      body: body === undefined ? undefined : json(body)
    });
    if (response.status === 401 && retry) { await refreshSession(); return rest(table, { method, query, body, prefer, retry: false }); }
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.message || data?.details || data?.hint || 'تعذر حفظ البيانات');
    return data;
  }

  async function audit(action, entityType, entityId, details = {}) {
    if (!state.org) return;
    try {
      await rest('ai_audit_logs', { method: 'POST', body: { organization_id: state.org.id, user_id: state.user.id, action, entity_type: entityType, entity_id: entityId || null, details } });
    } catch (_) { /* Audit failure should not block the user's main action. */ }
  }

  const titles = {
    dashboard: ['dashboard.title', 'dashboard.subtitle', 'مركز القيادة', 'بيانات مساحة العمل الحقيقية في مكان واحد.'],
    agents: ['agents.title', 'agents.subtitle', 'الموظفون الأذكياء', 'إنشاء وإدارة فريق العمل الرقمي'],
    tasks: ['tasks.title', 'tasks.subtitle', 'المهام والتشغيل', 'إنشاء المهام وتتبع حالتها وموافقاتها'],
    inbox: ['inbox.title', 'inbox.subtitle', 'صندوق الرسائل الموحد', 'يعرض الرسائل الحقيقية المحفوظة فقط.'],
    leads: ['leads.title', 'leads.subtitle', 'العملاء المحتملون', 'متابعة الفرص المحفوظة في قاعدة البيانات.'],
    approvals: ['approvals.title', 'approvals.subtitle', 'مركز الموافقات', 'القرارات الحساسة بانتظار اعتمادك'],
    knowledge: ['knowledge.title', 'knowledge.subtitle', 'قاعدة المعرفة', 'الملفات الحقيقية التي يعتمد عليها الموظف الذكي'],
    reports: ['reports.title', 'reports.subtitle', 'التقارير والتحليلات', 'أرقام محسوبة من بيانات مساحة العمل.'],
    billing: ['billing.title', 'billing.subtitle', 'الاشتراك والفوترة', 'اختر الباقة وطريقة الدفع؛ يبدأ الاستخدام بعد تأكيد الدفع من حساب المطوّر.'],
    integrations: ['integrations.title', 'integrations.subtitle', 'ربط حسابات التواصل', 'كل بوابة تعرض حالة الربط والصلاحيات الحقيقية.'],
    settings: ['settings.title', 'settings.subtitle', 'الإعدادات', 'إدارة مساحة العمل والأمان واللغة والمظهر.']
  };

  function showView(id, updateHash = true) {
    if (!titles[id]) id = 'dashboard';
    if (subscriptionLocked() && id !== 'billing') id = 'billing';
    $$('.view').forEach(view => view.classList.toggle('active', view.id === id));
    $$('.nav-btn').forEach(button => {
      const active = button.dataset.view === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    $('#pageTitle').textContent = t(titles[id][0], titles[id][2]);
    $('#pageSubtitle').textContent = t(titles[id][1], titles[id][3]);
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
    if (updateHash) history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'integrations' && !whatsappSignupIsReady() && !whatsappSignupContextPromise) {
      renderIntegrations();
    }
  }

  function currentSubscription() {
    if (isDeveloperAccount()) return { plan_code: 'developer', status: 'active', monthly_task_limit: 120000, billing_cycle: 'developer' };
    const active = state.subscriptions.find(item => item.status === 'active' && (!item.renews_at || new Date(item.renews_at).getTime() > Date.now()));
    return active || state.subscriptions[0] || { plan_code: 'pending', status: 'subscription_required', monthly_task_limit: 1 };
  }

  function hasActiveSubscription() {
    if (isDeveloperAccount()) return true;
    const subscription = state.subscriptions.find(item => item.status === 'active' && plans[item.plan_code] && !['developer', 'pending'].includes(item.plan_code));
    return Boolean(subscription && (!subscription.renews_at || new Date(subscription.renews_at).getTime() > Date.now()));
  }

  function subscriptionLocked() { return Boolean(state.user && state.org && !hasActiveSubscription()); }

  function applySubscriptionGate() {
    const locked = subscriptionLocked();
    document.body.classList.toggle('subscription-locked', locked);
    $$('.nav-btn').forEach(button => {
      const disabled = locked && button.dataset.view !== 'billing';
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
      button.title = disabled ? 'فعّل اشتراكاً مدفوعاً لفتح هذا القسم' : '';
    });
    $$('[data-action="search"],[data-action="notifications"]').forEach(button => { button.disabled = locked; });
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium' }).format(new Date(value));
  }

  function statusLabel(status) {
    const map = { draft: ['status.draft', 'مسودة'], queued: ['status.queued', 'في الانتظار'], running: ['status.running', 'قيد التنفيذ'], awaiting_approval: ['status.awaitingApproval', 'بانتظار الموافقة'], completed: ['status.completed', 'مكتملة'], failed: ['status.failed', 'فشلت'], cancelled: ['status.cancelled', 'ملغاة'], active: ['status.active', 'نشط'], paused: ['status.paused', 'متوقف'], pending: ['status.pending', 'بانتظار الموافقة'], approved: ['status.approved', 'مقبول'], rejected: ['status.rejected', 'مرفوض'], stored: ['status.stored', 'محفوظ'] };
    return map[status] ? t(map[status][0], map[status][1]) : status;
  }

  function renderAgents() {
    const grid = $('#agentsGrid');
    grid.replaceChildren();
    state.agents.forEach(agent => {
      const card = document.createElement('article');
      card.className = 'card agent-card';
      const channelTags = (agent.channels || []).map(channel => `<span class="tag">${safe(channel)}</span>`).join('');
      card.innerHTML = `<div class="agent-card-top"><div class="bot-avatar"><svg class="icon"><use href="#i-bot"/></svg></div><div><h3>${safe(agent.name)}</h3><p>${safe(agent.role)}</p></div><button class="toggle ${agent.status === 'active' ? 'on' : ''}" aria-label="تفعيل الموظف" aria-pressed="${agent.status === 'active'}"></button></div><div class="tags"><span class="tag">${safe(agent.language || 'العربية')}</span>${channelTags}</div><div class="agent-card-foot"><span>${agent.status === 'active' ? 'نشط داخل مساحة العمل' : 'متوقف لحين التفعيل'}</span><button class="link-btn" type="button">عرض المهام</button></div>`;
      $('.toggle', card).addEventListener('click', async event => {
        const next = agent.status === 'active' ? 'paused' : 'active';
        event.currentTarget.disabled = true;
        try {
          await rest('ai_agents', { method: 'PATCH', query: `id=eq.${agent.id}`, body: { status: next, updated_at: new Date().toISOString() } });
          agent.status = next; renderAgents(); renderDashboard(); await audit('agent_status_changed', 'agent', agent.id, { status: next });
          notify(next === 'active' ? 'تم تفعيل الموظف داخل مساحة العمل' : 'تم إيقاف الموظف');
        } catch (error) { event.currentTarget.disabled = false; notify(error.message, true); }
      });
      $('.link-btn', card).addEventListener('click', () => showView('tasks'));
      grid.append(card);
    });
    const empty = document.createElement('article');
    empty.className = 'card empty-agent';
    empty.innerHTML = '<div><div class="circle"><svg class="icon"><use href="#i-plus"/></svg></div><h3>أضف موظفاً جديداً</h3><p>للتسويق أو المبيعات أو خدمة العملاء</p><button class="btn btn-light">ابدأ الإعداد</button></div>';
    $('button', empty).addEventListener('click', openAgentModal);
    grid.append(empty);
    refreshTaskAgentOptions();
  }

  function renderTasks() {
    const grid = $('#tasksGrid');
    grid.replaceChildren();
    if (!state.tasks.length) {
      grid.innerHTML = '<article class="card empty-state"><b>لا توجد مهام بعد</b>أنشئ أول مهمة وحدد الموظف المسؤول والتعليمات.</article>';
      return;
    }
    state.tasks.forEach(task => {
      const agent = state.agents.find(item => item.id === task.agent_id);
      const card = document.createElement('article');
      card.className = 'card task-card';
      const statusClass = task.status === 'completed' ? 'qualified' : task.status === 'awaiting_approval' ? 'follow' : 'new';
      card.innerHTML = `<div class="task-top"><div class="stat-icon purple"><svg class="icon"><use href="#i-clock"/></svg></div><div><h3>${safe(task.title)}</h3><p>${safe(agent?.name || 'بدون تعيين')} • أولوية ${safe(({ low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' })[task.priority] || task.priority)}</p></div><span class="status ${statusClass} task-status">${safe(statusLabel(task.status))}</span></div><div class="task-body">${safe(task.instructions || 'لا توجد تعليمات إضافية.')}</div><div class="task-foot"><span>أُنشئت ${formatDate(task.created_at)}</span><button class="link-btn" type="button">${task.status === 'draft' ? 'إرسال للمراجعة' : 'عرض الحالة'}</button></div>`;
      $('.link-btn', card).addEventListener('click', async () => {
        if (task.status !== 'draft') { notify(`حالة المهمة: ${statusLabel(task.status)}`); return; }
        const next = task.requires_approval ? 'awaiting_approval' : 'approved';
        try {
          await rest('ai_tasks', { method: 'PATCH', query: `id=eq.${task.id}`, body: { status: next, updated_at: new Date().toISOString() } });
          task.status = next;
          if (next === 'awaiting_approval') {
            const [approval] = await rest('ai_approvals', { method: 'POST', body: { organization_id: state.org.id, task_id: task.id, title: `اعتماد مهمة: ${task.title}`, summary: task.instructions || 'مهمة جديدة تحتاج موافقة قبل التنفيذ.', requested_by: state.user.id } });
            state.approvals.unshift(approval);
          }
          renderAll(); await audit('task_submitted', 'task', task.id, { status: next });
          notify(next === 'awaiting_approval' ? 'تم إرسال المهمة إلى مركز الموافقات' : t('tasks.approvedOnly', 'تم اعتماد المهمة فقط؛ لم تُرسل خارجياً.'));
        } catch (error) { notify(error.message, true); }
      });
      grid.append(card);
    });
  }

  function renderLeads() {
    const body = $('#leadsTable tbody');
    body.replaceChildren();
    if (!state.leads.length) {
      const row = document.createElement('tr'); row.innerHTML = '<td colspan="6"><div class="empty-state"><b>لا يوجد عملاء بعد</b>أضف أول عميل محتمل لتبدأ المتابعة.</div></td>'; body.append(row); return;
    }
    state.leads.forEach(lead => {
      const row = document.createElement('tr');
      const status = ({ new: ['new', 'جديد'], qualified: ['qualified', 'مؤهل'], follow_up: ['follow', 'متابعة'], won: ['qualified', 'تم البيع'], lost: ['hot', 'مفقود'] })[lead.status] || ['new', lead.status];
      row.innerHTML = `<td><div class="person"><span class="person-avatar" style="background:#536ee5">${safe(lead.name.slice(0, 2))}</span><b>${safe(lead.name)}</b></div></td><td>${safe(lead.service)}</td><td><span class="score"><span style="width:${lead.score}%"></span></span>${lead.score}%</td><td>${safe(lead.source)}</td><td><span class="status ${status[0]}">${safe(status[1])}</span></td><td>${safe(lead.next_action || 'جمع المتطلبات')}</td>`;
      body.append(row);
    });
  }

  function renderApprovals() {
    const grid = $('#approvals .approval-grid');
    grid.replaceChildren();
    if (!state.approvals.length) { grid.innerHTML = '<article class="card empty-state"><b>لا توجد موافقات</b>ستظهر هنا الأسعار والمنشورات والقرارات الحساسة.</article>'; return; }
    state.approvals.forEach(approval => {
      const card = document.createElement('article'); card.className = `card approval-card ${approval.status !== 'pending' ? 'resolved' : ''}`; card.dataset.state = approval.status;
      card.innerHTML = `<div class="approval-top"><div class="approval-icon"><svg class="icon"><use href="#i-check"/></svg></div><div class="approval-copy"><h3>${safe(approval.title)}</h3><p>${formatDate(approval.created_at)}</p></div><span class="status ${approval.status === 'pending' ? 'follow' : approval.status === 'approved' ? 'qualified' : 'hot'}">${safe(statusLabel(approval.status))}</span></div><div class="approval-details"><div><span>الملخص</span><b>${safe(approval.summary || 'لا يوجد')}</b></div></div><div class="approval-actions"><button class="btn btn-success approve">موافقة</button><button class="btn btn-danger reject">رفض</button></div>`;
      $$('.approve,.reject', card).forEach(button => button.addEventListener('click', () => resolveApproval(approval, button.classList.contains('approve') ? 'approved' : 'rejected')));
      grid.append(card);
    });
  }

  async function resolveApproval(approval, status) {
    try {
      await rest('ai_approvals', { method: 'PATCH', query: `id=eq.${approval.id}`, body: { status, reviewed_by: state.user.id, reviewed_at: new Date().toISOString() } });
      approval.status = status;
      const task = state.tasks.find(item => item.id === approval.task_id);
      if (task) {
        const taskStatus = status === 'approved' ? 'approved' : 'cancelled';
        await rest('ai_tasks', { method: 'PATCH', query: `id=eq.${task.id}`, body: { status: taskStatus, updated_at: new Date().toISOString() } });
        task.status = taskStatus;
      }
      renderAll(); await audit('approval_resolved', 'approval', approval.id, { status });
      notify(status === 'approved' ? t('tasks.approvedOnly', 'تم اعتماد المهمة فقط؛ لم تُرسل خارجياً.') : 'تم رفض الطلب وإيقاف المهمة');
    } catch (error) { notify(error.message, true); }
  }

  function renderKnowledge() {
    const grid = $('#knowledgeGrid') || $('.knowledge-grid');
    grid.replaceChildren();
    if (!state.knowledge.length) {
      grid.innerHTML = `<article class="card empty-state"><b>${safe(t('knowledge.empty', 'لا توجد ملفات محفوظة بعد.'))}</b></article>`;
      return;
    }
    state.knowledge.forEach(item => {
      const card = document.createElement('article'); card.className = 'card knowledge-card'; card.dataset.db = 'true';
      card.innerHTML = `<div class="file-icon"><svg class="icon"><use href="#i-file"/></svg></div><h3>${safe(item.title)}</h3><p>${item.status === 'stored' ? safe(t('knowledge.stored', 'تم رفع الملف وحفظ محتواه.')) : 'هذا سجل قديم يحوي بيانات الملف فقط.'}</p><div class="knowledge-meta"><span>${Math.ceil((item.file_size || 0) / 1024)} KB</span><span>${formatDate(item.created_at)}</span></div>${item.status === 'stored' ? `<button class="btn btn-light knowledge-download" type="button">${safe(t('common.download', 'تحميل'))}</button>` : ''}`;
      $('.knowledge-download', card)?.addEventListener('click', () => downloadKnowledge(item));
      grid.append(card);
    });
  }

  async function downloadKnowledge(item) {
    try {
      const response = await fetch(`${API_URL}/knowledge/${encodeURIComponent(item.id)}/download`, { headers: { Authorization: `Bearer ${state.session.access_token}` } });
      if (response.status === 401) { await refreshSession(); return downloadKnowledge(item); }
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'تعذر تحميل الملف'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = item.title || 'VAREX-file'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { notify(error.message, true); }
  }

  function renderIntegrations() {
    $$('.integration').forEach(card => {
      const provider = card.dataset.provider;
      const button = $('.connect', card);
      if (!provider || !button) return;
      const record = state.integrations.find(item => item.provider === provider);
      const readiness = state.integrationReadiness?.[provider];
      const gatewayUnavailable = readiness?.configured === false;
      button.disabled = gatewayUnavailable;
      button.textContent = integrationButtonLabel(record);
      if (provider === 'whatsapp' && isVarexAdmin() && record?.status !== 'connected') {
        button.disabled = false;
        button.textContent = 'ربط حساب واتساب الموجود';
      } else if (provider === 'whatsapp' && whatsappSignupInFlight) {
        button.disabled = true;
        button.textContent = 'أكمل الربط داخل Meta';
      } else if (provider === 'whatsapp' && !gatewayUnavailable && !whatsappSignupIsReady() && record?.status !== 'connected') {
        button.disabled = Boolean(whatsappSignupContextPromise);
        button.textContent = whatsappSignupContextPromise ? 'جارٍ تجهيز ميتا...' : whatsappSignupPreparationError ? 'إعادة تجهيز الربط' : 'جارٍ تجهيز ميتا...';
      }
      let note = $('.connection-state', card);
      if (!note) { note = document.createElement('small'); note.className = 'connection-state'; $('.integration-copy', card)?.append(note); }
      if (!note) return;
      if (record?.status === 'connected') {
        note.dataset.state = 'connected';
        note.textContent = provider === 'tiktok'
          ? `متصل: ${record.connected_account || 'الحساب المحدد'} • صلاحية الحساب الأساسية`
          : `متصل: ${record.connected_account || 'الحساب المحدد'}`;
      } else if (record?.status === 'action_required') {
        note.dataset.state = 'error';
        note.textContent = ({
          whatsapp: 'أكمل اختيار حساب WhatsApp Business والرقم التجاري',
          facebook: 'لم نجد صفحة مُدارة؛ امنح VAREX صلاحية الصفحة ثم أعد الربط',
          instagram: 'اربط حساب Instagram مهني بصفحة Facebook ثم أعد الربط',
          tiktok: 'لم يكتمل اختيار حساب TikTok صالح'
        })[provider] || 'يلزم إكمال إعداد الحساب التجاري';
      } else if (gatewayUnavailable) {
        note.dataset.state = 'unavailable';
        note.textContent = 'بوابة هذه القناة تحتاج إكمال الإعداد من إدارة VAREX';
      } else if (readiness?.configured) {
        note.dataset.state = 'ready';
        note.textContent = provider === 'tiktok' && readiness.callback_mode === 'external_bridge'
          ? 'المفاتيح جاهزة؛ تحقق من جسر رابط الرجوع الخارجي قبل التجربة'
          : provider === 'tiktok' && readiness.capability === 'account_identity'
          ? 'جاهز لربط الحساب؛ النشر ينتظر صلاحية TikTok'
          : 'بوابة الربط جاهزة للتجربة';
      } else {
        note.dataset.state = 'checking';
        note.textContent = 'جارٍ فحص جاهزية الربط...';
      }
    });
    const whatsapp = state.integrations.find(item => item.provider === 'whatsapp');
    const whatsappConfigured = state.integrationReadiness?.whatsapp?.configured !== false;
    const integrationsViewActive = $('#integrations')?.classList.contains('active');
    if (integrationsViewActive && whatsappConfigured && !isVarexAdmin() && whatsapp?.status !== 'connected' && !whatsappSignupIsReady() && !whatsappSignupContextPromise && !whatsappSignupPreparationError) {
      void prepareWhatsAppSignup().then(renderIntegrations).catch(() => renderIntegrations());
    }
  }

  function renderBilling() {
    const subscription = currentSubscription();
    const plan = plans[subscription.plan_code] || plans.pending;
    const developer = isDeveloperAccount();
    const locked = subscriptionLocked();
    const used = state.tasks.length;
    const limit = Math.max(1, subscription.monthly_task_limit || plan.tasks || 1);
    const percent = developer ? 0 : Math.min(100, Math.round((used / limit) * 100));
    $('#currentPlanName').textContent = plan.name;
    $('#currentPlanDescription').textContent = developer
      ? 'دخول مجاني دائم بصلاحية كاملة، بدون دفع أو تاريخ انتهاء.'
      : subscription.status === 'active'
      ? `${plan.price} • ${limit.toLocaleString(currentLocale())} مهمة شهرياً • التجديد: ${formatDate(subscription.renews_at)}`
      : subscription.status === 'pending_payment'
      ? `${plan.price} • بانتظار تأكيد استلام الدفع من حساب المطوّر.`
      : 'اختر باقة مدفوعة وطريقة الدفع لإرسال طلب التفعيل.';
    $('#usageLabel').textContent = developer ? `${used.toLocaleString(currentLocale())} من غير محدود` : `${used.toLocaleString(currentLocale())} من ${limit.toLocaleString(currentLocale())}`;
    $('#usageBar').style.width = `${percent}%`;
    $('#sidebarPlan').textContent = plan.name;
    $('#sidebarUsagePercent').textContent = developer ? '∞' : locked ? 'مقفول' : `${percent}%`;
    $('#sidebarUsageBar').style.width = `${percent}%`;
    $('#sidebarUsageText').textContent = developer ? 'دخول مجاني دائم' : locked ? 'بانتظار اشتراك مدفوع فعّال' : `${used.toLocaleString(currentLocale())} من ${limit.toLocaleString(currentLocale())} مهمة`;
    selectPlanByName(plan.name);
    const heroButton = $('.billing-hero .choose-plan');
    if (heroButton) heroButton.hidden = developer;
    $$('.plan-card .choose-plan').forEach(button => { button.disabled = developer; button.hidden = developer; });
    const pending = state.subscriptions.find(item => item.status === 'pending_payment');
    $('#paymentLabel').textContent = developer
      ? 'لا يحتاج حساب المطوّر إلى وسيلة دفع'
      : pending
      ? `${pending.payment_method || 'طريقة الدفع المختارة'} — بانتظار تأكيد الدفع`
      : subscription.status === 'active'
      ? `${subscription.payment_method || 'الدفع اليدوي'} — تم تأكيد الدفع`
      : 'اختر باقة وطريقة دفع';
    const history = $('#subscriptionHistoryBody');
    if (history) {
      const statusNames = { active: 'نشط', pending_payment: 'بانتظار الدفع', superseded: 'مستبدل', cancelled: 'ملغى', trialing: 'منتهي' };
      history.innerHTML = developer
        ? '<tr><td>DEVELOPER</td><td>حساب المطوّر</td><td>دائم</td><td>0 درهم</td><td><span class="status qualified">نشط</span></td><td></td></tr>'
        : state.subscriptions.length
        ? state.subscriptions.map((item, index) => { const info = plans[item.plan_code] || plans.pending; return `<tr><td>${safe(String(item.id || '').slice(0, 10))}</td><td>${safe(info.name)}</td><td>${safe(formatDate(item.created_at || item.starts_at))}</td><td>${safe(info.price)}</td><td><span class="status ${item.status === 'active' ? 'qualified' : 'follow'}">${safe(statusNames[item.status] || item.status)}</span></td><td>${index === 0 ? '<button class="link-btn subscription-download" type="button">تحميل الملخص</button>' : ''}</td></tr>`; }).join('')
        : '<tr><td colspan="6">اختر باقة لإرسال طلب الاشتراك.</td></tr>';
      $('.subscription-download', history)?.addEventListener('click', downloadSubscriptionSummary);
    }
    renderDeveloperSubscriptions();
  }

  function downloadSubscriptionSummary() {
    const sub = currentSubscription(); const plan = plans[sub.plan_code] || plans.pending;
    const summary = `VAREX AI EMPLOYEE\nملخص اشتراك — ليس فاتورة ضريبية\nالباقة: ${plan.name}\nالسعر: ${plan.price}\nالحالة: ${sub.status}\nالتاريخ: ${formatDate(new Date())}`;
    const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'VAREX-AI-subscription-summary.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadDeveloperSubscriptions() {
    if (!isDeveloperAccount()) return;
    const result = await adminRequest('subscriptions');
    state.adminSubscriptions = Array.isArray(result) ? result : [];
    renderDeveloperSubscriptions();
  }

  function renderDeveloperSubscriptions() {
    const panel = $('#developerSubscriptionsPanel');
    const body = $('#developerSubscriptionsBody');
    if (!panel || !body) return;
    panel.hidden = !isDeveloperAccount();
    if (panel.hidden) return;
    body.innerHTML = state.adminSubscriptions.length
      ? state.adminSubscriptions.map(item => {
        const plan = plans[item.plan_code] || plans.pending;
        const status = item.status === 'active' ? 'نشط' : 'بانتظار تأكيد الدفع';
        const action = item.status === 'pending_payment' ? `<button class="btn btn-primary developer-activate" type="button" data-subscription-id="${safe(item.id)}">تأكيد الدفع والتفعيل</button>` : '—';
        return `<tr><td>${safe(item.organization_name || '—')}</td><td>${safe(item.owner_email || '—')}</td><td>${safe(plan.name)}</td><td>${safe(item.payment_method || '—')}</td><td><span class="status ${item.status === 'active' ? 'qualified' : 'follow'}">${status}</span></td><td>${action}</td></tr>`;
      }).join('')
      : '<tr><td colspan="6">لا توجد طلبات اشتراك بانتظار التفعيل.</td></tr>';
    $$('.developer-activate', body).forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      const previous = button.textContent;
      button.textContent = 'جارٍ التفعيل...';
      try {
        await adminRequest('subscriptions', { method: 'PATCH', body: { subscription_id: button.dataset.subscriptionId, action: 'activate' } });
        await loadDeveloperSubscriptions();
        notify('تم تأكيد الدفع وتفعيل اشتراك العميل');
      } catch (error) {
        button.disabled = false;
        button.textContent = previous;
        notify(error.message, true);
      }
    }));
  }

  function renderDashboard() {
    const statValues = $$('#dashboard .stats .stat > b');
    if (statValues.length >= 4) {
      statValues[0].textContent = state.agents.filter(agent => agent.status === 'active').length;
      statValues[1].textContent = state.messages.length;
      statValues[2].textContent = state.leads.filter(lead => ['new', 'qualified', 'follow_up'].includes(lead.status)).length;
      statValues[3].textContent = state.approvals.filter(item => item.status === 'pending').length;
    }
    const trends = $$('#dashboard .stats .trend');
    if (trends.length >= 4) {
      trends[0].textContent = state.agents.some(agent => agent.status === 'active') ? statusLabel('active') : statusLabel('paused');
      trends[1].textContent = 'DB'; trends[2].textContent = 'DB'; trends[3].textContent = statusLabel('pending');
    }
    const active = state.agents.find(agent => agent.status === 'active') || state.agents[0];
    const hero = $('.agent-hero');
    if (hero) {
      $('.agent-copy h4', hero).textContent = active?.name || 'لا يوجد موظف بعد';
      $('.agent-copy p', hero).textContent = active ? `${active.role} • ${active.language}` : 'أنشئ أول موظف ذكي للبدء';
      $('.online', hero).textContent = active?.status === 'active' ? 'نشط' : 'متوقف';
    }
    const kpis = $$('.agent-kpis .mini-kpi b');
    if (kpis.length >= 3) {
      kpis[0].textContent = state.tasks.filter(task => task.status === 'completed').length;
      kpis[1].textContent = state.tasks.length ? `${Math.round(state.tasks.filter(task => task.status === 'completed').length / state.tasks.length * 100)}%` : '0%';
      kpis[2].textContent = state.tasks.filter(task => ['queued', 'running', 'awaiting_approval', 'approved'].includes(task.status)).length;
      const labels = $$('.agent-kpis .mini-kpi span');
      if (labels.length >= 3) { labels[0].textContent = 'مهام مكتملة'; labels[1].textContent = 'نسبة الإكمال'; labels[2].textContent = 'مهام مفتوحة'; }
    }
    const activity = $('#dashboard .activity');
    if (activity) {
      const items = [
        ...state.tasks.slice(0, 2).map(task => ({ title: `مهمة: ${task.title}`, copy: statusLabel(task.status), icon: 'i-clock' })),
        ...state.leads.slice(0, 2).map(lead => ({ title: `عميل: ${lead.name}`, copy: lead.service, icon: 'i-users' }))
      ].slice(0, 3);
      activity.innerHTML = items.length ? items.map(item => `<div class="activity-item"><div class="activity-icon"><svg class="icon"><use href="#${item.icon}"/></svg></div><div class="activity-copy"><b>${safe(item.title)}</b><span>${safe(item.copy)}</span></div><span class="time">محفوظ</span></div>`).join('') : '<div class="empty-state"><b>لا يوجد نشاط بعد</b>ابدأ بإضافة موظف أو مهمة.</div>';
    }
    const latestBody = $('#dashboard .lead-table-wrap tbody');
    if (latestBody) {
      latestBody.innerHTML = state.leads.length ? state.leads.slice(0, 3).map(lead => `<tr><td><div class="person"><span class="person-avatar" style="background:#536ee5">${safe(lead.name.slice(0, 2))}</span><b>${safe(lead.name)}</b></div></td><td>${safe(lead.service)}</td><td>${safe(lead.source)}</td><td><span class="status new">${safe(statusLabel(lead.status))}</span></td><td>${formatDate(lead.updated_at)}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><b>لا يوجد عملاء بعد</b>أضف أول فرصة من صفحة العملاء المحتملين.</div></td></tr>';
    }
  }

  function renderReports() {
    const qualified = state.leads.filter(lead => ['qualified', 'won'].includes(lead.status)).length;
    const won = state.leads.filter(lead => lead.status === 'won').length;
    const completed = state.tasks.filter(task => task.status === 'completed').length;
    $('#reportMessages').textContent = state.messages.length.toLocaleString(currentLocale());
    $('#reportQualified').textContent = qualified.toLocaleString(currentLocale());
    $('#reportCompleted').textContent = completed.toLocaleString(currentLocale());
    $('#reportConversion').textContent = state.leads.length ? `${Math.round(won / state.leads.length * 100)}%` : '0%';
    const dayFormatter = new Intl.DateTimeFormat(currentLocale(), { weekday: 'short' });
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return date; });
    const counts = days.map(day => state.messages.filter(message => { const date = new Date(message.created_at); return date >= day && date < new Date(day.getTime() + 86400000); }).length);
    const maximum = Math.max(1, ...counts);
    $('#reportStats')?.setAttribute('data-source', 'workspace');
    $('#reportMessages').title = 'ai_messages'; $('#reportQualified').title = 'ai_leads'; $('#reportCompleted').title = 'ai_tasks';
    const chart = $('#reports .chart');
    if (chart) chart.innerHTML = days.map((day, index) => `<div class="bar" style="height:${counts[index] ? Math.max(4, Math.round(counts[index] / maximum * 100)) : 0}%" title="${counts[index]}"><span>${safe(dayFormatter.format(day))}</span></div>`).join('');
    $('#reportTotal').textContent = state.messages.length.toLocaleString(currentLocale());
    const sources = new Map(); state.messages.forEach(message => sources.set(message.channel || 'manual', (sources.get(message.channel || 'manual') || 0) + 1));
    const sourceEntries = [...sources.entries()]; const palette = ['var(--blue)', 'var(--mint)', 'var(--amber)', 'var(--indigo)', 'var(--red)']; let cursor = 0;
    const gradient = sourceEntries.map(([, count], index) => { const start = cursor; cursor += count / state.messages.length * 100; return `${palette[index % palette.length]} ${start}% ${cursor}%`; }).join(',');
    const sourceBox = $('#reports .donut-wrap');
    if (sourceBox) sourceBox.innerHTML = sources.size ? `<div class="donut" style="background:conic-gradient(${gradient})"><strong>${state.messages.length}</strong><small>${safe(t('nav.inbox', 'رسالة'))}</small></div><div class="tags" style="margin-top:22px;justify-content:center">${sourceEntries.map(([source, count]) => `<span class="tag">${safe(source)} ${Math.round(count / state.messages.length * 100)}%</span>`).join('')}</div>` : `<div class="empty-state"><b>${safe(t('reports.title', 'التقارير'))}</b>${safe(t('inbox.empty', 'لا توجد بيانات بعد.'))}</div>`;
    const performance = $('#reports .performance-card tbody');
    if (performance) performance.innerHTML = state.agents.length ? state.agents.map(agent => { const tasks = state.tasks.filter(task => task.agent_id === agent.id); const done = tasks.filter(task => task.status === 'completed').length; const pending = tasks.filter(task => task.status === 'awaiting_approval').length; return `<tr><td><div class="person"><span class="person-avatar" style="background:var(--blue)">${safe(agent.name.slice(0, 2))}</span><b>${safe(agent.name)}</b></div></td><td>${tasks.length}</td><td>${done}</td><td>${pending}</td><td>${tasks.length ? Math.round(done / tasks.length * 100) : 0}%</td></tr>`; }).join('') : `<tr><td colspan="5"><div class="empty-state"><b>${safe(t('agents.emptyTitle', 'لا يوجد موظفون بعد'))}</b></div></td></tr>`;
  }

  function renderNotifications() {
    const items = [
      ...state.approvals.filter(item => item.status === 'pending').map(item => ({ title: item.title, detail: t('status.pending', 'بانتظار الموافقة'), view: 'approvals' })),
      ...state.tasks.filter(item => item.status === 'failed').map(item => ({ title: item.title, detail: t('status.failed', 'فشلت'), view: 'tasks' })),
      ...state.integrations.filter(item => item.status === 'action_required').map(item => ({ title: providerNames[item.provider] || item.provider, detail: 'Action required', view: 'integrations' }))
    ];
    $('#approvalBadge').textContent = String(state.approvals.filter(item => item.status === 'pending').length);
    $('#notificationDot').hidden = !items.length;
    const list = $('#notificationList'); if (!list) return;
    list.innerHTML = items.length ? items.map((item, index) => `<button type="button" class="notification-item" data-index="${index}"><b>${safe(item.title)}</b><span>${safe(item.detail)}</span></button>`).join('') : `<div class="empty-state"><b>${safe(t('notifications.empty', 'لا توجد إشعارات تحتاج إجراء.'))}</b></div>`;
    $$('.notification-item', list).forEach(button => button.addEventListener('click', () => { const item = items[Number(button.dataset.index)]; $('#notificationsModal').classList.remove('open'); showView(item.view); }));
  }

  function searchableRecords() {
    return [
      ...state.agents.map(item => ({ view: 'agents', type: t('nav.agents', 'موظف'), title: item.name, detail: item.role })),
      ...state.tasks.map(item => ({ view: 'tasks', type: t('nav.tasks', 'مهمة'), title: item.title, detail: item.instructions || statusLabel(item.status) })),
      ...state.leads.map(item => ({ view: 'leads', type: t('nav.leads', 'عميل'), title: item.name, detail: item.service })),
      ...state.messages.map(item => ({ view: 'inbox', type: t('nav.inbox', 'رسالة'), title: item.contact_name, detail: item.body }))
    ];
  }

  function renderSearch(query = '') {
    const box = $('#globalSearchResults'); if (!box) return;
    const normalized = query.trim().toLocaleLowerCase();
    const results = normalized ? searchableRecords().filter(item => `${item.title} ${item.detail} ${item.type}`.toLocaleLowerCase().includes(normalized)).slice(0, 30) : [];
    box.innerHTML = results.length ? results.map((item, index) => `<button type="button" class="result-item" data-index="${index}"><b>${safe(item.title)}</b><span>${safe(item.type)} • ${safe(item.detail || '')}</span></button>`).join('') : `<div class="empty-state"><b>${safe(t('search.empty', 'لا توجد نتائج مطابقة.'))}</b></div>`;
    $$('.result-item', box).forEach(button => button.addEventListener('click', () => { const item = results[Number(button.dataset.index)]; $('#searchModal').classList.remove('open'); showView(item.view); }));
  }

  function commandStatus(message, stateName = 'success') { const result = $('#commandResult'); result.dataset.state = stateName; result.textContent = message; }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
    const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select();
    const copied = document.execCommand('copy'); field.remove(); if (!copied) throw new Error('تعذر الوصول إلى الحافظة');
  }

  async function pasteIntoCommand() {
    if (!navigator.clipboard?.readText) throw new Error('المتصفح لم يمنح إذن قراءة الحافظة');
    $('#commandInput').value = await navigator.clipboard.readText(); $('#commandInput').focus(); commandStatus(t('command.pasted', 'تم لصق النص فعلياً في حقل الأمر.'));
  }

  function commandTarget(target) {
    const normalized = String(target || '').toLocaleLowerCase();
    const pages = {
      dashboard: ['الرئيسية', 'dashboard', 'home', 'ڈیش بورڈ', 'داشبورد', '仪表板', '대시보드', 'dashboard', 'inicio', 'לוח בקרה', 'главная', 'ana sayfa', 'accueil'],
      agents: ['الموظفين', 'الموظفون', 'employees', 'agents', 'ملازمین', 'کارمندان', '员工', '직원', 'dipendenti', 'empleados', 'עובדים', 'сотрудники', 'çalışanlar', 'employés'],
      tasks: ['المهام', 'tasks', 'کام', 'وظایف', '任务', '작업', 'attività', 'tareas', 'משימות', 'задачи', 'görevler', 'tâches'],
      inbox: ['الرسائل', 'inbox', 'messages', 'پیغامات', 'پیام‌ها', '消息', '메시지', 'messaggi', 'mensajes', 'הודעות', 'сообщения', 'mesajlar'],
      leads: ['العملاء', 'leads', 'customers', 'گاہک', 'مشتریان', '客户', '고객', 'clienti', 'clientes', 'לקוחות', 'клиенты', 'müşteriler'],
      approvals: ['الموافقات', 'approvals', 'منظوریاں', 'تأییدها', '审批', '승인', 'approvazioni', 'aprobaciones', 'אישורים', 'согласования', 'onaylar'],
      knowledge: ['المعرفة', 'knowledge', 'علم', 'دانش', '知识', '지식', 'conoscenza', 'conocimiento', 'ידע', 'знания', 'bilgi'],
      reports: ['التقارير', 'reports', 'رپورٹس', 'گزارش‌ها', '报告', '보고서', 'report', 'informes', 'דוחות', 'отчеты', 'raporlar'],
      integrations: ['البوابات', 'الربط', 'integrations', 'connections', 'رابطے', 'اتصال‌ها', '连接', '연결', 'integrazioni', 'integraciones', 'חיבורים', 'интеграции', 'entegrasyonlar'],
      settings: ['الإعدادات', 'settings', 'ترتیبات', 'تنظیمات', '设置', '설정', 'impostazioni', 'configuración', 'הגדרות', 'настройки', 'ayarlar', 'paramètres']
    };
    return Object.entries(pages).find(([, aliases]) => aliases.some(alias => normalized.includes(alias)))?.[0] || '';
  }

  async function executeCommand(value) {
    const parsed = window.VarexCommandEngine.parse(value);
    commandStatus(t('common.loading', 'جارٍ التنفيذ…'), 'working');
    try {
      if (parsed.type === 'empty') throw new Error(t('command.unsupported', 'لم يُكتب أمر؛ لم يُنفّذ شيء.'));
      if (parsed.type === 'addAgent') {
        if (!parsed.name) throw new Error(t('command.missingAgent', 'اكتب اسم الموظف بعد الأمر.'));
        const [agent] = await rest('ai_agents', { method: 'POST', body: { organization_id: state.org.id, name: parsed.name, role: parsed.role || 'موظف ذكي', language: currentLocale(), channels: [], status: 'paused', requires_approval: true, objective: '', created_by: state.user.id } });
        state.agents.unshift(agent); renderAll(); await audit('command_agent_created', 'agent', agent.id, { command: parsed.raw }); commandStatus(`${t('command.success', 'تم تنفيذ الأمر بنجاح.')} ${agent.name}`); return;
      }
      if (parsed.type === 'addLead') {
        if (!parsed.name || !parsed.service) throw new Error(t('command.missingLead', 'اكتب اسم العميل والخدمة مفصولين بعلامة |.'));
        const [lead] = await rest('ai_leads', { method: 'POST', body: { organization_id: state.org.id, name: parsed.name, service: parsed.service, source: 'command', status: 'new', priority: 'medium', score: 50, next_action: 'جمع المتطلبات' } });
        state.leads.unshift(lead); renderAll(); await audit('command_lead_created', 'lead', lead.id, { command: parsed.raw }); commandStatus(`${t('command.success', 'تم تنفيذ الأمر بنجاح.')} ${lead.name}`); return;
      }
      if (parsed.type === 'print') { window.print(); commandStatus(t('command.printed', 'تم فتح نافذة الطباعة.')); await audit('command_print_opened', 'workspace', state.org.id); return; }
      if (parsed.type === 'copy') { if (!parsed.text) throw new Error(t('command.missingCopy', 'اكتب النص بعد كلمة انسخ.')); await copyText(parsed.text); commandStatus(t('command.copied', 'تم نسخ النص فعلياً.')); return; }
      if (parsed.type === 'paste') { await pasteIntoCommand(); return; }
      if (parsed.type === 'integrations') { showView('integrations'); await refreshIntegrationReadiness(); renderIntegrations(); commandStatus(t('command.gatewayChecked', 'تم تحديث حالة البوابات.')); return; }
      if (parsed.type === 'open') { const target = commandTarget(parsed.target); if (!target) throw new Error(t('command.unsupported', 'هذا الأمر غير مدعوم؛ لم يُنفّذ شيء.')); showView(target); commandStatus(t('command.success', 'تم تنفيذ الأمر بنجاح.')); return; }
      if (parsed.type === 'logout') { commandStatus(t('command.success', 'تم تنفيذ الأمر بنجاح.')); await logout(false); return; }
      throw new Error(t('command.unsupported', 'هذا الأمر غير مدعوم؛ لم يُنفّذ شيء.'));
    } catch (error) { commandStatus(error.message, 'error'); }
  }

  function renderAll() { renderAgents(); renderTasks(); renderLeads(); renderApprovals(); renderKnowledge(); renderInbox(); renderIntegrations(); renderBilling(); renderDashboard(); renderReports(); renderNotifications(); }

  async function loadWorkspace() {
    const memberships = await rest('ai_members', { query: `user_id=eq.${state.user.id}&select=organization_id,role&limit=1` });
    if (!memberships.length) { showOnboarding(); return false; }
    state.member = memberships[0];
    const orgs = await rest('ai_organizations', { query: `id=eq.${state.member.organization_id}&select=*&limit=1` });
    if (!orgs.length) throw new Error('تعذر العثور على مساحة العمل');
    state.org = orgs[0];
    const org = state.org.id;
    state.subscriptions = await rest('ai_subscriptions', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` });
    Object.assign(state, { agents: [], tasks: [], leads: [], approvals: [], integrations: [], messages: [], knowledge: [] });
    if (hasActiveSubscription()) {
      const [agents, tasks, leads, approvals, integrations, messages, knowledge] = await Promise.all([
        rest('ai_agents', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` }),
        rest('ai_tasks', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` }),
        rest('ai_leads', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` }),
        rest('ai_approvals', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` }),
        rest('ai_integrations', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` }),
        rest('ai_messages', { query: `organization_id=eq.${org}&select=*&order=created_at.asc` }),
        rest('ai_knowledge_items', { query: `organization_id=eq.${org}&select=*&order=created_at.desc` })
      ]);
      Object.assign(state, { agents, tasks, leads, approvals, integrations, messages, knowledge });
    }
    await enterApp();
    return true;
  }

  function prepareSettingsUI() {
    const inputs = $$('#settings input,#settings select');
    const ids = ['companyName', 'companyIndustry', 'companyTimezone', 'settingsLanguage', 'legalName', 'trn', 'taxRate', 'billingEmail'];
    ids.forEach((id, index) => { if (inputs[index]) inputs[index].id = id; });
    const toggles = $$('#settings .toggle');
    ['priceApprovalToggle', 'auditToggle', 'autoPublishToggle'].forEach((id, index) => { if (toggles[index]) { toggles[index].id = id; toggles[index].setAttribute('aria-pressed', String(toggles[index].classList.contains('on'))); } });
    const language = $('#settingsLanguage');
    if (language && i18n()) {
      language.dataset.localeSelect = '';
      language.replaceChildren(...i18n().locales.map(locale => { const option = document.createElement('option'); option.value = locale.code; option.textContent = locale.name; return option; }));
    }
    if (!$('#appearanceSettingsCard')) {
      const card = document.createElement('article'); card.className = 'card billing-panel'; card.id = 'appearanceSettingsCard';
      card.innerHTML = `<h3 data-i18n="settings.appearance">المظهر</h3><div class="setting-line"><div><b id="activeThemeName">${safe(themes[activeTheme].name)}</b><span data-i18n="theme.subtitle">يتغير التطبيق وترويسة بريد OTP معاً.</span></div><button class="btn btn-light" id="settingsThemeButton" type="button" data-i18n="top.appearance">المظهر</button></div>`;
      $('#settings .settings-stack')?.append(card); i18n()?.translate(card);
      $('#settingsThemeButton')?.addEventListener('click', () => { renderThemeCatalog(); $('#themeModal').classList.add('open'); });
    }
  }

  async function enterApp() {
    prepareSettingsUI();
    applyTheme(state.org.ui_theme || activeTheme, true);
    if (state.org.ui_language && i18n() && state.org.ui_language !== currentLocale()) await i18n().setLocale(state.org.ui_language);
    $('.workspace-pill span:last-child').textContent = `مساحة عمل ${state.org.name}`;
    $('.profile-text strong').textContent = isDeveloperAccount() ? 'حساب المطوّر' : state.user.user_metadata?.full_name || state.user.email.split('@')[0];
    $('.profile-text span').textContent = isDeveloperAccount() ? 'دخول مجاني دائم' : state.member?.role === 'owner' ? 'إدارة الحساب' : 'عضو الفريق';
    $('.avatar').textContent = ($('.profile-text strong').textContent || 'V').slice(0, 1);
    $('#companyName').value = state.org.name || '';
    $('#companyIndustry').value = state.org.industry || $('#companyIndustry').options[0]?.value || '';
    $('#companyTimezone').value = state.org.timezone === 'Asia/Dubai' ? 'دبي (GMT+4)' : state.org.timezone || 'دبي (GMT+4)';
    $('#settingsLanguage').value = state.org.ui_language || currentLocale();
    $('#legalName').value = state.org.legal_name || ''; $('#trn').value = state.org.trn || ''; $('#billingEmail').value = state.org.billing_email || '';
    $('#priceApprovalToggle').classList.toggle('on', Boolean(state.org.requires_price_approval));
    $('#auditToggle').classList.toggle('on', Boolean(state.org.audit_enabled));
    $('#autoPublishToggle').classList.toggle('on', Boolean(state.org.auto_publish));
    $('#vatToggle').classList.toggle('on', state.org.vat_enabled);
    $('#taxFields').classList.toggle('disabled', !state.org.vat_enabled);
    $('#activeThemeName').textContent = themes[activeTheme].name;
    applySubscriptionGate();
    renderAll();
    $('#authGate').classList.add('hidden');
    document.body.classList.remove('auth-pending');
    if (isDeveloperAccount()) {
      void refreshMetaAdminStatus();
      void loadDeveloperSubscriptions().catch(error => notify(error.message, true));
    }
    showView(subscriptionLocked() ? 'billing' : location.hash.slice(1) || 'dashboard', false);
    if (!subscriptionLocked()) {
      void refreshIntegrationReadiness().catch(() => {
        state.integrationReadiness = {};
        renderIntegrations();
      });
    }
    handleIntegrationCallback();
  }

  function showOnboarding() {
    $('#authStage').hidden = true;
    $('#onboardingForm').hidden = false;
    $('#onboardingCompany').value = state.user?.user_metadata?.business_name || '';
    $('#authGate').classList.remove('hidden');
    document.body.classList.add('auth-pending');
  }

  async function createWorkspace(event) {
    event.preventDefault();
    showError($('#onboardingError'), '');
    const name = $('#onboardingCompany').value.trim();
    if (name.length < 2) { showError($('#onboardingError'), 'اكتب اسم الشركة أو النشاط.'); return; }
    setLoading(true);
    try {
      const [org] = await rest('ai_organizations', { method: 'POST', body: { owner_id: state.user.id, name, industry: $('#onboardingIndustry').value, ui_language: currentLocale(), ui_theme: activeTheme } });
      state.org = org;
      const [member] = await rest('ai_members', { method: 'POST', body: { organization_id: org.id, user_id: state.user.id, role: 'owner' } });
      state.member = member;
      await audit('workspace_created', 'organization', org.id, { source: 'subscription_required' });
      $('#onboardingForm').hidden = true; $('#authStage').hidden = false;
      await loadWorkspace();
      notify(isDeveloperAccount() ? 'تم تجهيز حساب المطوّر' : 'تم إنشاء مساحة شركتك؛ اختر باقة لإرسال طلب التفعيل');
    } catch (error) { showError($('#onboardingError'), error.message); }
    finally { setLoading(false); }
  }

  let authMode = 'login';
  let pendingAuthEmail = '';
  const authPanels = ['authStage', 'otpForm', 'forgotForm', 'resetForm'];

  function showAuthPanel(id) {
    authPanels.forEach(panelId => { $(`#${panelId}`).hidden = panelId !== id; });
    showError($('#authError'), ''); showError($('#otpError'), ''); showError($('#forgotError'), ''); showError($('#resetError'), '');
  }

  function isStrongPassword(password) {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && (password.match(/\d/g) || []).length >= 6;
  }

  function passwordMessage() {
    return 'كلمة المرور لازم تحتوي على حرف إنجليزي كبير وحرف صغير و6 أرقام على الأقل.';
  }

  function setAuthMode(mode) {
    authMode = mode;
    $$('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === mode));
    $$('.signup-only').forEach(field => field.hidden = mode !== 'signup');
    $$('.login-only').forEach(field => field.hidden = mode !== 'login');
    $('#authSubmit').textContent = mode === 'signup' ? t('auth.signupButton', 'إنشاء الحساب واختيار باقة') : t('auth.loginButton', 'دخول إلى النظام');
    $('#authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('#authPasswordConfirm').required = mode === 'signup';
    if (mode !== 'signup') $('#authPasswordConfirm').value = '';
    showError($('#authError'), '');
  }

  async function submitAuth(event) {
    event.preventDefault();
    showError($('#authError'), '');
    const email = $('#authEmail').value.trim().toLowerCase();
    const password = $('#authPassword').value;
    setLoading(true);
    try {
      if (authMode === 'signup') {
        if (!isStrongPassword(password)) { showError($('#authError'), passwordMessage()); return; }
        if (password !== $('#authPasswordConfirm').value) { showError($('#authError'), 'تأكيد كلمة المرور غير مطابق.'); return; }
        const response = await authRequest('signup', { email, password, locale: currentLocale(), theme: activeTheme, data: { full_name: $('#authName').value.trim() } });
        pendingAuthEmail = response.email || email;
        $('#otpEmailLabel').textContent = pendingAuthEmail;
        $('#otpCode').value = '';
        showAuthPanel('otpForm');
        $('#otpCode').focus();
        notify('تم إرسال رمز التحقق إلى بريدك');
        return;
      } else {
        saveSession(await authRequest('login', { email, password }));
      }
      await loadWorkspace();
    } catch (error) { showError($('#authError'), error.message); }
    finally { setLoading(false); }
  }

  async function verifySignupOtp(event) {
    event.preventDefault();
    showError($('#otpError'), ''); setLoading(true);
    try {
      const session = await authRequest('verify-email', { email: pendingAuthEmail, code: $('#otpCode').value.trim() });
      saveSession(session);
      await loadWorkspace();
    } catch (error) { showError($('#otpError'), error.message); }
    finally { setLoading(false); }
  }

  function openForgotPassword() {
    $('#forgotEmail').value = $('#authEmail').value.trim();
    showAuthPanel('forgotForm');
    $('#forgotEmail').focus();
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    showError($('#forgotError'), ''); setLoading(true);
    try {
      pendingAuthEmail = $('#forgotEmail').value.trim().toLowerCase();
      const response = await authRequest('forgot-password', { email: pendingAuthEmail, locale: currentLocale(), theme: activeTheme });
      $('#resetEmailLabel').textContent = pendingAuthEmail;
      $('#resetCode').value = ''; $('#resetPassword').value = ''; $('#resetPasswordConfirm').value = '';
      showAuthPanel('resetForm');
      $('#resetCode').focus();
      notify(response.message || 'تم إرسال رمز الاستعادة إلى بريدك');
    } catch (error) { showError($('#forgotError'), error.message); }
    finally { setLoading(false); }
  }

  async function resetPassword(event) {
    event.preventDefault();
    showError($('#resetError'), ''); $('#resetSuccess').classList.remove('show'); setLoading(true);
    const password = $('#resetPassword').value;
    try {
      if (!isStrongPassword(password)) { showError($('#resetError'), passwordMessage()); return; }
      if (password !== $('#resetPasswordConfirm').value) { showError($('#resetError'), 'تأكيد كلمة المرور غير مطابق.'); return; }
      const response = await authRequest('reset-password', { email: pendingAuthEmail, code: $('#resetCode').value.trim(), password });
      showAuthPanel('authStage'); setAuthMode('login');
      $('#authEmail').value = pendingAuthEmail; $('#authPassword').value = '';
      notify(response.message || 'تم تغيير كلمة المرور بنجاح');
      $('#authPassword').focus();
    } catch (error) { showError($('#resetError'), error.message); }
    finally { setLoading(false); }
  }

  function togglePassword(button) {
    const input = $(`#${button.dataset.passwordToggle}`);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.setAttribute('aria-label', visible ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور');
    $('use', button).setAttribute('href', visible ? '#i-eye' : '#i-eye-off');
  }

  async function logout(ask = true) {
    if (ask && !confirm('تسجيل الخروج من النظام؟')) return;
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}` } });
    } catch (_) { /* Local logout still proceeds. */ }
    saveSession(null); location.reload();
  }

  function openAgentModal() {
    agentStep = 0; renderAgentStep(); $('#agentModal').classList.add('open'); $('#agentName').focus();
  }

  let agentStep = 0;
  function renderAgentStep() {
    const steps = $$('.form-step', $('#agentModal')); const dots = $$('.step-dot', $('#agentModal'));
    steps.forEach((item, index) => item.classList.toggle('active', index === agentStep));
    dots.forEach((item, index) => item.classList.toggle('active', index <= agentStep));
    $('#prevStep').style.visibility = agentStep ? 'visible' : 'hidden';
    $('#nextStep').textContent = agentStep === 2 ? 'حفظ الموظف' : 'التالي';
  }

  async function saveAgent() {
    const name = $('#agentName').value.trim();
    if (!name) { notify('اكتب اسم الموظف', true); agentStep = 0; renderAgentStep(); return; }
    const checked = $$('.choice input:checked', $('#agentModal')).map(input => input.parentElement.textContent.trim());
    const channels = checked.filter(item => ['WhatsApp', 'Instagram', 'Facebook', 'البريد الإلكتروني'].includes(item));
    const instructions = $('#agentModal textarea').value.trim();
    try {
      const [agent] = await rest('ai_agents', { method: 'POST', body: { organization_id: state.org.id, name, role: $('#agentRole').value, language: $('#agentLanguage').value, channels, status: 'paused', requires_approval: true, instructions, objective: checked.filter(item => !channels.includes(item)).join('، '), created_by: state.user.id } });
      state.agents.unshift(agent); $('#agentModal').classList.remove('open'); renderAll(); await audit('agent_created', 'agent', agent.id, { role: agent.role });
      notify('تم حفظ الموظف. يمكن تفعيله بعد ربط القنوات المطلوبة.');
    } catch (error) { notify(error.message, true); }
  }

  function refreshTaskAgentOptions() {
    const select = $('#taskAgent'); if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">بدون تعيين</option>' + state.agents.map(agent => `<option value="${agent.id}">${safe(agent.name)} — ${safe(agent.role)}</option>`).join('');
    select.value = selected;
  }

  async function saveTask(event) {
    event.preventDefault();
    try {
      const [task] = await rest('ai_tasks', { method: 'POST', body: { organization_id: state.org.id, agent_id: $('#taskAgent').value || null, title: $('#taskTitle').value.trim(), instructions: $('#taskInstructions').value.trim(), priority: $('#taskPriority').value, requires_approval: $('#taskApproval').checked, status: 'draft', created_by: state.user.id } });
      state.tasks.unshift(task); $('#taskModal').classList.remove('open'); event.currentTarget.reset(); renderAll(); await audit('task_created', 'task', task.id); notify('تم حفظ المهمة كمسودة');
    } catch (error) { notify(error.message, true); }
  }

  async function addLead() {
    const name = prompt('اسم العميل أو الشركة'); if (!name?.trim()) return;
    const service = prompt('الخدمة المطلوبة'); if (!service?.trim()) return;
    try {
      const [lead] = await rest('ai_leads', { method: 'POST', body: { organization_id: state.org.id, name: name.trim(), service: service.trim(), source: 'يدوي', status: 'new', priority: 'medium', score: 50, next_action: 'جمع المتطلبات' } });
      state.leads.unshift(lead); renderAll(); await audit('lead_created', 'lead', lead.id); notify('تمت إضافة العميل إلى قاعدة البيانات');
    } catch (error) { notify(error.message, true); }
  }

  async function requestIntegration(button) {
    const provider = button.closest('.integration')?.dataset.provider;
    if (!provider) return;
    if (provider === 'whatsapp' && isVarexAdmin()) {
      await syncExistingWhatsApp(button);
      return;
    }
    if (provider === 'whatsapp' && whatsappSignupInFlight) {
      notify('محاولة ربط WhatsApp مفتوحة الآن. أكملها أو أغلقها قبل إعادة المحاولة.');
      return;
    }
    if (pendingIntegration && integrationPopup && !integrationPopup.closed) {
      integrationPopup.focus();
      notify('نافذة ربط أخرى مفتوحة الآن. أكملها أو أغلقها أولاً.');
      return;
    }
    if (state.integrationReadiness?.[provider]?.configured === false) {
      notify('بوابة هذه القناة تحتاج إكمال الإعداد من إدارة VAREX أولاً', true);
      return;
    }
    const previousLabel = button.textContent;
    if (provider === 'whatsapp') {
      if (!whatsappSignupIsReady()) {
        button.disabled = true;
        button.textContent = 'جارٍ تجهيز ميتا...';
        whatsappSignupPreparationError = '';
        try {
          await prepareWhatsAppSignup();
          button.disabled = false;
          button.textContent = integrationButtonLabel(whatsappIntegrationRecord());
          notify('تم تجهيز نافذة ميتا. اضغط زر الربط الآن.');
        } catch (error) {
          button.disabled = false;
          button.textContent = 'إعادة تجهيز الربط';
          notify(error.message, true);
        }
        return;
      }

      button.disabled = true;
      button.textContent = 'جارٍ فتح Meta...';
      try {
        launchWhatsAppSignup(whatsappSignupContext, button, previousLabel);
        void audit('integration_oauth_started', 'integration', null, { provider: 'whatsapp' });
      } catch (error) {
        button.disabled = false;
        button.textContent = previousLabel;
        notify(error.message, true);
      }
      return;
    }

    integrationResultHandled = false;
    const popupWidth = Math.min(560, Math.max(380, window.screen.availWidth - 32));
    const popupHeight = Math.min(760, Math.max(600, window.screen.availHeight - 80));
    const popupLeft = Math.max(0, Math.round((window.screen.availWidth - popupWidth) / 2));
    const popupTop = Math.max(0, Math.round((window.screen.availHeight - popupHeight) / 2));
    const popup = window.open('', `varex-${provider}-connection`, `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop},resizable=yes,scrollbars=yes`);
    if (!popup) {
      notify('اسمح بالنوافذ المنبثقة لـ VAREX ثم أعد المحاولة.', true);
      return;
    }
    integrationPopup = popup;
    pendingIntegration = { provider, button, previousLabel };
    try {
      popup.document.documentElement.dir = 'rtl';
      popup.document.title = 'VAREX AI — تجهيز الربط';
      popup.document.body.style.cssText = 'font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f5f7ff;color:#14204a;text-align:center';
      popup.document.body.textContent = 'جارٍ تجهيز نافذة الربط الآمنة…';
    } catch (_) { /* The provider will replace this temporary same-origin page. */ }
    popup.focus();
    button.disabled = true;
    button.textContent = 'أكمل في نافذة الربط';
    showIntegrationModal(provider);
    try {
      if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
      const params = new URLSearchParams({ provider, organization_id: state.org.id });
      let response = await fetch(`${API_URL}/integrations/start?${params}`, { headers: { Authorization: `Bearer ${state.session.access_token}` } });
      if (response.status === 401) { await refreshSession(); response = await fetch(`${API_URL}/integrations/start?${params}`, { headers: { Authorization: `Bearer ${state.session.access_token}` } }); }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر بدء ربط الحساب');
      await audit('integration_oauth_started', 'integration', null, { provider });
      popup.location.replace(data.authorization_url);
      integrationPopupTimer = setInterval(() => {
        if (!popup.closed || integrationResultHandled) return;
        clearIntegrationPopup();
        button.disabled = false;
        button.textContent = previousLabel;
        notify('أُغلقت نافذة الربط قبل اكتمال العملية.', true);
      }, 500);
    } catch (error) {
      clearIntegrationPopup(true);
      button.disabled = false; button.textContent = previousLabel; notify(error.message, true);
    }
  }

  function handleIntegrationCallback() {
    const params = new URLSearchParams(location.search), result = params.get('integration'), provider = params.get('provider');
    if (!result) return;
    showIntegrationResult(result, provider);
    history.replaceState(null, '', `${location.pathname}#integrations`);
  }

  function conversationKey(message) { return `${String(message.channel || 'manual').toLowerCase()}:${message.contact_address || message.contact_name}`; }

  function conversations() {
    const grouped = new Map();
    state.messages.forEach(message => {
      const key = conversationKey(message);
      if (!grouped.has(key)) grouped.set(key, { key, name: message.contact_name || message.contact_address || 'عميل', address: message.contact_address || '', channel: String(message.channel || 'manual').toLowerCase(), messages: [] });
      grouped.get(key).messages.push(message);
    });
    return [...grouped.values()].sort((a, b) => new Date(b.messages.at(-1)?.created_at || 0) - new Date(a.messages.at(-1)?.created_at || 0));
  }

  function renderInbox() {
    const list = $('#chatItems'); if (!list) return;
    const items = conversations();
    if (!items.some(item => item.key === selectedConversationKey)) selectedConversationKey = items[0]?.key || '';
    list.replaceChildren();
    if (!items.length) list.innerHTML = `<div class="inbox-empty">${safe(t('inbox.empty', 'لا توجد رسائل حقيقية بعد.'))}</div>`;
    items.forEach(item => {
      const last = item.messages.at(-1); const button = document.createElement('button');
      button.type = 'button'; button.className = `chat-item ${item.key === selectedConversationKey ? 'active' : ''}`; button.dataset.key = item.key; button.dataset.name = item.name;
      button.innerHTML = `<span class="person-avatar" style="background:#536ee5">${safe(item.name.slice(0, 2))}</span><span class="chat-preview"><b>${safe(item.name)}</b><p>${safe(last?.body || '')}</p></span><span class="chat-meta">${safe(formatDate(last?.created_at))}</span>`;
      button.addEventListener('click', () => { selectedConversationKey = item.key; renderInbox(); });
      list.append(button);
    });
    renderSelectedConversation(items.find(item => item.key === selectedConversationKey));
    $('#inboxBadge').textContent = String(state.messages.filter(message => message.direction === 'inbound').length);
  }

  function renderSelectedConversation(conversation) {
    const head = $('#conversationHead'), messages = $('#messages'), input = $('#messageInput'), submit = $('#composer button');
    if (!conversation) {
      head.hidden = true; input.disabled = true; submit.disabled = true;
      messages.innerHTML = `<div class="inbox-empty">${safe(t('inbox.empty', 'لا توجد رسائل حقيقية بعد.'))}</div>`;
      return;
    }
    head.hidden = false; input.disabled = false; submit.disabled = false;
    $('.person-avatar', head).textContent = conversation.name.slice(0, 2); $('b', head).textContent = conversation.name;
    $('.conversation-address', head).textContent = conversation.address || ''; $('.channel', head).textContent = conversation.channel;
    messages.replaceChildren();
    conversation.messages.forEach(message => {
      const bubble = document.createElement('div'); bubble.className = `bubble ${message.direction === 'inbound' ? 'in' : 'out'}`;
      bubble.innerHTML = `${safe(message.body)}<small>${safe(formatDate(message.created_at))} • ${safe(statusLabel(message.send_status))}</small>`; messages.append(bubble);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  async function saveDraftMessage(event) {
    event.preventDefault();
    const input = $('#messageInput'); const body = input.value.trim(); if (!body) return;
    const conversation = conversations().find(item => item.key === selectedConversationKey);
    if (!conversation) { notify(t('inbox.empty', 'لا توجد محادثة محددة.'), true); return; }
    const whatsappConnected = conversation.channel === 'whatsapp' && conversation.address && state.integrations.some(item => item.provider === 'whatsapp' && item.status === 'connected');
    try {
      let message;
      if (whatsappConnected) {
        let response = await fetch(`${API_URL}/integrations/whatsapp/send`, { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' }, body: json({ organization_id: state.org.id, to: conversation.address, contact_name: conversation.name, body }) });
        if (response.status === 401) { await refreshSession(); response = await fetch(`${API_URL}/integrations/whatsapp/send`, { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' }, body: json({ organization_id: state.org.id, to: conversation.address, contact_name: conversation.name, body }) }); }
        const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || 'تعذر إرسال رسالة WhatsApp');
        message = { id: `wa:${result.message_id}`, organization_id: state.org.id, contact_name: conversation.name, contact_address: conversation.address, channel: 'whatsapp', direction: 'outbound', body, send_status: 'sent', created_by: state.user.id, created_at: new Date().toISOString() };
        notify(t('inbox.sent', 'تم إرسال الرسالة عبر WhatsApp Business.'));
        await audit('whatsapp_message_sent', 'message', message.id, { contact_address: conversation.address });
      } else {
        [message] = await rest('ai_messages', { method: 'POST', body: { organization_id: state.org.id, contact_name: conversation.name, contact_address: conversation.address || null, channel: conversation.channel, direction: 'outbound', body, send_status: 'draft', created_by: state.user.id } });
        notify(t('inbox.draftSaved', 'حُفظت الرسالة كمسودة ولم تُرسل.'));
        await audit('message_draft_saved', 'message', message.id, { channel: conversation.channel, reason: conversation.address ? 'provider_not_connected' : 'missing_recipient_address' });
      }
      if (!state.messages.some(item => item.id === message.id)) state.messages.push(message);
      input.value = ''; renderInbox(); renderDashboard(); renderReports();
    } catch (error) { notify(error.message, true); }
  }

  async function saveKnowledge(event) {
    const file = event.target.files[0]; if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.type)) { notify('نوع الملف غير مدعوم؛ استخدم PDF أو DOCX أو XLSX', true); event.target.value = ''; return; }
    if (file.size > 10 * 1024 * 1024) { notify('حجم الملف أكبر من 10 MB', true); event.target.value = ''; return; }
    try {
      const form = new FormData(); form.set('organization_id', state.org.id); form.set('file', file);
      let response = await fetch(`${API_URL}/knowledge/upload`, { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}` }, body: form });
      if (response.status === 401) { await refreshSession(); response = await fetch(`${API_URL}/knowledge/upload`, { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}` }, body: form }); }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'تعذر رفع الملف');
      const item = result[0]; state.knowledge.unshift(item); renderKnowledge(); await audit('knowledge_file_uploaded', 'knowledge_item', item.id, { size: file.size, type: file.type }); notify(t('knowledge.stored', 'تم رفع الملف وحفظ محتواه.'));
    } catch (error) { notify(error.message, true); }
    event.target.value = '';
  }

  const planCards = $$('.plan-card');
  function planCardName(card) { return $('h3', card)?.textContent.trim() || ''; }
  function selectPlanCard(card) { planCards.forEach(item => { const selected = item === card; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); }); }
  function selectPlanByName(name) { const card = planCards.find(item => planCardName(item) === name); if (card) selectPlanCard(card); }
  function openBilling(planName) {
    if (isDeveloperAccount()) { notify('حساب المطوّر مفتوح مجاناً ولا يحتاج إلى اشتراك'); return; }
    const requestedCode = planNameToCode[planName] || currentSubscription().plan_code;
    const code = customerPlanCodes.has(requestedCode) ? requestedCode : 'team3';
    const plan = plans[code];
    $('#selectedPlan').value = `${plan.name} — ${plan.price}`; $('#billingModal').classList.add('open'); $('#selectedPlan').focus(); selectPlanByName(plan.name);
  }

  async function saveSubscription() {
    if (isDeveloperAccount()) { notify('حساب المطوّر لا يحتاج إلى دفع'); return; }
    const name = Object.keys(planNameToCode).find(item => $('#selectedPlan').value.startsWith(item));
    const requestedCode = planNameToCode[name];
    const code = customerPlanCodes.has(requestedCode) ? requestedCode : 'team3'; const plan = plans[code]; const payment = $('#paymentMethod').value;
    try {
      const [subscription] = await rest('ai_subscriptions', { method: 'POST', body: { organization_id: state.org.id, plan_code: code, status: 'pending_payment', agent_limit: plan.agents, monthly_task_limit: plan.tasks, billing_cycle: plan.cycle, payment_method: payment } });
      state.subscriptions = await rest('ai_subscriptions', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      $('#billingModal').classList.remove('open'); applySubscriptionGate(); renderBilling(); await audit('subscription_selected', 'subscription', subscription.id, { plan_code: code, payment_method: payment });
      notify('تم إرسال طلب الاشتراك؛ يبقى النظام مقفولاً حتى تأكيد استلام الدفع');
    } catch (error) { notify(error.message, true); }
  }

  async function saveSettings() {
    const update = {
      name: $('#companyName').value.trim(), industry: $('#companyIndustry').value, timezone: 'Asia/Dubai',
      ui_language: $('#settingsLanguage').value, ui_theme: activeTheme,
      requires_price_approval: $('#priceApprovalToggle').classList.contains('on'), audit_enabled: $('#auditToggle').classList.contains('on'), auto_publish: $('#autoPublishToggle').classList.contains('on'),
      vat_enabled: $('#vatToggle').classList.contains('on'), legal_name: $('#legalName').value.trim() || null, trn: $('#trn').value.trim() || null, billing_email: $('#billingEmail').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    try {
      const [org] = await rest('ai_organizations', { method: 'PATCH', query: `id=eq.${state.org.id}`, body: update }); state.org = org; $('.workspace-pill span:last-child').textContent = `مساحة عمل ${org.name}`;
      if (currentLocale() !== org.ui_language) await i18n().setLocale(org.ui_language);
      await audit('settings_updated', 'organization', org.id, { ui_language: org.ui_language, ui_theme: org.ui_theme, security_rules: { requires_price_approval: org.requires_price_approval, audit_enabled: org.audit_enabled, auto_publish: org.auto_publish } }); renderAll(); notify(t('settings.saved', 'تم حفظ إعدادات الشركة.'));
    } catch (error) { notify(error.message, true); }
  }

  function bindUI() {
    $$('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
    $$('[data-view-jump]').forEach(button => button.addEventListener('click', () => showView(button.dataset.viewJump)));
    $('#menuBtn').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); });
    $('#overlay').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); });
    $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab)));
    $('#authForm').addEventListener('submit', submitAuth); $('#onboardingForm').addEventListener('submit', createWorkspace);
    $('#otpForm').addEventListener('submit', verifySignupOtp); $('#forgotForm').addEventListener('submit', requestPasswordReset); $('#resetForm').addEventListener('submit', resetPassword);
    $('#forgotPassword').addEventListener('click', openForgotPassword);
    $('#backFromOtp').addEventListener('click', () => showAuthPanel('authStage'));
    $('#backFromForgot').addEventListener('click', () => showAuthPanel('authStage'));
    $('#backFromReset').addEventListener('click', () => showAuthPanel('authStage'));
    $$('[data-password-toggle]').forEach(button => button.addEventListener('click', () => togglePassword(button)));
    $('.profile').addEventListener('click', () => logout(true));
    $$('.open-agent').forEach(button => button.addEventListener('click', openAgentModal));
    $('#closeModal').addEventListener('click', () => $('#agentModal').classList.remove('open'));
    $('#prevStep').addEventListener('click', () => { if (agentStep > 0) { agentStep -= 1; renderAgentStep(); } });
    $('#nextStep').addEventListener('click', () => { if (agentStep < 2) { agentStep += 1; renderAgentStep(); } else saveAgent(); });
    $('#openTask').addEventListener('click', () => { refreshTaskAgentOptions(); $('#taskModal').classList.add('open'); $('#taskTitle').focus(); });
    $('#closeTaskModal').addEventListener('click', () => $('#taskModal').classList.remove('open')); $('#cancelTask').addEventListener('click', () => $('#taskModal').classList.remove('open')); $('#taskForm').addEventListener('submit', saveTask);
    $('[data-action="add-lead"]').addEventListener('click', addLead);
    $$('.connect').forEach(button => button.addEventListener('click', () => requestIntegration(button)));
    $('#composer').addEventListener('submit', saveDraftMessage);
    $('#uploadBtn').addEventListener('click', () => $('#fileInput').click()); $('#fileInput').addEventListener('change', saveKnowledge);
    planCards.forEach(card => { card.tabIndex = 0; card.setAttribute('role', 'button'); card.addEventListener('click', () => selectPlanCard(card)); });
    $$('.choose-plan').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openBilling(button.dataset.plan); }));
    $('#addPayment').addEventListener('click', () => openBilling()); $('#confirmBilling').addEventListener('click', saveSubscription);
    $('#closeBillingModal').addEventListener('click', () => $('#billingModal').classList.remove('open')); $('#cancelBilling').addEventListener('click', () => $('#billingModal').classList.remove('open'));
    $('#hideIntegrationModal')?.addEventListener('click', cancelIntegrationModal);
    $$('#settings .toggle').filter(toggle => toggle.id !== 'vatToggle').forEach(toggle => toggle.addEventListener('click', () => { toggle.classList.toggle('on'); toggle.setAttribute('aria-pressed', String(toggle.classList.contains('on'))); }));
    $('#vatToggle').addEventListener('click', () => { $('#vatToggle').classList.toggle('on'); $('#vatToggle').setAttribute('aria-pressed', String($('#vatToggle').classList.contains('on'))); $('#taxFields').classList.toggle('disabled', !$('#vatToggle').classList.contains('on')); });
    $('[data-action="save-settings"]').addEventListener('click', saveSettings);
    $('#saveMetaSecret')?.addEventListener('click', saveMetaSecret);
    $('#chatSearch').addEventListener('input', event => { const query = event.target.value.trim().toLocaleLowerCase(); $$('.chat-item').forEach(item => item.style.display = item.dataset.name.toLocaleLowerCase().includes(query) ? 'grid' : 'none'); });
    $('#leadSearch').addEventListener('input', event => $$('#leadsTable tbody tr').forEach(row => row.style.display = row.textContent.includes(event.target.value.trim()) ? 'table-row' : 'none'));
    $('#leads .select').addEventListener('change', event => { const wanted = event.target.value; $$('#leadsTable tbody tr').forEach(row => row.style.display = wanted === 'كل الحالات' || row.textContent.includes(wanted) ? 'table-row' : 'none'); });
    $('#approvals .select').addEventListener('change', event => { const wanted = ({ 'بانتظار الموافقة': 'pending', 'تمت الموافقة': 'approved', 'مرفوض': 'rejected' })[event.target.value]; $$('#approvals .approval-card').forEach(card => card.style.display = card.dataset.state === wanted ? 'block' : 'none'); });
    $('[data-action="search"]').addEventListener('click', () => { $('#searchModal').classList.add('open'); $('#globalSearchInput').value = ''; renderSearch(''); setTimeout(() => $('#globalSearchInput').focus(), 0); });
    $('[data-action="notifications"]').addEventListener('click', () => { renderNotifications(); $('#notificationsModal').classList.add('open'); });
    $$('[data-action="help"]').forEach(button => button.addEventListener('click', () => notify('كل قناة تُربط من نافذة المزود الرسمية وتعرض حالة الربط الفعلية')));
    $$('[data-action="billing-help"]').forEach(button => button.addEventListener('click', () => notify('اختر باقة وPayPal أو التحويل البنكي؛ يفتح حساب المطوّر النظام بعد تأكيد وصول الدفعة')));
    $('#commandForm').addEventListener('submit', event => { event.preventDefault(); void executeCommand($('#commandInput').value); });
    $('#pasteCommand').addEventListener('click', () => { void pasteIntoCommand().catch(error => commandStatus(error.message, 'error')); });
    $$('.command-chip').forEach(button => button.addEventListener('click', () => { const examples = commandExamples[currentLocale()] || commandExamples.ar; $('#commandInput').value = examples[button.dataset.commandExample] || ''; $('#commandInput').focus(); }));
    $('#themeButton').addEventListener('click', () => { renderThemeCatalog(); $('#themeModal').classList.add('open'); });
    $('#authThemeButton').addEventListener('click', () => { renderThemeCatalog(); $('#themeModal').classList.add('open'); });
    $('#closeThemeModal').addEventListener('click', () => $('#themeModal').classList.remove('open'));
    $('#closeSearchModal').addEventListener('click', () => $('#searchModal').classList.remove('open'));
    $('#closeNotificationsModal').addEventListener('click', () => $('#notificationsModal').classList.remove('open'));
    $('#globalSearchInput').addEventListener('input', event => renderSearch(event.target.value));
    document.addEventListener('change', event => {
      if (!event.target.matches('[data-locale-select]')) return;
      void i18n().setLocale(event.target.value).then(() => { setAuthMode(authMode); renderAll(); showView(location.hash.slice(1) || 'dashboard', false); }).catch(() => notify('تعذر تحميل اللغة', true));
    });
    $$('.modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal && modal.id !== 'integrationModal') modal.classList.remove('open'); }));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      cancelIntegrationModal();
      $$('.modal').filter(modal => modal.id !== 'integrationModal').forEach(modal => modal.classList.remove('open'));
    });
    $('#downloadInvoice')?.addEventListener('click', downloadSubscriptionSummary);
  }

  async function boot() {
    await i18n()?.ready;
    const agentLanguage = $('#agentLanguage');
    if (agentLanguage && i18n()) agentLanguage.replaceChildren(...i18n().locales.map(locale => { const option = document.createElement('option'); option.value = locale.code; option.textContent = locale.name; return option; }));
    applyTheme(activeTheme, false); renderThemeCatalog(); bindUI(); setAuthMode('login');
    try { state.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); state.user = state.session?.user || null; } catch (_) { saveSession(null); }
    if (!state.session) return;
    setLoading(true);
    try { await loadWorkspace(); }
    catch (error) { saveSession(null); showError($('#authError'), `انتهت الجلسة أو تعذر تحميل الحساب: ${error.message}`); }
    finally { setLoading(false); }
  }

  boot();
})();
