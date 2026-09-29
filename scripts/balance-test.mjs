import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import rolesData from '../src/data/hr/cafeRoles.json' with { type: 'json' };
import negotiationConfig from '../src/data/negotiation/negotiationConfig.json' with { type: 'json' };
import marketingData from '../src/data/marketing/cafeMarketing.json' with { type: 'json' };
import salesData from '../src/data/sales/cafeSales.json' with { type: 'json' };
import operationsData from '../src/data/operations/cafeOperations.json' with { type: 'json' };
import competitorData from '../src/data/competitors/cafeCompetitors.json' with { type: 'json' };
import fundingData from '../src/data/funding/cafeFunding.json' with { type: 'json' };
import legalData from '../src/data/legal/cafeLegal.json' with { type: 'json' };
import riskData from '../src/data/risk/cafeRisk.json' with { type: 'json' };
import expansionData from '../src/data/expansion/cafeExpansion.json' with { type: 'json' };
import exitData from '../src/data/exit/cafeExit.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';
import { applyMarketingAction } from '../src/engine/marketing.js';
import { applySalesAction } from '../src/engine/sales.js';
import { applyOperationsAction } from '../src/engine/operations.js';
import { applyLegalAction } from '../src/engine/legal.js';
import { applyExpansionAction, expansionEligibility } from '../src/engine/expansion.js';
import { applyNegotiationAction, negotiationPublicView } from '../src/engine/negotiation.js';

const phase4Data = {
  marketing: marketingData,
  sales: salesData,
  operations: operationsData,
  competitors: competitorData
};

const phase5Data = {
  funding: fundingData,
  legal: legalData,
  risk: riskData,
  expansion: expansionData,
  exit: exitData
};

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
    targetCustomer: 'Nearby residents, office workers and local business buyers.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.baseVariableCostPerOrder
  }
};

function policy(name, state) {
  if (name === 'do-nothing') {
    return {
      price: industry.referencePrice,
      marketingSpend: 0,
      qualitySpend: 0
    };
  }

  if (name === 'reckless') {
    return {
      price: state.week < 20 ? 5.25 : 6.25,
      marketingSpend: state.finance.cash > 8000 ? 2300 : 1200,
      qualitySpend: 700
    };
  }

  // Sensible player invests early to build demand, then shifts toward
  // profitable retention once awareness/customer volume are established.
  return {
    price: state.customers.satisfaction > 0.66 ? 10.0 : 9.5,
    marketingSpend:
      state.week < 16 ? 620 :
      state.week < 40 ? 260 :
      state.customers.awareness < 0.65 ? 150 : 80,
    qualitySpend:
      state.customers.satisfaction < 0.58 ? 210 :
      state.customers.satisfaction > 0.72 ? 120 : 150
  };
}

function configureStrategy(name, state) {
  if (name === 'sensible') {
    for (const [channelId, weight] of Object.entries({
      local_search: 40,
      content_seo: 30,
      paid_social: 15,
      email: 10,
      influencer: 5
    })) {
      state = applyMarketingAction(
        state,
        { type: 'setChannelWeight', channelId, weight },
        marketingData
      );
    }

    state = applySalesAction(
      state,
      { type: 'setSalesSetting', key: 'outboundSpend', value: 220 },
      salesData
    );
    state = applySalesAction(
      state,
      { type: 'setSalesSetting', key: 'discountRate', value: 0.03 },
      salesData
    );
    state = applySalesAction(
      state,
      { type: 'setSalesSetting', key: 'pricingModel', value: 'tiered' },
      salesData
    );

    state = applyOperationsAction(
      state,
      { type: 'setOperationsSetting', key: 'reorderPoint', value: 700 },
      operationsData
    );
    state = applyOperationsAction(
      state,
      { type: 'setOperationsSetting', key: 'orderQuantity', value: 760 },
      operationsData
    );
    state = applyOperationsAction(
      state,
      { type: 'setOperationsSetting', key: 'qualityControlSpend', value: 90 },
      operationsData
    );

    // A sensible founder closes known compliance gaps before their deadlines.
    for (const itemId of ['food_license', 'fire_safety', 'privacy_policy']) {
      state = applyLegalAction(
        state,
        { type: 'startCompliance', itemId },
        legalData
      );
    }
  }

  if (name === 'reckless') {
    state = applySalesAction(
      state,
      { type: 'setSalesSetting', key: 'outboundSpend', value: 1500 },
      salesData
    );
    state = applySalesAction(
      state,
      { type: 'setSalesSetting', key: 'discountRate', value: 0.28 },
      salesData
    );
    state = applySalesAction(
      state,
      { type: 'setSalesSetting', key: 'commissionRate', value: 0.18 },
      salesData
    );
    state = applyOperationsAction(
      state,
      { type: 'setOperationsSetting', key: 'outsourceShare', value: 0.5 },
      operationsData
    );
    state = applyOperationsAction(
      state,
      { type: 'setOperationsSetting', key: 'orderQuantity', value: 1000 },
      operationsData
    );
    state = applyOperationsAction(
      state,
      { type: 'setOperationsSetting', key: 'reorderPoint', value: 800 },
      operationsData
    );
  }

  return state;
}

