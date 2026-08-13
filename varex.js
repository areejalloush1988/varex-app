/* =========================================================
   VAREX CORE
   Shared Data Layer
   AUTH + POS COMPATIBLE VERSION
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

    const now =
      this.now();


    const newUser = {

      id:
        this.generateId(
          "USR"
        ),

      name,

      username,

      email,

      /*
       * هذه مناسبة حالياً للنسخة المحلية فقط.
       * عند ربط VAREX بخادم حقيقي سنستبدلها
       * بنظام Authentication آمن على الخادم.
       */
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
        now,

      updatedAt:
        now,

      lastLogin:
        ""
    };


    users.push(
      newUser
    );


    const saved =
      this.saveUsers(
        users
      );


    if (!saved) {

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


    /*
     * localStorage = يبقى المستخدم مسجلاً عند اختيار تذكرني.
     * sessionStorage = تنتهي الجلسة عند إغلاق جلسة المتصفح.
     */

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


    const user =
      this.findUserById(
        session.userId
      );


    return this.getSafeUser(
      user
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


    if (redirect) {

      window.location.replace(
        "login.html"
      );
    }


    return true;
  },


  requireLogin() {

    if (
      this.isLoginPage()
    ) {
      return true;
    }


    if (
      !this.isLoggedIn()
    ) {

      window.location.replace(
        "login.html"
      );

      return false;
    }


    return true;
  },


  isLoginPage() {

    const path =
      window.location.pathname
        .toLowerCase();


    return (
      path.endsWith(
        "/login.html"
      ) ||
      path.endsWith(
        "login.html"
      )
    );
  },


  redirectLoggedUser() {

    if (
      this.isLoginPage() &&
      this.isLoggedIn()
    ) {

      window.location.replace(
        "index.html"
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


    if (
      changes.email !==
      undefined
    ) {

      const email =
        this.normalizeEmail(
          changes.email
        );


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


      changes.email =
        email;
    }


    if (
      changes.username !==
      undefined
    ) {

      const username =
        this.normalizeUsername(
          changes.username
        );


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


      changes.username =
        username;
    }


    users[index] = {

      ...users[index],

      ...changes,

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
     SETTINGS
     ===================================================== */
