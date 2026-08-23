"use client";

import { RefObject, useEffect, useRef } from "react";

type TranslatorInstance = {
  translate(text: string): Promise<string>;
  destroy?: () => void;
};

type TranslatorFactory = {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }) => Promise<TranslatorInstance>;
};

type StoredText = { source: string; rendered: string };
type StoredAttribute = Record<string, StoredText>;

const arabicPhrases = [
  "مواعيد اليوم", "الحجوزات المؤكدة", "إيراد اليوم", "إشغال الصالون", "روزنامة الصالون",
  "عرض الجدول", "حالة الخبيرات", "الاقتراح الذكي لليوم", "فتح الفترة", "إضافة",
  "حفظ", "إلغاء", "حذف", "تعديل", "بحث", "عرض التفاصيل", "كل النتائج", "تحتاج متابعة",
  "مكتملة", "السجلات المحفوظة", "لا توجد نتائج مطابقة", "قارئ الباركود", "إضافة خدمة",
  "طباعة الفاتورة", "الخدمات والمنتجات", "الفاتورة الحالية", "تفاصيل الطلب", "الفاتورة فارغة",
  "المجموع قبل الضريبة", "ضريبة القيمة المضافة", "الإجمالي", "طريقة الدفع", "إتمام البيع",
  "نقدي", "بطاقة", "تحويل", "طباعة", "الكمية", "السعر", "تجربة مجانية",
  "الاشتراك الشهري", "الاشتراك السنوي", "مدى الحياة", "تفعيل التجربة المجانية",
  "اسم العميلة", "رقم الهاتف", "الخدمة", "الخبيرة", "الحالة", "ملاحظات", "موعد جديد",
  "اختاري", "المنتجات والمخزون", "الخدمات والباقات", "فريق العمل", "الفواتير والمدفوعات",
  "التقارير والتحليلات", "إعدادات الصالون", "تم الحفظ بنجاح", "د.إ",
] as const;

