# Auren

**Practice-only** futures trading simulator. A safe layer between you and your real prop firm or eval account.

Create simulated **eval** and **funded** accounts, trade on live charts with real market data, and let rules, drawdowns, and lockouts play out on Auren. If you overtrade, revenge trade, or blow the account, your real prop firm balance stays untouched.

## Features

### Auren (home)

- Simulated **25K / 50K / 100K** eval and funded accounts: create, reset, delete
- **Custom rules** when opening an account: profit target, max loss, drawdown type, consistency, commissions, contract caps
- **Prop firm presets** (Tradesea live; more firms listed as they are wired up)
- Account states: **active**, **passed**, **blown** with dashboard stats
- Embedded **settings**: profile, market data, keyboard shortcuts, timezone

### Trading terminal

- **TradingView** charts with Tradesea market data (you supply the Charting Library license)
- **Simulated execution**: orders and P/L stay on Auren; nothing routes to a live eval
- **DOM ladder** and order ticket: market, limit, join bid/ask, close, reverse, flatten, cancel-all
- **Draggable SL/TP** on the chart; bracket tracking when offline (where supported)
- **Detachable** trade panel and **resizable** layout regions
- **Eval progress** on-chart: balance, trailing max loss, profit target, consistency

### Session discipline

- **Daily loss lockout** (session resets 6pm ET)
- **Max trades per session** (optional)
- **Self-lock** presets or custom duration; manual unlock when ready
- **Lockout card** and header controls on the trade screen

### Stats and news

- **Evaluation dashboard**: drawdown cushion, consistency, profitable days, trade history
- **Economic calendar** with currency and impact filters while you practice

### Market data

- Connect **Tradesea** via email OTP or manual session cookies
- **MDS WebSocket** stream: candles, last price, depth, quotes
- Connection status, auto-reconnect, and **connect on limit** (retries when the firm connection cap is hit)
- **Offline mode** option to hold an MDS slot and track brackets while away from the chart

### Mobile

- Bottom nav: chart, stats, news, order entry
- **Quick trade** card with minimize / expand and optional **floating** scalp pad
- Mobile order sheet and touch-friendly qty chips

### Platform

- Dark / light theme
- Auth: register, login, email verification, password reset
- Admin: users, roles, server config (self-hosted)
- English UI copy via `en.json`

There is **no live prop-firm order routing** in this project. When you are ready for a real eval, trade on your firm directly.

## Screenshots

### Auren

Create and manage simulated accounts, connect market data, and pick eval or funded rules.

![Auren home](images/dashboard.png)

### Create account

Set profit target, drawdown, consistency, and contract limits when opening a new practice eval.

![Create practice account](images/create_practice_account_modal.png)

### Trading terminal

Chart, trade panel, DOM ladder, and simulated fills with position lines on the chart.

![Trading terminal](images/chart.png)

### Order panel

Quick trade, DOM, and order entry in the docked trade panel.

![Order panel](images/order_panel.png)

### Mobile chart

Practice on a phone-sized layout with chart and scalp controls.

![Mobile chart](images/mobile_chart.png)

### Mobile stats

Evaluation progress and session stats on mobile.

![Mobile stats](images/mobile_stats.png)

### Economic news

Session calendar and headlines while you practice.

![Economic news](images/news.png)

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Auren home: accounts, market data, settings |
| `/trade/:id` | Trading terminal (chart + trade panel) |
| `/trade/:id/stats` | Session statistics and eval progress |
| `/trade/:id/news` | Economic news calendar |
| `/settings` | Profile and account settings |
| `/settings/props` | Market data / prop firm connection |
| `/settings/keyboard-shortcuts` | Terminal hotkeys |
| `/settings/utils` | Timezone and utilities |
| `/login`, `/register` | Authentication |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20 LTS recommended)
- npm 9+
- A **TradingView Charting Library** license ([request access](https://www.tradingview.com/charting-library/))
- (Optional) Tradesea account for live/delayed futures chart data

## Quick start

### 1. Clone and install

```bash
git clone <repository-url>
cd Auren
npm install
cd server && npm install && cd ..
```

`package-lock.json` is not committed. Run `npm install` in the repo root and in `server/` to generate lockfiles locally.

### 2. TradingView Charting Library (required for charts)

The charting library is **not included** (TradingView license). After clone:

1. Download from [TradingView Charting Library](https://www.tradingview.com/charting-library/) for your license.
2. Copy the extracted `charting_library` folder (with `charting_library.js` and `bundles/`) to:

   ```text
   public/charting_library/
   ```

3. Start the dev server and open a practice trade page. A placeholder appears if the folder is missing.

`public/charting_library/` is gitignored so your licensed copy is never committed.

### 3. Environment

**Frontend** (optional):

```bash
cp .env.example .env
```

Default dev setup uses the Vite proxy; you usually do not need `VITE_API_URL`.

**Backend** (required):

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=replace-with-a-long-random-secret
```

Never commit `.env` files or `server/data/`.

### 4. Email (optional)

For signup and password reset, configure SMTP in `server/data/config.json` (gitignored). Without SMTP, the API logs email payloads to the console. See [server/README.md](server/README.md#setup).

### 5. Run locally

**Terminal 1 — API**

```bash
cd server
npm start
```

API: `http://localhost:3001`

**Terminal 2 — Web app**

```bash
npm run dev
```

App: `http://localhost:3000` (Vite proxies `/api` to the backend)

### 6. First-time use

1. Register or log in.
2. Open **Settings → Market data** and connect Tradesea for charts (orders remain simulated).
3. On **Auren**, create a **25K Eval** (or other size).
4. Open **Trade** on that account.

## Production build

```bash
npm run build
```

Output is in `dist/`. Serve it behind your API (same origin or set `CORS_ORIGIN` on the server). The charting library must exist under `public/charting_library/` at build time so it is copied into the build.

## Project structure

```text
Auren/
├── src/                    # React + TypeScript frontend
├── server/                 # Express API, SQLite, auth, practice engine
├── public/
│   └── charting_library/   # You add this (gitignored)
├── images/                 # README screenshots
└── package.json
```

## License and third-party notices

- **Auren** application code: see repository license (if provided).
- **TradingView Charting Library**: separate license from TradingView. Do not redistribute without permission.
- **Market data**: subject to your provider’s terms; used as a chart feed in this project.

## Contributing

Issues and pull requests are welcome. Do not commit secrets, `server/data/`, `public/charting_library/`, local check scripts, or lockfiles listed in `.gitignore`.
