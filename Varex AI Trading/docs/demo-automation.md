# Server scheduled demo automation

The bot runs on Supabase, independently of an open browser or laptop. It is
disabled for every account until the user explicitly enables it. It cannot read
broker credentials and has no Binance, Capital.com or other live order client.
This implementation supports only the existing internal demo wallet and the four
crypto markets BTC-USD, ETH-USD, SOL-USD and ADA-USD.

## Decisions

The engine trains a small regularized logistic classifier on historical closed
candles for the selected asset. Features are derived from EMA20/50, RSI14, MACD,
ATR-normalized returns and candle bodies. Training rows precede chronological
holdout rows; feature scaling is fitted only to training rows. The last closed
candle has no future label and is used only for the current decision.

At least 70 training rows and 30 validation rows are required. The held-out
directional accuracy must exceed both 55% and the held-out majority baseline by
three percentage points. A model score must then agree with moving-average trend,
MACD momentum and an RSI outside the overbought/oversold extremes. Otherwise the
result is **wait**, potentially for many cycles. These short-history validation
metrics are not calibrated probabilities of profit or a promise of performance.

The trading intervals are 5, 15 and 60 minutes; the scheduler checks once per minute.
Chart intervals are independent and additionally support 1 minute, 4 hours, daily,
weekly and monthly. New demo entries occur at most once per closed analysis candle.
Fresh Coinbase public ticker timestamps are required for fills; stale quotes,
incomplete histories, gaps and conflicting bars prevent entries. Existing bot
positions can still be closed on valid fresh quotes when the model cannot run.

## Risk and concurrency

The bot manages only trades whose server-created IDs start with `auto-`. It respects
the shared demo account's daily loss, position count and per-trade risk limits,
plus its own daily entry limit. Position notional is capped at 25% of demo balance
and aggregate open notional at 75%. Every bot entry has a simulated stop based on
two ATRs (bounded to 0.5–5% price distance); the target is twice that stop distance.
Stops, targets and an opposing qualified signal may close a bot trade.

Demo fills use observed ticker prices and the same P&L convention as manual demo
trades. They do not model commissions, bid/ask execution, slippage or guaranteed
stop fills. This is a simulation and cannot establish expected live returns.

Database leases prevent overlapping workers from processing the same user.
State writes use the existing compare-and-swap transaction so manual trades are
not overwritten. Configuration revision and enabled state are rechecked inside
the completion transaction. Stopping or editing a bot cancels an in-flight claim.
Stopping does not close existing demo positions; they remain in the trade view.
An account role/status downgrade disables the bot and invalidates its lease.

## Authentication and schedule

`varex-trading-automation` verifies Supabase user JWTs for status/configuration.
Only active verified accounts can access their own config; enabling requires a
trader/developer role and `ENABLE_DEMO_AUTOMATION`. Mode `live` is rejected.

Scheduled calls use a separate 256-bit random token generated in Supabase Vault.
Only its SHA-256 digest is stored in the private runtime table. The token is never
returned to the app, logged, committed, or stored in browser storage. The public
publishable key in the scheduling SQL identifies the project; it does not grant
authorization to run jobs. Tables have RLS and no grants to public/anon/authenticated.
All RPC functions are security invoker and executable by service_role only.

The app reports the scheduler ready only after a successful heartbeat in the
last three minutes. A missing/old heartbeat prevents enabling a new bot. A running
bot stops making progress when the scheduler/provider is unavailable and the UI
shows the last actual check and result, never synthetic activity.

## Deployment and verification

1. Apply `20261030200301_varex_trading_demo_automation.sql` after the base trading schema.
2. Deploy the bundled `supabase/functions/varex-trading-automation/index.ts`.
3. Run `supabase/setup/varex-demo-scheduler.sql`. It is idempotent by its named job
   and Vault secret and preserves existing account configurations.
4. Verify job metadata, HTTP success and the runtime heartbeat without selecting
   Vault data, encrypted broker credentials or request headers.
5. Keep all accounts disabled until their users explicitly enable demo automation.

Official scheduling reference: https://supabase.com/docs/guides/functions/schedule-functions
Public prices: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker
Public candles: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
