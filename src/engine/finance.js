export function stepFinance(state, decisions, industry, config, customers, structureConfig, locationConfig, hrStep) {
  const revenue = customers.orders * decisions.price;
  const variableCosts = customers.orders * industry.baseVariableCostPerOrder;
  const fixedCosts = industry.baseFixedCostPerWeek * locationConfig.fixedCostMultiplier + structureConfig.weeklyAdminCost;
  const discretionaryCosts = decisions.marketingSpend + decisions.qualitySpend;
  const payrollCosts = hrStep?.payrollCost || 0;
  // Interview/training/severance cash was paid when the action happened.
  // We recognize it in this week's P&L without subtracting the cash twice.
  const hrOneTimeExpenses = state.hr?.pendingExpenseRecognition || 0;

  const cashOperatingProfit = revenue - variableCosts - fixedCosts - discretionaryCosts - payrollCosts;
  const operatingProfit = cashOperatingProfit - hrOneTimeExpenses;
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
    cash,
    revenue,
    variableCosts,
    fixedCosts,
    discretionaryCosts,
    payrollCosts,
    hrOneTimeExpenses,
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
