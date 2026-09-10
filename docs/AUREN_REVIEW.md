# Auren feature inventory and review

Reviewed September 10, 2026 using source and an isolated preview. This is not a complete security audit or production broker/latency test.

## Current capabilities

| Area | Implemented features |
| --- | --- |
| Practice accounts | 25K/50K/100K evaluation/funded accounts; configurable rules/IDs, reset/delete, active/passed/blown lifecycle |
| Dashboard | Balance, P&L, history/calendar, drawdown cushion, consistency and evaluation progress |
| Execution | Shared Practice/Tradesea Live terminal; market/limit, bid/ask joins, close/reverse/flatten/cancel, chart SL/TP and DOM |
| Charts | BetterweightChartPro drawings/indicators/layouts, levels/FVG and custom setup paper-trading integration |
| Discipline | Daily loss, max trades, session boundaries, self-lock, account-state feedback |
| Providers | Tradesea session/OTP, account discovery, MDS candles/quotes/depth; TradingView data/auth/history adapters |
| Replay | CSV history, sessions, play/pause/step/speed, date navigation, timeframes, simulated execution/statistics |
| Data admin | Symbol configuration, inventory, TradingView/Tradesea downloads and updates with progress |
| Journal | Curated CRUD, month/day grouping, search, result/playbook/execution filters, checklist/notes, risk/source context, historical chart review |
| New recap fields | Four sweep/FVG/SMT/IFVG templates, screenshots/captions, taken/missed/observation, process grade, mistakes, next-session lesson |
| In-session logging | Log setup in Practice/Live/Replay; open-position prefill and same identified trade editing; advanced Replay source-candle evidence retained |
| Playbooks | Named strategies and typed condition builder; saved recaps preserve their original checklist |
| Analytics | Journal net P&L, expectancy, win rate, profit factor, recorded-risk R distribution; playbook/condition/session/grade/source/timeframe/mistake breakdowns; separate Practice time-window metrics |
| Daily/weekly reviews | Journal-linked evidence, adherence, best execution, recurring mistake, next focus and previous-period carry-forward; Monday-based weeks |
| Capture durability | Per-user local recap draft recovery, create retry IDs, optimistic versions, explicit closed-execution preview/update |
| Chart evidence | On-demand chart-only capture, uploads, captions, timeframe/cursor metadata, keyboard/pointer arrow and level annotations |
| News | Economic calendar with currency/impact filters |
| Workspace | Theme/navigation, resizable/detachable panels, mobile order sheet/quick trade/floating pad, shortcuts/timezone/settings |
| Platform | Login/register, email verification/reset, roles/users/config administration, deployment tooling |

Connected Tradesea live execution can affect real accounts. Practice and replay remain simulated; the old blanket “practice-only” README description was corrected.

## Completed improvements

- Extracted shared workspace primitives/active-account hook and journal list/editor/review/chart from the large workspace page; removed unused legacy journal rendering.
- Centralized playbook normalization, condition handling, defaults, recap validation and capture mapping. Non-JSX socket clients now use `.ts`; compatibility re-exports remain.
- Added blank templates based on the reference notebook's setup/checklist/day structure, without importing private trade records.
- Added bounded screenshot uploads, lean summary/full-detail API responses, additive migration, cancellation, validation and save errors.
- Added the shared in-session editor without remounting the terminal or subscribing to quotes. Replay now prioritizes an active position over an older closed trade.
- Fixed stale socket events, connecting-socket cleanup, refreshed reconnect credentials, duplicated parsing and server handler double-dispatch/error handling.
- Fixed owner scoping on legacy playbook/daily-review update responses: previously zero-row UPDATEs could still return another user's record through an unscoped SELECT.
- Stopped automatic import of unowned `auren-playbooks` localStorage data. Existing local-only data remains preserved but needs an explicit ownership-confirmed import path.
- Lazy-loaded heavy screens: main production JS approximately 1,254 → 813 kB, gzip 320 → 212 kB. This is bundle-size evidence, not a live-latency measurement.

- Replaced placeholder mistake-cost/untagged analytics with shared journal aggregation. Open, missed, observation, blank and explicitly gross-only results do not inflate measured performance. R requires recorded initial dollar risk; overlapping tag samples are labeled.
- Added `/journal/reviews` and authenticated review APIs with period/ownership validation, evidence links, focus carry-forward and version-protected explicit saves.
- Added owner-scoped IndexedDB recap drafts, visible recovery/error status and stable create request IDs. Stale different updates return 409; identical update retries return the saved record without another write.
- Added read-only closed-execution selection and before/after preview; evidence and original position identity remain intact. Practice history contains exit fees only; no adapter currently supplies a verified round-trip net result, so imported net P&L stays blank for manual entry.
- Added chart-only screenshot capture with up to 30 normalized arrow/level marks per image and shared rendering for editor/detail. Capture is lazy and on demand, never a quote subscription.

