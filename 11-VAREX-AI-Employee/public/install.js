(() => {
  "use strict";

  const installButton = document.getElementById("installButton");
  const installButtonLabel = installButton.querySelector("span");
  const installStatus = document.getElementById("installStatus");
  const statusLabel = installStatus.querySelector("span:last-child");
  const iosInstructions = document.getElementById("iosInstructions");
  const manualInstructions = document.getElementById("manualInstructions");
  const manualSubtitle = document.getElementById("manualSubtitle");
  const manualCopy = document.getElementById("manualCopy");
  const openAppLink = document.getElementById("openAppLink");
  const userAgent = navigator.userAgent.toLowerCase();
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || isIPadOS;
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios|chrome|android/.test(userAgent);
  const isMacSafari = /macintosh|mac os x/.test(userAgent) && isSafari && !isIOS;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const appUrl = new URL(location.href);
  appUrl.pathname = appUrl.pathname.replace(/\/install(?:\.html)?\/?$/, matchedPath => matchedPath.charAt(0));
  appUrl.search = "?source=install-page";
  appUrl.hash = "";
  openAppLink.href = appUrl.toString();

  let deferredPrompt = null;
  let mode = "checking";

  function setStatus(message, tone = "") {
    statusLabel.textContent = message;
    if (tone) installStatus.dataset.tone = tone;
    else delete installStatus.dataset.tone;
  }

  function configureButton(label, nextMode) {
    installButtonLabel.textContent = label;
    installButton.disabled = false;
    mode = nextMode;
  }

  function showIOSInstructions() {
    iosInstructions.hidden = false;
    manualInstructions.hidden = true;
    iosInstructions.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showManualInstructions() {
    manualInstructions.hidden = false;
    iosInstructions.hidden = true;
    if (isMacSafari) {
      manualSubtitle.textContent = "متاح في Safari على Mac";
      manualCopy.textContent = "من قائمة «ملف» في Safari اختر «إضافة إلى Dock»، ثم أكّد اسم التطبيق.";
    } else {
      manualSubtitle.textContent = "تختلف تسمية الخيار حسب المتصفح";
      manualCopy.textContent = "افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». في Chrome وEdge قد يظهر رمز التثبيت أيضاً بجانب شريط العنوان.";
    }
    manualInstructions.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (error) {
      console.warn("VAREX AI service worker registration failed", error);
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    configureButton("تثبيت التطبيق الآن", "native");
    setStatus("جهازك جاهز. اضغط الزر ليبدأ تثبيت التطبيق الفعلي.", "ready");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    configureButton("فتح VAREX AI", "open");
    setStatus("تم تثبيت VAREX AI بنجاح على جهازك.", "ready");
    setTimeout(() => location.assign(appUrl.toString()), 900);
  });

  installButton.addEventListener("click", async () => {
    if (mode === "open") {
      location.assign(appUrl.toString());
      return;
    }
    if (mode === "ios") {
      showIOSInstructions();
      return;
    }
    if (mode === "manual") {
      showManualInstructions();
      return;
    }
    if (mode !== "native" || !deferredPrompt) return;

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    installButton.disabled = true;
    installButtonLabel.textContent = "فتح نافذة التثبيت…";
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setStatus("جارٍ إكمال تثبيت VAREX AI على جهازك…", "info");
      installButtonLabel.textContent = "جارٍ التثبيت…";
      return;
    }
    configureButton("محاولة التثبيت مرة أخرى", "manual");
    setStatus("لم يتم التثبيت. يمكنك المحاولة مجدداً من قائمة المتصفح.", "error");
  });

  registerServiceWorker();

  if (isStandalone) {
    configureButton("فتح VAREX AI", "open");
    setStatus("التطبيق مثبت بالفعل على هذا الجهاز.", "ready");
  } else if (isIOS) {
    configureButton("عرض خطوات تثبيت iPhone وiPad", "ios");
    setStatus(isSafari ? "ثبّته من زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»." : "افتح الرابط في Safari لإتمام التثبيت كتطبيق.", "info");
    showIOSInstructions();
  } else {
    setTimeout(() => {
      if (mode !== "checking") return;
      configureButton("عرض طريقة التثبيت", "manual");
      setStatus("يمكن تثبيت التطبيق من قائمة المتصفح على هذا الجهاز.", "info");
    }, 1400);
  }
})();
