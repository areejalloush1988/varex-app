"use client";

import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSystemTranslation } from "./system-translator";

type IconName =
  | "home" | "calendar" | "clients" | "services" | "team" | "box"
  | "invoice" | "wallet" | "chart" | "card" | "settings" | "plus"
  | "search" | "bell" | "sound" | "language" | "appearance" | "size"
  | "switch" | "clock" | "sparkles" | "check" | "arrow" | "scissors" | "cashier"
  | "barcode" | "printer" | "minus" | "trash" | "camera";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M18 8v6M21 11h-6"/></>,
    services: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z"/></>,
    team: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 4.5a3 3 0 0 1 0 5.8M18 20v-1a5 5 0 0 0-3-4.8"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
    invoice: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a2 2 0 0 0 .4 2L17 19.8a2 2 0 0 0-2-.4A2 2 0 0 0 14 21h-4a2 2 0 0 0-1-1.6 2 2 0 0 0-2 .4L4.2 17a2 2 0 0 0 .4-2A2 2 0 0 0 3 14v-4a2 2 0 0 0 1.6-1 2 2 0 0 0-.4-2L7 4.2a2 2 0 0 0 2 .4A2 2 0 0 0 10 3h4a2 2 0 0 0 1 1.6 2 2 0 0 0 2-.4L19.8 7a2 2 0 0 0-.4 2A2 2 0 0 0 21 10v4a2 2 0 0 0-1.6 1Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    language: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    appearance: <><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 0-3.6h-.8a1.7 1.7 0 0 1 0-3.4H15a6 6 0 0 0 0-12h-3Z"/><circle cx="7.5" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="9.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/><circle cx="14" cy="6.5" r=".8" fill="currentColor" stroke="none"/></>,
    size: <><path d="M4 19 9.3 5h1.9l5.3 14M6.2 13.5h8.1"/><path d="M17 8h4M19 6v4"/></>,
    switch: <><path d="M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    sparkles: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    scissors: <><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.5 8.5 11 7.5M8.5 15.5 19.5 8"/></>,
    cashier: <><path d="M6 3h10v6H6z"/><path d="M4 9h16a1 1 0 0 1 1 1v9H3v-9a1 1 0 0 1 1-1Z"/><path d="M7 13h4M15 13h2M7 16h10"/></>,
    barcode: <><path d="M3 5v14M7 5v14M10 5v14M14 5v14M18 5v14M21 5v14"/><path d="M5 5v14M12 5v14M17 5v14" strokeWidth=".8"/></>,
    printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM18 12h.01"/></>,
    minus: <path d="M5 12h14"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    camera: <><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const nav = [
  ["اليوم", "home"], ["الكاشير", "cashier"], ["المواعيد", "calendar"], ["العميلات", "clients"],
  ["الخدمات", "services"], ["الفريق", "team"], ["المخزون", "box"],
  ["الفواتير", "invoice"], ["المصروفات", "wallet"], ["التقارير", "chart"],
  ["الاشتراك", "card"], ["الإعدادات", "settings"],
] as const;

type LanguageCode = "AR" | "EN" | "UR" | "FA" | "ZH" | "KO" | "IT" | "ES" | "HE" | "FR" | "RU";

const languageOptions: { code:LanguageCode; name:string; locale:string; htmlLang:string; dir:"rtl" | "ltr" }[] = [
  { code:"AR", name:"العربية", locale:"ar-AE", htmlLang:"ar", dir:"rtl" },
  { code:"EN", name:"English", locale:"en-AE", htmlLang:"en", dir:"ltr" },
  { code:"UR", name:"اردو", locale:"ur-PK", htmlLang:"ur", dir:"rtl" },
  { code:"FA", name:"فارسی", locale:"fa-IR", htmlLang:"fa", dir:"rtl" },
  { code:"ZH", name:"中文", locale:"zh-CN", htmlLang:"zh", dir:"ltr" },
  { code:"KO", name:"한국어", locale:"ko-KR", htmlLang:"ko", dir:"ltr" },
  { code:"IT", name:"Italiano", locale:"it-IT", htmlLang:"it", dir:"ltr" },
  { code:"ES", name:"Español", locale:"es-ES", htmlLang:"es", dir:"ltr" },
  { code:"HE", name:"עברית", locale:"he-IL", htmlLang:"he", dir:"rtl" },
  { code:"FR", name:"Français", locale:"fr-FR", htmlLang:"fr", dir:"ltr" },
  { code:"RU", name:"Русский", locale:"ru-RU", htmlLang:"ru", dir:"ltr" },
];

const navTranslations: Record<LanguageCode, Record<string,string>> = {
  AR:{ "اليوم":"اليوم", "الكاشير":"الكاشير", "المواعيد":"المواعيد", "العميلات":"العميلات", "الخدمات":"الخدمات", "الفريق":"الفريق", "المخزون":"المخزون", "الفواتير":"الفواتير", "المصروفات":"المصروفات", "التقارير":"التقارير", "الاشتراك":"الاشتراك", "الإعدادات":"الإعدادات" },
  EN:{ "اليوم":"Today", "الكاشير":"Cashier", "المواعيد":"Appointments", "العميلات":"Clients", "الخدمات":"Services", "الفريق":"Team", "المخزون":"Inventory", "الفواتير":"Invoices", "المصروفات":"Expenses", "التقارير":"Reports", "الاشتراك":"Subscription", "الإعدادات":"Settings" },
  UR:{ "اليوم":"آج", "الكاشير":"کیشیئر", "المواعيد":"اپائنٹمنٹس", "العميلات":"کلائنٹس", "الخدمات":"خدمات", "الفريق":"ٹیم", "المخزون":"انوینٹری", "الفواتير":"رسیدیں", "المصروفات":"اخراجات", "التقارير":"رپورٹس", "الاشتراك":"سبسکرپشن", "الإعدادات":"ترتیبات" },
  FA:{ "اليوم":"امروز", "الكاشير":"صندوق", "المواعيد":"نوبت‌ها", "العميلات":"مشتریان", "الخدمات":"خدمات", "الفريق":"تیم", "المخزون":"موجودی", "الفواتير":"فاکتورها", "المصروفات":"هزینه‌ها", "التقارير":"گزارش‌ها", "الاشتراك":"اشتراک", "الإعدادات":"تنظیمات" },
  ZH:{ "اليوم":"今日", "الكاشير":"收银台", "المواعيد":"预约", "العميلات":"客户", "الخدمات":"服务", "الفريق":"团队", "المخزون":"库存", "الفواتير":"发票", "المصروفات":"费用", "التقارير":"报表", "الاشتراك":"订阅", "الإعدادات":"设置" },
  KO:{ "اليوم":"오늘", "الكاشير":"계산대", "المواعيد":"예약", "العميلات":"고객", "الخدمات":"서비스", "الفريق":"팀", "المخزون":"재고", "الفواتير":"청구서", "المصروفات":"비용", "التقارير":"보고서", "الاشتراك":"구독", "الإعدادات":"설정" },
  IT:{ "اليوم":"Oggi", "الكاشير":"Cassa", "المواعيد":"Appuntamenti", "العميلات":"Clienti", "الخدمات":"Servizi", "الفريق":"Team", "المخزون":"Magazzino", "الفواتير":"Fatture", "المصروفات":"Spese", "التقارير":"Report", "الاشتراك":"Abbonamento", "الإعدادات":"Impostazioni" },
  ES:{ "اليوم":"Hoy", "الكاشير":"Caja", "المواعيد":"Citas", "العميلات":"Clientas", "الخدمات":"Servicios", "الفريق":"Equipo", "المخزون":"Inventario", "الفواتير":"Facturas", "المصروفات":"Gastos", "التقارير":"Informes", "الاشتراك":"Suscripción", "الإعدادات":"Ajustes" },
  HE:{ "اليوم":"היום", "الكاشير":"קופה", "المواعيد":"תורים", "العميلات":"לקוחות", "الخدمات":"שירותים", "الفريق":"צוות", "المخزون":"מלאי", "الفواتير":"חשבוניות", "المصروفات":"הוצאות", "التقارير":"דוחות", "الاشتراك":"מנוי", "الإعدادات":"הגדרות" },
  FR:{ "اليوم":"Aujourd’hui", "الكاشير":"Caisse", "المواعيد":"Rendez-vous", "العميلات":"Clientes", "الخدمات":"Services", "الفريق":"Équipe", "المخزون":"Stock", "الفواتير":"Factures", "المصروفات":"Dépenses", "التقارير":"Rapports", "الاشتراك":"Abonnement", "الإعدادات":"Paramètres" },
  RU:{ "اليوم":"Сегодня", "الكاشير":"Касса", "المواعيد":"Записи", "العميلات":"Клиенты", "الخدمات":"Услуги", "الفريق":"Команда", "المخزون":"Склад", "الفواتير":"Счета", "المصروفات":"Расходы", "التقارير":"Отчёты", "الاشتراك":"Подписка", "الإعدادات":"Настройки" },
};

