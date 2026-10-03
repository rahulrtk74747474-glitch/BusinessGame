const safe = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const money = (value) => '$' + Math.round(safe(value)).toLocaleString();
const pct = (value) => (safe(value) * 100).toFixed(1) + '%';
const ratio = (value) => Number.isFinite(value) ? value.toFixed(2) + 'x' : 'N/M';

export function createFinancialSnapshot(state, industry) {
  const f = state.finance;
  const current = state.history.at(-1) || {};
  const previous = state.history.length > 1 ? state.history.at(-2) : null;
  const openingCash = previous?.cash ?? f.startingCapital;
  const cashChange = f.cash - openingCash;
  const operatingExpenses = safe(f.fixedCosts) + safe(f.discretionaryCosts) + safe(f.payrollCosts) + safe(f.oneTimeExpenses) + safe(f.assetMaintenanceCosts);
  const contributionMargin = f.revenue > 0 ? 1 - safe(f.variableCosts) / f.revenue : 0;
  const breakEvenRevenue = contributionMargin > 0 ? operatingExpenses / contributionMargin : Infinity;
  const netMargin = f.revenue > 0 ? f.netProfit / f.revenue : 0;
  const operatingMargin = f.revenue > 0 ? f.operatingProfit / f.revenue : 0;
  const currentAssets = safe(f.cash) + safe(f.reserveCash) + safe(f.inventoryAsset) + safe(f.financialInvestments);
  const debtToEquity = f.bookEquity > 0 ? safe(f.debtBalance) / f.bookEquity : Infinity;
  const ltvCac = state.customers.effectiveCAC > 0 ? state.customers.estimatedLtv / state.customers.effectiveCAC : Infinity;
  const annualizedRevenue = f.revenue * 52;
  const valuationToRevenue = annualizedRevenue > 0 ? f.valuation / annualizedRevenue : 0;
  const burnRate = Math.max(0, -f.netProfit);
  const cashRunway = burnRate > 0 ? Math.max(0, f.cash / burnRate) : Infinity;
  const inventoryUnits = safe(state.operations?.inventoryUnits);
  const inventoryUnitCost = safe(state.operations?.inventoryUnitCost, industry.baseVariableCostPerOrder);

  return {
    week: state.week,
    outcome: f.netProfit >= 0 ? 'profit' : 'loss',
    pnl: {
      revenue: safe(f.revenue),
      variableCosts: safe(f.variableCosts),
      grossProfit: safe(f.grossProfit),
      grossMargin: safe(f.grossMargin),
      fixedCosts: safe(f.fixedCosts),
      discretionaryCosts: safe(f.discretionaryCosts),
      payrollCosts: safe(f.payrollCosts),
      oneTimeExpenses: safe(f.oneTimeExpenses),
      assetMaintenanceCosts: safe(f.assetMaintenanceCosts),
      operatingExpenses,
      operatingProfit: safe(f.operatingProfit),
      operatingMargin,
      depreciationExpense: safe(f.depreciationExpense),
      ebit: safe(f.ebit),
      investmentIncome: safe(f.investmentIncome),
      assetDisposalGainLoss: safe(f.assetDisposalGainLoss),
      interestExpense: safe(f.interestExpense),
      legalPenaltyExpense: safe(f.legalPenaltyExpense),
      preTaxProfit: safe(f.preTaxProfit),
      taxAccrued: safe(f.taxAccrued),
      netProfit: safe(f.netProfit),
      netMargin
    },
    cashFlow: {
      openingCash,
      endingCash: safe(f.cash),
      cashChange,
      inventoryPurchases: safe(f.inventoryPurchases),
      investmentIncome: safe(f.investmentIncome),
      debtService: safe(f.debtService),
      taxPayment: safe(f.taxPayment),
      reserveCash: safe(f.reserveCash)
    },
    balanceSheet: {
      cash: safe(f.cash),
      reserveCash: safe(f.reserveCash),
      inventoryAsset: safe(f.inventoryAsset),
      expansionAssets: safe(f.expansionAssets),
      ppeGross: safe(f.ppeGross),
      accumulatedDepreciation: safe(f.accumulatedDepreciation),
      ppeNet: safe(f.ppeNet),
      financialInvestments: safe(f.financialInvestments),
      taxWdvReference: safe(f.taxWdvReference),
      totalAssets: safe(f.totalAssets),
      debtBalance: safe(f.debtBalance),
      taxPayable: safe(f.taxPayable),
      totalLiabilities: safe(f.totalLiabilities),
      bookEquity: safe(f.bookEquity),
      currentAssets
    },
    ratios: {
      contributionMargin,
      breakEvenRevenue,
      burnRate,
      runwayWeeks: Number.isFinite(f.runwayWeeks) ? f.runwayWeeks : cashRunway,
      cac: safe(state.customers.effectiveCAC),
      ltv: safe(state.customers.estimatedLtv),
      ltvCac,
      debtToEquity,
      valuation: safe(f.valuation),
      annualizedRevenue,
      valuationToRevenue,
      roas: safe(state.marketing?.last?.estimatedROAS),
      inventoryUnits,
      inventoryUnitCost
    },
    current
  };
}

