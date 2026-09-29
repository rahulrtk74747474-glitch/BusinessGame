import config from '../src/config/gameConfig.json' with { type: 'json' };
import cafe from '../src/data/industries/cafe.json' with { type: 'json' };
import software from '../src/data/industries/softwareSaas.json' with { type: 'json' };
import dairy from '../src/data/industries/dairyFarm.json' with { type: 'json' };

import cafeRoles from '../src/data/hr/cafeRoles.json' with { type: 'json' };
import softwareRoles from '../src/data/hr/softwareRoles.json' with { type: 'json' };
import dairyRoles from '../src/data/hr/dairyRoles.json' with { type: 'json' };

import cafeMarketing from '../src/data/marketing/cafeMarketing.json' with { type: 'json' };
import softwareMarketing from '../src/data/marketing/softwareMarketing.json' with { type: 'json' };
import dairyMarketing from '../src/data/marketing/dairyMarketing.json' with { type: 'json' };

import cafeSales from '../src/data/sales/cafeSales.json' with { type: 'json' };
import softwareSales from '../src/data/sales/softwareSales.json' with { type: 'json' };
import dairySales from '../src/data/sales/dairySales.json' with { type: 'json' };

import cafeOperations from '../src/data/operations/cafeOperations.json' with { type: 'json' };
import softwareOperations from '../src/data/operations/softwareOperations.json' with { type: 'json' };
import dairyOperations from '../src/data/operations/dairyOperations.json' with { type: 'json' };

import cafeCompetitors from '../src/data/competitors/cafeCompetitors.json' with { type: 'json' };
import softwareCompetitors from '../src/data/competitors/softwareCompetitors.json' with { type: 'json' };
import dairyCompetitors from '../src/data/competitors/dairyCompetitors.json' with { type: 'json' };

import funding from '../src/data/funding/cafeFunding.json' with { type: 'json' };
import cafeLegal from '../src/data/legal/cafeLegal.json' with { type: 'json' };
import softwareLegal from '../src/data/legal/softwareLegal.json' with { type: 'json' };
import dairyLegal from '../src/data/legal/dairyLegal.json' with { type: 'json' };
import risk from '../src/data/risk/cafeRisk.json' with { type: 'json' };
import cafeExpansion from '../src/data/expansion/cafeExpansion.json' with { type: 'json' };
import softwareExpansion from '../src/data/expansion/softwareExpansion.json' with { type: 'json' };
import dairyExpansion from '../src/data/expansion/dairyExpansion.json' with { type: 'json' };
import exit from '../src/data/exit/cafeExit.json' with { type: 'json' };

import { buildCustomIndustry } from '../src/engine/customIndustry.js';
import { negotiationForIndustry } from '../src/engine/businessProfile.js';
import negotiationBase from '../src/data/negotiation/negotiationConfig.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const profiles = [
  {
    id: 'cafe',
    industry: cafe,
    roles: cafeRoles,
    phase4: { marketing: cafeMarketing, sales: cafeSales, operations: cafeOperations, competitors: cafeCompetitors },
    phase5: { funding, legal: cafeLegal, risk, expansion: cafeExpansion, exit }
  },
  {
    id: 'software_saas',
    industry: software,
    roles: softwareRoles,
    phase4: { marketing: softwareMarketing, sales: softwareSales, operations: softwareOperations, competitors: softwareCompetitors },
    phase5: { funding, legal: softwareLegal, risk, expansion: softwareExpansion, exit }
  },
  {
    id: 'dairy_farm',
    industry: dairy,
    roles: dairyRoles,
    phase4: { marketing: dairyMarketing, sales: dairySales, operations: dairyOperations, competitors: dairyCompetitors },
    phase5: { funding, legal: dairyLegal, risk, expansion: dairyExpansion, exit }
  }
];

function setup(industry) {
  return {
    mode: 'standard',
    startingCapital: 100000,
    duration: 52,
    goal: 'profit',
    goalTarget: 99999999,
    structure: 'llc',
    location: 'rented',
    startPath: 'scratch',
    simulationProfileId: industry.id,
    plan: {
      idea: industry.starterPlan?.idea || 'Focused business with a clear value proposition.',
      targetCustomer: industry.starterPlan?.targetCustomer || 'Specific repeat customers.',
      price: industry.referencePrice,
      weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
      variableCostEstimate: industry.baseVariableCostPerOrder
    }
  };
}

