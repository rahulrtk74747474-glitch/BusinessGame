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
import { applyHrAction, candidateView } from '../src/engine/hiring.js';
import { advanceWeek } from '../src/engine/simulator.js';

const setup = {
  mode: 'standard',
  startingCapital: 100000,
  duration: 104,
  goal: 'profit',
  goalTarget: 999999,
  structure: 'llc',
  location: 'rented',
  plan: {
    idea: 'Cafe with disciplined operations and repeat customers.',
    targetCustomer: 'Workers and residents near the store.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.baseVariableCostPerOrder
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Regression test: a candidate's stated salary ask must be a viable hiring offer.
let fairOfferState = createGameState(setup, config, industry, rolesData, 9911, phase4Data);
const fairCandidate = fairOfferState.hr.candidates[0];
fairOfferState = applyHrAction(fairOfferState, {
  type: 'makeOffer',
  candidateId: fairCandidate.id,
  weeklySalary: fairCandidate.salaryAsk,
  perksWeekly: 0,
  equityBps: 0
}, config, rolesData);
assert(fairOfferState.hr.employees.length === 1, 'Regression: offering the stated salary ask should be accepted, not counter forever.');

let state = createGameState(setup, config, industry, rolesData, 7777, phase4Data);
const candidate = state.hr.candidates[0];
const publicBefore = candidateView(candidate, rolesData);
assert(!('hidden' in publicBefore), 'Candidate public view leaked hidden traits.');

const cashBeforeDiligence = state.finance.cash;
state = applyHrAction(state, { type: 'interview', candidateId: candidate.id }, config, rolesData);
state = applyHrAction(state, { type: 'referenceCheck', candidateId: candidate.id }, config, rolesData);
assert(state.finance.cash === cashBeforeDiligence - rolesData.interviewCost - rolesData.referenceCheckCost, 'Due diligence did not charge cash immediately.');
assert(state.hr.candidates[0].insights.interview, 'Interview did not reveal signals.');
assert(state.hr.candidates[0].insights.references, 'Reference check did not reveal reliability signal.');

state = applyHrAction(state, { type: 'startTrial', candidateId: candidate.id }, config, rolesData);
assert(state.hr.trials.length === 1, 'Trial did not start.');
state = advanceWeek(state, state.decisions, config, industry, rolesData, phase4Data);
state = advanceWeek(state, state.decisions, config, industry, rolesData, phase4Data);
assert(state.hr.candidates[0].trialCompleted, 'Trial did not complete after configured duration.');
assert(state.hr.candidates[0].trialScore > 0, 'Trial did not produce performance evidence.');

const target = state.hr.candidates[0];
state = applyHrAction(state, {
  type: 'makeOffer',
  candidateId: target.id,
  weeklySalary: target.salaryAsk,
  perksWeekly: 0,
  equityBps: 0
}, config, rolesData);
assert(state.hr.employees.length === 1, 'Fair offer should be accepted in HR integration test.');

state = advanceWeek(state, state.decisions, config, industry, rolesData, phase4Data);
const employeeId = state.hr.employees[0].id;
const firstProductivity = state.hr.employees[0].productivity;
assert(state.finance.payrollCosts > 0, 'Payroll was not included in finance.');
assert(firstProductivity > 0, 'Employee productivity did not affect the weekly simulation.');

const cashBeforeTraining = state.finance.cash;
const trainingBefore = state.hr.employees[0].training;
state = applyHrAction(state, { type: 'train', employeeId }, config, rolesData);
assert(state.finance.cash === cashBeforeTraining - rolesData.trainingCost, 'Training cost was not paid immediately.');
assert(state.hr.employees[0].training > trainingBefore, 'Training did not increase the training factor.');

const salaryBeforeRaise = state.hr.employees[0].weeklySalary;
state = applyHrAction(state, { type: 'raise', employeeId }, config, rolesData);
assert(state.hr.employees[0].weeklySalary > salaryBeforeRaise, 'Raise did not increase salary.');
assert(state.hr.lastRipple?.nodes?.length >= 3, 'Major HR decision did not create a ripple map.');

state = applyHrAction(state, { type: 'review', employeeId }, config, rolesData);
assert(state.hr.employees[0].reviews === 1, 'Performance review was not recorded.');
assert(state.hr.employees[0].lastPerformance?.reliabilitySignal, 'Performance review did not reveal employee signals.');

for (let i = 0; i < 12 && state.hr.employees.length; i += 1) {
  state = advanceWeek(state, state.decisions, config, industry, rolesData, phase4Data);
}
if (state.hr.employees.length) {
  assert(state.hr.employees[0].productivity >= firstProductivity * 0.75, 'Ramp-up/training produced an implausible productivity collapse.');
}

const legalRiskBefore = state.hr.legalRisk;
if (state.hr.employees.length) {
  state = applyHrAction(state, { type: 'terminate', employeeId: state.hr.employees[0].id, reason: 'fire' }, config, rolesData);
  assert(state.hr.employees.length === 0, 'Termination did not remove employee.');
  assert(state.hr.legalRisk === legalRiskBefore, 'Reviewed termination unexpectedly increased documentation risk.');
}

console.log('HR integration test passed: fair-offer regression, due diligence, trial, offer, payroll, ramp-up, training, raise, review, ripple map, and termination.');
