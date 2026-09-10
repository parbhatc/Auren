# Journal API and stream integration

## In-app capture

Click **Log setup** from `/practice/trade/:id`, `/trade`, or `/backtester/chart`. The shared recap editor opens over the running session. Practice/Live use the current chart position or a blank observation. Replay prefers an open position, then the latest closed trade, then the cursor; its advanced source-candle evidence logger remains available alongside quick capture.

Open positions have no exit price/time or realized P&L. Verify the snapshot before saving. Reopening an identified trade in the same account/session edits its existing recap; unidentified positions cannot safely deduplicate. Saving never places/closes orders, pauses playback, or navigates away. Trading hotkeys cannot bubble out of the editor, but execution and quotes continue. Closed fills do not automatically finalize the recap.

## REST contract

Default base: `/api/trading-journal`. Use the existing authenticated API client; the server derives ownership from authentication, not a supplied user ID.

Deploy the complete application including `shared/journalRecap.js` and `shared/journalAnalytics.js`. The repository's selective `scripts/deploy/run.mjs sync` file list does not include this full feature change; use a complete source update/build, not that partial sync alone. Back up the database before applying additive migrations.

| Method/path | Response | Semantics |
| --- | --- | --- |
| GET `/entries` | `{success, entries}` | Summary records; excludes screenshots, retains screenshotCount |
| GET `/entries/:id` | `{success, entry}` | Full entry, including screenshot data |
| POST `/entries` | `{success, entry}` | Create; server generates ID |
| PUT `/entries/:id` | `{success, entry}` | Complete entry update, not JSON Merge Patch |
| DELETE `/entries/:id` | `{success}` | Owner-only deletion |
| GET `/strategies` | `{success, strategies}` | Owned playbooks; entry_conditions may be JSON text |
| GET `/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&source=all` | `{success, analytics}` | Curated journal only; inclusive day range, optional source filter |
| GET `/reviews/:kind/:start` | `{success, review, entries, analytics}` | daily/weekly review plus period evidence; weekly start must be Monday |
| PUT `/reviews/:kind/:start` | `{success, review}` | Complete review; version 0 to create, current version to update |

Playbook POST/PUT/DELETE operations also use `/strategies` through `journalAPI`. Built-in templates are client defaults, not auto-created server playbooks: their strategyId is null and their checklist is saved with the recap.

```ts
import { journalAPI } from '../api/journal.api'
import { createJournalDraft } from '../journal/journalCapture'

const controller = new AbortController()
const summaries = await journalAPI.listEntries(controller.signal)
const draft = createJournalDraft({
  playbook: 'My setup', symbol: 'NQ', notes: 'Waiting for confirmation',
})
draft.clientRequestId = crypto.randomUUID() // retain this ID and payload for a retry
const saved = await journalAPI.createEntry(draft)
const full = await journalAPI.getEntry(saved.id, controller.signal)
await journalAPI.updateEntry({ ...full, notes: 'Confirmation recorded' })
// On effect cleanup: controller.abort()
```

`JournalEntryRecord` in `src/api/journal.api.ts` is the payload contract. Numeric fields are strings; blank means unknown, not zero. Entry datetime is required; exit datetime is optional. The current UI uses local wall time without a timezone offset; a timezone-aware migration remains future work.

Sources: manual, practice, live, replay. sourceSessionId records an originating account/session; sourceTradeId identifies its position/trade when available. sourceContext contains chart timeframe, capture time, snapshot kind and bracket levels. Source metadata is descriptive, not authorization or proof of a broker fill.

### Recap, errors and images

- Recap: title, session, execution (taken/missed/observation), grade (A/B/C/blank), lesson, mistake tags, saved checklist, initial `riskDollars` and screenshots.
- Up to four PNG/JPEG/WebP inputs, each at most 15 MB before browser resizing to 1920 pixels and WebP compression.
- Server accepts at most 512 KiB decoded per image, checking MIME/base64/raster signatures. SVG and external URLs are rejected.
- A reverse proxy should allow at least 4 MB request bodies for four encoded images plus ordinary metadata. The preview uses 4 MB.
- Lists exclude images. **Fetch full detail before editing**; supplying a partial recap from a summary can remove screenshots.
- PUT omitting recap entirely preserves it for old clients. Supplying recap replaces that object, including its screenshots.
- Entry responses use `Cache-Control: private, no-store`. Images reside in SQLite; this is authenticated storage, not end-to-end encryption or object-storage scaling.
- Validation errors: 400 `{success:false,error}`. Missing/unowned entry: 404. Client methods encode IDs and support AbortSignal for reads.
- POST accepts optional `clientRequestId` (8–100 letters/digits/underscore/hyphen). Same owner/key/normalized payload returns the existing entry; a changed payload using that key returns 409. Keys are scoped to the retained entry, not permanent tombstones.
- Entry responses include `version`. PUT the last fetched version: different stale edits return 409 without overwriting. An identical stale payload returns the current entry without another write. Legacy clients omitting version are tolerated but cannot detect edits made since their own read.