const translatedPhrases: Record<string, readonly string[]> = {
  EN: [
    "Today's appointments", "Confirmed bookings", "Today's revenue", "Salon occupancy", "Salon calendar",
    "View schedule", "Specialists status", "Today's smart suggestion", "Open slot", "Add", "Save", "Cancel",
    "Delete", "Edit", "Search", "View details", "All results", "Needs follow-up", "Completed", "Saved records",
    "No matching results", "Barcode scanner", "Add service", "Print invoice", "Services and products",
    "Current invoice", "Order details", "The invoice is empty", "Subtotal before tax", "Value-added tax",
    "Total", "Payment method", "Complete sale", "Cash", "Card", "Transfer", "Print", "Quantity", "Price",
    "Free trial", "Monthly subscription", "Annual subscription", "Lifetime", "Activate free trial", "Client name",
    "Phone number", "Service", "Specialist", "Status", "Notes", "New appointment", "Choose", "Products and inventory",
    "Services and packages", "Team", "Invoices and payments", "Reports and analytics", "Salon settings",
    "Saved successfully", "AED",
  ],
  UR: [
    "آج کی اپائنٹمنٹس", "تصدیق شدہ بکنگز", "آج کی آمدنی", "سیلون مصروفیت", "سیلون کیلنڈر",
    "شیڈول دیکھیں", "ماہرین کی حالت", "آج کی ذہین تجویز", "وقت کھولیں", "شامل کریں", "محفوظ کریں", "منسوخ",
    "حذف", "ترمیم", "تلاش", "تفصیلات دیکھیں", "تمام نتائج", "فالو اپ درکار", "مکمل", "محفوظ ریکارڈز",
    "کوئی مماثل نتیجہ نہیں", "بارکوڈ اسکینر", "خدمت شامل کریں", "رسید پرنٹ کریں", "خدمات اور مصنوعات",
    "موجودہ رسید", "آرڈر کی تفصیلات", "رسید خالی ہے", "ٹیکس سے پہلے کل", "ویلیو ایڈڈ ٹیکس",
    "کل", "ادائیگی کا طریقہ", "فروخت مکمل کریں", "نقد", "کارڈ", "منتقلی", "پرنٹ", "مقدار", "قیمت",
    "مفت آزمائش", "ماہانہ رکنیت", "سالانہ رکنیت", "تاحیات", "مفت آزمائش فعال کریں", "کلائنٹ کا نام",
    "فون نمبر", "خدمت", "ماہر", "حالت", "نوٹس", "نئی اپائنٹمنٹ", "منتخب کریں", "مصنوعات اور انوینٹری",
    "خدمات اور پیکیجز", "کام کی ٹیم", "رسیدیں اور ادائیگیاں", "رپورٹس اور تجزیات", "سیلون ترتیبات",
    "کامیابی سے محفوظ ہوا", "درہم",
  ],
  FA: [
    "نوبت‌های امروز", "رزروهای تأییدشده", "درآمد امروز", "ظرفیت سالن", "تقویم سالن",
    "نمایش برنامه", "وضعیت متخصصان", "پیشنهاد هوشمند امروز", "باز کردن زمان", "افزودن", "ذخیره", "لغو",
    "حذف", "ویرایش", "جستجو", "نمایش جزئیات", "همه نتایج", "نیازمند پیگیری", "تکمیل‌شده", "سوابق ذخیره‌شده",
    "نتیجه‌ای یافت نشد", "بارکدخوان", "افزودن خدمت", "چاپ فاکتور", "خدمات و محصولات",
    "فاکتور فعلی", "جزئیات سفارش", "فاکتور خالی است", "جمع پیش از مالیات", "مالیات بر ارزش افزوده",
    "مجموع", "روش پرداخت", "تکمیل فروش", "نقدی", "کارت", "انتقال", "چاپ", "تعداد", "قیمت",
    "آزمایش رایگان", "اشتراک ماهانه", "اشتراک سالانه", "مادام‌العمر", "فعال‌سازی آزمایش رایگان", "نام مشتری",
    "شماره تلفن", "خدمت", "متخصص", "وضعیت", "یادداشت‌ها", "نوبت جدید", "انتخاب کنید", "محصولات و موجودی",
    "خدمات و بسته‌ها", "تیم کاری", "فاکتورها و پرداخت‌ها", "گزارش‌ها و تحلیل‌ها", "تنظیمات سالن",
    "با موفقیت ذخیره شد", "درهم",
  ],
  ZH: [
    "今日预约", "已确认预约", "今日收入", "沙龙使用率", "沙龙日历", "查看日程", "美容师状态",
    "今日智能建议", "开放时段", "添加", "保存", "取消", "删除", "编辑", "搜索", "查看详情", "全部结果",
    "需要跟进", "已完成", "已保存记录", "没有匹配结果", "条码扫描器", "添加服务", "打印发票",
    "服务与产品", "当前发票", "订单详情", "发票为空", "税前小计", "增值税", "总计", "付款方式",
    "完成销售", "现金", "银行卡", "转账", "打印", "数量", "价格", "免费试用", "月度订阅", "年度订阅",
    "终身使用", "启用免费试用", "客户姓名", "电话号码", "服务", "美容师", "状态", "备注", "新建预约",
    "请选择", "产品与库存", "服务与套餐", "工作团队", "发票与付款", "报告与分析", "沙龙设置",
    "保存成功", "迪拉姆",
  ],
  KO: [
    "오늘의 예약", "확정 예약", "오늘의 매출", "살롱 점유율", "살롱 캘린더", "일정 보기", "전문가 상태",
    "오늘의 스마트 제안", "시간대 열기", "추가", "저장", "취소", "삭제", "편집", "검색", "상세 보기",
    "전체 결과", "후속 조치 필요", "완료", "저장된 기록", "일치하는 결과 없음", "바코드 스캐너",
    "서비스 추가", "청구서 인쇄", "서비스 및 제품", "현재 청구서", "주문 상세", "청구서가 비어 있습니다",
    "세전 소계", "부가가치세", "합계", "결제 방법", "판매 완료", "현금", "카드", "이체", "인쇄",
    "수량", "가격", "무료 체험", "월간 구독", "연간 구독", "평생 이용", "무료 체험 활성화", "고객 이름",
    "전화번호", "서비스", "전문가", "상태", "메모", "새 예약", "선택", "제품 및 재고", "서비스 및 패키지",
    "팀", "청구서 및 결제", "보고서 및 분석", "살롱 설정", "저장 완료", "디르함",
  ],
  IT: [
    "Appuntamenti di oggi", "Prenotazioni confermate", "Entrate di oggi", "Occupazione salone", "Calendario del salone",
    "Vedi agenda", "Stato delle specialiste", "Suggerimento intelligente di oggi", "Apri fascia", "Aggiungi", "Salva",
    "Annulla", "Elimina", "Modifica", "Cerca", "Vedi dettagli", "Tutti i risultati", "Da seguire", "Completato",
    "Record salvati", "Nessun risultato corrispondente", "Lettore di codici a barre", "Aggiungi servizio",
    "Stampa fattura", "Servizi e prodotti", "Fattura corrente", "Dettagli ordine", "La fattura è vuota",
    "Subtotale prima delle imposte", "IVA", "Totale", "Metodo di pagamento", "Completa vendita", "Contanti",
    "Carta", "Bonifico", "Stampa", "Quantità", "Prezzo", "Prova gratuita", "Abbonamento mensile",
    "Abbonamento annuale", "A vita", "Attiva prova gratuita", "Nome cliente", "Numero di telefono", "Servizio",
    "Specialista", "Stato", "Note", "Nuovo appuntamento", "Scegli", "Prodotti e magazzino", "Servizi e pacchetti",
    "Team", "Fatture e pagamenti", "Report e analisi", "Impostazioni salone", "Salvato con successo", "AED",
  ],
  ES: [
    "Citas de hoy", "Reservas confirmadas", "Ingresos de hoy", "Ocupación del salón", "Calendario del salón",
    "Ver agenda", "Estado de las especialistas", "Sugerencia inteligente de hoy", "Abrir horario", "Añadir", "Guardar",
    "Cancelar", "Eliminar", "Editar", "Buscar", "Ver detalles", "Todos los resultados", "Requiere seguimiento",
    "Completado", "Registros guardados", "No hay resultados coincidentes", "Lector de código de barras",
    "Añadir servicio", "Imprimir factura", "Servicios y productos", "Factura actual", "Detalles del pedido",
    "La factura está vacía", "Subtotal antes de impuestos", "IVA", "Total", "Método de pago", "Completar venta",
    "Efectivo", "Tarjeta", "Transferencia", "Imprimir", "Cantidad", "Precio", "Prueba gratuita", "Suscripción mensual",
    "Suscripción anual", "De por vida", "Activar prueba gratuita", "Nombre de la clienta", "Número de teléfono",
    "Servicio", "Especialista", "Estado", "Notas", "Nueva cita", "Elegir", "Productos e inventario",
    "Servicios y paquetes", "Equipo", "Facturas y pagos", "Informes y análisis", "Ajustes del salón",
    "Guardado correctamente", "AED",
  ],
  HE: [
    "התורים של היום", "הזמנות מאושרות", "הכנסות היום", "תפוסת הסלון", "יומן הסלון", "הצגת לוח זמנים",
    "מצב המומחיות", "ההמלצה החכמה להיום", "פתיחת זמן", "הוספה", "שמירה", "ביטול", "מחיקה", "עריכה",
    "חיפוש", "הצגת פרטים", "כל התוצאות", "דורש מעקב", "הושלם", "רשומות שמורות", "לא נמצאו תוצאות",
    "סורק ברקוד", "הוספת שירות", "הדפסת חשבונית", "שירותים ומוצרים", "חשבונית נוכחית", "פרטי הזמנה",
    "החשבונית ריקה", "סכום לפני מס", "מע״מ", "סה״כ", "אמצעי תשלום", "השלמת מכירה", "מזומן", "כרטיס",
    "העברה", "הדפסה", "כמות", "מחיר", "ניסיון חינם", "מנוי חודשי", "מנוי שנתי", "לכל החיים",
    "הפעלת ניסיון חינם", "שם הלקוחה", "מספר טלפון", "שירות", "מומחית", "מצב", "הערות", "תור חדש",
    "בחירה", "מוצרים ומלאי", "שירותים וחבילות", "צוות", "חשבוניות ותשלומים", "דוחות וניתוחים",
    "הגדרות הסלון", "נשמר בהצלחה", "דירהם",
  ],
  FR: [
    "Rendez-vous du jour", "Réservations confirmées", "Revenu du jour", "Occupation du salon", "Agenda du salon",
    "Voir le planning", "État des spécialistes", "Suggestion intelligente du jour", "Ouvrir le créneau", "Ajouter",
    "Enregistrer", "Annuler", "Supprimer", "Modifier", "Rechercher", "Voir les détails", "Tous les résultats",
    "Suivi nécessaire", "Terminé", "Dossiers enregistrés", "Aucun résultat correspondant", "Lecteur de codes-barres",
    "Ajouter un service", "Imprimer la facture", "Services et produits", "Facture actuelle", "Détails de la commande",
    "La facture est vide", "Sous-total avant taxes", "TVA", "Total", "Mode de paiement", "Finaliser la vente",
    "Espèces", "Carte", "Virement", "Imprimer", "Quantité", "Prix", "Essai gratuit", "Abonnement mensuel",
    "Abonnement annuel", "À vie", "Activer l’essai gratuit", "Nom de la cliente", "Numéro de téléphone", "Service",
    "Spécialiste", "État", "Notes", "Nouveau rendez-vous", "Choisir", "Produits et stock", "Services et forfaits",
    "Équipe", "Factures et paiements", "Rapports et analyses", "Paramètres du salon", "Enregistré avec succès", "AED",
  ],
  RU: [
    "Записи на сегодня", "Подтверждённые записи", "Доход за сегодня", "Загрузка салона", "Календарь салона",
    "Показать расписание", "Статус специалистов", "Умная рекомендация дня", "Открыть время", "Добавить", "Сохранить",
    "Отмена", "Удалить", "Изменить", "Поиск", "Подробнее", "Все результаты", "Требует внимания", "Завершено",
    "Сохранённые записи", "Совпадений не найдено", "Сканер штрихкода", "Добавить услугу", "Печать счёта",
    "Услуги и товары", "Текущий счёт", "Детали заказа", "Счёт пуст", "Сумма до налога", "НДС", "Итого",
    "Способ оплаты", "Завершить продажу", "Наличные", "Карта", "Перевод", "Печать", "Количество", "Цена",
    "Бесплатный период", "Месячная подписка", "Годовая подписка", "Навсегда", "Активировать бесплатный период",
    "Имя клиента", "Номер телефона", "Услуга", "Специалист", "Статус", "Заметки", "Новая запись", "Выбрать",
    "Товары и склад", "Услуги и пакеты", "Команда", "Счета и платежи", "Отчёты и аналитика",
    "Настройки салона", "Успешно сохранено", "AED",
  ],
};

