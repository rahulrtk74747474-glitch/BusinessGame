# Phase 5 automated balance results

Test setup: Neighborhood Cafe, Standard mode, $50,000 starting capital, rented shop, LLC, 104 weeks, cumulative-profit goal from the game config. Each strategy ran across 60 deterministic seeds after integrating Phases 1–5.

| Policy | Runs | Win rate | Bankruptcy rate | Horizon ended without win | Avg ending cash | Avg cumulative profit | Avg active customers | Avg valuation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Do nothing | 60 | 0% | 100% | 0% | -$3,988 | -$51,261 | 221 | $39,720 |
| Reckless | 60 | 0% | 100% | 0% | -$7,697 | -$66,056 | 3,768 | $340,298 |
| Sensible | 60 | 95% | 0% | 5% | $101,312 | $65,486 | 2,164 | $407,771 |

The sensible benchmark manages pricing, channel mix, sales/operations settings, supplier/landlord negotiation, compliance timing and a late-maturity expansion opportunity. It still remains exposed to seeded economic, demand, competitor, supplier and compliance variance.

The results satisfy the required behavior:
- do-nothing fails;
- reckless behavior fails despite strong customer counts/valuation signals;
- sensible behavior usually wins;
- sensible behavior is not guaranteed to win.

All assertions live in `scripts/balance-test.mjs`, so later phases cannot silently destroy these balance properties.
