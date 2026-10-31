# Optional VAREX analysis backend

## Deployment status — 2026-10-31

Authorized Dashboard access to project `eibadfdqzpeigccfdipt` was established
after the initial connector access failure. The following status records live
checks, rather than treating repository changes as deployment evidence:

| Component | Confirmed state |
|---|---|
| Analysis quota table and RPCs | Applied. `varex_analysis_usage_ready()` returned `true` while `current_user` was `service_role`. RLS is enabled, browser table/RPC grants are absent, and the counter table had zero rows after verification. |
| Legacy demo scheduler | Job `varex-trading-demo-24h` (previously job ID `1`) was unscheduled. The matching job count is `0`; runtime row `1` has `scheduler_ready=false` and `job_id=NULL`; enabled bots and leases both count `0`. |
| `varex-analysis-api` | Deployed. The handler returned HTTP `405` for an unsupported method, `401 sign_in_required` for a missing token, and `401 invalid_session` for an invalid dummy token. These checks do not establish a successful authenticated conversation. |
| `varex-trading-api` retirement wrapper | Deployed from commit `19b71bd`, with all six source/configuration files checked against the prepared text. A default legacy POST returned `410 analysis_only`; `GET ?action=access` without a session returned the expected Arabic sign-in error with HTTP `401`. |
| `varex-trading-automation` retirement handler | Deployed from commit `19b71bd`, with all three source/configuration files checked against the prepared text. The Dashboard POST test returned HTTP `410` and `{enabled:false,analysisOnly:true,code:"analysis_only"}` with the expected retirement message. |
| Paid providers at initial deployment | Neither provider key was configured at the initial deployment stage, and no paid request was made then. The later Twelve Data samples and failed OpenAI authentication attempt are recorded separately below. |

The Dashboard showed a current ECC (P-256) Auth signing key and the previous
HS256 key. The frontend sends the user's session JWT in `Authorization` and the
publishable API key in `apikey`. The analysis function's deployed gateway
setting is `verify_jwt=false`; user authentication remains enforced inside the
handler through `auth.getUser(token)` and the active-profile check. The observed
`401` responses above came from that handler. No signing key was rotated as part
of this work.

The frontend can use its descriptive numerical explanation mode independently.
It must never label that local explanation as a generated language-model answer.

## AI configuration — 2026-11-01 (Asia/Dubai)

The user saved `OPENAI_API_KEY`, and its secret name was verified in the
Dashboard. The operator did not display or copy its value into documentation. The
following configuration was saved successfully through the Dashboard and the
corresponding secret names were verified:

| Setting | Saved configuration |
|---|---|
| `OPENAI_API_KEY` | Present; value supplied by the user and not inspected. |
| `OPENAI_MODEL` | `gpt-5.4-mini-2026-03-17` |
| `VAREX_ANALYSIS_AI_ENABLED` | `true` |
| `VAREX_ANALYSIS_USER_DAILY_LIMIT` | `10` |
| `VAREX_ANALYSIS_GLOBAL_DAILY_LIMIT` | `20` |

This configuration step did not test provider credentials. Application sign-in
was not completed for that step, and it made no OpenAI request. The later private
diagnostic below establishes that OpenAI rejected the saved key; it does not
establish model access, billing readiness or a successful real-user conversation.
No application authentication or profile requirement was bypassed. The Twelve
Data key was absent at the configuration step, then saved and tested as recorded
below. The public market licensing flag remains disabled.

The update date above uses Asia/Dubai. Quota accounting still uses UTC days.

## Twelve Data verification — 2026-11-01 (Asia/Dubai)

The user saved `TWELVE_DATA_API_KEY`. Its name was confirmed in the Dashboard
without reading the value. A separate operator-only diagnostic made four fixed
requests at `2026-10-31T21:43:25.799Z`: one `/api_usage` check and three sample
`time_series` requests. All four received HTTP `200`.

| Check | Observed result |
|---|---|
| Plan | `basic`, 8 API credits/minute and 800/day, as returned by the provider. |
| `XAU/USD` | Three structurally valid closed `1min` candles. |
| `EUR/USD` | Three structurally valid closed `1min` candles. |
| `AAPL` | Three structurally valid closed `1min` candles. |

