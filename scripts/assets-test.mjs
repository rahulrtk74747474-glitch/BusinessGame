import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/autoWorkshop.json' with { type: 'json' };
import roles from '../src/data/hr/autoWorkshopRoles.json' with { type: 'json' };
import marketing from '../src/data/marketing/autoWorkshopMarketing.json' with { type: 'json' };
import sales from '../src/data/sales/autoWorkshopSales.json' with { type: 'json' };
import operations from '../src/data/operations/autoWorkshopOperations.json' with { type: 'json' };
import competitors from '../src/data/competitors/autoWorkshopCompetitors.json' with { type: 'json' };
import funding from '../src/data/funding/cafeFunding.json' with { type: 'json' };
import legal from '../src/data/legal/autoWorkshopLegal.json' with { type: 'json' };
import risk from '../src/data/risk/cafeRisk.json' with { type: 'json' };
import expansion from '../src/data/expansion/autoWorkshopExpansion.json' with { type: 'json' };
import exit from '../src/data/exit/cafeExit.json' with { type: 'json' };
import assets from '../src/data/assets/indiaAssets.json' with { type: 'json' };

import { createGameState } from '../src/models/createGameState.js';
import { applyAssetAction } from '../src/engine/assets.js';
import { advanceWeek } from '../src/engine/simulator.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

const phase4 = { marketing, sales, operations, competitors };
const phase5 = { funding, legal, risk, expansion, exit, assets };
const setup = {
  mode:'standard', startingCapital:100000, duration:52, goal:'profit', goalTarget:99999999,
  structure:'llc', location:'rented', startPath:'scratch', simulationProfileId:'auto_workshop',
  plan:{
    idea:industry.starterPlan.idea,
    targetCustomer:industry.starterPlan.targetCustomer,
    price:industry.referencePrice,
    weeklyFixedCostEstimate:industry.baseFixedCostPerWeek,
    variableCostEstimate:industry.baseVariableCostPerOrder
  }
};

assert(assets.catalog.maruti_swift.usefulLifeYears === 8, 'India passenger-car book useful life should be 8 years in the preset.');
assert(assets.catalog.maruti_swift.taxWDVRate === 0.15, 'Ordinary motor-car tax WDV reference should be 15%.');
assert(assets.catalog.hire_taxi.usefulLifeYears === 6, 'On-hire motor vehicle book useful life should be 6 years.');
assert(assets.catalog.hire_taxi.taxWDVRate === 0.30, 'On-hire vehicle tax WDV reference should be 30%.');
assert(assets.catalog.cessna_172s.usefulLifeYears === 20, 'Aircraft book useful life should be 20 years.');
assert(assets.catalog.cessna_172s.taxWDVRate === 0.40, 'Aircraft tax WDV reference should be 40%.');

let state = createGameState(setup, config, industry, roles, 7777, phase4, phase5);
const openingCash = state.finance.cash;

state = applyAssetAction(state, { type:'buyAsset', catalogId:'workshop_lift' }, assets);
assert(state.assets.ownedAssets.length === 1, 'Workshop lift purchase failed.');
assert(state.finance.cash === openingCash - assets.catalog.workshop_lift.simulationCost, 'Asset capex did not reduce cash immediately.');
assert(state.assets.ownedAssets[0].bookValue === assets.catalog.workshop_lift.simulationCost, 'New asset should enter books at cost.');

const cashAfterPurchase = state.finance.cash;
state = advanceWeek(state, state.decisions, config, industry, roles, phase4, phase5);

assert(state.finance.depreciationExpense > 0, 'Purchased fixed asset produced no depreciation expense.');
assert(state.finance.ppeNet > 0, 'Net PPE was not added to the balance sheet.');
assert(state.finance.accumulatedDepreciation > 0, 'Accumulated depreciation did not increase.');
assert(state.finance.ebit < state.finance.operatingProfit, 'EBIT should be lower than EBITDA-like operating profit when depreciation exists.');
assert(Math.abs((state.finance.operatingProfit - state.finance.depreciationExpense) - state.finance.ebit) < 0.01, 'EBIT does not reconcile to operating profit less depreciation.');
assert(state.assets.ownedAssets[0].bookValue < assets.catalog.workshop_lift.simulationCost, 'Asset book value did not depreciate.');
assert(state.finance.totalAssets >= state.finance.ppeNet, 'Net PPE is not included in total assets.');
assert(state.finance.cash < cashAfterPurchase + state.finance.revenue, 'Cash logic ignored weekly operating/maintenance effects.');

const preTreasuryCash = state.finance.cash;
state = applyAssetAction(state, { type:'buyTreasury', optionId:'bank_fd', amount:5000 }, assets);
assert(state.finance.cash === preTreasuryCash - 5000, 'Treasury investment did not transfer cash out of operating cash.');
assert(state.assets.treasuryHoldings.length === 1, 'Treasury holding was not created.');

state = advanceWeek(state, state.decisions, config, industry, roles, phase4, phase5);
assert(state.finance.financialInvestments === 5000, 'Treasury principal is missing from financial assets.');
assert(state.finance.investmentIncome > 0, 'Treasury investment earned no investment income.');

const beforeSaleCash = state.finance.cash;
const assetId = state.assets.ownedAssets[0].id;
state = applyAssetAction(state, { type:'sellAsset', assetId }, assets);
assert(state.assets.ownedAssets.length === 0, 'Sold asset remained in owned-assets list.');
assert(state.finance.cash > beforeSaleCash, 'Selling fixed asset did not generate cash proceeds.');

state = advanceWeek(state, state.decisions, config, industry, roles, phase4, phase5);
assert(Number.isFinite(state.finance.assetDisposalGainLoss), 'Asset disposal gain/loss was not recognized.');

console.log('Asset investment test passed: India depreciation references, capex, book depreciation, PPE, treasury investing, investment income and disposal all work.');
