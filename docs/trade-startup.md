# Trade startup

The terminal starts public chart-code downloads while authentication and account
requests run. Account data and stream creation still require the normal server
authorization. The HTML preloads chart modules only for `/trade` with a stored
login token; other routes do not download the chart merely by opening the app.

Live startup uses `/tradesea/accounts` as its authoritative provider check. That
endpoint already verifies or refreshes the provider session, so Live no longer
fetches stored credentials and probes `/tradesea/connection` beforehand. Settings
and practice retain their existing validation paths. Saved account selection,
expired sessions, empty catalogs and stale initialization results keep their
existing handling.

`ProtectedRoute`, guest routes and descendant headers share one memory-only
verified auth session for the current token. Verification is fresh for 60
seconds and refreshes in the background while visible or on a browser return.
Verified permissions expire after five minutes at most, shortened by JWT expiry;
cold loads still verify with the server. Token replacement and logout discard
the old result. An old request or 401 cannot clear a replacement session. Broker
credential failures trigger a separate Auren verification instead of logging
the user out. An inner Suspense boundary prevents lazy routes from remounting
the auth guard. See [app-performance.md](app-performance.md) for shared changes.

Terminal navigation shows the actual market-data stream state, avoiding separate
credential-status probes during loading and after the chart mounts. Dashboard
and settings continue to show their linked-provider status.

## Chart assets and first candles

`vite.bwcStatic.ts` builds the SDK and host indicator entrypoints together with
esbuild splitting. Original public URLs remain valid. Shared entrypoints keep
the indicator catalog, presets, input panels, host interactions and other mutable
state identical for bundled and raw consumers. The engine retains its canonical
import-map/vendor URLs. Dynamic chunks, content versions, immutable caching,
ETags, source-watch invalidation and production copies use the same graph.

The measured static boot graph decreased from **498 JavaScript requests and
3.493 MB** to **69 requests and 1.697 MB** of decoded bodies. The real browser
recorded 70 chart/engine resources including its import-map entry wrapper.
Gzip size is approximately 477 KB; that is a compressed-size estimate, not a
claim about the development server's actual transferred bytes.

Symbol search enriches the picker asynchronously. The known ticker appears
immediately, and remote search no longer gates primary symbol resolution and
candle history. Revision and disposal guards prevent late metadata from changing
a newer selected symbol or a destroyed chart.

Study lookbacks that grow as primary history arrives reuse their loaded series
and prepend only missing older bars. A regression growing an ES comparison from
500 to 1,000, 1,500, 1,878 and 2,378 bars downloads exactly 2,378 bars through
disjoint windows, instead of repeatedly downloading the recent portion. Native
tail repair, confirmed HTF buckets, paired chart bars, replay anchors and stale
request guards remain in force.

Optional study requests also check the retained host's `aria-hidden`/`inert`
ancestors and document visibility. Primary streams and cached candles continue;
queued study work cannot begin more pages while hidden. Paused reads are aborted
without reporting empty history or exhausting the series. Returning to Trade
repairs dependency tails through the existing recovery path.

## Browser comparison, October 28, 2026

The same logged-in Chrome session observed chart readiness after intentional
reloads. Tradesea displayed one NQ one-minute chart; Auren displayed one NQ
30-second chart with saved studies. These are useful startup observations, not
identical-workload or cold-network benchmarks.

| Observation | Elapsed time |
| --- | ---: |
| Tradesea chart first observed through accessibility | 2.213 s |
| Auren before changes, same observation method | 5.722 s |
| Auren after bundling and bootstrap changes | 2.786 s |
| Final Auren reload with the completed history fixes | 3.230 s |
| Auren internal chart boot completed, after changes | 2.358 s |
| First visit after restarting Vite with warmup, new chart asset version | 3.879 s |

The final Auren trace had one roles request, one auth validation, one account
request and one stream-config request before the chart. Auth validation took
42 ms, accounts 174 ms and stream config 11 ms. Module discovery and delayed
startup, rather than login validation alone, explained most of the difference.
These are warmed development-server measurements; starting Vite and transforming
its application graph for the first time is a separate source of delay.
Development startup now warms both `main.tsx` and the lazy Live route, including
their static imports and CSS, so these transformations can run before a browser
requests the terminal. This changes no production authentication or data flow.

An actual 116-second Dashboard visit retained the same chart instance and 3,600
loaded primary candles. Its return recovery took 332 ms and fetched seven recent
NQ candles plus seven ES comparison candles. A cached one-minute revisit fetched
four primary candles; a cached five-minute revisit fetched three. Further study
lookback requirements may still fetch an older prefix that was never loaded;
they should not download the retained recent history again.

After the hidden-study guard was loaded, a separate 65-second Dashboard stay
made **zero** candle downloads (the wire counter stayed at 22). Returning kept
the same widget and all 3,604 primary candles, with the same oldest timestamp.
Recovery completed in 498 ms through two requests of five source candles each.
Actual ES startup reads consisted of one initial page followed by separate older
prefixes; there were no repeated growing initial windows. No history failures
or retries were recorded.

Running the comparison site also hit the provider's simultaneous-connection
limit. Its app session was released after the comparison, and the final Auren
page showed a connected stream, candles and saved studies without that modal.
The limit is a provider session constraint, separate from chart startup or
cache expiry. Sanitized timing and return traces plus the final screenshot are
saved locally under `.codex/startup-browser-evidence.json` and
`.codex/trade-startup-final.png`.

## Development diagnostics

Development builds expose bounded JSON in `script#auren-startup-diagnostics`:

```js
JSON.parse(document.getElementById('auren-startup-diagnostics').textContent)
```

Milestones use milliseconds since navigation. API timings contain only fixed,
allowlisted route names, start times and durations. Chart-resource counters
include the SDK, studies, chunks and engine. Query strings, credentials, account
IDs, response bodies and foreign-origin URLs are never published. Timing
observation and publication are disabled in production. The existing
`auren-history-diagnostics` remains the source for real history downloads,
source-cache hits and gap-recovery evidence.

## Validation

The Auren suite passes 269 tests, including authoritative bootstrap, route/header
auth reuse, replacement-token races, stale accounts and ten-minute cache/gap
integration. The BWC suite passes 403 tests covering asynchronous picker startup,
hidden study requests, growing history, replay and timeframe recovery. Application
and Vite-config TypeScript checks and the production build also pass.
