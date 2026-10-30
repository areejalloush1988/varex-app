/* Trading navigation only. Never cache account data, prices, credentials or orders. */
"use strict";

const OFFLINE_PAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#081D36"><title>VAREX — لا يوجد اتصال</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#081d36;color:#fff;font:16px Arial,Tahoma,sans-serif}main{max-width:480px;padding:32px;text-align:center}b{color:#ffd52a;letter-spacing:.15em}p{line-height:1.9;color:#b0c1d5}a{display:inline-block;margin-top:16px;padding:14px 24px;background:#ffd52a;color:#081d36;border-radius:10px;text-decoration:none;font-weight:bold}</style></head><body><main><b>VAREX TRADING</b><h1>الاتصال بالإنترنت غير متاح</h1><p>اتصل بالإنترنت لعرض حسابك والأسعار الحالية واستخدام التطبيق.</p><a href="/trading/">إعادة المحاولة</a></main></body></html>`;

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate"
    || url.origin !== self.location.origin || !url.pathname.startsWith("/trading/")) return;
  event.respondWith(fetch(request).catch(() => new Response(OFFLINE_PAGE, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })));
});