const supplementalPhraseRows = [
  ["+12% عن أمس", "+12% from yesterday", "+12% کل سے", "+۱۲٪ نسبت به دیروز", "比昨天增长12%", "어제 대비 +12%", "+12% da ieri", "+12% desde ayer", "+12% מאתמול", "+12 % depuis hier", "+12% со вчера"],
  ["الفترة الأكثر نشاطًا 4–7 م", "Busiest period: 4–7 PM", "مصروف ترین وقت: شام 4–7", "شلوغ‌ترین زمان: ۴ تا ۷ عصر", "最繁忙时段：下午4–7点", "가장 바쁜 시간: 오후 4–7시", "Fascia più attiva: 16–19", "Horario más activo: 16–19", "השעות העמוסות: 16:00–19:00", "Période la plus active : 16 h–19 h", "Самое активное время: 16:00–19:00"],
  ["تتحدث تلقائيًا", "Updates automatically", "خودکار اپ ڈیٹ", "به‌روزرسانی خودکار", "自动更新", "자동 업데이트", "Si aggiorna automaticamente", "Se actualiza automáticamente", "מתעדכן אוטומטית", "Mise à jour automatique", "Обновляется автоматически"],
  ["نبض الفريق", "Team pulse", "ٹیم کی صورتحال", "نبض تیم", "团队动态", "팀 현황", "Andamento del team", "Pulso del equipo", "מצב הצוות", "Dynamique de l’équipe", "Пульс команды"],
  ["لديك فترة هادئة بين 2:15 و3:00", "You have a quiet slot between 2:15 and 3:00", "2:15 سے 3:00 کے درمیان وقت خالی ہے", "بین ساعت ۲:۱۵ تا ۳:۰۰ زمان خلوت دارید", "2:15至3:00有空闲时段", "2:15~3:00 사이에 여유 시간이 있습니다", "Hai una fascia libera tra le 14:15 e le 15:00", "Tienes un horario libre entre las 2:15 y las 3:00", "יש לך זמן פנוי בין 14:15 ל־15:00", "Vous avez un créneau libre entre 14 h 15 et 15 h", "У вас есть свободное окно с 14:15 до 15:00"],
  ["وقت مناسب لقبول حجز سريع أو استراحة الفريق.", "A good time for a quick booking or a team break.", "فوری بکنگ یا ٹیم کے وقفے کے لیے موزوں وقت۔", "زمان مناسبی برای یک رزرو سریع یا استراحت تیم است.", "适合快速预约或团队休息。", "빠른 예약이나 팀 휴식에 좋은 시간입니다.", "Un buon momento per una prenotazione rapida o una pausa del team.", "Un buen momento para una reserva rápida o un descanso del equipo.", "זמן מתאים לתור מהיר או להפסקת צוות.", "Un bon moment pour un rendez-vous rapide ou une pause d’équipe.", "Подходящее время для быстрой записи или перерыва команды."],
  ["امسحي الباركود أو اكتبيه هنا", "Scan or enter the barcode here", "بارکوڈ اسکین کریں یا یہاں لکھیں", "بارکد را اسکن یا اینجا وارد کنید", "扫描条码或在此输入", "바코드를 스캔하거나 입력하세요", "Scansiona o inserisci qui il codice a barre", "Escanea o escribe aquí el código de barras", "סרקי או הקלידי כאן את הברקוד", "Scannez ou saisissez le code-barres ici", "Отсканируйте или введите штрихкод"],
  ["اختاري واضغطي للإضافة", "Choose and tap to add", "منتخب کرکے شامل کریں", "انتخاب و برای افزودن لمس کنید", "选择并点击添加", "선택하여 추가하세요", "Scegli e tocca per aggiungere", "Elige y pulsa para añadir", "בחרי ולחצי כדי להוסיף", "Choisissez et appuyez pour ajouter", "Выберите и нажмите, чтобы добавить"],
  ["بحث بالاسم أو الباركود", "Search by name or barcode", "نام یا بارکوڈ سے تلاش", "جستجو با نام یا بارکد", "按名称或条码搜索", "이름 또는 바코드로 검색", "Cerca per nome o codice a barre", "Buscar por nombre o código de barras", "חיפוש לפי שם או ברקוד", "Rechercher par nom ou code-barres", "Поиск по названию или штрихкоду"],
  ["لا توجد خدمة مطابقة. استخدمي زر «إضافة خدمة» لإنشائها.", "No matching service. Use “Add service” to create it.", "کوئی مماثل خدمت نہیں۔ اسے بنانے کے لیے «خدمت شامل کریں» دبائیں۔", "خدمت مطابقی نیست. برای ساخت آن «افزودن خدمت» را بزنید.", "没有匹配的服务。请使用“添加服务”创建。", "일치하는 서비스가 없습니다. ‘서비스 추가’로 생성하세요.", "Nessun servizio corrispondente. Usa “Aggiungi servizio” per crearlo.", "No hay un servicio coincidente. Usa «Añadir servicio» para crearlo.", "אין שירות תואם. השתמשי ב״הוספת שירות״ כדי ליצור אותו.", "Aucun service correspondant. Utilisez « Ajouter un service » pour le créer.", "Подходящей услуги нет. Нажмите «Добавить услугу», чтобы создать её."],
  ["اضغطي على أي خدمة ليظهر سعرها هنا.", "Tap any service to show its price here.", "قیمت یہاں دکھانے کے لیے کسی خدمت پر دبائیں۔", "برای نمایش قیمت، روی یک خدمت بزنید.", "点击任一服务即可在此显示价格。", "서비스를 누르면 가격이 여기에 표시됩니다.", "Tocca un servizio per visualizzarne qui il prezzo.", "Pulsa cualquier servicio para ver aquí su precio.", "לחצי על שירות כדי להציג כאן את המחיר.", "Appuyez sur un service pour afficher son prix ici.", "Нажмите на услугу, чтобы её цена появилась здесь."],
  ["تم إفراغ الفاتورة", "Invoice cleared", "رسید خالی کر دی گئی", "فاکتور خالی شد", "发票已清空", "청구서를 비웠습니다", "Fattura svuotata", "Factura vaciada", "החשבונית נוקתה", "Facture vidée", "Счёт очищен"],
  ["صالون VAREX النسائي", "VAREX Women’s Salon", "VAREX خواتین سیلون", "سالن بانوان VAREX", "VAREX女士沙龙", "VAREX 여성 살롱", "Salone donna VAREX", "Salón femenino VAREX", "סלון הנשים VAREX", "Salon féminin VAREX", "Женский салон VAREX"],
  ["شكرًا لزيارتك", "Thank you for your visit", "آپ کی آمد کا شکریہ", "از حضور شما سپاسگزاریم", "感谢光临", "방문해 주셔서 감사합니다", "Grazie per la visita", "Gracias por tu visita", "תודה שביקרת", "Merci de votre visite", "Спасибо за визит"],
  ["خطط VAREX الرسمية", "Official VAREX plans", "VAREX کے سرکاری پلان", "پلن‌های رسمی VAREX", "VAREX官方方案", "VAREX 공식 요금제", "Piani ufficiali VAREX", "Planes oficiales VAREX", "התוכניות הרשמיות של VAREX", "Formules officielles VAREX", "Официальные планы VAREX"],
  ["اختاري الخطة المناسبة لصالونك", "Choose the right plan for your salon", "اپنے سیلون کے لیے مناسب پلان منتخب کریں", "پلن مناسب سالن خود را انتخاب کنید", "选择适合您沙龙的方案", "살롱에 맞는 요금제를 선택하세요", "Scegli il piano giusto per il tuo salone", "Elige el plan adecuado para tu salón", "בחרי את התוכנית המתאימה לסלון שלך", "Choisissez la formule adaptée à votre salon", "Выберите подходящий план для салона"],
  ["ابدئي مجانًا لمدة 7 أيام، أو اختاري إحدى الخطط المدفوعة بأمان عبر PayPal.", "Start free for 7 days, or choose a paid plan securely through PayPal.", "7 دن مفت شروع کریں، یا PayPal کے ذریعے محفوظ ادائیگی والا پلان منتخب کریں۔", "۷ روز رایگان شروع کنید یا یکی از پلن‌های پولی را با پرداخت امن PayPal انتخاب کنید.", "免费试用7天，或通过PayPal安全选择付费方案。", "7일 무료로 시작하거나 PayPal로 안전하게 유료 요금제를 선택하세요.", "Inizia gratis per 7 giorni oppure scegli un piano a pagamento sicuro con PayPal.", "Empieza gratis durante 7 días o elige un plan de pago seguro con PayPal.", "התחילי בחינם ל־7 ימים או בחרי תוכנית בתשלום מאובטח דרך PayPal.", "Commencez gratuitement pendant 7 jours ou choisissez une formule payante sécurisée via PayPal.", "Начните с 7 бесплатных дней или выберите платный план с безопасной оплатой через PayPal."],
  ["جاهزة للتفعيل", "Ready to activate", "فعال کرنے کے لیے تیار", "آماده فعال‌سازی", "可以激活", "활성화 준비 완료", "Pronto per l’attivazione", "Lista para activar", "מוכן להפעלה", "Prêt à être activé", "Готово к активации"],
  ["الأكثر توفيرًا", "Best value", "سب سے زیادہ بچت", "به‌صرفه‌ترین", "最超值", "최고의 가치", "Più conveniente", "Mejor precio", "החסכוני ביותר", "Meilleur rapport qualité-prix", "Самый выгодный"],
  ["مجانًا", "Free", "مفت", "رایگان", "免费", "무료", "Gratis", "Gratis", "חינם", "Gratuit", "Бесплатно"],
  ["لمدة 7 أيام", "For 7 days", "7 دن کے لیے", "برای ۷ روز", "7天", "7일", "Per 7 giorni", "Durante 7 días", "למשך 7 ימים", "Pendant 7 jours", "На 7 дней"],
  ["شهريًا", "Monthly", "ماہانہ", "ماهانه", "每月", "월간", "Mensile", "Mensual", "חודשי", "Mensuel", "Ежемесячно"],
  ["سنويًا", "Annually", "سالانہ", "سالانه", "每年", "연간", "Annuale", "Anual", "שנתי", "Annuel", "Ежегодно"],
  ["دفعة واحدة", "One-time payment", "ایک مرتبہ ادائیگی", "پرداخت یک‌باره", "一次性付款", "일회 결제", "Pagamento unico", "Pago único", "תשלום חד־פעמי", "Paiement unique", "Разовый платёж"],
  ["دفع آمن عبر حساب VAREX الرسمي", "Secure payment through the official VAREX account", "سرکاری VAREX اکاؤنٹ کے ذریعے محفوظ ادائیگی", "پرداخت امن از حساب رسمی VAREX", "通过VAREX官方账户安全付款", "VAREX 공식 계정을 통한 안전 결제", "Pagamento sicuro tramite l’account ufficiale VAREX", "Pago seguro mediante la cuenta oficial de VAREX", "תשלום מאובטח דרך החשבון הרשמי של VAREX", "Paiement sécurisé via le compte officiel VAREX", "Безопасная оплата через официальный аккаунт VAREX"],
  ["سيتم تحويلك إلى PayPal لإتمام الدفع، ولا يحفظ النظام بيانات بطاقتك.", "You will be redirected to PayPal to complete payment. The system does not store your card details.", "ادائیگی مکمل کرنے کے لیے آپ کو PayPal پر بھیجا جائے گا۔ سسٹم آپ کی کارڈ معلومات محفوظ نہیں کرتا۔", "برای تکمیل پرداخت به PayPal منتقل می‌شوید. سیستم اطلاعات کارت شما را ذخیره نمی‌کند.", "您将跳转至PayPal完成付款，系统不会保存您的银行卡信息。", "결제를 완료하기 위해 PayPal로 이동하며 시스템은 카드 정보를 저장하지 않습니다.", "Sarai reindirizzata a PayPal per completare il pagamento. Il sistema non salva i dati della carta.", "Serás redirigida a PayPal para completar el pago. El sistema no guarda los datos de tu tarjeta.", "תועברי ל־PayPal להשלמת התשלום. המערכת אינה שומרת את פרטי הכרטיס.", "Vous serez redirigée vers PayPal pour terminer le paiement. Le système ne conserve pas les données de votre carte.", "Вы будете перенаправлены в PayPal для оплаты. Система не хранит данные карты."],
  ["يمكنك الآن فتح أي سجل وتعديله، أو استخدام البحث والتصفية للوصول إليه بسرعة.", "You can open and edit any record, or use search and filters to find it quickly.", "آپ کوئی بھی ریکارڈ کھول کر ترمیم کرسکتی ہیں، یا تلاش اور فلٹر سے جلد تلاش کرسکتی ہیں۔", "می‌توانید هر رکورد را باز و ویرایش کنید یا با جستجو و فیلتر سریع به آن برسید.", "您可以打开并编辑任何记录，或使用搜索和筛选快速查找。", "모든 기록을 열어 편집하거나 검색과 필터로 빠르게 찾을 수 있습니다.", "Puoi aprire e modificare qualsiasi record oppure trovarlo rapidamente con ricerca e filtri.", "Puedes abrir y editar cualquier registro o encontrarlo rápidamente con búsqueda y filtros.", "אפשר לפתוח ולערוך כל רשומה או למצוא אותה במהירות באמצעות חיפוש וסינון.", "Vous pouvez ouvrir et modifier chaque dossier, ou le retrouver rapidement avec la recherche et les filtres.", "Можно открыть и изменить любую запись или быстро найти её через поиск и фильтры."],
  ["الحفظ المحلي مفعّل", "Local saving is enabled", "مقامی محفوظ کرنا فعال ہے", "ذخیره محلی فعال است", "本地保存已启用", "로컬 저장이 활성화되었습니다", "Salvataggio locale attivo", "Guardado local activado", "שמירה מקומית פעילה", "Enregistrement local activé", "Локальное сохранение включено"],
  ["البحث يعمل مباشرة", "Search works instantly", "تلاش فوری کام کرتی ہے", "جستجو فوری انجام می‌شود", "即时搜索", "즉시 검색", "Ricerca istantanea", "Búsqueda instantánea", "חיפוש מיידי", "Recherche instantanée", "Мгновенный поиск"],
  ["آخر تحديث الآن", "Updated just now", "ابھی اپ ڈیٹ ہوا", "همین حالا به‌روزرسانی شد", "刚刚更新", "방금 업데이트됨", "Aggiornato ora", "Actualizado ahora", "עודכן עכשיו", "Mis à jour à l’instant", "Обновлено только что"],
  ["لا توجد نتائج مطابقة. جرّبي كلمة بحث أخرى أو أضيفي سجلًا جديدًا.", "No matching results. Try another search term or add a new record.", "کوئی مماثل نتیجہ نہیں۔ دوسرا لفظ تلاش کریں یا نیا ریکارڈ شامل کریں۔", "نتیجه‌ای یافت نشد. عبارت دیگری جستجو یا رکورد جدیدی اضافه کنید.", "没有匹配结果。请尝试其他关键词或添加新记录。", "일치하는 결과가 없습니다. 다른 검색어를 사용하거나 새 기록을 추가하세요.", "Nessun risultato. Prova un’altra ricerca o aggiungi un nuovo record.", "No hay resultados. Prueba otra búsqueda o añade un nuevo registro.", "לא נמצאו תוצאות. נסי חיפוש אחר או הוסיפי רשומה חדשה.", "Aucun résultat. Essayez un autre terme ou ajoutez un nouveau dossier.", "Совпадений нет. Попробуйте другой запрос или добавьте новую запись."],
  ["إضافة موعد للصالون", "Add a salon appointment", "سیلون اپائنٹمنٹ شامل کریں", "افزودن نوبت سالن", "添加沙龙预约", "살롱 예약 추가", "Aggiungi un appuntamento al salone", "Añadir una cita al salón", "הוספת תור לסלון", "Ajouter un rendez-vous au salon", "Добавить запись в салон"],
  ["الحفظ يضيف الموعد مباشرة إلى الجدول ويحفظه على هذا الجهاز.", "Saving adds the appointment directly to the schedule and stores it on this device.", "محفوظ کرنے سے اپائنٹمنٹ فوراً شیڈول میں شامل اور اس ڈیوائس پر محفوظ ہوجائے گی۔", "با ذخیره، نوبت مستقیماً به برنامه افزوده و روی این دستگاه نگهداری می‌شود.", "保存后预约将直接加入日程并保存在此设备上。", "저장하면 예약이 일정에 바로 추가되고 이 기기에 보관됩니다.", "Salvando, l’appuntamento viene aggiunto all’agenda e memorizzato sul dispositivo.", "Al guardar, la cita se añade al horario y queda guardada en este dispositivo.", "השמירה מוסיפה את התור ישירות ללוח הזמנים ושומרת אותו במכשיר זה.", "L’enregistrement ajoute le rendez-vous au planning et le conserve sur cet appareil.", "После сохранения запись добавится в расписание и сохранится на этом устройстве."],
  ["تأكيد الموعد", "Confirm appointment", "اپائنٹمنٹ کی تصدیق", "تأیید نوبت", "确认预约", "예약 확인", "Conferma appuntamento", "Confirmar cita", "אישור התור", "Confirmer le rendez-vous", "Подтвердить запись"],
  ["بعد الحفظ ستظهر الخدمة فورًا في شاشة الكاشير ويمكن ربطها بباركود.", "After saving, the service will appear immediately in the cashier and can be linked to a barcode.", "محفوظ کرنے کے بعد خدمت فوراً کیشیئر میں نظر آئے گی اور بارکوڈ سے منسلک ہوسکے گی۔", "پس از ذخیره، خدمت فوراً در صندوق نمایش داده و به بارکد متصل می‌شود.", "保存后服务会立即显示在收银台，并可关联条码。", "저장 후 서비스가 계산대에 즉시 표시되며 바코드에 연결할 수 있습니다.", "Dopo il salvataggio, il servizio apparirà subito in cassa e potrà essere collegato a un codice a barre.", "Después de guardar, el servicio aparecerá en caja y podrá vincularse a un código de barras.", "לאחר השמירה השירות יופיע מיד בקופה וניתן יהיה לקשר אותו לברקוד.", "Après l’enregistrement, le service apparaîtra en caisse et pourra être associé à un code-barres.", "После сохранения услуга сразу появится в кассе, и её можно будет связать со штрихкодом."],
  ["لا توجد إشعارات جديدة.", "No new notifications.", "کوئی نئی اطلاع نہیں۔", "اعلان جدیدی نیست.", "没有新通知。", "새 알림이 없습니다.", "Nessuna nuova notifica.", "No hay notificaciones nuevas.", "אין התראות חדשות.", "Aucune nouvelle notification.", "Новых уведомлений нет."],
  ["تحديد الكل كمقروء", "Mark all as read", "سب کو پڑھا ہوا نشان زد کریں", "علامت‌گذاری همه به‌عنوان خوانده‌شده", "全部标记为已读", "모두 읽음으로 표시", "Segna tutto come letto", "Marcar todo como leído", "סימון הכול כנקרא", "Tout marquer comme lu", "Отметить всё как прочитанное"],
] as const;

