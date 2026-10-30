import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const installScript = fs.readFileSync(new URL("../install.js", import.meta.url), "utf8");
const workerScript = fs.readFileSync(new URL("../../trading/sw.js", import.meta.url), "utf8");
const tradingDirectory = new URL("../../trading/", import.meta.url);

function workerHarness(fetchResult = async () => new Response("online")) {
  const handlers = new Map(), requests = [];
  let claims = 0;
  const context = vm.createContext({
    URL, Response,
    self: {
      location: { origin: "https://app.varexapp.com" },
      clients: { claim: async () => { claims += 1; } },
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
    fetch: async (request) => { requests.push(request); return fetchResult(request); },
  });
  Object.defineProperty(context, "caches", { get() { throw new Error("The trading worker must not access any cache."); } });
  vm.runInContext(workerScript, context);
  return {
    requests,
    dispatch(request) {
      let response;
      handlers.get("fetch")({ request, respondWith(value) { response = value; } });
      return response;
    },
    async activate() {
      let activation;
      handlers.get("activate")({ waitUntil(value) { activation = value; } });
      await activation;
      return claims;
    },
  };
}

function request(path, method = "GET", mode = "navigate") {
  return { url: new URL(path, "https://app.varexapp.com").href, method, mode };
}

function element() {
  return { hidden: false, disabled: false, textContent: "", scrolled: false,
    scrollIntoView() { this.scrolled = true; } };
}

function installHarness({
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  touchPoints = 0, standalone = false, iosStandalone = false,
  secure = true, registrationFails = false, supportsWorker = true,
} = {}) {
  const windowEvents = new Map(), documentEvents = new Map(), registrations = [];
  const installButtons = [element(), element()], installLinks = [element(), element()];
  const status = element(), help = element();
  const media = { matches: standalone, addEventListener(name, callback) { this.change = callback; } };
  const navigator = { userAgent, maxTouchPoints: touchPoints, standalone: iosStandalone };
  if (supportsWorker) navigator.serviceWorker = {
    register: (url, options) => {
      registrations.push({ url, ...JSON.parse(JSON.stringify(options)) });
      return registrationFails ? Promise.reject(new Error("worker denied")) : Promise.resolve({});
    },
  };
  const document = {
    readyState: "complete",
    querySelectorAll(selector) {
      if (selector === "[data-install-button]") return installButtons;
      if (selector === "[data-install-link]") return installLinks;
      throw new Error(`Unexpected document query: ${selector}`);
    },
    getElementById: (id) => id === "installStatus" ? status : id === "installHelp" ? help : null,
    addEventListener: (name, handler) => documentEvents.set(name, handler),
  };
  const window = {
    isSecureContext: secure,
    matchMedia: (query) => { assert.equal(query, "(display-mode: standalone)"); return media; },
    addEventListener: (name, handler) => windowEvents.set(name, handler),
  };
  vm.runInNewContext(installScript, { document, window, navigator });
  return {
    buttons: installButtons, links: installLinks, status, help, registrations,
    emit: (name, event = {}) => windowEvents.get(name)?.(event),
    click: (targetIsInstallButton = true) => documentEvents.get("click")({
      target: { closest: (selector) => targetIsInstallButton && selector === "[data-install-button]" ? installButtons[0] : null },
    }),
    mediaChange(value) { media.matches = value; media.change?.({ matches: value }); },
  };
}

function pendingPrompt() {
  let resolve, reject;
  const event = {
    calls: 0, prevented: false,
    preventDefault() { this.prevented = true; },
    prompt() { this.calls += 1; return Promise.resolve(); },
    userChoice: new Promise((accept, fail) => { resolve = accept; reject = fail; }),
  };
  return { event, resolve, reject };
}

test("worker leaves API reads, API mutations, cross-origin requests and static resources untouched", () => {
  const h = workerHarness();
  const requests = [
    request("/api/trading?action=markets", "GET", "cors"),
    request("/api/auth/get-session", "GET", "navigate"),
    request("/api/trading", "POST", "cors"),
    request("/trading/", "POST", "navigate"),
    request("/trading/", "HEAD", "navigate"),
    request("https://eibadfdqzpeigccfdipt.supabase.co/auth/v1/token", "POST", "cors"),
    request("https://eibadfdqzpeigccfdipt.supabase.co/functions/v1/varex-trading-api", "GET", "cors"),
    request("https://example.test/trading/", "GET", "navigate"),
    request("/Varex%20AI%20Trading/app.js?v=9", "GET", "cors"),
    request("/trading/manifest.webmanifest", "GET", "cors"),
    request("/cashier/", "GET", "navigate"),
    request("/trading-unrelated/", "GET", "navigate"),
  ];
  for (const incoming of requests) assert.equal(h.dispatch(incoming), undefined, incoming.url);
  assert.equal(h.requests.length, 0);
});

test("worker returns the actual online navigation response, including HTTP errors", async () => {
  for (const status of [200, 503]) {
    const actual = new Response("server response", { status, headers: { "X-Origin": "server" } });
    const h = workerHarness(async () => actual), incoming = request("/trading/install.html");
    const response = await h.dispatch(incoming);
    assert.equal(response, actual);
    assert.equal(h.requests[0], incoming);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("X-Origin"), "server");
  }
});

