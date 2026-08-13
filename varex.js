/* =========================================================
   VAREX CORE
   Shared data layer for VAREX Business Management System
   ========================================================= */

const VAREX = {

  keys: {
    products: "varex_products",
    sales: "varex_sales",
    customers: "varex_customers",
    suppliers: "varex_suppliers",
    employees: "varex_employees",
    transactions: "varexTransactions"
  },

  /* =========================
     GENERAL
     ========================= */

  getData(key) {
    try {
      return (
        JSON.parse(
          localStorage.getItem(key)
        ) || []
      );
    } catch (error) {
      console.error(
        "VAREX data error:",
        error
      );
      return [];
    }
  },

  saveData(key, data) {
    localStorage.setItem(
      key,
      JSON.stringify(data)
    );
  },

  generateId(prefix = "VRX") {
    return (
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.floor(
        Math.random() * 10000
      )
    );
  },

  today() {
    return new Date()
      .toISOString()
      .split("T")[0];
  },

  money(value) {
    return (
      Number(value || 0)
        .toFixed(2) +
      " د.إ"
    );
  },

  /* =========================
     DATE HELPERS
     ========================= */

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
        dateValue + "T00:00:00"
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
        text: "لم يحدد تاريخ الانتهاء",
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
        text: "تنتهي اليوم",
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

  /* =========================
     PRODUCTS
     ========================= */

  getProducts() {
    return this.getData(
      this.keys.products
    );
  },

  saveProducts(products) {
    this.saveData(
      this.keys.products,
      products
    );
  },

  findProduct(id) {
    return this
      .getProducts()
      .find(
        product =>
          String(product.id) ===
          String(id)
      );
  },

  addProduct(product) {

    const products =
      this.getProducts();

    const newProduct = {

      id:
        product.id ||
        this.generateId("PRD"),

      name:
        product.name || "",

      barcode:
        product.barcode || "",

      category:
        product.category || "",

      cost:
        Number(
          product.cost || 0
        ),

      price:
        Number(
          product.price || 0
        ),

      quantity:
        Number(
          product.quantity || 0
        ),

      minimumStock:
        Number(
          product.minimumStock || 0
        ),

      supplier:
        product.supplier || "",

      createdAt:
        new Date()
          .toISOString()
    };

    products.push(
      newProduct
    );

    this.saveProducts(
      products
    );

    return newProduct;
  },

  updateProduct(id, changes) {

    const products =
      this.getProducts();

    const index =
      products.findIndex(
        product =>
          String(product.id) ===
          String(id)
      );

    if (index === -1) {
      return false;
    }

    products[index] = {
      ...products[index],
      ...changes
    };

    this.saveProducts(
      products
    );

    return products[index];
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
          String(product.id) ===
          String(productId)
      );

    if (index === -1) {
      return false;
    }

    const currentQuantity =
      Number(
        products[index]
          .quantity || 0
      );

    const newQuantity =
      currentQuantity +
      Number(amount || 0);

    if (newQuantity < 0) {
      return false;
    }

    products[index].quantity =
      newQuantity;

    this.saveProducts(
      products
    );

    return products[index];
  },

  getLowStockProducts() {

    return this
      .getProducts()
      .filter(product => {

        return (
          Number(
            product.quantity || 0
          ) <=
          Number(
            product.minimumStock || 0
          )
        );

      });
  },

  /* =========================
     SALES
     ========================= */

  getSales() {
    return this.getData(
      this.keys.sales
    );
  },

  saveSales(sales) {
    this.saveData(
      this.keys.sales,
      sales
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

    for (
      const item of items
    ) {

      const productIndex =
        products.findIndex(
          product =>
            String(product.id) ===
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
          Number(
            item.quantity || 1
          )
        );

      if (
        Number(
          product.quantity || 0
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
        Number(
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
          product.barcode || "",

        quantity,

        price,

        cost:
          Number(
            product.cost || 0
          ),

        total:
          price *
          quantity
      });
    }

    /* خصم الكميات من المخزون */

    normalizedItems
      .forEach(item => {

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
          Number(
            products[
              productIndex
            ].quantity || 0
          ) -
          item.quantity;

      });

    this.saveProducts(
      products
    );

    const subtotal =
      normalizedItems.reduce(
        (sum, item) =>
          sum +
          item.total,
        0
      );

    const discount =
      Math.max(
        0,
        Number(
          options.discount || 0
        )
      );

    const tax =
      Math.max(
        0,
        Number(
          options.tax || 0
        )
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
          item.cost *
          item.quantity,
        0
      );

    const sale = {

      id:
        this.generateId(
          "INV"
        ),

      invoiceNumber:
        "INV-" +
        Date.now(),

      date:
        new Date()
          .toISOString(),

      customerId:
        options.customerId ||
        "",

      customerName:
        options.customerName ||
        "",

      paymentMethod:
        options.paymentMethod ||
        "نقدي",

      items:
        normalizedItems,

      subtotal,

      discount,

      tax,

      total,

      costTotal,

      profit:
        total -
        costTotal
    };

    const sales =
      this.getSales();

    sales.unshift(
      sale
    );

    this.saveSales(
      sales
    );

    /* تسجيل الإيراد تلقائياً */

    this.addTransaction({

      type:
        "income",

      description:
        "مبيعات فاتورة " +
        sale.invoiceNumber,

      category:
        "المبيعات",

      amount:
        total,

      date:
        this.today(),

      payment:
        sale.paymentMethod,

      referenceId:
        sale.id
    });

    return {
      success: true,
      sale
    };
  },

  /* =========================
     ACCOUNTS
     ========================= */

  getTransactions() {

    return this.getData(
      this.keys.transactions
    );
  },

  saveTransactions(
    transactions
  ) {

    this.saveData(
      this.keys.transactions,
      transactions
    );
  },

  addTransaction(
    transaction
  ) {

    const transactions =
      this.getTransactions();

    const newTransaction = {

      id:
        transaction.id ||
        Date.now() +
        Math.floor(
          Math.random() *
          1000
        ),

      type:
        transaction.type ||
        "expense",

      description:
        transaction.description ||
        "",

      category:
        transaction.category ||
        "",

      amount:
        Number(
          transaction.amount || 0
        ),

      date:
        transaction.date ||
        this.today(),

      payment:
        transaction.payment ||
        "",

      referenceId:
        transaction.referenceId ||
        "",

      createdAt:
        new Date()
          .toISOString()
    };

    transactions.unshift(
      newTransaction
    );

    this.saveTransactions(
      transactions
    );

    return newTransaction;
  },

  deleteTransaction(id) {

    const transactions =
      this
        .getTransactions()
        .filter(
          item =>
            String(item.id) !==
            String(id)
        );

    this.saveTransactions(
      transactions
    );
  },

  getFinancialSummary() {

    const transactions =
      this.getTransactions();

    let income = 0;
    let expenses = 0;

    transactions.forEach(
      item => {

        if (
          item.type ===
          "income"
        ) {

          income +=
            Number(
              item.amount || 0
            );

        }

        if (
          item.type ===
          "expense"
        ) {

          expenses +=
            Number(
              item.amount || 0
            );

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

  /* =========================
     CUSTOMERS
     ========================= */

  getCustomers() {

    return this.getData(
      this.keys.customers
    );
  },

  addCustomer(customer) {

    const customers =
      this.getCustomers();

    const newCustomer = {

      id:
        customer.id ||
        this.generateId(
          "CUS"
        ),

      name:
        customer.name || "",

      phone:
        customer.phone || "",

      email:
        customer.email || "",

      address:
        customer.address || "",

      notes:
        customer.notes || "",

      createdAt:
        new Date()
          .toISOString()
    };

    customers.unshift(
      newCustomer
    );

    this.saveData(
      this.keys.customers,
      customers
    );

    return newCustomer;
  },

  /* =========================
     SUPPLIERS
     ========================= */

  getSuppliers() {

    return this.getData(
      this.keys.suppliers
    );
  },

  addSupplier(supplier) {

    const suppliers =
      this.getSuppliers();

    const newSupplier = {

      id:
        supplier.id ||
        this.generateId(
          "SUP"
        ),

      name:
        supplier.name || "",

      phone:
        supplier.phone || "",

      email:
        supplier.email || "",

      company:
        supplier.company || "",

      address:
        supplier.address || "",

      notes:
        supplier.notes || "",

      createdAt:
        new Date()
          .toISOString()
    };

    suppliers.unshift(
      newSupplier
    );

    this.saveData(
      this.keys.suppliers,
      suppliers
    );

    return newSupplier;
  },

  /* =========================
     EMPLOYEES
     ========================= */

  getEmployees() {

    return this.getData(
      this.keys.employees
    );
  },

  saveEmployees(
    employees
  ) {

    this.saveData(
      this.keys.employees,
      employees
    );
  },

  findEmployee(id) {

    return this
      .getEmployees()
      .find(
        employee =>
          String(employee.id) ===
          String(id)
      );
  },

  addEmployee(employee) {

    const employees =
      this.getEmployees();

    const newEmployee = {

      id:
        employee.id ||
        this.generateId(
          "EMP"
        ),

      name:
        employee.name || "",

      phone:
        employee.phone || "",

      email:
        employee.email || "",

      job:
        employee.job || "",

      salary:
        Number(
          employee.salary || 0
        ),

      role:
        employee.role ||
        "موظف",

      status:
        employee.status ||
        "نشط",

      hireDate:
        employee.hireDate ||
        "",

      /* =====================
         EMPLOYEE DOCUMENTS
         ===================== */

      profilePhoto:
        employee.profilePhoto ||
        "",

      passportFile:
        employee.passportFile ||
        "",

      passportExpiry:
        employee.passportExpiry ||
        "",

      residenceFile:
        employee.residenceFile ||
        "",

      residenceExpiry:
        employee.residenceExpiry ||
        "",

      emiratesIdFile:
        employee.emiratesIdFile ||
        "",

      emiratesIdExpiry:
        employee.emiratesIdExpiry ||
        "",

      workPermitFile:
        employee.workPermitFile ||
        "",

      workPermitExpiry:
        employee.workPermitExpiry ||
        "",

      createdAt:
        new Date()
          .toISOString()
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
    changes
  ) {

    const employees =
      this.getEmployees();

    const index =
      employees.findIndex(
        employee =>
          String(employee.id) ===
          String(id)
      );

    if (
      index === -1
    ) {
      return false;
    }

    employees[index] = {
      ...employees[index],
      ...changes
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

  /* =========================
     EMPLOYEE DOCUMENT ALERTS
     ========================= */

  getEmployeeDocumentAlerts(
    employee
  ) {

    const alerts = [];

    const documents = [

      {
        key:
          "passport",
        name:
          "جواز السفر",
        expiry:
          employee.passportExpiry
      },

      {
        key:
          "residence",
        name:
          "الإقامة",
        expiry:
          employee.residenceExpiry
      },

      {
        key:
          "emiratesId",
        name:
          "الهوية الإماراتية",
        expiry:
          employee.emiratesIdExpiry
      },

      {
        key:
          "workPermit",
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

        /*
           لا نضيف الوثيقة إلى
           التنبيهات إلا إذا بقي
           60 يوماً أو أقل
           أو كانت منتهية.
        */

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

    const employees =
      this.getEmployees();

    const alerts = [];

    employees.forEach(
      employee => {

        const employeeAlerts =
          this
            .getEmployeeDocumentAlerts(
              employee
            );

        alerts.push(
          ...employeeAlerts
        );

      }
    );

    /*
       ترتيب التنبيهات:
       المنتهي والأقرب أولاً
    */

    alerts.sort(
      (a, b) =>
        Number(a.days) -
        Number(b.days)
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

  /* =========================
     REPORTS
     ========================= */

  getReports() {

    const products =
      this.getProducts();

    const sales =
      this.getSales();

    const financial =
      this.getFinancialSummary();

    const customers =
      this.getCustomers();

    const suppliers =
      this.getSuppliers();

    const employees =
      this.getEmployees();

    const employeeAlerts =
      this
        .getAllEmployeeDocumentAlerts();

    const inventoryValue =
      products.reduce(
        (sum, product) =>
          sum +
          Number(
            product.cost || 0
          ) *
          Number(
            product.quantity || 0
          ),
        0
      );

    const salesTotal =
      sales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.total || 0
          ),
        0
      );

    const profit =
      sales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.profit || 0
          ),
        0
      );

    const activeEmployees =
      employees.filter(
        employee =>
          employee.status ===
          "نشط"
      ).length;

    const salaries =
      employees.reduce(
        (sum, employee) =>
          sum +
          Number(
            employee.salary || 0
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
        products.reduce(
          (sum, product) =>
            sum +
            Number(
              product.quantity || 0
            ),
          0
        ),

      inventoryValue,

      lowStock:
        this
          .getLowStockProducts()
          .length,

      invoices:
        sales.length,

      salesTotal,

      salesProfit:
        profit,

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

  /* =========================
     DASHBOARD
     ========================= */

  getDashboard() {

    const reports =
      this.getReports();

    return {

      totalSales:
        reports.salesTotal,

      totalProfit:
        reports.salesProfit,

      products:
        reports.products,

      stockQuantity:
        reports.stockQuantity,

      lowStock:
        reports.lowStock,

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
        reports
          .employeeDocumentAlerts,

      expiredEmployeeDocuments:
        reports
          .expiredEmployeeDocuments,

      urgentEmployeeDocuments:
        reports
          .urgentEmployeeDocuments
    };
  }
};

/* جعل VAREX متاحاً لجميع الصفحات */

window.VAREX = VAREX;

console.log(
  "VAREX Core loaded successfully."
);