## Remaining findings

1. **High: normalize trade/P&L semantics.** Curated `journal_entries`, legacy `trades`, Practice and Replay are separate models. New analytics uses curated entries only, excludes explicitly gross snapshots, and trusts previously recorded unlabelled values. Audit old records before treating them as verified net results. Legacy trade math is still not a canonical futures ledger.
2. **High: broker reconciliation.** Live update only offers full-size opposing close fills; it does not pair partial fills or prove position identity. Practice stores exit commission only; Live/replay history also lacks authoritative net P&L in these adapters. Users must confirm the selected fill and enter net results; no background auto-finalization occurs.
3. **Medium: durability boundaries.** Recap drafts are local to a browser/device, require verified ownership, and are not encrypted or cross-device synced. Review forms use explicit Save review, not recap autosave. Unidentified captures share one draft per source/session and cannot reliably deduplicate separate trades. Different stale saves keep the draft and require reload/reconciliation.
4. **Medium: timestamps.** Local datetime inputs lack an offset. Migrate deliberately to UTC plus a recorded trading timezone, preserving old interpretation.
5. **Medium: scale/latency.** Main bundle still exceeds 500 kB; provider load was not benchmarked. Add feed-age/RTT/queue/reconnect metrics. Lists are unpaginated and images live in SQLite; use quotas/pagination/object storage when needed.
6. **Medium: analytics interpretation.** All-source results combine simulated and live records; source filters separate them. Tag/condition groups overlap and are associations, not proof a mistake caused a loss. Values assume the recorded dollar currency; multi-currency conversion is not implemented.
7. **Medium: verification.** Global strict typing is disabled and provider boundaries contain `any`. Extend contracts and provider/end-to-end tests incrementally; a broader auth/storage/security audit is still worthwhile.

## Best additions next

### Delivered in this follow-up

1. Real setup analytics: expectancy, R distribution, win rate by playbook/condition/session/process grade, with sample counts and missing-data labels.
2. Daily/weekly review workflow: linked evidence, best execution, recurring mistake, one focus rule; missed setups separated from executed trades.
3. Update recap from closed execution: explicit preview of fills/size/fees/P&L changes, preserving notes/screenshots and never sending orders.
4. Autosave/recovery and retry-safe saves, with clear save status and conflict warnings.
5. Direct chart capture and annotation: before/after images, arrows/levels, timeframe and cursor metadata.

### Still proposed

- Custom template sections for preparation, entry, management and review.
- CSV/JSON import/export, stable IDs, duplicate handling and backup/restore.
- Rule adherence, MFE/MAE, hold time, slippage/commission analysis with explicit definitions.
- Replay bookmarks/drills, hidden-outcome review, separate training/evaluation periods.
- Session prep: levels, planned scenarios, news reminders and understandable rule/lockout explanations.
- Stale-feed warnings and lightweight latency diagnostics.
- Screenshot quotas, paginated search and authenticated object storage at scale.
- Onboarding for unavailable data, keyboard accessibility and mobile evidence capture.

The “Still proposed” items are ideas, not implemented-feature claims. Prioritize reliable data and useful review over additional disconnected dashboards.

## Verification

- 103 tests cover recap persistence/ownership, analytics exclusions/R, concurrent retry/version handling, review period/ownership checks, annotations, the Practice exit-fee/net distinction and socket lifecycle regressions.
- TypeScript and Vite production build pass using installed dependencies, without automatically updating BWC.
- Browser QA covered screenshot upload/save/reload, blank confirmations, note persistence, synthetic Practice/Live/Replay saves, same-trade editing and a 390px editor. The fixture's ticking state continued while the editor was open.
- Follow-up browser QA restored a recap draft after reload, captured a synthetic chart, saved an arrow annotation, applied a Practice execution preview, verified real analytics totals, saved/reloaded a linked daily review and saved a Monday-based weekly review. Reviewed mobile reviews at 390px. This is synthetic integration QA, not a production broker test.
- Existing warnings remain: main chunk size, runtime `/css/app.css`, SignalR annotations, empty chart-vendor chunk.
- No real orders, deployment or production latency benchmark; preexisting changes/scratch scripts preserved. No commit or push.

See [API and streams](API_AND_STREAMS.md) for usage, contracts and the isolated QA harness.
