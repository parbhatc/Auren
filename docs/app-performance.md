# Shared page loading and Replay startup

Ordinary routes no longer load the chart SDK during scroll restoration. HUD
cleanup uses a destroy callback registered by an actual chart load, with a DOM
fallback for orphaned markup. This retains RAF, timer and socket teardown while
avoiding an SDK import on Dashboard, Journal, News, Settings and Replay lists.

Each workspace page has a separate lazy entry. Journal editors and review
charts, Replay statistics tabs and dialogs load when needed. Settings and
Practice News import provider metadata directly rather than pulling in trading
provider and chart implementations. Navigation intent preloads the matching
page's code without mounting it or making data/stream requests; Save-Data skips
this speculative load. Failed code loads remain retryable.

Authentication has one token-bound, memory-only session shared by route guards
and pages. Fresh verification is reused for 60 seconds. Visible periodic checks
and focus, visibility and online events refresh it, with concurrent checks
coalesced. Verified permissions cannot outlive five minutes or JWT expiry.
Cold loads still verify; logout, token replacement and authoritative app-auth
failures invalidate the session. A provider credential 401 first checks the
Auren session instead of treating the broker failure as an Auren logout.

Journal strategy/building-block catalogs have a 30-second user-scoped cache.
Monthly news data has a 60-second cache with six retained months. Mounted news
views filter raw data locally, so changing currencies or impact does not fetch
the month again. Explicit refresh bypasses the news cache. Pending reads are
shared, consumer cancellation is independent, and owner changes or mutations
prevent older results from repopulating metadata. Financial transactions,
journal entries and statistics do not use this metadata cache.

The header shares short-lived account-label refreshes and provider display
status across routes. These values describe navigation and do not authorize
trading. Existing account/provider mutation events invalidate them. Dashboard
cards become available independently of the slower calendar request and can be
remembered before that request completes; source-specific invalidation avoids
discarding unrelated account snapshots. Financial revalidation stays in the
existing dashboard loader.

Replay session startup fetches the user's sessions and CSV symbol inventory
concurrently. Existing sessions can open before a large inventory scan finishes;
creation waits for the catalog. Failures show a retryable error rather than
leaving a permanent loading screen. Late responses from another auth session or
an unmounted page cannot replace the current list.

Replay study history also survives timeframe changes. Those changes advance
the async request generation without evicting completed HTF and comparison
series. Mapping an unchanged host replay cursor to an earlier coarse candle
bucket does not count as a user rewind. Genuine rewinds still invalidate the
stores, and study results remain capped at the replay anchor. A regression
expires the short request cache, switches through 30s, 1m and 5m twice with
native HTFs and ES comparison history, and requires zero extra study requests.

Development diagnostics in `script#auren-startup-diagnostics` contain bounded
milestones and allowlisted endpoint timings only. Queries, tokens, account IDs
and credentials are omitted. Chart assets and application assets are counted
separately. Route timings measure the navigation shell, not completed financial
requests or precise visual paint.

## Practice entry

`/practice` opens the existing simulated trading terminal with the saved active
practice account, or the first active account if that selection is unavailable.
The URL stays `/practice` when switching accounts. Existing account-specific
`/practice/trade/:accountId` links remain supported. An account that passes or
fails while open keeps its existing safety modal.

Account creation, plans, resets and deletion live at `/practice/accounts`,
accessible from the terminal account selector and Settings. If there is no
active account, the Practice entry opens that setup page. Account discovery
must succeed before choosing an account; a failed refresh offers retry instead
of silently opening an old selection. The terminal reuses that completed
catalog refresh rather than downloading it again during bootstrap.

## Browser verification, October 28, 2026

Opening Dashboard and navigating through Journal, Analytics, News, Settings and
the Replay list loaded **zero chart SDK/engine assets**. Before the HUD cleanup
fix, an ordinary Replay list loaded 58 chart resources totaling approximately
1.56 MB decoded, despite never mounting a chart. Auth and provider-status reads
were shared across the six-page navigation cycle. Analytics still refreshed
its financial account data.

Observed click-to-shell milestones ranged from 73 to 206 ms in that logged-in
development session. These measure the route shell, not completed data, exact
visual paint or a reproducible cold-network benchmark. Source graph cuts and
request counts are more useful evidence than a universal speed percentage.

