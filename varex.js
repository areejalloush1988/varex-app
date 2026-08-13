/* =========================================================
   VAREX CORE
   Shared Data Layer
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

  /* =====================================================
     GENERAL
     ===================================================== */

  getData(key) {
    try {
      const data = JSON.parse(
        localStorage.getItem(key)
      );

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

    localStorage.setItem(
      key,
      JSON.stringify(data)
    );

    return true;
  },

  generateId(prefix = "VRX") {

    return (
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.floor(
        Math.random() * 100000
      )
    );
  },

  today() {

    const date = new Date();

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
  },

  money(value) {

    return (
      Number(value || 0)
        .toFixed(2) +
      " د.إ"
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
        .slice(0, 10);
    }

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return (
      year +
      "-" +
      month +
      "-" +
      day
    );
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
        dateValue +
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

    return this
      .getProducts()
      .find(
        product =>
          String(product.id) ===
          String(id)
      );
  },

  findProductByBarcode(barcode) {

    const value =
      String(
        barcode || ""
      ).trim();

    if (!value) {
      return null;
    }

    return this
      .getProducts()
      .find(
        product =>
          String(
            product.barcode || ""
          ).trim() === value
      ) || null;
  },

  barcodeExists(
    barcode,
    excludeId = null
  ) {

    const value =
      String(
        barcode || ""
      ).trim();

    if (!value) {
      return false;
    }

    return this
      .getProducts()
      .some(product => {

        const sameBarcode =
          String(
            product.barcode || ""
          ).trim() === value;

        const differentProduct =
          excludeId === null ||
          String(product.id) !==
          String(excludeId);

        return (
          sameBarcode &&
          differentProduct
        );
      });
  },

  addProduct(product) {

    const name =
      String(
        product.name || ""
      ).trim();

    const barcode =
      String(
        product.barcode || ""
      ).trim();

    if (!name) {

      return {
        success: false,
        message:
          "اسم المنتج مطلوب."
      };
    }

    if (
      barcode &&
      this.barcodeExists(barcode)
    ) {

      return {
        success: false,
        message:
          "هذا الباركود مستخدم لمنتج آخر."
      };
    }

    const products =
      this.getProducts();

    const newProduct = {

      id:
        product.id ||
        this.generateId(
          "PRD"
        ),

      name,

      barcode,

      category:
        String(
          product.category ||
          "عام"
        ).trim() ||
        "عام",

      cost:
        Math.max(
          0,
          Number(
            product.cost || 0
          )
        ),

      price:
        Math.max(
          0,
          Number(
            product.price || 0
          )
        ),

      quantity:
        Math.max(
          0,
          Number(
            product.quantity || 0
          )
        ),

      minimumStock:
        Math.max(
          0,
          Number(
            product.minimumStock || 0
          )
        ),

      supplier:
        String(
          product.supplier || ""
        ).trim(),

      createdAt:
        new Date()
          .toISOString(),

      updatedAt:
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

  updateProduct(
    id,
    changes
  ) {

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

    if (
      changes.barcode !==
      undefined
    ) {

      const barcode =
        String(
          changes.barcode || ""
        ).trim();

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

      changes.barcode =
        barcode;
    }

    if (
      changes.name !==
      undefined
    ) {

      changes.name =
        String(
          changes.name || ""
        ).trim();
    }

    if (
      changes.category !==
      undefined
    ) {

      changes.category =
        String(
          changes.category ||
          "عام"
        ).trim() ||
        "عام";
    }

    if (
      changes.price !==
      undefined
    ) {

      changes.price =
        Math.max(
          0,
          Number(
            changes.price || 0
          )
        );
    }

    if (
      changes.cost !==
      undefined
    ) {

      changes.cost =
        Math.max(
          0,
          Number(
            changes.cost || 0
          )
        );
    }

    if (
      changes.quantity !==
      undefined
    ) {

      changes.quantity =
        Math.max(
          0,
          Number(
            changes.quantity || 0
          )
        );
    }

    if (
      changes.minimumStock !==
      undefined
    ) {

      changes.minimumStock =
        Math.max(
          0,
          Number(
            changes.minimumStock || 0
          )
        );
    }

    products[index] = {

      ...products[index],
      ...changes,

      updatedAt:
        new Date()
          .toISOString()
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
          String(product.id) ===
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
          String(product.id) !==
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

    products[index].updatedAt =
      new Date()
        .toISOString();

    this.saveProducts(
      products
    );

    return products[index];
  },

  getProductStockStatus(
    product
  ) {

    const quantity =
      Number(
        product.quantity || 0
      );

    const minimum =
      Number(
        product.minimumStock || 0
      );

    if (quantity <= 0) {

      return {
        key: "out",
        text:
          "نفد المخزون"
      };
    }

    if (
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
      .filter(product => {

        const status =
          this.getProductStockStatus(
            product
          );

        return (
          status.key ===
          "available"
        );
      });
  },

  getLowStockProducts() {

    return this
      .getProducts()
      .filter(product => {

        const status =
          this.getProductStockStatus(
            product
          );

        return (
          status.key ===
          "low"
        );
      });
  },

  getOutOfStockProducts() {

    return this
      .getProducts()
      .filter(product => {

        const status =
          this.getProductStockStatus(
            product
          );

        return (
          status.key ===
          "out"
        );
      });
  },

  getProductTodaySales(
    productId
  ) {

    const sales =
      this.getSales();

    const today =
      this.today();

    let quantity = 0;

    sales.forEach(sale => {

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

      items.forEach(item => {

        if (
          String(
            item.productId
          ) ===
          String(
            productId
          )
        ) {

          quantity +=
            Number(
              item.quantity || 0
            );
        }
      });
    });

    return quantity;
  },

  getProductTotalSales(
    productId
  ) {

    let quantity = 0;

    this.getSales()
      .forEach(sale => {

        const items =
          Array.isArray(
            sale.items
          )
            ? sale.items
            : [];

        items.forEach(item => {

          if (
            String(
              item.productId
            ) ===
            String(
              productId
            )
          ) {

            quantity +=
              Number(
                item.quantity || 0
              );
          }
        });
      });

    return quantity;
  },

  getInventorySummary() {

    const products =
      this.getProducts();

    let stockQuantity = 0;
    let inventoryCost = 0;
    let inventorySaleValue = 0;

    products.forEach(product => {

      const quantity =
        Number(
          product.quantity || 0
        );

      const cost =
        Number(
          product.cost || 0
        );

      const price =
        Number(
          product.price || 0
        );

      stockQuantity +=
        quantity;

      inventoryCost +=
        quantity * cost;

      inventorySaleValue +=
        quantity * price;
    });

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

        products[
          productIndex
        ].updatedAt =
          new Date()
            .toISOString();
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
          (
            item.cost *
            item.quantity
          ),
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

      createdAt:
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
          ) === today
      );
  },

  getTodaySalesSummary() {

    const sales =
      this.getTodaySales();

    const total =
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

    const items =
      sales.reduce(
        (sum, sale) => {

          const saleItems =
            Array.isArray(
              sale.items
            )
              ? sale.items
              : [];

          return (
            sum +
            saleItems.reduce(
              (itemSum, item) =>
                itemSum +
                Number(
                  item.quantity || 0
                ),
              0
            )
          );
        },
        0
      );

    return {
      invoices:
        sales.length,
      total,
      profit,
      items
    };
  },

  /* =====================================================
     ACCOUNTS
     ===================================================== */

  getTransactions() {

    return this.getData(
      this.keys.transactions
    );
  },

  saveTransactions(
    transactions
  ) {

    return this.saveData(
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
        this.generateId(
          "TRX"
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
        Math.max(
          0,
          Number(
            transaction.amount || 0
          )
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

    return true;
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

    this.saveCustomers(
      customers
    );

    return newCustomer;
  },

  findCustomer(id) {

    return this
      .getCustomers()
      .find(
        customer =>
          String(customer.id) ===
          String(id)
      );
  },

  updateCustomer(
    id,
    changes
  ) {

    const customers =
      this.getCustomers();

    const index =
      customers.findIndex(
        customer =>
          String(customer.id) ===
          String(id)
      );

    if (index === -1) {
      return false;
    }

    customers[index] = {
      ...customers[index],
      ...changes
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
            String(customer.id) !==
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

    this.saveSuppliers(
      suppliers
    );

    return newSupplier;
  },

  findSupplier(id) {

    return this
      .getSuppliers()
      .find(
        supplier =>
          String(supplier.id) ===
          String(id)
      );
  },

  updateSupplier(
    id,
    changes
  ) {

    const suppliers =
      this.getSuppliers();

    const index =
      suppliers.findIndex(
        supplier =>
          String(supplier.id) ===
          String(id)
      );

    if (index === -1) {
      return false;
    }

    suppliers[index] = {
      ...suppliers[index],
      ...changes
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
            String(supplier.id) !==
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

  saveEmployees(
    employees
  ) {

    return this.saveData(
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

    if (index === -1) {
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
            String(employee.id) !==
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

  getEmployeeDocumentAlerts(
    employee
  ) {

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

    const employees =
      this.getEmployees();

    const alerts = [];

    employees.forEach(
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

  /* =====================================================
     REPORTS
     ===================================================== */

  getReports() {

    const products =
      this.getProducts();

    const sales =
      this.getSales();

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

      totalProfit:
        reports.salesProfit,

      todaySales:
        todaySales.total,

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

console.log(
  "VAREX Core loaded successfully."
);