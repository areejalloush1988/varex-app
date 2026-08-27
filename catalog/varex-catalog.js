(function (root) {
  "use strict";

  const themes = {
    coffee: "#8A5A44",
    navy: "#254D73",
    emerald: "#23836B",
    berry: "#9D4162",
    royal: "#3F5FA8",
    clay: "#B45F47",
    orange: "#C46B2D",
    indigo: "#554FA3",
    graphite: "#555E68",
    steel: "#4F7589",
    plum: "#754667",
    mauve: "#84658C",
    bronze: "#94633D",
    teal: "#247E82",
    ocean: "#35718E",
    ruby: "#A64748",
    maroon: "#7C3D50",
    olive: "#727A3D",
    forest: "#3E6C4E",
    violet: "#7056A6",
    lavender: "#7E6DA8",
    slate: "#5E6E7C",
    charcoal: "#41474D",
    gold: "#A57B31",
    coral: "#BB5E58",
    bluegray: "#607489",
    rose: "#A95773",
    mint: "#438876",
    sky: "#477CAD",
    amber: "#B77A29",
    caramel: "#B86B31",
    magenta: "#A43D82",
    red: "#B43B32",
    mustard: "#A87A18",
    sand: "#A66E45"
  };

  const plans = (monthly, annual, lifetime) => ({
    monthly: { label: { ar: "اشتراك شهري", en: "Monthly subscription" }, price: 4900, variant: monthly },
    annual: { label: { ar: "اشتراك سنوي", en: "Annual subscription" }, price: 49000, variant: annual },
    lifetime: { label: { ar: "اشتراك مدى الحياة", en: "Lifetime subscription" }, price: 169900, variant: lifetime }
  });

  const apps = {
    cashier: {
      icon: "▣",
      theme: "navy",
      name: { ar: "نظام الكاشير والحسابات", en: "Cashier & Accounting System" },
      eyebrow: { ar: "المبيعات والمخزون والحسابات في مساحة واحدة", en: "Sales, inventory and accounting in one place" },
      overview: { ar: "منظومة متكاملة لنقاط البيع والفواتير والمشتريات والمخزون والعملاء والموردين وضريبة القيمة المضافة والتقارير المالية.", en: "An integrated system for point of sale, invoicing, purchases, inventory, customers, suppliers, VAT and financial reporting." },
      features: {
        ar: ["نقطة بيع وفواتير سريعة", "مخزون مستقل لكل فرع", "مشتريات وموردون ومصروفات", "حسابات وضريبة وتقارير", "إدارة العملاء والموظفين", "صلاحيات وتشغيل متعدد الفروع"],
        en: ["Fast POS and invoicing", "Branch-level inventory", "Purchases, suppliers and expenses", "Accounting, VAT and reports", "Customers and staff", "Roles and multi-branch operation"]
      },
      modules: { ar: ["لوحة التحكم", "نقطة البيع", "المنتجات والمخزون", "المشتريات", "العملاء", "الموردون", "الحسابات", "التقارير"], en: ["Dashboard", "Point of sale", "Products & inventory", "Purchases", "Customers", "Suppliers", "Accounting", "Reports"] },
      metrics: { ar: [["12,840", "مبيعات اليوم"], ["326", "منتجًا"], ["94", "فاتورة"], ["4", "فروع"]], en: [["12,840", "Today's sales"], ["326", "Products"], ["94", "Invoices"], ["4", "Branches"]] },
      handle: "varex-cashier",
      plans: plans(48897760067833, 48897760100601, 48897760133369)
    },
    "real-estate": {
      icon: "⌂",
      theme: "teal",
      name: { ar: "نظام إدارة العقارات والملاك", en: "Real Estate & Property Management" },
      eyebrow: { ar: "العقارات والعقود والتحصيل تحت متابعة واحدة", en: "Properties, contracts and collections under one view" },
      overview: { ar: "إدارة العقارات والوحدات والملاك والمستأجرين والعقود والدفعات والصيانة والتقارير من لوحة تشغيل موحدة.", en: "Manage properties, units, owners, tenants, contracts, payments, maintenance and reports from one operating dashboard." },
      features: { ar: ["العقارات والوحدات", "الملاك والعملاء", "العقود والتجديدات", "الدفعات والتحصيل", "الصيانة والطلبات", "التقارير والإشعارات"], en: ["Properties and units", "Owners and clients", "Contracts and renewals", "Payments and collections", "Maintenance requests", "Reports and alerts"] },
      modules: { ar: ["لوحة التحكم", "العقارات", "الملاك", "العملاء", "العقود", "الدفعات", "الصيانة", "التقارير"], en: ["Dashboard", "Properties", "Owners", "Clients", "Contracts", "Payments", "Maintenance", "Reports"] },
      metrics: { ar: [["128", "عقارًا"], ["91%", "إشغال"], ["42", "عقدًا نشطًا"], ["7", "طلبات صيانة"]], en: [["128", "Properties"], ["91%", "Occupancy"], ["42", "Active contracts"], ["7", "Maintenance requests"]] },
      handle: "varex-real-estate",
      plans: plans(48897760231673, 48897760264441, 48897760297209)
    },
    "car-rental": {
      icon: "◇",
      theme: "royal",
      name: { ar: "نظام إدارة تأجير السيارات", en: "Car Rental Management" },
      eyebrow: { ar: "الأسطول والحجوزات والعقود في دورة تشغيل واحدة", en: "Fleet, bookings and contracts in one workflow" },
      overview: { ar: "متابعة الأسطول والحجوزات والعقود والفحوصات والصيانة والمخالفات والدفعات والعملاء من مكان واحد.", en: "Track fleet, bookings, contracts, inspections, maintenance, fines, payments and customers in one place." },
      features: { ar: ["إدارة الأسطول", "الحجوزات والعقود", "الفحص والتسليم", "الصيانة والمخالفات", "العملاء والدفعات", "التقارير التشغيلية"], en: ["Fleet management", "Bookings and contracts", "Inspection and handover", "Maintenance and fines", "Customers and payments", "Operational reports"] },
      modules: { ar: ["لوحة التحكم", "الأسطول", "الحجوزات", "العقود", "الفحوصات", "الصيانة", "الدفعات", "التقارير"], en: ["Dashboard", "Fleet", "Bookings", "Contracts", "Inspections", "Maintenance", "Payments", "Reports"] },
      metrics: { ar: [["64", "مركبة"], ["51", "متاحة"], ["18", "حجزًا"], ["3", "في الصيانة"]], en: [["64", "Vehicles"], ["51", "Available"], ["18", "Bookings"], ["3", "In maintenance"]] },
      handle: "varex-car-rental",
      plans: plans(48897760329977, 48897760362745, 48897760395513)
    },
    restaurant: {
      icon: "◈",
      theme: "clay",
      name: { ar: "نظام إدارة المطاعم", en: "Restaurant Management" },
      eyebrow: { ar: "الطلبات والمطبخ والطاولات في تشغيل متصل", en: "Orders, kitchen and tables in a connected operation" },
      overview: { ar: "إدارة الطلبات والطاولات والمطبخ والقوائم والمخزون والموردين والموظفين والعملاء والتقارير.", en: "Manage orders, tables, kitchen, menus, inventory, suppliers, staff, customers and reporting." },
      features: { ar: ["نقطة بيع للمطعم", "الطاولات والحجوزات", "شاشة المطبخ", "القائمة والإضافات", "المخزون والموردون", "تقارير المبيعات"], en: ["Restaurant POS", "Tables and reservations", "Kitchen display", "Menu and modifiers", "Inventory and suppliers", "Sales reports"] },
      modules: { ar: ["لوحة التحكم", "نقطة البيع", "الطلبات", "الطاولات", "المطبخ", "القائمة", "المخزون", "التقارير"], en: ["Dashboard", "Point of sale", "Orders", "Tables", "Kitchen", "Menu", "Inventory", "Reports"] },
      metrics: { ar: [["86", "طلبًا"], ["24", "طاولة"], ["12", "في المطبخ"], ["8,460", "مبيعات اليوم"]], en: [["86", "Orders"], ["24", "Tables"], ["12", "In kitchen"], ["8,460", "Today's sales"]] },
      handle: "varex-restaurant",
      plans: plans(48897760461049, 48897760493817, 48897760526585)
    },
    cafe: {
      icon: "◉",
      theme: "coffee",
      name: { ar: "نظام إدارة المقاهي", en: "Cafe Management" },
      eyebrow: { ar: "طلبات أسرع ومخزون أوضح للمقهى", en: "Faster orders and clearer cafe inventory" },
      overview: { ar: "نظام تشغيل للمقاهي يجمع نقطة البيع والطلبات والقائمة والمخزون والموردين والموظفين والتقارير.", en: "A cafe operating system combining point of sale, orders, menu, inventory, suppliers, staff and reports." },
      features: { ar: ["نقطة بيع سريعة", "الطلبات والتحضير", "القائمة والأحجام", "المخزون والوصفات", "الموردون والموظفون", "تقارير يومية"], en: ["Fast point of sale", "Orders and preparation", "Menu and sizes", "Inventory and recipes", "Suppliers and staff", "Daily reporting"] },
      modules: { ar: ["لوحة التحكم", "نقطة البيع", "الطلبات", "التحضير", "القائمة", "المخزون", "الموردون", "التقارير"], en: ["Dashboard", "Point of sale", "Orders", "Preparation", "Menu", "Inventory", "Suppliers", "Reports"] },
      metrics: { ar: [["142", "طلبًا"], ["18", "قيد التحضير"], ["74", "منتجًا"], ["6,920", "مبيعات اليوم"]], en: [["142", "Orders"], ["18", "In preparation"], ["74", "Products"], ["6,920", "Today's sales"]] },
      handle: "varex-cafe",
      plans: plans(48897760592121, 48897760624889, 48897760657657)
    },
    "women-salon": {
      icon: "✦",
      theme: "rose",
      name: { ar: "نظام إدارة الصالون النسائي", en: "Women's Salon Management" },
      eyebrow: { ar: "المواعيد والخدمات والعمولات في تنظيم واحد", en: "Appointments, services and commissions in one flow" },
      overview: { ar: "إدارة المواعيد والخدمات والعملاء والموظفين والعمولات والمخزون ونقطة البيع وتقارير الأداء.", en: "Manage appointments, services, clients, staff, commissions, inventory, point of sale and performance reports." },
      features: { ar: ["جدول المواعيد", "الخدمات والباقات", "العملاء والسجل", "الموظفون والعمولات", "المخزون ونقطة البيع", "تقارير الأداء"], en: ["Appointment calendar", "Services and packages", "Clients and history", "Staff and commissions", "Inventory and POS", "Performance reports"] },
      modules: { ar: ["لوحة التحكم", "المواعيد", "الخدمات", "العملاء", "الموظفون", "العمولات", "نقطة البيع", "التقارير"], en: ["Dashboard", "Appointments", "Services", "Clients", "Staff", "Commissions", "Point of sale", "Reports"] },
      metrics: { ar: [["28", "موعدًا"], ["16", "خدمة"], ["9", "موظفين"], ["4,680", "إيراد اليوم"]], en: [["28", "Appointments"], ["16", "Services"], ["9", "Staff"], ["4,680", "Today's revenue"]] },
      handle: "varex-women-salon",
      plans: plans(48897760723193, 48897760755961, 48897760788729)
    },
    "men-salon": {
      icon: "✦",
      theme: "sky",
      name: { ar: "نظام إدارة الصالون الرجالي", en: "Men's Salon Management" },
      eyebrow: { ar: "الحجوزات والخدمات والعمولات بمتابعة واضحة", en: "Clear tracking for bookings, services and commissions" },
      overview: { ar: "إدارة المواعيد والخدمات والعملاء والموظفين والعمولات والمخزون ونقطة البيع وتقارير الأداء.", en: "Manage appointments, services, clients, staff, commissions, inventory, point of sale and performance reports." },
      features: { ar: ["جدول المواعيد", "الخدمات والباقات", "العملاء والسجل", "الموظفون والعمولات", "المخزون ونقطة البيع", "تقارير الأداء"], en: ["Appointment calendar", "Services and packages", "Clients and history", "Staff and commissions", "Inventory and POS", "Performance reports"] },
      modules: { ar: ["لوحة التحكم", "المواعيد", "الخدمات", "العملاء", "الموظفون", "العمولات", "نقطة البيع", "التقارير"], en: ["Dashboard", "Appointments", "Services", "Clients", "Staff", "Commissions", "Point of sale", "Reports"] },
      metrics: { ar: [["31", "موعدًا"], ["14", "خدمة"], ["8", "موظفين"], ["4,120", "إيراد اليوم"]], en: [["31", "Appointments"], ["14", "Services"], ["8", "Staff"], ["4,120", "Today's revenue"]] },
      handle: "varex-men-salon",
      plans: plans(48897760854265, 48897760887033, 48897760919801)
    },
    pharmacy: {
      icon: "+",
      theme: "emerald",
      name: { ar: "نظام إدارة الصيدليات", en: "Pharmacy Management" },
      eyebrow: { ar: "الأدوية والدفعات والصلاحية تحت رقابة دقيقة", en: "Precise control of medicines, batches and expiry" },
      overview: { ar: "إدارة المبيعات والأدوية والدفعات وتواريخ الصلاحية والوصفات والموردين والمخزون والتقارير.", en: "Manage sales, medicines, batches, expiry dates, prescriptions, suppliers, inventory and reports." },
      features: { ar: ["نقطة بيع صيدلية", "الأدوية والبدائل", "الدفعات والصلاحية", "الوصفات والعملاء", "الموردون والمشتريات", "التنبيهات والتقارير"], en: ["Pharmacy POS", "Medicines and alternatives", "Batches and expiry", "Prescriptions and clients", "Suppliers and purchases", "Alerts and reports"] },
      modules: { ar: ["لوحة التحكم", "نقطة البيع", "الأدوية", "الدفعات", "الوصفات", "المخزون", "الموردون", "التقارير"], en: ["Dashboard", "Point of sale", "Medicines", "Batches", "Prescriptions", "Inventory", "Suppliers", "Reports"] },
      metrics: { ar: [["1,842", "دواء"], ["23", "تنبيه صلاحية"], ["71", "فاتورة"], ["9,230", "مبيعات اليوم"]], en: [["1,842", "Medicines"], ["23", "Expiry alerts"], ["71", "Invoices"], ["9,230", "Today's sales"]] },
      handle: "varex-pharmacy",
      plans: plans(48897760952569, 48897760985337, 48897761018105)
    },
    shipping: {
      icon: "▰",
      theme: "coffee",
      name: { ar: "نظام إدارة شركات الشحن", en: "Shipping Company Management" },
      eyebrow: { ar: "من الاستلام إلى التسليم، كل حركة تحت السيطرة", en: "Every movement controlled from pickup to delivery" },
      overview: { ar: "إدارة الشحنات والتتبع والأسطول والسائقين والمستودعات والعملاء والتحصيل وتقارير التشغيل.", en: "Manage shipments, tracking, fleet, drivers, warehouses, customers, collections and operational reports." },
      features: { ar: ["إنشاء الشحنات", "التتبع والحالات", "الأسطول والسائقون", "المستودعات والمسارات", "العملاء والتحصيل", "التقارير والتنبيهات"], en: ["Shipment creation", "Tracking and statuses", "Fleet and drivers", "Warehouses and routes", "Customers and collections", "Reports and alerts"] },
      modules: { ar: ["مركز التحكم", "الشحنات", "التتبع", "الأسطول", "السائقون", "المستودعات", "العملاء", "التقارير"], en: ["Control center", "Shipments", "Tracking", "Fleet", "Drivers", "Warehouses", "Customers", "Reports"] },
      metrics: { ar: [["284", "شحنة نشطة"], ["47", "في الطريق"], ["96%", "تسليم ناجح"], ["18", "مركبة"]], en: [["284", "Active shipments"], ["47", "In transit"], ["96%", "Delivery rate"], ["18", "Vehicles"]] },
      handle: "varex-shipping",
      plans: plans(48897761083641, 48897761116409, 48897761149177)
    },
    construction: {
      icon: "△",
      theme: "gold",
      name: { ar: "نظام إدارة المقاولات", en: "Construction Contracting Management" },
      eyebrow: { ar: "المشاريع والعقود والتكاليف في متابعة موحدة", en: "Unified tracking for projects, contracts and costs" },
      overview: { ar: "إدارة المشاريع والمواقع والعقود والمستخلصات والتكاليف والعمال والمعدات والموردين والتقارير.", en: "Manage projects, sites, contracts, certificates, costs, workforce, equipment, suppliers and reports." },
      features: { ar: ["المشاريع والمواقع", "العقود والمستخلصات", "التكاليف والموازنات", "العمال والمقاولون", "المعدات والموردون", "التقارير ونسب الإنجاز"], en: ["Projects and sites", "Contracts and certificates", "Costs and budgets", "Workforce and subcontractors", "Equipment and suppliers", "Reports and progress"] },
      modules: { ar: ["لوحة التحكم", "المشاريع", "العقود", "المستخلصات", "التكاليف", "العمال", "المعدات", "التقارير"], en: ["Dashboard", "Projects", "Contracts", "Certificates", "Costs", "Workforce", "Equipment", "Reports"] },
      metrics: { ar: [["14", "مشروعًا"], ["62%", "متوسط الإنجاز"], ["8", "مواقع نشطة"], ["3", "مستخلصات معلقة"]], en: [["14", "Projects"], ["62%", "Average progress"], ["8", "Active sites"], ["3", "Pending certificates"]] },
      handle: "varex-construction",
      plans: plans(48897761181945, 48897761214713, 48897761247481)
    },
    "perfumes-cosmetics": {
      icon: "✧",
      theme: "berry",
      name: { ar: "نظام العطور ومواد التجميل", en: "Perfumes & Cosmetics Management" },
      eyebrow: { ar: "المنتجات والدفعات والمبيعات بواجهة متخصصة", en: "Specialized control for products, batches and sales" },
      overview: { ar: "نظام متخصص لنقطة البيع والمنتجات والدفعات والمخزون والمشتريات والموردين والعملاء والتقارير.", en: "A specialized system for point of sale, products, batches, inventory, purchases, suppliers, customers and reports." },
      features: { ar: ["نقطة بيع متخصصة", "المنتجات والتصنيفات", "الدفعات والصلاحية", "المخزون والمشتريات", "العملاء والموردون", "تقارير المبيعات"], en: ["Specialized point of sale", "Products and categories", "Batches and expiry", "Inventory and purchases", "Customers and suppliers", "Sales reports"] },
      modules: { ar: ["لوحة التحكم", "نقطة البيع", "المنتجات", "الدفعات", "المخزون", "المشتريات", "العملاء", "التقارير"], en: ["Dashboard", "Point of sale", "Products", "Batches", "Inventory", "Purchases", "Customers", "Reports"] },
      metrics: { ar: [["684", "منتجًا"], ["19", "تنبيه مخزون"], ["58", "فاتورة"], ["7,840", "مبيعات اليوم"]], en: [["684", "Products"], ["19", "Stock alerts"], ["58", "Invoices"], ["7,840", "Today's sales"]] },
      handle: "varex-perfumes-cosmetics",
      plans: plans(48897761509625, 48897761542393, 48897761575161)
    },
    cafeteria: {
      icon: "◌",
      theme: "orange",
      name: { ar: "نظام إدارة الكافتيريا", en: "Cafeteria Management" },
      eyebrow: { ar: "طلبات سريعة وتشغيل يومي خفيف وواضح", en: "Fast orders and clear day-to-day operation" },
      overview: { ar: "إدارة نقطة البيع والطلبات والقائمة والمخزون والموردين والموظفين وتقارير التشغيل اليومية.", en: "Manage point of sale, orders, menu, inventory, suppliers, staff and daily operational reports." },
      features: { ar: ["نقطة بيع سريعة", "الطلبات والتحضير", "القائمة والأسعار", "المخزون والمشتريات", "الموردون والموظفون", "تقارير يومية"], en: ["Fast point of sale", "Orders and preparation", "Menu and pricing", "Inventory and purchases", "Suppliers and staff", "Daily reports"] },
      modules: { ar: ["لوحة التحكم", "نقطة البيع", "الطلبات", "التحضير", "القائمة", "المخزون", "الموردون", "التقارير"], en: ["Dashboard", "Point of sale", "Orders", "Preparation", "Menu", "Inventory", "Suppliers", "Reports"] },
      metrics: { ar: [["119", "طلبًا"], ["11", "قيد التحضير"], ["52", "منتجًا"], ["5,370", "مبيعات اليوم"]], en: [["119", "Orders"], ["11", "In preparation"], ["52", "Products"], ["5,370", "Today's sales"]] },
      handle: "varex-cafeteria",
      plans: plans(48897761640697, 48897761673465, 48897761706233)
    }
  };

  const aliases = {
    accounting: "cashier",
    system: "cashier",
    salon: "women-salon",
    real_estate: "real-estate",
    car_rental: "car-rental",
    women_salon: "women-salon",
    men_salon: "men-salon",
    perfumes: "perfumes-cosmetics",
    cosmetics: "perfumes-cosmetics"
  };

  function normalizeSlug(value) {
    const slug = String(value || "cashier").trim().toLowerCase();
    const normalized = aliases[slug] || slug;
    return apps[normalized] ? normalized : "cashier";
  }

  function mixHex(source, target, amount) {
    const clean = String(source || "").replace("#", "");
    const end = String(target || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(clean) || !/^[0-9a-f]{6}$/i.test(end)) return source;
    const values = [0, 2, 4].map((start) => Number.parseInt(clean.slice(start, start + 2), 16));
    const targets = [0, 2, 4].map((start) => Number.parseInt(end.slice(start, start + 2), 16));
    return `#${values.map((value, index) => Math.round(value + (targets[index] - value) * amount).toString(16).padStart(2, "0")).join("")}`;
  }

  function colorValue(value) {
    const clean = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(clean)) return clean.toUpperCase();
    return themes[clean] || null;
  }

  function resolveTheme(slug, params) {
    const appSlug = normalizeSlug(slug);
    const app = apps[appSlug];
    const query = params instanceof URLSearchParams ? params : new URLSearchParams(params || "");
    let selected = colorValue(query.get("color")) || colorValue(query.get("theme"));
    const storageKeys = [`varex_catalog_theme_${appSlug}`];
    if (appSlug === "shipping") storageKeys.push("varex-shipping-theme");
    if (appSlug === "cafe" || appSlug === "cafeteria") storageKeys.push("varex_cafe_theme_color", "varex_cafe_appearance");
    if (!selected) {
      for (const key of storageKeys) {
        try {
          selected = colorValue(localStorage.getItem(key));
        } catch (_) {
          selected = null;
        }
        if (selected) break;
      }
    }
    selected = selected || themes[app.theme] || themes.navy;
    if (query.has("color") || query.has("theme")) {
      try { localStorage.setItem(storageKeys[0], selected); } catch (_) { }
    }
    return {
      primary: selected,
      deep: mixHex(selected, "#000000", 0.46),
      darker: mixHex(selected, "#000000", 0.68),
      soft: mixHex(selected, "#FFFFFF", 0.9),
      pale: mixHex(selected, "#FFFFFF", 0.96),
      line: mixHex(selected, "#FFFFFF", 0.76)
    };
  }

  function planUrl(app, planKey) {
    const plan = app && app.plans && app.plans[planKey];
    if (!app || !plan) return "https://www.varexapp.com/collections/all";
    return `https://www.varexapp.com/cart/${encodeURIComponent(plan.variant)}:1`;
  }

  root.VAREX_CATALOG = { themes, apps, aliases, normalizeSlug, mixHex, colorValue, resolveTheme, planUrl };
})(window);
