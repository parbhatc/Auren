# History request efficiency

Measured October 27, 2026 on the running Auren Live page, using its existing
two-pane NQ/ES layout at 30 seconds and configured indicators. Counts below
are actual Tradesea UDF HTTP downloads, including indicator history, rather
than the number of JavaScript `getBars` calls.

| History | Before | After |
| --- | ---: | ---: |
| NQ 30-second candles | 26 | 8 |
| ES 30-second candles, including comparison backfill | 44 | 8 |
| Higher-timeframe source pages, both symbols | 10 | 10 |
| Total HTTP downloads | **80** | **26** |

The measured reduction is 67.5%. Each final chart still loads 3,600 candles;
redundant downloads were removed without reducing its requested lookback.
The measurement had no failed requests or retries. Counts depend on the
layout, enabled studies, timeframe, loaded history and market session.

## Request flow

1. BWC loads viewport candles, then fills the history required by active studies.
2. Indicator warmup uses pages of up to 500 bars and requests only its remaining
   shortfall. Normal scrollback retains smaller viewport-sized pages.
3. Chart panes, HTF studies and comparison studies share a per-widget request
   broker. Concurrent identical reads join one request; recent completed reads
   and provably covered smaller windows can use its bounded 10-second cache.
4. Comparisons join a matching visible pane's primary history. They do not
   independently download the ES candles already supplied by the ES pane.
5. Auren converts BWC requests to Tradesea UDF requests. Its source cache can
   satisfy additional reads, so broker source calls and HTTP downloads differ.

In the final captured initial-load sample, BWC made 93 logical reads, its
broker served 62 from cache and joined one pending read. Thirty reached
Auren's adapter and four more were satisfied by Auren's source cache:
26 HTTP downloads. These are a captured
sample, not fixed per-page budgets; indicator reads continue during live updates.

## Warm navigation and timeframe retention

After the first Trade visit, Auren retains the actual chart widget for up to
ten minutes on Dashboard. Returning reuses its
candles, viewport, studies and request broker. The connection lease and view
share the same idle deadline, with a 30-second grace period so returning at
exactly ten minutes cannot race cleanup. Each departure starts a fresh window.
Logout, provider/account changes while
inactive, and routes using the practice provider dispose the retained view.
Hidden order controls unmount, chart shortcuts stop handling input, and owned
floating chart controls are hidden or dismissed until Trade returns.

Controlled-clock five-minute and exact ten-minute Dashboard regressions exercise
the actual session cache, view retention, Auren resume controller and BWC gap
recovery together. They reuse the same widget/session and retain all 3,600 old
30-second candle timestamps. Return fetches one 12- or 22-candle overlapping
tail, respectively, ending with 3,610 or 3,620 gapless candles. Neither case
resets the chart, clears history, repeats bootstrap or loops through old pages.
The ten-minute endpoint survives cleanup scheduling; unused state still expires
after the grace period, including when background timers were suspended.

Timeframe snapshots are retained for 30 minutes inside their original widget.
LRU limits are 12 series / 60,000 candles per widget and 48 series / 240,000
candles overall. Eviction removes an entire old snapshot; it does not silently
truncate scrollback. A previously unvisited, expired or evicted series can need
a cold history load. Warm returns retain old candles and fetch only the elapsed
tail, using fresh pages of at most 500 bars even for long gaps. Failed repairs
retry from the original checkpoint, preserving newer live candles.

The real browser navigation check used the original two-pane 30-second layout.
Before retention, one warm Dashboard return rebuilt the widget and downloaded
7,204 source candles in 17 requests. After the fix, the first Dashboard lazy
load preserved the same widget and broker. The explicit `/dashboard` visit
lasted 116.228 seconds, longer than the 90-second source-response cache, and
made no history downloads while away. Return downloaded only seven recent
source candles per pane (14 total in two requests). Recovery took 541 ms and
kept all 3,605 candles per pane and their oldest timestamps. Three further
rapid Dashboard round trips each made zero history downloads.

