(() => {
  'use strict';

  const API_URL = '/api';
  const SESSION_KEY = 'varex-ai-private-session-v2';
  const SESSION_HANDOFF_KEY = 'varex-ai-paypal-handoff-v1';
  const DEVELOPER_EMAIL = 'areejalloush1988@gmail.com';
  const PREVIEW_MODE = new URLSearchParams(location.search).get('preview') === '1';
  const state = { session: null, user: null, org: null, member: null, agents: [], tasks: [], leads: [], approvals: [], integrations: [], integrationReadiness: null, messages: [], knowledge: [], subscriptions: [], adminSubscriptions: [], activationCodes: [], paypalStatus: null, permissionCatalog: {}, agentPermissions: [], deviceConnections: [], voiceSettings: null, voiceReadiness: null, voiceCalls: [], voiceGatewayStatus: null, voiceValidationCode: '', actionExecutions: [], selectedPermissionAgentId: '', permissionDirty: false, employeeChatMessages: [], employeeChatAgentId: '', employeeChatThinking: false, employeeChatVoiceId: 'Sulafat', employeeChatVoiceEnabled: true, employeeChatInputMode: 'text', employeeChatAudio: null, employeeChatRecognition: null };
  const plans = {
    developer: { name: 'المالك', price: 'مجاني دائم', agents: null, tasks: 120000, cycle: 'developer' },
    gift: { name: 'تفعيل مجاني خاص', price: 'مجاني دائم', agents: null, tasks: 120000, cycle: 'gift' },
    pending: { name: 'الاشتراك مطلوب', price: 'اختر باقة مدفوعة', agents: 0, tasks: 1, cycle: 'pending' },
    solo: { name: 'موظف واحد', price: '899 درهم شهرياً', paypalUsd: '244.79', agents: 1, tasks: 3000, cycle: 'monthly' },
    team3: { name: '3 موظفين', price: '1,699 درهم شهرياً', paypalUsd: '462.63', agents: 3, tasks: 10000, cycle: 'monthly' },
    team5: { name: '5 موظفين', price: '2,699 درهم شهرياً', paypalUsd: '734.92', agents: 5, tasks: 25000, cycle: 'monthly' },
    team10: { name: '10 موظفين', price: '4,499 درهم شهرياً', paypalUsd: '1225.05', agents: 10, tasks: 60000, cycle: 'monthly' },
    unlimited: { name: 'غير محدود', price: 'من 6,999 درهم شهرياً', paypalUsd: '1905.79', agents: null, tasks: 120000, cycle: 'monthly' }
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
  const providerNames = { whatsapp: 'WhatsApp Business', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', email: 'البريد الإلكتروني', youtube: 'YouTube' };
  const employeeVoiceCatalog = [
    { id: 'Sulafat', name: 'ليان', style: 'دافئ وطبيعي', icon: '🌷' },
    { id: 'Achird', name: 'آدم', style: 'ودود وهادئ', icon: '🎙️' },
    { id: 'Achernar', name: 'نور', style: 'هادئ ومتزن', icon: '✨' },
    { id: 'Kore', name: 'سارة', style: 'واضح واحترافي', icon: '💼' },
    { id: 'Aoede', name: 'ريم', style: 'لطيف وحيوي', icon: '🌼' },
    { id: 'Orus', name: 'عمر', style: 'عميق وواثق', icon: '🎧' },
    { id: 'Puck', name: 'كريم', style: 'نشيط وسريع', icon: '⚡' },
    { id: 'Alnilam', name: 'سامر', style: 'واضح ومتزن', icon: '🔷' }
  ];
  const permissionCatalogFallback = {
    email: { label: 'البريد الإلكتروني', icon: '✉️', description: 'قراءة البريد وإنشاء المسودات وإرسالها وإدارتها', connectionType: 'cloud', actions: {
      read: { label: 'قراءة الرسائل', risk: 'sensitive' }, create_draft: { label: 'إنشاء مسودة', risk: 'standard' }, edit_draft: { label: 'تعديل مسودة', risk: 'standard' }, send: { label: 'إرسال رسالة', risk: 'critical' }, reply: { label: 'الرد على رسالة', risk: 'sensitive' }, forward: { label: 'إعادة توجيه رسالة', risk: 'sensitive' }, download_attachments: { label: 'تنزيل المرفقات', risk: 'sensitive' }, trash: { label: 'نقل إلى المهملات', risk: 'sensitive' }, delete_permanent: { label: 'الحذف النهائي', risk: 'critical' }
    } },
    contacts: { label: 'جهات الاتصال', icon: '👥', description: 'البحث عن الأسماء والأرقام وإضافتها أو تعديلها', connectionType: 'native', actions: {
      view: { label: 'عرض جهات الاتصال', risk: 'sensitive' }, search: { label: 'البحث عن اسم أو رقم', risk: 'sensitive' }, create: { label: 'إضافة جهة اتصال', risk: 'sensitive' }, edit: { label: 'تعديل جهة اتصال', risk: 'sensitive' }, delete: { label: 'حذف جهة اتصال', risk: 'critical' }
    } },
    calendar: { label: 'التقويم', icon: '📅', description: 'عرض المواعيد وإنشاؤها وتعديلها أو إلغاؤها', connectionType: 'native', actions: {
      view: { label: 'عرض المواعيد', risk: 'sensitive' }, create: { label: 'إنشاء موعد', risk: 'sensitive' }, edit: { label: 'تعديل موعد', risk: 'sensitive' }, cancel: { label: 'إلغاء موعد', risk: 'critical' }, delete: { label: 'حذف موعد', risk: 'critical' }
    } },
    alarms: { label: 'المنبّه والتذكيرات', icon: '⏰', description: 'إنشاء التنبيهات وتشغيلها أو تعديلها أو حذفها', connectionType: 'native', actions: {
      create: { label: 'إنشاء منبّه', risk: 'standard' }, edit: { label: 'تعديل منبّه', risk: 'sensitive' }, enable: { label: 'تشغيل منبّه', risk: 'standard' }, disable: { label: 'إيقاف منبّه', risk: 'sensitive' }, delete: { label: 'حذف منبّه', risk: 'critical' }
    } },
    phone: { label: 'الهاتف', icon: '📞', description: 'البحث عن الأرقام وبدء الاتصال وإعادته أو تحويله', connectionType: 'native', actions: {
      lookup: { label: 'البحث عن رقم', risk: 'sensitive' }, start_call: { label: 'بدء اتصال', risk: 'critical' }, redial: { label: 'إعادة الاتصال', risk: 'critical' }, transfer: { label: 'تحويل المكالمة للمالك', risk: 'critical' }
    } },
    voice: { label: 'المكالمات الهاتفية', icon: '📞', description: 'إجراء مكالمات خارجية وتفريغها وتلخيصها بعد ربط رقم اتصال', connectionType: 'provider', actions: {
      speak_on_behalf: { label: 'التحدث نيابة عن المالك', risk: 'critical' }, transcribe: { label: 'تفريغ المكالمة نصياً', risk: 'sensitive' }, record: { label: 'تسجيل المكالمة', risk: 'critical' }, summarize: { label: 'تلخيص المكالمة', risk: 'standard' }, transfer: { label: 'تحويل المكالمة للمالك', risk: 'critical' }
    } },
    whatsapp: { label: 'WhatsApp Business', icon: '💬', description: 'قراءة المحادثات وتجهيز الرسائل وإرسالها ومتابعتها', connectionType: 'cloud', actions: {
      read: { label: 'قراءة المحادثات المتاحة', risk: 'sensitive' }, draft: { label: 'تجهيز رسالة', risk: 'standard' }, send: { label: 'إرسال رسالة', risk: 'critical' }, reply: { label: 'الرد على رسالة', risk: 'critical' }, follow_up: { label: 'متابعة المحادثة', risk: 'critical' }
    } },
    facebook: { label: 'Facebook', icon: '📘', description: 'عرض منشورات الصفحة المرتبطة ونشر محتوى جديد', connectionType: 'cloud', actions: {
      list_posts: { label: 'عرض منشورات الصفحة', risk: 'sensitive' }, publish: { label: 'نشر على الصفحة', risk: 'critical' }
    } },
    instagram: { label: 'Instagram', icon: '📸', description: 'نشر الصور وقراءة التعليقات والرد عليها في الحساب المهني', connectionType: 'cloud', actions: {
      publish: { label: 'نشر صورة', risk: 'critical' }, read_comments: { label: 'قراءة التعليقات', risk: 'sensitive' }, reply_comment: { label: 'الرد على تعليق', risk: 'critical' }
    } },
    tiktok: { label: 'TikTok', icon: '🎵', description: 'إرسال فيديو للنشر بعد منح صلاحية النشر للحساب', connectionType: 'cloud', actions: {
      publish_video: { label: 'نشر فيديو', risk: 'critical' }
    } },
    youtube: { label: 'YouTube', icon: '▶️', description: 'البحث ورفع الفيديوهات وتعديلها وإدارتها', connectionType: 'cloud', actions: {
      search: { label: 'البحث عن فيديو', risk: 'standard' }, upload: { label: 'رفع فيديو', risk: 'critical' }, edit: { label: 'تعديل بيانات فيديو', risk: 'sensitive' }, manage: { label: 'إدارة القناة والقوائم', risk: 'sensitive' }, delete: { label: 'حذف فيديو', risk: 'critical' }
    } },
    settings: { label: 'إعدادات الهاتف', icon: '⚙️', description: 'عرض الإعدادات وفتح ما يسمح به نظام الجهاز', connectionType: 'native', actions: {
      view: { label: 'عرض حالة الإعدادات', risk: 'sensitive' }, open: { label: 'فتح صفحة إعداد', risk: 'standard' }, change: { label: 'تغيير إعداد مسموح', risk: 'critical' }
    } },
    parking: { label: 'المواقف والباركينج', icon: '🅿️', description: 'عرض الموقف وبدء الجلسة أو تمديدها والدفع', connectionType: 'provider', actions: {
      view: { label: 'عرض حالة الموقف', risk: 'sensitive' }, start_session: { label: 'بدء جلسة موقف', risk: 'critical' }, extend: { label: 'تمديد جلسة موقف', risk: 'critical' }, pay: { label: 'دفع رسوم موقف', risk: 'critical' }
    } }
  };
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
    ar: { whatsapp: 'أرسل واتساب إلى +971500000000: مرحباً، كيف يمكنني مساعدتك؟', agent: 'أضف موظف: Lina | موظف مبيعات', print: 'طباعة', copy: 'انسخ: VAREX AI', integrations: 'افحص البوابات' },
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
    if (network) network.className = `network ${({ whatsapp: 'wa', instagram: 'ig', facebook: 'fb', tiktok: 'tt', email: 'gm', youtube: 'yt' })[provider] || ''} integration-auth-logo`;
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
    else if (result === 'action_required') notify(provider === 'youtube' ? 'تم ربط حساب Google، لكن لا توجد قناة YouTube على الحساب المحدد.' : `تم تسجيل الدخول إلى ${name}، لكن يلزم اختيار حساب صالح`, true);
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
      if (state.selectedPermissionAgentId) await loadPermissionCenter(state.selectedPermissionAgentId, true);
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
    return !record ? 'ربط الحساب' : record.status === 'connected' ? 'إلغاء الربط' : record.status === 'action_required' ? 'إكمال الربط' : 'ربط الحساب';
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
    localStorage.removeItem(SESSION_KEY);
    if (session) sessionStorage.setItem(SESSION_KEY, json(session));
    else {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_HANDOFF_KEY);
    }
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

  async function accountRequest(path, body) {
    if (!state.session?.access_token) throw new Error('انتهت الجلسة؛ سجّل الدخول مجدداً');
    const response = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' },
      body: json(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'تعذر تنفيذ الإجراء');
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
    if (!response.ok) throw new Error(data.message || 'تعذر تنفيذ الإجراء');
    return data;
  }

  async function authorizedRequest(path, { method = 'GET', body, retry = true } = {}) {
    if (!state.session?.access_token) throw new Error('يلزم تسجيل الدخول');
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
    const response = await fetch(`${API_URL}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : json(body)
    });
    if (response.status === 401 && retry) { await refreshSession(); return authorizedRequest(path, { method, body, retry: false }); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'تعذر تنفيذ الإجراء');
    return data;
  }

  async function authorizedBinaryRequest(path, { body, retry = true } = {}) {
    if (!state.session?.access_token) throw new Error('يلزم تسجيل الدخول');
    if (state.session.expires_at && state.session.expires_at * 1000 < Date.now() + 20000) await refreshSession();
    const response = await fetch(`${API_URL}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' },
      body: json(body)
    });
    if (response.status === 401 && retry) { await refreshSession(); return authorizedBinaryRequest(path, { body, retry: false }); }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'تعذر تشغيل الصوت');
    }
    return response.blob();
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

  async function refreshPayPalAdminStatus() {
    const panel = $('#paypalAdminPanel');
    if (!panel) return;
    panel.hidden = !isDeveloperAccount();
    if (panel.hidden) return;
    const status = $('#paypalConnectionStatus'), details = $('#paypalConnectionDetails');
    status.textContent = 'جارٍ التحقق...';
    status.className = 'status follow';
    try {
      const result = await adminRequest('paypal-status');
      state.paypalStatus = result;
      status.textContent = result.configured ? 'PayPal مربوط' : 'بانتظار الربط';
      status.className = `status ${result.configured ? 'qualified' : 'follow'}`;
      $('#paypalEnvironment').value = result.environment || 'live';
      details.textContent = result.configured
        ? `${result.environment === 'sandbox' ? 'بيئة اختبار' : 'دفع حقيقي'} • ${result.client_id_hint || 'بيانات محفوظة'} • تُحفظ المفاتيح مشفّرة`
        : 'أدخل Client ID وClient Secret لتطبيق VAREX من PayPal Developer.';
    } catch (error) {
      status.textContent = 'تعذر التحقق';
      status.className = 'status new';
      details.textContent = error.message;
    }
  }

  async function savePayPalCredentials() {
    const clientId = $('#paypalClientId').value.trim(), clientSecret = $('#paypalClientSecret').value.trim();
    const button = $('#savePayPalCredentials');
    if (clientId.length < 20 || /\s/.test(clientId)) { notify('أدخل PayPal Client ID الصحيح', true); $('#paypalClientId').focus(); return; }
    if (clientSecret.length < 20 || /\s/.test(clientSecret)) { notify('أدخل PayPal Client Secret الصحيح', true); $('#paypalClientSecret').focus(); return; }
    button.disabled = true;
    button.textContent = 'جارٍ التحقق مع PayPal...';
    try {
      await adminRequest('paypal-credentials', { method: 'POST', body: { client_id: clientId, client_secret: clientSecret, environment: $('#paypalEnvironment').value } });
      $('#paypalClientId').value = '';
      $('#paypalClientSecret').value = '';
      await refreshPayPalAdminStatus();
      notify('تم التحقق من الحساب وربط PayPal بنجاح');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'حفظ وربط PayPal'; }
  }

  async function refreshActivationCodeStats() {
    if (!isDeveloperAccount()) return;
    try {
      state.activationCodes = await adminRequest('activation-codes');
      const active = state.activationCodes.filter(item => item.status === 'active').length;
      const redeemed = state.activationCodes.filter(item => item.status === 'redeemed').length;
      $('#activationCodeStats').textContent = `الأكواد الجاهزة: ${active} • الأكواد المستخدمة: ${redeemed}`;
    } catch (error) { $('#activationCodeStats').textContent = error.message; }
  }

  async function generateActivationCode() {
    const button = $('#generateActivationCode');
    button.disabled = true;
    button.textContent = 'جارٍ إنشاء الكود...';
    try {
      const result = await adminRequest('activation-codes', { method: 'POST' });
      $('#generatedActivationCode').value = result.code;
      $('#activationCodeResult').hidden = false;
      await refreshActivationCodeStats();
      notify('تم إنشاء كود مجاني جديد صالح للاستخدام مرة واحدة');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'إنشاء كود جديد'; }
  }

  async function redeemFreeActivationCode() {
    const input = $('#activationCodeInput'), button = $('#redeemActivationCode');
    const code = input.value.trim();
    if (!code) { notify('أدخل كود التفعيل المجاني', true); input.focus(); return; }
    button.disabled = true;
    button.textContent = 'جارٍ التفعيل...';
    try {
      await authorizedRequest('activation-codes/redeem', { method: 'POST', body: { organization_id: state.org.id, code } });
      input.value = '';
      await loadWorkspace();
      showView('dashboard');
      notify('تم التفعيل المجاني وفتح التطبيق بنجاح');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'تفعيل'; }
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
    permissions: ['permissions.title', 'permissions.subtitle', 'صلاحيات التطبيقات', 'حدد بدقة ما يستطيع كل موظف تنفيذه على حساباتك وأجهزتك.'],
    tasks: ['tasks.title', 'tasks.subtitle', 'المهام والتشغيل', 'إنشاء المهام وتتبع حالتها وموافقاتها'],
    inbox: ['inbox.title', 'inbox.subtitle', 'صندوق الرسائل الموحد', 'يعرض الرسائل الحقيقية المحفوظة فقط.'],
    leads: ['leads.title', 'leads.subtitle', 'العملاء المحتملون', 'متابعة الفرص المحفوظة في قاعدة البيانات.'],
    approvals: ['approvals.title', 'approvals.subtitle', 'مركز الموافقات', 'القرارات الحساسة بانتظار اعتمادك'],
    knowledge: ['knowledge.title', 'knowledge.subtitle', 'قاعدة المعرفة', 'الملفات الحقيقية التي يعتمد عليها الموظف الذكي'],
    reports: ['reports.title', 'reports.subtitle', 'التقارير والتحليلات', 'أرقام محسوبة من بيانات مساحة العمل.'],
    billing: ['billing.title', 'billing.subtitle', 'الاشتراك والفوترة', 'ادفع عبر PayPal أو استخدم كود تفعيل مجاني من المالك.'],
    integrations: ['integrations.title', 'integrations.subtitle', 'ربط حسابات التواصل', 'كل بوابة تعرض حالة الربط والصلاحيات الحقيقية.'],
    settings: ['settings.title', 'settings.subtitle', 'الإعدادات', 'إدارة مساحة العمل والأمان واللغة والمظهر.']
  };

  const compactNavigation = window.matchMedia('(max-width: 1180px), (hover: none) and (pointer: coarse)');

  function setSidebarOpen(open, restoreFocus = false) {
    const sidebar = $('#sidebar');
    const overlay = $('#overlay');
    const menuButton = $('#menuBtn');
    const shouldOpen = Boolean(open && compactNavigation.matches);
    sidebar.classList.toggle('open', shouldOpen);
    overlay.classList.toggle('show', shouldOpen);
    document.body.classList.toggle('nav-open', shouldOpen);
    menuButton.setAttribute('aria-expanded', String(shouldOpen));
    sidebar.setAttribute('aria-hidden', String(compactNavigation.matches && !shouldOpen));
    if (!shouldOpen && restoreFocus && compactNavigation.matches) menuButton.focus();
  }

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
    setSidebarOpen(false);
    if (updateHash) history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'integrations' && !whatsappSignupIsReady() && !whatsappSignupContextPromise) {
      renderIntegrations();
    }
    if (id === 'permissions') {
      renderPermissions();
      if (state.selectedPermissionAgentId && !state.permissionDirty) void loadPermissionCenter(state.selectedPermissionAgentId, true);
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
      const disabled = locked && button.dataset.view !== 'billing' && !button.classList.contains('nav-logout');
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
    const map = { draft: ['status.draft', 'مسودة'], queued: ['status.queued', 'في الانتظار'], running: ['status.running', 'قيد التنفيذ'], awaiting_approval: ['status.awaitingApproval', 'بانتظار الموافقة'], action_required: ['status.actionRequired', 'بانتظار إجراء على الجهاز'], awaiting_user: ['status.actionRequired', 'بانتظار إجراء على الجهاز'], completed: ['status.completed', 'مكتملة'], failed: ['status.failed', 'فشلت'], cancelled: ['status.cancelled', 'ملغاة'], active: ['status.active', 'نشط'], paused: ['status.paused', 'متوقف'], pending: ['status.pending', 'بانتظار الموافقة'], approved: ['status.approved', 'مقبول'], rejected: ['status.rejected', 'مرفوض'], stored: ['status.stored', 'محفوظ'] };
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

  function permissionCatalog() {
    const remote = Object.keys(state.permissionCatalog || {}).length ? state.permissionCatalog : permissionCatalogFallback;
    return Object.fromEntries(Object.entries(remote).map(([appKey, app]) => [appKey, {
      ...(permissionCatalogFallback[appKey] || {}),
      ...app,
      icon: permissionCatalogFallback[appKey]?.icon || '🔐',
      actions: { ...(permissionCatalogFallback[appKey]?.actions || {}), ...(app.actions || {}) }
    }]));
  }

  function selectedPermissionAgent() {
    return state.agents.find(agent => agent.id === state.selectedPermissionAgentId) || null;
  }

  function permissionMode(appKey, actionKey) {
    return state.agentPermissions.find(item => item.app_key === appKey && item.action_key === actionKey)?.mode || 'denied';
  }

  function permissionAppConnected(appKey, app) {
    if (appKey === 'voice') return state.voiceSettings?.status === 'connected';
    if (app.connectionType === 'native') {
      return state.deviceConnections.some(device => {
        if (device.status !== 'connected' || device.online === false) return false;
        const capabilities = Array.isArray(device.capabilities) ? device.capabilities : [];
        return !capabilities.length || capabilities.includes(appKey);
      });
    }
    const aliases = appKey === 'email' ? ['email', 'gmail', 'outlook'] : appKey === 'parking' ? ['parking', 'rta', 'mawaqif'] : [appKey];
    return (state.permissionIntegrations || state.integrations).some(item => aliases.includes(item.provider) && item.status === 'connected');
  }

  function nativeDeviceConnectionState(appKey) {
    const capable = state.deviceConnections.filter(device => {
      const capabilities = Array.isArray(device.capabilities) ? device.capabilities : [];
      return device.status === 'connected' && (!capabilities.length || capabilities.includes(appKey));
    });
    if (capable.some(device => device.online !== false)) return 'online';
    return capable.length ? 'offline' : 'none';
  }

  function permissionIntegrationRecord(appKey) {
    const aliases = appKey === 'email' ? ['email', 'gmail', 'outlook'] : appKey === 'parking' ? ['parking', 'rta', 'mawaqif'] : [appKey];
    return (state.permissionIntegrations || state.integrations).find(item => aliases.includes(item.provider)) || null;
  }

  function permissionConnectionLabel(appKey, app, connected) {
    if (connected) return 'إلغاء الربط';
    if (app.connectionType === 'native') return 'ربط الجهاز';
    if (appKey === 'voice') return 'إعداد المكالمات';
    if (appKey === 'parking') return permissionIntegrationRecord(appKey)?.status === 'action_required' ? 'تعديل الربط' : 'ربط الخدمة';
    return 'ربط الحساب';
  }

  async function connectNativeDevice() {
    notify('افتح VAREX AI على الجهاز الذي سيُنفّذ المهمة، امنح الصلاحية المطلوبة، ثم فعّل ربط الجهاز.');
    if (/Android/i.test(navigator.userAgent)) {
      const fallback = setTimeout(() => window.open('/install', '_blank', 'noopener'), 1400);
      window.addEventListener('blur', () => clearTimeout(fallback), { once: true });
      location.href = 'varexai://settings';
    } else window.open('/install', '_blank', 'noopener');
  }

  async function disconnectNativeDevices() {
    const devices = state.deviceConnections.filter(device => device.status === 'connected');
    if (!devices.length) return;
    if (!window.confirm('هل تريد فصل تطبيق الهاتف وإيقاف استقبال أوامر الموظف على الجهاز؟')) return;
    try {
      for (const device of devices) await authorizedRequest('devices/disconnect', { method: 'POST', body: { organization_id: state.org.id, device_id: device.device_id } });
      await loadPermissionCenter(state.selectedPermissionAgentId, true);
      notify('تم فصل تطبيق الهاتف');
    } catch (error) { notify(error.message, true); }
  }

  async function handlePermissionConnection(appKey, button) {
    const app = permissionCatalog()[appKey];
    if (!app) return;
    const connected = permissionAppConnected(appKey, app);
    if (app.connectionType === 'native') {
      if (connected) await disconnectNativeDevices(); else await connectNativeDevice();
      return;
    }
    if (appKey === 'voice') {
      $('#voicePolicyCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!connected) $('#voiceCallerId')?.focus();
      notify(connected ? 'رقم المكالمات موثّق وجاهز ضمن حدود الصلاحيات.' : 'أدخل رقمك الأساسي واضغط «اتصل بي لتوثيق الرقم».');
      return;
    }
    if (appKey === 'parking') {
      openParkingConnection();
      return;
    }
    await requestIntegration(button, appKey);
  }

  function voicePolicy() {
    const settings = state.voiceSettings?.settings && typeof state.voiceSettings.settings === 'object' ? state.voiceSettings.settings : {};
    return {
      caller_id: state.voiceSettings?.caller_id || '',
      voice_id: state.voiceSettings?.voice_id || 'Sulafat',
      disclosure_text: state.voiceSettings?.disclosure_text || 'مرحباً، أنا المساعد الذكي وأتصل نيابة عن صاحب الحساب.',
      settings: { daily_call_limit: Number(settings.daily_call_limit || 10), max_call_minutes: Number(settings.max_call_minutes || 10), allowed_from: settings.allowed_from || '09:00', allowed_to: settings.allowed_to || '18:00' }
    };
  }

  function renderVoicePolicy() {
    const card = $('#voicePolicyCard'); if (!card) return;
    const policy = voicePolicy(), disabled = !state.selectedPermissionAgentId || PREVIEW_MODE;
    $('#voiceCallerId').value = policy.caller_id;
    $('#voiceDailyLimit').value = policy.settings.daily_call_limit;
    $('#voiceMinuteLimit').value = policy.settings.max_call_minutes;
    $('#voiceAllowedFrom').value = policy.settings.allowed_from;
    $('#voiceAllowedTo').value = policy.settings.allowed_to;
    $('#voiceDisclosure').value = policy.disclosure_text;
    const connected = state.voiceSettings?.status === 'connected';
    const pending = state.voiceSettings?.status === 'verification_pending';
    const selected = Boolean(policy.caller_id);
    const gatewayConfigured = Boolean(state.voiceReadiness?.gateway_configured);
    const sipConfigured = Boolean(state.voiceReadiness?.sip_configured);
    const aiConfigured = Boolean(state.voiceReadiness?.[`${['open', 'ai'].join('')}_configured`]);
    $$('#voicePolicyCard input,#voicePolicyCard textarea').forEach(field => { if (!field.closest('#voiceGatewayAdmin')) field.disabled = disabled; });
    $('#voiceCallerId').readOnly = connected;
    const ready = Boolean(state.voiceReadiness?.ready);
    const status = $('#voiceProviderStatus');
    status.textContent = ready ? 'جاهز للاتصال الذكي' : connected ? 'الرقم موثّق — الإعداد غير مكتمل' : pending ? 'بانتظار رمز التحقق' : selected && !gatewayConfigured ? 'الرقم محدد — بانتظار ربط السنترال' : 'بانتظار توثيق الرقم';
    status.className = `status ${ready ? 'qualified' : 'follow'}`;
    const checks = [
      ['سنترال المكالمات', state.voiceReadiness?.gateway_configured],
      ['مفتاح الذكاء', state.voiceReadiness?.[`${['open', 'ai'].join('')}_configured`]],
      ['مسار SIP الآمن', state.voiceReadiness?.sip_configured],
      ['رقمك الأساسي موثّق', state.voiceReadiness?.caller_verified]
    ];
    $('#voiceReadinessList').innerHTML = checks.map(([label, ok]) => `<span style="display:inline-flex;gap:5px;align-items:center;margin-inline-end:14px;color:${ok ? '#087853' : '#9a6716'}"><b>${ok ? '✓' : '○'}</b>${safe(label)}</span>`).join('');
    const setupNotice = $('#voiceSetupNotice');
    if (ready) setupNotice.hidden = true;
    else {
      setupNotice.hidden = false;
      if (!gatewayConfigured) setupNotice.innerHTML = isDeveloperAccount()
        ? '<strong>الرقم جاهز للاختيار، وبقي ربط شبكة المكالمات مرة واحدة.</strong> اضغط «توثيق الرقم الآن» لفتح بيانات السنترال المطلوبة.'
        : '<strong>شبكة المكالمات قيد التجهيز من إدارة VAREX.</strong> سيصبح توثيق الرقم متاحاً فور اكتمال الربط المركزي.';
      else if (!sipConfigured) setupNotice.innerHTML = '<strong>تم ربط شبكة المكالمات.</strong> بقي حفظ معرّف مشروع المكالمات ومفتاح توقيع Webhook.';
      else if (!aiConfigured) setupNotice.innerHTML = '<strong>السنترال جاهز.</strong> بقي تفعيل مفتاح الذكاء المركزي.';
      else if (!connected) setupNotice.innerHTML = '<strong>كل الإعدادات المركزية جاهزة.</strong> اضغط «توثيق الرقم الآن» وسيصلك اتصال تحقق لمرة واحدة.';
      else setupNotice.innerHTML = '<strong>الرقم موثّق.</strong> بقي فحص الجاهزية النهائية للمكالمة الذكية.';
    }
    const linked = state.voiceReadiness?.linked_phone || '';
    $('#voiceUseLinkedNumber').hidden = !linked || connected;
    $('#voiceUseLinkedNumber').disabled = disabled;
    $('#voiceVerifyNumber').hidden = connected;
    $('#voiceVerifyNumber').disabled = disabled;
    $('#voiceVerifyNumber').title = gatewayConfigured ? 'بدء اتصال التحقق' : 'اضغط لعرض الإعداد الناقص';
    $('#voiceCheckNumber').hidden = !pending;
    $('#voiceCheckNumber').disabled = disabled;
    $('#voiceDisconnectNumber').hidden = !connected && !pending;
    $('#voiceDisconnectNumber').disabled = disabled;
    $('#voiceValidationBox').hidden = !state.voiceValidationCode;
    $('#voiceValidationCode').textContent = state.voiceValidationCode;
    const admin = $('#voiceGatewayAdmin'); admin.hidden = !isDeveloperAccount();
    if (isDeveloperAccount()) {
      const gateway = state.voiceGatewayStatus || {};
      const aiCode = ['open', 'ai'].join('');
      $('#voiceWebhookUrl').value = gateway.webhook_url || state.voiceReadiness?.webhook_url || `${location.origin}/api/webhooks/${aiCode}/voice`;
      $('#voiceGatewayStatus').textContent = gateway.configured && gateway.sip_configured && gateway[`${aiCode}_configured`] ? 'السنترال والذكاء جاهزان' : gateway.configured ? 'السنترال محفوظ — أكمل الذكاء وSIP' : 'بانتظار بيانات السنترال';
      $('#voiceGatewayStatus').className = `status ${gateway.configured && gateway.sip_configured && gateway[`${aiCode}_configured`] ? 'qualified' : 'follow'}`;
      $$('#voiceGatewayAdmin input').forEach(field => { field.disabled = PREVIEW_MODE; });
      $('#saveVoiceGateway').disabled = PREVIEW_MODE;
    }
  }

  function openVoiceGatewaySetup(message = 'أكمل بيانات سنترال المكالمات أولاً، ثم سيبدأ توثيق الرقم مباشرة.') {
    const admin = $('#voiceGatewayAdmin');
    if (!isDeveloperAccount() || !admin) { notify('شبكة المكالمات لم تُفعّل مركزياً بعد. يلزم أن تكمل إدارة VAREX إعداد السنترال أولاً.', true); return false; }
    admin.hidden = false;
    admin.open = true;
    admin.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const firstMissing = !state.voiceReadiness?.gateway_configured ? $('#voiceGatewayAccountId') : !state.voiceReadiness?.sip_configured ? $('#voiceAiProjectId') : null;
    if (firstMissing) setTimeout(() => firstMissing.focus(), 350);
    notify(message, true);
    return true;
  }

  async function selectLinkedVoiceNumber() {
    const phone = state.voiceReadiness?.linked_phone || '';
    if (!phone) { notify('لا يوجد رقم واتساب مرتبط بهذا الحساب.', true); return; }
    const button = $('#voiceUseLinkedNumber'); button.disabled = true; button.textContent = 'جارٍ اختيار الرقم…';
    try {
      const result = await authorizedRequest('voice/number/select', { method: 'POST', body: { organization_id: state.org.id, agent_id: state.selectedPermissionAgentId, phone } });
      state.voiceSettings = { ...(state.voiceSettings || {}), caller_id: result.caller_id || phone, status: result.status || 'not_connected' };
      await loadVoiceControlData(); renderPermissions();
      notify(result.message || 'تم اختيار رقمك المرتبط. اضغط «توثيق الرقم الآن».');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'استخدام رقمي المرتبط'; }
  }

  async function loadVoiceControlData(agentId = state.selectedPermissionAgentId) {
    if (!agentId || !state.org?.id || PREVIEW_MODE || !state.session?.access_token) return;
    const jobs = [
      authorizedRequest(`voice/readiness?organization_id=${encodeURIComponent(state.org.id)}&agent_id=${encodeURIComponent(agentId)}`),
      authorizedRequest(`voice/calls?organization_id=${encodeURIComponent(state.org.id)}&agent_id=${encodeURIComponent(agentId)}`),
      isDeveloperAccount() ? adminRequest('voice-gateway') : Promise.resolve(null)
    ];
    const [readiness, calls, gateway] = await Promise.all(jobs);
    if (state.selectedPermissionAgentId !== agentId) return;
    state.voiceReadiness = readiness;
    state.voiceCalls = calls || [];
    state.voiceGatewayStatus = gateway;
  }

  async function verifyVoiceNumber() {
    const phone = $('#voiceCallerId').value.trim();
    if (!phone) { notify('أدخل رقمك الأساسي مع +971', true); $('#voiceCallerId').focus(); return; }
    if (!state.voiceReadiness?.gateway_configured) { openVoiceGatewaySetup(); return; }
    const button = $('#voiceVerifyNumber'); button.disabled = true; button.textContent = 'جارٍ طلب اتصال التحقق…';
    try {
      const result = await authorizedRequest('voice/number/verify', { method: 'POST', body: { organization_id: state.org.id, agent_id: state.selectedPermissionAgentId, phone } });
      state.voiceValidationCode = result.validation_code || '';
      state.voiceSettings = { ...(state.voiceSettings || {}), caller_id: result.caller_id || phone, status: result.status };
      await loadVoiceControlData(); renderPermissions();
      notify(result.message || 'بدأ توثيق الرقم');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'توثيق الرقم الآن'; }
  }

  async function checkVoiceNumber() {
    const button = $('#voiceCheckNumber'); button.disabled = true; button.textContent = 'جارٍ التحقق…';
    try {
      const result = await authorizedRequest('voice/number/status', { method: 'POST', body: { organization_id: state.org.id, agent_id: state.selectedPermissionAgentId, phone: $('#voiceCallerId').value.trim() } });
      state.voiceSettings = { ...(state.voiceSettings || {}), caller_id: result.caller_id, status: result.status };
      if (result.status === 'connected') state.voiceValidationCode = '';
      await loadVoiceControlData(); renderPermissions(); notify(result.message);
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'تحقق من اكتمال التوثيق'; }
  }

  async function disconnectVoiceNumber() {
    if (!window.confirm('هل تريد فصل رقم المكالمات؟ لن يستطيع الموظف إجراء اتصال ذكي قبل توثيقه مجدداً.')) return;
    try {
      const result = await authorizedRequest('voice/number/disconnect', { method: 'POST', body: { organization_id: state.org.id, agent_id: state.selectedPermissionAgentId } });
      state.voiceSettings = { ...(state.voiceSettings || {}), caller_id: '', status: 'not_connected' };
      state.voiceValidationCode = '';
      await loadVoiceControlData(); renderPermissions(); notify(result.message);
    } catch (error) { notify(error.message, true); }
  }

  async function saveVoiceGateway() {
    const button = $('#saveVoiceGateway'); button.disabled = true; button.textContent = 'جارٍ الاختبار والحفظ…';
    try {
      const aiCode = ['open', 'ai'].join('');
      const apiKey = $('#voiceAiApiKey').value.trim();
      if (apiKey) await authorizedRequest('ai/providers', { method: 'POST', body: { organization_id: state.org.id, provider: aiCode, api_key: apiKey } });
      const gatewayBody = {
        account_id: $('#voiceGatewayAccountId').value.trim(),
        auth_secret: $('#voiceGatewayAuthSecret').value.trim()
      };
      gatewayBody[`${aiCode}_project_id`] = $('#voiceAiProjectId').value.trim();
      gatewayBody[`${aiCode}_webhook_secret`] = $('#voiceAiWebhookSecret').value.trim();
      const gateway = await adminRequest('voice-gateway', { method: 'POST', body: gatewayBody });
      state.voiceGatewayStatus = { ...gateway, [`${aiCode}_configured`]: apiKey ? true : state.voiceGatewayStatus?.[`${aiCode}_configured`] };
      ['voiceGatewayAuthSecret', 'voiceAiWebhookSecret', 'voiceAiApiKey'].forEach(id => { $(`#${id}`).value = ''; });
      await loadVoiceControlData(); renderVoicePolicy();
      if (state.voiceReadiness?.gateway_configured && state.voiceSettings?.status !== 'connected' && $('#voiceCallerId').value.trim()) {
        notify('تم حفظ السنترال. سيبدأ الآن اتصال توثيق الرقم لمرة واحدة.');
        await verifyVoiceNumber();
      } else notify('تم اختبار السنترال وحفظ إعدادات SIP');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'حفظ واختبار السنترال'; }
  }

  function renderPermissionLog(catalog) {
    const body = $('#permissionLogBody');
    if (!body) return;
    const entries = state.actionExecutions.filter(item => !state.selectedPermissionAgentId || item.agent_id === state.selectedPermissionAgentId).slice(0, 100);
    if (!entries.length) { body.innerHTML = '<tr><td colspan="7">لا توجد محاولات تنفيذ لهذا الموظف بعد.</td></tr>'; return; }
    const classes = { completed: 'qualified', awaiting_approval: 'follow', action_required: 'follow', queued: 'new', running: 'new', failed: 'hot', blocked: 'hot', rejected: 'hot', cancelled: 'hot' };
    body.innerHTML = entries.map(item => {
      const app = catalog[item.app_key] || {};
      const action = app.actions?.[item.action_key] || {};
      const date = item.created_at ? new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.created_at)) : '—';
      const label = ({ completed: 'تم التنفيذ', awaiting_approval: 'بانتظار موافقتك', action_required: 'بانتظار فتح الهاتف', queued: 'في الانتظار', running: 'قيد التنفيذ', failed: 'فشل', blocked: 'ممنوع', rejected: 'مرفوض', cancelled: 'ملغى' })[item.status] || item.status;
      return `<tr><td>${safe(date)}</td><td>${safe(app.label || item.app_key)}</td><td>${safe(action.label || item.action_key)}</td><td>${safe(item.target || '—')}</td><td><span class="status ${classes[item.status] || 'new'}">${safe(label)}</span></td><td>${safe(item.result_summary || '—')}</td><td><span class="execution-code">${safe(String(item.id || '').slice(0, 8))}</span></td></tr>`;
    }).join('');
  }

  function renderPermissions() {
    const select = $('#permissionAgentSelect'), grid = $('#permissionAppGrid');
    if (!select || !grid) return;
    const current = state.selectedPermissionAgentId || state.agents.find(agent => agent.status === 'active')?.id || state.agents[0]?.id || '';
    state.selectedPermissionAgentId = state.agents.some(agent => agent.id === current) ? current : '';
    select.innerHTML = '<option value="">اختر موظفاً</option>' + state.agents.map(agent => `<option value="${safe(agent.id)}">${safe(agent.name)} — ${safe(agent.role)}</option>`).join('');
    select.value = state.selectedPermissionAgentId;
    const catalog = permissionCatalog();
    if (!state.selectedPermissionAgentId) {
      grid.innerHTML = '<article class="card permission-empty">أنشئ موظفاً ذكياً أولاً، ثم اختره لتحديد صلاحياته.</article>';
      $('#savePermissions').disabled = true;
      ['permissionDeniedCount', 'permissionApprovalCount', 'permissionAutomaticCount', 'permissionConnectedCount'].forEach(id => $(`#${id}`).textContent = '0');
      renderPermissionLog(catalog);
      renderVoicePolicy();
      return;
    }
    let denied = 0, approval = 0, automatic = 0, connected = 0;
    grid.innerHTML = Object.entries(catalog).map(([appKey, app]) => {
      const appConnected = permissionAppConnected(appKey, app); if (appConnected) connected += 1;
      const integrationRecord = permissionIntegrationRecord(appKey);
      const nativeState = app.connectionType === 'native' ? nativeDeviceConnectionState(appKey) : 'none';
      const connectionState = appConnected ? 'متصل الآن' : app.connectionType === 'native' ? (nativeState === 'offline' ? 'مربوط لكن الجهاز غير متصل الآن' : 'يحتاج ربط جهاز') : appKey === 'parking' && integrationRecord?.status === 'action_required' ? 'إعداد محفوظ — بانتظار التفعيل' : integrationRecord?.status === 'action_required' ? 'يحتاج إكمال الربط' : appKey === 'voice' ? 'رقم المكالمات غير مربوط' : 'غير مربوط';
      const connectionLabel = permissionConnectionLabel(appKey, app, appConnected);
      const actions = Object.entries(app.actions || {}).map(([actionKey, action]) => {
        const mode = permissionMode(appKey, actionKey);
        if (mode === 'automatic') automatic += 1; else if (mode === 'approval') approval += 1; else denied += 1;
        return `<div class="permission-action" data-app="${safe(appKey)}" data-action="${safe(actionKey)}" data-risk="${safe(action.risk)}"><div class="permission-action-name"><span class="risk-dot ${safe(action.risk)}"></span><span>${safe(action.label)}</span></div><div class="permission-modes" role="group" aria-label="صلاحية ${safe(action.label)}"><button class="permission-mode ${mode === 'denied' ? 'active' : ''}" type="button" data-mode="denied">ممنوع</button><button class="permission-mode ${mode === 'approval' ? 'active' : ''}" type="button" data-mode="approval">بموافقتي</button><button class="permission-mode ${mode === 'automatic' ? 'active' : ''}" type="button" data-mode="automatic">دون موافقة</button></div></div>`;
      }).join('');
      return `<article class="card permission-card"><div class="permission-card-head"><span class="permission-app-icon">${safe(app.icon)}</span><div><h3>${safe(app.label)}</h3><p>${safe(app.description)}</p></div><div class="permission-connection-tools"><span class="connection-chip ${appConnected ? 'connected' : ''}">${safe(connectionState)}</span><button class="permission-connect-button" type="button" data-permission-connect="${safe(appKey)}" data-connected="${String(appConnected)}">${safe(connectionLabel)}</button></div></div><div class="permission-actions">${actions}</div></article>`;
    }).join('');
    $('#permissionDeniedCount').textContent = denied;
    $('#permissionApprovalCount').textContent = approval;
    $('#permissionAutomaticCount').textContent = automatic;
    $('#permissionConnectedCount').textContent = connected;
    $('#savePermissions').disabled = !state.permissionDirty || PREVIEW_MODE;
    $('#permissionSaveState').textContent = state.permissionDirty ? 'يوجد تغيير غير محفوظ.' : 'الصلاحيات المعروضة محفوظة ومفعّلة.';
    $$('.permission-mode', grid).forEach(button => button.addEventListener('click', () => {
      const row = button.closest('.permission-action'), mode = button.dataset.mode;
      if (mode === 'automatic' && row.dataset.risk === 'critical' && !window.confirm('تنبيه: هذه صلاحية حساسة وقد تنفّذ إرسالاً أو اتصالاً أو حذفاً أو دفعاً مباشرة دون موافقتك. هل تريد المتابعة؟')) return;
      const existing = state.agentPermissions.find(item => item.app_key === row.dataset.app && item.action_key === row.dataset.action);
      if (existing) existing.mode = mode;
      else state.agentPermissions.push({ organization_id: state.org?.id, agent_id: state.selectedPermissionAgentId, app_key: row.dataset.app, action_key: row.dataset.action, mode, risk_level: row.dataset.risk });
      state.permissionDirty = true;
      renderPermissions();
    }));
    $$('[data-permission-connect]', grid).forEach(button => button.addEventListener('click', () => void handlePermissionConnection(button.dataset.permissionConnect, button)));
    renderPermissionLog(catalog);
    renderVoicePolicy();
  }

  async function loadPermissionCenter(agentId = state.selectedPermissionAgentId, quiet = false) {
    if (!agentId || !state.org?.id) { renderPermissions(); return; }
    state.selectedPermissionAgentId = agentId;
    if (PREVIEW_MODE || !state.session?.access_token) { state.permissionCatalog = permissionCatalogFallback; renderPermissions(); return; }
    if (!quiet) $('#permissionSaveState').textContent = 'جارٍ تحميل الصلاحيات والحالة الفعلية…';
    try {
      const [snapshot, executions] = await Promise.all([
        authorizedRequest(`permissions?organization_id=${encodeURIComponent(state.org.id)}&agent_id=${encodeURIComponent(agentId)}`),
        rest('ai_action_executions', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc&limit=100` })
      ]);
      if (state.selectedPermissionAgentId !== agentId) return;
      state.permissionCatalog = snapshot.catalog || permissionCatalogFallback;
      state.agentPermissions = snapshot.permissions || [];
      state.deviceConnections = snapshot.devices || [];
      state.voiceSettings = snapshot.voice || null;
      state.permissionIntegrations = snapshot.integrations || [];
      state.actionExecutions = executions || [];
      state.permissionDirty = false;
      try { await loadVoiceControlData(agentId); } catch (error) { state.voiceReadiness = null; state.voiceCalls = []; if (!quiet) notify(error.message, true); }
      renderPermissions();
    } catch (error) {
      $('#permissionSaveState').textContent = error.message;
      if (!quiet) notify(error.message, true);
    }
  }

  async function savePermissions() {
    const agent = selectedPermissionAgent();
    if (!agent) { notify('اختر الموظف الذكي أولاً', true); return; }
    const button = $('#savePermissions'); button.disabled = true; button.textContent = 'جارٍ الحفظ…';
    try {
      const catalog = permissionCatalog();
      const permissions = Object.entries(catalog).flatMap(([appKey, app]) => Object.entries(app.actions || {}).map(([actionKey, action]) => ({ app_key: appKey, action_key: actionKey, mode: permissionMode(appKey, actionKey), risk_level: action.risk })));
      const snapshot = await authorizedRequest('permissions', { method: 'PUT', body: { organization_id: state.org.id, agent_id: agent.id, permissions, voice: voicePolicy() } });
      state.agentPermissions = snapshot.permissions || permissions;
      state.deviceConnections = snapshot.devices || state.deviceConnections;
      state.voiceSettings = snapshot.voice || null;
      state.permissionIntegrations = snapshot.integrations || [];
      state.permissionDirty = false;
      renderPermissions();
      notify('تم حفظ صلاحيات الموظف وتفعيلها');
    } catch (error) { notify(error.message, true); renderPermissions(); }
    finally { button.textContent = 'حفظ الصلاحيات'; }
  }

  async function emergencyStopSelectedAgent() {
    const agent = selectedPermissionAgent();
    if (!agent) { notify('اختر الموظف الذكي أولاً', true); return; }
    if (!window.confirm(`سيتم إيقاف ${agent.name} فوراً، وسحب كل صلاحياته، وإلغاء العمليات المنتظرة. هل تريد المتابعة؟`)) return;
    const button = $('#emergencyStopAgent'); button.disabled = true; button.textContent = 'جارٍ الإيقاف…';
    try {
      const result = await authorizedRequest('permissions/emergency-stop', { method: 'POST', body: { organization_id: state.org.id, agent_id: agent.id } });
      agent.status = 'paused';
      await loadPermissionCenter(agent.id, true);
      renderAgents();
      notify(result.message || 'تم إيقاف الموظف وسحب صلاحياته');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'إيقاف فوري وسحب الصلاحيات'; }
  }

  async function executeTask(task, button) {
    const parsed = window.VarexCommandEngine.parse(task.instructions || task.title || '');
    if (!['whatsappSend', 'phoneCall', 'agentAction'].includes(parsed.type)) {
      const output = 'لم تُنفّذ المهمة لأن التعليمات ليست بصيغة عملية معروفة. استخدم مثلاً: أرسل واتساب إلى +971...: نص الرسالة';
      try {
        await rest('ai_tasks', { method: 'PATCH', query: `id=eq.${task.id}`, body: { status: 'failed', output, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
        task.status = 'failed'; task.output = output; renderAll(); notify(output, true);
      } catch (error) { notify(error.message, true); }
      return;
    }
    button.disabled = true; button.textContent = 'جارٍ التنفيذ…';
    try {
      const result = await submitAgentAction(parsed, { taskId: task.id, agentId: task.agent_id, forceApproval: Boolean(task.requires_approval && task.status !== 'approved') });
      state.tasks = await rest('ai_tasks', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      renderAll();
      notify(result.message || 'تمت معالجة المهمة');
      if (result.code === 'APPROVAL_REQUIRED') showView('approvals');
    } catch (error) {
      state.tasks = await rest('ai_tasks', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` }).catch(() => state.tasks);
      renderAll(); notify(error.message, true);
    }
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
      const statusClass = task.status === 'completed' ? 'qualified' : task.status === 'awaiting_approval' ? 'follow' : ['failed', 'cancelled'].includes(task.status) ? 'hot' : 'new';
      const actionable = ['draft', 'approved', 'failed'].includes(task.status);
      const actionLabel = task.status === 'draft' ? 'تنفيذ المهمة' : task.status === 'failed' ? 'إعادة المحاولة' : task.status === 'approved' ? 'تنفيذ الآن' : 'عرض الحالة';
      card.innerHTML = `<div class="task-top"><div class="stat-icon purple"><svg class="icon"><use href="#i-clock"/></svg></div><div><h3>${safe(task.title)}</h3><p>${safe(agent?.name || 'بدون تعيين')} • أولوية ${safe(({ low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' })[task.priority] || task.priority)}</p></div><span class="status ${statusClass} task-status">${safe(statusLabel(task.status))}</span></div><div class="task-body">${safe(task.instructions || 'لا توجد تعليمات إضافية.')}${task.output ? `<div class="module-note" style="margin:12px 0 0">النتيجة: ${safe(task.output)}</div>` : ''}</div><div class="task-foot"><span>أُنشئت ${formatDate(task.created_at)}</span><button class="link-btn" type="button">${actionLabel}</button></div>`;
      $('.link-btn', card).addEventListener('click', event => {
        if (!actionable) { notify(task.output || `حالة المهمة: ${statusLabel(task.status)}`); return; }
        void executeTask(task, event.currentTarget);
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
    if (approval.action_execution_id) {
      try {
        const result = await authorizedRequest(`actions/${encodeURIComponent(approval.action_execution_id)}/decision`, { method: 'POST', body: { decision: status } });
        notify(result.message || (status === 'approved' ? 'تمت الموافقة وتنفيذ العملية' : 'تم الرفض ولم يُنفّذ أي شيء'));
      } catch (error) { notify(error.message, true); }
      finally {
        const [approvals, tasks, executions] = await Promise.all([
          rest('ai_approvals', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` }).catch(() => state.approvals),
          rest('ai_tasks', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` }).catch(() => state.tasks),
          rest('ai_action_executions', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc&limit=100` }).catch(() => state.actionExecutions)
        ]);
        state.approvals = approvals; state.tasks = tasks; state.actionExecutions = executions; renderAll();
      }
      return;
    }
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
      button.disabled = false;
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
    renderDashboardIntegrations();
  }

  function renderBilling() {
    const subscription = currentSubscription();
    const plan = plans[subscription.plan_code] || plans.pending;
    const developer = isDeveloperAccount();
    const gift = subscription.plan_code === 'gift' && subscription.status === 'active';
    const locked = subscriptionLocked();
    const used = state.tasks.length;
    const limit = Math.max(1, subscription.monthly_task_limit || plan.tasks || 1);
    const percent = developer ? 0 : Math.min(100, Math.round((used / limit) * 100));
    $('#currentPlanName').textContent = plan.name;
    $('#currentPlanDescription').textContent = developer
      ? 'دخول مجاني دائم بصلاحية كاملة، بدون دفع أو تاريخ انتهاء.'
      : gift
      ? 'تفعيل مجاني خاص من المالك بصلاحية كاملة وبدون تاريخ انتهاء.'
      : subscription.status === 'active'
      ? `${plan.price} • ${limit.toLocaleString(currentLocale())} مهمة شهرياً • التجديد: ${formatDate(subscription.renews_at)}`
      : subscription.status === 'pending_payment'
      ? `${plan.price} • بانتظار تأكيد استلام الدفع من المالك.`
      : 'اختر باقة مدفوعة وطريقة الدفع لإرسال طلب التفعيل.';
    $('#usageLabel').textContent = developer || gift ? `${used.toLocaleString(currentLocale())} من غير محدود` : `${used.toLocaleString(currentLocale())} من ${limit.toLocaleString(currentLocale())}`;
    $('#usageBar').style.width = `${percent}%`;
    $('#sidebarPlan').textContent = plan.name;
    $('#sidebarUsagePercent').textContent = developer || gift ? '∞' : locked ? 'مقفول' : `${percent}%`;
    $('#sidebarUsageBar').style.width = `${percent}%`;
    $('#sidebarUsageText').textContent = developer ? 'دخول المالك المجاني' : gift ? 'تفعيل مجاني دائم' : locked ? 'بانتظار اشتراك فعّال أو كود مجاني' : `${used.toLocaleString(currentLocale())} من ${limit.toLocaleString(currentLocale())} مهمة`;
    selectPlanByName(plan.name);
    const heroButton = $('.billing-hero .choose-plan');
    if (heroButton) heroButton.hidden = developer;
    $$('.plan-card .choose-plan').forEach(button => { button.disabled = developer; button.hidden = developer; });
    const pending = state.subscriptions.find(item => item.status === 'pending_payment');
    $('#paymentLabel').textContent = developer
      ? 'المالك لا يحتاج إلى وسيلة دفع'
      : gift
      ? 'الحساب مفعّل بكود مجاني'
      : pending
      ? `${pending.payment_method || 'طريقة الدفع المختارة'} — بانتظار تأكيد الدفع`
      : subscription.status === 'active'
      ? `${subscription.payment_method || 'الدفع اليدوي'} — تم تأكيد الدفع`
      : 'اختر باقة وطريقة دفع';
    const history = $('#subscriptionHistoryBody');
    if (history) {
      const statusNames = { active: 'نشط', pending_payment: 'بانتظار الدفع', superseded: 'مستبدل', cancelled: 'ملغى', trialing: 'منتهي' };
      history.innerHTML = developer
        ? '<tr><td>OWNER</td><td>المالك</td><td>دائم</td><td>0 درهم</td><td><span class="status qualified">نشط</span></td><td></td></tr>'
        : state.subscriptions.length
        ? state.subscriptions.map((item, index) => { const info = plans[item.plan_code] || plans.pending; return `<tr><td>${safe(String(item.id || '').slice(0, 10))}</td><td>${safe(info.name)}</td><td>${safe(formatDate(item.created_at || item.starts_at))}</td><td>${safe(info.price)}</td><td><span class="status ${item.status === 'active' ? 'qualified' : 'follow'}">${safe(statusNames[item.status] || item.status)}</span></td><td>${index === 0 ? '<button class="link-btn subscription-download" type="button">تحميل الملخص</button>' : ''}</td></tr>`; }).join('')
        : '<tr><td colspan="6">اختر باقة لإرسال طلب الاشتراك.</td></tr>';
      $('.subscription-download', history)?.addEventListener('click', downloadSubscriptionSummary);
    }
    renderActivationCodeCard();
    renderDeveloperSubscriptions();
  }

  function renderActivationCodeCard() {
    const developer = isDeveloperAccount();
    const giftActive = currentSubscription().plan_code === 'gift' && currentSubscription().status === 'active';
    $('#ownerCodeGeneratorCard').hidden = !developer;
    $('#activationOwnerPanel').hidden = !developer;
    $('#activationCodeCard').hidden = developer;
    $('#activationCustomerPanel').hidden = developer;
    $('#paypalAdminPanel').hidden = !developer;
    if (!developer) {
      $('#activationCodeInput').disabled = giftActive;
      $('#redeemActivationCode').disabled = giftActive;
      $('#activationCustomerStatus').textContent = giftActive ? 'هذا الحساب مفعّل مجاناً بالفعل.' : 'كل كود صالح للاستخدام مرة واحدة فقط.';
    }
  }

  function downloadSubscriptionSummary() {
    const sub = currentSubscription(); const plan = plans[sub.plan_code] || plans.pending;
    const summary = `VAREX AI\nملخص اشتراك — ليس فاتورة ضريبية\nالباقة: ${plan.name}\nالسعر: ${plan.price}\nالحالة: ${sub.status}\nالتاريخ: ${formatDate(new Date())}`;
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

  function integrationMetadata(record) {
    if (!record) return {};
    if (record.metadata && typeof record.metadata === 'object') return record.metadata;
    try { return JSON.parse(record.metadata || '{}'); } catch (_) { return {}; }
  }

  function websiteSourcesFromState() {
    const record = state.integrations.find(item => item.provider === 'website');
    const websites = integrationMetadata(record).websites;
    return Array.isArray(websites) ? websites.filter(item => item && item.url).slice(0, 25) : [];
  }

  function renderDashboardIntegrations() {
    $$('#dashboardIntegrationGrid [data-dashboard-provider]').forEach(card => {
      const provider = card.dataset.dashboardProvider;
      const note = $('small', card), button = $('.dashboard-connector-action', card);
      if (!note || !button) return;
      if (provider === 'website') {
        const count = websiteSourcesFromState().length;
        note.textContent = count ? `${count} ${count === 1 ? 'موقع معتمد' : 'مواقع معتمدة'}` : 'لم تُضف مواقع بعد';
        note.classList.toggle('connected', count > 0);
        button.textContent = 'تعديل';
        return;
      }
      const record = state.integrations.find(item => item.provider === provider);
      const connected = record?.status === 'connected';
      note.textContent = connected ? `متصل: ${record.connected_account || 'الحساب التجاري'}` : record?.status === 'action_required' ? 'يحتاج إكمال الربط' : 'غير مربوط';
      note.classList.toggle('connected', connected);
      button.textContent = connected ? 'إلغاء الربط' : record?.status === 'action_required' ? 'إكمال' : 'ربط';
    });
  }

  function addWebsiteSourceRow(site = {}) {
    const rows = $('#websiteSourceRows');
    if (!rows) return;
    $('.website-source-empty', rows)?.remove();
    const row = document.createElement('div');
    row.className = 'website-source-row';
    row.innerHTML = `<div class="field"><label>اسم الموقع</label><input class="website-source-name" maxlength="100" placeholder="مثال: موقع الشركة" value="${safe(site.name || '')}" /></div><div class="field"><label>رابط الموقع</label><input class="website-source-url" type="url" maxlength="1200" inputmode="url" dir="ltr" placeholder="https://example.com" value="${safe(site.url || '')}" /></div><button class="website-source-remove" type="button" aria-label="حذف الموقع">×</button>`;
    $('.website-source-remove', row).addEventListener('click', () => {
      row.remove();
      if (!$$('.website-source-row', rows).length) rows.innerHTML = '<div class="website-source-empty">لم تُضف مواقع بعد. اضغط «إضافة موقع» للبدء.</div>';
    });
    rows.append(row);
  }

  function openWebsiteSources() {
    const rows = $('#websiteSourceRows');
    if (!rows) return;
    rows.replaceChildren();
    const websites = websiteSourcesFromState();
    if (websites.length) websites.forEach(site => addWebsiteSourceRow(site));
    else addWebsiteSourceRow();
    $('#websiteSourcesModal').classList.add('open');
    setTimeout(() => $('.website-source-name', rows)?.focus(), 0);
  }

  function closeWebsiteSources() { $('#websiteSourcesModal')?.classList.remove('open'); }

  function openParkingConnection() {
    const record = state.integrations.find(item => item.provider === 'parking');
    const metadata = integrationMetadata(record);
    $('#parkingProvider').value = metadata.service_provider || 'rta_dubai';
    $('#parkingAccountReference').value = metadata.account_reference || '';
    $('#removeParkingConnection').hidden = !record || !['connected', 'action_required'].includes(record.status);
    $('#parkingConnectionModal').classList.add('open');
    setTimeout(() => $('#parkingAccountReference')?.focus(), 0);
  }

  function closeParkingConnection() { $('#parkingConnectionModal')?.classList.remove('open'); }

  async function saveParkingConnection(event) {
    event.preventDefault();
    const button = $('#saveParkingConnection'); button.disabled = true; button.textContent = 'جارٍ الحفظ…';
    try {
      const result = await authorizedRequest('integrations/parking', { method: 'PUT', body: { organization_id: state.org.id, service_provider: $('#parkingProvider').value, account_reference: $('#parkingAccountReference').value.trim() } });
      if (result.integration) {
        const index = state.integrations.findIndex(item => item.provider === 'parking');
        if (index >= 0) state.integrations[index] = result.integration; else state.integrations.push(result.integration);
      }
      closeParkingConnection();
      if (state.selectedPermissionAgentId) await loadPermissionCenter(state.selectedPermissionAgentId, true); else renderPermissions();
      notify(result.message || 'تم حفظ إعداد خدمة المواقف');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'حفظ الإعداد'; }
  }

  async function removeParkingConnection() {
    await disconnectIntegration('parking');
    closeParkingConnection();
  }

  async function saveWebsiteSources(event) {
    event.preventDefault();
    if (PREVIEW_MODE) { notify('نسخة المعاينة لا تحفظ تعديلات.', true); return; }
    const button = $('#saveWebsiteSources');
    const websites = [];
    try {
      for (const row of $$('.website-source-row', $('#websiteSourceRows'))) {
        const name = $('.website-source-name', row).value.trim();
        const rawUrl = $('.website-source-url', row).value.trim();
        if (!rawUrl && !name) continue;
        if (!rawUrl) throw new Error(`أضف رابطاً للموقع «${name || 'غير المسمّى'}»`);
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('استخدم رابط موقع عاماً يبدأ بـ https:// أو http:// من دون بيانات دخول');
        websites.push({ name: name || parsed.hostname.replace(/^www\./i, ''), url: parsed.toString() });
      }
    } catch (error) { notify(error.message === 'Invalid URL' ? 'تحقق من رابط الموقع المضاف' : error.message, true); return; }
    button.disabled = true; button.textContent = 'جارٍ الحفظ…';
    try {
      const result = await authorizedRequest('integrations/websites', { method: 'PUT', body: { organization_id: state.org.id, websites } });
      if (result.integration) {
        const index = state.integrations.findIndex(item => item.provider === 'website');
        if (index >= 0) state.integrations[index] = result.integration;
        else state.integrations.push(result.integration);
      }
      closeWebsiteSources(); renderDashboardIntegrations();
      notify(websites.length ? `تم حفظ ${websites.length} ${websites.length === 1 ? 'موقع' : 'مواقع'} للموظف` : 'تم حذف مواقع الموظف');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'حفظ المواقع'; }
  }

  async function handleDashboardConnection(provider) {
    if (provider === 'website') { openWebsiteSources(); return; }
    const record = state.integrations.find(item => item.provider === provider);
    if (record?.status === 'connected') { await disconnectIntegration(provider); return; }
    const sourceButton = $(`.integration[data-provider="${provider}"] .connect`);
    if (!sourceButton) { showView('integrations'); return; }
    await requestIntegration(sourceButton);
  }

  function dashboardStatRows(kind) {
    if (kind === 'agents') return {
      title: 'الموظفون الأذكياء', view: 'agents', headers: ['الموظف', 'الدور', 'القنوات', 'الحالة'],
      rows: state.agents.map(agent => [agent.name, agent.role || '—', Array.isArray(agent.channels) ? agent.channels.join('، ') || '—' : agent.channels || '—', statusLabel(agent.status)])
    };
    if (kind === 'messages') return {
      title: 'الرسائل المحفوظة', view: 'inbox', headers: ['العميل', 'القناة', 'الرسالة', 'الحالة', 'التاريخ'],
      rows: [...state.messages].reverse().slice(0, 100).map(message => [message.contact_name || message.contact_address || 'عميل', message.channel || '—', message.body || '—', statusLabel(message.send_status), formatDate(message.created_at)])
    };
    if (kind === 'leads') return {
      title: 'العملاء المحتملون', view: 'leads', headers: ['العميل', 'الخدمة', 'المصدر', 'الحالة', 'الإجراء التالي'],
      rows: state.leads.map(lead => [lead.name, lead.service || '—', lead.source || '—', statusLabel(lead.status), lead.next_action || '—'])
    };
    return {
      title: 'طلبات الموافقة', view: 'approvals', headers: ['الطلب', 'التفاصيل', 'الحالة', 'التاريخ'],
      rows: state.approvals.filter(item => item.status === 'pending').map(item => [item.title, item.summary || '—', statusLabel(item.status), formatDate(item.created_at)])
    };
  }

  function openDashboardStat(kind) {
    const panel = $('#dashboardStatPanel'), list = $('#dashboardStatList');
    if (!panel || !list) return;
    const data = dashboardStatRows(kind);
    $('#dashboardStatTitle').textContent = data.title;
    $('#dashboardStatViewAll').dataset.view = data.view;
    list.innerHTML = data.rows.length
      ? `<table class="table"><thead><tr>${data.headers.map(header => `<th>${safe(header)}</th>`).join('')}</tr></thead><tbody>${data.rows.map(row => `<tr>${row.map(value => `<td>${safe(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : `<div class="empty-state"><b>لا توجد بيانات بعد</b>ستظهر العناصر هنا فور إضافتها أو وصولها.</div>`;
    panel.hidden = false;
    $$('.dashboard-stat-card').forEach(card => card.setAttribute('aria-expanded', String(card.dataset.dashboardStat === kind)));
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function dashboardResearchLines(text) {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const listed = lines.filter(line => /^(?:[-•*]|\d{1,3}[.)-])\s+/.test(line));
    return (listed.length ? listed : lines.slice(0, 1)).slice(0, 150).map(line => line.replace(/^(?:[-•*]|\d{1,3}[.)-])\s+/, '').trim()).filter(Boolean);
  }

  function dashboardResultRows() {
    const rows = [];
    const selectedAgent = state.agents.find(agent => agent.id === state.employeeChatAgentId);
    for (let index = 0; index < state.employeeChatMessages.length; index += 1) {
      const message = state.employeeChatMessages[index];
      if (message.role !== 'assistant') continue;
      const metadata = message.metadata && typeof message.metadata === 'object' ? message.metadata : {};
      const sources = Array.isArray(metadata.sources) ? metadata.sources.filter(source => source?.url) : [];
      const previous = [...state.employeeChatMessages.slice(0, index)].reverse().find(item => item.role === 'user');
      const researchRequest = /(?:ابحث|بحث|شرك|فرص|تقرير|مصادر|research|companies|opportunit|report|find)/iu.test(String(previous?.body || ''));
      if (!sources.length && message.kind !== 'report' && !researchRequest) continue;
      const lines = dashboardResearchLines(message.display_body || message.body);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const detail = lines[lineIndex];
        const source = sources[lineIndex] || (sources.length === 1 ? sources[0] : null);
        const title = detail.split(/\s[-–—:|]\s|:/, 1)[0].slice(0, 120) || `نتيجة ${lineIndex + 1}`;
        rows.push({ title, subtitle: message.kind === 'report' ? 'تقرير' : 'نتيجة بحث', detail, source, agent: selectedAgent?.name || 'الموظف الذكي', date: message.created_at, status: 'محفوظة' });
      }
    }
    for (const task of state.tasks) {
      if (!String(task.output || '').trim()) continue;
      const agent = state.agents.find(item => item.id === task.agent_id);
      rows.push({ title: task.title || 'نتيجة مهمة', subtitle: 'مهمة', detail: task.output, source: null, agent: agent?.name || 'بدون تعيين', date: task.completed_at || task.updated_at || task.created_at, status: statusLabel(task.status) });
    }
    return rows.sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)).slice(0, 200);
  }

  function renderDashboardResults() {
    const body = $('#dashboardResultsBody');
    if (!body) return;
    const rows = dashboardResultRows();
    body.innerHTML = rows.length ? rows.map(row => {
      const source = row.source?.url ? `<a href="${safe(row.source.url)}" target="_blank" rel="noopener noreferrer">${safe(row.source.title || row.source.url)}</a>` : '—';
      return `<tr><td class="dashboard-result-title"><b>${safe(row.title)}</b><span>${safe(row.subtitle)}</span></td><td class="dashboard-result-details"><details><summary>عرض التفاصيل</summary><div>${safe(row.detail)}</div></details></td><td class="dashboard-result-source">${source}</td><td>${safe(row.agent)}</td><td><span class="status qualified">${safe(row.status)}</span><br><small>${safe(formatDate(row.date))}</small></td></tr>`;
    }).join('') : '<tr><td colspan="5"><div class="empty-state"><b>لا توجد نتائج بعد</b>اطلب من الموظف بحثاً أو تقريراً، وستظهر التفاصيل هنا.</div></td></tr>';
  }

  function renderDashboard() {
    const agentCount = $('#dashboardAgentCount'), messageCount = $('#dashboardMessageCount'), leadCount = $('#dashboardLeadCount'), approvalCount = $('#dashboardApprovalCount');
    if (agentCount) agentCount.textContent = state.agents.length.toLocaleString(currentLocale());
    if (messageCount) messageCount.textContent = state.messages.length.toLocaleString(currentLocale());
    if (leadCount) leadCount.textContent = state.leads.filter(lead => ['new', 'qualified', 'follow_up'].includes(lead.status)).length.toLocaleString(currentLocale());
    if (approvalCount) approvalCount.textContent = state.approvals.filter(item => item.status === 'pending').length.toLocaleString(currentLocale());
    renderDashboardIntegrations();
    renderDashboardResults();
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

  function commandStatus(message, stateName = 'success') {
    const result = $('#commandResult');
    if (!result) return;
    result.dataset.state = message ? stateName : 'idle';
    result.textContent = message || '';
  }

  function customerSafeChatText(value) {
    const message = String(value || '');
    if (/(?:NO_CREDITS|QUOTA_EXHAUSTED|insufficient_quota|مزود الذكاء متوقف|الحصة الحالية منتهية|حصة\s+[^\n]*API\s+الحالية\s+منتهية|رصيد\s+[^\n]*API\s+منته|فعّل الفوترة|انتظر تجدد الحصة|https?:\/\/\S*(?:rate-limit|billing))/iu.test(message)) {
      return 'الموظف الذكي غير متاح مؤقتاً. لم يتم إرسال أو تنفيذ أي شيء؛ حاول مرة أخرى بعد قليل.';
    }
    return message;
  }

  function customerSafeChatError(error) {
    const message = String(error?.message || error || '');
    if (!message || /(?:Cannot (?:set|read) properties|TypeError|undefined|null|Failed to fetch|NetworkError)/i.test(message)) {
      return 'تعذر تحميل المحادثة مؤقتاً. حدّث الصفحة وحاول مرة ثانية.';
    }
    return customerSafeChatText(message);
  }

  function renderChatSources(bubble, sources) {
    if (!Array.isArray(sources) || !sources.length) return;
    const unique = new Map();
    for (const source of sources) {
      const url = String(source?.url || '').trim();
      if (!/^https?:\/\//i.test(url) || /(?:rate-limit|\/billing(?:\/|$))/i.test(url) || unique.has(url)) continue;
      unique.set(url, String(source?.title || '').trim() || url);
    }
    if (!unique.size) return;
    const nav = document.createElement('nav');
    nav.className = 'employee-chat-sources';
    const title = document.createElement('span');
    title.textContent = 'المصادر:';
    nav.append(title);
    for (const [url, label] of [...unique].slice(0, 8)) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label;
      nav.append(link);
    }
    bubble.append(nav);
  }

  function employeeChatPreferenceKey(name) { return `varex-ai-employee-chat-${name}-${state.org?.id || 'default'}`; }

  function renderEmployeeChatAgentOptions() {
    const select = $('#employeeChatAgent');
    if (!select) return;
    const previous = state.employeeChatAgentId || localStorage.getItem(employeeChatPreferenceKey('agent')) || '';
    select.replaceChildren();
    for (const agent of state.agents) {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = `${agent.name} — ${agent.role || 'موظف ذكي'}${agent.status === 'active' ? '' : ' (متوقف)'}`;
      select.append(option);
    }
    const selected = state.agents.some(agent => agent.id === previous) ? previous : (agentForExecution()?.id || '');
    state.employeeChatAgentId = selected;
    select.value = selected;
    if (!state.agents.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'أنشئ موظفاً ذكياً أولاً';
      select.append(option);
    }
  }

  function renderEmployeeChat() {
    const list = $('#employeeChatMessages');
    if (!list) return;
    list.replaceChildren();
    if (!state.employeeChatMessages.length) {
      const empty = document.createElement('div');
      empty.className = 'employee-chat-empty';
      empty.innerHTML = '<b>بداية المحادثة</b><br>يمكن كتابة الرسالة أو استخدام الميكروفون.';
      list.append(empty);
    }
    for (const message of state.employeeChatMessages) {
      const bubble = document.createElement('article');
      const kind = String(message.kind || 'text');
      bubble.className = `employee-chat-bubble ${message.role === 'user' ? 'user' : 'assistant'}${kind === 'error' ? ' error' : ''}${['action', 'approval', 'report'].includes(kind) ? ' action' : ''}`;
      const body = document.createElement('div');
      const displayBody = customerSafeChatText(message.display_body || message.body || '');
      body.textContent = displayBody;
      bubble.append(body);
      if (message.role === 'assistant') renderChatSources(bubble, message.metadata?.sources);
      const meta = document.createElement('div');
      meta.className = 'employee-chat-meta';
      const status = message.execution?.status;
      const details = [message.role === 'assistant' ? 'VAREX AI' : 'أنت', status ? statusLabel(status) : '', message.created_at ? formatDate(message.created_at) : ''].filter(Boolean);
      const label = document.createElement('span');
      label.textContent = details.join(' • ');
      meta.append(label);
      if (message.role === 'assistant' && kind !== 'error' && message.metadata?.speak !== false && String(message.body || '').trim()) {
        const speak = document.createElement('button');
        speak.type = 'button';
        speak.textContent = '🔊 استمع';
        speak.addEventListener('click', () => void speakEmployeeChat(displayBody, true));
        meta.append(speak);
      }
      bubble.append(meta);
      if (message.execution?.status === 'awaiting_approval' && (!message.execution.approval_status || message.execution.approval_status === 'pending')) {
        const actions = document.createElement('div');
        actions.className = 'employee-chat-approval';
        const approve = document.createElement('button'); approve.type = 'button'; approve.className = 'btn btn-success'; approve.textContent = 'موافقة وتنفيذ';
        const reject = document.createElement('button'); reject.type = 'button'; reject.className = 'btn btn-danger'; reject.textContent = 'رفض';
        approve.addEventListener('click', () => void decideEmployeeChat(message.execution.id, 'approved'));
        reject.addEventListener('click', () => void decideEmployeeChat(message.execution.id, 'rejected'));
        actions.append(approve, reject); bubble.append(actions);
      }
      list.append(bubble);
    }
    if (state.employeeChatThinking) {
      const typing = document.createElement('div');
      typing.className = 'employee-chat-bubble assistant employee-chat-typing';
      typing.setAttribute('role', 'status');
      typing.setAttribute('aria-label', 'الموظف يكتب الآن');
      typing.innerHTML = '<i></i><i></i><i></i>';
      list.append(typing);
    }
    list.scrollTop = list.scrollHeight;
  }

  async function loadEmployeeChat() {
    const agentId = state.employeeChatAgentId;
    if (!state.org?.id || !agentId || PREVIEW_MODE) { renderEmployeeChat(); renderDashboardResults(); return; }
    const params = new URLSearchParams({ organization_id: state.org.id, agent_id: agentId, limit: '120' });
    const result = await authorizedRequest(`chat/messages?${params}`);
    state.employeeChatMessages = Array.isArray(result.messages) ? result.messages : [];
    renderEmployeeChat();
    renderDashboardResults();
  }

  async function sendEmployeeChat(event) {
    event?.preventDefault();
    const input = $('#commandInput'), send = $('#employeeChatSend');
    const body = input.value.trim(), agentId = state.employeeChatAgentId;
    if (!body) { commandStatus('اكتب رسالة أو اضغط زر التسجيل الصوتي.', 'error'); return; }
    if (!agentId) { commandStatus('أنشئ موظفاً ذكياً واختره أولاً.', 'error'); return; }
    if (PREVIEW_MODE) { notify('نسخة المعاينة لا تنفّذ أو تحفظ المحادثات.', true); return; }
    const clientMessageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const inputMode = state.employeeChatInputMode;
    state.employeeChatInputMode = 'text';
    state.employeeChatMessages.push({ id: `pending-${clientMessageId}`, role: 'user', body, kind: inputMode, created_at: new Date().toISOString(), metadata: {} });
    state.employeeChatThinking = true;
    renderEmployeeChat(); input.value = ''; send.disabled = true; commandStatus('');
    try {
      const result = await authorizedRequest('chat/messages', { method: 'POST', body: { organization_id: state.org.id, agent_id: agentId, body, input_mode: inputMode, client_message_id: clientMessageId } });
      state.employeeChatThinking = false;
      await loadEmployeeChat();
      const returned = Array.isArray(result.messages) ? result.messages : [];
      const assistant = [...returned].reverse().find(message => message.role === 'assistant');
      commandStatus(assistant?.execution?.status === 'awaiting_approval' ? 'الأمر بانتظار موافقتك داخل المحادثة.' : '');
      if (assistant && assistant.kind !== 'error' && assistant.metadata?.speak !== false && state.employeeChatVoiceEnabled) void speakEmployeeChat(customerSafeChatText(assistant.display_body || assistant.body || ''), false);
    } catch (error) {
      state.employeeChatThinking = false;
      await loadEmployeeChat().catch(() => {});
      commandStatus(customerSafeChatError(error), 'error');
    } finally { state.employeeChatThinking = false; renderEmployeeChat(); send.disabled = false; input.focus(); }
  }

  async function decideEmployeeChat(executionId, decision) {
    commandStatus(decision === 'approved' ? 'جارٍ تنفيذ العملية بعد موافقتك…' : 'جارٍ رفض العملية…', 'working');
    try {
      const result = await authorizedRequest(`chat/actions/${encodeURIComponent(executionId)}/decision`, { method: 'POST', body: { organization_id: state.org.id, agent_id: state.employeeChatAgentId, decision } });
      await loadEmployeeChat();
      commandStatus(result.message || (decision === 'approved' ? 'تمت معالجة العملية.' : 'تم الرفض ولم يُنفّذ شيء.'), 'success');
    } catch (error) { commandStatus(customerSafeChatError(error), 'error'); }
  }

  function employeeVoiceOption(voiceId = state.employeeChatVoiceId) {
    return employeeVoiceCatalog.find(item => item.id === voiceId) || employeeVoiceCatalog[0];
  }

  function renderEmployeeVoiceUi() {
    const voice = employeeVoiceOption();
    const select = $('#employeeChatVoice');
    if (select) select.value = voice.id;
    const label = $('#employeeChatVoiceLabel');
    if (label) label.textContent = `${voice.name} — ${voice.style}`;
    const choices = $('#employeeVoiceChoices');
    if (choices) {
      choices.innerHTML = employeeVoiceCatalog.map(item => `<button class="voice-choice ${item.id === voice.id ? 'active' : ''}" type="button" data-employee-voice="${safe(item.id)}" aria-pressed="${String(item.id === voice.id)}"><span class="voice-choice-icon">${safe(item.icon)}</span><span><b>${safe(item.name)}</b><small>${safe(item.style)}</small></span><span class="voice-choice-check">✓</span></button>`).join('');
      $$('[data-employee-voice]', choices).forEach(button => button.addEventListener('click', () => void saveEmployeeVoice(button.dataset.employeeVoice)));
    }
  }

  function openEmployeeVoicePicker() {
    if (!state.employeeChatAgentId) { notify('اختر الموظف الذكي أولاً', true); return; }
    const agent = state.agents.find(item => item.id === state.employeeChatAgentId);
    $('#employeeVoiceSubtitle').textContent = `اختر صوت ${agent?.name || 'الموظف'} واضغط معاينة لسماعه قبل إغلاق النافذة.`;
    renderEmployeeVoiceUi();
    $('#employeeVoiceModal').classList.add('open');
  }

  function closeEmployeeVoicePicker() { $('#employeeVoiceModal')?.classList.remove('open'); }

  async function loadEmployeeVoice() {
    const agentId = state.employeeChatAgentId;
    if (!agentId) { state.employeeChatVoiceId = 'Sulafat'; renderEmployeeVoiceUi(); return; }
    const fallback = localStorage.getItem(employeeChatPreferenceKey(`voice-${agentId}`)) || 'Sulafat';
    if (PREVIEW_MODE || !state.session?.access_token || !state.org?.id) { state.employeeChatVoiceId = fallback; renderEmployeeVoiceUi(); return; }
    try {
      const result = await authorizedRequest(`chat/voice?organization_id=${encodeURIComponent(state.org.id)}&agent_id=${encodeURIComponent(agentId)}`);
      state.employeeChatVoiceId = result.voice_id || fallback;
    } catch (_) { state.employeeChatVoiceId = fallback; }
    renderEmployeeVoiceUi();
  }

  async function saveEmployeeVoice(voiceId) {
    const option = employeeVoiceOption(voiceId), previous = state.employeeChatVoiceId;
    if (!state.employeeChatAgentId) { notify('اختر الموظف الذكي أولاً', true); return; }
    state.employeeChatVoiceId = option.id;
    renderEmployeeVoiceUi();
    localStorage.setItem(employeeChatPreferenceKey(`voice-${state.employeeChatAgentId}`), option.id);
    if (PREVIEW_MODE) { notify('تم اختيار الصوت في المعاينة؛ لا تُحفظ تغييرات المعاينة.'); return; }
    try {
      const result = await authorizedRequest('chat/voice', { method: 'PUT', body: { organization_id: state.org.id, agent_id: state.employeeChatAgentId, voice_id: option.id } });
      state.employeeChatVoiceId = result.voice_id || option.id;
      if (state.selectedPermissionAgentId === state.employeeChatAgentId && state.voiceSettings) state.voiceSettings.voice_id = state.employeeChatVoiceId;
      renderEmployeeVoiceUi();
      notify(`تم حفظ صوت ${option.name} لهذا الموظف`);
    } catch (error) {
      state.employeeChatVoiceId = previous; renderEmployeeVoiceUi(); notify(error.message, true);
    }
  }

  function previewEmployeeVoice() {
    const agent = state.agents.find(item => item.id === state.employeeChatAgentId);
    void speakEmployeeChat(`مرحباً، أنا ${agent?.name || 'موظفك الذكي'}. هذا هو الصوت الذي اخترته لي.`, true);
  }

  async function speakEmployeeChat(text, manual = false) {
    if (!text.trim() || !state.employeeChatAgentId) return;
    try {
      if (state.employeeChatAudio) { state.employeeChatAudio.pause(); URL.revokeObjectURL(state.employeeChatAudio.src); }
      const blob = await authorizedBinaryRequest('chat/speech', { body: { organization_id: state.org.id, agent_id: state.employeeChatAgentId, text, voice: state.employeeChatVoiceId || 'Sulafat' } });
      const audio = new Audio(URL.createObjectURL(blob));
      state.employeeChatAudio = audio;
      audio.addEventListener('ended', () => { URL.revokeObjectURL(audio.src); if (state.employeeChatAudio === audio) state.employeeChatAudio = null; }, { once: true });
      await audio.play();
    } catch (error) {
      if (manual) notify(error.message, true);
    }
  }

  function toggleEmployeeChatVoice() {
    state.employeeChatVoiceEnabled = !state.employeeChatVoiceEnabled;
    localStorage.setItem(employeeChatPreferenceKey('voice-enabled'), state.employeeChatVoiceEnabled ? '1' : '0');
    const button = $('#employeeChatVoiceToggle');
    button.textContent = state.employeeChatVoiceEnabled ? '🔊' : '🔇';
    button.setAttribute('aria-pressed', String(state.employeeChatVoiceEnabled));
    button.setAttribute('aria-label', state.employeeChatVoiceEnabled ? 'إيقاف قراءة الردود صوتياً' : 'تشغيل قراءة الردود صوتياً');
  }

  function startEmployeeVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { notify('التسجيل الصوتي غير مدعوم في هذا المتصفح. استخدم تطبيق VAREX الأصلي أو متصفحاً حديثاً يدعم الميكروفون.', true); return; }
    if (state.employeeChatRecognition) { state.employeeChatRecognition.stop(); return; }
    const recognition = new Recognition();
    state.employeeChatRecognition = recognition;
    recognition.lang = currentLocale().startsWith('ar') ? 'ar-AE' : currentLocale();
    recognition.interimResults = true; recognition.continuous = false;
    const button = $('#employeeChatMic'); button.textContent = '⏹'; button.classList.add('btn-danger');
    recognition.onresult = event => {
      const transcript = [...event.results].map(result => result[0]?.transcript || '').join(' ').trim();
      if (transcript) $('#commandInput').value = transcript;
      if (event.results[event.results.length - 1]?.isFinal && transcript) { state.employeeChatInputMode = 'voice'; recognition.stop(); void sendEmployeeChat(); }
    };
    recognition.onerror = event => { if (event.error !== 'aborted') notify('تعذر فهم التسجيل الصوتي. جرّب مرة ثانية.', true); };
    recognition.onend = () => { state.employeeChatRecognition = null; button.textContent = '🎙'; button.classList.remove('btn-danger'); };
    recognition.start(); commandStatus('أنا أسمعك الآن…', 'working');
  }

  async function initializeEmployeeChat() {
    renderEmployeeChatAgentOptions();
    state.employeeChatVoiceEnabled = localStorage.getItem(employeeChatPreferenceKey('voice-enabled')) !== '0';
    const voiceButton = $('#employeeChatVoiceToggle');
    if (voiceButton) { voiceButton.textContent = state.employeeChatVoiceEnabled ? '🔊' : '🔇'; voiceButton.setAttribute('aria-pressed', String(state.employeeChatVoiceEnabled)); }
    await loadEmployeeVoice();
    await loadEmployeeChat();
  }

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
      permissions: ['الصلاحيات', 'صلاحيات التطبيقات', 'permissions', 'app permissions'],
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

  function agentForExecution(preferredId = '') {
    return state.agents.find(agent => agent.id === preferredId)
      || state.agents.find(agent => agent.id === state.selectedPermissionAgentId)
      || state.agents.find(agent => agent.status === 'active')
      || state.agents[0]
      || null;
  }

  function actionRequestFromCommand(parsed) {
    if (parsed.type === 'whatsappSend') {
      if (!parsed.target) throw new Error('اكتب اسم المستلم أو رقمه. مثال: أرسل واتساب إلى +971...: نص الرسالة');
      if (!parsed.message) throw new Error('اكتب نص الرسالة بعد النقطتين أو بعد علامة |؛ لم يتم إرسال أي شيء.');
      return { app_key: 'whatsapp', action_key: 'send', target: parsed.target, payload: { message: parsed.message } };
    }
    if (parsed.type === 'phoneCall') {
      if (!parsed.target) throw new Error('اكتب الاسم أو الرقم بعد كلمة اتصل؛ لم يبدأ أي اتصال.');
      if (!parsed.instructions) throw new Error('اكتب هدف المكالمة أيضاً. مثال: اتصل بفلان وحدد معه موعداً واسأله عن السعر.');
      return { app_key: 'voice', action_key: 'speak_on_behalf', target: parsed.target, payload: { purpose: parsed.instructions, message: parsed.instructions } };
    }
    if (parsed.type === 'agentAction') {
      return { app_key: parsed.appKey, action_key: parsed.actionKey, target: parsed.target || '', payload: parsed.payload || {} };
    }
    return null;
  }

  async function submitAgentAction(parsed, { taskId = null, agentId = '', forceApproval = false } = {}) {
    const request = actionRequestFromCommand(parsed);
    if (!request) throw new Error('تعليمات المهمة ليست بصيغة عملية قابلة للتنفيذ. استخدم مثلاً: أرسل واتساب إلى +971...: نص الرسالة');
    const agent = agentForExecution(agentId);
    if (!agent) throw new Error('أنشئ موظفاً ذكياً وحدده للمهمة أولاً؛ لم يتم تنفيذ أي شيء.');
    const directOwnerVoice = !taskId && !forceApproval && request.app_key === 'voice' && request.action_key === 'speak_on_behalf';
    try {
      const result = await authorizedRequest('actions/execute', { method: 'POST', body: { organization_id: state.org.id, agent_id: agent.id, task_id: taskId, force_approval: forceApproval, direct_owner_command: directOwnerVoice, ...request } });
      if (result.execution) state.actionExecutions.unshift(result.execution);
      if (result.approval_id) state.approvals = await rest('ai_approvals', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      return result;
    } catch (error) {
      if (state.session?.access_token) {
        state.actionExecutions = await rest('ai_action_executions', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc&limit=100` }).catch(() => state.actionExecutions);
      }
      throw error;
    } finally {
      renderPermissions(); renderApprovals();
    }
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
      if (parsed.type === 'whatsappSend' || parsed.type === 'phoneCall' || parsed.type === 'agentAction') {
        const result = await submitAgentAction(parsed);
        commandStatus(result.message || 'تم إرسال العملية إلى محرك التنفيذ.', result.code === 'APPROVAL_REQUIRED' ? 'working' : 'success');
        if (result.code === 'APPROVAL_REQUIRED') notify('العملية بانتظار موافقتك في مركز الموافقات');
        return;
      }
      if (parsed.type === 'print') { window.print(); commandStatus(t('command.printed', 'تم فتح نافذة الطباعة.')); await audit('command_print_opened', 'workspace', state.org.id); return; }
      if (parsed.type === 'copy') { if (!parsed.text) throw new Error(t('command.missingCopy', 'اكتب النص بعد كلمة انسخ.')); await copyText(parsed.text); commandStatus(t('command.copied', 'تم نسخ النص فعلياً.')); return; }
      if (parsed.type === 'paste') { await pasteIntoCommand(); return; }
      if (parsed.type === 'integrations') { showView('integrations'); await refreshIntegrationReadiness(); renderIntegrations(); commandStatus(t('command.gatewayChecked', 'تم تحديث حالة البوابات.')); return; }
      if (parsed.type === 'open') { const target = commandTarget(parsed.target); if (!target) throw new Error('لم أجد صفحة بهذا الاسم. الصفحات المتاحة تشمل: المهام، الصلاحيات، الرسائل، الموافقات، والربط.'); showView(target); commandStatus(t('command.success', 'تم تنفيذ الأمر بنجاح.')); return; }
      if (parsed.type === 'logout') { commandStatus(t('command.success', 'تم تنفيذ الأمر بنجاح.')); await logout(false); return; }
      throw new Error('لم أتعرف على عملية قابلة للتنفيذ من هذا النص. المتاح الآن من مربع الأوامر: إرسال واتساب، بدء اتصال، إنشاء موظف أو عميل، فتح صفحة، الطباعة والنسخ. لم يتم تنفيذ أي شيء.');
    } catch (error) { commandStatus(error.message, 'error'); }
  }

  function renderAll() { renderAgents(); renderPermissions(); renderTasks(); renderLeads(); renderApprovals(); renderKnowledge(); renderInbox(); renderIntegrations(); renderBilling(); renderDashboard(); renderReports(); renderNotifications(); renderEmployeeChatAgentOptions(); renderEmployeeChat(); }

  function previewDate(daysAgo = 0, hour = 10) {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }

  function seedPreviewWorkspace() {
    state.session = null;
    state.user = { id: 'preview-user', email: 'preview@varexapp.com', user_metadata: { full_name: 'نسخة المعاينة' } };
    state.org = {
      id: 'preview-org', name: 'شركة VAREX التجريبية', industry: 'خدمات وأعمال', timezone: 'Asia/Dubai',
      ui_language: currentLocale(), ui_theme: 'navy', requires_price_approval: true, audit_enabled: true,
      auto_publish: false, vat_enabled: false, legal_name: '', trn: '', billing_email: 'preview@varexapp.com'
    };
    state.member = { organization_id: 'preview-org', role: 'owner' };
    state.subscriptions = [{
      id: 'preview-subscription', organization_id: 'preview-org', plan_code: 'team3', status: 'active',
      monthly_task_limit: 10000, agent_limit: 3, billing_cycle: 'monthly', payment_method: 'نسخة المعاينة',
      starts_at: previewDate(20), renews_at: new Date(Date.now() + 30 * 86400000).toISOString(), created_at: previewDate(20)
    }];
    state.agents = [
      { id: 'preview-agent-sales', name: 'Lina AI', role: 'موظفة مبيعات', language: 'العربية', channels: ['WhatsApp', 'Instagram'], status: 'active' },
      { id: 'preview-agent-support', name: 'Noor AI', role: 'خدمة العملاء', language: 'العربية والإنجليزية', channels: ['WhatsApp', 'Facebook'], status: 'active' },
      { id: 'preview-agent-marketing', name: 'Rami AI', role: 'موظف تسويق', language: 'العربية', channels: ['Instagram', 'TikTok'], status: 'paused' }
    ];
    state.tasks = [
      { id: 'preview-task-1', agent_id: 'preview-agent-sales', title: 'متابعة العملاء الجدد', instructions: 'تصنيف الاستفسارات وتجهيز الردود للمراجعة قبل الإرسال.', priority: 'high', status: 'completed', requires_approval: true, created_at: previewDate(1) },
      { id: 'preview-task-2', agent_id: 'preview-agent-marketing', title: 'إعداد خطة محتوى أسبوعية', instructions: 'اقتراح أفكار منشورات متوافقة مع هوية الشركة.', priority: 'medium', status: 'awaiting_approval', requires_approval: true, created_at: previewDate(0, 9) },
      { id: 'preview-task-3', agent_id: 'preview-agent-support', title: 'تنظيم أسئلة العملاء المتكررة', instructions: 'تلخيص أكثر الأسئلة تكراراً وإضافتها إلى قاعدة المعرفة.', priority: 'medium', status: 'running', requires_approval: false, created_at: previewDate(2) }
    ];
    state.leads = [
      { id: 'preview-lead-1', name: 'شركة الأفق', service: 'موظف مبيعات ذكي', source: 'WhatsApp', status: 'qualified', priority: 'high', score: 86, next_action: 'مراجعة العرض', created_at: previewDate(1), updated_at: previewDate(0, 11) },
      { id: 'preview-lead-2', name: 'متجر سارة', service: 'خدمة العملاء', source: 'Instagram', status: 'follow_up', priority: 'medium', score: 72, next_action: 'اتصال متابعة', created_at: previewDate(3), updated_at: previewDate(1) },
      { id: 'preview-lead-3', name: 'مجموعة المدار', service: 'أتمتة التسويق', source: 'Facebook', status: 'new', priority: 'medium', score: 61, next_action: 'جمع المتطلبات', created_at: previewDate(0, 8), updated_at: previewDate(0, 8) }
    ];
    state.approvals = [
      { id: 'preview-approval-1', task_id: 'preview-task-2', title: 'اعتماد خطة المحتوى الأسبوعية', summary: 'مراجعة المقترحات قبل جدولتها على قنوات التواصل.', status: 'pending', created_at: previewDate(0, 10) },
      { id: 'preview-approval-2', task_id: 'preview-task-1', title: 'اعتماد عرض شركة الأفق', summary: 'تمت مراجعة العرض وحفظه كنموذج تجريبي.', status: 'approved', created_at: previewDate(2) }
    ];
    state.integrations = [
      { id: 'preview-integration-wa', provider: 'whatsapp', status: 'connected', connected_account: 'رقم تجريبي •••• 8855' },
      { id: 'preview-integration-ig', provider: 'instagram', status: 'connected', connected_account: 'varex.preview' },
      { id: 'preview-integration-fb', provider: 'facebook', status: 'connected', connected_account: 'VAREX Preview' },
      { id: 'preview-integration-tt', provider: 'tiktok', status: 'connected', connected_account: '@varex.preview' }
    ];
    state.integrationReadiness = {
      whatsapp: { configured: true }, instagram: { configured: true }, facebook: { configured: true }, tiktok: { configured: true }
    };
    state.messages = [
      { id: 'preview-message-1', contact_name: 'شركة الأفق', contact_address: '+971500000001', channel: 'whatsapp', direction: 'inbound', body: 'مرحباً، نرغب بمعرفة تفاصيل الموظف الذكي للمبيعات.', send_status: 'received', created_at: previewDate(1, 9) },
      { id: 'preview-message-2', contact_name: 'شركة الأفق', contact_address: '+971500000001', channel: 'whatsapp', direction: 'outbound', body: 'أهلاً بكم، جهّزنا ملخصاً للخدمة وسيعرضه الفريق للموافقة.', send_status: 'sent', created_at: previewDate(1, 10) },
      { id: 'preview-message-3', contact_name: 'متجر سارة', contact_address: '@sara.preview', channel: 'instagram', direction: 'inbound', body: 'هل يستطيع الموظف الرد بالعربية والإنجليزية؟', send_status: 'received', created_at: previewDate(0, 12) }
    ];
    state.knowledge = [
      { id: 'preview-knowledge-1', title: 'دليل خدمات الشركة.pdf', file_size: 842000, status: 'stored', created_at: previewDate(5) },
      { id: 'preview-knowledge-2', title: 'سياسة الرد على العملاء.docx', file_size: 164000, status: 'stored', created_at: previewDate(3) }
    ];
    state.adminSubscriptions = [];
    state.activationCodes = [];
    state.paypalStatus = null;
  }

  function previewControlAllowed(element) {
    return Boolean(element.closest(
      '.nav-btn[data-view], [data-view-jump], .dashboard-stat-card, #dashboardStatClose, #dashboardStatViewAll, #menuBtn, #overlay, .profile, [data-action="search"], [data-action="notifications"], #closeSearchModal, #closeNotificationsModal, .notification-item, .result-item, .chat-item'
    ));
  }

  function lockPreviewControls() {
    const browseInputs = new Set(['globalSearchInput', 'chatSearch', 'leadSearch']);
    $$('button,input,textarea,select').forEach(control => {
      const allowed = previewControlAllowed(control) || browseInputs.has(control.id) || control.matches('#leads .select,#approvals .select');
      if (!allowed) {
        control.disabled = true;
        control.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function guardPreviewActions() {
    const readOnlyMessage = 'نسخة المعاينة للعرض فقط — لا يتم تنفيذ أي إجراء أو حفظ أي بيانات.';
    document.addEventListener('submit', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify(readOnlyMessage);
    }, true);
    document.addEventListener('click', event => {
      const control = event.target instanceof Element ? event.target.closest('button,a[href]') : null;
      if (!control) return;
      if (previewControlAllowed(control)) {
        queueMicrotask(lockPreviewControls);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      notify(readOnlyMessage);
    }, true);
  }

  function enterPreviewMode() {
    seedPreviewWorkspace();
    document.body.classList.add('preview-mode');
    prepareSettingsUI();
    applyTheme('navy', false);
    $('.workspace-pill span:last-child').textContent = 'مساحة معاينة VAREX AI';
    $('.profile-text strong').textContent = 'نسخة المعاينة';
    $('.profile-text span').textContent = 'للعرض فقط';
    $('.avatar').textContent = 'م';
    $('#companyName').value = state.org.name;
    $('#companyIndustry').value = state.org.industry;
    $('#companyTimezone').value = 'دبي (GMT+4)';
    $('#settingsLanguage').value = currentLocale();
    $('#legalName').value = '';
    $('#trn').value = '';
    $('#billingEmail').value = state.org.billing_email;
    $('#priceApprovalToggle').classList.add('on');
    $('#auditToggle').classList.add('on');
    $('#autoPublishToggle').classList.remove('on');
    $('#vatToggle').classList.remove('on');
    $('#taxFields').classList.add('disabled');
    $('#activeThemeName').textContent = themes.navy.name;
    renderAccountSecurity();
    applySubscriptionGate();
    renderAll();
    const banner = $('#systemBanner');
    banner?.classList.add('preview-banner');
    if (banner) banner.innerHTML = '<b>👁</b><span>نسخة معاينة فقط — يمكنك التنقل بين الأقسام، لكن لا يتم تنفيذ أي إجراء أو حفظ أي بيانات.</span>';
    $('#sidebarPlan').textContent = 'معاينة فقط';
    $('#sidebarUsagePercent').textContent = 'عرض';
    $('#sidebarUsageBar').style.width = '0';
    $('#sidebarUsageText').textContent = 'لا يتم حفظ أي بيانات';
    $('#authGate').classList.add('hidden');
    document.body.classList.remove('auth-pending');
    guardPreviewActions();
    lockPreviewControls();
    showView('dashboard', false);
  }

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
    await handlePayPalReturn();
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
    $('.profile-text strong').textContent = state.user.user_metadata?.full_name || state.user.email.split('@')[0];
    $('.profile-text span').textContent = isDeveloperAccount() ? 'صلاحية كاملة' : state.member?.role === 'owner' ? 'إدارة الحساب' : 'عضو الفريق';
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
    renderAccountSecurity();
    applySubscriptionGate();
    renderAll();
    $('#authGate').classList.add('hidden');
    document.body.classList.remove('auth-pending');
    if (isDeveloperAccount()) {
      void refreshMetaAdminStatus();
      void loadDeveloperSubscriptions().catch(error => notify(error.message, true));
      void refreshPayPalAdminStatus();
      void refreshActivationCodeStats();
    }
    showView(subscriptionLocked() ? 'billing' : location.hash.slice(1) || 'dashboard', false);
    if (!subscriptionLocked()) {
      void refreshIntegrationReadiness().catch(() => {
        state.integrationReadiness = {};
        renderIntegrations();
      });
      void initializeEmployeeChat().catch(error => commandStatus(customerSafeChatError(error), 'error'));
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
      notify(isDeveloperAccount() ? 'تم تجهيز حساب المالك' : 'تم إنشاء مساحة شركتك؛ اختر باقة أو أدخل كود التفعيل');
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

  async function changePassword(event) {
    event.preventDefault();
    const currentPassword = $('#settingsCurrentPassword').value;
    const newPassword = $('#settingsNewPassword').value;
    const confirmation = $('#settingsNewPasswordConfirm').value;
    const errorBox = $('#settingsPasswordError');
    showError(errorBox, '');
    if (!isStrongPassword(newPassword)) { showError(errorBox, passwordMessage()); return; }
    if (newPassword !== confirmation) { showError(errorBox, 'تأكيد كلمة المرور الجديدة غير مطابق.'); return; }
    const button = $('#changePasswordButton');
    button.disabled = true; button.textContent = 'جارٍ تغيير كلمة المرور...';
    try {
      const email = state.user.email;
      const response = await accountRequest('change-password', { current_password: currentPassword, new_password: newPassword });
      saveSession(null);
      $('#changePasswordForm').reset();
      $('#authGate').classList.remove('hidden'); document.body.classList.add('auth-pending');
      showAuthPanel('authStage'); setAuthMode('login'); $('#authEmail').value = email; $('#authPassword').value = '';
      notify(response.message || 'تم تغيير كلمة المرور؛ سجّل الدخول بالكلمة الجديدة');
      $('#authPassword').focus();
    } catch (error) { showError(errorBox, error.message); }
    finally { button.disabled = false; button.textContent = 'تغيير كلمة المرور'; }
  }

  async function startSettingsPasswordReset() {
    const button = $('#settingsPasswordReset');
    button.disabled = true; button.textContent = 'جارٍ إرسال الرمز...';
    try {
      pendingAuthEmail = String(state.user?.email || '').trim().toLowerCase();
      const response = await authRequest('forgot-password', { email: pendingAuthEmail, locale: currentLocale(), theme: activeTheme });
      try { await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}` } }); } catch (_) { /* Continue to the secure reset screen. */ }
      saveSession(null);
      $('#resetEmailLabel').textContent = pendingAuthEmail;
      $('#resetCode').value = ''; $('#resetPassword').value = ''; $('#resetPasswordConfirm').value = '';
      $('#authGate').classList.remove('hidden'); document.body.classList.add('auth-pending');
      showAuthPanel('resetForm'); $('#resetCode').focus();
      notify(response.message || 'تم إرسال رمز الاستعادة إلى بريدك');
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; button.textContent = 'إرسال رمز إلى بريدي'; }
  }

  function renderAccountSecurity() {
    const owner = isDeveloperAccount();
    $('#openDeleteAccountModal').disabled = owner;
    $('#deleteAccountDescription').textContent = owner
      ? 'حساب المالك محمي ولا يمكن حذفه من داخل التطبيق.'
      : 'يحذف الحساب ومساحة العمل والملفات نهائياً. لا يمكن التراجع عن هذا الإجراء.';
  }

  function openDeleteAccountModal() {
    if (isDeveloperAccount()) { notify('حساب المالك محمي ولا يمكن حذفه من داخل التطبيق', true); return; }
    $('#deleteAccountForm').reset(); showError($('#deleteAccountError'), '');
    $('#deleteAccountModal').classList.add('open'); $('#deleteAccountPassword').focus();
  }

  function closeDeleteAccountModal() { $('#deleteAccountModal').classList.remove('open'); }

  async function deleteAccount(event) {
    event.preventDefault();
    const errorBox = $('#deleteAccountError'); showError(errorBox, '');
    if ($('#deleteAccountConfirmation').value.trim() !== 'حذف حسابي') { showError(errorBox, 'اكتب عبارة «حذف حسابي» كما هي للتأكيد.'); return; }
    const button = $('#confirmDeleteAccount');
    button.disabled = true; button.textContent = 'جارٍ حذف الحساب...';
    try {
      const response = await accountRequest('delete-account', { current_password: $('#deleteAccountPassword').value, confirmation: 'DELETE_ACCOUNT' });
      saveSession(null); closeDeleteAccountModal();
      notify(response.message || 'تم حذف الحساب نهائياً');
      setTimeout(() => location.reload(), 500);
    } catch (error) { showError(errorBox, error.message); }
    finally { button.disabled = false; button.textContent = 'حذف الحساب نهائياً'; }
  }

  function togglePassword(button) {
    const input = $(`#${button.dataset.passwordToggle}`);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.setAttribute('aria-label', visible ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور');
    $('use', button).setAttribute('href', visible ? '#i-eye' : '#i-eye-off');
  }

  async function logout(ask = true) {
    if (ask) { $('#logoutModal').classList.add('open'); $('#confirmLogout').focus(); return; }
    $('#logoutModal').classList.remove('open');
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
      state.agents.unshift(agent); $('#agentModal').classList.remove('open'); renderAll();
      notify('تم حفظ الموظف. يمكن تفعيله بعد ربط القنوات المطلوبة.');
      try { await audit('agent_created', 'agent', agent.id, { role: agent.role }); }
      catch (auditError) { console.warn('Agent audit failed after save', auditError); }
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
    const form = event.currentTarget;
    try {
      const [task] = await rest('ai_tasks', { method: 'POST', body: { organization_id: state.org.id, agent_id: $('#taskAgent').value || null, title: $('#taskTitle').value.trim(), instructions: $('#taskInstructions').value.trim(), priority: $('#taskPriority').value, requires_approval: $('#taskApproval').checked, status: 'draft', created_by: state.user.id } });
      state.tasks.unshift(task); $('#taskModal').classList.remove('open'); form.reset(); renderAll(); notify('تم حفظ المهمة كمسودة');
      try { await audit('task_created', 'task', task.id); }
      catch (auditError) { console.warn('Task audit failed after save', auditError); }
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

  async function disconnectIntegration(provider, button = null) {
    const name = providerNames[provider] || 'الحساب';
    if (!window.confirm(`هل تريد إلغاء ربط ${name} من مساحة العمل؟`)) return;
    const previousLabel = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = 'جارٍ إلغاء الربط…'; }
    try {
      await authorizedRequest('integrations/disconnect', { method: 'POST', body: { organization_id: state.org.id, provider } });
      state.integrations = await rest('ai_integrations', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      renderIntegrations();
      if (state.selectedPermissionAgentId) await loadPermissionCenter(state.selectedPermissionAgentId, true);
      notify(`تم إلغاء ربط ${name}`);
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = previousLabel || 'إلغاء الربط'; }
      notify(error.message, true);
    }
  }

  async function requestIntegration(button, explicitProvider = '') {
    const provider = explicitProvider || button.closest('.integration')?.dataset.provider;
    if (!provider) return;
    const current = state.integrations.find(item => item.provider === provider);
    if (current?.status === 'connected') { await disconnectIntegration(provider, button); return; }
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
  function selectPlanCard(card) {
    planCards.forEach(item => { const selected = item === card; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
    $('.plan-grid')?.classList.toggle('has-selection', Boolean(card));
  }
  function selectPlanByName(name) { selectPlanCard(planCards.find(item => planCardName(item) === name) || null); }
  function openBilling(planName) {
    if (isDeveloperAccount()) { notify('حساب المالك مفتوح مجاناً ولا يحتاج إلى اشتراك'); return; }
    const requestedCode = planNameToCode[planName] || currentSubscription().plan_code;
    const code = customerPlanCodes.has(requestedCode) ? requestedCode : 'team3';
    const plan = plans[code];
    $('#selectedPlan').value = `${plan.name} — ${plan.price}`;
    $('#selectedPlan').dataset.planCode = code;
    updateBillingPaymentAction();
    $('#billingModal').classList.add('open'); $('#selectedPlan').focus(); selectPlanByName(plan.name);
  }

  function updateBillingPaymentAction() {
    const method = $('#paymentMethod').value;
    const code = $('#selectedPlan').dataset.planCode || 'team3';
    const plan = plans[code] || plans.team3;
    const action = $('#confirmBilling');
    action.textContent = method === 'PayPal' ? 'الدفع عبر PayPal' : 'إرسال طلب الاشتراك';
    action.classList.toggle('paypal-button', method === 'PayPal');
    action.classList.toggle('btn-primary', method !== 'PayPal');
    $('#billingPaymentNote').textContent = method === 'PayPal'
      ? `ستنتقل إلى صفحة PayPal الرسمية لدفع ${plan.paypalUsd} USD، ثم يفعّل الخادم اشتراكك تلقائياً بعد تأكيد القبض.`
      : 'سيُرسل طلب التحويل البنكي ويبقى الحساب مقفولاً حتى يؤكد المالك وصول الدفعة.';
  }

  async function startPayPalCheckout(code) {
    const button = $('#confirmBilling');
    button.disabled = true;
    button.textContent = 'جارٍ فتح PayPal...';
    try {
      const result = await authorizedRequest('paypal/orders', { method: 'POST', body: { organization_id: state.org.id, plan_code: code } });
      if (!String(result.approval_url || '').startsWith('https://')) throw new Error('لم يرجع PayPal رابط دفع صالحاً');
      sessionStorage.setItem(SESSION_HANDOFF_KEY, json({ provider: 'paypal', created_at: Date.now() }));
      location.assign(result.approval_url);
    } catch (error) {
      sessionStorage.removeItem(SESSION_HANDOFF_KEY);
      notify(error.message, true);
      button.disabled = false;
      updateBillingPaymentAction();
    }
  }

  async function handlePayPalReturn() {
    const params = new URLSearchParams(location.search);
    const outcome = params.get('paypal');
    if (!outcome) return;
    sessionStorage.removeItem(SESSION_HANDOFF_KEY);
    const cleanUrl = `${location.pathname}${location.hash || '#billing'}`;
    if (outcome === 'cancelled') {
      history.replaceState(null, '', cleanUrl);
      showView('billing', false);
      notify('تم إلغاء الدفع ولم يُخصم أي مبلغ', true);
      return;
    }
    const orderId = params.get('token');
    if (!orderId) {
      history.replaceState(null, '', cleanUrl);
      notify('تعذر قراءة مرجع عملية PayPal', true);
      return;
    }
    try {
      await authorizedRequest(`paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST' });
      history.replaceState(null, '', cleanUrl);
      await loadWorkspace();
      showView('dashboard');
      notify('أكد PayPal الدفعة وتم تفعيل اشتراكك بنجاح');
    } catch (error) {
      history.replaceState(null, '', cleanUrl);
      showView('billing', false);
      notify(error.message, true);
    }
  }

  async function saveSubscription() {
    if (isDeveloperAccount()) { notify('حساب المالك لا يحتاج إلى دفع'); return; }
    const requestedCode = $('#selectedPlan').dataset.planCode;
    const code = customerPlanCodes.has(requestedCode) ? requestedCode : 'team3'; const plan = plans[code]; const payment = $('#paymentMethod').value;
    if (payment === 'PayPal') { await startPayPalCheckout(code); return; }
    try {
      const [subscription] = await rest('ai_subscriptions', { method: 'POST', body: { organization_id: state.org.id, plan_code: code, status: 'pending_payment', agent_limit: plan.agents, monthly_task_limit: plan.tasks, billing_cycle: plan.cycle, payment_method: payment } });
      state.subscriptions = await rest('ai_subscriptions', { query: `organization_id=eq.${state.org.id}&select=*&order=created_at.desc` });
      $('#billingModal').classList.remove('open'); applySubscriptionGate(); renderBilling(); await audit('subscription_selected', 'subscription', subscription.id, { plan_code: code, payment_method: payment });
      notify('تم إرسال طلب الاشتراك؛ يبقى النظام مقفولاً حتى يؤكد المالك استلام التحويل');
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
    $$('.dashboard-stat-card').forEach(button => button.addEventListener('click', () => openDashboardStat(button.dataset.dashboardStat)));
    $('#dashboardStatClose').addEventListener('click', () => { $('#dashboardStatPanel').hidden = true; $$('.dashboard-stat-card').forEach(card => card.setAttribute('aria-expanded', 'false')); });
    $('#dashboardStatViewAll').addEventListener('click', event => showView(event.currentTarget.dataset.view || 'dashboard'));
    $$('[data-dashboard-connect]').forEach(button => button.addEventListener('click', () => void handleDashboardConnection(button.dataset.dashboardConnect)));
    $('#addWebsiteSource').addEventListener('click', () => addWebsiteSourceRow());
    $('#websiteSourcesForm').addEventListener('submit', saveWebsiteSources);
    $('#closeWebsiteSources').addEventListener('click', closeWebsiteSources);
    $('#cancelWebsiteSources').addEventListener('click', closeWebsiteSources);
    $('#parkingConnectionForm').addEventListener('submit', saveParkingConnection);
    $('#closeParkingConnection').addEventListener('click', closeParkingConnection);
    $('#cancelParkingConnection').addEventListener('click', closeParkingConnection);
    $('#removeParkingConnection').addEventListener('click', removeParkingConnection);
    $('#menuBtn').addEventListener('click', () => setSidebarOpen(true));
    $('#overlay').addEventListener('click', () => setSidebarOpen(false, true));
    compactNavigation.addEventListener('change', () => setSidebarOpen(false));
    $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab)));
    $('#authForm').addEventListener('submit', submitAuth); $('#onboardingForm').addEventListener('submit', createWorkspace);
    $('#otpForm').addEventListener('submit', verifySignupOtp); $('#forgotForm').addEventListener('submit', requestPasswordReset); $('#resetForm').addEventListener('submit', resetPassword);
    $('#forgotPassword').addEventListener('click', openForgotPassword);
    $('#backFromOtp').addEventListener('click', () => showAuthPanel('authStage'));
    $('#backFromForgot').addEventListener('click', () => showAuthPanel('authStage'));
    $('#backFromReset').addEventListener('click', () => showAuthPanel('authStage'));
    $$('[data-password-toggle]').forEach(button => button.addEventListener('click', () => togglePassword(button)));
    $('.profile').addEventListener('click', () => showView('settings'));
    $('#logoutButton').addEventListener('click', () => logout(true));
    $('#confirmLogout').addEventListener('click', () => logout(false));
    $('#cancelLogout').addEventListener('click', () => $('#logoutModal').classList.remove('open'));
    $('#closeLogoutModal').addEventListener('click', () => $('#logoutModal').classList.remove('open'));
    $('#changePasswordForm').addEventListener('submit', changePassword);
    $('#settingsPasswordReset').addEventListener('click', startSettingsPasswordReset);
    $('#openDeleteAccountModal').addEventListener('click', openDeleteAccountModal);
    $('#deleteAccountForm').addEventListener('submit', deleteAccount);
    $('#cancelDeleteAccount').addEventListener('click', closeDeleteAccountModal);
    $('#closeDeleteAccountModal').addEventListener('click', closeDeleteAccountModal);
    $$('.open-agent').forEach(button => button.addEventListener('click', openAgentModal));
    $('#closeModal').addEventListener('click', () => $('#agentModal').classList.remove('open'));
    $('#prevStep').addEventListener('click', () => { if (agentStep > 0) { agentStep -= 1; renderAgentStep(); } });
    $('#nextStep').addEventListener('click', () => { if (agentStep < 2) { agentStep += 1; renderAgentStep(); } else saveAgent(); });
    $('#openTask').addEventListener('click', () => { refreshTaskAgentOptions(); $('#taskModal').classList.add('open'); $('#taskTitle').focus(); });
    $('#closeTaskModal').addEventListener('click', () => $('#taskModal').classList.remove('open')); $('#cancelTask').addEventListener('click', () => $('#taskModal').classList.remove('open')); $('#taskForm').addEventListener('submit', saveTask);
    $('#permissionAgentSelect').addEventListener('change', event => {
      const next = event.target.value;
      if (state.permissionDirty && !window.confirm('يوجد تغيير غير محفوظ. هل تريد الانتقال إلى موظف آخر دون حفظه؟')) { event.target.value = state.selectedPermissionAgentId; return; }
      state.permissionDirty = false; state.selectedPermissionAgentId = next; state.agentPermissions = []; state.actionExecutions = []; state.deviceConnections = []; state.voiceSettings = null; state.voiceReadiness = null; state.voiceCalls = []; state.voiceValidationCode = ''; state.permissionIntegrations = [];
      renderPermissions(); if (next) void loadPermissionCenter(next);
    });
    $('#refreshPermissions').addEventListener('click', () => { if (state.selectedPermissionAgentId) void loadPermissionCenter(state.selectedPermissionAgentId); else notify('اختر الموظف الذكي أولاً', true); });
    $('#savePermissions').addEventListener('click', savePermissions);
    $('#emergencyStopAgent').addEventListener('click', emergencyStopSelectedAgent);
    $('#voiceUseLinkedNumber').addEventListener('click', selectLinkedVoiceNumber);
    $('#voiceVerifyNumber').addEventListener('click', verifyVoiceNumber);
    $('#voiceCheckNumber').addEventListener('click', checkVoiceNumber);
    $('#voiceDisconnectNumber').addEventListener('click', disconnectVoiceNumber);
    $('#saveVoiceGateway').addEventListener('click', saveVoiceGateway);
    $$('#voiceCallerId,#voiceDailyLimit,#voiceMinuteLimit,#voiceAllowedFrom,#voiceAllowedTo,#voiceDisclosure').forEach(field => field.addEventListener('input', () => {
      const current = voicePolicy();
      state.voiceSettings = {
        ...(state.voiceSettings || {}),
        caller_id: $('#voiceCallerId').value.trim(),
        disclosure_text: $('#voiceDisclosure').value.trim(),
        settings: {
          ...current.settings,
          daily_call_limit: Number($('#voiceDailyLimit').value || 0),
          max_call_minutes: Number($('#voiceMinuteLimit').value || 0),
          allowed_from: $('#voiceAllowedFrom').value,
          allowed_to: $('#voiceAllowedTo').value
        }
      };
      state.permissionDirty = true;
      $('#savePermissions').disabled = PREVIEW_MODE;
      $('#permissionSaveState').textContent = 'يوجد تغيير غير محفوظ.';
    }));
    $('[data-action="add-lead"]').addEventListener('click', addLead);
    $$('.connect').forEach(button => button.addEventListener('click', () => requestIntegration(button)));
    $('#composer').addEventListener('submit', saveDraftMessage);
    $('#uploadBtn').addEventListener('click', () => $('#fileInput').click()); $('#fileInput').addEventListener('change', saveKnowledge);
    planCards.forEach(card => {
      card.tabIndex = 0; card.setAttribute('role', 'button'); card.addEventListener('click', () => selectPlanCard(card));
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPlanCard(card); } });
    });
    $$('.choose-plan').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openBilling(button.dataset.plan); }));
    $('#addPayment').addEventListener('click', () => openBilling()); $('#confirmBilling').addEventListener('click', saveSubscription);
    $('#paymentMethod').addEventListener('change', updateBillingPaymentAction);
    $('#closeBillingModal').addEventListener('click', () => $('#billingModal').classList.remove('open')); $('#cancelBilling').addEventListener('click', () => $('#billingModal').classList.remove('open'));
    $('#generateActivationCode').addEventListener('click', generateActivationCode);
    $('#copyActivationCode').addEventListener('click', async () => { try { await copyText($('#generatedActivationCode').value); notify('تم نسخ كود التفعيل'); } catch (error) { notify(error.message, true); } });
    $('#redeemActivationCode').addEventListener('click', redeemFreeActivationCode);
    $('#activationCodeInput').addEventListener('keydown', event => { if (event.key === 'Enter') redeemFreeActivationCode(); });
    $('#savePayPalCredentials').addEventListener('click', savePayPalCredentials);
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
    $$('[data-action="billing-help"]').forEach(button => button.addEventListener('click', () => notify('PayPal يفعّل الاشتراك تلقائياً بعد تأكيد الدفع؛ أو استخدم كوداً مجانياً من المالك')));
    $('#commandForm').addEventListener('submit', event => void sendEmployeeChat(event));
    $('#pasteCommand').addEventListener('click', () => { void pasteIntoCommand().catch(error => commandStatus(error.message, 'error')); });
    $('#employeeChatMic').addEventListener('click', startEmployeeVoiceInput);
    $('#employeeChatVoiceToggle').addEventListener('click', toggleEmployeeChatVoice);
    $('#employeeChatAgent').addEventListener('change', event => {
      state.employeeChatAgentId = event.target.value;
      localStorage.setItem(employeeChatPreferenceKey('agent'), state.employeeChatAgentId);
      state.employeeChatMessages = [];
      renderEmployeeChat();
      void loadEmployeeVoice().then(loadEmployeeChat).catch(error => commandStatus(customerSafeChatError(error), 'error'));
    });
    $('#employeeChatVoice').addEventListener('change', event => void saveEmployeeVoice(event.target.value));
    $('#employeeChatVoicePicker').addEventListener('click', openEmployeeVoicePicker);
    $('#employeeChatVoicePreview').addEventListener('click', previewEmployeeVoice);
    $('#previewEmployeeVoice').addEventListener('click', previewEmployeeVoice);
    $('#closeEmployeeVoiceModal').addEventListener('click', closeEmployeeVoicePicker);
    $('#cancelEmployeeVoice').addEventListener('click', closeEmployeeVoicePicker);
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
      setSidebarOpen(false, true);
      cancelIntegrationModal();
      $$('.modal').filter(modal => modal.id !== 'integrationModal').forEach(modal => modal.classList.remove('open'));
    });
    $('#downloadInvoice')?.addEventListener('click', downloadSubscriptionSummary);
  }

  async function boot() {
    await i18n()?.ready;
    const agentLanguage = $('#agentLanguage');
    if (agentLanguage && i18n()) agentLanguage.replaceChildren(...i18n().locales.map(locale => { const option = document.createElement('option'); option.value = locale.code; option.textContent = locale.name; return option; }));
    applyTheme(activeTheme, false); renderThemeCatalog(); bindUI(); setSidebarOpen(false); setAuthMode('login');
    localStorage.removeItem(SESSION_KEY);
    if (PREVIEW_MODE) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_HANDOFF_KEY);
      enterPreviewMode();
      return;
    }
    const bootParams = new URLSearchParams(location.search);
    const handoffRaw = sessionStorage.getItem(SESSION_HANDOFF_KEY);
    let validPayPalReturn = false;
    if (handoffRaw && bootParams.has('paypal')) {
      try {
        const handoff = JSON.parse(handoffRaw);
        validPayPalReturn = handoff?.provider === 'paypal' && Date.now() - Number(handoff.created_at || 0) < 30 * 60 * 1000;
      } catch (_) { validPayPalReturn = false; }
    }
    if (handoffRaw && !validPayPalReturn) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_HANDOFF_KEY);
    }
    try { state.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); state.user = state.session?.user || null; } catch (_) { saveSession(null); }
    if (!state.session) return;
    setLoading(true);
    try { await loadWorkspace(); }
    catch (error) { saveSession(null); showError($('#authError'), `انتهت الجلسة أو تعذر تحميل الحساب: ${error.message}`); }
    finally { setLoading(false); }
  }

  window.addEventListener('pagehide', () => {
    if (!sessionStorage.getItem(SESSION_HANDOFF_KEY)) sessionStorage.removeItem(SESSION_KEY);
  });

  boot();
})();
