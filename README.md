# Founder Lab — Business Simulation Game

Founder Lab is a seeded, data-driven React business simulator for learning how company decisions interact across customers, people, operations, finance, negotiation, funding, compliance, risk, growth and exit.

## Stack

**React + Vite.** The game is primarily dashboards, decisions, reports and simulation state, so React provides a clean mobile-friendly UI while the engine remains framework-independent.
**Why this stack:** Vite gives a fast build and simple GitHub Pages deployment; all business logic stays in engine/config modules rather than React components.

## Current build: Phase 5 complete

### Phase 1 — Core simulation
- Setup flow, capital tiers, modes, durations, goals, legal structure, location and business-plan scoring.
- Neighborhood Cafe as the first complete industry module.
- Seeded market, demand, seasonality, economic cycle, trends and price elasticity.
- Customer acquisition, churn, referrals, satisfaction, LTV, CAC and market share.
- P&L, cash, taxes, runway, valuation and bankruptcy.
- Four-week cause/effect management reports.

### Phase 2 — Hiring and team management
- Visible candidate skills/experience/salary asks plus hidden reliability, ambition, culture fit and work preferences.
- Interviews, reference checks, paid trials, offers, onboarding and ramp-up.
- Productivity, morale, burnout, loyalty, training, reviews, raises, promotions, work modes, layoffs and firing.
- Payroll and employee performance feed the operating model.

### Phase 3 — Negotiation
- Reusable engine for suppliers, landlords, clients, investors and candidates.
- Hidden walk-away point, mood, personality, preparation, leverage and relationship history.
- Anchor, split, bundle, deadline, information and walk-away tactics.
- Supplier, lease, client and candidate deals have actual downstream financial effects.

### Phase 4 — Marketing, sales, operations and competitors
- Channel-level marketing with saturation, CAC, awareness and ROAS.
- Delayed B2B lead → qualification → proposal → win pipeline.
- Inventory, working capital, supplier lead times, spoilage, stockouts, quality control and outsourcing.
- Three reactive competitors: price cutter, premium defender and copycat.

### Phase 5 — Funding, legal, risk, expansion and exit
- Funding sources: founder capital, business loan, grants, crowdfunding, angels and VC.
- Pitch focus, application delays, approvals/rejections and expiring term sheets.
- Debt amortization, interest, debt service, leverage and origination fees.
- Cap table, dilution, founder ownership and configurable ESOP pool.
- Equity rounds carry investor expectations.
- Basic balance sheet: cash, reserve, inventory/expansion assets, liabilities and book equity.
- Required licenses/policies with processing time, renewal, fines and possible shutdown.
- Insurance, preventive controls and protected emergency reserve.
- Expansion projects: second location, nearby-city entry, export channel and franchise pilot.
- Expansion consumes cash first and adds demand/capacity/revenue only after a build delay.
- Exit readiness uses age, revenue/profit, compliance, risk and succession readiness.
- Brokered company-sale review, buyer offer, transaction fees and founder proceeds after dilution.
- Bankruptcy now recognizes remaining financing/reserve options and a limited liquidity-distress grace period.
- Decision/event audit foundation logs player choices, alternatives, visible state before/after and system events for the later post-mortem/replay engine.

## Architecture

```text
src/
├── App.jsx
├── components/
│   ├── Dashboard.jsx
│   ├── HiringPanel.jsx
│   ├── TeamPanel.jsx
│   ├── NegotiationPanel.jsx
│   ├── MarketingPanel.jsx
│   ├── SalesPanel.jsx
│   ├── OperationsPanel.jsx
│   ├── CompetitorsPanel.jsx
│   ├── FundingPanel.jsx
│   ├── LegalPanel.jsx
│   ├── RiskPanel.jsx
│   ├── GrowthExitPanel.jsx
│   ├── MonthlyReport.jsx
│   ├── RippleMap.jsx
│   ├── MiniChart.jsx
│   └── SetupFlow.jsx
├── config/
│   └── gameConfig.json
├── data/
│   ├── industries/cafe.json
│   ├── hr/cafeRoles.json
│   ├── negotiation/negotiationConfig.json
│   ├── marketing/cafeMarketing.json
│   ├── sales/cafeSales.json
│   ├── operations/cafeOperations.json
│   ├── competitors/cafeCompetitors.json
│   ├── funding/cafeFunding.json
│   ├── legal/cafeLegal.json
│   ├── risk/cafeRisk.json
│   ├── expansion/cafeExpansion.json
│   └── exit/cafeExit.json
├── engine/
│   ├── businessPlan.js
│   ├── market.js
│   ├── customers.js
│   ├── employees.js
│   ├── hiring.js
│   ├── negotiation.js
│   ├── marketing.js
│   ├── sales.js
│   ├── operations.js
│   ├── competitors.js
│   ├── funding.js
│   ├── legal.js
│   ├── risk.js
│   ├── expansion.js
│   ├── exit.js
│   ├── finance.js
│   ├── logging.js
│   ├── report.js
│   ├── random.js
│   └── simulator.js
└── models/
    └── createGameState.js

scripts/
├── smoke-test.mjs
├── hr-test.mjs
├── negotiation-test.mjs
├── phase4-test.mjs
├── phase5-test.mjs
└── balance-test.mjs
```

Business logic belongs in the engine and JSON modules. UI components dispatch actions and render state; they do not contain simulation formulas.

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

## Automated tests

```bash
npm test
```

Or:

```bash
npm run test:smoke
npm run test:hr
npm run test:negotiation
npm run test:phase4
npm run test:phase5
npm run test:balance
```

The Phase 5 integration test verifies funding/dilution/debt, legal enforcement that causes real financial damage, insurance/reserves, delayed expansion, brokered exit and decision logging.

The 104-week balance benchmark uses 60 deterministic seeds per policy. Current results:

| Policy | Win | Bankruptcy | Horizon without win |
|---|---:|---:|---:|
| Do nothing | 0% | 100% | 0% |
| Reckless | 0% | 100% | 0% |
| Sensible | 95% | 0% | 5% |

The test fails if sensible play becomes guaranteed.

## GitHub Actions / Pages

Every push to `main` automatically runs all tests, builds the production app and deploys GitHub Pages.

Manual run:
1. Open **Actions**.
2. Choose **Founder Lab - Test, Build & Deploy**.
3. Choose **Run workflow** on `main`.

Live game:

https://rahulrtk74747474-glitch.github.io/BusinessGame/

## Phase boundary

**Phase 5 is complete. Phase 5B has not been started.**

Next: **Phase 5B — acquisition mode**: procedural business listings, internally reconciled financials, hidden flaws, paid/time-delayed due diligence, valuation tools, seller negotiation, deal structuring, integration and portfolio management.

The requested hidden-flaw distribution test (about 40% flawed / 20% genuinely good) and the test proving missed flaws cause later damage belong to Phase 5B because the flaw/listing generator does not exist before that phase.
