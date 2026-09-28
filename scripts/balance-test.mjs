import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';

const baseSetup = {
  mode: 'standard',
  startingCapital: 50000,
  duration: 104,
  goal: 'profit',
  goalTarget: config.goals.profit.defaultTarget,
  structure: 'llc',
  location: 'rented',
  plan: {
    idea: 'Neighborhood cafe focused on repeat customers and consistent quality.',
    targetCustomer: 'Nearby residents and office workers who buy coffee several times per week.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.baseVariableCostPerOrder
  }
};

function policy(name, state) {
  if (name === 'do-nothing') {
    return { price: industry.referencePrice, marketingSpend: 0, qualitySpend: 0 };
  }

  if (name === 'reckless') {
    return {
      price: state.week < 20 ? 5.25 : 6.25,
      marketingSpend: state.finance.cash > 8000 ? 2300 : 1200,
      qualitySpend: 700
    };
  }

  // A competent but imperfect policy: it protects gross margin, invests in growth
  // when cash permits, and cuts acquisition spend if LTV/CAC becomes unattractive.
  const cash = state.finance.cash;
  const satisfaction = state.customers.satisfaction;
  const active = state.customers.active;
  const marketShare = state.customers.marketShare;

  let price = satisfaction > 0.73 ? 10.75 : 10.0;
  if (marketShare < 0.12 && active < 180) price -= 0.5;

  let marketingSpend = cash > 30000 ? 520 : cash > 16000 ? 320 : 120;
  if (state.customers.estimatedLtv > 0 && state.customers.estimatedLtv < state.customers.effectiveCAC * 2.2) {
    marketingSpend *= 0.55;
  }
  if (active > 330) marketingSpend *= 0.65;

  const qualitySpend = satisfaction < 0.70 ? 260 : satisfaction > 0.80 ? 140 : 190;
  return { price, marketingSpend, qualitySpend };
}

function runOne(name, seed) {
  let state = createGameState(baseSetup, config, industry, seed);
  while (state.status === 'running') {
    state = advanceWeek(state, policy(name, state), config, industry);
  }
  return {
    name,
    seed,
    status: state.status,
    week: state.week,
    cash: state.finance.cash,
    cumulativeProfit: state.finance.cumulativeProfit,
    customers: state.customers.active,
    valuation: state.finance.valuation
  };
}

const names = ['do-nothing', 'reckless', 'sensible'];
const seeds = Array.from({ length: 60 }, (_, i) => 1000 + i * 97);
const summaries = [];

for (const name of names) {
  const rows = seeds.map((seed) => runOne(name, seed));
  const wins = rows.filter((r) => r.status === 'won').length;
  const bankruptcies = rows.filter((r) => r.status === 'lost').length;
  const finishes = rows.filter((r) => r.status === 'finished').length;
  const avg = (key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;

  const summary = {
    strategy: name,
    runs: rows.length,
    winRate: wins / rows.length,
    bankruptcyRate: bankruptcies / rows.length,
    horizonNoWinRate: finishes / rows.length,
    avgEndingCash: Math.round(avg('cash')),
    avgCumulativeProfit: Math.round(avg('cumulativeProfit')),
    avgCustomers: Math.round(avg('customers')),
    avgValuation: Math.round(avg('valuation')),
    sample: rows[0]
  };
  summaries.push(summary);
  console.log(JSON.stringify(summary, null, 2));
}

const byName = Object.fromEntries(summaries.map((s) => [s.strategy, s]));
const checks = [
  [byName['do-nothing'].winRate === 0, 'Do-nothing policy must not win the 104-week target test.'],
  [byName['reckless'].bankruptcyRate >= 0.70, 'Reckless policy should usually go bankrupt.'],
  [byName['sensible'].winRate >= 0.60, 'Sensible policy should usually win.'],
  [byName['sensible'].winRate < 1.00, 'Sensible policy must not be guaranteed to win.']
];

for (const [passed, message] of checks) {
  if (!passed) {
    console.error(`BALANCE ASSERTION FAILED: ${message}`);
    process.exitCode = 1;
  }
}