This establishes key validity and access to these samples at the recorded time.
It does not establish independent price accuracy, real-time coverage, all other
symbols/intervals, public display rights, or an end-to-end app conversation.
`VAREX_MARKET_DATA_LICENSED` remains absent. The public market endpoint still
supports only `XAU-USD`; the EUR/USD and AAPL checks did not add app markets.
No OpenAI request, subscription purchase, or main-app authentication change was
part of this verification.

The diagnostic required the exact default server secret on `apikey` and rejected
an unauthorized invocation with HTTP `401 operator_auth_required`. It was then
replaced by the inert `varex-data-check` handler, whose live POST returned HTTP
`410` with `diagnostic_retired` and `enabled:false`. Legacy JWT verification was
restored to ON for that retired diagnostic only. The archived source, ten
passing fixture tests, and sanitized provider result are retained under
`supabase/diagnostics/twelve-data-check-20261031/`. Do not redeploy the archived
probe or treat the saved Basic key as a commercial display license.

## OpenAI verification — 2026-11-01 (Asia/Dubai)

A separate operator diagnostic completed at **2026-10-31T22:01:35.948Z**. The
unchanged sanitized response is retained in
[`observed-result.json`](../../supabase/diagnostics/ai-check-20261031/observed-result.json),
with the exact source and twelve passing fixture tests in the
[diagnostic archive](../../supabase/diagnostics/ai-check-20261031/README.md).

| Check | Observed result |
|---|---|
| Configuration | `aiEnabled`, `keyPresent`, `keyFormatValid` and `modelMatches` were all `true`; expected model was `gpt-5.4-mini-2026-03-17`. The format check only detects missing/whitespace/oversized keys; it does not validate a provider credential. |
| Quota readiness | Read-only `varex_analysis_usage_ready` returned HTTP `200` and literal `true`. |
| OpenAI request | One fixed Responses request was attempted; provider HTTP **`401`**, allowlisted provider code **`invalid_api_key`**, classification `authentication_rejected`. |
| Generated output | `completed:false`, `outputTextPresent:false`, zero text items and zero text characters; no generated answer. |
| Production changes | `productionSettingsChanged:false`, `quotaWrites:false`. |

The diagnostic's single provider attempt used the fixed educational question
“ما معنى مؤشر RSI؟”, `max_output_tokens:128`, `store:false`, no tools or user
data, a 15-second request deadline, and bounded response bodies. This was an
attempt to call the potentially billable Responses endpoint, not evidence of a
charged generation. The provider rejected authentication. It is **not a billing,
insufficient-quota or model-availability finding**; those conditions remain
unverified.

The probe required the exact default server secret in `apikey`; it accepted no
user-token substitution and did not create, impersonate or bypass an app user or
session. Its only database operation checked quota readiness; it did not call
the quota-reservation RPC or change production quotas. This separate operator
path was not added to the app and does not relax the normal authenticated chat
contract. A warm-isolate result cache limited duplicates within that isolate;
it was not a global once-only spending guarantee. The operator made one attempt.

The user must replace **`OPENAI_API_KEY`** with a valid key directly in the
authorized project's **Edge Function Secrets**. Never copy its value into this
repository, the frontend, chat or the diagnostic result. A later successful
authenticated request is still required before describing generative answers
as working.

**Retirement confirmed:** the exact inert replacement at
`supabase/functions/varex-ai-check/index.ts` was deployed, and a fresh Dashboard
POST returned HTTP `410` with
`{"code":"diagnostic_retired","enabled":false}`. It reads no secrets or data.
Legacy JWT verification was then restored to ON and saved for that retired
diagnostic only; the main analysis function's gateway setting was unchanged.
The archived probe's absolute deadline is `2026-10-31T22:45:00Z`; do not redeploy
it or extend that deadline.

## Frontend changes in this release

The frontend no longer treats missing candle data as a reason to block
an available language-model request. It sends `context:null` for educational
questions without a valid report and labels any resulting answer as having no
current market context. A locally calculated fallback remains explicitly local;
it is never relabelled as an OpenAI answer.