const shellTranslations: Record<LanguageCode, { eyebrow:string; greeting:string; welcome:string; newAppointment:string; moduleEyebrow:string; moduleDescription:string; action:string; languageTitle:string; languagePrompt:string; selected:string }> = {
  AR:{ eyebrow:"لمسة جميلة ليوم منظم", greeting:"صباح الجمال", welcome:"كل مواعيد صالونك وفريقك بين يديك.", newAppointment:"موعد جديد", moduleEyebrow:"عمل منظم ونتائج واضحة", moduleDescription:"كل سجلات ومهام هذا القسم بين يديك.", action:"سجل جديد", languageTitle:"لغة النظام", languagePrompt:"اختاري اللغة التي تريدين استخدامها.", selected:"تم تغيير لغة النظام" },
  EN:{ eyebrow:"A beautiful touch for an organized day", greeting:"Good morning", welcome:"Your salon appointments and team are all at your fingertips.", newAppointment:"New appointment", moduleEyebrow:"Organized work, clear results", moduleDescription:"All records and tasks for this section are here.", action:"New record", languageTitle:"System language", languagePrompt:"Choose the language you want to use.", selected:"System language changed" },
  UR:{ eyebrow:"منظم دن کے لیے خوبصورت لمس", greeting:"صبح بخیر", welcome:"آپ کے سیلون کی تمام اپائنٹمنٹس اور ٹیم آپ کے ہاتھ میں ہیں۔", newAppointment:"نئی اپائنٹمنٹ", moduleEyebrow:"منظم کام، واضح نتائج", moduleDescription:"اس سیکشن کے تمام ریکارڈز اور کام یہاں ہیں۔", action:"نیا ریکارڈ", languageTitle:"سسٹم کی زبان", languagePrompt:"اپنی پسندیدہ زبان منتخب کریں۔", selected:"سسٹم کی زبان تبدیل کر دی گئی" },
  FA:{ eyebrow:"لمسی زیبا برای روزی منظم", greeting:"صبح بخیر", welcome:"همه نوبت‌ها و اعضای تیم سالن در دسترس شما هستند.", newAppointment:"نوبت جدید", moduleEyebrow:"کار منظم، نتیجه روشن", moduleDescription:"همه سوابق و وظایف این بخش اینجا هستند.", action:"رکورد جدید", languageTitle:"زبان سیستم", languagePrompt:"زبان مورد نظر خود را انتخاب کنید.", selected:"زبان سیستم تغییر کرد" },
  ZH:{ eyebrow:"为井然有序的一天增添美好", greeting:"早上好", welcome:"沙龙预约和团队信息尽在掌握。", newAppointment:"新建预约", moduleEyebrow:"工作有序，结果清晰", moduleDescription:"此部分的所有记录和任务都在这里。", action:"新建记录", languageTitle:"系统语言", languagePrompt:"请选择要使用的语言。", selected:"系统语言已更改" },
  KO:{ eyebrow:"정돈된 하루를 위한 아름다운 시작", greeting:"좋은 아침입니다", welcome:"살롱 예약과 팀 현황을 한눈에 확인하세요.", newAppointment:"새 예약", moduleEyebrow:"체계적인 업무, 명확한 결과", moduleDescription:"이 섹션의 모든 기록과 작업이 여기에 있습니다.", action:"새 기록", languageTitle:"시스템 언어", languagePrompt:"사용할 언어를 선택하세요.", selected:"시스템 언어가 변경되었습니다" },
  IT:{ eyebrow:"Un tocco di bellezza per una giornata organizzata", greeting:"Buongiorno", welcome:"Appuntamenti e team del salone sono a portata di mano.", newAppointment:"Nuovo appuntamento", moduleEyebrow:"Lavoro organizzato, risultati chiari", moduleDescription:"Tutti i dati e le attività di questa sezione sono qui.", action:"Nuovo record", languageTitle:"Lingua del sistema", languagePrompt:"Scegli la lingua da utilizzare.", selected:"Lingua del sistema modificata" },
  ES:{ eyebrow:"Un toque de belleza para un día organizado", greeting:"Buenos días", welcome:"Las citas y el equipo de tu salón están a tu alcance.", newAppointment:"Nueva cita", moduleEyebrow:"Trabajo organizado, resultados claros", moduleDescription:"Todos los registros y tareas de esta sección están aquí.", action:"Nuevo registro", languageTitle:"Idioma del sistema", languagePrompt:"Elige el idioma que deseas usar.", selected:"Idioma del sistema actualizado" },
  HE:{ eyebrow:"נגיעה יפה ליום מסודר", greeting:"בוקר טוב", welcome:"כל התורים וצוות הסלון נמצאים בהישג ידך.", newAppointment:"תור חדש", moduleEyebrow:"עבודה מסודרת, תוצאות ברורות", moduleDescription:"כל הרשומות והמשימות של החלק הזה נמצאות כאן.", action:"רשומה חדשה", languageTitle:"שפת המערכת", languagePrompt:"בחרי את השפה שבה תרצי להשתמש.", selected:"שפת המערכת שונתה" },
  FR:{ eyebrow:"Une touche de beauté pour une journée organisée", greeting:"Bonjour", welcome:"Les rendez-vous et l’équipe du salon sont à portée de main.", newAppointment:"Nouveau rendez-vous", moduleEyebrow:"Travail organisé, résultats clairs", moduleDescription:"Tous les dossiers et tâches de cette section sont ici.", action:"Nouveau dossier", languageTitle:"Langue du système", languagePrompt:"Choisissez la langue à utiliser.", selected:"Langue du système modifiée" },
  RU:{ eyebrow:"Красивое начало организованного дня", greeting:"Доброе утро", welcome:"Все записи и команда салона у вас под рукой.", newAppointment:"Новая запись", moduleEyebrow:"Организованная работа, ясный результат", moduleDescription:"Все записи и задачи этого раздела находятся здесь.", action:"Новая запись", languageTitle:"Язык системы", languagePrompt:"Выберите язык интерфейса.", selected:"Язык системы изменён" },
};

const days = [
  { d: "الأحد", n: "23", active: true }, { d: "الاثنين", n: "24" },
  { d: "الثلاثاء", n: "25" }, { d: "الأربعاء", n: "26" },
  { d: "الخميس", n: "27" }, { d: "الجمعة", n: "28" },
];

const initialAppointments = [
  { time: "09:00", name: "ريم الأحمد", service: "قص وتصفيف", employee: "ليان", color: "berry", status: "داخل الصالون", duration: "60 د" },
  { time: "10:30", name: "نور الخطيب", service: "صبغة كاملة", employee: "ميرا", color: "peach", status: "مؤكد", duration: "120 د" },
  { time: "12:00", name: "سارة منصور", service: "عناية بالبشرة", employee: "رنا", color: "lilac", status: "مؤكد", duration: "45 د" },
  { time: "13:30", name: "لمى عادل", service: "مناكير وباديكير", employee: "جنى", color: "gold", status: "بانتظار التأكيد", duration: "75 د" },
  { time: "15:00", name: "فرح علي", service: "تسريحة مناسبة", employee: "ليان", color: "rose", status: "مؤكد", duration: "90 د" },
];

type CashierService = { id: string; name: string; category: string; price: number; barcode: string };
type CartItem = CashierService & { quantity: number };

const initialCashierServices: CashierService[] = [
  { id:"service-cut", name:"قص وتصفيف", category:"الشعر", price:180, barcode:"628100000101" },
  { id:"service-color", name:"صبغة كاملة", category:"الشعر", price:450, barcode:"628100000102" },
  { id:"service-roots", name:"صبغة جذور", category:"الشعر", price:260, barcode:"628100000103" },
  { id:"service-skin", name:"عناية بالبشرة", category:"البشرة", price:220, barcode:"628100000104" },
  { id:"service-nails", name:"مناكير وباديكير", category:"الأظافر", price:160, barcode:"628100000105" },
  { id:"service-style", name:"تسريحة مناسبة", category:"الشعر", price:320, barcode:"628100000106" },
  { id:"product-shampoo", name:"شامبو حماية اللون", category:"منتجات", price:135, barcode:"628100000201" },
  { id:"product-mask", name:"قناع ترطيب عميق", category:"منتجات", price:175, barcode:"628100000202" },
];

type SubscriptionPlan = { id: string; name: string; duration: string; price: number; note: string; features: string[]; popular?: boolean };
const subscriptionPlans: SubscriptionPlan[] = [
  { id:"trial", name:"تجربة مجانية", duration:"7 أيام", price:0, note:"جرّبي النظام كاملًا قبل الاشتراك", features:["جميع أقسام الصالون", "الكاشير والمواعيد", "لا تحتاج بطاقة دفع"] },
  { id:"monthly", name:"الاشتراك الشهري", duration:"كل شهر", price:179, note:"مرونة كاملة دون التزام طويل", features:["كامل المزايا والتحديثات", "النسخ الاحتياطي", "دعم فني مستمر"] },
  { id:"yearly", name:"الاشتراك السنوي", duration:"12 شهرًا", price:1799, note:"وفّري 349 د.إ سنويًا", popular:true, features:["كامل المزايا والتحديثات", "أولوية في الدعم", "ترخيص سنوي متكامل"] },
  { id:"lifetime", name:"مدى الحياة", duration:"دفعة واحدة", price:5999, note:"ترخيص دائم بدون تجديد", features:["استخدام دائم للنظام", "جميع المزايا الحالية", "تحديثات أساسية مستمرة"] },
];

const team = [
  { name: "ليان", role: "خبيرة شعر", load: 82, tone: "#9f315d" },
  { name: "ميرا", role: "خبيرة ألوان", load: 68, tone: "#d97973" },
  { name: "رنا", role: "عناية وبشرة", load: 54, tone: "#8f78a9" },
  { name: "جنى", role: "أظافر", load: 40, tone: "#c18b53" },
];

