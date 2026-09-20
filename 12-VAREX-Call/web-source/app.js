(function () {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const screens = $$(".screen");
  const homeScreen = $("#homeScreen");
  const waitingScreen = $("#waitingScreen");
  const callScreen = $("#callScreen");
  const endedScreen = $("#endedScreen");
  const displayName = $("#displayName");
  const roomCode = $("#roomCode");
  const joinButton = $("#joinButton");
  const installButton = $("#installButton");
  const installModal = $("#installModal");
  const localVideo = $("#localVideo");
  const remoteVideo = $("#remoteVideo");
  const audioStage = $("#audioStage");
  const toast = $("#toast");
  const loadingOverlay = $("#loadingOverlay");
  const loadingText = $("#loadingText");

  const state = {
    roomId: "",
    role: null,
    token: "",
    callType: "video",
    hostName: "",
    guestName: "",
    localStream: null,
    remoteStream: null,
    peer: null,
    pendingCandidates: [],
    cursor: 0,
    pollTimer: 0,
    timerInterval: 0,
    connectedAt: 0,
    facingMode: "user",
    active: false,
    ending: false,
    wakeLock: null,
  };

  const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 6,
  };

  class ApiError extends Error {
    constructor(code, status) {
      super(code || "service_unavailable");
      this.code = code || "service_unavailable";
      this.status = status;
    }
  }

  function setScreen(screen) {
    screens.forEach(item => item.classList.toggle("active", item === screen));
    window.scrollTo(0, 0);
  }

  function setLoading(show, text) {
    loadingText.textContent = text || "جارٍ التجهيز…";
    loadingOverlay.hidden = !show;
  }

  let toastTimer = 0;
  function notify(message, type) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast show${type === "error" ? " error" : ""}`;
    toastTimer = window.setTimeout(() => { toast.className = "toast"; }, 3400);
  }

  function safeName() {
    const name = displayName.value.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) {
      displayName.focus();
      notify("اكتبي اسمك أولاً حتى يعرفك الطرف الآخر.", "error");
      return "";
    }
    localStorage.setItem("varexCallDisplayName", name);
    return name;
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
  }

  function formatCode(code) {
    return code ? `${code.slice(0, 4)} ${code.slice(4)}` : "— — — — — — — —";
  }

  function sessionKey(id) {
    return `varexCallSession:${id}`;
  }

  function saveSession() {
    if (!state.roomId || !state.role || !state.token) return;
    sessionStorage.setItem(sessionKey(state.roomId), JSON.stringify({
      role: state.role,
      token: state.token,
      callType: state.callType,
      hostName: state.hostName,
      guestName: state.guestName,
    }));
  }

  function loadSession(id) {
    try {
      const value = JSON.parse(sessionStorage.getItem(sessionKey(id)) || "null");
      if (!value || !["host", "guest"].includes(value.role) || typeof value.token !== "string") return null;
      return value;
    } catch {
      return null;
    }
  }

  function clearSession() {
    if (state.roomId) sessionStorage.removeItem(sessionKey(state.roomId));
  }

  async function api(path, options) {
    const config = options || {};
    const headers = new Headers(config.headers || {});
    headers.set("accept", "application/json");
    if (config.body !== undefined) headers.set("content-type", "application/json");
    if (config.auth !== false && state.token && state.role) {
      headers.set("authorization", `Bearer ${state.token}`);
      headers.set("x-call-role", state.role);
    }
    const response = await fetch(path, {
      method: config.method || "GET",
      headers,
      body: config.body === undefined ? undefined : JSON.stringify(config.body),
      cache: "no-store",
      keepalive: Boolean(config.keepalive),
    });
    let data = null;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok || data.ok === false) throw new ApiError(data.error, response.status);
    return data;
  }

  function errorMessage(error) {
    const code = error && error.code;
    if (code === "room_not_found") return "رمز المكالمة غير صحيح.";
    if (code === "room_full") return "دخل شخص آخر إلى هذه المكالمة بالفعل.";
    if (code === "room_ended") return "هذه المكالمة انتهت أو انتهت صلاحيتها.";
    if (code === "rate_limited") return "عدد المحاولات كبير. انتظري قليلاً ثم حاولي مجدداً.";
    if (code === "unauthorized") return "تعذر التحقق من هذه المكالمة. افتحي رابط دعوة جديداً.";
    if (error && error.name === "NotAllowedError") return "اسمحي للمتصفح باستخدام الميكروفون والكاميرا حتى تبدأ المكالمة.";
    if (error && error.name === "NotFoundError") return "لم نجد ميكروفوناً أو كاميرا متاحة على هذا الجهاز.";
    if (!navigator.onLine) return "لا يوجد اتصال بالإنترنت حالياً.";
    return "تعذر بدء المكالمة الآن. حاولي مرة ثانية.";
  }

  function mediaConstraints(type, facingMode) {
    return {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === "video" ? {
        facingMode: { ideal: facingMode || "user" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      } : false,
    };
  }

  async function openMedia(type) {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("media_unavailable");
    }
    stopLocalMedia();
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints(type, state.facingMode));
    } catch (error) {
      if (type !== "video") throw error;
      state.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints("voice"));
      notify("الكاميرا غير متاحة؛ ستستمر المكالمة بالصوت.");
    }
    localVideo.srcObject = state.localStream;
    localVideo.classList.toggle("video-off", state.localStream.getVideoTracks().length === 0);
    try { await localVideo.play(); } catch {}
  }

  function stopLocalMedia() {
    if (state.localStream) state.localStream.getTracks().forEach(track => track.stop());
    state.localStream = null;
    localVideo.srcObject = null;
  }

  function updateWaitingUI() {
    $("#roomCodeDisplay").textContent = formatCode(state.roomId);
    $("#waitingType").textContent = state.callType === "video" ? "مكالمة فيديو" : "مكالمة صوتية";
    $("#waitingIcon").classList.toggle("voice", state.callType === "voice");
    $("#waitingIcon").innerHTML = state.callType === "video"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.3 4.2 5.6 3.4a2 2 0 0 0-2.3.6L2.2 5.4c-.7.9-.8 2.2-.3 3.2a27.1 27.1 0 0 0 13.5 13.5c1 .5 2.3.4 3.2-.3l1.4-1.1a2 2 0 0 0 .6-2.3l-.8-1.7a2 2 0 0 0-2.3-1.1l-2.8.8a2.5 2.5 0 0 1-2.5-.7l-3.9-3.9a2.5 2.5 0 0 1-.7-2.5l.8-2.8a2 2 0 0 0-1.1-2.3Z"/></svg>';
  }

  function updateCallUI() {
    const partner = state.role === "host" ? state.guestName : state.hostName;
    const name = partner || "الطرف الآخر";
    $("#callPartnerName").textContent = name;
    $("#partnerAvatar").textContent = name.trim().charAt(0).toUpperCase() || "V";
    $("#callTypeLabel").textContent = state.callType === "video" ? "مكالمة فيديو مشفّرة" : "مكالمة صوتية مشفّرة";
    callScreen.classList.toggle("audio-mode", state.callType === "voice");
    $("#cameraButton").hidden = state.callType !== "video";
    $("#flipButton").hidden = state.callType !== "video";
  }

  async function startNewCall(type) {
    if (state.active) return;
    const name = safeName();
    if (!name) return;
    state.callType = type;
    setLoading(true, type === "video" ? "جارٍ تشغيل الكاميرا والمايك…" : "جارٍ تشغيل الميكروفون…");
    try {
      await openMedia(type);
      const data = await api("/call/api/rooms", { method: "POST", auth: false, body: { callType: type, name } });
      state.roomId = data.roomId;
      state.role = "host";
      state.token = data.hostToken;
      state.hostName = name;
      state.active = true;
      state.cursor = 0;
      saveSession();
      history.replaceState({}, "", `/call/?room=${encodeURIComponent(state.roomId)}`);
      updateWaitingUI();
      setScreen(waitingScreen);
      startPolling();
      requestWakeLock();
    } catch (error) {
      stopLocalMedia();
      notify(errorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function joinCall() {
    if (state.active) return;
    const name = safeName();
    if (!name) return;
    const code = normalizeCode(roomCode.value);
    if (code.length !== 8) {
      roomCode.focus();
      notify("رمز المكالمة يتكوّن من 8 أحرف وأرقام.", "error");
      return;
    }
    const saved = loadSession(code);
    if (saved) {
      await resumeCall(code, saved);
      return;
    }
    setLoading(true, "جارٍ الانضمام إلى المكالمة…");
    try {
      const data = await api(`/call/api/rooms/${code}/join`, { method: "POST", auth: false, body: { name } });
      state.roomId = code;
      state.role = "guest";
      state.token = data.guestToken;
      state.callType = data.callType;
      state.hostName = data.hostName || "صاحب المكالمة";
      state.guestName = name;
      state.active = true;
      state.cursor = 0;
      saveSession();
      await openMedia(state.callType);
      history.replaceState({}, "", `/call/?room=${encodeURIComponent(code)}`);
      updateCallUI();
      setScreen(callScreen);
      startPolling();
      requestWakeLock();
    } catch (error) {
      if (state.token && state.roomId) await bestEffortHangup();
      stopLocalMedia();
      resetState();
      notify(errorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function resumeCall(code, saved) {
    setLoading(true, "جارٍ العودة إلى المكالمة…");
    try {
      state.roomId = code;
      state.role = saved.role;
      state.token = saved.token;
      state.callType = saved.callType || "video";
      state.hostName = saved.hostName || "";
      state.guestName = saved.guestName || "";
      state.active = true;
      state.cursor = 0;
      await openMedia(state.callType);
      updateCallUI();
      if (state.role === "host" && !state.guestName) {
        updateWaitingUI();
        setScreen(waitingScreen);
      } else {
        setScreen(callScreen);
      }
      startPolling();
      requestWakeLock();
    } catch (error) {
      stopLocalMedia();
      clearSession();
      resetState();
      notify(errorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  function createPeer() {
    if (state.peer) return state.peer;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    state.peer = peer;
    state.remoteStream = new MediaStream();
    remoteVideo.srcObject = state.remoteStream;
    if (state.localStream) state.localStream.getTracks().forEach(track => peer.addTrack(track, state.localStream));

    peer.ontrack = event => {
      const stream = event.streams && event.streams[0];
      if (stream) {
        remoteVideo.srcObject = stream;
      } else if (state.remoteStream) {
        state.remoteStream.addTrack(event.track);
      }
      remoteVideo.play().catch(() => {});
    };
    peer.onicecandidate = event => {
      if (!event.candidate) return;
      sendSignal("ice", event.candidate.toJSON ? event.candidate.toJSON() : event.candidate).catch(() => {});
    };
    peer.onconnectionstatechange = () => {
      const connectionState = peer.connectionState;
      if (connectionState === "connected") markConnected();
      if (connectionState === "connecting" || connectionState === "new") setCallStatus("جارٍ الاتصال…");
      if (connectionState === "disconnected") setCallStatus("الاتصال ضعيف…");
      if (connectionState === "failed") handleFailedConnection();
      if (connectionState === "closed" && state.active && !state.ending) finishCall(true, "انتهى الاتصال");
    };
    return peer;
  }

  async function handleFailedConnection() {
    if (!state.peer || state.ending) return;
    setCallStatus("نحاول إعادة الاتصال…");
    if (state.role === "host") {
      try {
        state.peer.restartIce();
        const offer = await state.peer.createOffer({ iceRestart: true });
        await state.peer.setLocalDescription(offer);
        await sendSignal("offer", state.peer.localDescription);
      } catch {
        window.setTimeout(() => finishCall(true, "تعذر استعادة الاتصال"), 5000);
      }
    }
  }

  function setCallStatus(text) {
    $("#callStatus").textContent = text;
  }

  function markConnected() {
    setCallStatus("متصل الآن");
    if (!state.connectedAt) {
      state.connectedAt = Date.now();
      clearInterval(state.timerInterval);
      state.timerInterval = window.setInterval(updateTimer, 1000);
      updateTimer();
    }
  }

  function updateTimer() {
    const elapsed = state.connectedAt ? Math.max(0, Math.floor((Date.now() - state.connectedAt) / 1000)) : 0;
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    $("#callTimer").textContent = `${minutes}:${seconds}`;
  }

  async function startOffer() {
    updateCallUI();
    setScreen(callScreen);
    const peer = createPeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await sendSignal("offer", peer.localDescription);
  }

  async function handleOffer(payload) {
    const peer = createPeer();
    await peer.setRemoteDescription(new RTCSessionDescription(payload));
    await flushCandidates();
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await sendSignal("answer", peer.localDescription);
  }

  async function handleAnswer(payload) {
    if (!state.peer) return;
    await state.peer.setRemoteDescription(new RTCSessionDescription(payload));
    await flushCandidates();
  }

  async function handleCandidate(payload) {
    if (!payload) return;
    if (!state.peer || !state.peer.remoteDescription) {
      state.pendingCandidates.push(payload);
      return;
    }
    try { await state.peer.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
  }

  async function flushCandidates() {
    if (!state.peer || !state.peer.remoteDescription) return;
    const candidates = state.pendingCandidates.splice(0);
    for (const candidate of candidates) {
      try { await state.peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }

  async function sendSignal(kind, payload) {
    return api(`/call/api/rooms/${state.roomId}/signals`, { method: "POST", body: { kind, payload } });
  }

  async function handleEvent(event) {
    if (event.kind === "ready" && state.role === "host" && !state.peer) {
      state.guestName = event.payload && event.payload.name ? String(event.payload.name) : "الطرف الآخر";
      saveSession();
      await startOffer();
      return;
    }
    if (event.kind === "offer" && state.role === "guest") {
      await handleOffer(event.payload);
      return;
    }
    if (event.kind === "answer" && state.role === "host") {
      await handleAnswer(event.payload);
      return;
    }
    if (event.kind === "ice") {
      await handleCandidate(event.payload);
      return;
    }
    if (event.kind === "hangup") finishCall(true, "أنهى الطرف الآخر المكالمة");
  }

  function startPolling() {
    clearTimeout(state.pollTimer);
    pollSignals();
  }

  async function pollSignals() {
    if (!state.active || state.ending || !state.roomId) return;
    try {
      const data = await api(`/call/api/rooms/${state.roomId}/signals?after=${state.cursor}`);
      state.cursor = Number(data.cursor || state.cursor);
      if (data.room) {
        state.hostName = data.room.hostName || state.hostName;
        state.guestName = data.room.guestName || state.guestName;
        updateCallUI();
        if (data.room.status === "ended") {
          finishCall(true, "انتهت المكالمة");
          return;
        }
      }
      for (const event of data.events || []) {
        if (!state.active || state.ending) break;
        await handleEvent(event);
      }
    } catch (error) {
      if (error.status === 410 || error.status === 404 || error.status === 401) {
        finishCall(true, errorMessage(error));
        return;
      }
      setCallStatus("نعيد الاتصال…");
    }
    if (state.active && !state.ending) state.pollTimer = window.setTimeout(pollSignals, 850);
  }

  async function bestEffortHangup() {
    if (!state.roomId || !state.token || !state.role) return;
    try { await api(`/call/api/rooms/${state.roomId}/hangup`, { method: "POST", body: {}, keepalive: true }); } catch {}
  }

  async function finishCall(remote, message) {
    if (state.ending) return;
    state.ending = true;
    if (!remote) await bestEffortHangup();
    const elapsed = state.connectedAt ? Math.max(0, Math.floor((Date.now() - state.connectedAt) / 1000)) : 0;
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    clearTimeout(state.pollTimer);
    clearInterval(state.timerInterval);
    if (state.peer) {
      state.peer.ontrack = null;
      state.peer.onicecandidate = null;
      state.peer.onconnectionstatechange = null;
      state.peer.close();
    }
    stopLocalMedia();
    remoteVideo.srcObject = null;
    if (state.wakeLock) {
      try { await state.wakeLock.release(); } catch {}
    }
    clearSession();
    history.replaceState({}, "", "/call/");
    $("#endedTitle").textContent = message || "انتهت المكالمة";
    $("#endedDuration").textContent = elapsed ? `مدة المكالمة ${minutes}:${seconds}` : "لم يتم الاتصال";
    setScreen(endedScreen);
    state.active = false;
  }

  async function cancelWaiting() {
    if (!state.active) return resetToHome();
    setLoading(true, "جارٍ إلغاء المكالمة…");
    await bestEffortHangup();
    clearTimeout(state.pollTimer);
    stopLocalMedia();
    clearSession();
    resetState();
    history.replaceState({}, "", "/call/");
    setScreen(homeScreen);
    setLoading(false);
  }

  function resetState() {
    clearTimeout(state.pollTimer);
    clearInterval(state.timerInterval);
    if (state.peer) state.peer.close();
    state.roomId = "";
    state.role = null;
    state.token = "";
    state.callType = "video";
    state.hostName = "";
    state.guestName = "";
    state.localStream = null;
    state.remoteStream = null;
    state.peer = null;
    state.pendingCandidates = [];
    state.cursor = 0;
    state.pollTimer = 0;
    state.timerInterval = 0;
    state.connectedAt = 0;
    state.active = false;
    state.ending = false;
    $("#micButton").setAttribute("aria-pressed", "false");
    $("#cameraButton").setAttribute("aria-pressed", "false");
    $("#callTimer").textContent = "00:00";
  }

  function resetToHome() {
    stopLocalMedia();
    resetState();
    roomCode.value = "";
    joinButton.textContent = "انضمام";
    history.replaceState({}, "", "/call/");
    setScreen(homeScreen);
  }

  function toggleTrack(kind, button) {
    if (!state.localStream) return;
    const tracks = kind === "audio" ? state.localStream.getAudioTracks() : state.localStream.getVideoTracks();
    if (!tracks.length) {
      notify(kind === "video" ? "لا توجد كاميرا فعّالة في هذه المكالمة." : "لا يوجد ميكروفون فعّال.", "error");
      return;
    }
    const enabled = tracks.some(track => track.enabled);
    tracks.forEach(track => { track.enabled = !enabled; });
    button.setAttribute("aria-pressed", String(enabled));
    if (kind === "video") localVideo.classList.toggle("video-off", enabled);
  }

  async function flipCamera() {
    if (!state.localStream || state.callType !== "video") return;
    const currentTrack = state.localStream.getVideoTracks()[0];
    if (!currentTrack) return notify("لا توجد كاميرا لتبديلها.", "error");
    const nextFacing = state.facingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = state.peer && state.peer.getSenders().find(item => item.track && item.track.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      state.localStream.removeTrack(currentTrack);
      currentTrack.stop();
      state.localStream.addTrack(newTrack);
      state.facingMode = nextFacing;
      localVideo.srcObject = state.localStream;
      localVideo.style.transform = nextFacing === "user" ? "scaleX(-1)" : "none";
    } catch {
      notify("تعذر تبديل الكاميرا على هذا الجهاز.", "error");
    }
  }

  function inviteUrl() {
    const url = new URL("/call/", location.origin);
    url.searchParams.set("room", state.roomId);
    return url.toString();
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  async function shareInvite() {
    const text = `انضم إلى مكالمتي على VAREX Call\nرمز المكالمة: ${state.roomId}`;
    const url = inviteUrl();
    if (navigator.share) {
      try { await navigator.share({ title: "VAREX Call", text, url }); return; } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }
    await copyText(`${text}\n${url}`);
    notify("تم نسخ رابط الدعوة.");
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try { state.wakeLock = await navigator.wakeLock.request("screen"); } catch {}
  }

  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstall = event;
    installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    installButton.hidden = true;
    notify("تم تثبيت VAREX Call بنجاح.");
  });

  async function installApp() {
    if (deferredInstall) {
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch {}
      deferredInstall = null;
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) installModal.hidden = false;
    else notify("من قائمة المتصفح اختاري: تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.");
  }

  $$("[data-start-call]").forEach(button => button.addEventListener("click", () => startNewCall(button.dataset.startCall)));
  joinButton.addEventListener("click", joinCall);
  roomCode.addEventListener("input", () => { roomCode.value = normalizeCode(roomCode.value); });
  roomCode.addEventListener("keydown", event => { if (event.key === "Enter") joinCall(); });
  displayName.addEventListener("keydown", event => { if (event.key === "Enter" && roomCode.value) joinCall(); });
  $("#shareButton").addEventListener("click", shareInvite);
  $("#copyButton").addEventListener("click", async () => { await copyText(state.roomId); notify("تم نسخ رمز المكالمة."); });
  $("#cancelWaitingButton").addEventListener("click", cancelWaiting);
  $("#hangupButton").addEventListener("click", () => finishCall(false, "انتهت المكالمة"));
  $("#newCallButton").addEventListener("click", resetToHome);
  $("#micButton").addEventListener("click", event => toggleTrack("audio", event.currentTarget));
  $("#cameraButton").addEventListener("click", event => toggleTrack("video", event.currentTarget));
  $("#flipButton").addEventListener("click", flipCamera);
  installButton.addEventListener("click", installApp);
  $$("[data-close-modal]").forEach(button => button.addEventListener("click", () => { installModal.hidden = true; }));

  window.addEventListener("pagehide", () => {
    if (state.active && !state.ending) bestEffortHangup();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.active && !state.wakeLock) requestWakeLock();
  });

  function init() {
    displayName.value = localStorage.getItem("varexCallDisplayName") || "";
    const params = new URLSearchParams(location.search);
    const directCode = normalizeCode(params.get("room"));
    if (directCode.length === 8) {
      roomCode.value = directCode;
      const saved = loadSession(directCode);
      joinButton.textContent = saved ? "العودة" : "انضمام";
      window.setTimeout(() => notify(saved ? "اضغطي العودة لمتابعة المكالمة." : "أضيفي اسمك واضغطي انضمام."), 450);
    }
    const shortcut = params.get("new");
    if (shortcut === "voice" || shortcut === "video") {
      window.setTimeout(() => notify(`اكتبي اسمك ثم اختاري مكالمة ${shortcut === "video" ? "فيديو" : "صوتية"}.`), 450);
    }
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) installButton.hidden = true;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/call/sw.js", { scope: "/call/" }).catch(() => {});
  }

  init();
})();

