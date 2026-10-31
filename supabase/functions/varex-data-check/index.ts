// Temporary provider verification completed on 2026-10-31 UTC.
// Retained as an inert endpoint; no secrets, database, or provider calls.
Deno.serve(() => new Response(JSON.stringify({
  code: "diagnostic_retired",
  enabled: false,
}), {
  status: 410,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
}));
