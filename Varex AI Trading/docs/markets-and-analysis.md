# VAREX market workspace

The standalone research workspace is available at `/trading/markets.html` after
sign-in and verification of an active account. Its page guard checks the session
and trading access before mounting the workspace, and rechecks after restoration
from the browser's back-forward cache. The same workspace is mounted in the
authenticated application's **Markets** and **Market analysis** sections. Market
inspection itself remains read-only; selecting a market does not place an order.

## Catalogue and reference

The catalogue contains 43 research instruments across forex, indices, commodities,
metals, stocks and the four existing cryptocurrency markets. The first five
categories follow HEDG's public market navigation. Its public pages do not expose
a full broker instrument catalogue or a public quote/execution API, so this is
not a claim to reproduce all HEDG instruments, prices, contracts or execution.
No HEDG code, images, credentials, private feeds or proprietary analytics are used.

Reference pages inspected on 30 October 2026:

- https://hedg.com/en/trading/markets/
- https://hedg.com/en/trading/platforms/tradingview/
- https://hedg.com/en/trading/platforms/webtrader/

Each research instrument declares its actual TradingView source and instrument
type. Index CFDs, exchange indices, continuous futures, equities and cryptocurrencies
are not interchangeable. Search and device-local favourites never modify backend
execution permissions or the account's existing four-instrument watchlist.

## Charts and general technical analysis

The official TradingView chart and technical-analysis widgets receive the same
allowlisted symbol, theme and interval. The period mapping is explicit:

| VAREX period | Chart interval | Technical-analysis interval |
| --- | --- | --- |
| 1 minute | `1` | `1m` |
| 5 minutes | `5` | `5m` |
| 15 minutes | `15` | `15m` |
| 1 hour | `60` | `1h` |
| 4 hours | `240` | `4h` |
| 1 day | `D` | `1D` |
| Calendar week | `W` | `1W` |
| Calendar month | `M` | `1M` |

Internal symbol, chart-legend and date-range selectors are
disabled to avoid silently desynchronising the chart and analysis. Vendor
attribution remains visible.

Widgets display their own price, loading and unavailable states. Some exchange
data is delayed or unavailable for embedding. VAREX does not scrape or export
widget data, and does not expose widget ratings as a calibrated profit probability.

Official integration references:

- https://www.tradingview.com/widget-docs/tutorials/iframe/build-page/dynamic-symbols/
- https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- https://www.tradingview.com/widget-docs/widgets/symbol-details/technical-analysis/
- https://www.tradingview.com/widget-docs/faq/data/
- https://www.tradingview.com/charting-library-docs/latest/api/modules/Charting_Library/#resolutionstring

The classic technical-analysis embed's supported interval list was also verified
on 30 October 2026 in its official public asset, including `1m`, `1W` and `1M`:

- https://www.tradingview-widget.com/embed-widget/technical-analysis/?locale=en
- https://www.tradingview-widget.com/static/bundles/embed/53322.06c7f40deba525a20763.js

## VAREX candle analysis

`market-data.js` requests public Coinbase Exchange OHLCV data, with a public Kraken
fallback for fixed durations, for BTC-USD, ETH-USD, SOL-USD and ADA-USD only.
Calendar weeks and months prefer Kraken's longer daily history, with Coinbase as
the fallback. Requests are unauthenticated
GETs with credentials omitted. No application tokens or account identifiers are
sent to these providers. The loader is abortable, has an eight-second deadline per
provider and a fifteen-second in-memory cache of cloned public data.

One-minute candles use Coinbase's native 60-second granularity or Kraken's native
1-minute interval. Four-hour Coinbase bars are built only from four complete,
contiguous hourly records aligned to UTC. Other fixed durations use native source
bars. Up to 350 resulting bars are retained. The analysis module independently
removes the incomplete current bar, invalid or conflicting records and future
timestamps.

