/* =========================================================
   VAREX CORE
   Shared Data Layer
   FINAL POS COMPATIBLE VERSION
   ========================================================= */

const VAREX = {

  /* =====================================================
     STORAGE KEYS
     ===================================================== */

  keys: {
    products: "varex_products",
    sales: "varex_sales",
    customers: "varex_customers",
    suppliers: "varex_suppliers",
    employees: "varex_employees",
    transactions: "varexTransactions",
    settings: "varex_settings",
    heldSales: "varex_held_sales"
  },

  /* =====================================================
     GENERAL HELPERS
     ===================================================== */

  getData(key) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return [];
      }

      const data = JSON.parse(raw);

      return Array.isArray(data)
        ? data
        : [];

    } catch (error) {

      console.error(
        "VAREX data error:",
        error
      );

      return [];
    }
  },


  saveData(key, data) {
    try {

      localStorage.setItem(
        key,
        JSON.stringify(data)
      );

      return true;

    } catch (error) {

      console.error(
        "VAREX save error:",
        error
      );

      return false;
    }
  },


  getObject(key, fallback = {}) {
    try {

      const raw =
        localStorage.getItem(key);

      if (!raw) {
        return {
          ...fallback
        };
      }

      const data =
        JSON.parse(raw);

      if (
        !data ||
        Array.isArray(data) ||
        typeof data !== "object"
      ) {
        return {
          ...fallback
        };
      }

      return {
        ...fallback,
        ...data
      };

    } catch (error) {

      console.error(
        "VAREX object error:",
        error
      );

      return {
        ...fallback
      };
    }
  },


  saveObject(key, data) {
    try {

      localStorage.setItem(
        key,
        JSON.stringify(data)
      );

      return true;

    } catch (error) {

      console.error(
        "VAREX object save error:",
        error
      );

      return false;
    }
  },


  generateId(prefix = "VRX") {

    return (
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.floor(
        Math.random() * 1000000
      )
    );
  },


  toNumber(value, fallback = 0) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  },


  positiveNumber(value) {

    return Math.max(
      0,
      this.toNumber(
        value,
        0
      )
    );
  },


  cleanText(value) {

    return String(
      value == null
        ? ""
        : value
    ).trim();
  },


  now() {

    return new Date()
      .toISOString();
  },


  today() {

    const date =
      new Date();

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  },


  normalizeDate(value) {

    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(value)
        .slice(
          0,
          10
        );
    }

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  },


  /* =====================================================
     SETTINGS
     ===================================================== */

  getDefaultSettings() {

    return {

      businessName:
        "VAREX",

      businessNameArabic:
        "",

      currency:
        "د.إ",

      currencyCode:
        "AED",

      taxRate:
        0,

      taxNumber:
        "",

      phone:
        "",

      email:
        "",

      address:
        "",

      invoicePrefix:
        "INV",

      invoiceCounter:
        1
    };
  },


  getSettings() {

    return this.getObject(
      this.keys.settings,
      this.getDefaultSettings()
    );
  },


  saveSettings(settings) {

    const current =
      this.getSettings();

    const updated = {
      ...current,
      ...settings
    };

    updated.currency =
      this.cleanText(
        updated.currency
      ) || "د.إ";

    updated.currencyCode =
      this.cleanText(
        updated.currencyCode
      ) || "AED";

    updated.invoicePrefix =
      this.cleanText(
        updated.invoicePrefix
      ) || "INV";

    updated.invoiceCounter =
      Math.max(
        1,
        Math.floor(
          this.toNumber(
            updated.invoiceCounter,
            1
          )
        )
      );

    updated.taxRate =
      this.positiveNumber(
        updated.taxRate
      );

    return this.saveObject(
      this.keys.settings,
      updated
    );
  },


  money(value) {

    const settings =
      this.getSettings();

    const currency =
      settings.currency ||
      "د.إ";

    return (
      this.toNumber(
        value,
        0
      ).toFixed(2) +
      " " +
      currency
    );
  },


  generateInvoiceNumber() {

    const settings =
      this.getSettings();

    const prefix =
      settings.invoicePrefix ||
      "INV";

    const counter =
      Math.max(
        1,
        Math.floor(
          this.toNumber(
            settings.invoiceCounter,
            1
          )
        )
      );

    const invoiceNumber =
      prefix +
      "-" +
      String(counter)
        .padStart(
          6,
          "0"
        );

    settings.invoiceCounter =
      counter + 1;

    this.saveSettings(
      settings
    );

    return invoiceNumber;
  },


  /* =====================================================
     DATE HELPERS
     ===================================================== */

  getDaysUntil(dateValue) {

    if (!dateValue) {
      return null;
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const target =
      new Date(
        String(dateValue)
          .slice(0, 10) +
        "T00:00:00"
      );

    if (
      Number.isNaN(
        target.getTime()
      )
    ) {
      return null;
    }

    const difference =
      target.getTime() -
      today.getTime();

    return Math.ceil(
      difference /
      (
        1000 *
        60 *
        60 *
        24
      )
    );
  },


  getDocumentStatus(dateValue) {

    const days =
      this.getDaysUntil(
        dateValue
      );

    if (days === null) {

      return {
        status: "none",
        level: "none",
        text:
          "لم يحدد تاريخ الانتهاء",
        days: null
      };
    }

    if (days < 0) {

      return {
        status: "expired",
        level: "danger",
        text: "منتهية",
        days
      };
    }

    if (days === 0) {

      return {
        status: "today",
        level: "danger",
        text:
          "تنتهي اليوم",
        days
      };
    }

    if (days <= 7) {

      return {
        status: "urgent",
        level: "danger",
        text:
          "تنتهي خلال " +
          days +
          " يوم",
        days
      };
    }

    if (days <= 30) {

      return {
        status: "warning",
        level: "warning",
        text:
          "تنتهي خلال " +
          days +
          " يوم",
        days
      };
    }

    if (days <= 60) {

      return {
        status: "notice",
        level: "notice",
        text:
          "تنتهي خلال " +
          days +
          " يوم",
        days
      };
    }

    return {
      status: "valid",
      level: "success",
      text: "سارية",
      days
    };
  },


  /* =====================================================
     PRODUCTS
     ===================================================== */

  getProducts() {

    return this.getData(
      this.keys.products
    );
  },


  saveProducts(products) {

    return this.saveData(
      this.keys.products,
      products
    );
  },


  findProduct(id) {

    return (
      this.getProducts()
        .find(
          product =>
            String(
              product.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  findProductByBarcode(barcode) {

    const value =
      this.cleanText(
        barcode
      );

    if (!value) {
      return null;
    }

    return (
      this.getProducts()
        .find(
          product =>
            this.cleanText(
              product.barcode
            ) === value
        ) ||
      null
    );
  },


  barcodeExists(
    barcode,
    excludeId = null
  ) {

    const value =
      this.cleanText(
        barcode
      );

    if (!value) {
      return false;
    }

    return this
      .getProducts()
      .some(
        product => {

          const sameBarcode =
            this.cleanText(
              product.barcode
            ) === value;

          const differentProduct =
            excludeId === null ||
            String(
              product.id
            ) !==
            String(
              excludeId
            );

          return (
            sameBarcode &&
            differentProduct
          );
        }
      );
  },


  addProduct(product = {}) {

    const name =
      this.cleanText(
        product.name
      );

    const barcode =
      this.cleanText(
        product.barcode
      );

    if (!name) {

      return {
        success: false,
        message:
          "اسم المنتج مطلوب."
      };
    }

    if (
      barcode &&
      this.barcodeExists(
        barcode
      )
    ) {

      return {
        success: false,
        message:
          "هذا الباركود مستخدم لمنتج آخر."
      };
    }

    const products =
      this.getProducts();

    const now =
      this.now();

    const newProduct = {

      id:
        product.id ||
        this.generateId(
          "PRD"
        ),

      name,

      barcode,

      category:
        this.cleanText(
          product.category
        ) ||
        "عام",

      cost:
        this.positiveNumber(
          product.cost
        ),

      price:
        this.positiveNumber(
          product.price
        ),

      quantity:
        this.positiveNumber(
          product.quantity
        ),

      minimumStock:
        this.positiveNumber(
          product.minimumStock
        ),

      supplier:
        this.cleanText(
          product.supplier
        ),

      supplierId:
        this.cleanText(
          product.supplierId
        ),

      sku:
        this.cleanText(
          product.sku
        ),

      unit:
        this.cleanText(
          product.unit
        ) ||
        "قطعة",

      notes:
        this.cleanText(
          product.notes
        ),

      createdAt: now,

      updatedAt: now
    };

    products.push(
      newProduct
    );

    this.saveProducts(
      products
    );

    return newProduct;
  },


  updateProduct(
    id,
    changes = {}
  ) {

    const products =
      this.getProducts();

    const index =
      products.findIndex(
        product =>
          String(
            product.id
          ) ===
          String(id)
      );

    if (index === -1) {

      return {
        success: false,
        message:
          "المنتج غير موجود."
      };
    }

    const updatedChanges = {
      ...changes
    };

    if (
      updatedChanges.barcode !==
      undefined
    ) {

      const barcode =
        this.cleanText(
          updatedChanges.barcode
        );

      if (
        barcode &&
        this.barcodeExists(
          barcode,
          id
        )
      ) {

        return {
          success: false,
          message:
            "هذا الباركود مستخدم لمنتج آخر."
        };
      }

      updatedChanges.barcode =
        barcode;
    }

    if (
      updatedChanges.name !==
      undefined
    ) {

      const name =
        this.cleanText(
          updatedChanges.name
        );

      if (!name) {

        return {
          success: false,
          message:
            "اسم المنتج مطلوب."
        };
      }

      updatedChanges.name =
        name;
    }

    if (
      updatedChanges.category !==
      undefined
    ) {

      updatedChanges.category =
        this.cleanText(
          updatedChanges.category
        ) ||
        "عام";
    }

    [
      "price",
      "cost",
      "quantity",
      "minimumStock"
    ].forEach(
      key => {

        if (
          updatedChanges[key] !==
          undefined
        ) {

          updatedChanges[key] =
            this.positiveNumber(
              updatedChanges[key]
            );
        }
      }
    );

    products[index] = {

      ...products[index],

      ...updatedChanges,

      updatedAt:
        this.now()
    };

    this.saveProducts(
      products
    );

    return products[index];
  },


  deleteProduct(id) {

    const products =
      this.getProducts();

    const exists =
      products.some(
        product =>
          String(
            product.id
          ) ===
          String(id)
      );

    if (!exists) {

      return {
        success: false,
        message:
          "المنتج غير موجود."
      };
    }

    const updated =
      products.filter(
        product =>
          String(
            product.id
          ) !==
          String(id)
      );

    this.saveProducts(
      updated
    );

    return {
      success: true
    };
  },


  changeStock(
    productId,
    amount
  ) {

    const products =
      this.getProducts();

    const index =
      products.findIndex(
        product =>
          String(
            product.id
          ) ===
          String(
            productId
          )
      );

    if (index === -1) {
      return false;
    }

    const currentQuantity =
      this.positiveNumber(
        products[index]
          .quantity
      );

    const change =
      this.toNumber(
        amount,
        0
      );

    const newQuantity =
      currentQuantity +
      change;

    if (newQuantity < 0) {
      return false;
    }

    products[index].quantity =
      newQuantity;

    products[index].updatedAt =
      this.now();

    this.saveProducts(
      products
    );

    return products[index];
  },


  getProductStockStatus(product) {

    const quantity =
      this.positiveNumber(
        product.quantity
      );

    const minimum =
      this.positiveNumber(
        product.minimumStock
      );

    if (quantity <= 0) {

      return {
        key: "out",
        text:
          "نفد المخزون"
      };
    }

    if (
      minimum > 0 &&
      quantity <= minimum
    ) {

      return {
        key: "low",
        text:
          "مخزون منخفض"
      };
    }

    return {
      key: "available",
      text: "متوفر"
    };
  },


  getAvailableProducts() {

    return this
      .getProducts()
      .filter(
        product =>
          this
            .getProductStockStatus(
              product
            )
            .key ===
          "available"
      );
  },


  getLowStockProducts() {

    return this
      .getProducts()
      .filter(
        product =>
          this
            .getProductStockStatus(
              product
            )
            .key ===
          "low"
      );
  },


  getOutOfStockProducts() {

    return this
      .getProducts()
      .filter(
        product =>
          this
            .getProductStockStatus(
              product
            )
            .key ===
          "out"
      );
  },


  getProductTodaySales(productId) {

    const today =
      this.today();

    let quantity = 0;

    this.getSales()
      .forEach(
        sale => {

          if (
            this.normalizeDate(
              sale.date ||
              sale.createdAt
            ) !== today
          ) {
            return;
          }

          const items =
            Array.isArray(
              sale.items
            )
              ? sale.items
              : [];

          items.forEach(
            item => {

              if (
                String(
                  item.productId
                ) ===
                String(
                  productId
                )
              ) {

                quantity +=
                  this.positiveNumber(
                    item.quantity
                  );
              }
            }
          );
        }
      );

    return quantity;
  },


  getProductTotalSales(productId) {

    let quantity = 0;

    this.getSales()
      .forEach(
        sale => {

          const items =
            Array.isArray(
              sale.items
            )
              ? sale.items
              : [];

          items.forEach(
            item => {

              if (
                String(
                  item.productId
                ) ===
                String(
                  productId
                )
              ) {

                quantity +=
                  this.positiveNumber(
                    item.quantity
                  );
              }
            }
          );
        }
      );

    return quantity;
  },


  getInventorySummary() {

    const products =
      this.getProducts();

    let stockQuantity = 0;

    let inventoryCost = 0;

    let inventorySaleValue = 0;

    products.forEach(
      product => {

        const quantity =
          this.positiveNumber(
            product.quantity
          );

        const cost =
          this.positiveNumber(
            product.cost
          );

        const price =
          this.positiveNumber(
            product.price
          );

        stockQuantity +=
          quantity;

        inventoryCost +=
          quantity * cost;

        inventorySaleValue +=
          quantity * price;
      }
    );

    return {

      totalProducts:
        products.length,

      stockQuantity,

      availableProducts:
        this
          .getAvailableProducts()
          .length,

      lowStock:
        this
          .getLowStockProducts()
          .length,

      outOfStock:
        this
          .getOutOfStockProducts()
          .length,

      inventoryCost,

      inventorySaleValue,

      potentialProfit:
        inventorySaleValue -
        inventoryCost
    };
  },


  /* =====================================================
     SALES
     ===================================================== */

  getSales() {

    return this.getData(
      this.keys.sales
    );
  },


  saveSales(sales) {

    return this.saveData(
      this.keys.sales,
      sales
    );
  },


  findSale(id) {

    return (
      this.getSales()
        .find(
          sale =>
            String(
              sale.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  createSale(
    items,
    options = {}
  ) {

    if (
      !Array.isArray(items) ||
      !items.length
    ) {

      return {
        success: false,
        message:
          "الفاتورة فارغة."
      };
    }


    const products =
      this.getProducts();

    const normalizedItems = [];


    /* -------------------------------------------------
       التحقق من كامل الفاتورة قبل خصم المخزون
       ------------------------------------------------- */

    for (
      const item of items
    ) {

      const productIndex =
        products.findIndex(
          product =>
            String(
              product.id
            ) ===
            String(
              item.productId
            )
        );

      if (
        productIndex === -1
      ) {

        return {
          success: false,
          message:
            "أحد المنتجات غير موجود."
        };
      }


      const product =
        products[
          productIndex
        ];


      const quantity =
        Math.max(
          1,
          Math.floor(
            this.toNumber(
              item.quantity,
              1
            )
          )
        );


      if (
        this.positiveNumber(
          product.quantity
        ) < quantity
      ) {

        return {
          success: false,
          message:
            "الكمية غير كافية للمنتج: " +
            product.name
        };
      }


      const price =
        this.positiveNumber(

          item.price !==
          undefined

            ? item.price

            : product.price
        );


      normalizedItems.push({

        productId:
          product.id,

        name:
          product.name,

        barcode:
          product.barcode ||
          "",

        category:
          product.category ||
          "عام",

        quantity,

        price,

        cost:
          this.positiveNumber(
            product.cost
          ),

        total:
          price *
          quantity
      });
    }


    /* -------------------------------------------------
       حساب الفاتورة
       ------------------------------------------------- */

    const subtotal =
      normalizedItems.reduce(
        (sum, item) =>
          sum +
          item.total,
        0
      );


    const discount =
      Math.min(
        subtotal,
        this.positiveNumber(
          options.discount
        )
      );


    const tax =
      this.positiveNumber(
        options.tax
      );


    const total =
      Math.max(
        0,
        subtotal -
        discount +
        tax
      );


    const costTotal =
      normalizedItems.reduce(
        (sum, item) =>
          sum +
          (
            item.cost *
            item.quantity
          ),
        0
      );


    const grossProfit =
      subtotal -
      costTotal;


    const profit =
      total -
      costTotal;


    /* -------------------------------------------------
       بيانات العميل
       ------------------------------------------------- */

    const customerId =
      this.cleanText(
        options.customerId
      );


    const customerName =
      this.cleanText(
        options.customerName
      ) ||
      "عميل نقدي";


    const customerPhone =
      this.cleanText(
        options.customerPhone
      );


    /* -------------------------------------------------
       بيانات الدفع
       ------------------------------------------------- */

    const paymentMethod =
      this.cleanText(
        options.paymentMethod
      ) ||
      "نقدي";


    let paid;

    let due;

    let amountReceived =
      this.positiveNumber(
        options.amountReceived
      );

    let change =
      this.positiveNumber(
        options.change
      );


    /*
      النقدي / البطاقة / التحويل:
      تعتبر الفاتورة مدفوعة بالكامل.

      الآجل:
      نعتمد المبلغ المدفوع فعلياً.
    */

    if (
      paymentMethod === "آجل"
    ) {

      paid =
        Math.min(
          total,
          this.positiveNumber(
            options.paid
          )
        );

      due =
        Math.max(
          0,
          total -
          paid
        );

      amountReceived =
        paid;

      change = 0;

    } else {

      paid =
        total;

      due = 0;


      if (
        paymentMethod === "نقدي"
      ) {

        if (
          amountReceived <= 0
        ) {

          amountReceived =
            total;
        }

        change =
          Math.max(
            0,
            amountReceived -
            total
          );

      } else {

        amountReceived =
          total;

        change = 0;
      }
    }


    /* -------------------------------------------------
       تحديد حالة الدفع
       ------------------------------------------------- */

    let paymentStatus;


    if (
      due <= 0
    ) {

      paymentStatus =
        "مدفوع";

    } else if (
      paid > 0
    ) {

      paymentStatus =
        "مدفوع جزئياً";

    } else {

      paymentStatus =
        "غير مدفوع";
    }


    const now =
      this.now();


    /* -------------------------------------------------
       خصم المخزون بعد نجاح التحقق
       ------------------------------------------------- */

    normalizedItems.forEach(
      item => {

        const productIndex =
          products.findIndex(
            product =>
              String(
                product.id
              ) ===
              String(
                item.productId
              )
          );


        products[
          productIndex
        ].quantity =

          this.positiveNumber(
            products[
              productIndex
            ].quantity
          ) -

          item.quantity;


        products[
          productIndex
        ].updatedAt =
          now;
      }
    );


    const invoiceNumber =
      this.generateInvoiceNumber();


    /* -------------------------------------------------
       إنشاء سجل البيع
       ------------------------------------------------- */

    const sale = {

      id:
        this.generateId(
          "SALE"
        ),

      invoiceNumber,

      date:
        now,

      createdAt:
        now,

      updatedAt:
        now,

      customerId,

      customerName,

      customerPhone,

      paymentMethod,

      paymentStatus,

      paymentReference:
        this.cleanText(
          options.paymentReference
        ),

      items:
        normalizedItems,

      subtotal,

      discount,

      tax,

      total,

      paid,

      due,

      remaining:
        due,

      amountReceived,

      change,

      costTotal,

      grossProfit,

      profit,

      notes:
        this.cleanText(
          options.notes
        ),

      status:
        "مكتملة"
    };


    /* -------------------------------------------------
       حفظ المخزون
       ------------------------------------------------- */

    const productsSaved =
      this.saveProducts(
        products
      );

    if (!productsSaved) {

      return {
        success: false,
        message:
          "تعذر حفظ تحديث المخزون."
      };
    }


    /* -------------------------------------------------
       حفظ الفاتورة
       ------------------------------------------------- */

    const sales =
      this.getSales();


    sales.unshift(
      sale
    );


    const salesSaved =
      this.saveSales(
        sales
      );


    if (!salesSaved) {

      return {
        success: false,
        message:
          "تعذر حفظ الفاتورة."
      };
    }


    /* -------------------------------------------------
       تسجيل المقبوض الفعلي في الحسابات

       نقدي / بطاقة / تحويل:
       كامل الفاتورة.

       آجل جزئي:
       فقط المبلغ المقبوض.

       آجل بدون دفعة:
       لا حركة دخل.
       ------------------------------------------------- */

    if (
      paid > 0
    ) {

      this.addTransaction({

        type:
          "income",

        description:
          paymentMethod === "آجل" &&
          due > 0

            ? "دفعة جزئية من فاتورة " +
              sale.invoiceNumber

            : "مبيعات فاتورة " +
              sale.invoiceNumber,

        category:
          "المبيعات",

        amount:
          paid,

        date:
          this.today(),

        payment:
          sale.paymentMethod,

        referenceId:
          sale.id,

        invoiceNumber:
          sale.invoiceNumber,

        notes:
          due > 0
            ? "المتبقي على العميل: " +
              due
            : ""
      });
    }


    return {

      success: true,

      sale
    };
  },


  getTodaySales() {

    const today =
      this.today();

    return this
      .getSales()
      .filter(
        sale =>
          this.normalizeDate(
            sale.date ||
            sale.createdAt
          ) ===
          today
      );
  },


  getTodaySalesSummary() {

    const sales =
      this.getTodaySales();


    const total =
      sales.reduce(
        (sum, sale) =>
          sum +
          this.positiveNumber(
            sale.total
          ),
        0
      );


    const profit =
      sales.reduce(
        (sum, sale) =>
          sum +
          this.toNumber(
            sale.profit,
            0
          ),
        0
      );


    const items =
      sales.reduce(
        (
          sum,
          sale
        ) => {

          const saleItems =
            Array.isArray(
              sale.items
            )
              ? sale.items
              : [];

          return (
            sum +
            saleItems.reduce(
              (
                itemSum,
                item
              ) =>
                itemSum +
                this.positiveNumber(
                  item.quantity
                ),
              0
            )
          );
        },
        0
      );


    const paid =
      sales.reduce(
        (sum, sale) => {

          const value =
            sale.paid !==
            undefined

              ? sale.paid

              : (
                  sale.paymentMethod ===
                  "آجل"

                    ? 0

                    : sale.total
                );

          return (
            sum +
            this.positiveNumber(
              value
            )
          );

        },
        0
      );


    const due =
      sales.reduce(
        (sum, sale) =>
          sum +
          this.positiveNumber(
            sale.due ||
            sale.remaining
          ),
        0
      );


    return {

      invoices:
        sales.length,

      total,

      paid,

      due,

      profit,

      items
    };
  },


  getSalesSummary() {

    const sales =
      this.getSales();

    let total = 0;

    let paid = 0;

    let due = 0;

    let profit = 0;

    let cost = 0;

    let items = 0;


    sales.forEach(
      sale => {

        total +=
          this.positiveNumber(
            sale.total
          );


        const paidValue =
          sale.paid !==
          undefined

            ? sale.paid

            : (
                sale.paymentMethod ===
                "آجل"

                  ? 0

                  : sale.total
              );


        paid +=
          this.positiveNumber(
            paidValue
          );


        due +=
          this.positiveNumber(
            sale.due ||
            sale.remaining
          );


        profit +=
          this.toNumber(
            sale.profit,
            0
          );


        cost +=
          this.positiveNumber(
            sale.costTotal
          );


        const saleItems =
          Array.isArray(
            sale.items
          )
            ? sale.items
            : [];


        saleItems.forEach(
          item => {

            items +=
              this.positiveNumber(
                item.quantity
              );
          }
        );
      }
    );


    return {

      invoices:
        sales.length,

      total,

      paid,

      due,

      cost,

      profit,

      items
    };
  },


  /* =====================================================
     HELD SALES
     ===================================================== */

  getHeldSales() {

    return this.getData(
      this.keys.heldSales
    );
  },


  saveHeldSales(heldSales) {

    return this.saveData(
      this.keys.heldSales,
      heldSales
    );
  },


  addHeldSale(data = {}) {

    const heldSales =
      this.getHeldSales();

    const heldSale = {

      id:
        this.generateId(
          "HOLD"
        ),

      ...data,

      createdAt:
        this.now()
    };


    heldSales.unshift(
      heldSale
    );


    this.saveHeldSales(
      heldSales
    );


    return heldSale;
  },


  findHeldSale(id) {

    return (
      this.getHeldSales()
        .find(
          sale =>
            String(
              sale.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  deleteHeldSale(id) {

    const heldSales =
      this
        .getHeldSales()
        .filter(
          sale =>
            String(
              sale.id
            ) !==
            String(id)
        );


    this.saveHeldSales(
      heldSales
    );


    return true;
  },


  clearHeldSales() {

    return this.saveHeldSales(
      []
    );
  },


  /* =====================================================
     ACCOUNTS / TRANSACTIONS
     ===================================================== */

  getTransactions() {

    return this.getData(
      this.keys.transactions
    );
  },


  saveTransactions(transactions) {

    return this.saveData(
      this.keys.transactions,
      transactions
    );
  },


  addTransaction(transaction = {}) {

    const transactions =
      this.getTransactions();

    const now =
      this.now();


    const newTransaction = {

      id:
        transaction.id ||
        this.generateId(
          "TRX"
        ),

      type:
        transaction.type ||
        "expense",

      description:
        this.cleanText(
          transaction.description
        ),

      category:
        this.cleanText(
          transaction.category
        ),

      amount:
        this.positiveNumber(
          transaction.amount
        ),

      date:
        transaction.date ||
        this.today(),

      payment:
        this.cleanText(
          transaction.payment
        ),

      referenceId:
        this.cleanText(
          transaction.referenceId
        ),

      invoiceNumber:
        this.cleanText(
          transaction.invoiceNumber
        ),

      notes:
        this.cleanText(
          transaction.notes
        ),

      createdAt:
        now,

      updatedAt:
        now
    };


    transactions.unshift(
      newTransaction
    );


    this.saveTransactions(
      transactions
    );


    return newTransaction;
  },


  updateTransaction(
    id,
    changes = {}
  ) {

    const transactions =
      this.getTransactions();


    const index =
      transactions.findIndex(
        transaction =>
          String(
            transaction.id
          ) ===
          String(id)
      );


    if (index === -1) {
      return false;
    }


    const updatedChanges = {
      ...changes
    };


    if (
      updatedChanges.amount !==
      undefined
    ) {

      updatedChanges.amount =
        this.positiveNumber(
          updatedChanges.amount
        );
    }


    transactions[index] = {

      ...transactions[index],

      ...updatedChanges,

      updatedAt:
        this.now()
    };


    this.saveTransactions(
      transactions
    );


    return transactions[index];
  },


  deleteTransaction(id) {

    const transactions =
      this
        .getTransactions()
        .filter(
          item =>
            String(
              item.id
            ) !==
            String(id)
        );


    this.saveTransactions(
      transactions
    );


    return true;
  },


  getFinancialSummary() {

    const transactions =
      this.getTransactions();


    let income = 0;

    let expenses = 0;


    transactions.forEach(
      item => {

        const amount =
          this.positiveNumber(
            item.amount
          );


        if (
          item.type ===
          "income"
        ) {

          income +=
            amount;
        }


        if (
          item.type ===
          "expense"
        ) {

          expenses +=
            amount;
        }
      }
    );


    return {

      income,

      expenses,

      balance:
        income -
        expenses,

      transactions:
        transactions.length
    };
  },


  /* =====================================================
     CUSTOMERS
     ===================================================== */

  getCustomers() {

    return this.getData(
      this.keys.customers
    );
  },


  saveCustomers(customers) {

    return this.saveData(
      this.keys.customers,
      customers
    );
  },


  addCustomer(customer = {}) {

    const customers =
      this.getCustomers();

    const now =
      this.now();


    const newCustomer = {

      id:
        customer.id ||
        this.generateId(
          "CUS"
        ),

      name:
        this.cleanText(
          customer.name
        ),

      phone:
        this.cleanText(
          customer.phone
        ),

      email:
        this.cleanText(
          customer.email
        ),

      address:
        this.cleanText(
          customer.address
        ),

      creditLimit:
        this.positiveNumber(
          customer.creditLimit
        ),

      notes:
        this.cleanText(
          customer.notes
        ),

      createdAt:
        now,

      updatedAt:
        now
    };


    customers.unshift(
      newCustomer
    );


    this.saveCustomers(
      customers
    );


    return newCustomer;
  },


  findCustomer(id) {

    return (
      this.getCustomers()
        .find(
          customer =>
            String(
              customer.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  updateCustomer(
    id,
    changes = {}
  ) {

    const customers =
      this.getCustomers();


    const index =
      customers.findIndex(
        customer =>
          String(
            customer.id
          ) ===
          String(id)
      );


    if (index === -1) {
      return false;
    }


    const updatedChanges = {
      ...changes
    };


    if (
      updatedChanges.creditLimit !==
      undefined
    ) {

      updatedChanges.creditLimit =
        this.positiveNumber(
          updatedChanges.creditLimit
        );
    }


    customers[index] = {

      ...customers[index],

      ...updatedChanges,

      updatedAt:
        this.now()
    };


    this.saveCustomers(
      customers
    );


    return customers[index];
  },


  deleteCustomer(id) {

    const customers =
      this
        .getCustomers()
        .filter(
          customer =>
            String(
              customer.id
            ) !==
            String(id)
        );


    this.saveCustomers(
      customers
    );


    return true;
  },


  /* =====================================================
     SUPPLIERS
     ===================================================== */

  getSuppliers() {

    return this.getData(
      this.keys.suppliers
    );
  },


  saveSuppliers(suppliers) {

    return this.saveData(
      this.keys.suppliers,
      suppliers
    );
  },


  addSupplier(supplier = {}) {

    const suppliers =
      this.getSuppliers();

    const now =
      this.now();


    const newSupplier = {

      id:
        supplier.id ||
        this.generateId(
          "SUP"
        ),

      name:
        this.cleanText(
          supplier.name
        ),

      phone:
        this.cleanText(
          supplier.phone
        ),

      email:
        this.cleanText(
          supplier.email
        ),

      company:
        this.cleanText(
          supplier.company
        ),

      address:
        this.cleanText(
          supplier.address
        ),

      taxNumber:
        this.cleanText(
          supplier.taxNumber
        ),

      contactPerson:
        this.cleanText(
          supplier.contactPerson
        ),

      paymentTerms:
        this.cleanText(
          supplier.paymentTerms
        ),

      notes:
        this.cleanText(
          supplier.notes
        ),

      createdAt:
        now,

      updatedAt:
        now
    };


    suppliers.unshift(
      newSupplier
    );


    this.saveSuppliers(
      suppliers
    );


    return newSupplier;
  },


  findSupplier(id) {

    return (
      this.getSuppliers()
        .find(
          supplier =>
            String(
              supplier.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  updateSupplier(
    id,
    changes = {}
  ) {

    const suppliers =
      this.getSuppliers();


    const index =
      suppliers.findIndex(
        supplier =>
          String(
            supplier.id
          ) ===
          String(id)
      );


    if (index === -1) {
      return false;
    }


    suppliers[index] = {

      ...suppliers[index],

      ...changes,

      updatedAt:
        this.now()
    };


    this.saveSuppliers(
      suppliers
    );


    return suppliers[index];
  },


  deleteSupplier(id) {

    const suppliers =
      this
        .getSuppliers()
        .filter(
          supplier =>
            String(
              supplier.id
            ) !==
            String(id)
        );


    this.saveSuppliers(
      suppliers
    );


    return true;
  },


  /* =====================================================
     EMPLOYEES
     ===================================================== */

  getEmployees() {

    return this.getData(
      this.keys.employees
    );
  },


  saveEmployees(employees) {

    return this.saveData(
      this.keys.employees,
      employees
    );
  },


  findEmployee(id) {

    return (
      this.getEmployees()
        .find(
          employee =>
            String(
              employee.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  addEmployee(employee = {}) {

    const employees =
      this.getEmployees();

    const now =
      this.now();


    const newEmployee = {

      id:
        employee.id ||
        this.generateId(
          "EMP"
        ),

      name:
        this.cleanText(
          employee.name
        ),

      phone:
        this.cleanText(
          employee.phone
        ),

      email:
        this.cleanText(
          employee.email
        ),

      job:
        this.cleanText(
          employee.job
        ),

      salary:
        this.positiveNumber(
          employee.salary
        ),

      role:
        this.cleanText(
          employee.role
        ) ||
        "موظف",

      status:
        this.cleanText(
          employee.status
        ) ||
        "نشط",

      hireDate:
        this.cleanText(
          employee.hireDate
        ),

      profilePhoto:
        employee.profilePhoto ||
        "",

      passportFile:
        employee.passportFile ||
        "",

      passportExpiry:
        this.cleanText(
          employee.passportExpiry
        ),

      residenceFile:
        employee.residenceFile ||
        "",

      residenceExpiry:
        this.cleanText(
          employee.residenceExpiry
        ),

      emiratesIdFile:
        employee.emiratesIdFile ||
        "",

      emiratesIdExpiry:
        this.cleanText(
          employee.emiratesIdExpiry
        ),

      workPermitFile:
        employee.workPermitFile ||
        "",

      workPermitExpiry:
        this.cleanText(
          employee.workPermitExpiry
        ),

      notes:
        this.cleanText(
          employee.notes
        ),

      createdAt:
        now,

      updatedAt:
        now
    };


    employees.push(
      newEmployee
    );


    this.saveEmployees(
      employees
    );


    return newEmployee;
  },


  updateEmployee(
    id,
    changes = {}
  ) {

    const employees =
      this.getEmployees();


    const index =
      employees.findIndex(
        employee =>
          String(
            employee.id
          ) ===
          String(id)
      );


    if (index === -1) {
      return false;
    }


    const updatedChanges = {
      ...changes
    };


    if (
      updatedChanges.salary !==
      undefined
    ) {

      updatedChanges.salary =
        this.positiveNumber(
          updatedChanges.salary
        );
    }


    employees[index] = {

      ...employees[index],

      ...updatedChanges,

      updatedAt:
        this.now()
    };


    this.saveEmployees(
      employees
    );


    return employees[index];
  },


  deleteEmployee(id) {

    const employees =
      this
        .getEmployees()
        .filter(
          employee =>
            String(
              employee.id
            ) !==
            String(id)
        );


    this.saveEmployees(
      employees
    );


    return true;
  },


  /* =====================================================
     EMPLOYEE DOCUMENT ALERTS
     ===================================================== */

  getEmployeeDocumentAlerts(employee) {

    const alerts = [];


    const documents = [

      {
        key: "passport",
        name:
          "جواز السفر",
        expiry:
          employee.passportExpiry
      },

      {
        key: "residence",
        name:
          "الإقامة",
        expiry:
          employee.residenceExpiry
      },

      {
        key: "emiratesId",
        name:
          "الهوية الإماراتية",
        expiry:
          employee.emiratesIdExpiry
      },

      {
        key: "workPermit",
        name:
          "بطاقة العمل",
        expiry:
          employee.workPermitExpiry
      }
    ];


    documents.forEach(
      documentItem => {

        if (
          !documentItem.expiry
        ) {
          return;
        }


        const status =
          this.getDocumentStatus(
            documentItem.expiry
          );


        if (
          status.days !== null &&
          status.days <= 60
        ) {

          alerts.push({

            employeeId:
              employee.id,

            employeeName:
              employee.name,

            documentKey:
              documentItem.key,

            documentName:
              documentItem.name,

            expiryDate:
              documentItem.expiry,

            days:
              status.days,

            status:
              status.status,

            level:
              status.level,

            text:
              status.text
          });
        }
      }
    );


    return alerts;
  },


  getAllEmployeeDocumentAlerts() {

    const alerts = [];


    this.getEmployees()
      .forEach(
        employee => {

          alerts.push(
            ...this
              .getEmployeeDocumentAlerts(
                employee
              )
          );
        }
      );


    alerts.sort(
      (
        a,
        b
      ) =>
        this.toNumber(
          a.days,
          999999
        ) -
        this.toNumber(
          b.days,
          999999
        )
    );


    return alerts;
  },


  getEmployeeAlertCount() {

    return this
      .getAllEmployeeDocumentAlerts()
      .length;
  },


  getExpiredEmployeeDocuments() {

    return this
      .getAllEmployeeDocumentAlerts()
      .filter(
        alert =>
          alert.days < 0
      );
  },


  getUrgentEmployeeDocuments() {

    return this
      .getAllEmployeeDocumentAlerts()
      .filter(
        alert =>
          alert.days >= 0 &&
          alert.days <= 7
      );
  },


  /* =====================================================
     REPORTS
     ===================================================== */

  getReports() {

    const products =
      this.getProducts();

    const sales =
      this.getSales();

    const salesSummary =
      this.getSalesSummary();

    const financial =
      this.getFinancialSummary();

    const inventory =
      this.getInventorySummary();

    const customers =
      this.getCustomers();

    const suppliers =
      this.getSuppliers();

    const employees =
      this.getEmployees();

    const employeeAlerts =
      this
        .getAllEmployeeDocumentAlerts();


    const activeEmployees =
      employees.filter(
        employee =>
          employee.status ===
          "نشط"
      ).length;


    const salaries =
      employees.reduce(
        (
          sum,
          employee
        ) =>
          sum +
          this.positiveNumber(
            employee.salary
          ),
        0
      );


    const adminCount =
      employees.filter(
        employee =>
          employee.role ===
          "مدير النظام"
      ).length;


    return {

      products:
        products.length,

      stockQuantity:
        inventory.stockQuantity,

      inventoryValue:
        inventory.inventoryCost,

      inventorySaleValue:
        inventory.inventorySaleValue,

      potentialInventoryProfit:
        inventory.potentialProfit,

      availableProducts:
        inventory.availableProducts,

      lowStock:
        inventory.lowStock,

      outOfStock:
        inventory.outOfStock,

      invoices:
        sales.length,

      salesTotal:
        salesSummary.total,

      salesPaid:
        salesSummary.paid,

      salesDue:
        salesSummary.due,

      salesProfit:
        salesSummary.profit,

      income:
        financial.income,

      expenses:
        financial.expenses,

      balance:
        financial.balance,

      customers:
        customers.length,

      suppliers:
        suppliers.length,

      employees:
        employees.length,

      activeEmployees,

      salaries,

      adminCount,

      employeeDocumentAlerts:
        employeeAlerts.length,

      expiredEmployeeDocuments:
        employeeAlerts.filter(
          alert =>
            alert.days < 0
        ).length,

      urgentEmployeeDocuments:
        employeeAlerts.filter(
          alert =>
            alert.days >= 0 &&
            alert.days <= 7
        ).length
    };
  },


  /* =====================================================
     DASHBOARD
     ===================================================== */

  getDashboard() {

    const reports =
      this.getReports();

    const todaySales =
      this.getTodaySalesSummary();


    return {

      totalSales:
        reports.salesTotal,

      totalPaid:
        reports.salesPaid,

      totalDue:
        reports.salesDue,

      totalProfit:
        reports.salesProfit,

      todaySales:
        todaySales.total,

      todayPaid:
        todaySales.paid,

      todayDue:
        todaySales.due,

      todayProfit:
        todaySales.profit,

      todayInvoices:
        todaySales.invoices,

      todayItemsSold:
        todaySales.items,

      products:
        reports.products,

      stockQuantity:
        reports.stockQuantity,

      availableProducts:
        reports.availableProducts,

      lowStock:
        reports.lowStock,

      outOfStock:
        reports.outOfStock,

      inventoryValue:
        reports.inventoryValue,

      inventorySaleValue:
        reports.inventorySaleValue,

      customers:
        reports.customers,

      suppliers:
        reports.suppliers,

      employees:
        reports.employees,

      activeEmployees:
        reports.activeEmployees,

      invoices:
        reports.invoices,

      income:
        reports.income,

      expenses:
        reports.expenses,

      balance:
        reports.balance,

      employeeDocumentAlerts:
        reports.employeeDocumentAlerts,

      expiredEmployeeDocuments:
        reports.expiredEmployeeDocuments,

      urgentEmployeeDocuments:
        reports.urgentEmployeeDocuments
    };
  }

};


/* =========================================================
   جعل VAREX متاحاً لجميع الصفحات
   ========================================================= */

window.VAREX = VAREX;


/* =========================================================
   INITIALIZE SETTINGS
   ========================================================= */

(function initializeVarex() {

  try {

    const settings =
      VAREX.getSettings();


    VAREX.saveSettings(
      settings
    );


    console.log(
      "VAREX Core loaded successfully."
    );

  } catch (error) {

    console.error(
      "VAREX initialization error:",
      error
    );
  }

})();