### Analytics and period reviews

`journalAPI.analytics(filters, signal)`, `getReview(kind, start, signal)` and `saveReview(review)` are the shared typed client methods. Reviews store focusRule, bestExecution, mistake, notes, followedRules (yes/no/mixed/blank), and up to 200 entryIds owned by the user and within that period. Period end is exclusive; weeks begin Monday. Identical review retries succeed; changed stale versions return 409.

Analytics includes only taken, closed entries with nonblank finite recorded P&L and without `pnlBasis: gross`. An empty sample yields null rates, not a false zero. R = recorded net P&L / positive recorded initial dollar risk; no contract math is inferred. All-source results mix simulated/live records; use the source filter. Tag/condition groups overlap; mistake loss counts a losing tagged trade only once. Old unlabelled P&L is trusted as recorded, not broker-verified. Local recorded dates and a common dollar currency are assumed.

### Draft recovery, execution updates and chart evidence

The shared recap editor verifies the signed-in owner, then keeps a debounced IndexedDB draft scoped to user and entry (or source/session/position). Restore explicitly after reload; closing retains it, successful server save removes it. This is device-local recovery, not cloud synchronization or encryption. Quota/auth/storage failures show a warning. Unidentified entries share one draft per source/session. Review forms use explicit **Save review**, not recap autosave; save before leaving.

**Update from closed execution** fetches history on demand and previews changes. Applying changes only the draft; Save recap persists. Notes, screenshots, checklist, initial risk and original sourceTradeId remain intact; chosen ID is `sourceContext.executionId`. Practice displays stored gross and exit-fill fees but does not invent historical entry fees or net P&L. Replay history provides prices/size/times, not verified net P&L. Live only offers full-size opposing close fills, with exit commission only; partial fills are not paired. Net P&L stays blank for manual entry for all three adapters until an authoritative round-trip result is available. Verify the match; metadata is not broker reconciliation.

**Capture current chart** captures only the visible marked chart host, excluding account headers and the modal. It lazily loads capture code and shares image compression/limits with uploads. Screenshots retain capture time, resolution and replay cursor; up to 30 normalized arrow/level marks render at any image size. Keyboard arrows move endpoints, Shift+arrows move starts, Enter adds a mark. Capture/annotations add no market subscriptions. Unsupported or cross-origin chart content can require a manual screenshot upload.

## Socket conventions

Use `getWebSocketUrl` for deployment-aware socket URLs; socket paths are separate from REST `/api`. Preserve Upgrade forwarding in Vite/Nginx.

- `/backtester-ws`: replay initialization, cursor changes, candle steps and chart subscriptions.
- `/backtester/data-management-ws`: authenticated data-management operations and progress.
- Provider MDS/trade streams retain their provider-specific adapters; see the root README for replay message shapes.

The base browser client owns reconnect timers, heartbeat, parsing and physical socket cleanup. Subclasses handle parsed data through `handleCustomMessage` and refresh credentials through `buildWebSocketUrl`. Do not reimplement parsing or log token-bearing query strings. Old socket events cannot affect a replacement socket; disconnect retires CONNECTING sockets too.

The server separates parse errors from handler failures and awaits returned work, avoiding accidental double-dispatch. Async subclass handlers must return their promise to use base error handling. Never treat fill/order events as disposable quote updates.

Journal capture adds no market subscription or socket. Bundle reduction and lifecycle fixes are not a “zero lag” guarantee: measure feed age, p95 RTT, reconnect time, queue pressure and event loss before tuning live traffic.

## Isolated QA

Run `node scripts/qa/journal-preview.mjs`, open `http://127.0.0.1:3310/journal`, and sign in with arbitrary fixture credentials. `/scripts/qa/journal-capture.html` exercises synthetic Practice/Live/Replay captures with a ticking counter. Real journal controllers use in-memory SQLite; no broker or real account is connected. Stop with Ctrl+C; fixture data disappears. Never expose this unauthenticated fixture beyond localhost.
