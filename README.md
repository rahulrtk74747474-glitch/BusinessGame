# Founder Lab - Business Simulation Game

A data-driven React business simulator that teaches a beginner how company decisions interact across finance, customers, operations, and people.

## Stack

**React + Vite.** The game is dashboard/report/decision heavy, so a web architecture gives fast iteration, mobile-friendly UI, simple GitHub Pages deployment, and clean separation between simulation logic and presentation.

## Current build: Phase 2 complete

### Phase 1
- Setup flow: mode, capital, duration, goal, entity structure, location, business plan.
- One playable industry: Neighborhood Cafe.
- Hidden market demand, seasonality, economic cycle, trends and price elasticity.
- Customer acquisition, CAC, churn, referrals, satisfaction, LTV and market share.
- P&L, cash, tax accrual/payment, runway, valuation and bankruptcy.
- Four-week cause/effect management reports.
- Automated smoke and balance tests.

### Phase 2
- Data-driven HR role module in `src/data/hr/cafeRoles.json`.
- Candidate pool with visible skill, experience and salary ask.
- Hidden reliability, ambition, culture fit and work preference.
- Interviews and reference checks reveal signals rather than exact hidden values.
- Two-week paid trial periods provide direct performance evidence.
- One-shot salary/perks/equity offers can be accepted, countered or declined.
- Employee ramp-up: new hires take roughly 2-3 months to reach full contribution.
- Productivity uses skill x morale x training x manager quality x ramp-up x reliability/work-mode fit.
- Weekly payroll and benefits flow into finance.
- Roles affect operational capacity, service quality, awareness and marketing efficiency.
- Morale, burnout, loyalty and quit risk evolve each week.
- Training, performance reviews, raises and promotions.
- On-site/hybrid/remote handling for eligible roles.
- Firing and layoffs with severance, team-morale effects and documentation/legal-risk signals.
- Decision ripple map shows cross-field effects.
- Hiring and Team screens added to the mobile-friendly UI.
- Monthly reports now explain payroll, headcount, team productivity and burnout.

The Phase 2 offer screen intentionally uses a compact one-shot offer model. **Phase 3 is the full negotiation engine** with preparation, leverage, hidden walk-away points, personalities and tactics.

## Architecture

```text
src/
├── components/              # UI only
│   ├── Dashboard.jsx
│   ├── HiringPanel.jsx
│   ├── TeamPanel.jsx
│   ├── RippleMap.jsx
│   ├── MonthlyReport.jsx
│   ├── MiniChart.jsx
│   └── SetupFlow.jsx
├── config/
│   └── gameConfig.json      # Global tuning
├── data/
│   ├── industries/
│   │   └── cafe.json        # Cafe economics
│   └── hr/
│       └── cafeRoles.json   # HR roles/tuning
├── engine/
│   ├── businessPlan.js
│   ├── customers.js
│   ├── employees.js
│   ├── finance.js
│   ├── hiring.js
│   ├── market.js
│   ├── random.js
│   ├── report.js
│   └── simulator.js
└── models/
    └── createGameState.js

scripts/
├── smoke-test.mjs
├── hr-test.mjs
└── balance-test.mjs
```

Business logic belongs in the engine and JSON modules, not React components.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run preview
```

## Tests

Run everything:

```bash
npm test
```

Individual suites:

```bash
npm run test:smoke
npm run test:hr
npm run test:balance
```

The HR integration test covers hidden-trait safety in the public candidate view, due diligence, trials, offers, payroll, ramp-up, training, raises, reviews, ripple maps and termination.

The balance test still simulates 60 deterministic 104-week games for each policy: do-nothing, reckless and sensible. Its assertions require do-nothing to fail, reckless to usually fail, sensible to usually win, and sensible to remain non-guaranteed.

## GitHub Actions / GitHub Pages

`.github/workflows/founder-lab.yml` automatically runs tests, builds the production game and deploys GitHub Pages on every push to `main`.

Manual run:

1. Open **Actions**.
2. Choose **Founder Lab - Test, Build & Deploy**.
3. Tap **Run workflow**.
4. Select `main`.
5. Tap **Run workflow**.

Live site:

https://rahulrtk74747474-glitch.github.io/BusinessGame/

## Phase boundary

**Phase 2 is complete. Phase 3 has not been started.**

Next phase: full negotiation engine for suppliers, landlords, clients, investors and job candidates.