const phraseLanguageIndex: Record<string, number> = { EN:1, UR:2, FA:3, ZH:4, KO:5, IT:6, ES:7, HE:8, FR:9, RU:10 };

const arabicPattern = /[\u0600-\u06ff]/;
const arabicRunPattern = /[\u0600-\u06ff]+/g;
const attributesToTranslate = ["placeholder", "title", "aria-label"] as const;

function romanizeArabic(value: string) {
  const letters: Record<string, string> = {
    "ا":"a", "أ":"a", "إ":"i", "آ":"aa", "ب":"b", "ت":"t", "ث":"th", "ج":"j", "ح":"h",
    "خ":"kh", "د":"d", "ذ":"dh", "ر":"r", "ز":"z", "س":"s", "ش":"sh", "ص":"s", "ض":"d",
    "ط":"t", "ظ":"z", "ع":"a", "غ":"gh", "ف":"f", "ق":"q", "ك":"k", "ل":"l", "م":"m",
    "ن":"n", "ه":"h", "ة":"a", "و":"w", "ؤ":"o", "ي":"y", "ى":"a", "ئ":"e", "ء":"",
    "َ":"a", "ُ":"u", "ِ":"i", "ّ":"", "ْ":"", "ً":"an", "ٌ":"un", "ٍ":"in", "ـ":"",
  };
  return [...value].map(character => letters[character] ?? character).join("");
}