function diagnosis(snapshot) {
  if (snapshot.pnl.netProfit < 0) {
    if (snapshot.pnl.grossProfit <= 0) return 'The core unit economics are currently negative: direct costs are consuming all revenue before overhead is paid.';
    if (snapshot.pnl.operatingExpenses > snapshot.pnl.grossProfit) return 'The product is generating gross profit, but the current operating-cost base is larger than that gross profit.';
    return 'Operations are close to viability, but interest, penalties or tax effects are pulling the bottom line below zero.';
  }
  if (snapshot.pnl.grossMargin < 0.35) return 'The company is profitable this week, but the gross-margin cushion is thin and vulnerable to cost or pricing shocks.';
  if (snapshot.ratios.runwayWeeks < 8) return 'The company made money this week, but liquidity remains tight; one profitable week does not automatically solve a weak cash position.';
  return 'This week is profitable with a positive gross contribution. The next question is whether the result is repeatable and cash-generative.';
}

export function buildWeeklyFinancialLesson(state, industry, lessons) {
  if (state.week < 1 || state.week > lessons.length) return null;
  const definition = lessons.find((item) => item.week === state.week);
  if (!definition) return null;

  const s = createFinancialSnapshot(state, industry);
  let example = '';
  let action = '';

  switch (definition.key) {
    case 'revenue':
      example = 'This week ' + industry.name + ' recorded ' + money(s.pnl.revenue) + ' of revenue and ended with ' + money(s.cashFlow.endingCash) + ' of cash. Those numbers answer different questions.';
      action = 'Next turn, watch whether a pricing or volume decision changes revenue without assuming cash will move by the same amount.';
      break;
    case 'cogs':
      example = 'Direct/variable costs were ' + money(s.pnl.variableCosts) + ' on ' + money(s.pnl.revenue) + ' of revenue. That left ' + money(s.pnl.grossProfit) + ' before operating overhead.';
      action = 'Look for supplier, production, outsourcing or pricing decisions that improve contribution per sale.';
      break;
    case 'grossProfit':
      example = 'Revenue ' + money(s.pnl.revenue) + ' − direct costs ' + money(s.pnl.variableCosts) + ' = ' + money(s.pnl.grossProfit) + ' gross profit.';
      action = s.pnl.grossProfit < s.pnl.operatingExpenses ? 'Gross profit is not yet covering operating expenses. Improve price/mix/volume or reduce the cost base.' : 'Gross profit covers operating expenses this week; protect this cushion while growing.';
      break;
    case 'grossMargin':
      example = 'Gross margin is ' + pct(s.pnl.grossMargin) + '. For every $1 of revenue, about ' + Math.round(s.pnl.grossMargin * 100) + '¢ remains after direct costs.';
      action = 'Track whether discounts, supplier costs or outsourcing are compressing the percentage over time.';
      break;
    case 'fixedVariable':
      example = 'Variable costs were ' + money(s.pnl.variableCosts) + '; fixed operating costs were ' + money(s.pnl.fixedCosts) + '. Fixed costs continue even if next week\'s sales fall.';
      action = 'Before hiring, leasing or expanding, estimate whether the new fixed cost is supported by repeatable gross profit.';
      break;
    case 'opex':
      example = 'Operating expenses were about ' + money(s.pnl.operatingExpenses) + ': fixed ' + money(s.pnl.fixedCosts) + ', discretionary ' + money(s.pnl.discretionaryCosts) + ', payroll ' + money(s.pnl.payrollCosts) + ' and one-time ' + money(s.pnl.oneTimeExpenses) + '.';
      action = 'Classify each major expense as growth investment, necessary overhead or avoidable cost.';
      break;
    case 'operatingProfit':
      example = 'Operating profit was ' + money(s.pnl.operatingProfit) + ' (' + pct(s.pnl.operatingMargin) + ' of revenue) before interest and tax.';
      action = 'Use operating profit to judge the business model separately from how the company is financed.';
      break;
    case 'netProfit':
      example = 'Pre-tax profit was ' + money(s.pnl.preTaxProfit) + ', tax accrued ' + money(s.pnl.taxAccrued) + ', leaving ' + money(s.pnl.netProfit) + ' net ' + s.outcome + '.';
      action = 'Do not celebrate revenue growth unless the bottom line and cash position are moving in a sustainable direction.';
      break;
    case 'cashFlow':
      example = 'Cash moved from about ' + money(s.cashFlow.openingCash) + ' to ' + money(s.cashFlow.endingCash) + ' (' + money(s.cashFlow.cashChange) + ' change), while accounting net profit was ' + money(s.pnl.netProfit) + '.';
      action = 'When profit and cash move differently, inspect inventory purchases, debt service, tax payments and financing actions.';
      break;
    case 'breakEven':
      example = Number.isFinite(s.ratios.breakEvenRevenue) ? 'At the current ' + pct(s.ratios.contributionMargin) + ' contribution margin and ' + money(s.pnl.operatingExpenses) + ' operating-cost base, weekly break-even revenue is about ' + money(s.ratios.breakEvenRevenue) + '.' : 'Contribution margin is not positive, so no finite sales level can cover the current cost structure.';
      action = s.pnl.revenue >= s.ratios.breakEvenRevenue ? 'Current revenue is above estimated break-even; focus on keeping margin and overhead disciplined.' : 'Current revenue is below estimated break-even; calculate the gap before adding more fixed costs.';
      break;
    case 'runway':
      example = s.pnl.netProfit < 0 ? 'Weekly loss is ' + money(Math.abs(s.pnl.netProfit)) + '; ending cash is ' + money(s.cashFlow.endingCash) + ' and estimated runway is ' + (Number.isFinite(s.ratios.runwayWeeks) ? s.ratios.runwayWeeks.toFixed(1) + ' weeks' : 'not meaningful') + '.' : 'The company made ' + money(s.pnl.netProfit) + ' this week, so there is no current accounting burn. Ending cash is ' + money(s.cashFlow.endingCash) + '.';
      action = 'Treat runway as an early warning. Financing is easier to arrange before the company is desperate.';
      break;
    case 'assets':
      example = 'Assets total ' + money(s.balanceSheet.totalAssets) + ': cash ' + money(s.balanceSheet.cash) + ', reserve ' + money(s.balanceSheet.reserveCash) + ', inventory ' + money(s.balanceSheet.inventoryAsset) + ', expansion assets ' + money(s.balanceSheet.expansionAssets) + ', net PPE ' + money(s.balanceSheet.ppeNet) + ' and financial investments ' + money(s.balanceSheet.financialInvestments) + '.';
      action = 'Ask whether each asset is productive, liquid and worth the cash tied up in it.';
      break;
    case 'liabilities':
      example = 'Liabilities total ' + money(s.balanceSheet.totalLiabilities) + ': debt ' + money(s.balanceSheet.debtBalance) + ' and tax payable ' + money(s.balanceSheet.taxPayable) + ' in the current model.';
      action = 'Before taking more debt, compare the new repayment burden with stable operating cash generation.';
      break;
    case 'equity':
      example = money(s.balanceSheet.totalAssets) + ' assets − ' + money(s.balanceSheet.totalLiabilities) + ' liabilities = ' + money(s.balanceSheet.bookEquity) + ' book equity.';
      action = 'Remember: book equity is an accounting residual; company valuation can be much higher or lower.';
      break;
    case 'workingCapital':
      example = s.balanceSheet.inventoryAsset > 0 ? money(s.balanceSheet.inventoryAsset) + ' is tied up in inventory (' + s.ratios.inventoryUnits.toFixed(0) + ' units at roughly ' + money(s.ratios.inventoryUnitCost) + ' each).' : 'This business currently has little or no physical inventory, so working-capital pressure comes more from cash timing, receivables/contracts and operating commitments.';
      action = 'Avoid confusing inventory purchases with immediate P&L expense; unsold inventory remains an asset until sold or written off.';
      break;
    case 'cac':
      example = 'Effective CAC is about ' + money(s.ratios.cac) + ' per acquired customer. Current marketing ROAS is ' + ratio(s.ratios.roas) + '.';
      action = 'If CAC rises, find out whether channel saturation, competitors or weak conversion is the cause before increasing spend.';
      break;
    case 'ltv':
      example = 'Estimated LTV is ' + money(s.ratios.ltv) + ' versus CAC of ' + money(s.ratios.cac) + ', an LTV:CAC ratio of ' + ratio(s.ratios.ltvCac) + '.';
      action = s.ratios.ltvCac >= 3 ? 'The ratio is strong enough to investigate scaling, but verify that the estimate remains stable as acquisition spend grows.' : 'Improve retention, margin or acquisition efficiency before aggressively scaling paid growth.';
      break;
    case 'debt':
      example = 'Debt balance is ' + money(s.balanceSheet.debtBalance) + ', interest this week ' + money(s.pnl.interestExpense) + ', and debt service ' + money(s.cashFlow.debtService) + '. Debt-to-book-equity is ' + ratio(s.ratios.debtToEquity) + '.';
      action = 'Debt avoids dilution, but repayments are mandatory even during weak weeks. Stress-test cash before borrowing.';
      break;
    case 'tax':
      example = 'Tax accrued this week was ' + money(s.pnl.taxAccrued) + ', cash tax paid was ' + money(s.cashFlow.taxPayment) + ', and tax payable now stands at ' + money(s.balanceSheet.taxPayable) + '.';
      action = 'Treat unpaid accrued tax as money the business does not truly have available for discretionary spending.';
      break;
    case 'valuation':
      example = 'Current game valuation is ' + money(s.ratios.valuation) + ' versus book equity of ' + money(s.balanceSheet.bookEquity) + ' and annualized current-week revenue of ' + money(s.ratios.annualizedRevenue) + '.';
      action = 'Use valuation as an estimate, not cash in the bank. Sustainable revenue, profit, customer economics and risk ultimately support it.';
      break;
    default:
      example = 'Net profit this week was ' + money(s.pnl.netProfit) + ' and ending cash was ' + money(s.cashFlow.endingCash) + '.';
      action = 'Open the Financials tab and connect the lesson to the statements.';
  }

  return {
    ...definition,
    snapshot: s,
    example,
    action,
    diagnosis: diagnosis(s),
    progress: state.week / lessons.length
  };
}