The analysis handler change translates HTTP `401` from the fixed OpenAI
Responses URL into **HTTP `503 ai_provider_auth_failed`**, with a fixed Arabic
message requiring the developer to update the provider key. It does not expose
the provider error body, and it does not treat that service failure as an
expired app login. All JWT, confirmed-email, active-profile and durable-quota
checks remain in place. Successful frontend fixture responses test the code
path; they do not override the live `invalid_api_key` result.

Both `trading/index.html` and `Varex AI Trading/index.html` load
`analysis-app.js?v=2`. The Trading service worker does not cache scripts or
account pages; no root-worker cache change is required. Once these files are
published, a fresh page load is required to execute the new script. Confirm
public frontend publication through the GitHub Pages run for the release commit
and the served asset; local source and fixture tests do not claim publication.

**Backend update confirmed:** the deployed `varex-analysis-api` source was
reloaded from the Dashboard and matched the local file exactly: **26,530 bytes**,
SHA-256
`208d54a46c9ca4b3b7f4dfd5e95baa4095b4ad1922fa7b1a106d7f2c50e142f6`.
A fresh POST with no action returned `405 method_not_allowed`; a subsequent
`POST ?action=chat` without a user JWT returned `401 sign_in_required`.
All **20 backend fixture tests passed**, including the safe `503` provider-auth
mapping and unchanged app authentication, profile and quota checks. The `503`
mapping was verified with fixtures, not by repeating the paid provider attempt.
No successful authenticated real-user chat was tested: the saved provider key
was rejected, and no live user login was completed for this verification.

## Endpoint contract

The Edge Function is `varex-analysis-api`. Every actual request requires a valid
Supabase user JWT, confirmed nonanonymous email, and an existing active matching
row in `varex_trading_profile`. `developer`, `trader`, and `viewer` are accepted;
the existing developer email restriction remains enforced.

Only the application and its GitHub Pages origin are allowed by CORS. This
handler does not provision profiles, read broker secrets, fetch account balances,
execute orders, or change trading/automation records.

- `GET ?action=capabilities`: `{languageModelAvailable, marketDataAvailable, model}`.
- `GET ?action=market&symbol=XAU-USD&interval=60`: a **flat** gold OHLC dataset,
  including symbol, interval, source, sourceUrl, timestamps and provenance.
- `POST ?action=chat`: `{question, context: report | null}`. A `report` alias is accepted.
  Returns `{answer, mode:"language-model", generated:true, model, asOf,
  evidenceOrigin:"client-provided", sourceVerified:false}`.

Null or omitted context supports an educational question without market data;
the normalized context is `available:false`, and the response `asOf` is `null`.
It is not a request to invent candles, current prices or verified market facts.

Chat requests are capped at 32 KiB and questions at 1,000 characters. Only an
allowlisted numerical subset of the report enters model context. Prose, source
labels/URLs, client instructions and client verification claims are ignored.
The numeric context is **not authenticated market evidence**: the model is
instructed to explain it as client-provided data, not a verified live quotation.
There is no model browsing, external URL tool, conversation-ID state, or prompt
history storage in the application database.

## Explicit activation

Set secrets only on the authorized Supabase project; never in the repository,
frontend, HTML, browser storage or public build variables.

Language-model configuration:

- `OPENAI_API_KEY`: the project API key.
- `OPENAI_MODEL`: an explicitly chosen available Responses API model; no default
  is selected and no paid API calls are made merely by supplying a key.
- `VAREX_ANALYSIS_AI_ENABLED=true`: explicit activation after approving usage.

Gold configuration:

- `TWELVE_DATA_API_KEY`.
- `VAREX_MARKET_DATA_LICENSED=true`: set only after verifying the provider plan
  permits the intended public display and derived analysis. This flag is an
  operator attestation, not a substitute for a provider agreement.

`SUPABASE_URL` and the project's standard server key environment provide server
authentication. Modern `SUPABASE_SECRET_KEYS` and the legacy
`SUPABASE_SERVICE_ROLE_KEY` are supported; these never leave the server.

## Durable cost protection

