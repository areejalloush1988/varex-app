(() => {
  "use strict";

  const printerButton = document.getElementById("printerButton");
  const barcodeButton = document.getElementById("barcodeReaderButton");
  let barcodeBuffer = "";
  let lastKeyAt = 0;
  let clearTimer = 0;

  function flashReady(button) {
    if (!button) return;
    button.classList.add("device-ready");
    window.setTimeout(() => button.classList.remove("device-ready"), 1400);
  }

  printerButton?.addEventListener("click", () => {
    flashReady(printerButton);
    if (window.VarexPharmacyDevices?.printCurrent) window.VarexPharmacyDevices.printCurrent();
    else window.print();
  });

  barcodeButton?.addEventListener("click", () => {
    flashReady(barcodeButton);
    window.VarexPharmacyDevices?.openBarcodeReader?.();
  });

  // أغلب قارئات الباركود تعمل كلوحة مفاتيح وتنهي القراءة بزر Enter.
  document.addEventListener("keydown", event => {
    const target = event.target;
    const isFormControl = target instanceof HTMLElement && (
      target.matches("input,textarea,select") || target.isContentEditable
    );
    if (isFormControl || event.ctrlKey || event.altKey || event.metaKey) return;

    const now = performance.now();
    if (now - lastKeyAt > 120) barcodeBuffer = "";
    lastKeyAt = now;

    if (event.key === "Enter") {
      const scanned = barcodeBuffer.trim();
      barcodeBuffer = "";
      if (scanned.length >= 4) {
        event.preventDefault();
        flashReady(barcodeButton);
        window.VarexPharmacyDevices?.openBarcodeReader?.(scanned);
      }
      return;
    }

    if (event.key.length === 1 && /[\dA-Za-z._-]/.test(event.key)) {
      barcodeBuffer += event.key;
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => { barcodeBuffer = ""; }, 180);
    }
  });
})();
