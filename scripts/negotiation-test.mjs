import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import rolesData from '../src/data/hr/cafeRoles.json' with { type: 'json' };
import negotiationConfig from '../src/data/negotiation/negotiationConfig.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { applyNegotiationAction, negotiationPublicView } from '../src/engine/negotiation.js';
import { advanceWeek } from '../src/engine/simulator.js';

const setup = {
  mode: 'standard',
  startingCapital: 100000,
  duration: 104,
  goal: 'profit',
  goalTarget: 9999999,
  structure: 'llc',
  location: 'rented',
  plan: {
    idea: 'A disciplined neighborhood cafe with repeat customers.',
    targetCustomer: 'Nearby workers and residents.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.baseVariableCostPerOrder
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const close = (state) => applyNegotiationAction(
  state,
  { type: 'close' },
  negotiationConfig,
  rolesData
);

let state = createGameState(setup, config, industry, rolesData, 24680);

// Supplier: hidden fields must stay out of the UI view, research must cost money,
// and a mutually acceptable offer must create a real operating contract.
state = applyNegotiationAction(
  state,
  { type: 'start', counterpartyType: 'supplier' },
  negotiationConfig,
  rolesData
);
let view = negotiationPublicView(state, negotiationConfig);
assert(view && view.type === 'supplier', 'Supplier negotiation did not start.');
assert(!('hidden' in view), 'Negotiation public view leaked hidden variables.');
assert(view.revealed.personality === undefined, 'Personality should start hidden.');

const cashBeforeResearch = state.finance.cash;
const prepBefore = view.preparation;
state = applyNegotiationAction(state, { type: 'prepare' }, negotiationConfig, rolesData);
view = negotiationPublicView(state, negotiationConfig);
assert(
  state.finance.cash === cashBeforeResearch - negotiationConfig.researchCost,
  'Research cost was not deducted immediately.'
);
assert(view.preparation > prepBefore, 'Research did not improve preparation.');
assert(view.revealed.personality, 'Research did not reveal any counterparty intelligence.');

const supplierAsk = view.counterOffer;
state = applyNegotiationAction(
  state,
  { type: 'tactic', tactic: 'anchor', proposal: supplierAsk },
  negotiationConfig,
  rolesData
);
assert(state.negotiation.active.status === 'accepted', 'Counterparty-favorable supplier offer should close a deal.');
assert(state.negotiation.contracts.supplierRemainingWeeks > 0, 'Supplier contract was not activated.');
assert(state.negotiation.contracts.supplierUnitCost > 0, 'Supplier unit cost was not stored.');
state = close(state);

// Finance integration: the negotiated supplier unit cost must flow into the weekly P&L.
state = advanceWeek(state, state.decisions, config, industry, rolesData);
assert(
  Math.abs(state.finance.effectiveVariableCostPerOrder - state.negotiation.contracts.supplierUnitCost) < 0.0001,
  'Supplier deal did not flow into variable cost.'
);

// Landlord: walk-away must end the session without a contract.
state = applyNegotiationAction(
  state,
  { type: 'start', counterpartyType: 'landlord' },
  negotiationConfig,
  rolesData
);
state = applyNegotiationAction(
  state,
  { type: 'tactic', tactic: 'walk_away' },
  negotiationConfig,
  rolesData
);
assert(state.negotiation.active.status === 'walked-away', 'Walk-away tactic did not end the negotiation.');
assert(state.negotiation.contracts.landlordRemainingWeeks === 0, 'Walking away incorrectly created a lease deal.');
state = close(state);

// Client: agreement must create recurring contract revenue and its cost structure.
state = applyNegotiationAction(
  state,
  { type: 'start', counterpartyType: 'client' },
  negotiationConfig,
  rolesData
);
view = negotiationPublicView(state, negotiationConfig);
state = applyNegotiationAction(
  state,
  { type: 'tactic', tactic: 'bundle', proposal: view.counterOffer },
  negotiationConfig,
  rolesData
);
assert(state.negotiation.active.status === 'accepted', 'Client negotiation did not accept a counterparty-favorable bundled offer.');
const clientRevenue = state.negotiation.contracts.clientWeeklyRevenue;
assert(clientRevenue > 0, 'Client contract revenue was not stored.');
state = close(state);
state = advanceWeek(state, state.decisions, config, industry, rolesData);
assert(state.finance.clientRevenue === clientRevenue, 'Client contract revenue did not reach finance.');
assert(state.finance.clientVariableCosts > 0, 'Client delivery costs were not modeled.');

// Investor: Phase 3 may agree an indicative valuation but must not inject funding.
const cashBeforeInvestor = state.finance.cash;
state = applyNegotiationAction(
  state,
  { type: 'start', counterpartyType: 'investor' },
  negotiationConfig,
  rolesData
);
view = negotiationPublicView(state, negotiationConfig);
const investorOpening = view.counterOffer;
state = applyNegotiationAction(
  state,
  { type: 'tactic', tactic: 'anchor', proposal: investorOpening },
  negotiationConfig,
  rolesData
);
console.log('INVESTOR_DEBUG', JSON.stringify({
  gameStatus: state.status,
  activeStatus: state.negotiation.active?.status,
  direction: state.negotiation.active?.direction,
  playerOffer: state.negotiation.active?.playerOffer,
  counterOffer: state.negotiation.active?.counterOffer,
  initialCounter: state.negotiation.active?.initialCounter,
  walkAway: state.negotiation.active?.hidden?.walkAway,
  outcome: state.negotiation.active?.outcome
}));
assert(state.negotiation.active.status === 'accepted', 'Investor opening valuation should settle when the player accepts it.');
assert(state.negotiation.contracts.investorIndicativeValuation > 0, 'Indicative investor valuation was not recorded.');
assert(state.finance.cash === cashBeforeInvestor, 'Phase 3 investor negotiation incorrectly injected funding cash.');
state = close(state);

// Candidate: due diligence improves preparation, and agreement must convert
// the candidate into an employee through the same negotiation engine.
const candidate = state.hr.candidates.find((c) => c.available);
assert(candidate, 'No candidate available for negotiation test.');
state = applyNegotiationAction(
  state,
  { type: 'start', counterpartyType: 'candidate', candidateId: candidate.id },
  negotiationConfig,
  rolesData
);
view = negotiationPublicView(state, negotiationConfig);
assert(view.type === 'candidate', 'Candidate negotiation did not start.');
const candidateAsk = view.counterOffer;
state = applyNegotiationAction(
  state,
  { type: 'tactic', tactic: 'bundle', proposal: candidateAsk },
  negotiationConfig,
  rolesData
);
assert(state.negotiation.active.status === 'accepted', 'Candidate did not accept their own asking salary.');
assert(state.hr.employees.some((e) => e.name === candidate.name), 'Candidate deal did not create an employee.');
const hired = state.hr.employees.find((e) => e.name === candidate.name);
assert(hired.perksWeekly > 0, 'Bundled candidate deal did not include configured perks.');
assert(hired.equityBps > 0, 'Bundled candidate deal did not include configured equity.');

assert(state.negotiation.history.length >= 5, 'Negotiation history did not record completed sessions.');

console.log('Negotiation integration test passed: hidden information, research, supplier settlement, walk-away, client contract, investor preview, candidate hire, and finance effects.');
