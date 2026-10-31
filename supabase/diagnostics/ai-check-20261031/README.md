# Archived OpenAI diagnostic — DO NOT REDEPLOY

This is the audit record of one authorized operator check of the saved OpenAI
configuration. It is not an application endpoint. Do not deploy `index.ts`,
extend its embedded absolute deadline **2026-10-31T22:45:00Z**, or use it to
replace the application's authentication and quota checks.

## Observed result

The Supabase Dashboard operator check completed at
**2026-10-31T22:01:35.948Z** (2026-11-01 in Asia/Dubai). The unchanged sanitized
response is retained in `observed-result.json`.

| Check | Observed result |
|---|---|
| Configuration | `aiEnabled:true`, `keyPresent:true`, `keyFormatValid:true`, `modelMatches:true`; expected model `gpt-5.4-mini-2026-03-17`. |
| Quota readiness | HTTP `200`, literal `true`, classification `quota_ready`. |
| Provider attempt | `attempted:true`, HTTP **`401`**, code **`invalid_api_key`**, classification `authentication_rejected`. |
| Generated answer | None: `completed:false`, `outputTextPresent:false`, zero text items and characters. |
| Changes | `productionSettingsChanged:false`, `quotaWrites:false`. |

The key format check confirms only a present value without surrounding
whitespace/newlines and within the length bound. OpenAI rejected that saved
credential. This is not an `insufficient_quota`, billing or model-access
diagnosis, and it does not establish a successful generated answer. The user
must replace `OPENAI_API_KEY` with a valid key securely in Supabase Edge Function
Secrets; its value must not be placed in code, chat or this audit record.

## Bounds and access

The operator made **one fixed provider attempt** to the potentially billable
OpenAI Responses endpoint after the read-only quota-readiness check. The fixed
question was “ما معنى مؤشر RSI؟”, with `max_output_tokens:128`, `store:false`,
no tools and no user data. Each external request was limited to 15 seconds,
with a 65,536-byte response limit and an absolute diagnostic expiry. The
authentication failure is not evidence that a generation was billed.

The probe accepted only the exact default server secret in the `apikey` header.
User JWTs, alternate secrets, Bearer substitutions, query parameters and
caller-controlled prompts, models or URLs were rejected. It did not create or
impersonate users, bypass an app session, modify production settings or reserve
quota. The readiness RPC was its only database request. Ordinary app requests
retain their authenticated profile checks and durable quota reservation.

The one-result cache applied only to a warm isolate; it was not a global
one-time billing limiter. The source and archive contain no real credential,
raw provider error text or private user data. Synthetic fixture keys in the
tests are deliberately nonfunctional.

## Exact source and verification

`index.ts` and `probe.test.mjs` are byte-for-byte copies of the reviewed
diagnostic files. `observed-result.json` is an exact copy of the captured
sanitized response, not a reconstructed result.

| File | Bytes | SHA-256 |
|---|---:|---|
| `index.ts` | 10,850 | `ef0da9acce85755a78d992798e4c1ffbf4e82f98d9573057307a406b38e351bf` |
| `probe.test.mjs` | 11,088 | `653c6cf0d5a548de4907c00455fcc2c9657d732bab35132506f6aa36c1260e3f` |
| `observed-result.json` | 783 | `a626d570a0c7c154707b46064e2c9fb0594f7317f8c7dc492f115fdbb1231c8e` |

Twelve focused fixture tests pass with Node.js 24:

```bash
node --test --test-isolation=none --test-reporter=spec probe.test.mjs
```

They cover exact operator authentication, fixed sequential requests and warm
isolate reuse, invalid configuration, readiness failure, safe error-code
classification, incomplete/refused answers, output redaction, request and body
restrictions, exceptions, expiry races and cancellation. They never send a live
provider request or use a real key. A synthetic successful answer in these
tests is not evidence of live provider success.

## Retirement status — HTTP 410 confirmed

The exact replacement at `supabase/functions/varex-ai-check/index.ts` was
deployed. A fresh Dashboard POST returned HTTP **410** with
`{"code":"diagnostic_retired","enabled":false}`. The handler reads no
environment variables, secrets, database records or provider data. The
replacement is the only deployable source for that function. Legacy JWT
verification was then restored to ON and saved for this retired diagnostic
only; no production app authentication setting was changed by its retirement.