test("offline navigation returns an uncached 503 explanation and never a stale account screen", async () => {
  const h = workerHarness(async () => { throw new TypeError("offline"); });
  const response = await h.dispatch(request("/trading/"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(response.headers.get("Content-Type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /الاتصال بالإنترنت غير متاح/);
  assert.match(html, /href="\/trading\/"/);
  assert.doesNotMatch(html, /الرصيد الورقي|access_token|refresh_token|name="password"/);
  assert.equal(await h.activate(), 1, "Activation only claims Trading clients; it does not delete other app caches.");
});

test("installation event is deferred until the user clicks the installation control", async () => {
  const h = installHarness(), { event, resolve } = pendingPrompt();
  h.emit("beforeinstallprompt", event);
  assert.equal(event.prevented, true);
  assert.equal(event.calls, 0, "Discovering installability must not display a prompt on its own.");
  await h.click(false);
  assert.equal(event.calls, 0);
  const click = h.click();
  assert.equal(event.calls, 1);
  assert.ok(h.buttons.every((button) => button.disabled));
  await h.click();
  assert.equal(event.calls, 1, "Repeated clicks while the browser prompt is open are ignored.");
  resolve({ outcome: "dismissed" });
  await click;
  assert.ok(h.buttons.every((button) => !button.disabled));
  assert.match(h.status.textContent, /لم يتم التثبيت/);
  assert.ok(h.buttons.every((button) => !button.hidden));
  await h.click();
  assert.equal(event.calls, 1, "A dismissed one-shot browser prompt cannot be reused.");
  assert.equal(h.help.scrolled, true);
});

test("accepting a prompt alone does not claim the app has finished installing", async () => {
  const h = installHarness(), { event, resolve } = pendingPrompt();
  h.emit("beforeinstallprompt", event);
  const click = h.click();
  resolve({ outcome: "accepted" });
  await click;
  assert.match(h.status.textContent, /قبول طلب التثبيت/);
  assert.doesNotMatch(h.status.textContent, /^تم تثبيت/);
});

test("confirmed appinstalled wins over a late prompt result and keeps all install controls hidden", async () => {
  const h = installHarness(), { event, resolve } = pendingPrompt();
  h.emit("beforeinstallprompt", event);
  const click = h.click();
  h.emit("appinstalled");
  resolve({ outcome: "accepted" });
  await click;
  assert.match(h.status.textContent, /^تم تثبيت/);
  assert.ok([...h.buttons, ...h.links].every((control) => control.hidden));
  h.mediaChange(false);
  assert.ok([...h.buttons, ...h.links].every((control) => control.hidden));
  assert.match(h.status.textContent, /^تم تثبيت/);
});

test("failed browser prompt displays manual steps without claiming installation or disabling controls", async () => {
  const h = installHarness();
  h.emit("beforeinstallprompt", {
    preventDefault() {},
    prompt: async () => { throw new Error("prompt unavailable"); },
  });
  await h.click();
  assert.match(h.status.textContent, /Edge/);
  assert.equal(h.help.scrolled, true);
  assert.ok(h.buttons.every((button) => !button.disabled && !button.hidden));
});

test("iPhone and iPad desktop user agents get Safari instructions instead of an unsupported install prompt", async () => {
  for (const options of [
    { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
    { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", touchPoints: 5 },
  ]) {
    const h = installHarness(options), { event } = pendingPrompt();
    h.emit("beforeinstallprompt", event);
    await h.click();
    assert.equal(event.calls, 0);
    assert.match(h.status.textContent, /Safari/);
    assert.match(h.status.textContent, /إضافة إلى الشاشة الرئيسية/);
    assert.equal(h.help.scrolled, true);
  }
});

test("standalone browser and iPhone app windows hide redundant install links and buttons", () => {
  for (const options of [{ standalone: true }, { iosStandalone: true }]) {
    const h = installHarness(options);
    assert.ok([...h.buttons, ...h.links].every((control) => control.hidden));
    assert.match(h.status.textContent, /نافذة مستقلة/);
  }
});

test("worker registration is scoped to Trading, skips insecure browsers and degrades gracefully", async () => {
  const h = installHarness();
  assert.deepEqual(h.registrations, [{ url: "/trading/sw.js", scope: "/trading/", updateViaCache: "none" }]);
  assert.deepEqual(installHarness({ secure: false }).registrations, []);
  assert.deepEqual(installHarness({ supportsWorker: false }).registrations, []);
  const denied = installHarness({ registrationFails: true });
  await Promise.resolve();
  await denied.click();
  assert.equal(denied.help.scrolled, true, "Installation guidance remains usable when registration is denied.");
});

test("manifest launches the Trading account screen and all install icon dimensions match their metadata", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("manifest.webmanifest", tradingDirectory), "utf8"));
  const origin = "https://app.varexapp.com";
  const scope = new URL(manifest.scope, origin), start = new URL(manifest.start_url, origin);
  assert.equal(start.pathname, "/trading/", "An installed app should not launch the install guide or the unrelated business suite.");
  assert.ok(start.href.startsWith(scope.href));
  assert.equal(manifest.id, "/trading/");
  assert.equal(manifest.display, "standalone");
  assert.notEqual(manifest.prefer_related_applications, true);
  const readPngSize = (url) => {
    const bytes = fs.readFileSync(url);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
  };
  for (const icon of manifest.icons) assert.equal(readPngSize(new URL(icon.src, tradingDirectory)), icon.sizes);
  for (const size of ["192x192", "512x512"]) assert.ok(manifest.icons.some((icon) => icon.sizes === size));
  assert.equal(readPngSize(new URL("icons/apple-touch-icon.png", tradingDirectory)), "180x180");
});