| Revisited timeframe | Source candles before fix, both panes | After fix, both panes |
| --- | ---: | ---: |
| 1 minute, after 60 seconds away | 3,604 | 8 |
| 5 minutes | — | 6 |
| 30 seconds | — | 12 |

First visits to 1 minute and 5 minutes still loaded their initial histories.
Later repeated `1m → 5m → 30s` cycles fetched only 3–4 recent source candles
per pane, with zero large initial/history pages, failures or retries. Indicator
tails can still refresh at live bar boundaries; those reads are recorded as
`htf.tail` and do not rebuild the chart's historical lookback.

The visual check also found and fixed a cached-timeframe viewport race: gap
repair painted the new candles before the timeframe picker finished mapping
the old view, allowing a queued restore to move beyond the current candles.
Initial repair now merges data without painting; the timeframe transition owns
that first paint. Later retries refresh the already-current series. A regression
uses the actual ProChart time-scale model, repeated timeframe changes, queued
animation frames and window resizing. Final live checks show both restored
30-second charts and their indicators at the current candles.

Sanitized measurements are in `.codex/history-navigation-before.json`,
`.codex/history-navigation-final.json` and
`.codex/history-timeframes-viewport-final.json`.

## Higher-timeframe studies

- Duplicate timeframe rows and overlapping studies merge their maximum depth.
- FVG comparison requests include only the selected comparison timeframes.
  Disabled graphics or an inactive comparison selection do not request unused
  HTF series.
- HTF initial loads, older pages and tail repairs share pending work. Exhausted
  history remains exhausted until invalidation, and a stale timeframe request
  cannot populate the new cache generation.
- Reconnect/replay tail repair covers the whole missing interval, paging when
  necessary. It no longer requests only the last 16 bars after a long gap.
- Symbol-aware missing ES data stays missing until loaded; legacy NQ getters
  cannot substitute primary-symbol candles for a missing comparison series.
- Timeframe transitions retain the identity of the candles actually loaded.
  Early indicator work, late history responses and old live callbacks cannot
  relabel the previous timeframe's candles or overwrite the new cache.
- A warm live timeframe restore repairs the complete recent gap, while retaining
  older cached history. This finalizes a candle that closed while away and
  fills missed short-interval buckets. The repair honors market-data delays,
  bypasses completed caches, shares concurrent fresh work and skips replay.
- Auren builds multi-hour CME candles from native hourly data. Consequently,
  a 4-hour study appears as `resolution=60` in the UDF network trace and can
  legitimately need multiple source pages. Market closures also affect how
  many calendar hours are needed to obtain a requested number of candles.

## Background and connection recovery

Auren captures a widget-local checkpoint when Trade becomes hidden or its feed
disconnects. After reconnecting, it passes that original checkpoint to
`widget.recover()`. A new live tick cannot move the checkpoint beyond candles
that were missed while the browser was suspended.

Recovery retains the existing candles, drawings, viewport and HTF stores. It
fetches only the interval from the pre-background confirmed/forming candle pair
to the current delayed-market clock, using pages of at most 500 primary bars.
HTF dependencies share repaired visible panes or fetch their missing tails.
It does not call `widget.reset({ data: true })` or clear all history caches.

Fresh repairs bypass overlapping completed and stale pending source responses.
Late responses cannot overwrite the repaired window. A failed repair keeps its
original checkpoint and retries with bounded backoff; it cannot report stale
fallback data as a successful repair. Replay is excluded.

Panes that finish changing timeframe while hidden are recovered from the
saved suspension time and actual candle timestamps. CME multi-hour series
retain their exchange grid. Fresh market-closure responses can confirm absent
bars without creating placeholders or repeatedly fetching the same weekend.
History responses also cannot roll live price marks backwards.

The cross-app ten-minute suspension test runs the actual Auren controller with
the actual BWC recovery code. A 30-second series with 3,600 loaded candles
requests 22 overlapping/missing candles, retains all old timestamps and its
viewport, finalizes the previous forming candle and ends with 3,620 candles
without gaps. Separate HTF tests recover 20 missing primary candles and three
HTF tails in four requests (`21 + 2 + 2 + 2` bars), without reloading lookbacks.