`supabase/setup/varex-analysis-usage.sql` was applied to the existing project on
2026-10-31 through the authorized SQL Editor. The exact operator transaction is
retained at
[`supabase/setup/records/2026-10-31-varex-analysis-deployment.sql`](../../supabase/setup/records/2026-10-31-varex-analysis-deployment.sql).
It is 4,388 characters / 97 lines, with SHA-256
`cad3775032dd664f887f554fa2e92977b632b1b0eb5be247f182f28a9638b8fb`.
The quota definitions match the canonical setup file after removing comments
and whitespace. The added transaction prefix retires only the verified demo
job and resets its bot runtime; trading history and account records are retained.
The record is an audit artifact, not a new migration to replay automatically.
No synthetic migration timestamp or migration-history entry was created.

It creates one RLS-protected counter table and two `SECURITY INVOKER` RPCs,
callable only by `service_role`. No browser role can read or update quota rows.
The database clock selects the UTC quota day; the transport `p_now` cannot move
requests into another day. A transaction advisory lock serializes user/global
increments. Defaults/hard ceilings are **20 requests per user per UTC day** and
**200 across the service per UTC day**, shared by uncached gold fetches and AI.

The server can lower limits using `VAREX_ANALYSIS_USER_DAILY_LIMIT` and
`VAREX_ANALYSIS_GLOBAL_DAILY_LIMIT`; values over the hard ceiling fail closed.
The saved operating limits from the 2026-11-01 configuration update are
**10 requests per user and 20 across the service per UTC day**. The SQL hard
ceilings remain unchanged at 20 and 200 respectively.
Counters count attempted paid requests even if a provider subsequently fails.
This is a request cap, not a guaranteed currency spend cap: configure provider
billing limits and select a model appropriate to the approved budget.

If quota setup or permissions are missing, capability flags remain false and
requests fail before contacting a paid provider. No in-memory fallback bypasses
quota protection. Gold results may be reused from a short 60-second isolate
cache; provider failures never produce a synthetic success result.

## Data and model behavior

The gold endpoint calls only the fixed Twelve Data `time_series` URL with the
fixed XAU/USD symbol and an allowlisted interval. It validates instrument,
interval, timezone metadata when present, OHLC consistency, duplicate conflicts,
future timestamps and candle boundaries. Forex timestamps are UTC by the
documented request contract. Incomplete candles are removed. Missing periods are
not filled. Feed delay is returned as `null` (unknown), not claimed real time.
The result preserves Twelve Data attribution; raw export is disabled.

The language model calls only the fixed OpenAI Responses endpoint, with
`max_output_tokens:900` and `store:false`. This setting disables Responses API
application-state storage; it is not a blanket zero-retention promise about the
provider's policies. Both providers have a 15-second timeout and bounded bodies.
Errors returned to the browser are generic and never include keys, request URLs,
authorization headers, upstream bodies or SQL errors.
The follow-up described above gives an OpenAI authentication rejection the safe
service-level code `ai_provider_auth_failed`; it does not return the upstream
HTTP `401` to the browser as if the user's session had failed.

## Verification limits and provider activation

The initial three application function deployments, both legacy trading
retirement responses and both provider diagnostic retirements are confirmed.
The AI diagnostic's legacy JWT verification is back ON. The analysis backend
update's persisted-source match and rejected-session checks are confirmed in the
release section above; public frontend publication is verified separately by
its Pages run and served asset.
The initial analysis handler's boot and rejected-session paths were checked.
A successful real-user generated conversation has not been verified.

The live OpenAI attempt returned `401 invalid_api_key`; the saved key requires
replacement. Model access and billing remain unverified, and no generated
answer was received. The Twelve Data key returned the documented sample
responses, but `VAREX_MARKET_DATA_LICENSED` remains unset and public gold data
is not activated. These two diagnostic checks do not establish an end-to-end
app conversation.

The `capabilities` route checks configuration and quota readiness; it does not
test provider credentials or billing. Retain the existing Auth/profile checks,
verified RLS/RPC restrictions, explicit model/data configuration and durable
caps. The separate one-off operator probe made no quota writes; ordinary
authenticated paid requests still reserve a durable quota slot before calling
the provider, including attempts rejected by it. Automated tests use fixtures
and never a provider key. No live trading test is needed.

References checked for implementation:

- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/secrets
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://twelvedata.com/docs
- https://support.twelvedata.com/en/articles/5745849-timezones