type ModuleRow = { main: string; sub: string; meta: string; badge: string };
type ModuleInfo = {
  kicker: string; title: string; desc: string; action: string;
  stats: { label: string; value: string; note: string }[];
  rows: ModuleRow[];
};

const modules: Record<string, ModuleInfo> = {
  "الكاشير": { kicker:"بيع سريع وواضح",title:"كاشير الصالون",desc:"أضيفي الخدمات والمنتجات وأكملي الدفع من شاشة واحدة.",action:"بدء عملية بيع",stats:[{label:"مبيعات اليوم",value:"4,280",note:"د.إ"},{label:"الفواتير",value:"18",note:"فاتورة"},{label:"متوسط الفاتورة",value:"238",note:"د.إ"}],rows:[{main:"قص وتصفيف — ريم الأحمد",sub:"الخدمة اكتملت • ليان",meta:"189 د.إ",badge:"جاهز للدفع"},{main:"صبغة كاملة — نور الخطيب",sub:"الخدمة قيد التنفيذ • ميرا",meta:"472.50 د.إ",badge:"مفتوح"},{main:"عناية بالبشرة — سارة منصور",sub:"الخدمة اكتملت • رنا",meta:"231 د.إ",badge:"مدفوع"},{main:"مناكير وباديكير — لمى عادل",sub:"موعد 1:30 م • جنى",meta:"168 د.إ",badge:"قادم"}]},
  "المواعيد": { kicker:"الروزنامة الذكية",title:"إدارة المواعيد",desc:"رتّبي الحجوزات، التأكيدات وقائمة الانتظار من شاشة واحدة.",action:"حجز موعد",stats:[{label:"هذا الشهر",value:"126",note:"موعد"},{label:"نسبة التأكيد",value:"92%",note:"ممتاز"},{label:"قائمة الانتظار",value:"8",note:"عميلات"}],rows:[{main:"تالا حسن",sub:"صبغة جذور • اليوم 5:30 م",meta:"ميرا",badge:"مؤكد"},{main:"نغم يوسف",sub:"قص وتصفيف • غدًا 10:00 ص",meta:"ليان",badge:"جديد"},{main:"ديما خالد",sub:"تنظيف بشرة • غدًا 1:30 م",meta:"رنا",badge:"مدفوع"},{main:"هيا منصور",sub:"باديكير • الخميس 4:00 م",meta:"جنى",badge:"انتظار"}]},
  "العميلات": { kicker:"علاقات تدوم",title:"ملفات العميلات",desc:"سجل زيارات وتفضيلات ونقاط ولاء لكل عميلة.",action:"عميلة جديدة",stats:[{label:"إجمالي العميلات",value:"842",note:"ملف"},{label:"عميلات جديدات",value:"38",note:"هذا الشهر"},{label:"نادي الولاء",value:"217",note:"عضوة"}],rows:[{main:"ريم الأحمد",sub:"12 زيارة • تفضّل ليان",meta:"1,240 نقطة",badge:"VIP"},{main:"نور الخطيب",sub:"8 زيارات • آخر زيارة اليوم",meta:"760 نقطة",badge:"نشطة"},{main:"سارة منصور",sub:"5 زيارات • عناية بالبشرة",meta:"410 نقطة",badge:"موعد قريب"},{main:"لمى عادل",sub:"3 زيارات • أظافر",meta:"280 نقطة",badge:"جديدة"}]},
  "الخدمات": { kicker:"قائمة الجمال",title:"الخدمات والباقات",desc:"أسعار الخدمات ومددها والخبيرات المتاحات لها.",action:"خدمة جديدة",stats:[{label:"الخدمات",value:"34",note:"خدمة"},{label:"متوسط الفاتورة",value:"210",note:"د.إ"},{label:"الأكثر طلبًا",value:"تصفيف",note:"هذا الأسبوع"}],rows:[{main:"قص وتصفيف",sub:"60 دقيقة • ليان وميرا",meta:"180 د.إ",badge:"الأكثر طلبًا"},{main:"صبغة كاملة",sub:"120 دقيقة • ميرا",meta:"450 د.إ",badge:"مميز"},{main:"عناية بالبشرة",sub:"45 دقيقة • رنا",meta:"220 د.إ",badge:"متاح"},{main:"مناكير وباديكير",sub:"75 دقيقة • جنى",meta:"160 د.إ",badge:"باقة"}]},
  "الفريق": { kicker:"فريقك أولًا",title:"فريق العمل",desc:"الجداول والأداء والعمولات والحضور في مكان واضح.",action:"إضافة موظفة",stats:[{label:"الفريق",value:"9",note:"موظفات"},{label:"ساعات اليوم",value:"72",note:"ساعة"},{label:"رضا العميلات",value:"4.9",note:"من 5"}],rows:[{main:"ليان يوسف",sub:"خبيرة شعر • دوام 9 ص–6 م",meta:"18 موعدًا",badge:"متاحة"},{main:"ميرا سالم",sub:"خبيرة ألوان • دوام 10 ص–7 م",meta:"12 موعدًا",badge:"مع عميلة"},{main:"رنا جابر",sub:"عناية وبشرة • دوام 9 ص–5 م",meta:"9 مواعيد",badge:"استراحة"},{main:"جنى علي",sub:"فنية أظافر • دوام 11 ص–8 م",meta:"14 موعدًا",badge:"متاحة"}]},
  "المخزون": { kicker:"مخزون بلا مفاجآت",title:"المنتجات والمخزون",desc:"راقبي الاستهلاك والتوريد وحدود التنبيه لكل منتج.",action:"إضافة منتج",stats:[{label:"المنتجات",value:"184",note:"صنف"},{label:"مخزون منخفض",value:"7",note:"تنبيهات"},{label:"قيمة المخزون",value:"28,640",note:"د.إ"}],rows:[{main:"صبغة شعر — بني داكن",sub:"L’Oréal • كود 4.0",meta:"6 وحدات",badge:"منخفض"},{main:"شامبو حماية اللون",sub:"Kerastase • 500ml",meta:"18 وحدة",badge:"متوفر"},{main:"قناع ترطيب عميق",sub:"Moroccanoil • 250ml",meta:"11 وحدة",badge:"متوفر"},{main:"طلاء أظافر — Berry",sub:"OPI • 15ml",meta:"4 وحدات",badge:"اطلبي الآن"}]},
  "الفواتير": { kicker:"حسابات أنيقة",title:"الفواتير والمدفوعات",desc:"فواتير واضحة، طرق دفع متعددة وضريبة محسوبة تلقائيًا.",action:"فاتورة جديدة",stats:[{label:"فواتير الشهر",value:"1,248",note:"فاتورة"},{label:"مبالغ معلّقة",value:"3,560",note:"د.إ"},{label:"الضريبة",value:"5%",note:"UAE VAT"}],rows:[{main:"INV-2026-1842",sub:"ريم الأحمد • اليوم 11:05 ص",meta:"315 د.إ",badge:"مدفوع"},{main:"INV-2026-1841",sub:"نور الخطيب • اليوم 10:32 ص",meta:"472.50 د.إ",badge:"بطاقة"},{main:"INV-2026-1840",sub:"هلا عارف • أمس 7:18 م",meta:"210 د.إ",badge:"نقدي"},{main:"INV-2026-1839",sub:"سارة منصور • أمس 6:44 م",meta:"231 د.إ",badge:"مدفوع"}]},
  "المصروفات": { kicker:"صورة مالية هادئة",title:"المصروفات",desc:"تابعي المصاريف التشغيلية والموردين دون فقدان أي إيصال.",action:"إضافة مصروف",stats:[{label:"مصروفات الشهر",value:"18,900",note:"د.إ"},{label:"تشغيلية",value:"71%",note:"من الإجمالي"},{label:"بانتظار المراجعة",value:"4",note:"إيصالات"}],rows:[{main:"توريد صبغات ومنتجات",sub:"شركة الجمال للتوريد • 22 أغسطس",meta:"3,850 د.إ",badge:"معتمد"},{main:"إيجار الفرع",sub:"دفعة شهر أغسطس",meta:"8,000 د.إ",badge:"مدفوع"},{main:"تسويق وإعلانات",sub:"حملة نهاية الصيف",meta:"1,420 د.إ",badge:"مراجعة"},{main:"صيانة أجهزة",sub:"كرسي عناية بالبشرة",meta:"620 د.إ",badge:"معتمد"}]},
  "التقارير": { kicker:"أرقام تتكلم",title:"التقارير والتحليلات",desc:"افهمي المبيعات والمواعيد والأداء من دون جداول معقّدة.",action:"تصدير تقرير",stats:[{label:"مبيعات الشهر",value:"128,450",note:"د.إ"},{label:"نمو المبيعات",value:"+18%",note:"عن الشهر السابق"},{label:"الحجوزات",value:"452",note:"هذا الشهر"}],rows:[{main:"تقرير المبيعات اليومي",sub:"تفصيل الخدمات والمنتجات والضريبة",meta:"23 أغسطس",badge:"جاهز"},{main:"أداء فريق العمل",sub:"المواعيد والإيراد والتقييم",meta:"أغسطس",badge:"محدّث"},{main:"تحليل الخدمات",sub:"الأكثر طلبًا وربحية",meta:"آخر 30 يومًا",badge:"جديد"},{main:"تقرير ضريبة القيمة المضافة",sub:"المبيعات والمشتريات والمصروفات",meta:"الربع الثالث",badge:"5%"}]},
  "الاشتراك": { kicker:"VAREX Premium",title:"الاشتراك والترخيص",desc:"تفاصيل خطتك والأجهزة المرتبطة وتاريخ التجديد.",action:"إدارة الاشتراك",stats:[{label:"الخطة الحالية",value:"سنوية",note:"Premium"},{label:"التجديد",value:"23/8/2027",note:"تجديد تلقائي"},{label:"الأجهزة",value:"3",note:"من 5"}],rows:[{main:"فرع دبي الرئيسي",sub:"جهاز الكاشير الرئيسي",meta:"متصل الآن",badge:"نشط"},{main:"جهاز الاستقبال",sub:"Honor Tablet",meta:"آخر دخول اليوم",badge:"نشط"},{main:"جهاز الإدارة",sub:"Samsung Android",meta:"آخر دخول أمس",badge:"موثوق"},{main:"نسخة احتياطية تلقائية",sub:"يوميًا الساعة 3:00 ص",meta:"آخر نسخة ناجحة",badge:"محمي"}]},
  "الإعدادات": { kicker:"مساحتك الخاصة",title:"إعدادات الصالون",desc:"هوية المنشأة والفروع والإشعارات والصلاحيات.",action:"حفظ الإعدادات",stats:[{label:"أقسام الإعداد",value:"12",note:"قسم"},{label:"اللغات",value:"2",note:"العربية / English"},{label:"الفرع النشط",value:"دبي",note:"الرئيسي"}],rows:[{main:"بيانات الصالون",sub:"الاسم، الشعار، الهاتف والعنوان",meta:"مكتمل",badge:"فتح"},{main:"ساعات العمل",sub:"الأحد إلى السبت وفترات الاستراحة",meta:"9 ص–9 م",badge:"تعديل"},{main:"المستخدمون والصلاحيات",sub:"المالك، المديرة، الاستقبال والخبيرات",meta:"12 مستخدمًا",badge:"إدارة"},{main:"الإشعارات والتذكيرات",sub:"واتساب، بريد وتنبيهات داخلية",meta:"مفعّلة",badge:"ضبط"}]},
};