### Real background return

The running Chrome Trade page reported **25 minutes 8.824 seconds hidden**.
It was returned to the foreground without refreshing. Its saved checkpoint
remained unchanged until recovery completed, which took 1.484 seconds from
the recovery-start event to completion.

| Resume downloads | Requests | Source candles each |
| --- | ---: | ---: |
| NQ 30-second gap | 1 | 53 |
| ES 30-second gap | 1 | 53 |
| NQ 15-minute tail | 1 | 3 |
| ES 15-minute tail | 1 | 3 |
| Total | **4** | **112 candles total** |

The recovery report retained all 3,684 NQ candles and 3,686 ES candles, with
identical oldest timestamps before and after. No full initial-history request
was made during recovery; no history failures or retries occurred. The page
showed connected market data, and MDS/trades connected messages were observed.

Chrome continued receiving ticks while hidden, so its candle counts stayed
unchanged. The separate frozen-stream integration tests verify insertion of
genuinely missed candles and their continuity. This is a real Chrome background
check plus automated Safari-style suspension coverage, not a physical Safari run.
The sanitized real trace is `.codex/history-resume-10m.json`.

After loading the final code, a separate stream reconnect completed in 511 ms.
It made two downloads of three recent source candles each, kept all 3,611 NQ
and 3,613 ES candles and their oldest timestamps, and recorded no failures or
retries. Each chart's latest 128 candles had uninterrupted 30-second spacing.
The trace and continuity checks are in `.codex/history-resume-final.json`.

The existing Auto-reconnect preference was off during the long background test;
Chrome's stream remained connected. It is now enabled in the tested session so
unexpected drops also reconnect automatically. Broker connection-limit
disconnects retain the existing manual-refresh behavior.

## Development diagnostics

Development builds expose bounded, credential-free JSON in the non-rendered
`script#auren-history-diagnostics` element. Inspect its text in DevTools:

```js
JSON.parse(document.getElementById('auren-history-diagnostics').textContent)
```

`brokers` contains BWC logical request/cache statistics. The top-level
`counts.logical` counts calls reaching Auren's adapter; `counts.wire` counts
real UDF downloads, `cache` counts Auren source-cache hits, and `joined` counts
source in-flight joins. `events` retains the latest 300 sanitized events with
symbol, native resolution, range, count, reason, result size and duration.
Connection IDs, account IDs, authorization headers and full URLs are excluded.

`resumes` retains the latest 40 lifecycle events. Completion events include
before/after history counts and oldest timestamps, plus the latest 128 candle
timestamps for up to 16 panes so a foreground check can verify continuity.

The broker's `invalidations` counter includes live-tick invalidation checks;
it is not a count of downloads. Diagnostics subscribe to numeric updates and
do not poll. Recording is disabled in production builds.

The widget also exposes `widget.datafeed.historyCache.stats()` and
`subscribe(listener)` for inspection. Explicit reset invalidates its pending
and completed work; incremental recovery invalidates overlapping repair windows.
Disposal releases subscribers. Caches remain widget-local
so unrelated account, source and replay sessions do not share broker responses.

Local measured traces are saved in `.codex/history-before.json` and
`.codex/history-after-final.json` and are intentionally ignored by Git.

## Verification

- Auren: 243 tests, application TypeScript and production build.
- BWC Pro: 379 tests, including request sharing, range coverage, expiry, replay
  gaps, stale generations, visible-pane borrowing, indicator declarations,
  mixed-timeframe prevention and warm-cache candle finalization.
- Deterministic primary warmup fixture: 3,600 candles previously required 26
  viewport-sized requests across two passes; now it requires seven bounded
  pages in one pass, with identical final depth and unchanged scrollback sizing.
- Browser warm-return check, 1 minute → 5 minutes → 1 minute: each primary
  chart refreshed four recent source candles instead of downloading the old
  500-candle page that previously corrupted the restored timeframe. Two
  higher-timeframe tail reads fetched 20 native hourly candles each. There
  were no failed requests or retries. Saved in
  `.codex/history-timeframes-final.json`.
