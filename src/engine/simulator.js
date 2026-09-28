import { createRng } from './random.js';
import { stepMarket } from './market.js';
import { stepCustomers } from './customers.js';
import { stepFinance, estimateValuation } from './finance.js';
import { createMonthlyReport } from './report.js';

function reachedGoal(state) {
  switch (state.goal) {
    case 'profit': return state.finance.cumulativeProfit >= state.goalTarget;
    case 'valuation': return state.finance.valuation >= state.goalTarget;
    case 'customers': return state.customers.active >= state.goalTarget;
    case 'marketShare': return state.customers.marketShare >= state.goalTarget;
    default: return false;
  }
}

export function advanceWeek(state, decisions, config, industry) {
  if (state.status !== 'running') return state;
  const rng = createRng(state.seed + state.week * config.simulation.randomSeedStride);
  const modeConfig = config.modes[state.mode];
  const structureConfig = config.structures[state.structureId];
  const locationConfig = config.locations[state.locationId];

  const safeDecisions = {
    price: Math.max(config.simulation.minDecisionPrice, Number(decisions.price)),
    marketingSpend: Math.max(0, Number(decisions.marketingSpend)),
    qualitySpend: Math.max(0, Number(decisions.qualitySpend))
  };

  const market = stepMarket(state, safeDecisions, industry, config, rng, modeConfig);
  const customers = stepCustomers(state, safeDecisions, industry, config, market, rng, locationConfig);
  const financeWithoutValuation = stepFinance(state, safeDecisions, industry, config, customers, structureConfig, locationConfig);

  const weekRow = {
    week: state.week + 1,
    revenue: financeWithoutValuation.revenue,
    netProfit: financeWithoutValuation.netProfit,
    grossMargin: financeWithoutValuation.grossMargin,
    cash: financeWithoutValuation.cash,
    orders: customers.orders,
    activeCustomers: customers.active,
    newCustomers: customers.newCustomers,
    churnRate: customers.churnRate,
    satisfaction: customers.satisfaction,
    awareness: customers.awareness,
    effectiveCAC: customers.effectiveCAC,
    ltv: customers.estimatedLtv,
    marketShare: customers.marketShare,
    lostOrders: customers.lostOrders,
    economicIndex: market.economicIndex,
    trendIndex: market.trendIndex,
    seasonality: market.seasonality,
    price: safeDecisions.price,
    marketingSpend: safeDecisions.marketingSpend,
    qualitySpend: safeDecisions.qualitySpend
  };

  const history = [...state.history, weekRow];
  const valuation = estimateValuation(history, financeWithoutValuation, customers, config);
  const finance = { ...financeWithoutValuation, valuation };

  let next = {
    ...state,
    week: state.week + 1,
    decisions: safeDecisions,
    market,
    customers,
    finance,
    history
  };

  if (next.week % config.turn.reportEveryWeeks === 0) {
    const report = createMonthlyReport(next, config);
    next = { ...next, reports: [...next.reports, report] };
  }

  if (finance.cash <= config.finance.minCash && !config.finance.financingEnabledInPhase1) {
    next.status = 'lost';
    next.resultReason = 'Bankruptcy: cash fell to zero and Phase 1 has no financing module.';
  } else if (reachedGoal(next)) {
    next.status = 'won';
    next.resultReason = 'Goal reached.';
  } else if (next.week >= next.maxWeeks) {
    next.status = 'finished';
    next.resultReason = 'The selected time horizon ended before the goal was reached.';
  }
  return next;
}

export function goalProgress(state) {
  let value = 0;
  if (state.goal === 'profit') value = state.finance.cumulativeProfit;
  if (state.goal === 'valuation') value = state.finance.valuation;
  if (state.goal === 'customers') value = state.customers.active;
  if (state.goal === 'marketShare') value = state.customers.marketShare;
  return { value, target: state.goalTarget, ratio: Math.max(0, Math.min(1, value / state.goalTarget)) };
}
