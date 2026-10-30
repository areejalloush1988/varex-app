# Capital.com account monitoring

VAREX can connect one existing Capital.com account per VAREX user and display its balance and open positions. Demo is the default environment. The internal VAREX paper account remains separate and is not funded from a broker account.

Capital.com execution is **not implemented**. Both the application handler and PostgreSQL prevent Capital connections from enabling live execution or reserving Binance orders. Existing Binance Spot execution still requires its existing explicit enable step, limits, permissions checks, and manual order confirmation.

## Official API and permissions

The implementation follows the [Capital.com official API documentation](https://open-api.capital.com/), checked on 2026-10-30. Capital requires a separately generated API key and its **custom API password**, not the ordinary account password. Key creation requires two-factor authentication according to the provider documentation.

Capital currently offers trading-capable API keys, with no read-only key scope. “Read-only” describes this VAREX adapter's behavior. VAREX does not claim that the key itself cannot trade or that withdrawal restrictions have been verified.

The adapter uses only:

| Request | Purpose |
| --- | --- |
| `POST /api/v1/session` | Authenticate using `X-CAP-API-KEY` and JSON `{identifier,password,encryptedPassword:false}`. |
| `GET /api/v1/accounts` | Find the session's exact current account and verify `status: ENABLED`. |
| `GET /api/v1/positions` | Read that account's open positions. |
| `GET /api/v1/session` | Verify that the active account did not change during the read. |

The only possible hosts are `https://demo-api-capital.backend-capital.com` and `https://api-capital.backend-capital.com`. Redirects are refused. No account-switching, order, position-closing, transfer, withdrawal, deposit, or account-creation method exists in this adapter. Sessions remain server-side, are not persisted, and are not returned to the browser.

## Connection API

Authenticated developer/trader requests use the existing `connect_broker` action:

```json
{
  "action": "connect_broker",
  "provider": "capital",
  "environment": "demo",
  "identifier": "your Capital.com login identifier",
  "apiKey": "your generated API key",
  "apiPassword": "the custom password for that API key",
  "accountLabel": "My Capital demo account",
  "fundsAtProvider": true
}
```

Omitting `environment` selects demo. Any other explicit environment is rejected. The account is the provider session's `currentAccountId`; VAREX does not accept a client-supplied account ID or switch accounts automatically.

There is one connection per VAREX user. Replacing an existing connection, including a key replacement for the same provider, additionally requires:

```json
{
  "replacementConfirmation": "REPLACE_BROKER",
  "expectedConnectionRevision": "the current broker.connectionRevision value"
}
```

Missing/stale confirmation returns HTTP 409 before contacting a provider. The write also compares the original connection revision, so a concurrent replacement cannot be overwritten. A replacement resets live execution to disabled. `provider` omitted on a legacy Binance request still means Binance; unknown providers are rejected.

`refresh_broker` uses only the saved encrypted identity and environment. Request-body overrides do not select another environment or account. If Capital's current account differs from the pinned identity, the refresh fails, the stored connection becomes an error, and the previous snapshot is retained. The user must explicitly reconnect after checking the intended account.

## Returned broker data

Capital responses include `provider: "capital"`, `providerLabel: "Capital.com"`, `readOnly: true`, `executionSupported: false`, `canTrade: false`, `liveTradingEnabled: false`, and `mode: "paper"`. The last value describes VAREX execution availability; use `environment` to distinguish the external Capital demo and live environments.

Account fields are `accountId`, `accountName`, `accountType`, `currency`, and `accountBalance: {balance,deposit,profitLoss,available}`. These are provider-reported figures; VAREX does not derive or relabel them as equity. `positions` contains `{dealId,epic,instrumentName,direction,size,level,currency,profitLoss,createdAt}`. Position `profitLoss` comes from Capital's `upl`; a missing value stays null. No forex/CFD instrument is added to VAREX's four-symbol executable catalogue.

`snapshotAt` is the successful snapshot time. `lastCheckedAt` is the most recent refresh attempt, including a failure. A refresh error must remain visible next to a retained older snapshot. Existing `orders` remain Binance history and include `provider: "binance"`; they are not Capital positions. Capital returns `permissions: null` and `availableUsdt: 0` because Binance permission flags and USDT execution balances are inapplicable.

## Storage and compatibility

The existing AES-GCM encryption and server credential key are retained. The API key occupies the existing encrypted key fields. Capital's encrypted secret is a versioned JSON envelope containing `provider`, `identifier`, `apiPassword`, `environment`, and verified `accountId`. Binance's existing secret-string format is unchanged. No credential, session token, raw provider response, or encrypted envelope appears in the client response or provider error text.

The additive migration `20261030200032_varex_trading_capital_monitoring.sql` permits `capital` only in `varex_trading_broker_connection`, adds a constraint prohibiting Capital live enable, and strengthens `enable_live` and `reserve_live_order` to require Binance. The live-order table remains Binance-only. RLS, private table grants, profile provisioning, saved paper state, and existing account balances are unchanged.

The legacy D1 mirror does not need a table migration. It uses the same encrypted fields and an opaque hash of the ciphertext envelope as its replacement revision; SQL updates compare the original encrypted fields. The Edge deployment uses the existing UUID revision column.

Deploy the additive database migration before the new Edge function. This source change has been verified with offline fixtures; no actual Capital or Binance account was contacted or modified during implementation.

## Verification

Run from `Varex AI Trading`:

```sh
node --test --test-isolation=none --test-reporter=spec tests/trading-capital.test.mjs tests/trading-edge-api.test.mjs tests/trading-symbol-safety.test.mjs tests/trading-broker.test.mjs
```

The suite tests the real adapter against an isolated fetch mock, the real Edge handler and migration against PGlite PostgreSQL, and legacy D1 SQL against in-memory SQLite. It covers fixed hosts, demo default, pinned account mismatch, malformed data, sanitized failures, encryption round trips, explicit replacement, concurrent replacement rejection, zero Capital execution/decryption/reservation calls on prohibited actions, SQL guards, and existing Binance idempotency and confirmation protections.

`GET action=access` returns only the verified profile. It follows the normal authentication/provisioning policy and deliberately avoids paper state, market fetching, broker queries, and paper-stop settlement, so it can protect the standalone chart page without a trading side effect.
