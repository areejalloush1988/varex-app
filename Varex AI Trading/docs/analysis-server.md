# Optional VAREX analysis backend

## Status

The function and quota setup are prepared in the repository. **No schema setup,
provider activation, or function deployment was performed by this change.**
The connected Supabase account currently exposes no projects and denied access
to the existing VAREX project. Reconnect the account authorized for that project
before applying setup or deploying. No credentials or permissions were bypassed.

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

Review and apply `supabase/setup/varex-analysis-usage.sql` through the authorized
project's normal database administration process. It is an explicitly labelled
manual setup draft, not a timestamped migration or an already-applied change.
Before production rollout, record it in the project's normal migration history.

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

## Verification before activation

Run the handler's dependency-injected tests and the core/data/UI tests. Then,
with authorized project access, inspect the schema and apply setup, check RLS and
RPC permissions, deploy with JWT verification, and verify an authenticated test
account. Check denied access for unconfirmed/inactive users, missing quotas, and
quota exhaustion before enabling paid providers. No live trading test is needed.

References checked for implementation:

- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/auth
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://twelvedata.com/docs
- https://support.twelvedata.com/en/articles/5745849-timezones
