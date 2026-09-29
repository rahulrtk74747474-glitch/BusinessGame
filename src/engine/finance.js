export function stepFinance(state, decisions, industry, config, customers, structureConfig, locationConfig, hrStep) {
  const contracts = state.negotiation?.contracts || {};
  const supplierActive = (contracts.supplierRemainingWeeks || 0) > 0 && Number.isFinite(contracts.supplierUnitCost);
  const effectiveVariableCostPerOrder = supplierActive
    ? contracts.supplierUnitCost
    : industry.baseVariableCostPerOrder;

  const clientActive = (contracts.clientRemainingWeeks || 0) > 0;
  const clientRevenue = clientActive ? (contracts.clientWeeklyRevenue || 0) : 0;
  const clientVariableCosts = clientRevenue * (clientActive ? (contracts.clientVariableCostRate || 0) : 0);

  const coreRevenue = customers.orders * decisions.price;
  const revenue = coreRevenue + clientRevenue;
  const variableCosts = customers.orders * effectiveVariableCostPerOrder + clientVariableCosts;

  const baseFixedCosts =
    industry.baseFixedCostPerWeek * locationConfig.fixedCostMultiplier +
    structureConfig.weeklyAdminCost;
  const landlordSavings = (contracts.landlordRemainingWeeks || 0) > 0
    ? Math.max(0, contracts.landlordWeeklySavings || 0)
    : 0;
  const fixedCosts = Math.max(0, baseFixedCosts - landlordSavings);

  const discretionaryCosts = decisions.marketingSpend + decisions.qualitySpend;
  const payrollCosts = hrStep?.payrollCost || 0;

  // HR and negotiation actions such as interviews, training, severance and
  // research are paid immediately. Recognize them in this week's P&L without
  // subtracting their cash a second time.
  const hrOneTimeExpenses = state.hr?.pendingExpenseRecognition || 0;
  const negotiationOneTimeExpenses = state.negotiation?.pendingExpenseRecognition || 0;

  const cashOperatingProfit =
    revenue - variableCosts - fixedCosts - discretionaryCosts - payrollCosts;
  const operatingProfit =
    cashOperatingProfit - hrOneTimeExpenses - negotiationOneTimeExpenses;

  const taxableProfit = Math.max(0, operatingProfit);
  const taxAccrued = taxableProfit * structureConfig.taxRate;
  const cashBeforeTaxPayment = state.finance.cash + cashOperatingProfit;

  const shouldPayTax = (state.week + 1) % config.finance.taxPaymentIntervalWeeks === 0;
  const priorTaxPayable = state.finance.taxPayable;
  const taxPayment = shouldPayTax ? priorTaxPayable + taxAccrued : 0;
  const taxPayable = shouldPayTax ? 0 : priorTaxPayable + taxAccrued;
  const cash = cashBeforeTaxPayment - taxPayment;
  const netProfit = operatingProfit - taxAccrued;

  const trailingBurn = netProfit < 0 ? Math.abs(netProfit) : 0;
  const runwayWeeks = trailingBurn > 0 ? Math.max(0, cash / trailingBurn) : Infinity;
  const grossProfit = revenue - variableCosts;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;

  return {
    startingCapital: state.finance.startingCapital,
    cash,
    revenue,
    coreRevenue,
    clientRevenue,
    variableCosts,
    effectiveVariableCostPerOrder,
    supplierContractActive: supplierActive,
    clientVariableCosts,
    fixedCosts,
    landlordSavings,
    discretionaryCosts,
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
  const avgRevenue = recent.length ? recent.reduce((s, x) => s + x.revenue, 0) / recent.length : finance.revenue;
  const avgProfit = recent.length ? recent.reduce((s, x) => s + x.netProfit, 0) / recent.length : finance.netProfit;
  const annualRevenue = avgRevenue * 52;
  const annualProfit = Math.max(0, avgProfit * 52);
  return Math.max(0,
    annualRevenue * config.valuation.revenueMultiple +
    annualProfit * config.valuation.profitMultiple +
    customers.active * config.valuation.customerMultiple
  );
}
