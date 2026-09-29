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
import { stepFunding, updateFundingDistress, hasFinancingOptions } from './funding.js';
import { stepLegal } from './legal.js';
import { stepRisk } from './risk.js';
import { stepExpansion } from './expansion.js';
import { stepExit } from './exit.js';
import { recordEvents } from './logging.js';

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
  phase4Data,
  phase5Data
) {
  if (state.status !== 'running') return state;
  if (!phase4Data?.marketing || !phase4Data?.sales || !phase4Data?.operations || !phase4Data?.competitors) {
    throw new Error('Phase 4 data modules are required to advance the simulation.');
  }
  if (!phase5Data?.funding || !phase5Data?.legal || !phase5Data?.risk || !phase5Data?.expansion || !phase5Data?.exit) {
    throw new Error('Phase 5 data modules are required to advance the simulation.');
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

  // Phase 5 risk/compliance/funding/expansion step first so their current-week
  // consequences can flow through operations, customers and finance.
  const riskStep = stepRisk(state, phase5Data.risk);
  const riskWorking = {
    ...riskStep.state,
    pendingExpenseRecognition: state.risk.pendingExpenseRecognition
  };
  const stateWithRisk = { ...state, risk: riskWorking };

  const legalStep = stepLegal(
    stateWithRisk,
    phase5Data.legal,
    riskStep,
    rng
  );
  const legalWorking = {
    ...legalStep.state,
    pendingExpenseRecognition: state.legal.pendingExpenseRecognition
  };
  const stateWithLegal = {
    ...stateWithRisk,
    legal: legalWorking
  };

  const fundingStep = stepFunding(
    stateWithLegal,
    phase5Data.funding,
    rng
  );
  const fundingWorking = {
    ...fundingStep.state,
    pendingExpenseRecognition: state.funding.pendingExpenseRecognition
  };
  const stateWithFunding = {
    ...stateWithLegal,
    funding: fundingWorking
  };

  const expansionStep = stepExpansion(
    stateWithFunding,
    phase5Data.expansion
  );
  const workingState = {
    ...stateWithFunding,
    expansion: expansionStep.state
  };

  // Existing Phase 4 order remains intact after the Phase 5 pre-step:
  // people -> rivals -> marketing -> operations -> market -> customers
  // -> sales -> finance.
  const hrStep = stepEmployees(
    workingState,
    config,
    rolesData,
    rng
  );

  const competitorStep = stepCompetitors(
    workingState,
    safeDecisions,
    industry,
    phase4Data.competitors,
    rng
  );

  const marketingStep = stepMarketing(
    workingState,
    safeDecisions,
    industry,
    phase4Data.marketing,
    rng,
    hrStep,
    competitorStep.last
  );

  let operationsPre = stepOperationsPre(
    workingState,
    industry,
    phase4Data.operations,
    locationConfig,
    hrStep,
    rng,
    expansionStep
  );

  if (legalStep.shutdownActive) {
    operationsPre = {
      ...operationsPre,
      capacity: 0,
      processCapacity: 0,
      serviceAdd: Math.min(operationsPre.serviceAdd, -0.08),
      stockoutConstrained: false
    };
  }

  const market = stepMarket(
    workingState,
    safeDecisions,
    industry,
    config,
    rng,
    modeConfig,
    expansionStep
  );

  const customers = stepCustomers(
    workingState,
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
    workingState,
    customers,
    phase4Data.operations,
    operationsPre
  );

  const salesStep = stepSales(
    workingState,
    phase4Data.sales,
    marketingStep.last,
    hrStep,
    competitorStep.last,
    operationsPre,
    rng
  );

  const phase5Step = {
    risk: riskStep,
    legal: legalStep,
    funding: fundingStep,
    expansion: expansionStep
  };

  const financeWithoutValuation = stepFinance(
    workingState,
    safeDecisions,
    industry,
    config,
    customers,
    structureConfig,
    locationConfig,
    hrStep,
    operationsStep,
    marketingStep,
    salesStep,
    phase5Step
  );

  const weekRow = {
    week: state.week + 1,
    revenue: financeWithoutValuation.revenue,
    coreRevenue: financeWithoutValuation.coreRevenue,
    salesRevenue: financeWithoutValuation.salesRevenue,
    expansionRevenue: financeWithoutValuation.expansionRevenue,
    netProfit: financeWithoutValuation.netProfit,
    variableCosts: financeWithoutValuation.variableCosts,
    grossProfit: financeWithoutValuation.grossProfit,
    grossMargin: financeWithoutValuation.grossMargin,
    fixedCosts: financeWithoutValuation.fixedCosts,
    discretionaryCosts: financeWithoutValuation.discretionaryCosts,
    oneTimeExpenses: financeWithoutValuation.oneTimeExpenses,
    operatingProfit: financeWithoutValuation.operatingProfit,
    legalPenaltyExpense: financeWithoutValuation.legalPenaltyExpense,
    preTaxProfit: financeWithoutValuation.preTaxProfit,
    taxAccrued: financeWithoutValuation.taxAccrued,
    taxPayment: financeWithoutValuation.taxPayment,
    taxPayable: financeWithoutValuation.taxPayable,
    cash: financeWithoutValuation.cash,
    totalLiquidity: financeWithoutValuation.totalLiquidity,
    debtBalance: financeWithoutValuation.debtBalance,
    debtService: financeWithoutValuation.debtService,
    interestExpense: financeWithoutValuation.interestExpense,
    inventoryPurchases: financeWithoutValuation.inventoryPurchases,
    inventoryAsset: financeWithoutValuation.inventoryAsset,
    expansionAssets: financeWithoutValuation.expansionAssets,
    totalAssets: financeWithoutValuation.totalAssets,
    totalLiabilities: financeWithoutValuation.totalLiabilities,
    bookEquity: financeWithoutValuation.bookEquity,
    reserveCash: financeWithoutValuation.reserveCash,
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
    competitorCACMultiplier: competitorStep.last.cacMultiplier,
    complianceScore: legalStep.complianceScore,
    legalRisk: legalStep.legalRisk,
    legalPenalty: legalStep.penaltyCash,
    shutdownActive: legalStep.shutdownActive,
    riskScore: riskStep.riskScore,
    insurancePremiums: riskStep.weeklyPremiums,
    emergencyReserve: state.risk.reserveCash,
    expansionDemandMultiplier: expansionStep.demandMultiplier,
    expansionCapacityAdd: expansionStep.capacityAdd
  };

  const historyForValuation = [...state.history, weekRow];
  const debtBalance =
    fundingStep.state.debts.reduce((sum, debt) => sum + debt.balance, 0);
  const valuation = estimateValuation(
    historyForValuation,
    financeWithoutValuation,
    customers,
    config,
    {
      debt: debtBalance,
      reserveCash: state.risk.reserveCash,
      expansionAssets: expansionStep.state.capitalizedAssets
    }
  );
  const finance = {
    ...financeWithoutValuation,
    valuation
  };
  const finalWeekRow = { ...weekRow, valuation };
  const history = [...state.history, finalWeekRow];

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

  let funding = updateFundingDistress(
    { ...fundingStep.state, pendingExpenseRecognition: 0 },
    finance.cash
  );

  let nextBase = {
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
    funding,
    legal: { ...legalStep.state, pendingExpenseRecognition: 0 },
    risk: { ...riskStep.state, pendingExpenseRecognition: 0 },
    expansion: expansionStep.state,
    history
  };

  const exitStep = stepExit(
    nextBase,
    phase5Data.exit,
    rng
  );
  let next = {
    ...nextBase,
    exit: { ...exitStep.state, pendingExpenseRecognition: 0 }
  };

  const allEvents = [
    ...hrStep.events.map((event) => ({ ...event, category: 'hr' })),
    ...fundingStep.events,
    ...legalStep.events,
    ...expansionStep.events,
    ...exitStep.events
  ];
  next = recordEvents(next, allEvents);

  if (next.week % config.turn.reportEveryWeeks === 0) {
    const report = createMonthlyReport(next, config);
    next = {
      ...next,
      reports: [...next.reports, report]
    };
  }

  if (finance.cash <= config.finance.minCash) {
    const financingAvailable = hasFinancingOptions(next, phase5Data.funding);
    const graceAvailable =
      next.funding.negativeCashWeeks <= phase5Data.funding.distress.graceWeeks;

    if (!financingAvailable || !graceAvailable) {
      next.status = 'lost';
      next.resultReason =
        'Bankruptcy: operating cash is exhausted and no viable financing/reserve option remains.';
      next = recordEvents(next, [{
        category: 'finance',
        type: 'bankruptcy',
        message: next.resultReason,
        avoidable: true,
        impact: { cash: finance.cash },
        causeChain: [
          'Negative-cash weeks: ' + next.funding.negativeCashWeeks,
          'Financing available: ' + financingAvailable,
          'Debt balance: $' + Math.round(finance.debtBalance || 0).toLocaleString()
        ]
      }]);
    } else {
      next.resultReason =
        'Liquidity distress: cash is below zero, but financing or emergency reserves are still available for a limited grace period.';
    }
  } else if (reachedGoal(next)) {
    next.status = 'won';
    next.resultReason = 'Goal reached.';
  } else if (next.week >= next.maxWeeks) {
    next.status = 'finished';
    next.resultReason =
      'The selected time horizon ended before the goal was reached.';
  } else {
    next.resultReason = '';
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
