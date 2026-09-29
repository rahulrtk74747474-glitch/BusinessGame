import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import rolesData from '../src/data/hr/cafeRoles.json' with { type: 'json' };
import marketingData from '../src/data/marketing/cafeMarketing.json' with { type: 'json' };
import salesData from '../src/data/sales/cafeSales.json' with { type: 'json' };
import operationsData from '../src/data/operations/cafeOperations.json' with { type: 'json' };
import competitorData from '../src/data/competitors/cafeCompetitors.json' with { type: 'json' };

const phase4Data = {
  marketing: marketingData,
  sales: salesData,
  operations: operationsData,
  competitors: competitorData
};
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';
import { applyMarketingAction } from '../src/engine/marketing.js';
import { applySalesAction } from '../src/engine/sales.js';
import { applyOperationsAction } from '../src/engine/operations.js';

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

function configureStrategy(name, state) {
  if (name === 'sensible') {
    state = applyMarketingAction(state, { type: 'setChannelWeight', channelId: 'local_search', weight: 40 }, marketingData);
    state = applyMarketingAction(state, { type: 'setChannelWeight', channelId: 'content_seo', weight: 30 }, marketingData);
    state = applyMarketingAction(state, { type: 'setChannelWeight', channelId: 'paid_social', weight: 15 }, marketingData);
    state = applyMarketingAction(state, { type: 'setChannelWeight', channelId: 'email', weight: 10 }, marketingData);
    state = applyMarketingAction(state, { type: 'setChannelWeight', channelId: 'influencer', weight: 5 }, marketingData);
    state = applySalesAction(state, { type: 'setSalesSetting', key: 'outboundSpend', value: 180 }, salesData);
    state = applySalesAction(state, { type: 'setSalesSetting', key: 'discountRate', value: 0.04 }, salesData);
    state = applySalesAction(state, { type: 'setSalesSetting', key: 'pricingModel', value: 'tiered' }, salesData);
    state = applyOperationsAction(state, { type: 'setOperationsSetting', key: 'reorderPoint', value: 380 }, operationsData);
    state = applyOperationsAction(state, { type: 'setOperationsSetting', key: 'orderQuantity', value: 540 }, operationsData);
    state = applyOperationsAction(state, { type: 'setOperationsSetting', key: 'qualityControlSpend', value: 100 }, operationsData);
  }

  if (name === 'reckless') {
    state = applySalesAction(state, { type: 'setSalesSetting', key: 'outboundSpend', value: 1500 }, salesData);
    state = applySalesAction(state, { type: 'setSalesSetting', key: 'discountRate', value: 0.28 }, salesData);
    state = applySalesAction(state, { type: 'setSalesSetting', key: 'commissionRate', value: 0.18 }, salesData);
    state = applyOperationsAction(state, { type: 'setOperationsSetting', key: 'outsourceShare', value: 0.5 }, operationsData);
    state = applyOperationsAction(state, { type: 'setOperationsSetting', key: 'orderQuantity', value: 1000 }, operationsData);
    state = applyOperationsAction(state, { type: 'setOperationsSetting', key: 'reorderPoint', value: 800 }, operationsData);
  }
  return state;
}

function runOne(name, seed) {
  let state = createGameState(baseSetup, config, industry, rolesData, seed, phase4Data);
  state = configureStrategy(name, state);
  while (state.status === 'running') {
    state = advanceWeek(state, policy(name, state), config, industry, rolesData, phase4Data);
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
    console.error('BALANCE ASSERTION FAILED: ' + message);
    process.exitCode = 1;
  }
}