function negotiateToDeal(state, type, preferredProposal) {
  if (state.negotiation.active) return state;

  state = applyNegotiationAction(
    state,
    { type: 'start', counterpartyType: type },
    negotiationConfig,
    rolesData
  );

  if (!state.negotiation.active) return state;

  state = applyNegotiationAction(
    state,
    {
      type: 'tactic',
      tactic: 'bundle',
      proposal: preferredProposal
    },
    negotiationConfig,
    rolesData
  );

  // If they counter instead of accepting, move to their stated counter.
  // This models a sensible founder prioritizing a profitable agreement over
  // squeezing the final dollar out of the counterparty.
  if (state.negotiation.active?.status === 'active') {
    const view = negotiationPublicView(state, negotiationConfig);
    state = applyNegotiationAction(
      state,
      {
        type: 'tactic',
        tactic: 'anchor',
        proposal: view.counterOffer
      },
      negotiationConfig,
      rolesData
    );
  }

  if (state.negotiation.active?.status !== 'active') {
    state = applyNegotiationAction(
      state,
      { type: 'close' },
      negotiationConfig,
      rolesData
    );
  }

  return state;
}

function manageSensibleContracts(state) {
  if (state.negotiation.contracts.supplierRemainingWeeks <= 0) {
    state = negotiateToDeal(state, 'supplier', 3.25);
  }
  if (state.negotiation.contracts.landlordRemainingWeeks <= 0) {
    state = negotiateToDeal(state, 'landlord', 850);
  }
  // A disciplined founder does not assume a permanent large-client contract.
  // This keeps the benchmark exposed to real demand/economic variance rather
  // than turning one guaranteed B2B contract into a scripted win.
  return state;
}

function manageSensibleCompliance(state) {
  for (const itemId of ['food_license', 'fire_safety', 'privacy_policy']) {
    const current = state.legal.items[itemId];
    if (current && ['missing', 'expired'].includes(current.status)) {
      state = applyLegalAction(
        state,
        { type: 'startCompliance', itemId },
        legalData
      );
    }
  }
  return state;
}

function manageSensiblePhase5(state) {
  // A disciplined founder expands only after the core business has had time to
  // prove itself. The franchise pilot has a build delay and ongoing costs, so
  // it improves the odds of success without removing market/economic variance.
  if (
    state.week >= 70 &&
    !state.expansion.completed.includes('franchise_pilot') &&
    !state.expansion.projects.some((project) => project.projectId === 'franchise_pilot')
  ) {
    const eligibility = expansionEligibility(state, 'franchise_pilot', expansionData);
    if (eligibility.eligible) {
      state = applyExpansionAction(
        state,
        { type: 'startExpansion', projectId: 'franchise_pilot' },
        expansionData
      );
    }
  }
  return state;
}

function runOne(name, seed) {
  let state = createGameState(
    baseSetup,
    config,
    industry,
    rolesData,
    seed,
    phase4Data, phase5Data);
  state = configureStrategy(name, state);

  while (state.status === 'running') {
    if (name === 'sensible') {
      state = manageSensibleContracts(state);
      state = manageSensibleCompliance(state);
      state = manageSensiblePhase5(state);
    }
    state = advanceWeek(
      state,
      policy(name, state),
      config,
      industry,
      rolesData,
      phase4Data, phase5Data);
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
  const avg = (key) =>
    rows.reduce((sum, row) => sum + row[key], 0) / rows.length;

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

const byName = Object.fromEntries(
  summaries.map((s) => [s.strategy, s])
);
const checks = [
  [
    byName['do-nothing'].winRate === 0,
    'Do-nothing policy must not win the 104-week target test.'
  ],
  [
    byName['reckless'].bankruptcyRate >= 0.7,
    'Reckless policy should usually go bankrupt.'
  ],
  [
    byName['sensible'].winRate >= 0.6,
    'Sensible policy should usually win.'
  ],
  [
    byName['sensible'].winRate < 1,
    'Sensible policy must not be guaranteed to win.'
  ]
];

for (const [passed, message] of checks) {
  if (!passed) {
    console.error('BALANCE ASSERTION FAILED: ' + message);
    process.exitCode = 1;
  }
}
