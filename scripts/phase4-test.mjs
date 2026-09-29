import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import rolesData from '../src/data/hr/cafeRoles.json' with { type: 'json' };
import marketingData from '../src/data/marketing/cafeMarketing.json' with { type: 'json' };
import salesData from '../src/data/sales/cafeSales.json' with { type: 'json' };
import operationsData from '../src/data/operations/cafeOperations.json' with { type: 'json' };
import competitorData from '../src/data/competitors/cafeCompetitors.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';
import { applyMarketingAction } from '../src/engine/marketing.js';
import { applySalesAction } from '../src/engine/sales.js';
import { applyOperationsAction } from '../src/engine/operations.js';
import { competitorPublicView } from '../src/engine/competitors.js';

const phase4Data = {
  marketing: marketingData,
  sales: salesData,
  operations: operationsData,
  competitors: competitorData
};

const setup = {
  mode: 'standard',
  startingCapital: 100000,
  duration: 104,
  goal: 'profit',
  goalTarget: 9999999,
  structure: 'llc',
  location: 'rented',
  plan: {
    idea: 'Cafe with disciplined growth, sales and supply-chain management.',
    targetCustomer: 'Residents, workers and small business catering buyers.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.baseVariableCostPerOrder
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

let state = createGameState(
  setup,
  config,
  industry,
  rolesData,
  13579,
  phase4Data
);

// Marketing must be data-driven and editable without changing the engine.
const localBefore = state.marketing.channelWeights.local_search;
state = applyMarketingAction(
  state,
  { type: 'setChannelWeight', channelId: 'local_search', weight: localBefore + 20 },
  marketingData
);
assert(
  state.marketing.channelWeights.local_search === localBefore + 20,
  'Marketing channel allocation did not update.'
);
assert(
  state.marketing.lastRipple?.nodes?.length >= 3,
  'Marketing decision did not create a ripple map.'
);

// Sales and operations settings must be editable through their engines.
state = applySalesAction(
  state,
  { type: 'setSalesSetting', key: 'outboundSpend', value: 800 },
  salesData
);
state = applySalesAction(
  state,
  { type: 'setSalesSetting', key: 'pricingModel', value: 'subscription' },
  salesData
);
assert(state.sales.settings.outboundSpend === 800, 'Sales spend setting failed.');
assert(state.sales.settings.pricingModel === 'subscription', 'Sales pricing model failed.');

state = applyOperationsAction(
  state,
  { type: 'setOperationsSetting', key: 'reorderPoint', value: 500 },
  operationsData
);
state = applyOperationsAction(
  state,
  { type: 'setOperationsSetting', key: 'qualityControlSpend', value: 160 },
  operationsData
);
assert(state.operations.settings.reorderPoint === 500, 'Operations reorder point failed.');
assert(state.operations.settings.qualityControlSpend === 160, 'Operations QC setting failed.');

// Public competitor intelligence must not expose internal archetype/threshold fields.
const publicRivals = competitorPublicView(state, competitorData);
assert(publicRivals.length === 3, 'Expected three AI competitors.');
assert(!('archetype' in publicRivals[0]), 'Competitor public view leaked hidden archetype.');
assert(!('priceWarTriggerShare' in publicRivals[0]), 'Competitor public view leaked reaction threshold.');

const initialPriceCutter = state.competitors.rivals.find((r) => r.id === 'bean_budget').price;

// Week 1: inventory should reorder and marketing/sales/competitors should all run.
const aggressiveGrowth = { price: 6.0, marketingSpend: 700, qualitySpend: 220 };
state = advanceWeek(
  state,
  aggressiveGrowth,
  config,
  industry,
  rolesData,
  phase4Data
);

assert(state.marketing.last.totalSpend === 700, 'Marketing engine did not use weekly budget.');
assert(state.marketing.last.totalAcquired > 0, 'Marketing produced no customer acquisition.');
assert(Number.isFinite(state.marketing.last.effectiveCAC), 'Marketing CAC is not finite.');
assert(state.sales.last.newLeads > 0, 'Sales engine produced no new leads.');
assert(state.sales.last.wins === 0, 'Sales pipeline should have a delay before first wins.');
assert(state.finance.inventoryPurchases > 0, 'Operations did not create inventory working-capital purchase.');
assert(state.operations.purchaseOrders.length > 0, 'Purchase order was not created.');
assert(Number.isFinite(state.operations.last.defectRate), 'Operations defect rate is invalid.');
assert(Number.isFinite(state.finance.inventoryAsset), 'Inventory asset is invalid.');

const priceCutterAfter = state.competitors.rivals.find((r) => r.id === 'bean_budget').price;
assert(
  priceCutterAfter < initialPriceCutter,
  'Price-cutting competitor did not react to aggressive player pricing.'
);
assert(Number.isFinite(state.competitors.last.pressureIndex), 'Competitor pressure is invalid.');

// Run enough turns for leads to progress lead -> qualified -> proposal -> win,
// and for purchase orders to arrive.
let sawSalesRevenue = false;
let sawInventoryReceipt = false;
for (let i = 0; i < 8 && state.status === 'running'; i += 1) {
  state = advanceWeek(
    state,
    { price: 10.25, marketingSpend: 520, qualitySpend: 200 },
    config,
    industry,
    rolesData,
    phase4Data
  );
  if (state.sales.last.revenue > 0) sawSalesRevenue = true;
  if (state.operations.last.receivedUnits > 0) sawInventoryReceipt = true;
}

assert(sawSalesRevenue, 'Delayed B2B sales pipeline never produced revenue.');
assert(sawInventoryReceipt, 'Purchase orders never arrived into inventory.');
assert(state.finance.salesRevenue >= 0, 'Sales revenue did not integrate into finance.');
assert(state.finance.marketingSpend >= 0, 'Marketing spend did not integrate into finance.');
assert(state.finance.variableCosts >= state.finance.salesVariableCosts, 'Sales delivery cost integration is inconsistent.');
assert(state.customers.capacity <= state.operations.last.processCapacity + state.operations.last.outsourcedOrders + 1000, 'Operations/customer capacity integration is implausible.');

// Cross-field outputs should be visible in weekly history for reports.
const row = state.history.at(-1);
for (const key of [
  'marketingROAS',
  'salesNewLeads',
  'salesPipelineValue',
  'inventoryUnits',
  'operationsDefectRate',
  'fulfillmentRate',
  'competitorPressure'
]) {
  assert(Number.isFinite(row[key]), 'History field is non-finite: ' + key);
}

console.log('Phase 4 integration test passed: marketing channels, delayed sales pipeline, inventory/working capital, quality/capacity, competitor reactions, finance integration, and public-intel boundaries.');
