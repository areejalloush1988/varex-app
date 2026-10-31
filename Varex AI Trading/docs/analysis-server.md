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
| Paid model and gold data | Not activated. The configured secret names do not include `OPENAI_API_KEY` or `TWELVE_DATA_API_KEY`; no provider keys were added or paid requests made during this rollout. |

The Dashboard showed a current ECC (P-256) Auth signing key and the previous
HS256 key. The frontend sends the user's session JWT in `Authorization` and the
publishable API key in `apikey`. The analysis function's deployed gateway
setting is `verify_jwt=false`; user authentication remains enforced inside the
handler through `auth.getUser(token)` and the active-profile check. The observed
`401` responses above came from that handler. No signing key was rotated as part
of this work.

The frontend can use its descriptive numerical explanation mode independently.
It must never label that local explanation as a generated language-model answer.

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
- `POST ?action=chat`: `{question, context: report}`. A `report` alias is accepted.
  Returns `{answer, mode:"language-model", generated:true, model, asOf,
  evidenceOrigin:"client-provided", sourceVerified:false}`.

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

## Verification limits and provider activation

All three function deployments and both retirement responses are confirmed.
The analysis handler's boot and rejected-session paths were checked; a real
confirmed user's successful HTTP `200` response and a generated AI conversation
were not verified during this rollout. Provider keys remain absent, and no paid
model or gold-data request was made. Its `capabilities` response must remain
truthful while providers are unavailable. Before activating a provider, retain the existing Auth/profile
checks, verified RLS/RPC restrictions, explicit model/data configuration, and
durable caps. Automated tests exercise denied access and quota exhaustion
without provider credentials. No live trading test is needed.

References checked for implementation:

- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/auth-headers
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://twelvedata.com/docs
- https://support.twelvedata.com/en/articles/5745849-timezones
