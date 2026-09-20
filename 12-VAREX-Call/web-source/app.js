(function () {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const views = $$(".view");
  const state = {
    config: { otpConfigured: false, channels: [] },
    account: null,
    phone: "",
    channel: "sms",
    contacts: [],
    conversations: [],
    calls: [],
    activeConversation: null,
    messages: [],
    currentTab: "chats",
    search: "",
    incoming: null,
    incomingSeen: new Set(),
    pollTimer: 0,
    chatTimer: 0,
    resendTimer: 0,
    resendRemaining: 0,
    deferredInstall: null,
    call: null,
    localStream: null,
    remoteStream: null,
    peer: null,
    signalCursor: 0,
    signalTimer: 0,
    callStatusTimer: 0,
    callClockTimer: 0,
    connectedAt: 0,
    pendingCandidates: [],
    facingMode: "user",
    endingCall: false,
  };

  const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 6,
  };

  const errorText = {
    unauthorized: "انتهت جلسة الدخول. أدخل رقمك من جديد.",
    otp_provider_not_configured: "خدمة إرسال رمز التحقق لم تُفعّل بعد.",
    invalid_phone: "تأكد من رقم الهاتف ورمز الدولة.",
    invalid_channel: "اختر طريقة استلام الرمز.",
    invalid_code: "رمز التحقق غير صحيح أو انتهت صلاحيته.",
    otp_delivery_failed: "تعذر إرسال الرمز الآن. جرّب طريقة أخرى.",
    rate_limited: "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
    invalid_name: "اكتب اسمًا صحيحًا من حرفين على الأقل.",
    no_valid_contacts: "لم نجد رقمًا صحيحًا لإضافته.",
    contact_not_available: "هذا الرقم غير مسجل في التطبيق بعد.",
    invalid_contact: "جهة الاتصال غير صالحة.",
    conversation_not_found: "المحادثة غير متاحة.",
    empty_message: "اكتب رسالة أولًا.",
    call_not_found: "هذه المكالمة لم تعد متاحة.",
    call_unavailable: "تم الرد على المكالمة أو انتهت.",
    call_ended: "انتهت المكالمة.",
    service_unavailable: "الخدمة غير متاحة مؤقتًا. أعد المحاولة.",
    not_found: "الطلب غير متاح.",
  };

  class ApiError extends Error {
    constructor(code, status) {
      super(code || "service_unavailable");
      this.code = code || "service_unavailable";
      this.status = status || 0;
    }
  }

  function showView(view) {
    views.forEach(item => item.classList.toggle("active", item === view));
  }

  function setLoading(show, text) {
    $("#loadingText").textContent = text || "جارٍ التحميل…";
    $("#loadingOverlay").hidden = !show;
  }

  let toastTimer = 0;
  function notify(message, type) {
    clearTimeout(toastTimer);
    const toast = $("#toast");
    toast.textContent = message;
    toast.className = `toast show${type ? ` ${type}` : ""}`;
    toastTimer = window.setTimeout(() => { toast.className = "toast"; }, 3600);
  }

  function describeError(error) {
    if (error instanceof ApiError) return errorText[error.code] || errorText.service_unavailable;
    if (error && error.name === "NotAllowedError") return "اسمح للتطبيق باستخدام الكاميرا والمايكروفون لبدء المكالمة.";
    if (error && error.name === "NotFoundError") return "لم نعثر على كاميرا أو مايكروفون في هذا الجهاز.";
    if (error && error.name === "AbortError") return "أُلغيت العملية.";
    return errorText.service_unavailable;
  }

  async function api(path, options) {
    const init = { credentials: "same-origin", cache: "no-store", ...options };
    if (init.body && typeof init.body !== "string") {
      init.headers = { ...(init.headers || {}), "content-type": "application/json" };
      init.body = JSON.stringify(init.body);
    }
    let response;
    try {
      response = await fetch(`/call/api${path}`, init);
    } catch {
      throw new ApiError("service_unavailable", 0);
    }
    let payload = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok || payload.ok === false) {
      const error = new ApiError(payload.error || "service_unavailable", response.status);
      if (response.status === 401 && path !== "/auth/verify") handleExpiredSession();
      throw error;
    }
    return payload;
  }

  function handleExpiredSession() {
    if (!state.account) return;
    stopPolling();
    state.account = null;
    state.activeConversation = null;
    showView($("#authView"));
    $("#phoneStep").classList.add("active");
    $("#otpStep").classList.remove("active");
  }

  function normalizeWithCountry(value, countryCode) {
    const clean = String(value || "").trim().replace(/[^\d+]/g, "");
    if (clean.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(clean) ? clean : "";
    if (clean.startsWith("00")) {
      const international = `+${clean.slice(2)}`;
      return /^\+[1-9]\d{7,14}$/.test(international) ? international : "";
    }
    const local = clean.replace(/^0+/, "");
    const phone = `${countryCode}${local}`;
    return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : "";
  }

  function deviceName() {
    const ua = navigator.userAgent || "";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    return "متصفح الويب";
  }

  function initials(name) {
    const parts = String(name || "V").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase() || "V";
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(Number(value));
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit" }).format(date);
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric" }).format(date);
  }

  function formatCallDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(Number(value)));
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setAvatar(element, contact) {
    element.textContent = initials(contact && (contact.displayName || contact.localName));
    element.style.background = (contact && contact.avatarColor) || "#3157d5";
  }

  function setAuthStep(step) {
    $("#phoneStep").classList.toggle("active", step === "phone");
    $("#otpStep").classList.toggle("active", step === "otp");
  }

  async function requestCode(event) {
    event.preventDefault();
    const phone = normalizeWithCountry($("#phoneNumber").value, $("#countryCode").value);
    if (!phone) return notify(errorText.invalid_phone, "error");
    state.channel = $("input[name=otpChannel]:checked").value;
    if (!state.config.otpConfigured) {
      $("#providerNotice").hidden = false;
      return notify(errorText.otp_provider_not_configured, "error");
    }
    setLoading(true, "جارٍ إرسال رمز التحقق…");
    try {
      await api("/auth/request", { method: "POST", body: { phone, channel: state.channel } });
      state.phone = phone;
      $("#otpPhone").textContent = phone;
      setAuthStep("otp");
      startResendCountdown(60);
      $("#otpBoxes input").focus();
      notify("تم إرسال رمز التحقق.", "success");
    } catch (error) {
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  function otpValue() {
    return $$("#otpBoxes input").map(input => input.value).join("");
  }

  async function verifyCode(event) {
    event.preventDefault();
    const code = otpValue();
    if (code.length !== 6) return notify("أدخل رمز التحقق المكوّن من 6 أرقام.", "error");
    setLoading(true, "جارٍ تأكيد الرقم…");
    try {
      const result = await api("/auth/verify", { method: "POST", body: { phone: state.phone, code, deviceName: deviceName() } });
      state.account = result.account;
      await enterMain();
      if (/^مستخدم \d{4}$/.test(state.account.displayName || "")) window.setTimeout(openProfile, 380);
    } catch (error) {
      notify(describeError(error), "error");
      $$("#otpBoxes input").forEach(input => { input.value = ""; });
      $("#otpBoxes input").focus();
    } finally {
      setLoading(false);
    }
  }

  function startResendCountdown(seconds) {
    clearInterval(state.resendTimer);
    state.resendRemaining = seconds;
    const button = $("#resendCode");
    const label = $("#resendTimer");
    button.disabled = true;
    const tick = () => {
      label.textContent = state.resendRemaining > 0 ? `(${state.resendRemaining})` : "";
      if (state.resendRemaining <= 0) {
        clearInterval(state.resendTimer);
        button.disabled = false;
      }
      state.resendRemaining -= 1;
    };
    tick();
    state.resendTimer = window.setInterval(tick, 1000);
  }

  async function resendCode() {
    if (!state.phone || state.resendRemaining > 0) return;
    setLoading(true, "جارٍ إعادة إرسال الرمز…");
    try {
      await api("/auth/request", { method: "POST", body: { phone: state.phone, channel: state.channel } });
      startResendCountdown(60);
      notify("تم إرسال رمز جديد.", "success");
    } catch (error) {
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function enterMain() {
    showView($("#mainView"));
    setLoading(true, "جارٍ تحميل محادثاتك…");
    try {
      await refreshAll();
      if (new URLSearchParams(location.search).get("tab") === "contacts") switchTab("contacts");
      startPolling();
    } catch (error) {
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    const [contacts, conversations, calls] = await Promise.all([
      api("/contacts", { method: "GET" }),
      api("/conversations", { method: "GET" }),
      api("/calls/history", { method: "GET" }),
    ]);
    state.contacts = contacts.contacts || [];
    state.conversations = conversations.conversations || [];
    state.calls = calls.calls || [];
    renderContacts();
    renderConversations();
    renderCalls();
  }

  function startPolling() {
    stopPolling();
    const tick = async () => {
      if (!state.account || document.hidden || state.call) return;
      try {
        const [incoming, conversations] = await Promise.all([
          api("/calls/incoming", { method: "GET" }),
          api("/conversations", { method: "GET" }),
        ]);
        state.conversations = conversations.conversations || [];
        renderConversations();
        handleIncomingList(incoming.calls || []);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) $("#connectionState").textContent = "نعيد الاتصال…";
      }
    };
    tick();
    state.pollTimer = window.setInterval(tick, 2800);
  }

  function stopPolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = 0;
  }

  function switchTab(tab) {
    state.currentTab = tab;
    $$(".bottom-nav button").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab));
    const titles = { chats: "المحادثات", calls: "المكالمات", contacts: "جهات الاتصال" };
    $("#sectionTitle").textContent = titles[tab];
    $("#searchInput").placeholder = tab === "calls" ? "بحث في المكالمات" : "بحث";
    if (tab === "calls") refreshCalls();
  }

  async function refreshCalls() {
    try {
      const result = await api("/calls/history", { method: "GET" });
      state.calls = result.calls || [];
      renderCalls();
    } catch (error) {
      notify(describeError(error), "error");
    }
  }

  function openSheet(sheet) { sheet.hidden = false; }
  function closeSheets() { $$(".sheet").forEach(sheet => { sheet.hidden = true; }); }

  function openContactSheet() {
    $("#contactForm").reset();
    openSheet($("#contactSheet"));
    window.setTimeout(() => $("#contactName").focus(), 180);
  }

  function openProfile() {
    if (!state.account) return;
    $("#profileName").value = state.account.displayName || "";
    $("#discoverableToggle").checked = state.account.discoverable !== false;
    openSheet($("#profileSheet"));
  }

  async function saveProfile(event) {
    event.preventDefault();
    const displayName = $("#profileName").value.trim();
    if (displayName.length < 2) return notify(errorText.invalid_name, "error");
    setLoading(true, "جارٍ حفظ حسابك…");
    try {
      const result = await api("/me", { method: "PATCH", body: { displayName, discoverable: $("#discoverableToggle").checked } });
      state.account = result.account;
      closeSheets();
      notify("تم حفظ حسابك.", "success");
    } catch (error) {
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true, "جارٍ تسجيل الخروج…");
    try { await api("/auth/logout", { method: "POST" }); } catch { /* Clear the local UI even if the network is unavailable. */ }
    stopPolling();
    stopChatPolling();
    state.account = null;
    state.conversations = [];
    state.contacts = [];
    state.calls = [];
    closeSheets();
    showView($("#authView"));
    setAuthStep("phone");
    setLoading(false);
  }

  function filtered(items, getter) {
    const query = state.search.trim().toLocaleLowerCase("ar");
    return query ? items.filter(item => String(getter(item) || "").toLocaleLowerCase("ar").includes(query)) : items;
  }

  function renderConversations() {
    const list = $("#conversationList");
    list.replaceChildren();
    const conversations = filtered(state.conversations, item => `${item.contact.displayName} ${item.lastMessage}`);
    conversations.forEach(conversation => {
      const row = createElement("button", "list-item");
      row.type = "button";
      const avatar = createElement("span", "avatar");
      setAvatar(avatar, conversation.contact);
      const copy = createElement("span", "list-copy");
      copy.append(createElement("strong", "", conversation.contact.displayName), createElement("p", "", conversation.lastMessage || "ابدأ المحادثة"));
      const meta = createElement("span", "list-meta");
      meta.append(createElement("time", "", formatTime(conversation.lastMessageAt)));
      if (conversation.unreadCount) meta.append(createElement("b", "unread-badge", conversation.unreadCount > 99 ? "99+" : String(conversation.unreadCount)));
      row.append(avatar, copy, meta);
      row.addEventListener("click", () => openConversation(conversation));
      list.append(row);
    });
    $("#chatsEmpty").classList.toggle("visible", !conversations.length);
    const unread = state.conversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
    const badge = $("#chatBadge");
    badge.hidden = !unread;
    badge.textContent = unread > 99 ? "99+" : String(unread);
    $("#connectionState").textContent = "متصل";
  }

  function renderContacts() {
    const list = $("#contactList");
    list.replaceChildren();
    const contacts = filtered(state.contacts, item => `${item.displayName} ${item.phone}`);
    contacts.forEach(contact => {
      const row = createElement("button", "list-item");
      row.type = "button";
      const avatar = createElement("span", "avatar");
      setAvatar(avatar, contact);
      const copy = createElement("span", "list-copy");
      const status = createElement("p", contact.available ? "availability" : "not-available", contact.available ? "متاح للمحادثة" : "غير مسجل بعد");
      copy.append(createElement("strong", "", contact.displayName), status);
      const meta = createElement("span", "list-meta");
      meta.append(createElement("span", "", contact.phone));
      row.append(avatar, copy, meta);
      row.addEventListener("click", () => contact.available ? startConversation(contact) : notify("هذا الرقم غير مسجل في التطبيق بعد.", "error"));
      list.append(row);
    });
    $("#contactsEmpty").classList.toggle("visible", !contacts.length);
  }

  function callDirectionIcon(call) {
    const wrap = createElement("span", `call-direction${call.endedReason === "declined" && call.direction === "incoming" ? " missed" : ""}`);
    wrap.innerHTML = call.direction === "incoming"
      ? '<svg viewBox="0 0 24 24"><path d="M17 7 7 17M7 17h7M7 17v-7"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="m7 17 10-10M17 7h-7M17 7v7"/></svg>';
    return wrap;
  }

  function renderCalls() {
    const list = $("#callHistory");
    list.replaceChildren();
    const calls = filtered(state.calls, item => item.partnerName);
    calls.forEach(call => {
      const row = createElement("button", "list-item");
      row.type = "button";
      const avatar = createElement("span", "avatar");
      setAvatar(avatar, { displayName: call.partnerName, avatarColor: call.direction === "incoming" ? "#00897b" : "#3157d5" });
      const copy = createElement("span", "list-copy");
      const detail = createElement("p");
      detail.append(callDirectionIcon(call), document.createTextNode(` ${call.direction === "incoming" ? "واردة" : "صادرة"} · ${formatCallDate(call.createdAt)}`));
      copy.append(createElement("strong", "", call.partnerName || "جهة اتصال"), detail);
      const meta = createElement("span", "list-meta");
      const icon = createElement("span");
      icon.innerHTML = call.callType === "video"
        ? '<svg class="call-type-icon" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>'
        : '<svg class="call-type-icon" viewBox="0 0 24 24"><path d="m7 4-2-1a2 2 0 0 0-2 .8L2 5.2c-.6.9-.7 2-.2 3A27 27 0 0 0 15.7 22c1 .5 2.2.4 3-.2l1.5-1.2a2 2 0 0 0 .7-2.2l-.9-2a2 2 0 0 0-2.3-1.1l-3 .9a2.5 2.5 0 0 1-2.5-.7l-3.7-3.7a2.5 2.5 0 0 1-.7-2.5l.9-3A2 2 0 0 0 7 4Z"/></svg>';
      meta.append(icon);
      row.append(avatar, copy, meta);
      list.append(row);
    });
    $("#callsEmpty").classList.toggle("visible", !calls.length);
  }

  async function saveContact(event) {
    event.preventDefault();
    const name = $("#contactName").value.trim();
    const phone = normalizeWithCountry($("#contactPhone").value, $("#contactCountryCode").value);
    if (!name) return notify("اكتب اسم جهة الاتصال.", "error");
    if (!phone) return notify(errorText.invalid_phone, "error");
    setLoading(true, "جارٍ إضافة جهة الاتصال…");
    try {
      const result = await api("/contacts", { method: "POST", body: { contacts: [{ name, phone }] } });
      state.contacts = result.contacts || [];
      renderContacts();
      closeSheets();
      const contact = state.contacts.find(item => item.phone === phone);
      if (contact && contact.available) {
        notify("تمت الإضافة. يمكنك بدء المحادثة الآن.", "success");
        await startConversation(contact);
      } else {
        notify("تم حفظ الرقم، لكنه غير مسجل في التطبيق بعد.", "success");
        switchTab("contacts");
      }
    } catch (error) {
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function importContacts() {
    if (!navigator.contacts || typeof navigator.contacts.select !== "function") {
      notify("اختيار جهات الاتصال متاح على Android Chrome. يمكنك إضافة الرقم يدويًا هنا.", "error");
      openContactSheet();
      return;
    }
    try {
      const selected = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const country = $("#contactCountryCode").value || "+971";
      const contacts = [];
      selected.forEach(person => {
        const name = Array.isArray(person.name) ? person.name[0] : person.name;
        const numbers = Array.isArray(person.tel) ? person.tel : [person.tel];
        numbers.forEach(value => {
          const phone = normalizeWithCountry(value, country);
          if (phone) contacts.push({ name: name || phone, phone });
        });
      });
      if (!contacts.length) return notify("لم يتم اختيار رقم صالح.", "error");
      setLoading(true, "جارٍ إضافة جهات الاتصال…");
      const result = await api("/contacts", { method: "POST", body: { contacts } });
      state.contacts = result.contacts || [];
      renderContacts();
      notify(`تمت إضافة ${contacts.length} جهة اتصال.`, "success");
    } catch (error) {
      if (error && error.name !== "AbortError") notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function startConversation(contact) {
    if (!contact.accountId) return notify(errorText.contact_not_available, "error");
    setLoading(true, "جارٍ فتح المحادثة…");
    try {
      const result = await api("/conversations", { method: "POST", body: { accountId: contact.accountId } });
      const conversation = {
        id: result.conversation.id,
        contact: {
          id: contact.accountId,
          displayName: contact.displayName,
          avatarColor: contact.avatarColor,
          lastSeenAt: contact.lastSeenAt,
        },
        lastMessage: "",
        lastMessageAt: Date.now(),
        unreadCount: 0,
      };
      const existing = state.conversations.find(item => item.id === conversation.id);
      await openConversation(existing || conversation);
    } catch (error) {
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(conversation) {
    state.activeConversation = conversation;
    $("#chatName").textContent = conversation.contact.displayName;
    setAvatar($("#chatAvatar"), conversation.contact);
    $("#chatPresence").textContent = "متاح للمراسلة والمكالمات";
    showView($("#chatView"));
    await loadMessages(true);
    startChatPolling();
    $("#messageInput").focus();
  }

  function closeConversation() {
    stopChatPolling();
    state.activeConversation = null;
    state.messages = [];
    showView($("#mainView"));
    refreshAll().catch(() => {});
  }

  async function loadMessages(forceScroll) {
    if (!state.activeConversation) return;
    try {
      const result = await api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/messages?after=0`, { method: "GET" });
      const next = result.messages || [];
      const changed = next.length !== state.messages.length || (next.length && state.messages[next.length - 1]?.id !== next[next.length - 1].id);
      state.messages = next;
      if (changed || forceScroll) renderMessages(forceScroll || isNearMessageBottom());
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) notify(describeError(error), "error");
    }
  }

  function isNearMessageBottom() {
    const list = $("#messageList");
    return list.scrollHeight - list.scrollTop - list.clientHeight < 100;
  }

  function renderMessages(scrollBottom) {
    const list = $("#messageList");
    list.replaceChildren();
    if (!state.messages.length) {
      const day = createElement("div", "message-day", "ابدأ المحادثة الآن");
      list.append(day);
    }
    let previousDay = "";
    state.messages.forEach(message => {
      const date = new Date(Number(message.createdAt));
      const dayKey = date.toDateString();
      if (dayKey !== previousDay) {
        const today = new Date().toDateString() === dayKey;
        list.append(createElement("div", "message-day", today ? "اليوم" : new Intl.DateTimeFormat("ar", { weekday: "long", month: "short", day: "numeric" }).format(date)));
        previousDay = dayKey;
      }
      const row = createElement("div", `message-row ${message.mine ? "mine" : "theirs"}`);
      const bubble = createElement("div", "message-bubble");
      bubble.append(createElement("p", "", message.body));
      const stamp = createElement("small");
      if (message.mine) stamp.append(createElement("i", "", message.readAt ? "✓✓" : "✓"));
      stamp.append(document.createTextNode(new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit" }).format(date)));
      bubble.append(stamp);
      row.append(bubble);
      list.append(row);
    });
    if (scrollBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function startChatPolling() {
    stopChatPolling();
    state.chatTimer = window.setInterval(() => {
      if (!document.hidden && state.activeConversation && !state.call) loadMessages(false);
    }, 1800);
  }

  function stopChatPolling() {
    clearInterval(state.chatTimer);
    state.chatTimer = 0;
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.activeConversation) return;
    const input = $("#messageInput");
    const body = input.value.trim();
    if (!body) return;
    input.value = "";
    resizeComposer();
    const clientNonce = `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const optimistic = { id: clientNonce, senderId: state.account.id, clientNonce, body, createdAt: Date.now(), readAt: null, mine: true };
    state.messages.push(optimistic);
    renderMessages(true);
    try {
      const result = await api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/messages`, { method: "POST", body: { body, clientNonce } });
      const index = state.messages.findIndex(item => item.clientNonce === clientNonce);
      if (index >= 0) state.messages[index] = result.message;
      renderMessages(true);
    } catch (error) {
      state.messages = state.messages.filter(item => item.clientNonce !== clientNonce);
      input.value = body;
      renderMessages(true);
      notify(describeError(error), "error");
    }
  }

  function resizeComposer() {
    const input = $("#messageInput");
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
  }

  async function openMedia(callType) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new ApiError("service_unavailable", 0);
    stopMedia();
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === "video" ? { facingMode: state.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    };
    state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    $("#localVideo").srcObject = state.localStream;
    $("#localVideo").classList.toggle("video-off", callType !== "video");
    $("#callView").classList.toggle("audio-mode", callType !== "video");
  }

  function stopMedia() {
    if (state.localStream) state.localStream.getTracks().forEach(track => track.stop());
    if (state.remoteStream) state.remoteStream.getTracks().forEach(track => track.stop());
    state.localStream = null;
    state.remoteStream = null;
    $("#localVideo").srcObject = null;
    $("#remoteVideo").srcObject = null;
  }

  function resetPeer() {
    clearInterval(state.signalTimer);
    clearInterval(state.callStatusTimer);
    clearInterval(state.callClockTimer);
    state.signalTimer = 0;
    state.callStatusTimer = 0;
    state.callClockTimer = 0;
    if (state.peer) {
      state.peer.ontrack = null;
      state.peer.onicecandidate = null;
      state.peer.onconnectionstatechange = null;
      state.peer.close();
    }
    state.peer = null;
    state.pendingCandidates = [];
    state.signalCursor = 0;
    state.connectedAt = 0;
  }

  function setCallStatus(text) { $("#callStatus").textContent = text; }

  function createPeer() {
    if (state.peer) return state.peer;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    state.peer = peer;
    state.remoteStream = new MediaStream();
    $("#remoteVideo").srcObject = state.remoteStream;
    if (state.localStream) state.localStream.getTracks().forEach(track => peer.addTrack(track, state.localStream));
    peer.ontrack = event => {
      const stream = event.streams && event.streams[0];
      if (stream) $("#remoteVideo").srcObject = stream;
      else if (state.remoteStream) state.remoteStream.addTrack(event.track);
      $("#remoteVideo").play().catch(() => {});
    };
    peer.onicecandidate = event => {
      if (event.candidate) sendSignal("ice", event.candidate.toJSON ? event.candidate.toJSON() : event.candidate).catch(() => {});
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") markConnected();
      else if (peer.connectionState === "connecting" || peer.connectionState === "new") setCallStatus("جارٍ الاتصال…");
      else if (peer.connectionState === "disconnected") setCallStatus("الاتصال ضعيف…");
      else if (peer.connectionState === "failed") reconnectCall();
      else if (peer.connectionState === "closed" && state.call && !state.endingCall) finishCall("انتهت المكالمة");
    };
    return peer;
  }

  function markConnected() {
    if (!state.connectedAt) {
      state.connectedAt = Date.now();
      setCallStatus("متصل");
      clearInterval(state.callClockTimer);
      state.callClockTimer = window.setInterval(updateCallClock, 1000);
      updateCallClock();
    }
  }

  function updateCallClock() {
    const elapsed = Math.max(0, Math.floor((Date.now() - state.connectedAt) / 1000));
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    $("#callTimer").textContent = `${minutes}:${seconds}`;
  }

  async function reconnectCall() {
    if (!state.call || !state.peer || state.endingCall) return;
    setCallStatus("نحاول إعادة الاتصال…");
    if (state.call.role !== "host") return;
    try {
      state.peer.restartIce();
      const offer = await state.peer.createOffer({ iceRestart: true });
      await state.peer.setLocalDescription(offer);
      await sendSignal("offer", state.peer.localDescription);
    } catch {
      finishCall("تعذر إعادة الاتصال");
    }
  }

  async function sendSignal(kind, payload) {
    if (!state.call) return;
    await api(`/calls/${encodeURIComponent(state.call.id)}/signals?role=${state.call.role}`, {
      method: "POST",
      headers: { authorization: `Bearer ${state.call.token}`, "x-call-role": state.call.role },
      body: { kind, payload },
    });
  }

  async function pollSignals() {
    if (!state.call || state.endingCall) return;
    try {
      const result = await api(`/calls/${encodeURIComponent(state.call.id)}/signals?role=${state.call.role}&after=${state.signalCursor}`, {
        method: "GET",
        headers: { authorization: `Bearer ${state.call.token}`, "x-call-role": state.call.role },
      });
      state.signalCursor = Number(result.cursor || state.signalCursor);
      for (const event of result.events || []) await handleSignal(event);
      if (result.call && result.call.status === "ended") finishCall(result.call.endedReason === "declined" ? "تم رفض المكالمة" : "انتهت المكالمة");
    } catch (error) {
      if (error instanceof ApiError && (error.code === "call_ended" || error.code === "call_not_found")) finishCall("انتهت المكالمة");
    }
  }

  async function handleSignal(event) {
    if (!state.call || state.endingCall) return;
    if (event.kind === "hangup") return finishCall(event.payload && event.payload.reason === "declined" ? "تم رفض المكالمة" : "انتهت المكالمة");
    if (event.kind === "ready" && state.call.role === "host") {
      const peer = createPeer();
      if (peer.signalingState !== "stable") return;
      setCallStatus("جارٍ ربط المكالمة…");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal("offer", peer.localDescription);
      return;
    }
    if (event.kind === "offer" && state.call.role === "guest") {
      const peer = createPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(event.payload));
      await flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal("answer", peer.localDescription);
      return;
    }
    if (event.kind === "answer" && state.call.role === "host" && state.peer) {
      await state.peer.setRemoteDescription(new RTCSessionDescription(event.payload));
      await flushCandidates();
      return;
    }
    if (event.kind === "ice" && event.payload) {
      if (state.peer && state.peer.remoteDescription) await state.peer.addIceCandidate(new RTCIceCandidate(event.payload));
      else state.pendingCandidates.push(event.payload);
    }
  }

  async function flushCandidates() {
    if (!state.peer || !state.peer.remoteDescription) return;
    const candidates = state.pendingCandidates.splice(0);
    for (const candidate of candidates) {
      try { await state.peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Ignore obsolete ICE candidates after reconnect. */ }
    }
  }

  function beginSignalPolling() {
    clearInterval(state.signalTimer);
    pollSignals();
    state.signalTimer = window.setInterval(pollSignals, 850);
  }

  function renderCallScreen() {
    if (!state.call) return;
    $("#callPartner").textContent = state.call.partnerName || "جهة اتصال";
    $("#callModeLabel").textContent = state.call.callType === "video" ? "مكالمة فيديو" : "مكالمة صوتية";
    $("#callTimer").textContent = "00:00";
    setAvatar($("#callAvatar"), { displayName: state.call.partnerName, avatarColor: "#3157d5" });
    $("#callView").classList.toggle("audio-mode", state.call.callType !== "video");
    $("#muteButton").setAttribute("aria-pressed", "false");
    $("#cameraButton").setAttribute("aria-pressed", "false");
    $("#speakerButton").setAttribute("aria-pressed", "false");
    setCallStatus(state.call.role === "host" && state.call.status === "waiting" ? "جارٍ الاتصال…" : "جارٍ ربط المكالمة…");
    showView($("#callView"));
  }

  async function startCall(callType) {
    const contact = state.activeConversation && state.activeConversation.contact;
    if (!contact || !contact.id) return notify(errorText.invalid_contact, "error");
    setLoading(true, callType === "video" ? "جارٍ تشغيل الكاميرا…" : "جارٍ تشغيل المايكروفون…");
    try {
      await openMedia(callType);
      const result = await api("/calls", { method: "POST", body: { accountId: contact.id, callType } });
      state.call = result.call;
      state.endingCall = false;
      state.signalCursor = 0;
      renderCallScreen();
      createPeer();
      beginSignalPolling();
      startCallStatusPolling();
    } catch (error) {
      stopMedia();
      resetPeer();
      state.call = null;
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  function startCallStatusPolling() {
    clearInterval(state.callStatusTimer);
    if (!state.call || state.call.role !== "host") return;
    state.callStatusTimer = window.setInterval(async () => {
      if (!state.call || state.endingCall) return;
      try {
        const result = await api(`/calls/${encodeURIComponent(state.call.id)}/status`, { method: "GET" });
        if (result.call.status === "ended") finishCall(result.call.endedReason === "declined" ? "تم رفض المكالمة" : "انتهت المكالمة");
      } catch { /* Signal polling will handle terminal errors. */ }
    }, 1800);
  }

  function handleIncomingList(calls) {
    if (state.call || state.incoming || !calls.length) return;
    const call = calls.find(item => !state.incomingSeen.has(item.id));
    if (!call) return;
    state.incoming = call;
    state.incomingSeen.add(call.id);
    $("#incomingType").textContent = call.callType === "video" ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة";
    $("#incomingName").textContent = call.partnerName || "جهة اتصال";
    $("#incomingCall").hidden = false;
    if (navigator.vibrate) navigator.vibrate([350, 180, 350, 180, 600]);
  }

  async function acceptIncoming() {
    if (!state.incoming) return;
    const incoming = state.incoming;
    $("#incomingCall").hidden = true;
    setLoading(true, incoming.callType === "video" ? "جارٍ تشغيل الكاميرا…" : "جارٍ الرد…");
    try {
      await openMedia(incoming.callType);
      const result = await api(`/calls/${encodeURIComponent(incoming.id)}/accept`, { method: "POST" });
      state.call = result.call;
      state.call.role = "guest";
      state.endingCall = false;
      state.signalCursor = 0;
      state.incoming = null;
      renderCallScreen();
      createPeer();
      beginSignalPolling();
    } catch (error) {
      stopMedia();
      resetPeer();
      state.call = null;
      state.incoming = null;
      notify(describeError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function declineIncoming() {
    if (!state.incoming) return;
    const id = state.incoming.id;
    $("#incomingCall").hidden = true;
    state.incoming = null;
    if (navigator.vibrate) navigator.vibrate(0);
    try { await api(`/calls/${encodeURIComponent(id)}/decline`, { method: "POST" }); } catch { /* Caller will time out if the decline request fails. */ }
    refreshCalls();
  }

  async function hangup() {
    if (!state.call || state.endingCall) return;
    state.endingCall = true;
    try {
      await api(`/calls/${encodeURIComponent(state.call.id)}/hangup?role=${state.call.role}`, {
        method: "POST",
        headers: { authorization: `Bearer ${state.call.token}`, "x-call-role": state.call.role },
        body: {},
      });
    } catch { /* Always close local media even when the signaling request fails. */ }
    finishCall("انتهت المكالمة");
  }

  function finishCall(message) {
    if (!state.call && !state.localStream) return;
    state.endingCall = true;
    stopMedia();
    resetPeer();
    state.call = null;
    state.endingCall = false;
    if (navigator.vibrate) navigator.vibrate(0);
    showView(state.activeConversation ? $("#chatView") : $("#mainView"));
    notify(message || "انتهت المكالمة");
    refreshCalls();
  }

  function toggleMute() {
    if (!state.localStream) return;
    const track = state.localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    $("#muteButton").setAttribute("aria-pressed", String(!track.enabled));
  }

  function toggleCamera() {
    if (!state.localStream) return;
    const track = state.localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    $("#cameraButton").setAttribute("aria-pressed", String(!track.enabled));
    $("#localVideo").classList.toggle("video-off", !track.enabled);
  }

  function toggleRemoteAudio() {
    const video = $("#remoteVideo");
    video.muted = !video.muted;
    $("#speakerButton").setAttribute("aria-pressed", String(video.muted));
  }

  async function flipCamera() {
    if (!state.call || state.call.callType !== "video" || !state.localStream) return;
    const oldTrack = state.localStream.getVideoTracks()[0];
    if (!oldTrack) return;
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: state.facingMode }, audio: false });
      const newTrack = stream.getVideoTracks()[0];
      const sender = state.peer && state.peer.getSenders().find(item => item.track && item.track.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      state.localStream.removeTrack(oldTrack);
      oldTrack.stop();
      state.localStream.addTrack(newTrack);
      $("#localVideo").srcObject = state.localStream;
    } catch (error) {
      state.facingMode = state.facingMode === "user" ? "environment" : "user";
      notify(describeError(error), "error");
    }
  }

  function bindOtpBoxes() {
    const inputs = $$("#otpBoxes input");
    inputs.forEach((input, index) => {
      input.addEventListener("input", event => {
        const digits = event.target.value.replace(/\D/g, "");
        if (digits.length > 1) {
          digits.slice(0, inputs.length).split("").forEach((digit, offset) => { if (inputs[offset]) inputs[offset].value = digit; });
          inputs[Math.min(digits.length, inputs.length) - 1].focus();
        } else {
          event.target.value = digits;
          if (digits && inputs[index + 1]) inputs[index + 1].focus();
        }
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && !input.value && inputs[index - 1]) inputs[index - 1].focus();
      });
      input.addEventListener("paste", event => {
        const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!digits) return;
        event.preventDefault();
        digits.split("").forEach((digit, offset) => { if (inputs[offset]) inputs[offset].value = digit; });
        inputs[Math.min(digits.length, inputs.length) - 1].focus();
      });
    });
  }

  function bindEvents() {
    $("#phoneForm").addEventListener("submit", requestCode);
    $("#otpForm").addEventListener("submit", verifyCode);
    $("#backToPhone").addEventListener("click", () => setAuthStep("phone"));
    $("#resendCode").addEventListener("click", resendCode);
    $$("input[name=otpChannel]").forEach(input => input.addEventListener("change", () => {
      $$(".delivery-choice").forEach(label => label.classList.toggle("active", label.contains(input)));
    }));
    $("#profileButton").addEventListener("click", openProfile);
    $("#newContactButton").addEventListener("click", openContactSheet);
    $$('[data-open-contacts]').forEach(button => button.addEventListener("click", openContactSheet));
    $$('[data-close-sheet]').forEach(button => button.addEventListener("click", closeSheets));
    $("#contactForm").addEventListener("submit", saveContact);
    $("#profileForm").addEventListener("submit", saveProfile);
    $("#importContactsButton").addEventListener("click", importContacts);
    $("#logoutButton").addEventListener("click", logout);
    $$(".bottom-nav button").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
    $("#searchInput").addEventListener("input", event => {
      state.search = event.target.value;
      renderConversations();
      renderContacts();
      renderCalls();
    });
    $("#backToMain").addEventListener("click", closeConversation);
    $("#messageForm").addEventListener("submit", sendMessage);
    $("#messageInput").addEventListener("input", resizeComposer);
    $("#messageInput").addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $("#messageForm").requestSubmit();
      }
    });
    $$('[data-chat-call]').forEach(button => button.addEventListener("click", () => startCall(button.dataset.chatCall)));
    $("#acceptCall").addEventListener("click", acceptIncoming);
    $("#declineCall").addEventListener("click", declineIncoming);
    $("#hangupButton").addEventListener("click", hangup);
    $("#muteButton").addEventListener("click", toggleMute);
    $("#cameraButton").addEventListener("click", toggleCamera);
    $("#speakerButton").addEventListener("click", toggleRemoteAudio);
    $("#flipButton").addEventListener("click", flipCamera);
    $("#installButton").addEventListener("click", installApp);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.account && !state.call) {
        refreshAll().catch(() => {});
        if (state.activeConversation) loadMessages(false);
      }
    });
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      state.deferredInstall = event;
    });
  }

  async function installApp() {
    if (state.deferredInstall) {
      state.deferredInstall.prompt();
      await state.deferredInstall.userChoice;
      state.deferredInstall = null;
      return;
    }
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    notify(isIos ? "على iPhone: اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية»." : "من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»." );
  }

  async function boot() {
    bindEvents();
    bindOtpBoxes();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/call/sw.js", { scope: "/call/" }).catch(() => {});
    const started = Date.now();
    try {
      const [config, me] = await Promise.all([
        api("/config", { method: "GET" }).catch(() => ({ otpConfigured: false, channels: [] })),
        api("/me", { method: "GET" }).catch(error => error),
      ]);
      state.config = config;
      $("#providerNotice").hidden = Boolean(config.otpConfigured);
      const wait = Math.max(0, 750 - (Date.now() - started));
      await new Promise(resolve => window.setTimeout(resolve, wait));
      if (me && !(me instanceof Error) && me.account) {
        state.account = me.account;
        await enterMain();
      } else {
        showView($("#authView"));
        setAuthStep("phone");
      }
    } catch {
      showView($("#authView"));
      setAuthStep("phone");
      notify("تعذر الاتصال بالخدمة. تحقق من الإنترنت وأعد المحاولة.", "error");
    }
  }

  boot();
})();
