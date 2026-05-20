# Auren

**Repository:** [github.com/parbhatc/Auren](https://github.com/parbhatc/Auren)

**Practice-only** trading platform. A safe layer between you and your real prop firm or eval account.

Create simulated **eval** and **funded** accounts. Trade with live charts and real market data. If you overtrade, revenge trade, or blow the account, your real prop firm account stays untouched.

## Screenshots

### Practice hub

Create and manage simulated accounts, connect market data, and pick eval or funded rules.

![Practice hub](images/dashboard.png)

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

## What Auren does

| Feature | Description |
|---------|-------------|
| Simulated eval / funded accounts | Profit targets, trailing max loss (EOD), consistency rules, min profitable days |
| Live charts | TradingView Charting Library with market data from your connected feed |
| Simulated execution | Orders and P/L stay on Auren. Nothing is sent to a live prop firm |
| Stats & news | Session stats, calendar, and economic news on the practice trade layout |

There is **no live prop-firm order routing** in this repo. When you are ready for a real eval, trade on your firm directly.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Practice hub: create and manage accounts |
| `/trade/:id` | Trading terminal (chart + trade panel) |
| `/trade/:id/stats` | Session statistics |
| `/trade/:id/news` | Economic news |
| `/settings/props` | Connect market data for charts |
| `/settings/layout` | Customize practice layout |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20 LTS recommended)
- npm 9+
- A **TradingView Charting Library** license ([request access](https://www.tradingview.com/charting-library/))
- (Optional) Market data account for live/delayed futures charts

## Local installation

### 1. Clone the repository

```bash
git clone https://github.com/parbhatc/Auren.git
cd Auren
```

### 2. Install dependencies

**Frontend** (repo root):

```bash
npm install
```

**Backend**:

```bash
cd server
npm install
cd ..
```

### 3. TradingView Charting Library (required for charts)

The charting library is **not included** in this repository (TradingView license). You must add your own copy after clone.

1. Sign in at [TradingView Charting Library](https://www.tradingview.com/charting-library/) and download the library for your license type.
2. Extract the archive. You should get a folder named `charting_library` containing `charting_library.js` (or `charting_library.standalone.js`) and a `bundles/` directory.
3. Copy that entire folder into the project:

   ```text
   Auren/
   └── public/
       └── charting_library/
           ├── charting_library.js
           ├── charting_library.standalone.js
           ├── bundles/
           └── …
   ```

4. Confirm the app can load it: start the dev server (below) and open a practice trade page. If the folder is missing, you will see a placeholder instead of a chart.

`public/charting_library/` is listed in `.gitignore` so your licensed copy is never committed.

### 4. Environment variables

**Frontend** (optional). Copy the example file:

```bash
cp .env.example .env
```

Default dev setup uses the Vite proxy; you usually do not need to set `VITE_API_URL`.

**Backend** (required for auth and API):

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

### 5. Run locally

Open **two terminals**.

**Terminal 1 – API**

```bash
cd server
npm start
```

API: `http://localhost:3001`

**Terminal 2 – Web app**

```bash
npm run dev
```

App: `http://localhost:3000` (Vite proxies `/api` to the backend)

### 6. First-time use

1. Register or log in at `http://localhost:3000`.
2. Go to **Settings → Market data** and connect your chart data account (practice orders remain simulated).
3. On the **Practice hub**, create a **25K Eval** (or other size) account.
4. Open **Trade** on that account and practice on `/trade/:id`.

## Production build

```bash
npm run build
```

Static output is in `dist/`. Serve it behind your API (same origin or configure `CORS_ORIGIN` on the server). The charting library must still be present under `public/charting_library/` at build time so it is copied into the build output.

## Project structure

```text
Auren/
├── src/                 # React + TypeScript frontend
├── server/              # Express API, SQLite, auth
├── public/
│   └── charting_library/  # You add this (gitignored)
├── images/              # README screenshots
└── package.json
```

## License & third-party notices

- **Auren** application code: see repository license (if provided).
- **TradingView Charting Library**: separate license from TradingView. Do not redistribute the library without permission.
- **Market data**: subject to your provider’s terms; used only as a chart feed in this project.

## Contributing

Issues and pull requests are welcome. Do not commit secrets, `server/data/`, or `public/charting_library/`.
