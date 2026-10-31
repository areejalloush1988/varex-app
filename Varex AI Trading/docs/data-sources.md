# Analysis assistant market data

Reviewed on 31 October 2026. This is a read-only client: it does not create broker
accounts, read trading credentials, fund accounts, or submit trading orders.

## Contract

Load `market-data.js` before `analysis-data.js`. The latter exposes
`window.VarexAnalysisData` (and a CommonJS export for tests):

```js
const data = await VarexAnalysisData.load({
  symbol: "XAU-USD", // or BTC-USD, ETH-USD, SOL-USD, ADA-USD
  interval: "D",   // 1, 5, 15, 60, 240, D, W, M
  signal,
  force: false,
});
```

`data` contains `symbol`, `interval`, `intervalSeconds`, `calendarPeriod`, closed
`candles`, `source`, `provider`, `sourceUrl`, `sourceVerified`, `warnings`,
`receivedAt`, `asOf`, `delaySeconds`, `quality`, `provenance`, and `allowExport`.
`asOf` is the end of the last complete bar, not
the HTTP receipt time. A recent fetch must not be described as a recent market
reading if the last bar is old. Gaps are preserved and reported; no missing bars,
prices, or volumes are fabricated. Unknown market sessions are not asserted open
or closed.

The authenticated gold response may provide a bounded provider ID, credit text,
HTTPS source link, and plain-text warnings. These are preserved after validation;
source links omit query strings and fragments. Only an explicit backend
`sourceVerified: true` is retained. Unknown delivery delay stays `null`, including
when a nested provenance value claims zero delay. Export remains disabled for
provider datasets regardless of upstream flags.

Adapter-calculated counts, gaps, and candle age remain authoritative. Bounded
upstream quality diagnostics, when present, are retained in `quality.reported`.
An upstream `is_stale`, `isStale`, or `quality.freshness: "aged"` can make the
result more conservative; a provider's `"recent"` flag cannot make old bars fresh.

The canonical gold symbol is **XAU-USD**. This is spot gold per troy ounce in USD;
it must not silently become a futures contract, ETF, tokenized gold, or broker CFD.

## Configured gold provider

The primary gold request is an authenticated read through the existing transport:

```text
GET /api/analysis/market?symbol=XAU-USD&interval=D
```

The server must return the exact symbol and requested interval, numerical OHLC
values, correct UTC boundaries, source, and an ISO UTC `receivedAt`. Secret keys
belong on the server. The adapter does not accept API credentials from caller
options and does not read authentication storage itself.

The server's data-provider agreement must permit the intended display and
analysis. In particular, an individual Twelve Data subscription does not by
itself establish public commercial display or derived-data rights:

- <https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage>
- <https://twelvedata.com/terms>

## Optional public daily gold fallback

The fallback is **off by default** until an actual runtime request verifies its
availability and CORS. It is enabled only with:

```js
window.VAREX_ANALYSIS_DATA_CONFIG = { goldDailyFallbackEnabled: true };
```

It applies only to `XAU-USD` / `D` after a missing/unconfigured primary provider.
It cannot override a 401/403 account-authorization rejection, convert an intraday
request to daily, or hide a malformed configured response.

The public request goes directly from the browser to:

```text
https://api.goldprice.dev/v1/bars?symbol=XAU-USD-SPOT&interval=1d&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=30
```

Provider documentation advertises anonymous daily bars within the latest 30
calendar days. This limited history may support EMA20 or RSI14 but usually does
not support EMA50 or the complete MACD signal. Each indicator must retain its own
history check. The endpoint's `is_closed` field is mandatory. Spot `volume: null`
is omitted, never changed to a zero-volume claim.

The Free tier describes data as delayed by 15 minutes. `delaySeconds: 900` is
carried with the returned data; no "live tick" claim is made. Cache successful
daily results for at least 15 minutes, including manual refresh clicks. No hidden
pagination or polling is performed.

The provider's terms allow commercial display with a visible credit link near the
prices. They do not grant raw or derived data redistribution through our API,
SDK, dataset, or export. Therefore these results carry:

```js
{
  allowExport: false,
  provenance: {
    url: "https://goldprice.dev/",
    attribution: "Gold price data by goldprice.dev",
    displayOnly: true,
    historyWindowDays: 30,
    delaySeconds: 900
  }
}
```

The UI must display that attribution/link by the chart or prices and respect the
export flag. The feed is indicative and must not be represented as an official
benchmark. A public data adapter is not evidence of regulatory authorization for
any investment service.

Official references reviewed:

- <https://goldprice.dev/docs/historical>
- <https://goldprice.dev/free-plan-limits>
- <https://goldprice.dev/terms> (version 0.7.2, effective 18 October 2026)

The web retrieval tool could read these pages but could not retrieve the JSON
endpoint. Production enabling therefore requires a real runtime check; mock/unit
responses alone are insufficient.

## Other reviewed alternatives

Gold API documents keyless current quotes, CORS and commercial use, but history
and OHLC require an account API key. A current quote is not a substitute for a
candle history. No account or subscription was created:

- <https://gold-api.com/faqs>

TradingView's embedded chart does not provide an API for extracting its underlying
quotes or indicators. The assistant must not scrape it or mistake a chart display
for a licensed numeric data feed:

- <https://www.tradingview.com/widget-docs/faq/data/>

## Existing cryptocurrency provider

The four cryptocurrency symbols delegate to `VarexMarketData.loadCandles`, which
uses public Coinbase Exchange / Kraken OHLC endpoints. The adapter preserves the
actual returned provider, validates every normalized bar, removes forming bars,
and refuses symbol/timeframe mismatches. The chart should draw these exact same
bars. A separately embedded reference chart may have a different price source.

## Verification

```sh
node "Varex AI Trading/tests/analysis-data.test.mjs"
```

Tests cover symbol/interval injection, malformed/conflicting/future data,
provenance, explicit missing-provider states, direct-public transport credentials,
fallback gating, auth failures, null spot volume, daily cache limits, failed
refresh invalidation, rate limits, cancellation and a transport that ignores
abort signals.
