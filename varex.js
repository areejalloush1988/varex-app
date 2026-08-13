/* =========================================================
   VAREX CORE
   Shared Data Layer
   AUTH + POS + INVENTORY COMPATIBLE VERSION
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
    heldSales: "varex_held_sales",

    users: "varex_users",
    session: "varex_session",
    rememberedUser: "varex_remembered_user"
  },


  /* =====================================================
     GENERAL HELPERS
     ===================================================== */

  getData(key) {
    try {

      const raw =
        localStorage.getItem(key);

      if (!raw) {
        return [];
      }

      const data =
        JSON.parse(raw);

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
        JSON.stringify(
          Array.isArray(data)
            ? data
            : []
        )
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
        JSON.stringify(
          data || {}
        )
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
     AUTHENTICATION / USERS
     ===================================================== */

  getUsers() {

    return this.getData(
      this.keys.users
    );
  },


  saveUsers(users) {

    return this.saveData(
      this.keys.users,
      users
    );
  },


  normalizeEmail(email) {

    return this.cleanText(
      email
    ).toLowerCase();
  },


  normalizeUsername(username) {

    return this.cleanText(
      username
    ).toLowerCase();
  },


  findUserById(id) {

    return (
      this.getUsers()
        .find(
          user =>
            String(
              user.id
            ) ===
            String(id)
        ) ||
      null
    );
  },


  findUserByEmail(email) {

    const value =
      this.normalizeEmail(
        email
      );

    if (!value) {
      return null;
    }

    return (
      this.getUsers()
        .find(
          user =>
            this.normalizeEmail(
              user.email
            ) === value
        ) ||
      null
    );
  },


  findUserByUsername(username) {

    const value =
      this.normalizeUsername(
        username
      );

    if (!value) {
      return null;
    }

    return (
      this.getUsers()
        .find(
          user =>
            this.normalizeUsername(
              user.username
            ) === value
        ) ||
      null
    );
  },


  findUserByLogin(login) {

    const value =
      this.cleanText(
        login
      );

    if (!value) {
      return null;
    }

    return (
      this.findUserByEmail(
        value
      ) ||
      this.findUserByUsername(
        value
      )
    );
  },


  emailExists(
    email,
    excludeId = null
  ) {

    const value =
      this.normalizeEmail(
        email
      );

    if (!value) {
      return false;
    }

    return this
      .getUsers()
      .some(
        user => {

          const same =
            this.normalizeEmail(
              user.email
            ) === value;

          const different =
            excludeId === null ||
            String(
              user.id
            ) !==
            String(
              excludeId
            );

          return (
            same &&
            different
          );
        }
      );
  },


  usernameExists(
    username,
    excludeId = null
  ) {

    const value =
      this.normalizeUsername(
        username
      );

    if (!value) {
      return false;
    }

    return this
      .getUsers()
      .some(
        user => {

          const same =
            this.normalizeUsername(
              user.username
            ) === value;

          const different =
            excludeId === null ||
            String(
              user.id
            ) !==
            String(
              excludeId
            );

          return (
            same &&
            different
          );
        }
      );
  },


  createUser(user = {}) {

    const name =
      this.cleanText(
        user.name
      );

    const username =
      this.normalizeUsername(
        user.username
      );

    const email =
      this.normalizeEmail(
        user.email
      );

    const password =
      String(
        user.password || ""
      );


    if (!name) {

      return {
        success: false,
        message:
          "الاسم الكامل مطلوب."
      };
    }


    if (!username) {

      return {
        success: false,
        message:
          "اسم المستخدم مطلوب."
      };
    }


    if (username.length < 3) {

      return {
        success: false,
        message:
          "اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل."
      };
    }


    if (!email) {

      return {
        success: false,
        message:
          "البريد الإلكتروني مطلوب."
      };
    }


    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
      !emailPattern.test(
        email
      )
    ) {

      return {
        success: false,
        message:
          "يرجى إدخال بريد إلكتروني صحيح."
      };
    }


    if (password.length < 6) {

      return {
        success: false,
        message:
          "كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل."
      };
    }


    if (
      this.usernameExists(
        username
      )
    ) {

      return {
        success: false,
        message:
          "اسم المستخدم مستخدم بالفعل."
      };
    }


    if (
      this.emailExists(
        email
      )
    ) {

      return {
        success: false,
        message:
          "البريد الإلكتروني مستخدم بالفعل."
      };
    }


    const users =
      this.getUsers();

    const time =
      this.now();


    const newUser = {

      id:
        this.generateId(
          "USR"
        ),

      name,

      username,

      email,

      password,

      role:
        this.cleanText(
          user.role
        ) ||
        (
          users.length === 0
            ? "مدير النظام"
            : "مستخدم"
        ),

      status:
        "نشط",

      createdAt:
        time,

      updatedAt:
        time,

      lastLogin:
        ""
    };


    users.push(
      newUser
    );


    if (
      !this.saveUsers(
        users
      )
    ) {

      return {
        success: false,
        message:
          "تعذر إنشاء الحساب."
      };
    }


    return {

      success: true,

      user:
        this.getSafeUser(
          newUser
        )
    };
  },


  getSafeUser(user) {

    if (!user) {
      return null;
    }

    return {

      id:
        user.id,

      name:
        user.name,

      username:
        user.username,

      email:
        user.email,

      role:
        user.role,

      status:
        user.status,

      createdAt:
        user.createdAt,

      lastLogin:
        user.lastLogin
    };
  },


  login(
    login,
    password,
    remember = false
  ) {

    const identifier =
      this.cleanText(
        login
      );

    const passwordValue =
      String(
        password || ""
      );


    if (
      !identifier ||
      !passwordValue
    ) {

      return {
        success: false,
        message:
          "يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور."
      };
    }


    const user =
      this.findUserByLogin(
        identifier
      );


    if (!user) {

      return {
        success: false,
        message:
          "اسم المستخدم أو البريد الإلكتروني غير صحيح."
      };
    }


    if (
      user.status ===
      "موقوف"
    ) {

      return {
        success: false,
        message:
          "هذا الحساب موقوف."
      };
    }


    if (
      String(
        user.password
      ) !==
      passwordValue
    ) {

      return {
        success: false,
        message:
          "كلمة المرور غير صحيحة."
      };
    }


    const users =
      this.getUsers();

    const index =
      users.findIndex(
        item =>
          String(
            item.id
          ) ===
          String(
            user.id
          )
      );


    const loginTime =
      this.now();


    if (index !== -1) {

      users[index].lastLogin =
        loginTime;

      users[index].updatedAt =
        loginTime;

      this.saveUsers(
        users
      );
    }


    const session = {

      userId:
        user.id,

      loginAt:
        loginTime,

      remember:
        Boolean(
          remember
        )
    };


    if (remember) {

      localStorage.setItem(
        this.keys.session,
        JSON.stringify(
          session
        )
      );

      sessionStorage.removeItem(
        this.keys.session
      );

      localStorage.setItem(
        this.keys.rememberedUser,
        identifier
      );

    } else {

      sessionStorage.setItem(
        this.keys.session,
        JSON.stringify(
          session
        )
      );

      localStorage.removeItem(
        this.keys.session
      );

      localStorage.removeItem(
        this.keys.rememberedUser
      );
    }


    /*
       Compatibility flags for older VAREX pages.
    */

    if (remember) {

      localStorage.setItem(
        "varex_authenticated",
        "true"
      );

      sessionStorage.removeItem(
        "varex_authenticated"
      );

    } else {

      sessionStorage.setItem(
        "varex_authenticated",
        "true"
      );

      localStorage.removeItem(
        "varex_authenticated"
      );
    }


    return {

      success: true,

      user:
        this.getSafeUser(
          user
        )
    };
  },


  getSession() {

    let raw =
      sessionStorage.getItem(
        this.keys.session
      );


    if (!raw) {

      raw =
        localStorage.getItem(
          this.keys.session
        );
    }


    if (!raw) {
      return null;
    }


    try {

      const session =
        JSON.parse(
          raw
        );


      if (
        !session ||
        !session.userId
      ) {

        return null;
      }


      const user =
        this.findUserById(
          session.userId
        );


      if (
        !user ||
        user.status ===
        "موقوف"
      ) {

        this.logout(
          false
        );

        return null;
      }


      return session;

    } catch (error) {

      console.error(
        "VAREX session error:",
        error
      );

      return null;
    }
  },


  isLoggedIn() {

    return Boolean(
      this.getSession()
    );
  },


  getCurrentUser() {

    const session =
      this.getSession();


    if (!session) {
      return null;
    }


    return this.getSafeUser(
      this.findUserById(
        session.userId
      )
    );
  },


  getRememberedUser() {

    return (
      localStorage.getItem(
        this.keys.rememberedUser
      ) ||
      ""
    );
  },


  logout(redirect = true) {

    sessionStorage.removeItem(
      this.keys.session
    );

    localStorage.removeItem(
      this.keys.session
    );

    sessionStorage.removeItem(
      "varex_authenticated"
    );

    localStorage.removeItem(
      "varex_authenticated"
    );


    if (redirect) {

      window.location.replace(
        "./login.html"
      );
    }


    return true;
  },


  requireLogin() {

    if (
      this.isLoginPage() ||
      this.isRegisterPage()
    ) {

      return true;
    }


    if (
      !this.isLoggedIn()
    ) {

      window.location.replace(
        "./login.html"
      );

      return false;
    }


    return true;
  },


  isLoginPage() {

    const path =
      window.location.pathname
        .toLowerCase();


    return path.endsWith(
      "login.html"
    );
  },


  isRegisterPage() {

    const path =
      window.location.pathname
        .toLowerCase();


    return path.endsWith(
      "register.html"
    );
  },


  redirectLoggedUser() {

    if (
      this.isLoginPage() &&
      this.isLoggedIn()
    ) {

      window.location.replace(
        "./index.html"
      );

      return true;
    }


    return false;
  },


  updateCurrentUser(
    changes = {}
  ) {

    const current =
      this.getCurrentUser();


    if (!current) {

      return {
        success: false,
        message:
          "لا يوجد مستخدم مسجل الدخول."
      };
    }


    const users =
      this.getUsers();


    const index =
      users.findIndex(
        user =>
          String(
            user.id
          ) ===
          String(
            current.id
          )
      );


    if (index === -1) {

      return {
        success: false,
        message:
          "المستخدم غير موجود."
      };
    }


    const updated =
      {
        ...changes
      };


    if (
      updated.email !==
      undefined
    ) {

      const email =
        this.normalizeEmail(
          updated.email
        );


      if (!email) {

        return {
          success: false,
          message:
            "البريد الإلكتروني مطلوب."
        };
      }


      if (
        this.emailExists(
          email,
          current.id
        )
      ) {

        return {
          success: false,
          message:
            "البريد الإلكتروني مستخدم بالفعل."
        };
      }


      updated.email =
        email;
    }


    if (
      updated.username !==
      undefined
    ) {

      const username =
        this.normalizeUsername(
          updated.username
        );


      if (!username) {

        return {
          success: false,
          message:
            "اسم المستخدم مطلوب."
        };
      }


      if (
        this.usernameExists(
          username,
          current.id
        )
      ) {

        return {
          success: false,
          message:
            "اسم المستخدم مستخدم بالفعل."
        };
      }


      updated.username =
        username;
    }


    delete updated.id;
    delete updated.password;


    users[index] = {

      ...users[index],

      ...updated,

      id:
        users[index].id,

      updatedAt:
        this.now()
    };


    this.saveUsers(
      users
    );


    return {

      success: true,

      user:
        this.getSafeUser(
          users[index]
        )
    };
  },


  changePassword(
    currentPassword,
    newPassword
  ) {

    const current =
      this.getCurrentUser();


    if (!current) {

      return {
        success: false,
        message:
          "يجب تسجيل الدخول أولاً."
      };
    }


    const users =
      this.getUsers();


    const index =
      users.findIndex(
        user =>
          String(
            user.id
          ) ===
          String(
            current.id
          )
      );


    if (index === -1) {

      return {
        success: false,
        message:
          "المستخدم غير موجود."
      };
    }


    if (
      String(
        users[index].password
      ) !==
      String(
        currentPassword
      )
    ) {

      return {
        success: false,
        message:
          "كلمة المرور الحالية غير صحيحة."
      };
    }


    if (
      String(
        newPassword || ""
      ).length < 6
    ) {

      return {
        success: false,
        message:
          "كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل."
      };
    }


    users[index].password =
      String(
        newPassword
      );

    users[index].updatedAt =
      this.now();


    this.saveUsers(
      users
    );


    return {
      success: true,
      message:
        "تم تغيير كلمة المرور بنجاح."
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


  getProductById(id) {

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


  addProduct(product = {}) {

    const products =
      this.getProducts();

    const item = {

      ...product,

      id:
        product.id ||
        this.generateId(
          "PRD"
        ),

      name:
        this.cleanText(
          product.name ||
          product.productName
        ),

      quantity:
        this.positiveNumber(
          product.quantity
        ),

      price:
        this.positiveNumber(
          product.price ||
          product.salePrice
        ),

      cost:
        this.positiveNumber(
          product.cost ||
          product.costPrice
        ),

      createdAt:
        product.createdAt ||
        this.now(),

      updatedAt:
        this.now()
    };


    products.push(
      item
    );


    this.saveProducts(
      products
    );


    return item;
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
      return false;
    }


    products[index] = {

      ...products[index],

      ...changes,

      id:
        products[index].id,

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

    const filtered =
      products.filter(
        product =>
          String(
            product.id
          ) !==
          String(id)
      );


    this.saveProducts(
      filtered
    );


    return (
      filtered.length !==
      products.length
    );
  },


  adjustStock(
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


    const current =
      this.toNumber(
        products[index].quantity,
        0
      );


    products[index].quantity =
      Math.max(
        0,
        current +
        this.toNumber(
          amount,
          0
        )
      );


    products[index].updatedAt =
      this.now();


    this.saveProducts(
      products
    );


    return products[index];
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


  getSaleById(id) {

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


  addSale(sale = {}) {

    const sales =
      this.getSales();


    const newSale = {

      ...sale,

      id:
        sale.id ||
        this.generateId(
          "SAL"
        ),

      invoiceNumber:
        sale.invoiceNumber ||
        (
          "INV-" +
          Date.now()
        ),

      createdAt:
        sale.createdAt ||
        this.now(),

      date:
        sale.date ||
        this.now(),

      updatedAt:
        this.now()
    };


    sales.push(
      newSale
    );


    this.saveSales(
      sales
    );


    return newSale;
  },


  deleteSale(id) {

    const sales =
      this.getSales();

    const filtered =
      sales.filter(
        sale =>
          String(
            sale.id
          ) !==
          String(id)
      );


    this.saveSales(
      filtered
    );


    return (
      filtered.length !==
      sales.length
    );
  },


  /* =====================================================
     POS SALE
     ===================================================== */

  completeSale(sale = {}) {

    const items =
      Array.isArray(
        sale.items
      )
        ? sale.items
        : [];


    if (
      items.length === 0
    ) {

      return {
        success: false,
        message:
          "لا توجد منتجات في الفاتورة."
      };
    }


    const products =
      this.getProducts();


    for (
      const item of items
    ) {

      const productId =
        item.productId ||
        item.id;


      const quantity =
        this.positiveNumber(
          item.quantity ||
          item.qty ||
          1
        );


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

        continue;
      }


      const available =
        this.toNumber(
          products[index].quantity,
          0
        );


      if (
        quantity >
        available
      ) {

        return {
          success: false,
          message:
            "الكمية غير متوفرة للمنتج: " +
            (
              products[index].name ||
              ""
            )
        };
      }
    }


    for (
      const item of items
    ) {

      const productId =
        item.productId ||
        item.id;


      const quantity =
        this.positiveNumber(
          item.quantity ||
          item.qty ||
          1
        );


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
        continue;
      }


      products[index].quantity =
        Math.max(
          0,
          this.toNumber(
            products[index].quantity,
            0
          ) -
          quantity
        );


      products[index].updatedAt =
        this.now();
    }


    this.saveProducts(
      products
    );


    const savedSale =
      this.addSale(
        sale
      );


    return {

      success: true,

      sale:
        savedSale
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


    const item = {

      ...customer,

      id:
        customer.id ||
        this.generateId(
          "CUS"
        ),

      createdAt:
        customer.createdAt ||
        this.now(),

      updatedAt:
        this.now()
    };


    customers.push(
      item
    );


    this.saveCustomers(
      customers
    );


    return item;
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


    customers[index] = {

      ...customers[index],

      ...changes,

      id:
        customers[index].id,

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
      this.getCustomers();

    const filtered =
      customers.filter(
        customer =>
          String(
            customer.id
          ) !==
          String(id)
      );


    this.saveCustomers(
      filtered
    );


    return (
      filtered.length !==
      customers.length
    );
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


    const item = {

      ...supplier,

      id:
        supplier.id ||
        this.generateId(
          "SUP"
        ),

      createdAt:
        supplier.createdAt ||
        this.now(),

      updatedAt:
        this.now()
    };


    suppliers.push(
      item
    );


    this.saveSuppliers(
      suppliers
    );


    return item;
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

      id:
        suppliers[index].id,

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
      this.getSuppliers();

    const filtered =
      suppliers.filter(
        supplier =>
          String(
            supplier.id
          ) !==
          String(id)
      );


    this.saveSuppliers(
      filtered
    );


    return (
      filtered.length !==
      suppliers.length
    );
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


  addEmployee(employee = {}) {

    const employees =
      this.getEmployees();


    const item = {

      ...employee,

      id:
        employee.id ||
        this.generateId(
          "EMP"
        ),

      createdAt:
        employee.createdAt ||
        this.now(),

      updatedAt:
        this.now()
    };


    employees.push(
      item
    );


    this.saveEmployees(
      employees
    );


    return item;
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


    employees[index] = {

      ...employees[index],

      ...changes,

      id:
        employees[index].id,

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
      this.getEmployees();

    const filtered =
      employees.filter(
        employee =>
          String(
            employee.id
          ) !==
          String(id)
      );


    this.saveEmployees(
      filtered
    );


    return (
      filtered.length !==
      employees.length
    );
  },


  /* =====================================================
     TRANSACTIONS / ACCOUNTS
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


  addTransaction(
    transaction = {}
  ) {

    const transactions =
      this.getTransactions();


    const item = {

      ...transaction,

      id:
        transaction.id ||
        this.generateId(
          "TRX"
        ),

      amount:
        this.positiveNumber(
          transaction.amount
        ),

      createdAt:
        transaction.createdAt ||
        this.now(),

      date:
        transaction.date ||
        this.today(),

      updatedAt:
        this.now()
    };


    transactions.push(
      item
    );


    this.saveTransactions(
      transactions
    );


    return item;
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


    transactions[index] = {

      ...transactions[index],

      ...changes,

      id:
        transactions[index].id,

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
      this.getTransactions();

    const filtered =
      transactions.filter(
        transaction =>
          String(
            transaction.id
          ) !==
          String(id)
      );


    this.saveTransactions(
      filtered
    );


    return (
      filtered.length !==
      transactions.length
    );
  },


  /* =====================================================
     HELD SALES
     ===================================================== */

  getHeldSales() {

    return this.getData(
      this.keys.heldSales
    );
  },


  saveHeldSales(sales) {

    return this.saveData(
      this.keys.heldSales,
      sales
    );
  },


  holdSale(sale = {}) {

    const sales =
      this.getHeldSales();


    const item = {

      ...sale,

      id:
        sale.id ||
        this.generateId(
          "HOLD"
        ),

      createdAt:
        sale.createdAt ||
        this.now(),

      updatedAt:
        this.now()
    };


    sales.push(
      item
    );


    this.saveHeldSales(
      sales
    );


    return item;
  },


  removeHeldSale(id) {

    const sales =
      this.getHeldSales();


    const filtered =
      sales.filter(
        sale =>
          String(
            sale.id
          ) !==
          String(id)
      );


    this.saveHeldSales(
      filtered
    );


    return (
      filtered.length !==
      sales.length
    );
  },


  getHeldSaleById(id) {

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


  /* =====================================================
     SETTINGS
     ===================================================== */

  getSettings() {

    const defaults = {

      businessName:
        "VAREX",

      currency:
        "AED",

      currencySymbol:
        "د.إ",

      taxEnabled:
        true,

      taxRate:
        5,

      lowStockLimit:
        5,

      language:
        "ar"
    };


    const primary =
      this.getObject(
        this.keys.settings,
        {}
      );


    /*
       Compatibility with the older dashboard key.
    */

    let legacy = {};


    try {

      const raw =
        localStorage.getItem(
          "varexSettings"
        );


      if (raw) {

        const parsed =
          JSON.parse(raw);


        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {

          legacy =
            parsed;
        }
      }

    } catch (error) {

      legacy = {};
    }


    return {

      ...defaults,

      ...legacy,

      ...primary
    };
  },


  saveSettings(settings = {}) {

    const current =
      this.getSettings();


    const data = {

      ...current,

      ...settings,

      updatedAt:
        this.now()
    };


    const saved =
      this.saveObject(
        this.keys.settings,
        data
      );


    /*
       Keep compatibility with existing setting.html/index.html.
    */

    try {

      localStorage.setItem(
        "varexSettings",
        JSON.stringify(
          data
        )
      );

    } catch (error) {

      console.error(
        "VAREX legacy settings error:",
        error
      );
    }


    return saved;
  },


  /* =====================================================
     MONEY
     ===================================================== */

  money(value) {

    const settings =
      this.getSettings();


    const amount =
      this.toNumber(
        value,
        0
      );


    const symbol =
      this.cleanText(
        settings.currencySymbol
      ) ||
      (
        settings.currency === "AED"
          ? "د.إ"
          : settings.currency
      );


    return (
      amount.toFixed(2) +
      " " +
      symbol
    );
  },


  /* =====================================================
     TAX
     ===================================================== */

  calculateTax(amount) {

    const settings =
      this.getSettings();


    if (
      settings.taxEnabled ===
      false
    ) {

      return 0;
    }


    const rate =
      this.toNumber(
        settings.taxRate,
        5
      );


    return (
      this.positiveNumber(
        amount
      ) *
      rate /
      100
    );
  },


  /* =====================================================
     DASHBOARD HELPERS
     ===================================================== */

  getTodaySales() {

    const today =
      this.today();


    return this
      .getSales()
      .filter(
        sale => {

          const date =
            sale.createdAt ||
            sale.date ||
            sale.saleDate ||
            sale.invoiceDate ||
            "";


          return (
            this.normalizeDate(
              date
            ) ===
            today
          );
        }
      );
  },


  getTodaySalesTotal() {

    return this
      .getTodaySales()
      .reduce(
        (total, sale) => {

          const value =
            sale.total ??
            sale.grandTotal ??
            sale.finalTotal ??
            sale.netTotal ??
            sale.amount ??
            0;


          return (
            total +
            this.toNumber(
              value,
              0
            )
          );

        },
        0
      );
  },


  getStockAlerts() {

    const settings =
      this.getSettings();


    const defaultLimit =
      this.toNumber(
        settings.lowStockLimit,
        5
      );


    return this
      .getProducts()
      .filter(
        product => {

          const quantity =
            this.toNumber(
              product.quantity,
              0
            );


          const productLimit =
            this.toNumber(
              product.minimumStock,
              defaultLimit
            );


          return (
            quantity <=
            productLimit
          );
        }
      );
  },


  /* =====================================================
     INITIALIZE STORAGE
     ===================================================== */

  initialize() {

    const arrayKeys = [

      this.keys.products,
      this.keys.sales,
      this.keys.customers,
      this.keys.suppliers,
      this.keys.employees,
      this.keys.transactions,
      this.keys.heldSales,
      this.keys.users

    ];


    arrayKeys.forEach(
      key => {

        if (
          localStorage.getItem(
            key
          ) === null
        ) {

          localStorage.setItem(
            key,
            "[]"
          );
        }
      }
    );


    if (
      localStorage.getItem(
        this.keys.settings
      ) === null
    ) {

      this.saveSettings(
        this.getSettings()
      );
    }


    return true;
  }

};


/* =========================================================
   START VAREX
   ========================================================= */

VAREX.initialize();


/* =========================================================
   MAKE VAREX AVAILABLE GLOBALLY
   ========================================================= */

window.VAREX =
  VAREX;
