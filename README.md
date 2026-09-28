# Founder Lab — Phase 1

## Stack choice
**Web (React + Vite).** React is the best fit for a mobile-friendly, dashboard-heavy management simulator with reusable screens and fast iteration.
**Why not Flutter/Pygame here:** the core game is forms, reports, charts, and decisions rather than frame-by-frame graphics; a web build also makes later PWA/mobile packaging straightforward.

## Phase 1 assumptions

1. Phase 1 ships one playable industry: **Neighborhood Cafe**. More industries remain data modules for Phase 6.
2. One turn is one week. A management “month” is four turns for report cadence.
3. Currency is USD for the first balancing pass. The architecture does not tie formulas to a currency.
4. Business-structure liability behavior is realistic in concept, but tax rates are intentionally simplified educational model rates. Real tax depends on jurisdiction, deductions, elections, and owner circumstances.
5. Funding is not implemented until Phase 5, so in Phase 1 `cash <= 0` means bankruptcy because no financing option exists yet.
6. Employees, negotiation, competitors, legal events, and random scenario packs are intentionally not implemented in this phase.
7. Exact market demand, economic index, and trend index live inside simulation state but are not shown numerically to the player. The UI exposes interpretable signals and reports instead.
8. Global tuning lives in `src/config/gameConfig.json`; industry-specific economics live in the industry data file. React components do not contain simulation formulas.
9. The difficulty multiplier is stored and displayed now; the complete scoring/meta system is Phase 6.
10. Randomness is seeded and controlled, so balance tests are reproducible and there are no scripted wins.

## Folder structure

```text
business-sim-phase1/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── BALANCE_RESULTS.md
├── scripts/
│   ├── balance-test.mjs
│   └── smoke-test.mjs
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── styles.css
    ├── components/
    │   ├── Dashboard.jsx
    │   ├── MiniChart.jsx
    │   ├── MonthlyReport.jsx
    │   └── SetupFlow.jsx
    ├── config/
    │   └── gameConfig.json
    ├── data/
    │   └── industries/
    │       └── cafe.json
    ├── engine/
    │   ├── businessPlan.js
    │   ├── customers.js
    │   ├── finance.js
    │   ├── market.js
    │   ├── random.js
    │   ├── report.js
    │   └── simulator.js
    └── models/
        └── createGameState.js
```

## What Phase 1 implements

- Setup: mode, $10k/$50k/$100k capital, 52/104/260 weeks, goal, target, business structure, location/model, simple business plan.
- Business-plan scoring with actionable feedback.
- Hidden market variables: demand, seasonality, economic cycle, trend, controlled weekly noise.
- Price elasticity and location effects.
- Customer engine: awareness, paid/organic acquisition, CAC, referrals, churn, satisfaction, LTV, capacity, lost orders, market share.
- Finance engine: revenue, COGS, fixed/discretionary costs, gross margin, operating profit, tax accrual/payment, cash, cumulative profit, runway, simplified valuation.
- Goal engine for profit, valuation, active customers, or market share.
- Bankruptcy and time-horizon completion states.
- Mobile-friendly dashboard with weekly decision controls and trend charts.
- Four-week management report that explains cause → effect, not just the numbers.
- Deterministic simulation seeds for reproducible testing.
- Automated smoke and balance tests.

## Core formula design

The simulation is deliberately data driven. The engine combines:

- **Market demand** = base demand × seasonality × economy × trend × price elasticity × controlled noise.
- **Acquisition** = paid acquisition from marketing/CAC + organic acquisition from awareness + referrals.
- **Churn** reacts to satisfaction and premium pricing.
- **Orders** are constrained by customer intent, available market demand, and physical capacity.
- **Satisfaction** responds gradually to value, quality spend, service baseline, and capacity pressure.
- **Cash** changes from operating profit and periodic tax payments, not from accounting profit alone.
- **Valuation** uses trailing annualized revenue, positive profit, and customer-base components.

All tunable coefficients are in config/industry data, not embedded in UI components.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

For a production build:

```bash
npm run build
npm run preview
```

## Automated tests

```bash
npm test
```

Or separately:

```bash
npm run test:smoke
npm run test:balance
```

`test:smoke` checks 216 combinations across mode, capital, structure, and location for numeric/bounds errors.

`test:balance` runs 60 seeded 104-week games for each of three policies and asserts:

- do-nothing has a 0% win rate,
- reckless usually goes bankrupt,
- sensible usually wins,
- sensible never has a 100% guaranteed win rate in the test set.

## What to test manually

1. Start with each capital tier and confirm smaller capital feels less forgiving.
2. Change price above/below the reference price and watch order volume and margin respond differently.
3. Stop marketing and quality spend and observe awareness/satisfaction deterioration over time.
4. Overspend on marketing at a low price and confirm cash can collapse even while customer count grows.
5. Use a balanced price/marketing/quality strategy and confirm reports explain the resulting changes.
6. Compare home/shared/rented/online locations for cost, capacity, and awareness trade-offs.
7. Compare sole proprietor/LLC/corporation for admin cost, tax treatment, and liability description.
8. Reach each goal type and verify the run ends as a win.
9. Allow cash to fall below zero and verify bankruptcy.
10. Confirm the four-week report explains revenue, awareness, satisfaction, capacity, margin, and profit drivers.

## Phase boundary

This repository intentionally stops after Phase 1. Hiring/team management begins in Phase 2 only after the user says **continue**.

## GitHub Actions: run whenever you want

This repository includes `.github/workflows/founder-lab.yml`.

It runs automatically whenever code is pushed to `main`, and it can also be run manually:

1. Open this repository on GitHub.
2. Open **Actions**.
3. Select **Founder Lab - Test, Build & Deploy**.
4. Click **Run workflow** and choose the `main` branch.
5. The workflow installs dependencies, runs smoke/balance tests, builds the React game, uploads a downloadable production artifact, and deploys the build to GitHub Pages.

### One-time GitHub Pages setting

If GitHub Pages has not been enabled for this repository yet, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. After that, rerun the workflow from the Actions tab. This is a one-time repository setting; future pushes and manual workflow runs will deploy automatically.

The Vite configuration automatically uses `/BusinessGame/` as the production base path during GitHub Actions while keeping `/` for local development.
