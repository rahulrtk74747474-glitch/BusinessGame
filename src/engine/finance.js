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
  salesStep,
  phase5Step = {}
) {
  const contracts = state.negotiation?.contracts || {};
  const clientActive = (contracts.clientRemainingWeeks || 0) > 0;
  const clientRevenue = clientActive ? (contracts.clientWeeklyRevenue || 0) : 0;
  const clientVariableCosts =
    clientRevenue *
    (clientActive ? (contracts.clientVariableCostRate || 0) : 0);

  const expansionRevenue = phase5Step.expansion?.weeklyRevenue || 0;
  const coreRevenue = customers.orders * decisions.price;
  const salesRevenue = salesStep?.last?.revenue || 0;
  const revenue = coreRevenue + clientRevenue + salesRevenue + expansionRevenue;

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
  const expansionFixedCosts = phase5Step.expansion?.weeklyFixedCost || 0;
  const assetMaintenanceCosts = phase5Step.assets?.maintenanceCashCost || 0;
  const fixedCosts =
    Math.max(0, baseFixedCosts - landlordSavings) +
    operationsFixedCosts +
    expansionFixedCosts;

  const marketingSpend = marketingStep?.last?.totalSpend ?? decisions.marketingSpend;
  const qualitySpend = decisions.qualitySpend;
  const salesOutboundSpend = salesStep?.last?.outboundSpend || 0;
  const salesCommissionCost = salesStep?.last?.commissionCost || 0;
  const riskPremiums = phase5Step.risk?.weeklyPremiums || 0;
  const crowdfundingCost = phase5Step.funding?.crowdfundingCost || 0;
  const discretionaryCosts =
    marketingSpend +
    qualitySpend +
    salesOutboundSpend +
    salesCommissionCost +
    riskPremiums +
    crowdfundingCost;

  const payrollCosts = hrStep?.payrollCost || 0;
  const inventoryPurchases = operationsStep?.last?.purchaseCash || 0;

  const hrOneTimeExpenses = state.hr?.pendingExpenseRecognition || 0;
  const negotiationOneTimeExpenses =
    state.negotiation?.pendingExpenseRecognition || 0;
  const fundingOneTimeExpenses =
    state.funding?.pendingExpenseRecognition || 0;
  const legalOneTimeExpenses =
    state.legal?.pendingExpenseRecognition || 0;
  const riskOneTimeExpenses =
    state.risk?.pendingExpenseRecognition || 0;
  const exitOneTimeExpenses =
    state.exit?.pendingExpenseRecognition || 0;
  const oneTimeExpenses =
    hrOneTimeExpenses +
    negotiationOneTimeExpenses +
    fundingOneTimeExpenses +
    legalOneTimeExpenses +
    riskOneTimeExpenses +
    exitOneTimeExpenses;

  const operatingProfit =
    revenue -
    variableCosts -
    fixedCosts -
    discretionaryCosts -
    payrollCosts -
    oneTimeExpenses -
    assetMaintenanceCosts;

  const depreciationExpense = phase5Step.assets?.depreciationExpense || 0;
  const ebit = operatingProfit - depreciationExpense;
  const investmentIncome = phase5Step.assets?.investmentIncome || 0;
  const assetDisposalGainLoss = phase5Step.assets?.disposalGainLoss || 0;

  const interestExpense = phase5Step.funding?.interestExpense || 0;
  const debtService = phase5Step.funding?.debtService || 0;
  const legalPenaltyExpense = phase5Step.legal?.penaltyExpense || 0;
  const legalPenaltyCash = phase5Step.legal?.penaltyCash || 0;
  const preTaxProfit =
    ebit +
    investmentIncome +
    assetDisposalGainLoss -
    interestExpense -
    legalPenaltyExpense;

  const directVariableCashCosts =
    clientVariableCosts + salesVariableCosts;
  const cashOperatingProfit =
    revenue +
    investmentIncome -
    inventoryPurchases -
    directVariableCashCosts -
    fixedCosts -
    discretionaryCosts -
    payrollCosts -
    assetMaintenanceCosts -
    legalPenaltyCash -
    debtService;

  const taxableProfit = Math.max(0, preTaxProfit);
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
  const netProfit = preTaxProfit - taxAccrued;

  const trailingBurn = netProfit < 0 ? Math.abs(netProfit) : 0;
  const runwayWeeks =
    trailingBurn > 0 ? Math.max(0, cash / trailingBurn) : Infinity;
  const grossProfit = revenue - variableCosts;
  const grossMargin =
    revenue > 0 ? grossProfit / revenue : 0;

  const inventoryAsset =
    (operationsStep?.inventoryUnits || 0) *
    (operationsStep?.inventoryUnitCost || 0);
  const reserveCash = state.risk?.reserveCash || 0;
  const expansionAssets = state.expansion?.capitalizedAssets || 0;
  const ppeGross = phase5Step.assets?.grossPpe || 0;
  const accumulatedDepreciation = phase5Step.assets?.accumulatedDepreciation || 0;
  const ppeNet = phase5Step.assets?.netPpe || 0;
  const financialInvestments = phase5Step.assets?.financialInvestments || 0;
  const taxWdvReference = phase5Step.assets?.taxWdvReference || 0;
  const debtBalance =
    phase5Step.funding?.state?.debts?.reduce((sum, debt) => sum + debt.balance, 0) ??
    state.funding?.debts?.reduce((sum, debt) => sum + debt.balance, 0) ??
    0;
  const totalAssets =
    cash +
    reserveCash +
    inventoryAsset +
    expansionAssets +
    ppeNet +
    financialInvestments;
  const totalLiabilities =
    debtBalance + taxPayable;
  const bookEquity =
    totalAssets - totalLiabilities;

  return {
    startingCapital: state.finance.startingCapital,
    cash,
    totalLiquidity: cash + reserveCash,
    revenue,
    coreRevenue,
    clientRevenue,
    salesRevenue,
    expansionRevenue,
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
    expansionFixedCosts,
    landlordSavings,
    discretionaryCosts,
    marketingSpend,
    qualitySpend,
    salesOutboundSpend,
    salesCommissionCost,
    riskPremiums,
    crowdfundingCost,
    inventoryPurchases,
    inventoryAsset,
    expansionAssets,
    ppeGross,
    accumulatedDepreciation,
    ppeNet,
    financialInvestments,
    taxWdvReference,
    assetMaintenanceCosts,
    depreciationExpense,
    ebit,
    investmentIncome,
    assetDisposalGainLoss,
    payrollCosts,
    hrOneTimeExpenses,
    negotiationOneTimeExpenses,
    fundingOneTimeExpenses,
    legalOneTimeExpenses,
    riskOneTimeExpenses,
    exitOneTimeExpenses,
    oneTimeExpenses,
    grossProfit,
    grossMargin,
    operatingProfit,
    interestExpense,
    debtService,
    legalPenaltyExpense,
    preTaxProfit,
    taxAccrued,
    taxPayment,
    taxPayable,
    netProfit,
    cumulativeRevenue: state.finance.cumulativeRevenue + revenue,
    cumulativeProfit: state.finance.cumulativeProfit + netProfit,
    runwayWeeks,
    debtBalance,
    reserveCash,
    totalAssets,
    totalLiabilities,
    bookEquity
  };
}

export function estimateValuation(
  history,
  finance,
  customers,
  config,
  capitalStructure = {}
) {
  const recent = history.slice(-8);
  const avgRevenue = recent.length
    ? recent.reduce((s, x) => s + x.revenue, 0) / recent.length
    : finance.revenue;
  const avgProfit = recent.length
    ? recent.reduce((s, x) => s + x.netProfit, 0) / recent.length
    : finance.netProfit;
  const annualRevenue = avgRevenue * 52;
  const annualProfit = Math.max(0, avgProfit * 52);
  const operatingValue =
    annualRevenue * config.valuation.revenueMultiple +
    annualProfit * config.valuation.profitMultiple +
    customers.active * config.valuation.customerMultiple;

  return Math.max(
    0,
    operatingValue -
      (capitalStructure.debt || 0) +
      (capitalStructure.reserveCash || 0) +
      (capitalStructure.expansionAssets || 0) * 0.6 +
      (capitalStructure.assetNetPpe || 0) * 0.55 +
      (capitalStructure.financialInvestments || 0)
  );
}
