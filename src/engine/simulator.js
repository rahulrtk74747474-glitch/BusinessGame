import { createRng } from './random.js';
import { stepMarket } from './market.js';
import { stepCustomers } from './customers.js';
import { stepEmployees } from './employees.js';
import { stepFinance, estimateValuation } from './finance.js';
import { createMonthlyReport } from './report.js';
import { stepNegotiationContracts } from './negotiation.js';
import { stepMarketing } from './marketing.js';
import { stepSales } from './sales.js';
import { stepOperationsPre, stepOperationsPost } from './operations.js';
import { stepCompetitors } from './competitors.js';

function reachedGoal(state) {
  switch (state.goal) {
    case 'profit':
      return state.finance.cumulativeProfit >= state.goalTarget;
    case 'valuation':
      return state.finance.valuation >= state.goalTarget;
    case 'customers':
      return state.customers.active >= state.goalTarget;
    case 'marketShare':
      return state.customers.marketShare >= state.goalTarget;
    default:
      return false;
  }
}

export function advanceWeek(
  state,
  decisions,
  config,
  industry,
  rolesData,
  phase4Data
) {
  if (state.status !== 'running') return state;
  if (!phase4Data?.marketing || !phase4Data?.sales || !phase4Data?.operations || !phase4Data?.competitors) {
    throw new Error('Phase 4 data modules are required to advance the simulation.');
  }

  const rng = createRng(
    state.seed + state.week * config.simulation.randomSeedStride
  );
  const modeConfig = config.modes[state.mode];
  const structureConfig = config.structures[state.structureId];
  const locationConfig = config.locations[state.locationId];

  const safeDecisions = {
    price: Math.max(
      config.simulation.minDecisionPrice,
      Number(decisions.price)
    ),
    marketingSpend: Math.max(
      0,
      Number(decisions.marketingSpend)
    ),
    qualitySpend: Math.max(
      0,
      Number(decisions.qualitySpend)
    )
  };

  // Phase 4 order matters:
  // people -> rivals -> marketing -> operations capacity/inventory -> market
  // -> customers -> operations consumption -> sales -> finance.
  const hrStep = stepEmployees(
    state,
    config,
    rolesData,
    rng
  );

  const competitorStep = stepCompetitors(
    state,
    safeDecisions,
    industry,
    phase4Data.competitors,
    rng
  );

  const marketingStep = stepMarketing(
    state,
    safeDecisions,
    industry,
    phase4Data.marketing,
    rng,
    hrStep,
    competitorStep.last
  );

  const operationsPre = stepOperationsPre(
    state,
    industry,
    phase4Data.operations,
    locationConfig,
    hrStep,
    rng
  );

  const market = stepMarket(
    state,
    safeDecisions,
    industry,
    config,
    rng,
    modeConfig
  );

  const customers = stepCustomers(
    state,
    safeDecisions,
    industry,
    config,
    market,
    rng,
    locationConfig,
    hrStep,
    marketingStep.last,
    operationsPre,
    competitorStep.last
  );

  const operationsStep = stepOperationsPost(
    state,
    customers,
    phase4Data.operations,
    operationsPre
  );

  const salesStep = stepSales(
    state,
    phase4Data.sales,
    marketingStep.last,
    hrStep,
    competitorStep.last,
    operationsPre,
    rng
  );

  const financeWithoutValuation = stepFinance(
    state,
    safeDecisions,
    industry,
    config,
    customers,
    structureConfig,
    locationConfig,
    hrStep,
    operationsStep,
    marketingStep,
    salesStep
  );

  const weekRow = {
    week: state.week + 1,
    revenue: financeWithoutValuation.revenue,
    coreRevenue: financeWithoutValuation.coreRevenue,
    salesRevenue: financeWithoutValuation.salesRevenue,
    netProfit: financeWithoutValuation.netProfit,
    grossMargin: financeWithoutValuation.grossMargin,
    cash: financeWithoutValuation.cash,
    inventoryPurchases: financeWithoutValuation.inventoryPurchases,
    inventoryAsset: financeWithoutValuation.inventoryAsset,
    orders: customers.orders,
    activeCustomers: customers.active,
    newCustomers: customers.newCustomers,
    paidAcquired: customers.paidAcquired,
    organicAcquired: customers.organicAcquired,
    churnRate: customers.churnRate,
    satisfaction: customers.satisfaction,
    awareness: customers.awareness,
    effectiveCAC: customers.effectiveCAC,
    ltv: customers.estimatedLtv,
    marketShare: customers.marketShare,
    lostOrders: customers.lostOrders,
    capacity: customers.capacity,
    economicIndex: market.economicIndex,
    trendIndex: market.trendIndex,
    seasonality: market.seasonality,
    price: safeDecisions.price,
    marketingSpend: marketingStep.last.totalSpend,
    marketingROAS: marketingStep.last.estimatedROAS,
    qualitySpend: safeDecisions.qualitySpend,
    payrollCosts: financeWithoutValuation.payrollCosts,
    hrOneTimeExpenses: financeWithoutValuation.hrOneTimeExpenses,
    headcount: hrStep.employees.length,
    teamProductivity: hrStep.averageProductivity,
    teamMorale: hrStep.averageMorale,
    teamBurnout: hrStep.averageBurnout,
    managerQuality: hrStep.managerQuality,
    clientContractRevenue: financeWithoutValuation.clientRevenue || 0,
    landlordSavings: financeWithoutValuation.landlordSavings || 0,
    negotiatedUnitCost: financeWithoutValuation.effectiveVariableCostPerOrder,
    supplierContractActive:
      financeWithoutValuation.supplierContractActive,
    negotiationOneTimeExpenses:
      financeWithoutValuation.negotiationOneTimeExpenses || 0,
    inventoryUnits: operationsStep.inventoryUnits,
    inventoryReceived: operationsStep.last.receivedUnits,
    inventoryOrdered: operationsStep.last.purchaseUnits,
    operationsDefectRate: operationsStep.last.defectRate,
    fulfillmentRate: operationsStep.last.fulfillmentRate,
    stockoutConstrained: operationsStep.last.stockoutConstrained,
    salesNewLeads: salesStep.last.newLeads,
    salesQualified: salesStep.last.qualified,
    salesProposals: salesStep.last.proposals,
    salesWins: salesStep.last.wins,
    salesCloseRate: salesStep.last.closeRate,
    salesPipelineValue: salesStep.last.pipelineValue,
    competitorPressure: competitorStep.last.pressureIndex,
    competitorDemandModifier: competitorStep.last.demandModifier,
    competitorCACMultiplier: competitorStep.last.cacMultiplier
  };

  const history = [...state.history, weekRow];
  const valuation = estimateValuation(
    history,
    financeWithoutValuation,
    customers,
    config
  );
  const finance = {
    ...financeWithoutValuation,
    valuation
  };

  const latestHrEvent = hrStep.events.at(-1);
  const hr = {
    ...state.hr,
    employees: hrStep.employees,
    candidates: hrStep.candidates,
    trials: hrStep.trials,
    pendingExpenseRecognition: 0,
    managerQuality: hrStep.managerQuality,
    averageProductivity: hrStep.averageProductivity,
    averageMorale: hrStep.averageMorale,
    averageBurnout: hrStep.averageBurnout,
    events: [...state.hr.events, ...hrStep.events],
    lastRipple:
      latestHrEvent?.type === 'quit'
        ? {
            title: latestHrEvent.message,
            nodes: [
              'HR: headcount falls',
              'Finance: payroll falls',
              'Operations: capacity/productivity may fall',
              'Leadership: retention problem exposed'
            ]
          }
        : state.hr.lastRipple
  };

  let next = {
    ...state,
    week: state.week + 1,
    decisions: safeDecisions,
    market,
    customers,
    finance,
    hr,
    negotiation: stepNegotiationContracts(state),
    marketing: marketingStep,
    sales: salesStep,
    operations: operationsStep,
    competitors: competitorStep,
    history
  };

  if (next.week % config.turn.reportEveryWeeks === 0) {
    const report = createMonthlyReport(next, config);
    next = {
      ...next,
      reports: [...next.reports, report]
    };
  }

  if (
    finance.cash <= config.finance.minCash &&
    !config.finance.financingEnabledInPhase1
  ) {
    next.status = 'lost';
    next.resultReason =
      'Bankruptcy: cash fell to zero and the funding module is not unlocked yet.';
  } else if (reachedGoal(next)) {
    next.status = 'won';
    next.resultReason = 'Goal reached.';
  } else if (next.week >= next.maxWeeks) {
    next.status = 'finished';
    next.resultReason =
      'The selected time horizon ended before the goal was reached.';
  }

  return next;
}

export function goalProgress(state) {
  let value = 0;
  if (state.goal === 'profit') value = state.finance.cumulativeProfit;
  if (state.goal === 'valuation') value = state.finance.valuation;
  if (state.goal === 'customers') value = state.customers.active;
  if (state.goal === 'marketShare') value = state.customers.marketShare;
  return {
    value,
    target: state.goalTarget,
    ratio: Math.max(
      0,
      Math.min(1, value / state.goalTarget)
    )
  };
}