Weeks and months are aggregated from daily candles. A week starts on Monday at
00:00 UTC and ends the next Monday. A month starts on the first day at 00:00 UTC
and ends at the start of the next actual calendar month, including February and
leap years. Every constituent day must be aligned, closed and present exactly
once, after equal duplicates are collapsed. Conflicting days, missing days,
partial leading periods and the current unfinished period cannot produce a
calendar candle. No prices or empty days are filled in.

Each provider receives at most one request per load attempt, with no historical
pagination. Kraken supplies at most 720 daily entries, including its current open
entry; Coinbase supplies at most 300. This normally provides around 100 complete
weekly bars or 22–23 complete monthly bars from Kraken, depending on dates and
data gaps. A Coinbase fallback gives a shorter history. A monthly EMA50 therefore
cannot be calculated from the present public history, nor can the 34-bar MACD
signal. Available calculations such as EMA20, RSI14 and ATR14 are shown only when
their own history requirements are met. The interface lists the exact available
and required bar counts; an absence of usable complete periods or of enough bars
for any indicator is shown as **غير متاح لهذه الفترة**. TradingView's widgets
remain independently configured for the requested week or month.

The loader's metadata contract distinguishes calendar time from seconds:

```js
// Fixed duration, including 1 minute:
{ interval: "1", intervalSeconds: 60, calendarPeriod: null, candles, source, receivedAt }
// Calendar duration, with no guessed number of seconds per month:
{ interval: "M", intervalSeconds: null, calendarPeriod: "month", candles, source, receivedAt }
// A week uses interval: "W", intervalSeconds: null, calendarPeriod: "week".
```

`analyzeCandles` accepts this metadata directly. Calendar bars must start at the
proper UTC boundary. Closure, missing-period detection and freshness advance
through actual calendar boundaries. Data becomes stale two complete periods
after the last candle's close; for months the elapsed number of seconds varies
with the calendar. An inconsistent fixed-second value alongside a calendar
period is rejected.

Official public candle documentation:

- https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
- https://docs.kraken.com/api-reference/market-data/get-ohlc-data

`market-analysis.js` calculates EMA20, EMA50, Wilder RSI14, MACD12/26/9, Wilder ATR14
and the high/low of the preceding twenty closed bars. Every indicator states whether
enough history exists. Agreement is a count of descriptive readings, not confidence
in a trade. Stale and insufficient histories are explicitly labelled; a failed
refresh removes the previous displayed result. No target, stop, order or trained-AI
claim is generated by this module.

The candle source is displayed with the result. When Kraken is used, including
the preferred calendar-history route, its reading may differ from the
Coinbase-based TradingView chart. Times in
the interface use Asia/Dubai; candle timestamps and aggregation use UTC.

## Execution boundary

Only BTC-USD, ETH-USD, SOL-USD and ADA-USD can reach the existing execution panel.
Opening that panel from research forces paper mode and prepares the symbol only;
it does not submit an order. Real Binance Spot orders retain their existing
independent manual confirmation, role checks and limits. They use USDT pairs,
which differ from the USD research chart.

Both backend implementations reject explicit unsupported or empty symbols before
provider access or account provisioning. Orders require an explicit supported
symbol; optional missing chart selection retains the existing default.
The backend's catalogue and database constraints are not expanded by this feature.
Deploy the changed `varex-trading-api` function for its server validation to apply;
the frontend execution boundary is independent of that deployment.

The prior 24-hour-movement analysis history remains labelled as legacy history.
It is not presented as the new candle indicator output.

## Verification

Focused Node tests cover reference numeric indicator vectors, incomplete and stale
bars, normalization and provider fallback, cancellation, timeouts, one-minute
selection, four-hour aggregation, UTC Monday weeks, leap-year calendar months,
missing and incomplete daily components, calendar freshness and missing-indicator
counts, market/execution separation and request validation. No real orders,
account creations, email messages or broker credential changes are used for tests.
Visual checks exercise actual public chart/data providers within the applicable
account access flow, without a synthetic production-data mode.