The existing NQ Replay session, with saved HTFs and ES comparison studies,
previously increased history HTTP reads from 50 to 79 during repeated warm
switches. After the fix and initial loading of each timeframe, **seven switches
among 1m, 30s and 5m kept the count at 35**, with no pending reads or errors.
Stepping forward/back, statistics Overview/Calendar/Trades and the CSV inventory
were also checked without placing orders or changing session data.

The browser confirmed `/practice` stays at that URL and shows connected NQ/ES
charts and the practice order ticket. The account menu opens `/practice/accounts`;
Settings links there too, and Open Practice returns to the terminal. The extra
catalog reads from the selector and sidebar-only header were removed. The
post-connection financial refresh remains.

Final validation: 388 Auren tests, 406 BWC tests, application and Vite-config
TypeScript, production build and diff whitespace checks passed. Sanitized
timings and history evidence are saved in
`.codex/app-speed-browser-evidence.json`; screenshots are
`.codex/practice-terminal-final.png` and `.codex/replay-cache-final.png`.

## Multi-pane panning follow-up, October 28, 2026

A held left-button drag can move freely in both dimensions without first
dragging each pane's price axis. Deliberate vertical movement takes ownership
of the fitted price range and switches the layout's main charts into manual
mode. Pure horizontal movement and vertical noise under five pixels retain
autoscale. With the layout's date-range link enabled, plot drags move the peer
charts vertically in the same frame as the source, in addition to the existing
horizontal synchronization. Each instrument translates the shared pixel delta
on its own price scale, preserving its own prices and zoom. Either chart can
drive the movement. Indicator subpanes keep their independent scale behavior.
Axis drags publish the same shared manual-mode transition.

The engine switches peer modes during the gesture and commits the shared
setting after release or cancellation. Explicitly disabling autoscale now
updates the real ProChart scale, and viewport restoration follows the shared
preference instead of a stale per-pane auto-fit snapshot.

Viewport-only autosave notifications no longer clone all drawings or serialize
the layout on every source and peer pan frame. They save the final state after
the pointer is released, including when a stationary hold outlasts the normal
debounce. Actual drawing changes still persist immediately. Date-range sync
also skips unchanged logical deltas instead of repeatedly redrawing peers
while the pointer is held still.
Destroying the widget cancels pending viewport saves and prevents late timer
callbacks from restarting the retry loop or writing detached state.

Regression tests send 240 source/peer viewport notifications and require zero
storage writes or drawing clones during the held gesture, then verify the final
viewport is saved. Another test sends 120 stationary synchronization polls and
requires zero peer range updates. Real price-scale and native pointer tests
verify both panes pan vertically before axis interaction, preserve pointer
distance, respect disabled drawing interactions and restore correctly.
The native two-chart regression also covers movement from either pane, the
first autoscale-unlock delta, different price spans and pane heights, circular
return, pointer-up flushing, zero movement and turning the layout link off.

The Practice browser check covered vertical drags on both panes without any
axis adjustment, diagonal movement with linked dates, and a 1m/30s return followed
by another vertical drag on chart 2. The slow browser automation's long-press
tooltip was disabled in the temporary test tab for these gestures. No orders
were placed. Screenshot: `.codex/practice-pan-fixed.png`.

Drawing tools now share controller-driven tool transitions across the layout.
Committing a long or short position returns every pane to the cursor, so the
next click on another chart cannot place a second drawing. This works whether
drawing-content synchronization is enabled or disabled. Explicit stay-in-mode
and retained freehand/multipoint tool policies remain available. Newly attached
panes inherit the current tool and drawing mode.

The browser confirmed both panes move during a vertical drag from either
chart. After one temporary long-position drawing was placed on chart 1, both
pane DOM modes returned to cursor and clicking chart 2 kept the cursor active.
The temporary drawing was removed; existing user drawings were preserved.
Screenshot: `.codex/practice-linked-pan-fixed.png`.

Latest validation: 427 BWC tests and seven Auren chart-loading/bundle integration
tests passed; the direct Vite production build passed in 21.86 seconds. The
previous full Auren suite (388 tests) and application TypeScript also passed.
