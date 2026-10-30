(() => {
  "use strict";
  const api = window.VarexAccounts;
  const choices = document.getElementById("vaAccountChoices");
  const directory = document.getElementById("vaAccountDirectory");
  const disclosure = document.getElementById("vaPlatformDisclosure");
  if (!api || !choices || !directory || !disclosure) return;
  let selectedId = "capital", query = "";

  choices.innerHTML = api.renderChoices({ demoBalance: 25000, active: "demo", canConnect: true });
  const demoButton = choices.querySelector('[data-account-choice="demo"]');
  if (demoButton) {
    const link = document.createElement("a");
    link.className = demoButton.className;
    link.href = "/trading/?account=demo";
    link.dataset.accountChoice = "demo";
    link.textContent = demoButton.textContent;
    demoButton.replaceWith(link);
  }
  const connectChoice = choices.querySelector('[data-account-choice="connect"]');
  connectChoice?.setAttribute("aria-controls", "vaPlatformDisclosure");
  connectChoice?.setAttribute("aria-expanded", "false");
  connectChoice?.addEventListener("click", () => {
    disclosure.open = true;
    disclosure.scrollIntoView({ behavior: "smooth", block: "start" });
    directory.querySelector("[data-broker-search]")?.focus({ preventScroll: true });
  });
  disclosure.addEventListener("toggle", () => connectChoice?.setAttribute("aria-expanded", String(disclosure.open)));

  function renderDirectory(focusSearch = false, selection = null) {
    directory.innerHTML = api.renderDirectory({ selectedId, query, currentProvider: "" });
    if (focusSearch) {
      const input = directory.querySelector("[data-broker-search]");
      input?.focus({ preventScroll: true });
      if (selection && input?.setSelectionRange) input.setSelectionRange(...selection);
    }
  }
  directory.addEventListener("input", (event) => {
    if (!event.target.matches?.("[data-broker-search]")) return;
    query = event.target.value;
    renderDirectory(true, [event.target.selectionStart, event.target.selectionEnd]);
  });
  directory.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-broker-provider]");
    if (!button || !api.getProvider(button.dataset.brokerProvider)) return;
    selectedId = button.dataset.brokerProvider;
    renderDirectory();
    directory.querySelector('[data-broker-provider="' + selectedId + '"]')?.focus({ preventScroll: true });
  });
  renderDirectory();
})();
