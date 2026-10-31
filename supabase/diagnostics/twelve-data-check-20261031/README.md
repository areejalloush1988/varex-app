# Expired diagnostic archive — DO NOT REDEPLOY

This is the audit record of a completed, one-off, private Twelve Data connectivity
check. Treat this archived probe as expired. Do not deploy `index.ts`, extend its
deadline, enable it in the app, or use it as a production endpoint. Its embedded
absolute expiry is **2026-10-31T22:20:00Z**.

## Observed result

The authorized Supabase Dashboard test completed at
**2026-10-31T21:43:25.799Z**. The unchanged sanitized response is retained in
`observed-result.json`.

- `/api_usage`: HTTP 200; plan category `basic`, limit **8 requests/minute** and
  **800 requests/day** as reported by the provider.
- `XAU/USD`, `EUR/USD`, and `AAPL`: each returned HTTP 200 with **three valid,
  closed one-minute candles**. Symbol, interval, time and OHLC structure passed
  the probe's checks. Only counts and the last closed timestamp were retained.
- An unauthorized request returned **401 `operator_auth_required`**.
- No keys, prices, raw provider error messages, or personal account data are
  included in this archive. No OpenAI request was part of this check.

These results establish this credential's access to those sample responses at
the recorded time. They do not establish accuracy, real-time availability,
complete historical coverage, or public display and derived-analysis licensing.
`licenseVerified` and `productionSettingsChanged` both remain `false`.

## Source and checks

`index.ts`, `probe.test.mjs`, and `observed-result.json` are exact copies of the
reviewed diagnostic source, its tests, and the observed sanitized response.
The source is **169 lines / 11,077 bytes**, with SHA-256:

`bf232e8836b6c376b448c0b10d1961f30add80b9852af88c8dceb5b3d5fa3690`

Ten focused local fixture tests passed before the live check. They covered
exact-default-secret authentication, deadline crossings and cancellation,
request restrictions, four sequential fixed provider requests, result caching,
redaction, metadata/OHLC validation, plan validation, and missing configuration.
The warm-isolate cache was not a global one-time execution guarantee.

## Retirement status

The inert replacement at `supabase/functions/varex-data-check/index.ts` was
deployed after the check. A fresh Dashboard POST returned HTTP **410** with
`{"code":"diagnostic_retired","enabled":false}`. This source performs no secret,
database, or provider reads. The temporary function's legacy JWT verification
was then restored to ON and saved in the Dashboard. Existing app functions and
the production market licensing flag were not modified by the probe.