const formCopy: Record<string, { title: string; main: string; sub: string; meta: string; badge: string; defaultBadge: string }> = {
  "الكاشير": { title:"عملية بيع",main:"اسم العميلة أو العملية",sub:"الخدمات أو المنتجات",meta:"الإجمالي",badge:"حالة الدفع",defaultBadge:"مفتوح" },
  "المواعيد": { title:"موعد",main:"اسم العميلة",sub:"الخدمة والوقت",meta:"الخبيرة",badge:"الحالة",defaultBadge:"مؤكد" },
  "العميلات": { title:"ملف عميلة",main:"اسم العميلة",sub:"الهاتف أو الملاحظات",meta:"نقاط الولاء",badge:"التصنيف",defaultBadge:"جديدة" },
  "الخدمات": { title:"خدمة",main:"اسم الخدمة",sub:"المدة والخبيرات",meta:"السعر",badge:"التصنيف",defaultBadge:"متاح" },
  "الفريق": { title:"موظفة",main:"اسم الموظفة",sub:"المسمى وساعات العمل",meta:"المواعيد",badge:"الحالة",defaultBadge:"متاحة" },
  "المخزون": { title:"منتج",main:"اسم المنتج",sub:"الماركة أو الكود",meta:"الكمية",badge:"الحالة",defaultBadge:"متوفر" },
  "الفواتير": { title:"فاتورة",main:"رقم الفاتورة",sub:"اسم العميلة والتاريخ",meta:"الإجمالي",badge:"طريقة الدفع",defaultBadge:"غير مدفوع" },
  "المصروفات": { title:"مصروف",main:"وصف المصروف",sub:"المورد أو التاريخ",meta:"القيمة",badge:"الحالة",defaultBadge:"مراجعة" },
  "التقارير": { title:"تقرير",main:"اسم التقرير",sub:"النطاق والتفاصيل",meta:"الفترة",badge:"الحالة",defaultBadge:"جاهز" },
  "الاشتراك": { title:"جهاز أو ترخيص",main:"الاسم",sub:"التفاصيل",meta:"آخر اتصال",badge:"الحالة",defaultBadge:"نشط" },
  "الإعدادات": { title:"إعداد",main:"اسم الإعداد",sub:"القيمة أو الوصف",meta:"الحالة الحالية",badge:"الإجراء",defaultBadge:"محفوظ" },
};

const attentionBadges = new Set(["مفتوح", "انتظار", "منخفض", "مراجعة", "غير مدفوع", "اطلبي الآن", "جديد", "بانتظار التأكيد"]);

function freshRecords(): Record<string, ModuleRow[]> {
  return Object.fromEntries(Object.entries(modules).map(([key, value]) => [key, value.rows.map(row => ({ ...row }))]));
}

type UtilityModal = "users" | "language" | "appearance" | "notifications" | "plans" | "insight" | null;
type RecordDialog = { module: string; mode: "new" | "edit"; index?: number } | null;

