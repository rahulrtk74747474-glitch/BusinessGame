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
import lessons from '../src/data/learning/financialLessons.json' with { type: 'json' };
import formulaCatalog from '../src/data/learning/financialFormulaCatalog.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';
import { buildWeeklyFinancialLesson, createFinancialSnapshot } from '../src/engine/financialEducation.js';
import { buildFormulaExplanation } from '../src/engine/financialFormulaExplorer.js';

const phase4Data = { marketing: marketingData, sales: salesData, operations: operationsData, competitors: competitorData };
const phase5Data = { funding: fundingData, legal: legalData, risk: riskData, expansion: expansionData, exit: exitData };
const setup = {
  mode: 'standard', startingCapital: 100000, duration: 52, goal: 'profit', goalTarget: 99999999,
  structure: 'llc', location: 'rented', startPath: 'scratch', simulationProfileId: 'cafe',
  plan: {
    idea: 'Cafe used to verify financial education calculations.',
    targetCustomer: 'Repeat neighborhood customers and local offices.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.baseVariableCostPerOrder
  }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(lessons.length === 20, 'Financial course must contain exactly 20 weekly lessons.');
assert(new Set(lessons.map((lesson) => lesson.week)).size === 20, 'Financial lesson weeks are duplicated.');

let state = createGameState(setup, config, industry, rolesData, 424242, phase4Data, phase5Data);
const seenTopics = new Set();

for (let expectedWeek = 1; expectedWeek <= lessons.length; expectedWeek += 1) {
  state = advanceWeek(state, state.decisions, config, industry, rolesData, phase4Data, phase5Data);
  assert(state.week === expectedWeek, 'Simulation did not advance to expected finance lesson week.');

  const lesson = buildWeeklyFinancialLesson(state, industry, lessons);
  assert(lesson, 'Missing financial lesson for week ' + expectedWeek + '.');
  assert(lesson.week === expectedWeek, 'Wrong financial lesson returned for week ' + expectedWeek + '.');
  assert(lesson.example.length > 20, 'Financial lesson is not tied to company numbers.');
  assert(lesson.action.length > 20, 'Financial lesson has no actionable learning guidance.');
  seenTopics.add(lesson.key);

  const s = createFinancialSnapshot(state, industry);
  assert(Math.abs(s.pnl.grossProfit - (s.pnl.revenue - s.pnl.variableCosts)) < 0.01, 'Gross-profit equation does not reconcile.');
  assert(Math.abs(s.balanceSheet.totalAssets - (s.balanceSheet.totalLiabilities + s.balanceSheet.bookEquity)) < 0.01, 'Balance-sheet equation does not reconcile.');
  const marginExpected = s.pnl.revenue > 0 ? s.pnl.grossProfit / s.pnl.revenue : 0;
  assert(Math.abs(s.pnl.grossMargin - marginExpected) < 0.000001, 'Gross-margin equation does not reconcile.');
  if (s.ratios.contributionMargin > 0) {
    const breakEvenExpected = s.pnl.operatingExpenses / s.ratios.contributionMargin;
    assert(Math.abs(s.ratios.breakEvenRevenue - breakEvenExpected) < 0.01, 'Break-even revenue calculation is inconsistent.');
  }

  const historyRow = state.history.at(-1);
  for (const field of ['grossProfit', 'variableCosts', 'fixedCosts', 'operatingProfit', 'preTaxProfit', 'taxAccrued', 'totalAssets', 'totalLiabilities', 'bookEquity', 'valuation']) {
    assert(Number.isFinite(historyRow[field]), 'Financial history is missing field: ' + field);
  }
}

assert(seenTopics.size === lessons.length, 'The first 20 weeks do not contain 20 unique finance topics.');
state = advanceWeek(state, state.decisions, config, industry, rolesData, phase4Data, phase5Data);
assert(state.week === 21, 'Could not reach week 21.');
assert(buildWeeklyFinancialLesson(state, industry, lessons) === null, 'Financial popup lesson should stop after week 20.');


assert(formulaCatalog.length >= 25, 'Formula library should cover the major financial statement values and ratios.');
assert(new Set(formulaCatalog.map((item) => item.key)).size === formulaCatalog.length, 'Formula catalog keys must be unique.');

const formulaSnapshot = createFinancialSnapshot(state, industry);
for (const item of formulaCatalog) {
  const detail = buildFormulaExplanation(item.key, state, industry, formulaCatalog, formulaSnapshot);
  assert(detail, 'Formula explorer failed to build: ' + item.key);
  assert(detail.formula && detail.formula.length > 8, 'Formula text missing for: ' + item.key);
  assert(detail.meaning && detail.meaning.length > 20, 'Plain-English meaning missing for: ' + item.key);
  assert(Array.isArray(detail.steps) && detail.steps.length > 0, 'Worked calculation missing for: ' + item.key);
  assert(typeof detail.result === 'string' && detail.result.length > 0, 'Calculated result missing for: ' + item.key);
  assert(detail.interpretation && detail.interpretation.length > 20, 'Interpretation missing for: ' + item.key);
  assert(detail.simpleExample && detail.simpleExample.length > 20, 'Simple example missing for: ' + item.key);
}

const grossMarginDetail = buildFormulaExplanation('grossMargin', state, industry, formulaCatalog, formulaSnapshot);
assert(grossMarginDetail.result.endsWith('%'), 'Gross-margin explorer should return a percentage.');

const equityDetail = buildFormulaExplanation('bookEquity', state, industry, formulaCatalog, formulaSnapshot);
assert(equityDetail.steps.some((step) => step.includes('−')), 'Book-equity worked example must show assets minus liabilities.');

const ltvCacDetail = buildFormulaExplanation('ltvCac', state, industry, formulaCatalog, formulaSnapshot);
assert(ltvCacDetail.result.endsWith('x') || ltvCacDetail.result === 'N/M', 'LTV:CAC explorer should return a ratio.');

const annualizedDetail = buildFormulaExplanation('annualizedRevenue', state, industry, formulaCatalog, formulaSnapshot);
assert(annualizedDetail.steps.some((step) => step.includes('× 52')), 'Annualized revenue should visibly show weekly revenue times 52.');

console.log('Financial learning test passed: 20 weekly lessons plus searchable worked financial formulas all reconcile.');
