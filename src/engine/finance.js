export function stepFinance(
  state,
  decisions,
  industry,
  config,
  customers,
  structureConfig,
  locationConfig,
  hrStep,
  operationsStep,
  marketingStep,
  salesStep
) {
  const contracts = state.negotiation?.contracts || {};

  const clientActive = (contracts.clientRemainingWeeks || 0) > 0;
  const clientRevenue = clientActive ? (contracts.clientWeeklyRevenue || 0) : 0;
  const clientVariableCosts =
    clientRevenue *
    (clientActive ? (contracts.clientVariableCostRate || 0) : 0);

  const coreRevenue = customers.orders * decisions.price;
  const salesRevenue = salesStep?.last?.revenue || 0;
  const revenue = coreRevenue + clientRevenue + salesRevenue;

  const coreCogs =
    operationsStep?.last?.cogs ??
    customers.orders * industry.baseVariableCostPerOrder;
  const salesVariableCosts = salesStep?.last?.variableCosts || 0;
  const variableCosts =
    coreCogs + clientVariableCosts + salesVariableCosts;

  const baseFixedCosts =
    industry.baseFixedCostPerWeek * locationConfig.fixedCostMultiplier +
    structureConfig.weeklyAdminCost;
  const landlordSavings =
    (contracts.landlordRemainingWeeks || 0) > 0
      ? Math.max(0, contracts.landlordWeeklySavings || 0)
      : 0;
  const operationsFixedCosts = operationsStep?.last?.weeklyFixedCost || 0;
  const fixedCosts =
    Math.max(0, baseFixedCosts - landlordSavings) +
    operationsFixedCosts;

  const marketingSpend = marketingStep?.last?.totalSpend ?? decisions.marketingSpend;
  const qualitySpend = decisions.qualitySpend;
  const salesOutboundSpend = salesStep?.last?.outboundSpend || 0;
  const salesCommissionCost = salesStep?.last?.commissionCost || 0;
  const discretionaryCosts =
    marketingSpend +
    qualitySpend +
    salesOutboundSpend +
    salesCommissionCost;

  const payrollCosts = hrStep?.payrollCost || 0;
  const inventoryPurchases = operationsStep?.last?.purchaseCash || 0;

  // HR and negotiation actions are paid immediately at action time. Recognize
  // them in P&L here without reducing cash a second time.
  const hrOneTimeExpenses = state.hr?.pendingExpenseRecognition || 0;
  const negotiationOneTimeExpenses =
    state.negotiation?.pendingExpenseRecognition || 0;

  const operatingProfit =
    revenue -
    variableCosts -
    fixedCosts -
    discretionaryCosts -
    payrollCosts -
    hrOneTimeExpenses -
    negotiationOneTimeExpenses;

  // Core COGS was paid when inventory was purchased. Client and sales delivery
  // costs are treated as same-week cash costs. This creates a real working
  // capital effect: buying inventory early reduces cash before it becomes COGS.
  const directVariableCashCosts =
    clientVariableCosts + salesVariableCosts;
  const cashOperatingProfit =
    revenue -
    inventoryPurchases -
    directVariableCashCosts -
    fixedCosts -
    discretionaryCosts -
    payrollCosts;

  const taxableProfit = Math.max(0, operatingProfit);
  const taxAccrued = taxableProfit * structureConfig.taxRate;
  const cashBeforeTaxPayment =
    state.finance.cash + cashOperatingProfit;

  const shouldPayTax =
    (state.week + 1) % config.finance.taxPaymentIntervalWeeks === 0;
  const priorTaxPayable = state.finance.taxPayable;
  const taxPayment = shouldPayTax
    ? priorTaxPayable + taxAccrued
    : 0;
  const taxPayable = shouldPayTax
    ? 0
    : priorTaxPayable + taxAccrued;
  const cash = cashBeforeTaxPayment - taxPayment;
  const netProfit = operatingProfit - taxAccrued;

  const trailingBurn = netProfit < 0 ? Math.abs(netProfit) : 0;
  const runwayWeeks =
    trailingBurn > 0 ? Math.max(0, cash / trailingBurn) : Infinity;
  const grossProfit = revenue - variableCosts;
  const grossMargin =
    revenue > 0 ? grossProfit / revenue : 0;

  return {
    startingCapital: state.finance.startingCapital,
    cash,
    revenue,
    coreRevenue,
    clientRevenue,
    salesRevenue,
    variableCosts,
    coreCogs,
    effectiveVariableCostPerOrder:
      operationsStep?.last?.estimatedUnitCost ??
      industry.baseVariableCostPerOrder,
    supplierContractActive:
      operationsStep?.last?.supplierContractActive || false,
    clientVariableCosts,
    salesVariableCosts,
    fixedCosts,
    operationsFixedCosts,
    landlordSavings,
    discretionaryCosts,
    marketingSpend,
    qualitySpend,
    salesOutboundSpend,
    salesCommissionCost,
    inventoryPurchases,
    inventoryAsset:
      (operationsStep?.inventoryUnits || 0) *
      (operationsStep?.inventoryUnitCost || 0),
    payrollCosts,
    hrOneTimeExpenses,
    negotiationOneTimeExpenses,
    grossProfit,
    grossMargin,
    operatingProfit,
    taxAccrued,
    taxPayment,
    taxPayable,
    netProfit,
    cumulativeRevenue: state.finance.cumulativeRevenue + revenue,
    cumulativeProfit: state.finance.cumulativeProfit + netProfit,
    runwayWeeks
  };
}

export function estimateValuation(history, finance, customers, config) {
  const recent = history.slice(-8);
  const avgRevenue = recent.length
    ? recent.reduce((s, x) => s + x.revenue, 0) / recent.length
    : finance.revenue;
  const avgProfit = recent.length
    ? recent.reduce((s, x) => s + x.netProfit, 0) / recent.length
    : finance.netProfit;
  const annualRevenue = avgRevenue * 52;
  const annualProfit = Math.max(0, avgProfit * 52);
  return Math.max(
    0,
    annualRevenue * config.valuation.revenueMultiple +
      annualProfit * config.valuation.profitMultiple +
      customers.active * config.valuation.customerMultiple
  );
}
