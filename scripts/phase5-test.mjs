import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import rolesData from '../src/data/hr/cafeRoles.json' with { type: 'json' };
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
import { applyFundingAction, stepFunding, totalDebt } from '../src/engine/funding.js';
import { applyLegalAction, stepLegal } from '../src/engine/legal.js';
import { applyRiskAction, stepRisk } from '../src/engine/risk.js';
import { applyExpansionAction, stepExpansion } from '../src/engine/expansion.js';
import { applyExitAction, stepExit, exitReadiness } from '../src/engine/exit.js';
import { founderOwnership, recordDecision } from '../src/engine/logging.js';
import { createRng } from '../src/engine/random.js';

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

const setup = {
  mode: 'standard',
  startingCapital: 100000,
  duration: 104,
  goal: 'profit',
  goalTarget: 9999999,
  structure: 'llc',
  location: 'rented',
  plan: {
    idea: 'A scalable neighborhood cafe with disciplined finance and compliance.',
    targetCustomer: 'Residents, office workers and local business buyers.',
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
  54321,
  phase4Data,
  phase5Data
);

// Founder injection: cash rises without dilution.
const ownershipBeforeBootstrap = founderOwnership(state);
const cashBeforeBootstrap = state.finance.cash;
state = applyFundingAction(state, { type: 'founderInjection', amount: 5000 }, fundingData);
assert(state.finance.cash === cashBeforeBootstrap + 5000, 'Founder injection did not increase cash.');
assert(founderOwnership(state) === ownershipBeforeBootstrap, 'Founder injection incorrectly diluted ownership.');

// Risk management: reserve transfers are not expenses, while insurance/controls cost cash.
state = applyRiskAction(state, { type: 'moveToReserve', amount: 3000 }, riskData);
assert(state.risk.reserveCash === 3000, 'Emergency reserve transfer failed.');
const cashAfterReserve = state.finance.cash;
state = applyRiskAction(state, { type: 'buyPolicy', policyId: 'general_liability' }, riskData);
state = applyRiskAction(state, { type: 'implementControl', controlId: 'fraud_controls' }, riskData);
assert(state.risk.activePolicies.includes('general_liability'), 'Insurance policy did not activate.');
assert(state.risk.controls.includes('fraud_controls'), 'Risk control did not activate.');
assert(state.finance.cash < cashAfterReserve, 'Insurance/control setup did not use cash.');

// Legal processing: applications take time before becoming active.
state = applyLegalAction(state, { type: 'startCompliance', itemId: 'food_license' }, legalData);
let legalStep = stepLegal(state, legalData, stepRisk(state, riskData), createRng(11));
state = { ...state, legal: legalStep.state };
legalStep = stepLegal(state, legalData, stepRisk(state, riskData), createRng(12));
state = { ...state, legal: legalStep.state };
assert(state.legal.items.food_license.status === 'active', 'Food license did not complete after processing period.');

// Missing compliance must be capable of causing real damage, not just a warning.
const forcedLegalState = {
  ...state,
  week: 30,
  legal: {
    ...state.legal,
    items: Object.fromEntries(
      Object.entries(state.legal.items).map(([id, item]) => [
        id,
        id === 'food_license' ? { ...item, status: 'missing', processingWeeks: 0, activeUntilWeek: null } : item
      ])
    )
  }
};
const forcedRng = {
  uniform: () => 0,
  range: (min) => min
};
const forcedRisk = stepRisk(forcedLegalState, riskData);
const enforcement = stepLegal(forcedLegalState, legalData, forcedRisk, forcedRng);
assert(enforcement.penaltyCash > 0, 'Undiscovered/missing legal compliance did not create financial damage.');
assert(enforcement.events.some((event) => event.type === 'enforcement'), 'Legal enforcement event was not created.');

// Build a strong financing profile so approval crosses the deterministic guaranteed threshold.
state = {
  ...state,
  week: 30,
  legal: { ...state.legal, complianceScore: 1, legalRisk: 0.05 },
  risk: { ...state.risk, last: { ...state.risk.last, riskScore: 0.08 } },
  finance: {
    ...state.finance,
    valuation: 350000,
    cumulativeProfit: 50000,
    netProfit: 1800,
    revenue: 9000
  },
  customers: {
    ...state.customers,
    satisfaction: 0.86,
    awareness: 0.82,
    marketShare: 0.28
  },
  history: Array.from({ length: 8 }, (_, index) => ({
    week: 22 + index,
    revenue: 9000 + index * 300,
    netProfit: 1700 + index * 40
  }))
};

state = applyFundingAction(state, {
  type: 'apply',
  sourceId: 'angel',
  amount: 50000,
  requestedValuation: 400000,
  pitchFocus: 'traction'
}, fundingData);

let fundingState = state.funding;
for (let i = 0; i < fundingData.sources.angel.decisionWeeks; i += 1) {
  const stepped = stepFunding({ ...state, funding: fundingState }, fundingData, createRng(100 + i));
  fundingState = stepped.state;
}
state = { ...state, funding: fundingState };
const angelTerm = state.funding.termSheets.find((term) => term.type === 'equity');
assert(angelTerm, 'Strong angel application did not produce a term sheet.');

const cashBeforeEquity = state.finance.cash;
const ownershipBeforeEquity = founderOwnership(state);
state = applyFundingAction(state, { type: 'acceptTermSheet', termSheetId: angelTerm.id }, fundingData);
assert(state.finance.cash > cashBeforeEquity, 'Equity round did not add cash.');
assert(founderOwnership(state) < ownershipBeforeEquity, 'Equity round did not dilute founder ownership.');
const ownershipSum = state.funding.capTable.reduce((sum, holder) => sum + holder.ownership, 0);
assert(Math.abs(ownershipSum - 1) < 0.000001, 'Cap table no longer sums to 100%.');

// ESOP creates additional dilution but remains a valid cap table.
const founderBeforeEsop = founderOwnership(state);
state = applyFundingAction(state, { type: 'setEsopPool', target: 0.1 }, fundingData);
assert(state.funding.esopPool === 0.1, 'ESOP pool did not update.');
assert(founderOwnership(state) < founderBeforeEsop, 'ESOP pool did not dilute existing ownership.');

// Debt mechanics: use a synthetic approved debt term to isolate repayment math.
state = {
  ...state,
  funding: {
    ...state.funding,
    termSheets: [
      ...state.funding.termSheets,
      {
        id: 999,
        sourceId: 'bank_loan',
        label: 'Test business loan',
        type: 'debt',
        amount: 20000,
        apr: 0.12,
        termWeeks: 52,
        originationFeeRate: 0.02,
        expiresIn: 3
      }
    ]
  }
};
const debtCashBefore = state.finance.cash;
state = applyFundingAction(state, { type: 'acceptTermSheet', termSheetId: 999 }, fundingData);
assert(totalDebt(state) === 20000, 'Accepted debt did not create principal balance.');
assert(state.finance.cash > debtCashBefore, 'Loan did not increase cash net of origination fee.');
const debtStep = stepFunding(state, fundingData, createRng(222));
assert(debtStep.debtService > 0, 'Debt did not create weekly debt service.');
assert(debtStep.interestExpense > 0, 'Debt did not create interest expense.');
assert(debtStep.state.debts[0].balance < 20000, 'Debt principal did not amortize.');

// Expansion: eligibility, delayed build and real operating effects.
state = {
  ...state,
  week: 45,
  finance: { ...state.finance, cash: 150000, cumulativeProfit: 40000 },
  legal: { ...state.legal, complianceScore: 1 },
  risk: { ...state.risk, last: { ...state.risk.last, riskScore: 0.1 } }
};
state = applyExpansionAction(state, { type: 'startExpansion', projectId: 'new_city' }, expansionData);
assert(state.expansion.projects.length === 1, 'Expansion project did not start.');
assert(state.expansion.capitalizedAssets >= expansionData.projects.new_city.upfrontCost, 'Expansion investment was not capitalized.');
let expansionState = state.expansion;
for (let i = 0; i < expansionData.projects.new_city.buildWeeks; i += 1) {
  const stepped = stepExpansion({ ...state, expansion: expansionState }, expansionData);
  expansionState = stepped.state;
}
state = { ...state, expansion: expansionState };
assert(state.expansion.completed.includes('new_city'), 'Expansion did not complete after build delay.');
assert(state.expansion.last.demandMultiplier > 1, 'Completed expansion did not increase market reach.');
assert(state.expansion.last.capacityAdd > 0, 'Completed expansion did not increase capacity.');

// Exit: readiness depends on succession/compliance/risk; buyer offer converts to founder proceeds.
state = {
  ...state,
  week: 60,
  legal: { ...state.legal, complianceScore: 1 },
  risk: { ...state.risk, last: { ...state.risk.last, riskScore: 0.1 } },
  finance: {
    ...state.finance,
    cash: 100000,
    valuation: 500000,
    revenue: 10000,
    netProfit: 2000
  },
  history: Array.from({ length: 8 }, (_, index) => ({
    week: 52 + index,
    revenue: 9500 + index * 250,
    netProfit: 1800 + index * 50
  }))
};

while (state.exit.successionScore < exitData.readiness.minimumSuccession) {
  state = applyExitAction(state, { type: 'prepareSuccession' }, exitData);
}
assert(exitReadiness(state, exitData).ready, 'Company did not become exit-ready after meeting criteria.');

state = applyExitAction(state, { type: 'requestExitReview' }, exitData);
let exitState = state.exit;
for (let i = 0; i < exitData.brokerReviewWeeks; i += 1) {
  const stepped = stepExit({ ...state, exit: exitState }, exitData, createRng(700 + i));
  exitState = stepped.state;
}
state = { ...state, exit: exitState };
assert(state.exit.offer?.salePrice > 0, 'Exit review did not generate a buyer offer.');
state = applyExitAction(state, { type: 'acceptSaleOffer' }, exitData);
assert(state.status === 'finished', 'Accepting a sale did not end the run.');
assert(state.exit.founderProceeds > 0, 'Company sale did not calculate founder proceeds.');

// Logging foundation: decisions retain choices, alternatives, visible information and before/after state.
const beforeLog = createGameState(setup, config, industry, rolesData, 111, phase4Data, phase5Data);
const afterLog = applyRiskAction(beforeLog, { type: 'moveToReserve', amount: 1000 }, riskData);
const logged = recordDecision(beforeLog, afterLog, 'risk', { type: 'moveToReserve', amount: 1000 }, ['Reserve cash', 'Keep operating cash']);
assert(logged.audit.decisions.length === 1, 'Decision logging did not append a decision.');
assert(logged.audit.decisions[0].stateBefore.cash !== logged.audit.decisions[0].stateAfter.cash, 'Decision log did not capture before/after state.');

console.log('Phase 5 integration test passed: funding/dilution/debt, legal enforcement, insurance/reserve, delayed expansion, brokered exit, and decision logging.');
