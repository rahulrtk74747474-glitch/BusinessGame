# Phase 1 automated balance results

Test setup: Neighborhood Cafe, Standard mode, $50,000 starting capital, rented shop, LLC, 104 weeks, cumulative-profit target of $65,000. Each policy was run over 60 deterministic seeds.

| Policy | Runs | Win rate | Bankruptcy rate | Horizon ended without win | Avg ending cash | Avg cumulative profit |
|---|---:|---:|---:|---:|---:|---:|
| Do nothing | 60 | 0% | 100% | 0% | -$352 | -$50,352 |
| Reckless | 60 | 0% | 100% | 0% | -$1,629 | -$51,629 |
| Sensible | 60 | 95% | 0% | 5% | $117,065 | $65,338 |

Additional averages:

| Policy | Avg active customers | Avg valuation |
|---|---:|---:|
| Do nothing | 198 | $38,423 |
| Reckless | 3,807 | $229,043 |
| Sensible | 3,834 | $422,305 |

Interpretation: the reckless policy demonstrates an intentional teaching point—customer growth and even a large implied valuation do not prevent insolvency when price and acquisition spending destroy cash. The sensible policy is strongly favored, but 5% of seeded runs still miss the goal by week 104, so success is not scripted.

The assertions in `scripts/balance-test.mjs` fail the test if these broad design requirements stop being true after future tuning.
