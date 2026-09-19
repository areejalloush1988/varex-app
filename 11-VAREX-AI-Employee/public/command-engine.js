(() => {
  'use strict';

  const aliases = {
    addAgent: ['أضف موظف', 'اضف موظف', 'إضافة موظف', 'اضافة موظف', 'add employee', 'add agent', 'ملازم شامل کریں', 'افزودن کارمند', '添加员工', '직원 추가', 'aggiungi dipendente', 'añadir empleado', 'agregar empleado', 'הוסף עובד', 'добавить сотрудника', 'çalışan ekle', 'ajouter un employé', 'ajouter employé'],
    addLead: ['أضف عميل', 'اضف عميل', 'إضافة عميل', 'اضافة عميل', 'add lead', 'add customer', 'گاہک شامل کریں', 'افزودن مشتری', '添加客户', '고객 추가', 'aggiungi cliente', 'añadir cliente', 'agregar cliente', 'הוסף לקוח', 'добавить клиента', 'müşteri ekle', 'ajouter un client', 'ajouter client'],
    print: ['اطبع', 'طباعة', 'print', 'پرنٹ', 'چاپ', '打印', '인쇄', 'stampa', 'imprimir', 'הדפס', 'печать', 'распечатать', 'yazdır', 'imprimer'],
    copy: ['انسخ', 'نسخ', 'copy', 'کاپی', 'کپی', '复制', '복사', 'copia', 'copiar', 'העתק', 'копировать', 'kopyala', 'copier'],
    paste: ['الصق', 'لصق', 'paste', 'پیسٹ', 'چسباندن', '粘贴', '붙여넣기', 'incolla', 'pegar', 'הדבק', 'вставить', 'yapıştır', 'coller'],
    open: ['افتح', 'فتح', 'open', 'کھولیں', 'باز کردن', '打开', '열기', 'apri', 'abrir', 'פתח', 'открыть', 'aç', 'ouvrir'],
    integrations: ['حالة البوابات', 'افحص البوابات', 'integration status', 'check integrations', 'گیٹ وے کی حالت', 'وضعیت درگاه‌ها', '网关状态', '연결 상태', 'stato integrazioni', 'estado de integraciones', 'מצב החיבורים', 'статус интеграций', 'entegrasyon durumu', 'état des intégrations'],
    whatsappSend: ['أرسل واتساب', 'ارسل واتساب', 'أرسل رسالة واتساب', 'ارسل رسالة واتساب', 'ابعت واتساب', 'إبعت واتساب', 'ابعت رسالة', 'إبعت رسالة', 'ابعث رسالة', 'send whatsapp', 'send a whatsapp'],
    phoneCall: ['اتصل', 'إتصل', 'اعمل اتصال', 'ابدأ اتصال', 'call'],
    logout: ['تسجيل الخروج', 'سجل خروج', 'logout', 'sign out', 'لاگ آؤٹ', 'خروج', '退出登录', '로그아웃', 'esci', 'cerrar sesión', 'התנתק', 'выйти', 'çıkış yap', 'se déconnecter'],
  };

  function normalize(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  function matchAlias(input, group, exact = false) {
    const normalized = normalize(input);
    const match = aliases[group].find(alias => exact ? normalized === normalize(alias) : normalized.startsWith(normalize(alias)));
    if (!match) return null;
    const payload = String(input).trim().slice(match.length).replace(/^[\s:：\-—]+/, '').trim();
    return { alias: match, payload };
  }

  function splitPayload(payload) {
    const parts = payload.split(/\s*[|｜]\s*/).map(item => item.trim()).filter(Boolean);
    return { primary: parts[0] || '', secondary: parts.slice(1).join(' | ') };
  }

  function parseWhatsApp(raw) {
    if (!/(?:واتساب|الواتساب|الواتس|whatsapp)/i.test(raw)) return null;
    let working = String(raw).trim();
    const pipeParts = working.split(/\s*[|｜]\s*/);
    let intent = pipeParts.shift() || '';
    let message = pipeParts.join(' | ').trim();
    if (!message) {
      const speechSplit = intent.match(/^(.*?)(?:\s+(?:وقل(?:ه|ها|هم)|وقل\s+له|وقل\s+لها|والنص|والرسالة|بأن|انه|إنه)\s+)(.+)$/i);
      if (speechSplit) { intent = speechSplit[1]; message = speechSplit[2].trim(); }
    }
    if (!message) {
      const colonIndex = Math.max(intent.lastIndexOf(':'), intent.lastIndexOf('：'));
      if (colonIndex >= 0) { message = intent.slice(colonIndex + 1).trim(); intent = intent.slice(0, colonIndex); }
    }
    let target = intent
      .replace(/^(?:(?:خلي|خلّي)\s+(?:الموظف(?:\s+الذكي)?\s+)?)?(?:أرسل|ارسل|ابعت|إبعت|ابعث|بعت|يبعت|يبعث|يرسل|send)(?:\s+(?:a\s+)?(?:رسالة|message))?/i, '')
      .replace(/(?:على|عبر|بـ?|عال?)?\s*(?:الواتساب|واتساب|الواتس|whatsapp)/ig, '')
      .replace(/^\s*(?:إلى|الى|لـ|ل|to)\s*/i, '')
      .replace(/^[\s:：\-—]+|[\s:：\-—]+$/g, '')
      .trim();
    if (!target) {
      const direct = matchAlias(raw, 'whatsappSend');
      target = direct?.payload.split(/\s*[|｜:：]\s*/)[0]?.replace(/^(?:إلى|الى|لـ|ل|to)\s*/i, '').trim() || '';
    }
    return { type: 'whatsappSend', raw, target, message };
  }

  function parsePhoneCall(raw) {
    const matched = matchAlias(raw, 'phoneCall');
    if (!matched) return null;
    let payload = matched.payload;
    let spoken = '';
    const spokenMatch = payload.match(/^(.*?)(?:\s+(?:وقل(?:ه|ها|هم)?|وقل\s+له|وقل\s+لها|واحكي(?:له|لها)?|وخبر(?:ه|ها|هم)?|والرسالة|والرساله)\s+)(.+)$/i);
    if (spokenMatch) { payload = spokenMatch[1].trim(); spoken = spokenMatch[2].trim(); }
    if (!spoken) {
      const goalMatch = payload.match(/^(.*?)(?:\s+)((?:و?(?:حد[ّ]?د(?:\s+(?:معه|معها|معهم))?|اس[أا]ل(?:ه|ها|هم)?|استفسر(?:\s+(?:منه|منها))?|اتفق(?:\s+(?:معه|معها|معهم))?|احجز(?:\s+(?:له|لها|معه|معها))?|ت[أا]كد(?:\s+(?:منه|منها))?|اطلب(?:\s+(?:منه|منها))?|خبر(?:ه|ها|هم)?|احكي(?:له|لها|معه|معها)?))\s+.+)$/i);
      if (goalMatch) { payload = goalMatch[1].trim(); spoken = goalMatch[2].replace(/^و/, '').trim(); }
    }
    const values = splitPayload(payload);
    const target = values.primary.replace(/^(?:على|بـ?|مع|to)\s*/i, '').trim();
    const instructions = values.secondary || spoken;
    return { type: 'phoneCall', raw, target, instructions };
  }

  function parseKnownAppAction(raw) {
    const text = normalize(raw);
    if (/(?:إيميل|ايميل|بريد إلكتروني|بريد الكتروني|email)/i.test(raw) && /^(?:أرسل|ارسل|ابعت|إبعت|send)/i.test(text)) {
      const parts = raw.split(/\s*[|｜]\s*/).map(item => item.trim());
      let intent = parts.shift() || '', body = parts.join(' | ');
      const colon = Math.max(intent.lastIndexOf(':'), intent.lastIndexOf('：'));
      let subject = '';
      if (colon >= 0) { subject = intent.slice(colon + 1).trim(); intent = intent.slice(0, colon); }
      const address = intent.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || intent.replace(/^.*?(?:إلى|الى|to)\s*/i, '').replace(/(?:إيميل|ايميل|بريد إلكتروني|بريد الكتروني|email)/ig, '').trim();
      return { type: 'agentAction', raw, appKey: 'email', actionKey: 'send', target: address, payload: { subject, body } };
    }
    if (/(?:منبّه|منبه|المنبّه|المنبه|تذكير)/i.test(raw)) {
      const actionKey = /(?:احذف|حذف)/.test(text) ? 'delete' : /(?:أوقف|اوقف|عطّل|عطل)/.test(text) ? 'disable' : /(?:شغّل|شغل|فعّل|فعل)/.test(text) ? 'enable' : /(?:عدّل|عدل|غيّر|غير)/.test(text) ? 'edit' : 'create';
      return { type: 'agentAction', raw, appKey: 'alarms', actionKey, target: raw, payload: { instruction: raw } };
    }
    if (/(?:موعد|التقويم|calendar)/i.test(raw) && /(?:أضف|اضف|أنشئ|انشئ|احجز|عدّل|عدل|ألغ|الغ|احذف|حذف|اعرض|عرض|show|create|delete)/i.test(raw)) {
      const actionKey = /(?:احذف|حذف|delete)/i.test(raw) ? 'delete' : /(?:ألغ|الغ|cancel)/i.test(raw) ? 'cancel' : /(?:عدّل|عدل|edit)/i.test(raw) ? 'edit' : /(?:اعرض|عرض|show)/i.test(raw) ? 'view' : 'create';
      return { type: 'agentAction', raw, appKey: 'calendar', actionKey, target: raw, payload: { instruction: raw } };
    }
    if (/(?:جهة اتصال|جهات الاتصال|contact)/i.test(raw)) {
      const actionKey = /(?:احذف|حذف|delete)/i.test(raw) ? 'delete' : /(?:عدّل|عدل|edit)/i.test(raw) ? 'edit' : /(?:أضف|اضف|أنشئ|انشئ|add|create)/i.test(raw) ? 'create' : /(?:ابحث|بحث|search)/i.test(raw) ? 'search' : 'view';
      return { type: 'agentAction', raw, appKey: 'contacts', actionKey, target: raw, payload: { instruction: raw } };
    }
    if (/(?:يوتيوب|youtube)/i.test(raw)) {
      const actionKey = /(?:احذف|حذف|delete)/i.test(raw) ? 'delete' : /(?:ارفع|رفع|upload)/i.test(raw) ? 'upload' : /(?:عدّل|عدل|edit)/i.test(raw) ? 'edit' : /(?:إدارة|ادارة|نظّم|نظم|manage)/i.test(raw) ? 'manage' : 'search';
      return { type: 'agentAction', raw, appKey: 'youtube', actionKey, target: raw, payload: { instruction: raw } };
    }
    if (/(?:إعدادات الهاتف|اعدادات الهاتف|phone settings)/i.test(raw)) {
      const actionKey = /(?:غيّر|غير|بدّل|بدل|change)/i.test(raw) ? 'change' : /(?:افتح|فتح|open)/i.test(raw) ? 'open' : 'view';
      return { type: 'agentAction', raw, appKey: 'settings', actionKey, target: raw, payload: { instruction: raw } };
    }
    if (/(?:باركينج|باركنج|موقف|المواقف|parking)/i.test(raw)) {
      const actionKey = /(?:ادفع|دفع|pay)/i.test(raw) ? 'pay' : /(?:مدد|مدّد|تمديد|extend)/i.test(raw) ? 'extend' : /(?:ابدأ|ابدا|شغّل|شغل|start)/i.test(raw) ? 'start_session' : 'view';
      return { type: 'agentAction', raw, appKey: 'parking', actionKey, target: raw, payload: { instruction: raw } };
    }
    return null;
  }

  function parse(input) {
    const raw = String(input || '').trim();
    if (!raw) return { type: 'empty', raw };
    if (matchAlias(raw, 'print', true)) return { type: 'print', raw };
    if (matchAlias(raw, 'paste', true)) return { type: 'paste', raw };
    if (matchAlias(raw, 'integrations', true)) return { type: 'integrations', raw };
    if (matchAlias(raw, 'logout', true)) return { type: 'logout', raw };

    const whatsapp = parseWhatsApp(raw);
    if (whatsapp) return whatsapp;
    const phoneCall = parsePhoneCall(raw);
    if (phoneCall) return phoneCall;
    const addAgent = matchAlias(raw, 'addAgent');
    if (addAgent) {
      const values = splitPayload(addAgent.payload);
      return { type: 'addAgent', raw, name: values.primary, role: values.secondary };
    }
    const addLead = matchAlias(raw, 'addLead');
    if (addLead) {
      const values = splitPayload(addLead.payload);
      return { type: 'addLead', raw, name: values.primary, service: values.secondary };
    }
    const knownAction = parseKnownAppAction(raw);
    if (knownAction) return knownAction;
    const copy = matchAlias(raw, 'copy');
    if (copy) return { type: 'copy', raw, text: copy.payload };
    const open = matchAlias(raw, 'open');
    if (open) return { type: 'open', raw, target: open.payload };
    return { type: 'unsupported', raw };
  }

  window.VarexCommandEngine = Object.freeze({ parse });
})();