function fallbackTranslate(source: string, language: string) {
  if (language === "AR" || !arabicPattern.test(source)) return source;
  const translations = translatedPhrases[language] || translatedPhrases.EN;
  const languageIndex = phraseLanguageIndex[language] || 1;
  let output = source;
  const replacements: readonly (readonly [string, string])[] = [
    ...arabicPhrases
    .map((phrase, index) => [phrase, translations[index] || translatedPhrases.EN[index]] as const)
    ,
    ...supplementalPhraseRows.map(row => [row[0], row[languageIndex] || row[1]] as const),
  ].sort((left, right) => right[0].length - left[0].length);

  const protectedTranslations: string[] = [];
  for (const [arabic, translated] of replacements) {
    if (!output.includes(arabic)) continue;
    const token = `\uE000${protectedTranslations.length}\uE001`;
    protectedTranslations.push(translated);
    output = output.split(arabic).join(token);
  }
  output = output.replace(arabicRunPattern, segment => romanizeArabic(segment));
  return output.replace(/\uE000(\d+)\uE001/g, (_, index: string) => protectedTranslations[Number(index)] || "");
}

async function createNativeTranslator(targetLanguage: string) {
  const translatorApi = (globalThis as unknown as { Translator?: TranslatorFactory }).Translator;
  const legacyApi = (globalThis as unknown as { ai?: { translator?: TranslatorFactory } }).ai?.translator;
  const factory = translatorApi || legacyApi;
  if (!factory?.create) return null;
  try {
    const options = { sourceLanguage: "ar", targetLanguage };
    const availability = await factory.availability?.(options);
    if (availability === "unavailable" || availability === "no") return null;
    return await factory.create({ ...options, monitor: () => undefined });
  } catch {
    return null;
  }
}

