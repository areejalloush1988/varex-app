(() => {
  "use strict";

  let deferredPrompt = null;
  let installing = false;
  let installationConfirmed = false;
  const standaloneMedia = window.matchMedia("(display-mode: standalone)");
  const isStandalone = () => standaloneMedia.matches || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const buttons = () => [...document.querySelectorAll("[data-install-button]")];
  const status = (text) => {
    const element = document.getElementById("installStatus");
    if (element) element.textContent = text;
  };

  function updateInstallState() {
    const installed = installationConfirmed || isStandalone();
    document.querySelectorAll("[data-install-link]").forEach((link) => {
      link.hidden = installed;
    });
    buttons().forEach((button) => {
      button.hidden = installed;
      button.disabled = installing;
      button.textContent = isIOS ? "عرض خطوات التثبيت على الآيفون"
        : deferredPrompt ? "تثبيت VAREX Trading" : "تثبيت التطبيق على هذا الجهاز";
    });
    if (installationConfirmed) status("تم تثبيت VAREX Trading. افتحه من أيقونته على جهازك.");
    else if (installed) status("التطبيق مفتوح الآن بنافذة مستقلة. يمكنك استخدامه من أيقونته على جهازك.");
    else if (deferredPrompt) status("التطبيق جاهز للتثبيت. اضغط زر التثبيت للمتابعة.");
    else if (isIOS) status("على الآيفون: افتح الصفحة في Safari، ثم المشاركة ← إضافة إلى الشاشة الرئيسية.");
    else status("إذا لم يظهر طلب التثبيت، استخدم أيقونة التثبيت بجانب العنوان أو خطوات المتصفح أدناه.");
  }

  function showInstallHelp() {
    const help = document.getElementById("installHelp");
    if (help) {
      help.hidden = false;
      help.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    status(isIOS
      ? "في Safari اضغط المشاركة، ثم إضافة إلى الشاشة الرئيسية، وفعّل فتح كتطبيق ويب إذا ظهر، ثم إضافة."
      : "في Edge: القائمة (…) ← المزيد من الأدوات ← التطبيقات ← تثبيت هذا الموقع كتطبيق. أو استخدم أيقونة التثبيت في شريط العنوان.");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallState();
  });
  window.addEventListener("appinstalled", () => {
    installationConfirmed = true;
    deferredPrompt = null;
    installing = false;
    updateInstallState();
    status("تم تثبيت VAREX Trading. افتحه من أيقونته على جهازك.");
    buttons().forEach((button) => { button.hidden = true; });
  });
  standaloneMedia.addEventListener?.("change", updateInstallState);

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-install-button]");
    if (!button || installing) return;
    if (!deferredPrompt || isIOS) return showInstallHelp();
    const prompt = deferredPrompt;
    deferredPrompt = null;
    installing = true;
    buttons().forEach((item) => { item.disabled = true; });
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (!installationConfirmed) status(choice.outcome === "accepted"
        ? "تم قبول طلب التثبيت. أكمل أي خطوات يعرضها المتصفح."
        : "لم يتم التثبيت. يمكنك المحاولة لاحقاً من قائمة المتصفح.");
    } catch {
      if (!installationConfirmed) showInstallHelp();
    } finally {
      installing = false;
      buttons().forEach((item) => { item.disabled = false; });
    }
  });

  function initialize() {
    updateInstallState();
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/trading/sw.js", {
        scope: "/trading/", updateViaCache: "none",
      }).catch(() => {
        // Browser installation and normal online use remain available.
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
