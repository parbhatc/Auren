# Auren architecture

Auren has three execution contexts: simulated practice, connected Tradesea live trading, and historical replay. Journal capture is a read-only snapshot of those contexts; saving a recap must never place, close, or modify an order.

## Module map

| Area | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/constants/routes.ts` | Routes, authentication boundaries, lazy heavy screens |
| `src/components/trading/Trading/` | Shared Practice/Live terminal orchestration and header |
| `src/components/trading/Trading/tradingRenderer/` | Account resolution, trade actions, chart hosting, layout |
| `src/services/practice/` | Simulated execution, account rules, brackets and position cache |
| `src/services/tradesea/`, `src/propfirms/` | Provider-specific authentication, account and market-data adapters |
| `src/backtester/`, `src/components/backtester/` | Replay datafeed, execution, sessions, and advanced evidence capture |
| `src/pages/journal/` | Date-grouped journal list, full-entry detail and daily/weekly reviews |
| `src/journal/` | Shared editor, drafts, fields, templates, execution mapping, image capture/annotations, analytics panel, review chart |
| `shared/` | Runtime-neutral recap validation and journal analytics/period aggregation with TypeScript declarations |
| `src/pages/workspace/WorkspacePages.tsx` | Dashboard, playbook/analytics, news screens |
| `src/components/layout/WorkspacePrimitives.tsx` | Reusable workspace shell, headings, surfaces and metrics |
| `src/hooks/useActivePracticeData.ts` | Shared active-account statistics lifecycle |
| `src/api/` | Typed REST clients; `api.ts` owns base URLs and authentication transport |
| `src/services/websocket/WebSocketClientBase.ts` | Browser socket lifecycle, heartbeat, reconnection and dispatch |
| `server/src/controllers/TradingJournalController.js` | User-owned journal, playbook and legacy review operations |
| `server/src/config/Database.js` | SQLite schema and additive migrations |
| `server/src/websocket/` | Server dispatch and domain-specific replay/provider streams |

Some older paths are compatibility re-exports. They are not duplicated implementations: keep them until all callers can migrate safely. Non-JSX backtester socket clients now use `.ts`, not `.tsx`.

## Journal boundaries

- `journalCapture.ts` creates blank entries and maps existing open positions without provider calls.
- `InSessionJournalCapture` loads playbooks and an existing matching entry only when clicked. Its lazy editor is portaled above the terminal, leaving chart components mounted.
- `JournalEntryEditor` is reused by the standalone journal and in-session captures. It owns draft state, validation, focus, upload progress and save errors. Keyboard events cannot bubble into trading hotkeys.
- `journalConditions.ts` owns playbook normalization and legacy condition serialization. The editor and review page preserve the saved checklist, including unanswered/custom conditions.
- `journalImages.ts` handles uploaded and chart-captured image compression; `JournalScreenshotView` is the shared editable/read-only annotation renderer. `shared/journalRecap.js` validates the payload on browser and server. Deploy the shared directory with the server, not just `server/` alone.
- `useJournalDraft` serializes local IndexedDB writes under a verified user/entry key; it never silently imports another user's drafts. Stable clientRequestId prevents duplicate creates; version comparisons prevent stale different updates. Review forms use separate explicit saving.
- `journalExecutions.ts` maps read-only provider history into a preview/apply contract. Never infer missing net P&L or automatically pair Live partial fills. Original source identity and user evidence survive updates.
- `shared/journalAnalytics.js` owns sample eligibility, grouping and period semantics. `/analytics` and `/reviews` use the same curated entry summaries, never screenshot bytes or quote-time computation. `journal_reviews` stores versioned period notes and evidence IDs separately from legacy reviews.
- `journal_entries` is the curated recap store. The older `trades` store still powers legacy analytics/review endpoints; these are not yet one canonical ledger.
- Lists omit screenshot bytes. Fetch a full entry before editing. Historical chart bars are requested separately and may be unavailable.
- Playbooks are loaded from the authenticated server. Unowned legacy `auren-playbooks` browser data is preserved but neither displayed nor automatically imported into another account.

## Stream ownership and performance

Keep one domain connection per owner; cleanup on unmount/account change. The base client rebuilds authenticated URLs for each connection, retires CONNECTING sockets, ignores events from old sockets, and clears timers. Domain subclasses handle already-parsed messages through `handleCustomMessage`; do not add another JSON parser.

The server base separates parsing from handler execution and awaits returned promises. A thrown handler must not cause the same operation to execute twice. Async subclass handlers must return their promise if they rely on base error handling.

Journal writes use REST, not a quote subscription or a new WebSocket. Do not push image payloads through the market stream or compute journal summaries on every quote. Never coalesce/drop order and fill events as if they were replaceable quote updates.

Route splitting reduced the measured main production JS chunk from approximately 1,254 kB to 817 kB with the new workflows (gzip 320 to 214 kB). Chart capture is a separate lazy chunk. This is bundle-size evidence, not a live-latency benchmark; larger chunks and provider latency remain.

## Safe extension rules

1. Extend the shared editor or capture mapping instead of making a new form per trading mode.
2. Keep simulated and real execution identities explicit. Source metadata is user-supplied context, not proof of a broker fill.
3. Scope every record read and write to the authenticated user, including reads after UPDATE.
4. Preserve old entry fields/checklists; add schema migrations instead of recreating user databases.
5. Never use unscoped browser caches for account-owned data or silently import them.
6. Keep route compatibility and existing dirty worktree changes during refactors.
7. Add focused regression tests before changing P&L, candle ordering, socket ownership or migration semantics.

## Verification

Use Node 24 for the current test suite, including native TypeScript helper imports:

```sh
npm test
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

The last two commands verify the installed chart dependency without invoking the normal build script's automatic BWC update. See [API and streams](docs/API_AND_STREAMS.md) and [feature inventory/review](docs/AUREN_REVIEW.md).