export function useSystemTranslation(
  rootRef: RefObject<HTMLElement | null>,
  language: string,
  targetLanguage: string,
) {
  const storedTexts = useRef(new WeakMap<Text, StoredText>());
  const storedAttributes = useRef(new WeakMap<Element, StoredAttribute>());
  const cache = useRef(new Map<string, string>());

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let disposed = false;
    let queued = false;
    let translator: TranslatorInstance | null = null;

    const translateValue = async (source: string) => {
      if (language === "AR" || !arabicPattern.test(source)) return source;
      const cacheKey = `${language}:${source}`;
      const cached = cache.current.get(cacheKey);
      if (cached) return cached;

      let result = fallbackTranslate(source, language);
      if (translator) {
        try {
          const nativeResult = (await translator.translate(source)).trim();
          if (nativeResult && nativeResult !== source.trim()) {
            const translatedResult = source.replace(source.trim(), nativeResult);
            result = language === "UR" || language === "FA" ? translatedResult : fallbackTranslate(translatedResult, language);
          }
        } catch {
          // The complete local fallback keeps the interface usable offline.
        }
      }
      cache.current.set(cacheKey, result);
      return result;
    };

    const translateTextNode = async (node: Text) => {
      const current = node.data;
      let stored = storedTexts.current.get(node);
      if (!stored || (current !== stored.source && current !== stored.rendered)) {
        stored = { source: current, rendered: current };
        storedTexts.current.set(node, stored);
      }
      const rendered = await translateValue(stored.source);
      if (disposed || !node.isConnected) return;
      stored.rendered = rendered;
      if (node.data !== rendered) node.data = rendered;
    };

    const translateElementAttributes = async (element: Element) => {
      let stored = storedAttributes.current.get(element);
      if (!stored) {
        stored = {};
        storedAttributes.current.set(element, stored);
      }
      await Promise.all(attributesToTranslate.map(async attribute => {
        const current = element.getAttribute(attribute);
        if (current === null) return;
        const previous = stored?.[attribute];
        if (!previous || (current !== previous.source && current !== previous.rendered)) {
          stored![attribute] = { source: current, rendered: current };
        }
        const record = stored![attribute];
        const rendered = await translateValue(record.source);
        if (disposed || !element.isConnected) return;
        record.rendered = rendered;
        if (element.getAttribute(attribute) !== rendered) element.setAttribute(attribute, rendered);
      }));
    };

    const translateTree = async () => {
      queued = false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let current = walker.nextNode();
      while (current) {
        const parent = current.parentElement;
        if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) textNodes.push(current as Text);
        current = walker.nextNode();
      }
      const elements = [root, ...Array.from(root.querySelectorAll("[placeholder], [title], [aria-label]"))];
      await Promise.all([
        ...textNodes.map(translateTextNode),
        ...elements.map(translateElementAttributes),
      ]);
    };

    const scheduleTranslation = () => {
      if (queued || disposed) return;
      queued = true;
      window.requestAnimationFrame(() => void translateTree());
    };

    const observer = new MutationObserver(scheduleTranslation);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...attributesToTranslate] });

    void (async () => {
      if (language !== "AR") translator = await createNativeTranslator(targetLanguage);
      await translateTree();
    })();

    return () => {
      disposed = true;
      observer.disconnect();
      translator?.destroy?.();
    };
  }, [language, rootRef, targetLanguage]);
}