for (const [index, profile] of profiles.entries()) {
  let state = createGameState(setup(profile.industry), config, profile.industry, profile.roles, 9000 + index, profile.phase4, profile.phase5);
  for (let week = 0; week < 12 && state.status === 'running'; week += 1) {
    state = advanceWeek(
      state,
      state.decisions,
      config,
      profile.industry,
      profile.roles,
      profile.phase4,
      profile.phase5
    );
  }

  const finite = [
    state.finance.cash,
    state.finance.revenue,
    state.finance.netProfit,
    state.finance.valuation,
    state.customers.active,
    state.operations.last.capacity,
    state.operations.last.estimatedUnitCost
  ].every(Number.isFinite);
  assert(finite, profile.id + ' produced non-finite simulation values.');
  assert(state.history.length > 0, profile.id + ' did not advance history.');

  if (profile.id === 'software_saas') {
    assert(state.operations.last.inventoryMode === 'virtual', 'Software profile is not using virtual operations.');
    assert(state.operations.inventoryUnits === 0, 'Software incorrectly accumulated physical inventory.');
    assert(state.operations.last.capacity > 0, 'Software has no delivery capacity.');
  }

  if (profile.id === 'dairy_farm') {
    assert(state.operations.last.inventoryMode === 'production', 'Dairy profile is not using production operations.');
    assert(state.history.some((row) => row.inventoryPurchases > 0), 'Dairy production never consumed production cash.');
    assert(state.operations.last.producedUnits > 0, 'Dairy did not produce milk output.');
  }
}

const custom = buildCustomIndustry({
  archetype: 'service',
  businessName: 'Custom Analytics Studio',
  category: 'Analytics consulting',
  price: 125,
  variableCost: 22,
  fixedCost: 1800,
  capacity: 90,
  marketDemand: 180,
  initialCustomers: 12,
  unitLabel: 'weekly retainers'
});
assert(custom.referencePrice === 125, 'Custom price was not preserved.');
assert(custom.baseVariableCostPerOrder === 22, 'Custom variable cost was not preserved.');
assert(custom.baseFixedCostPerWeek === 1800, 'Custom fixed cost was not preserved.');
assert(custom.capacityOrdersPerWeek === 90, 'Custom capacity was not preserved.');
assert(custom.simulationProfileId === 'software_saas', 'Custom service did not map to the service/software profile.');

const customSetup = {
  ...setup(custom),
  industryId: 'custom',
  simulationProfileId: 'software_saas',
  customIndustry: custom,
  plan: {
    idea: 'Analytics retainers for mid-market companies.',
    targetCustomer: 'Finance and operations teams needing recurring analytics support.',
    price: custom.referencePrice,
    weeklyFixedCostEstimate: custom.baseFixedCostPerWeek,
    variableCostEstimate: custom.baseVariableCostPerOrder
  }
};
let customState = createGameState(
  customSetup,
  config,
  custom,
  softwareRoles,
  9911,
  profiles[1].phase4,
  profiles[1].phase5
);
customState = advanceWeek(customState, customState.decisions, config, custom, softwareRoles, profiles[1].phase4, profiles[1].phase5);
assert(customState.industryId === 'custom', 'Custom game state lost its industry identity.');
assert(customState.operations.last.inventoryMode === 'virtual', 'Custom service did not inherit service operations.');

const softwareNegotiation = negotiationForIndustry(negotiationBase, software);
const dairyNegotiation = negotiationForIndustry(negotiationBase, dairy);
assert(softwareNegotiation.templates.supplier.label === 'Cloud infrastructure provider', 'Software negotiation overrides were not applied.');
assert(dairyNegotiation.templates.client.label === 'Milk distributor', 'Dairy negotiation overrides were not applied.');

console.log('Industry integration test passed: cafe, SaaS, dairy and custom business models all run with industry-specific operations.');