export default function Home() {
  const [active, setActive] = useState("اليوم");
  const [sound, setSound] = useState(true);
  const [zoom, setZoom] = useState(90);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [toastMessage, setToastMessage] = useState("");
  const [appointmentModal, setAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<number | null>(null);
  const [appointmentRows, setAppointmentRows] = useState(initialAppointments);
  const [draft, setDraft] = useState({ name: "", phone: "", service: "قص وتصفيف", employee: "ليان", time: "16:30", notes: "" });
  const [records, setRecords] = useState<Record<string, ModuleRow[]>>(freshRecords);
  const [recordDialog, setRecordDialog] = useState<RecordDialog>(null);
  const [recordDraft, setRecordDraft] = useState<ModuleRow>({ main:"", sub:"", meta:"", badge:"" });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "done">("all");
  const [selectedDay, setSelectedDay] = useState("23");
  const [utilityModal, setUtilityModal] = useState<UtilityModal>(null);
  const [theme, setTheme] = useState("soft");
  const [language, setLanguage] = useState<LanguageCode>("AR");
  const [activeUser, setActiveUser] = useState("المالكة");
  const [selectedPlan, setSelectedPlan] = useState("الاشتراك السنوي");
  const [notifications, setNotifications] = useState(["موعد ريم يبدأ بعد 20 دقيقة", "مخزون الصبغة البنية منخفض", "تم دفع الفاتورة INV-2026-1842"]);
  const [hydrated, setHydrated] = useState(false);
  const [cashierServices, setCashierServices] = useState<CashierService[]>(initialCashierServices);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashierSearch, setCashierSearch] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({ name:"", category:"الخدمات", price:"", barcode:"" });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("وجّهي الكاميرا نحو الباركود");
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const translationRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    try {
      const saved = window.localStorage.getItem("varex_salon_state_v2");
      if (saved) {
        const data = JSON.parse(saved) as { records?: Record<string, ModuleRow[]>; appointments?: typeof initialAppointments; theme?: string; language?: string; user?: string; plan?: string; services?: CashierService[]; cart?: CartItem[] };
        if (data.records) setRecords({ ...freshRecords(), ...data.records });
        if (data.appointments) setAppointmentRows(data.appointments);
        if (data.theme) setTheme(data.theme);
        if (data.language && languageOptions.some(option => option.code === data.language)) setLanguage(data.language as LanguageCode);
        if (data.user) setActiveUser(data.user);
        if (data.plan) {
          const planAliases: Record<string,string> = { "شهرية":"الاشتراك الشهري", "سنوية":"الاشتراك السنوي", "مدى الحياة":"مدى الحياة" };
          setSelectedPlan(planAliases[data.plan] || data.plan);
        }
        if (data.services) setCashierServices(data.services);
        if (data.cart) setCart(data.cart);
      }
    } catch { /* local state recovery is best-effort */ }
    setHydrated(true);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("varex_salon_state_v2", JSON.stringify({ records, appointments: appointmentRows, theme, language, user: activeUser, plan: selectedPlan, services:cashierServices, cart }));
  }, [records, appointmentRows, theme, language, activeUser, selectedPlan, cashierServices, cart, hydrated]);

  useEffect(() => {
    if (!scannerOpen) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    async function startScanner() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");
        stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" } }, audio:false });
        if (!scannerVideoRef.current || stopped) return;
        scannerVideoRef.current.srcObject = stream;
        await scannerVideoRef.current.play();
        const BarcodeCtor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: HTMLVideoElement): Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
        if (!BarcodeCtor) {
          setScannerMessage("الكاميرا جاهزة، لكن المتصفح لا يدعم قراءة الباركود. استخدمي خانة الباركود أو القارئ الخارجي.");
          return;
        }
        const detector = new BarcodeCtor({ formats:["ean_13","ean_8","code_128","qr_code","upc_a","upc_e"] });
        const detect = async () => {
          if (stopped || !scannerVideoRef.current) return;
          try {
            const codes = await detector.detect(scannerVideoRef.current);
            if (codes[0]?.rawValue) {
              processBarcode(codes[0].rawValue, true);
              setScannerOpen(false);
              return;
            }
          } catch { /* keep scanning */ }
          timer = window.setTimeout(detect, 350);
        };
        detect();
      } catch {
        setScannerMessage("تعذر تشغيل الكاميرا. اسمحي بالوصول إليها أو استخدمي القارئ الخارجي.");
      }
    }
    startScanner();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [scannerOpen, cashierServices]);

  const languageProfile = languageOptions.find(option => option.code === language) || languageOptions[0];
  const shell = shellTranslations[language];
  useSystemTranslation(translationRootRef, language, languageProfile.htmlLang);
  const locale = languageProfile.locale;
  const time = useMemo(() => now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }), [now, locale]);
  const date = useMemo(() => now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }), [now, locale]);
  const moduleInfo = modules[active];
  const activeRows = records[active] || [];
  const visibleRows = useMemo(() => activeRows.map((row, index) => ({ row, index })).filter(({ row }) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [row.main, row.sub, row.meta, row.badge].some(value => value.toLowerCase().includes(query));
    const matchesFilter = filter === "all" || (filter === "attention" ? attentionBadges.has(row.badge) : !attentionBadges.has(row.badge));
    return matchesSearch && matchesFilter;
  }), [activeRows, searchTerm, filter]);
  const visibleAppointments = useMemo(() => appointmentRows.map((item, index) => ({ item, index })).filter(({ item }) => {
    const query = searchTerm.trim().toLowerCase();
    return !query || [item.name, item.service, item.employee, item.status].some(value => value.toLowerCase().includes(query));
  }), [appointmentRows, searchTerm]);
  const filteredCashierServices = useMemo(() => {
    const query = cashierSearch.trim().toLowerCase();
    return cashierServices.filter(service => !query || [service.name, service.category, service.barcode].some(value => value.toLowerCase().includes(query)));
  }, [cashierServices, cashierSearch]);
  const cashierSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cashierTax = cashierSubtotal * .05;
  const cashierTotal = cashierSubtotal + cashierTax;
  const money = (value: number) => new Intl.NumberFormat("ar-AE", { minimumFractionDigits:2, maximumFractionDigits:2 }).format(value);

  function tap() {
    if (!sound) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 620;
      gain.gain.setValueAtTime(.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .06);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .06);
    } catch { /* sound is optional */ }
  }

  function toast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2200);
  }

  function chooseNav(label: string) {
    tap();
    setActive(label);
    setSearchOpen(false);
    setSearchTerm("");
    setFilter("all");
  }

  function openAppointment(timeValue = "16:30") {
    tap();
    setDraft({ name:"", phone:"", service:"قص وتصفيف", employee:"ليان", time:timeValue, notes:"" });
    setAppointmentModal(true);
  }

  function saveAppointment(event: React.FormEvent) {
    event.preventDefault();
    tap();
    setAppointmentRows(rows => [...rows, { time:draft.time, name:draft.name, service:draft.service, employee:draft.employee, color:"berry", status:"مؤكد", duration:"60 د" }]);
    setAppointmentModal(false);
    toast("تم حفظ الموعد وإضافته إلى الجدول");
  }

  function updateAppointmentStatus(index: number, status: string) {
    setAppointmentRows(rows => rows.map((item, itemIndex) => itemIndex === index ? { ...item, status } : item));
    setSelectedAppointment(null);
    toast("تم تحديث حالة الموعد");
  }

  function exportReport() {
    tap();
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = Object.entries(records).flatMap(([section, items]) => items.map(item => [section, item.main, item.sub, item.meta, item.badge]));
    const csv = "\uFEFF" + [["القسم", "الاسم", "التفاصيل", "القيمة", "الحالة"], ...rows].map(row => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `varex-salon-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast("تم تنزيل تقرير الصالون");
  }

  function addToCart(service: CashierService) {
    tap();
    setCart(current => {
      const existing = current.find(item => item.id === service.id);
      return existing ? current.map(item => item.id === service.id ? { ...item, quantity:item.quantity + 1 } : item) : [...current, { ...service, quantity:1 }];
    });
    toast(`تمت إضافة ${service.name} — ${money(service.price)} د.إ`);
  }

  function changeCartQuantity(id: string, amount: number) {
    tap();
    setCart(current => current.map(item => item.id === id ? { ...item, quantity:item.quantity + amount } : item).filter(item => item.quantity > 0));
  }

  function processBarcode(value = barcodeValue, fromCamera = false) {
    const code = value.trim();
    if (!code) return;
    const service = cashierServices.find(item => item.barcode.toLowerCase() === code.toLowerCase());
    if (service) addToCart(service);
    else toast(`الباركود ${code} غير مسجل — أضيفي الخدمة أولًا`);
    if (!fromCamera) setBarcodeValue("");
  }

  function saveCashierService(event: React.FormEvent) {
    event.preventDefault();
    const price = Number(serviceDraft.price);
    if (!serviceDraft.name.trim() || !Number.isFinite(price) || price <= 0) return;
    const barcode = serviceDraft.barcode.trim() || `VAREX-${Date.now().toString().slice(-8)}`;
    if (cashierServices.some(service => service.barcode === barcode)) {
      toast("هذا الباركود مستخدم لخدمة أخرى");
      return;
    }
    const service: CashierService = { id:`custom-${Date.now()}`, name:serviceDraft.name.trim(), category:serviceDraft.category.trim() || "الخدمات", price, barcode };
    setCashierServices(current => [service, ...current]);
    setServiceModal(false);
    setServiceDraft({ name:"", category:"الخدمات", price:"", barcode:"" });
    toast("تم حفظ الخدمة وإضافتها إلى شاشة الكاشير");
  }

  function printInvoice() {
    if (cart.length === 0) return toast("أضيفي خدمة إلى الفاتورة قبل الطباعة");
    tap();
    window.print();
  }

  function completeSale() {
    if (cart.length === 0) return toast("أضيفي خدمة واحدة على الأقل لإتمام البيع");
    tap();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    setRecords(current => ({ ...current, "الفواتير":[{ main:invoiceNumber, sub:`${itemCount} خدمات ومنتجات • ${paymentMethod}`, meta:`${money(cashierTotal)} د.إ`, badge:"مدفوع" }, ...(current["الفواتير"] || [])] }));
    setNotifications(current => [`تم تحصيل ${money(cashierTotal)} د.إ عبر ${paymentMethod}`, ...current]);
    setCart([]);
    toast(`تمت عملية البيع بنجاح — ${invoiceNumber}`);
  }

  function activateSubscription(plan: SubscriptionPlan) {
    tap();
    setSelectedPlan(plan.name);
    if (plan.price === 0) {
      setNotifications(current => ["تم تفعيل تجربة VAREX المجانية لمدة 7 أيام", ...current]);
      toast("تم تفعيل التجربة المجانية لمدة 7 أيام");
      return;
    }
    const paypalUrl = `https://paypal.me/varexapp26/${plan.price}AED`;
    window.open(paypalUrl, "_blank", "noopener,noreferrer");
    toast(`تم تحويلك إلى PayPal لدفع ${plan.price.toLocaleString("ar-AE")} د.إ`);
  }

  function handlePrimaryAction() {
    if (active === "اليوم" || active === "المواعيد") return openAppointment();
    if (active === "الكاشير") {
      tap();
      if (cart.length > 0) toast("الفاتورة الحالية مفتوحة؛ أكمليها أو أفرغيها لبدء فاتورة جديدة");
      else toast("فاتورة جديدة جاهزة — اختاري خدمة من القائمة");
      return;
    }
    if (active === "الاشتراك") {
      const plan = subscriptionPlans.find(item => item.name === selectedPlan) || subscriptionPlans[2];
      activateSubscription(plan);
      return;
    }
    if (active === "التقارير") return exportReport();
    const copy = formCopy[active];
    tap();
    setRecordDraft({ main:"", sub:"", meta:"", badge:copy?.defaultBadge || "جديد" });
    setRecordDialog({ module:active, mode:"new" });
  }

  function openRecord(module: string, row: ModuleRow, index: number) {
    tap();
    setRecordDraft({ ...row });
    setRecordDialog({ module, mode:"edit", index });
  }

  function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!recordDialog) return;
    const { module, mode, index } = recordDialog;
    setRecords(current => {
      const next = [...(current[module] || [])];
      if (mode === "new") next.unshift({ ...recordDraft });
      else if (index !== undefined) next[index] = { ...recordDraft };
      return { ...current, [module]:next };
    });
    setRecordDialog(null);
    toast(mode === "new" ? "تم حفظ السجل وإضافته للقسم" : "تم حفظ التعديلات");
  }

  function deleteRecord() {
    if (!recordDialog || recordDialog.index === undefined) return;
    const { module, index } = recordDialog;
    setRecords(current => ({ ...current, [module]:(current[module] || []).filter((_, itemIndex) => itemIndex !== index) }));
    setRecordDialog(null);
    toast("تم حذف السجل");
  }

  function selectUtility(message: string) {
    setUtilityModal(null);
    toast(message);
  }

  return (
    <div ref={translationRootRef} className={`salon-app theme-${theme}`} dir={languageProfile.dir} lang={languageProfile.htmlLang}>
      <div className={"scale-layer scale-" + zoom}>
        <header className="topbar">
          <div className="control-cluster" aria-label="أدوات النظام">
            <div className="time-chip"><Icon name="clock" size={17}/><span>{time}</span></div>
            <div className="date-chip"><Icon name="calendar" size={17}/><span>{date}</span></div>
            <button className="icon-control" onClick={() => { tap(); setUtilityModal("users"); }} title="تبديل المستخدم"><Icon name="switch"/></button>
            <button className="icon-control language-control" onClick={() => { tap(); setUtilityModal("language"); }} title="اللغة"><Icon name="language"/><b>{language}</b></button>
            <button className={sound ? "icon-control active" : "icon-control"} onClick={() => { tap(); setSound(!sound); toast(sound ? "تم إيقاف الصوت" : "تم تشغيل الصوت"); }} title="الصوت"><Icon name="sound"/></button>
            <div className="zoom-wrap">
              <button className="text-control size-control" onClick={() => { tap(); setZoomOpen(!zoomOpen); }} title="الحجم"><Icon name="size" size={17}/><span>{zoom}%</span></button>
              {zoomOpen && <div className="zoom-menu">{[100,90,80,70,60,50].map(v => <button key={v} className={v === zoom ? "selected" : ""} onClick={() => { tap(); setZoom(v); setZoomOpen(false); toast(`تم ضبط الحجم على ${v}%`); }}>{v}%</button>)}</div>}
            </div>
            <button className="icon-control appearance-control" onClick={() => { tap(); setUtilityModal("appearance"); }} title="المظهر"><Icon name="appearance"/><b>المظهر</b></button>
            <button className="notification-control" onClick={() => { tap(); setUtilityModal("notifications"); }} title="الإشعارات"><Icon name="bell"/>{notifications.length > 0 && <i>{notifications.length}</i>}</button>
          </div>
          <div className="brand-lockup" aria-label="VAREX Business Management System">
            <img src="/brand/varex-logo-salon-approved.png" alt="VAREX Business Management System" />
            <div className="brand-copy" dir="ltr"><strong>VAREX</strong><span>BUSINESS MANAGEMENT SYSTEM</span></div>
          </div>
        </header>

        <main className="workspace">
          <section className="welcome-row">
            <div><p className="eyebrow"><Icon name="sparkles" size={17}/> {moduleInfo ? (language === "AR" ? moduleInfo.kicker : shell.moduleEyebrow) : shell.eyebrow}</p><h1>{moduleInfo ? (language === "AR" ? moduleInfo.title : navTranslations[language][active]) : shell.greeting}</h1><p>{moduleInfo ? (language === "AR" ? moduleInfo.desc : shell.moduleDescription) : `${shell.welcome}`}</p></div>
            <button className="primary-action" onClick={handlePrimaryAction}><Icon name={active === "التقارير" ? "chart" : active === "الاشتراك" ? "card" : "plus"}/><span>{language === "AR" ? (active === "الاشتراك" ? (selectedPlan === "تجربة مجانية" ? "تفعيل التجربة" : "الدفع عبر PayPal") : moduleInfo ? moduleInfo.action : "موعد جديد") : (moduleInfo ? shell.action : shell.newAppointment)}</span></button>
          </section>

          {active === "اليوم" ? <>
            <section className="metric-ribbon" aria-label="ملخص اليوم">
              <article><span className="metric-icon berry"><Icon name="calendar"/></span><div><small>مواعيد اليوم</small><strong>{appointmentRows.length}</strong><em>{appointmentRows.filter(item => item.status === "مؤكد").length} مواعيد مؤكدة</em></div></article>
              <article><span className="metric-icon peach"><Icon name="check"/></span><div><small>الحجوزات المؤكدة</small><strong>{appointmentRows.filter(item => item.status === "مؤكد").length}</strong><em>تتحدث تلقائيًا</em></div></article>
              <article><span className="metric-icon lilac"><Icon name="wallet"/></span><div><small>إيراد اليوم</small><strong>4,280 <b>د.إ</b></strong><em>+12% عن أمس</em></div></article>
              <article className="occupancy"><span className="ring" style={{ "--p":"78%" } as CSSProperties}>78%</span><div><small>إشغال الصالون</small><strong>ممتاز</strong><em>الفترة الأكثر نشاطًا 4–7 م</em></div></article>
            </section>
            <section className="dashboard-grid">
              <article className="schedule-card">
                <div className="section-head"><div><span className="section-kicker">روزنامة الصالون</span><h2>مواعيد اليوم</h2></div><div className="section-actions"><button onClick={() => setSearchOpen(!searchOpen)}><Icon name="search" size={18}/></button><button className="view-all" onClick={() => chooseNav("المواعيد")}>عرض الجدول <Icon name="arrow" size={16}/></button></div></div>
                {searchOpen && <div className="search-strip"><Icon name="search" size={18}/><input autoFocus value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="ابحثي باسم العميلة أو الخدمة..."/><button onClick={() => setSearchTerm("")}>مسح</button></div>}
                <div className="day-strip">{days.map(day => <button key={day.n} className={selectedDay === day.n ? "active" : ""} onClick={() => { tap(); setSelectedDay(day.n); }}><small>{day.d}</small><strong>{day.n}</strong>{selectedDay === day.n && <i/>}</button>)}</div>
                <div className="appointments">
                  {visibleAppointments.map(({ item, index }) => <div className="appointment" key={`${item.time}-${item.name}-${index}`}>
                    <time>{item.time}<small>{Number(item.time.split(":")[0]) < 12 ? "ص" : "م"}</small></time><span className={"appointment-line " + item.color}/>
                    <div className="appointment-main"><span className="avatar">{item.name[0]}</span><div><strong>{item.name}</strong><small>{item.service}</small></div></div>
                    <span className="employee"><i>{item.employee[0]}</i>{item.employee}</span><span className={attentionBadges.has(item.status) ? "status waiting" : "status"}>{item.status}</span><small className="duration">{item.duration}</small>
                    <button className="more" onClick={() => { tap(); setSelectedAppointment(index); }} aria-label={"تفاصيل موعد " + item.name}>•••</button>
                  </div>)}
                  {visibleAppointments.length === 0 && <div className="empty-state">لا توجد مواعيد مطابقة للبحث.</div>}
                </div>
              </article>
              <aside className="side-stack">
                <article className="team-card"><div className="section-head compact"><div><span className="section-kicker">نبض الفريق</span><h2>حالة الخبيرات</h2></div><button onClick={() => chooseNav("الفريق")}>الكل</button></div><div className="team-list">{team.map(person => <div className="team-row" key={person.name}><span className="team-avatar" style={{ background:person.tone }}>{person.name[0]}</span><div className="team-name"><strong>{person.name}</strong><small>{person.role}</small></div><div className="load"><span><i style={{ width:person.load + "%", background:person.tone }}/></span><small>{person.load}%</small></div></div>)}</div></article>
                <article className="beauty-note"><div className="note-icon"><Icon name="scissors" size={27}/></div><div><small>الاقتراح الذكي لليوم</small><strong>لديك فترة هادئة بين 2:15 و3:00</strong><p>وقت مناسب لقبول حجز سريع أو استراحة الفريق.</p></div><button onClick={() => openAppointment("14:15")}>فتح الفترة</button></article>
              </aside>
            </section>
          </> : active === "الكاشير" ? <section className="cashier-page">
            <div className="cashier-toolbar">
              <form className="barcode-box" onSubmit={event => { event.preventDefault(); processBarcode(); }}>
                <span className="barcode-icon"><Icon name="barcode" size={25}/></span>
                <div><small>قارئ الباركود</small><input value={barcodeValue} onChange={event => setBarcodeValue(event.target.value)} placeholder="امسحي الباركود أو اكتبيه هنا" autoComplete="off"/></div>
                <button type="submit">إضافة</button>
                <button type="button" className="camera-button" onClick={() => { tap(); setScannerMessage("وجّهي الكاميرا نحو الباركود"); setScannerOpen(true); }}><Icon name="camera" size={18}/> الكاميرا</button>
              </form>
              <button className="cashier-tool-button" onClick={() => { tap(); setServiceDraft({ name:"", category:"الخدمات", price:"", barcode:"" }); setServiceModal(true); }}><Icon name="plus"/> إضافة خدمة</button>
              <button className="cashier-tool-button secondary" onClick={printInvoice}><Icon name="printer"/> طباعة الفاتورة</button>
            </div>

            <div className="cashier-layout">
              <article className="service-catalog">
                <div className="section-head"><div><span className="section-kicker">اختاري واضغطي للإضافة</span><h2>الخدمات والمنتجات</h2></div><label className="catalog-search"><Icon name="search" size={17}/><input value={cashierSearch} onChange={event => setCashierSearch(event.target.value)} placeholder="بحث بالاسم أو الباركود"/></label></div>
                <div className="service-grid">{filteredCashierServices.map(service => <button className="service-tile" key={service.id} onClick={() => addToCart(service)}><span className="service-symbol"><Icon name={service.category === "منتجات" ? "box" : "sparkles"}/></span><span className="service-copy"><small>{service.category}</small><strong>{service.name}</strong><em>{service.barcode}</em></span><b>{money(service.price)} <small>د.إ</small></b><i><Icon name="plus" size={16}/></i></button>)}{filteredCashierServices.length === 0 && <div className="empty-state">لا توجد خدمة مطابقة. استخدمي زر «إضافة خدمة» لإنشائها.</div>}</div>
              </article>

              <aside className="cashier-receipt">
                <div className="receipt-head"><div><span className="section-kicker">الفاتورة الحالية</span><h2>تفاصيل الطلب</h2></div><span className="receipt-count">{cart.reduce((sum,item) => sum + item.quantity, 0)} عناصر</span></div>
                <div className="cart-list">{cart.map(item => <div className="cart-row" key={item.id}><div><strong>{item.name}</strong><small>{money(item.price)} د.إ × {item.quantity}</small></div><div className="quantity-control"><button onClick={() => changeCartQuantity(item.id,-1)} aria-label="إنقاص"><Icon name="minus" size={14}/></button><b>{item.quantity}</b><button onClick={() => changeCartQuantity(item.id,1)} aria-label="زيادة"><Icon name="plus" size={14}/></button></div><strong>{money(item.price * item.quantity)}</strong><button className="remove-item" onClick={() => setCart(current => current.filter(row => row.id !== item.id))} aria-label="حذف"><Icon name="trash" size={16}/></button></div>)}{cart.length === 0 && <div className="cart-empty"><Icon name="cashier" size={34}/><strong>الفاتورة فارغة</strong><span>اضغطي على أي خدمة ليظهر سعرها هنا.</span></div>}</div>
                <div className="receipt-totals"><span><small>المجموع قبل الضريبة</small><b>{money(cashierSubtotal)} د.إ</b></span><span><small>ضريبة القيمة المضافة 5%</small><b>{money(cashierTax)} د.إ</b></span><span className="grand-total"><strong>الإجمالي</strong><b>{money(cashierTotal)} <small>د.إ</small></b></span></div>
                <div className="payment-methods"><small>طريقة الدفع</small><div>{["نقدي","بطاقة","تحويل"].map(method => <button key={method} className={paymentMethod === method ? "selected" : ""} onClick={() => { tap(); setPaymentMethod(method); }}>{method}</button>)}</div></div>
                <div className="cashier-actions"><button className="clear-cart" onClick={() => { setCart([]); toast("تم إفراغ الفاتورة"); }}>إفراغ</button><button className="print-action" onClick={printInvoice}><Icon name="printer" size={17}/> طباعة</button><button className="checkout-action" onClick={completeSale}><Icon name="check" size={18}/> إتمام البيع</button></div>
              </aside>
            </div>

            <div className="print-sheet" dir={languageProfile.dir}><div className="print-brand"><strong>VAREX</strong><span>BUSINESS MANAGEMENT SYSTEM</span><p>صالون VAREX النسائي</p></div><div className="print-meta"><span>{date}</span><span>{time}</span></div><table><thead><tr><th>الخدمة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>{cart.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.price)}</td><td>{money(item.price * item.quantity)}</td></tr>)}</tbody></table><div className="print-totals"><span>المجموع: {money(cashierSubtotal)} د.إ</span><span>الضريبة: {money(cashierTax)} د.إ</span><strong>الإجمالي: {money(cashierTotal)} د.إ</strong><span>الدفع: {paymentMethod}</span></div><p className="print-thanks">شكرًا لزيارتك</p></div>
          </section> : active === "الاشتراك" ? <section className="subscription-page" id="subscription-plans">
            <div className="subscription-intro">
              <div className="subscription-mark"><Icon name="card" size={29}/></div>
              <div><span className="section-kicker">خطط VAREX الرسمية</span><h2>اختاري الخطة المناسبة لصالونك</h2><p>ابدئي مجانًا لمدة 7 أيام، أو اختاري إحدى الخطط المدفوعة بأمان عبر PayPal.</p></div>
              <div className="selected-plan-summary"><small>الخطة المختارة</small><strong>{selectedPlan}</strong><span><i/> جاهزة للتفعيل</span></div>
            </div>
            <div className="subscription-grid">{subscriptionPlans.map(plan => {
              const selected = selectedPlan === plan.name;
              return <article key={plan.id} className={`subscription-card${selected ? " selected" : ""}${plan.popular ? " popular" : ""}`} role="button" tabIndex={0} onClick={() => { tap(); setSelectedPlan(plan.name); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelectedPlan(plan.name); }}>
                {plan.popular && <span className="popular-ribbon">الأكثر توفيرًا</span>}
                <div className="plan-icon"><Icon name={plan.id === "trial" ? "sparkles" : "card"} size={24}/></div>
                <span className="plan-duration">{plan.duration}</span>
                <h3>{plan.name}</h3>
                <div className="plan-price">{plan.price === 0 ? <><strong>مجانًا</strong><small>لمدة 7 أيام</small></> : <><strong>{plan.price.toLocaleString("ar-AE")}</strong><span>د.إ</span><small>{plan.id === "monthly" ? "شهريًا" : plan.id === "yearly" ? "سنويًا" : "دفعة واحدة"}</small></>}</div>
                <p>{plan.note}</p>
                <div className="plan-features">{plan.features.map(feature => <span key={feature}><Icon name="check" size={15}/>{feature}</span>)}</div>
                <button className={plan.price === 0 ? "trial-plan-action" : "paypal-plan-action"} onClick={event => { event.stopPropagation(); activateSubscription(plan); }}>{plan.price === 0 ? <><Icon name="sparkles" size={18}/> تفعيل التجربة المجانية</> : <><span className="paypal-word"><b>Pay</b>Pal</span> ادفعي {plan.price.toLocaleString("ar-AE")} د.إ</>}</button>
                {selected && <span className="selected-indicator"><Icon name="check" size={14}/> الخطة المختارة</span>}
              </article>;
            })}</div>
            <div className="paypal-security"><span className="paypal-word"><b>Pay</b>Pal</span><div><strong>دفع آمن عبر حساب VAREX الرسمي</strong><small>سيتم تحويلك إلى PayPal لإتمام الدفع، ولا يحفظ النظام بيانات بطاقتك.</small></div><Icon name="check" size={22}/></div>
          </section> : moduleInfo ? <section className="module-page">
            <div className="module-stats">{moduleInfo.stats.map((stat, index) => <article key={stat.label}><span className={"module-stat-icon tone-" + index}><Icon name={index === 0 ? "sparkles" : index === 1 ? "chart" : "check"}/></span><small>{stat.label}</small><strong>{stat.value}</strong><em>{stat.note}</em></article>)}</div>
            <div className="module-board">
              <article className="module-list-card">
                <div className="section-head"><div><span className="section-kicker">السجلات المحفوظة</span><h2>{moduleInfo.title}</h2></div><div className="section-actions"><button onClick={() => { tap(); setSearchOpen(!searchOpen); }}><Icon name="search" size={18}/></button><select className="filter-control" value={filter} onChange={event => setFilter(event.target.value as "all" | "attention" | "done")}><option value="all">كل النتائج</option><option value="attention">تحتاج متابعة</option><option value="done">مكتملة</option></select></div></div>
                {searchOpen && <div className="search-strip"><Icon name="search" size={18}/><input autoFocus value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={`ابحثي في ${moduleInfo.title}...`}/><button onClick={() => setSearchTerm("")}>مسح</button></div>}
                <div className="module-list">{visibleRows.map(({ row, index }, position) => <button className="module-row" key={`${row.main}-${index}`} onClick={() => openRecord(active, row, index)}><span className={"row-number tone-" + (position % 3)}>{String(position + 1).padStart(2,"0")}</span><span className="row-copy"><strong>{row.main}</strong><small>{row.sub}</small></span><span className="row-meta">{row.meta}</span><span className="row-badge">{row.badge}</span><Icon name="arrow" size={16}/></button>)}{visibleRows.length === 0 && <div className="empty-state">لا توجد نتائج مطابقة. جرّبي كلمة بحث أخرى أو أضيفي سجلًا جديدًا.</div>}</div>
              </article>
              <aside className="module-insight"><div className="insight-orbit"><span>V</span><i/><i/><i/></div><span className="section-kicker">ملخص VAREX الذكي</span><h2>{activeRows.length} سجلات</h2><p>يمكنك الآن فتح أي سجل وتعديله، أو استخدام البحث والتصفية للوصول إليه بسرعة.</p><div className="insight-checks"><span><Icon name="check" size={15}/> الحفظ المحلي مفعّل</span><span><Icon name="check" size={15}/> البحث يعمل مباشرة</span><span><Icon name="check" size={15}/> آخر تحديث الآن</span></div><button onClick={() => { tap(); setUtilityModal("insight"); }}>عرض التفاصيل <Icon name="arrow" size={15}/></button></aside>
            </div>
          </section> : null}
        </main>
        <nav className="salon-dock" aria-label="أقسام النظام">{nav.map(([label, icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => chooseNav(label)}><Icon name={icon}/><span>{navTranslations[language][label]}</span>{active === label && <i/>}</button>)}</nav>
      </div>

      {appointmentModal && <div className="modal-backdrop" onMouseDown={() => setAppointmentModal(false)}><section className="appointment-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-accent"><Icon name="calendar" size={28}/></div><div className="modal-head"><div><small>حجز جديد</small><h2>إضافة موعد للصالون</h2><p>الحفظ يضيف الموعد مباشرة إلى الجدول ويحفظه على هذا الجهاز.</p></div><button type="button" onClick={() => setAppointmentModal(false)}>×</button></div><form onSubmit={saveAppointment}><label className="wide"><span>اسم العميلة *</span><input required value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})}/></label><label><span>رقم الهاتف</span><input value={draft.phone} onChange={e => setDraft({...draft,phone:e.target.value})} dir="ltr"/></label><label><span>الخدمة *</span><select value={draft.service} onChange={e => setDraft({...draft,service:e.target.value})}><option>قص وتصفيف</option><option>صبغة كاملة</option><option>عناية بالبشرة</option><option>مناكير وباديكير</option><option>تسريحة مناسبة</option></select></label><label><span>الخبيرة *</span><select value={draft.employee} onChange={e => setDraft({...draft,employee:e.target.value})}>{team.map(person => <option key={person.name}>{person.name}</option>)}</select></label><label><span>الوقت *</span><input required type="time" value={draft.time} onChange={e => setDraft({...draft,time:e.target.value})}/></label><label className="wide"><span>ملاحظات</span><textarea value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})}/></label><div className="modal-actions"><button type="button" onClick={() => setAppointmentModal(false)}>إلغاء</button><button type="submit"><Icon name="check" size={18}/> تأكيد الموعد</button></div></form></section></div>}

      {selectedAppointment !== null && appointmentRows[selectedAppointment] && <div className="modal-backdrop" onMouseDown={() => setSelectedAppointment(null)}><section className="appointment-modal compact-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-accent"><Icon name="calendar" size={28}/></div><div className="modal-head"><div><small>تفاصيل الموعد</small><h2>{appointmentRows[selectedAppointment].name}</h2><p>{appointmentRows[selectedAppointment].service} • {appointmentRows[selectedAppointment].time} • {appointmentRows[selectedAppointment].employee}</p></div><button onClick={() => setSelectedAppointment(null)}>×</button></div><div className="utility-grid"><button onClick={() => updateAppointmentStatus(selectedAppointment,"داخل الصالون")}><Icon name="check"/> داخل الصالون</button><button onClick={() => updateAppointmentStatus(selectedAppointment,"مكتمل")}><Icon name="check"/> تم إنجاز الموعد</button><button onClick={() => updateAppointmentStatus(selectedAppointment,"ملغي")}>إلغاء الموعد</button></div></section></div>}

      {serviceModal && <div className="modal-backdrop" onMouseDown={() => setServiceModal(false)}><section className="appointment-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-accent"><Icon name="cashier" size={28}/></div><div className="modal-head"><div><small>الكاشير</small><h2>إضافة خدمة أو منتج</h2><p>بعد الحفظ ستظهر الخدمة فورًا في شاشة الكاشير ويمكن ربطها بباركود.</p></div><button type="button" onClick={() => setServiceModal(false)}>×</button></div><form onSubmit={saveCashierService}><label className="wide"><span>اسم الخدمة أو المنتج *</span><input required value={serviceDraft.name} onChange={event => setServiceDraft({...serviceDraft,name:event.target.value})} placeholder="مثال: قص وتصفيف"/></label><label><span>التصنيف</span><select value={serviceDraft.category} onChange={event => setServiceDraft({...serviceDraft,category:event.target.value})}><option>الخدمات</option><option>الشعر</option><option>البشرة</option><option>الأظافر</option><option>منتجات</option></select></label><label><span>السعر بالدرهم *</span><input required type="number" min="0.01" step="0.01" value={serviceDraft.price} onChange={event => setServiceDraft({...serviceDraft,price:event.target.value})} dir="ltr"/></label><label className="wide"><span>رقم الباركود</span><input value={serviceDraft.barcode} onChange={event => setServiceDraft({...serviceDraft,barcode:event.target.value})} placeholder="امسحيه بالقارئ أو اتركيه فارغًا لتوليده تلقائيًا" dir="ltr"/></label><div className="modal-actions"><button type="button" onClick={() => setServiceModal(false)}>إلغاء</button><button type="submit"><Icon name="check" size={18}/> حفظ الخدمة</button></div></form></section></div>}

      {scannerOpen && <div className="modal-backdrop" onMouseDown={() => setScannerOpen(false)}><section className="appointment-modal compact-modal scanner-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-accent"><Icon name="barcode" size={29}/></div><div className="modal-head"><div><small>قارئ الباركود</small><h2>مسح بالكاميرا</h2><p>{scannerMessage}</p></div><button type="button" onClick={() => setScannerOpen(false)}>×</button></div><div className="camera-frame"><video ref={scannerVideoRef} playsInline muted/><span/><i/></div><button className="scanner-close" onClick={() => setScannerOpen(false)}>إغلاق القارئ</button></section></div>}

      {recordDialog && formCopy[recordDialog.module] && <div className="modal-backdrop" onMouseDown={() => setRecordDialog(null)}><section className="appointment-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-accent"><Icon name="sparkles" size={28}/></div><div className="modal-head"><div><small>{recordDialog.mode === "new" ? "سجل جديد" : "تعديل السجل"}</small><h2>{formCopy[recordDialog.module].title}</h2><p>أدخلي البيانات ثم اضغطي حفظ لتظهر مباشرة في القسم.</p></div><button type="button" onClick={() => setRecordDialog(null)}>×</button></div><form onSubmit={saveRecord}><label className="wide"><span>{formCopy[recordDialog.module].main} *</span><input required value={recordDraft.main} onChange={event => setRecordDraft({...recordDraft,main:event.target.value})}/></label><label className="wide"><span>{formCopy[recordDialog.module].sub}</span><input value={recordDraft.sub} onChange={event => setRecordDraft({...recordDraft,sub:event.target.value})}/></label><label><span>{formCopy[recordDialog.module].meta}</span><input value={recordDraft.meta} onChange={event => setRecordDraft({...recordDraft,meta:event.target.value})}/></label><label><span>{formCopy[recordDialog.module].badge}</span><input value={recordDraft.badge} onChange={event => setRecordDraft({...recordDraft,badge:event.target.value})}/></label><div className="modal-actions">{recordDialog.mode === "edit" && <button type="button" className="danger-action" onClick={deleteRecord}>حذف السجل</button>}<button type="button" onClick={() => setRecordDialog(null)}>إلغاء</button><button type="submit"><Icon name="check" size={18}/> حفظ</button></div></form></section></div>}

      {utilityModal && <div className="modal-backdrop" onMouseDown={() => setUtilityModal(null)}><section className="appointment-modal compact-modal" role="dialog" aria-modal="true" dir={languageProfile.dir} onMouseDown={event => event.stopPropagation()}><div className="modal-accent"><Icon name={utilityModal === "notifications" ? "bell" : utilityModal === "appearance" ? "appearance" : "settings"} size={28}/></div><div className="modal-head"><div><small>VAREX</small><h2>{utilityModal === "users" ? "تبديل المستخدم" : utilityModal === "language" ? shell.languageTitle : utilityModal === "appearance" ? "مظهر النظام" : utilityModal === "notifications" ? "الإشعارات" : utilityModal === "plans" ? "الاشتراك والترخيص" : `ملخص ${active}`}</h2><p>{utilityModal === "language" ? shell.languagePrompt : utilityModal === "insight" ? `يحتوي هذا القسم على ${activeRows.length} سجلات محفوظة وقابلة للتعديل.` : "اختاري الأمر المطلوب وسيُطبق مباشرة."}</p></div><button onClick={() => setUtilityModal(null)}>×</button></div>
        {utilityModal === "users" && <div className="utility-grid">{["المالكة","مديرة الصالون","الاستقبال"].map(user => <button className={activeUser === user ? "selected" : ""} key={user} onClick={() => { setActiveUser(user); selectUtility(`تم التبديل إلى ${user}`); }}><Icon name="clients"/>{user}</button>)}</div>}
        {utilityModal === "language" && <div className="utility-grid language-grid">{languageOptions.map(option => <button className={language === option.code ? "selected" : ""} key={option.code} dir={option.dir} onClick={() => { setLanguage(option.code); selectUtility(shellTranslations[option.code].selected); }}><b>{option.code}</b><span>{option.name}</span></button>)}</div>}
        {utilityModal === "appearance" && <div className="utility-grid theme-choices"><button className={theme === "soft" ? "selected" : ""} onClick={() => { setTheme("soft"); selectUtility("تم تطبيق المظهر الهادئ"); }}><i className="swatch soft"/>هادئ</button><button className={theme === "bright" ? "selected" : ""} onClick={() => { setTheme("bright"); selectUtility("تم تطبيق المظهر الفاتح"); }}><i className="swatch bright"/>فاتح</button><button className={theme === "contrast" ? "selected" : ""} onClick={() => { setTheme("contrast"); selectUtility("تم تطبيق المظهر الواضح"); }}><i className="swatch contrast"/>واضح</button></div>}
        {utilityModal === "notifications" && <div className="notification-list">{notifications.map((notice,index) => <div key={notice}><Icon name="bell" size={17}/><span>{notice}</span><button onClick={() => setNotifications(current => current.filter((_,itemIndex) => itemIndex !== index))}>×</button></div>)}{notifications.length === 0 && <div className="empty-state">لا توجد إشعارات جديدة.</div>}{notifications.length > 0 && <button className="clear-notices" onClick={() => { setNotifications([]); toast("تم مسح الإشعارات"); }}>تحديد الكل كمقروء</button>}</div>}
        {utilityModal === "plans" && <div className="utility-grid plan-grid">{subscriptionPlans.map(plan => <button className={selectedPlan === plan.name ? "selected" : ""} key={plan.id} onClick={() => { setSelectedPlan(plan.name); selectUtility(`تم اختيار ${plan.name}`); }}><Icon name="card"/>{plan.name}</button>)}</div>}
        {utilityModal === "insight" && <div className="insight-details"><span><Icon name="check"/> البحث والتصفية يعملان</span><span><Icon name="check"/> الإضافة والتعديل والحذف مفعّلة</span><span><Icon name="check"/> البيانات محفوظة على هذا الجهاز</span></div>}
      </section></div>}

      {toastMessage && <div className="toast"><Icon name="check"/><span>{toastMessage}</span></div>}
    </div>
  );
}
