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

  function parse(input) {
    const raw = String(input || '').trim();
    if (!raw) return { type: 'empty', raw };
    if (matchAlias(raw, 'print', true)) return { type: 'print', raw };
    if (matchAlias(raw, 'paste', true)) return { type: 'paste', raw };
    if (matchAlias(raw, 'integrations', true)) return { type: 'integrations', raw };
    if (matchAlias(raw, 'logout', true)) return { type: 'logout', raw };

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
    const copy = matchAlias(raw, 'copy');
    if (copy) return { type: 'copy', raw, text: copy.payload };
    const open = matchAlias(raw, 'open');
    if (open) return { type: 'open', raw, target: open.payload };
    return { type: 'unsupported', raw };
  }

  window.VarexCommandEngine = Object.freeze({ parse });
})();
