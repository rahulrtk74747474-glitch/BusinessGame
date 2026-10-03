const safe = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const money = (value) => '$' + Math.round(safe(value)).toLocaleString();
const money2 = (value) => '$' + safe(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (value) => (safe(value) * 100).toFixed(1) + '%';
const ratio = (value) => Number.isFinite(value) ? value.toFixed(2) + 'x' : 'N/M';

function outcome(value, kind = 'money') {
  if (kind === 'pct') return pct(value);
  if (kind === 'ratio') return ratio(value);
  if (kind === 'weeks') return Number.isFinite(value) ? value.toFixed(1) + ' weeks' : 'No current burn';
  return money(value);
}

export function buildFormulaExplanation(key, state, industry, catalog, snapshot) {
  const def = catalog.find((item) => item.key === key);
  if (!def) return null;

  const s = snapshot;
  const f = state.finance;
  const current = state.history.at(-1) || {};
  let steps = [];
  let result = '';
  let interpretation = '';
  let inputs = [];

  const set = (name, value) => inputs.push({ name, value });

  switch (key) {
    case 'revenue': {
      const core = safe(f.coreRevenue);
      const client = safe(f.clientRevenue);
      const sales = safe(f.salesRevenue);
      const expansion = safe(f.expansionRevenue);
      set('Core sales', money(core)); set('Client revenue', money(client)); set('B2B sales', money(sales)); set('Expansion revenue', money(expansion));
      steps = [money(core) + ' + ' + money(client) + ' + ' + money(sales) + ' + ' + money(expansion), '= ' + money(s.pnl.revenue)];
      result = money(s.pnl.revenue);
      interpretation = 'This is the top line for week ' + state.week + '. It says how much was sold, not how much profit or cash the company kept.';
      break;
    }
    case 'variableCosts': {
      const core = safe(f.coreCogs);
      const client = safe(f.clientVariableCosts);
      const sales = safe(f.salesVariableCosts);
      set('Core COGS', money(core)); set('Client variable cost', money(client)); set('Sales-contract variable cost', money(sales));
      steps = [money(core) + ' + ' + money(client) + ' + ' + money(sales), '= ' + money(s.pnl.variableCosts)];
      result = money(s.pnl.variableCosts);
      interpretation = 'These direct costs consumed ' + pct(s.pnl.revenue > 0 ? s.pnl.variableCosts / s.pnl.revenue : 0) + ' of revenue this week.';
      break;
    }
    case 'grossProfit':
      set('Revenue', money(s.pnl.revenue)); set('Variable costs', money(s.pnl.variableCosts));
      steps = [money(s.pnl.revenue) + ' − ' + money(s.pnl.variableCosts), '= ' + money(s.pnl.grossProfit)];
      result = money(s.pnl.grossProfit);
      interpretation = s.pnl.grossProfit >= s.pnl.operatingExpenses ? 'Gross profit currently covers operating expenses.' : 'Gross profit is currently smaller than operating expenses.';
      break;
    case 'grossMargin':
      set('Gross profit', money(s.pnl.grossProfit)); set('Revenue', money(s.pnl.revenue));
      steps = [money(s.pnl.grossProfit) + ' ÷ ' + money(s.pnl.revenue), '= ' + safe(s.pnl.grossMargin).toFixed(3), '× 100 = ' + pct(s.pnl.grossMargin)];
      result = pct(s.pnl.grossMargin);
      interpretation = 'About ' + Math.round(s.pnl.grossMargin * 100) + ' cents of each revenue dollar remains after direct costs.';
      break;
    case 'operatingExpenses':
      set('Fixed costs', money(s.pnl.fixedCosts)); set('Discretionary costs', money(s.pnl.discretionaryCosts)); set('Payroll', money(s.pnl.payrollCosts)); set('One-time expenses', money(s.pnl.oneTimeExpenses)); set('Asset maintenance', money(s.pnl.assetMaintenanceCosts));
      steps = [money(s.pnl.fixedCosts) + ' + ' + money(s.pnl.discretionaryCosts) + ' + ' + money(s.pnl.payrollCosts) + ' + ' + money(s.pnl.oneTimeExpenses) + ' + ' + money(s.pnl.assetMaintenanceCosts), '= ' + money(s.pnl.operatingExpenses)];
      result = money(s.pnl.operatingExpenses);
      interpretation = 'This is the weekly cost base that gross profit must support before interest and tax.';
      break;
    case 'operatingProfit':
      set('Gross profit', money(s.pnl.grossProfit)); set('Operating expenses', money(s.pnl.operatingExpenses));
      steps = [money(s.pnl.grossProfit) + ' − ' + money(s.pnl.operatingExpenses), '= ' + money(s.pnl.operatingProfit)];
      result = money(s.pnl.operatingProfit);
      interpretation = s.pnl.operatingProfit >= 0 ? 'The core business was operating-profit positive this week.' : 'The core business did not cover its operating expense base this week.';
      break;
    case 'operatingMargin':
      set('Operating profit', money(s.pnl.operatingProfit)); set('Revenue', money(s.pnl.revenue));
      steps = [money(s.pnl.operatingProfit) + ' ÷ ' + money(s.pnl.revenue), '× 100 = ' + pct(s.pnl.operatingMargin)];
      result = pct(s.pnl.operatingMargin);
      interpretation = 'This is operating profit retained per dollar of revenue before financing and tax.';
      break;
    case 'depreciationExpense':
      set('Gross PPE', money(s.balanceSheet.ppeGross)); set('Current weekly depreciation', money(s.pnl.depreciationExpense));
      steps = ['For each owned asset: (cost − residual value) ÷ useful-life weeks', 'Total current week depreciation = ' + money(s.pnl.depreciationExpense)];
      result = money(s.pnl.depreciationExpense);
      interpretation = 'This reduces accounting profit and net PPE, but the asset purchase cash left the company when the asset was bought.';
      break;
    case 'ebit':
      set('EBITDA-like operating profit', money(s.pnl.operatingProfit)); set('Depreciation', money(s.pnl.depreciationExpense));
      steps = [money(s.pnl.operatingProfit) + ' − ' + money(s.pnl.depreciationExpense), '= ' + money(s.pnl.ebit)];
      result = money(s.pnl.ebit);
      interpretation = 'EBIT measures operating performance after recognizing wear/consumption of depreciable assets.';
      break;
    case 'investmentIncome':
      set('Financial investments', money(s.balanceSheet.financialInvestments)); set('Weekly investment income', money(s.pnl.investmentIncome));
      steps = ['Each holding principal × simulated annual return ÷ 52', '= ' + money(s.pnl.investmentIncome)];
      result = money(s.pnl.investmentIncome);
      interpretation = 'This is non-operating income from treasury cash investments, not customer revenue.';
      break;
    case 'accumulatedDepreciation':
      set('Gross PPE', money(s.balanceSheet.ppeGross)); set('Accumulated depreciation', money(s.balanceSheet.accumulatedDepreciation));
      steps = ['Sum depreciation recorded since each asset was purchased', '= ' + money(s.balanceSheet.accumulatedDepreciation)];
      result = money(s.balanceSheet.accumulatedDepreciation);
      interpretation = 'It is a contra-asset balance: it reduces gross PPE to the carrying value shown as net PPE.';
      break;
    case 'ppeNet':
      set('Gross PPE', money(s.balanceSheet.ppeGross)); set('Accumulated depreciation', money(s.balanceSheet.accumulatedDepreciation));
      steps = [money(s.balanceSheet.ppeGross) + ' − ' + money(s.balanceSheet.accumulatedDepreciation), '= ' + money(s.balanceSheet.ppeNet)];
      result = money(s.balanceSheet.ppeNet);
      interpretation = 'This is the accounting carrying value of owned depreciating fixed assets.';
      break;
    case 'preTaxProfit':
      set('EBIT', money(s.pnl.ebit)); set('Investment income', money(s.pnl.investmentIncome)); set('Asset disposal gain/loss', money(s.pnl.assetDisposalGainLoss)); set('Interest', money(s.pnl.interestExpense)); set('Legal penalties', money(s.pnl.legalPenaltyExpense));
      steps = [money(s.pnl.ebit) + ' + ' + money(s.pnl.investmentIncome) + ' + ' + money(s.pnl.assetDisposalGainLoss) + ' − ' + money(s.pnl.interestExpense) + ' − ' + money(s.pnl.legalPenaltyExpense), '= ' + money(s.pnl.preTaxProfit)];
      result = money(s.pnl.preTaxProfit);
      interpretation = 'This is profit after depreciation, treasury/disposal effects and financing/legal costs, but before income tax.';
      break;
    case 'taxAccrued': {
      const impliedRate = s.pnl.preTaxProfit > 0 ? s.pnl.taxAccrued / s.pnl.preTaxProfit : 0;
      set('Taxable pre-tax profit', money(Math.max(0, s.pnl.preTaxProfit))); set('Simulation tax rate', pct(impliedRate));
      steps = [money(Math.max(0, s.pnl.preTaxProfit)) + ' × ' + pct(impliedRate), '= ' + money(s.pnl.taxAccrued)];
      result = money(s.pnl.taxAccrued);
      interpretation = 'The tax expense can be recognized before the cash payment date, which is why tax payable can build up.';
      break;
    }
    case 'netProfit':
      set('Profit before tax', money(s.pnl.preTaxProfit)); set('Tax accrued', money(s.pnl.taxAccrued));
      steps = [money(s.pnl.preTaxProfit) + ' − ' + money(s.pnl.taxAccrued), '= ' + money(s.pnl.netProfit)];
      result = money(s.pnl.netProfit);
      interpretation = s.pnl.netProfit >= 0 ? 'The company recorded a net profit this week.' : 'The company recorded a net loss this week.';
      break;
    case 'netMargin':
      set('Net profit', money(s.pnl.netProfit)); set('Revenue', money(s.pnl.revenue));
      steps = [money(s.pnl.netProfit) + ' ÷ ' + money(s.pnl.revenue), '× 100 = ' + pct(s.pnl.netMargin)];
      result = pct(s.pnl.netMargin);
      interpretation = 'This is the final accounting profit kept from each dollar of revenue.';
      break;
    case 'cashChange':
      set('Ending cash', money(s.cashFlow.endingCash)); set('Previous ending cash', money(s.cashFlow.openingCash));
      steps = [money(s.cashFlow.endingCash) + ' − ' + money(s.cashFlow.openingCash), '= ' + money(s.cashFlow.cashChange)];
      result = money(s.cashFlow.cashChange);
      interpretation = s.cashFlow.cashChange >= 0 ? 'Operating cash increased over the week.' : 'Operating cash decreased over the week.';
      break;
    case 'runway': {
      const burn = Math.max(0, -s.pnl.netProfit);
      set('Cash', money(s.cashFlow.endingCash)); set('Weekly burn', money(burn));
      steps = burn > 0 ? [money(s.cashFlow.endingCash) + ' ÷ ' + money(burn), '= ' + outcome(s.ratios.runwayWeeks, 'weeks')] : ['Net profit is not negative, so current accounting burn is $0.', '= No current burn'];
      result = outcome(s.ratios.runwayWeeks, 'weeks');
      interpretation = burn > 0 ? 'At the present loss rate, this is the approximate time before operating cash is exhausted.' : 'Runway is not constrained by a current accounting loss.';
      break;
    }
    case 'inventoryAsset':
      set('Inventory units', safe(s.ratios.inventoryUnits).toFixed(0)); set('Average unit cost', money2(s.ratios.inventoryUnitCost));
      steps = [safe(s.ratios.inventoryUnits).toFixed(0) + ' × ' + money2(s.ratios.inventoryUnitCost), '≈ ' + money(s.balanceSheet.inventoryAsset)];
      result = money(s.balanceSheet.inventoryAsset);
      interpretation = s.balanceSheet.inventoryAsset > 0 ? 'This value is cash tied up in unsold output/inventory.' : 'This business currently has little or no physical inventory asset.';
      break;
    case 'totalAssets':
      set('Cash', money(s.balanceSheet.cash)); set('Reserve', money(s.balanceSheet.reserveCash)); set('Inventory', money(s.balanceSheet.inventoryAsset)); set('Expansion assets', money(s.balanceSheet.expansionAssets)); set('Net PPE', money(s.balanceSheet.ppeNet)); set('Financial investments', money(s.balanceSheet.financialInvestments));
      steps = [money(s.balanceSheet.cash) + ' + ' + money(s.balanceSheet.reserveCash) + ' + ' + money(s.balanceSheet.inventoryAsset) + ' + ' + money(s.balanceSheet.expansionAssets) + ' + ' + money(s.balanceSheet.ppeNet) + ' + ' + money(s.balanceSheet.financialInvestments), '= ' + money(s.balanceSheet.totalAssets)];
      result = money(s.balanceSheet.totalAssets);
      interpretation = 'This is the modeled resource base of the company at the end of the week.';
      break;
    case 'totalLiabilities':
      set('Debt', money(s.balanceSheet.debtBalance)); set('Tax payable', money(s.balanceSheet.taxPayable));
      steps = [money(s.balanceSheet.debtBalance) + ' + ' + money(s.balanceSheet.taxPayable), '= ' + money(s.balanceSheet.totalLiabilities)];
      result = money(s.balanceSheet.totalLiabilities);
      interpretation = 'These are claims that must be satisfied before owners receive the residual value.';
      break;
    case 'bookEquity':
      set('Total assets', money(s.balanceSheet.totalAssets)); set('Total liabilities', money(s.balanceSheet.totalLiabilities));
      steps = [money(s.balanceSheet.totalAssets) + ' − ' + money(s.balanceSheet.totalLiabilities), '= ' + money(s.balanceSheet.bookEquity)];
      result = money(s.balanceSheet.bookEquity);
      interpretation = 'Book equity is accounting net worth, not the same thing as the company valuation.';
      break;
    case 'contributionMargin':
      set('Revenue', money(s.pnl.revenue)); set('Variable costs', money(s.pnl.variableCosts));
      steps = ['(' + money(s.pnl.revenue) + ' − ' + money(s.pnl.variableCosts) + ') ÷ ' + money(s.pnl.revenue), '= ' + pct(s.ratios.contributionMargin)];
      result = pct(s.ratios.contributionMargin);
      interpretation = 'This percentage of revenue is available to cover operating expenses and then profit.';
      break;
    case 'breakEvenRevenue':
      set('Operating expenses', money(s.pnl.operatingExpenses)); set('Contribution margin', pct(s.ratios.contributionMargin));
      steps = Number.isFinite(s.ratios.breakEvenRevenue) ? [money(s.pnl.operatingExpenses) + ' ÷ ' + s.ratios.contributionMargin.toFixed(3), '= ' + money(s.ratios.breakEvenRevenue)] : ['Contribution margin is 0% or negative.', '= No finite break-even revenue'];
      result = Number.isFinite(s.ratios.breakEvenRevenue) ? money(s.ratios.breakEvenRevenue) : 'No finite break-even';
      interpretation = Number.isFinite(s.ratios.breakEvenRevenue) ? (s.pnl.revenue >= s.ratios.breakEvenRevenue ? 'Current weekly revenue is above this estimated break-even level.' : 'Current weekly revenue is below this estimated break-even level.') : 'The unit economics must improve before additional volume can create break-even.';
      break;
    case 'cac': {
      const spend = safe(current.marketingSpend);
      const paid = safe(current.paidAcquired);
      const simpleCac = paid > 0 ? spend / paid : Infinity;
      set('Marketing spend', money(spend)); set('Paid customers acquired', paid.toFixed(1)); set('Game effective CAC', money2(s.ratios.cac));
      steps = paid > 0 ? [money(spend) + ' ÷ ' + paid.toFixed(1), '= ' + money2(simpleCac) + ' simple observed CAC', 'Game effective CAC after channel/competition effects = ' + money2(s.ratios.cac)] : ['No paid customers were acquired this week.', 'Game effective CAC = ' + money2(s.ratios.cac)];
      result = money2(s.ratios.cac);
      interpretation = 'Compare CAC with LTV and gross contribution, not with revenue alone.';
      break;
    }
    case 'ltv': {
      const churn = safe(state.customers.churnRate);
      const active = safe(state.customers.active);
      const revenuePerCustomer = active > 0 ? safe(f.coreRevenue) / active : 0;
      const unitMargin = state.decisions.price > 0 ? Math.max(0, state.decisions.price - safe(f.effectiveVariableCostPerOrder)) / state.decisions.price : 0;
      set('Revenue per active customer', money2(revenuePerCustomer)); set('Estimated unit gross margin', pct(unitMargin)); set('Weekly churn', pct(churn));
      steps = churn > 0 ? [money2(revenuePerCustomer) + ' × ' + unitMargin.toFixed(3) + ' ÷ ' + churn.toFixed(3), '≈ ' + money2(s.ratios.ltv)] : ['Churn is 0, so this simplified LTV formula is not finite.'];
      result = money2(s.ratios.ltv);
      interpretation = 'LTV is an estimate. Small changes in churn can change it dramatically.';
      break;
    }
    case 'ltvCac':
      set('Estimated LTV', money2(s.ratios.ltv)); set('Effective CAC', money2(s.ratios.cac));
      steps = [money2(s.ratios.ltv) + ' ÷ ' + money2(s.ratios.cac), '= ' + ratio(s.ratios.ltvCac)];
      result = ratio(s.ratios.ltvCac);
      interpretation = s.ratios.ltvCac < 1 ? 'The current estimate suggests acquisition cost exceeds customer value.' : s.ratios.ltvCac < 3 ? 'Customer value exceeds CAC, but the cushion is still limited.' : 'The ratio has a strong cushion in this simulation; confirm it remains stable when scaling.';
      break;
    case 'roas':
      set('Current marketing ROAS', ratio(s.ratios.roas));
      steps = ['Attributed revenue ÷ advertising spend', '= ' + ratio(s.ratios.roas) + ' in the current marketing model'];
      result = ratio(s.ratios.roas);
      interpretation = 'ROAS measures revenue efficiency of ads, not total profitability. A 4x ROAS can still lose money if margins are poor.';
      break;
    case 'debtToEquity':
      set('Debt', money(s.balanceSheet.debtBalance)); set('Book equity', money(s.balanceSheet.bookEquity));
      steps = s.balanceSheet.bookEquity > 0 ? [money(s.balanceSheet.debtBalance) + ' ÷ ' + money(s.balanceSheet.bookEquity), '= ' + ratio(s.ratios.debtToEquity)] : ['Book equity is zero or negative, so the ratio is not meaningful.'];
      result = ratio(s.ratios.debtToEquity);
      interpretation = 'This shows how much debt exists for each dollar of accounting equity.';
      break;
    case 'annualizedRevenue':
      set('Current weekly revenue', money(s.pnl.revenue)); set('Weeks/year', '52');
      steps = [money(s.pnl.revenue) + ' × 52', '= ' + money(s.ratios.annualizedRevenue)];
      result = money(s.ratios.annualizedRevenue);
      interpretation = 'This is a run-rate estimate. It assumes the current week repeats, so seasonality and one-off sales can distort it.';
      break;
    case 'valuationToRevenue':
      set('Valuation', money(s.ratios.valuation)); set('Annualized revenue', money(s.ratios.annualizedRevenue));
      steps = [money(s.ratios.valuation) + ' ÷ ' + money(s.ratios.annualizedRevenue), '= ' + ratio(s.ratios.valuationToRevenue)];
      result = ratio(s.ratios.valuationToRevenue);
      interpretation = 'This is a valuation multiple, not a profitability ratio. Compare with businesses that have similar growth, margins and risk.';
      break;
    case 'valuation':
      set('Game valuation', money(s.ratios.valuation)); set('Debt deducted', money(s.balanceSheet.debtBalance)); set('Annualized revenue', money(s.ratios.annualizedRevenue));
      steps = ['Revenue value + profit value + customer value − debt + selected asset adjustments', '= ' + money(s.ratios.valuation)];
      result = money(s.ratios.valuation);
      interpretation = 'Valuation is an estimate of company worth; it cannot be spent unless a financing or sale transaction converts some of that value into cash.';
      break;
    default:
      return { ...def, inputs: [], steps: ['No worked calculation is available yet.'], result: '—', interpretation: def.meaning };
  }

  return { ...def, inputs, steps, result, interpretation };
}

export function formulaKeys(catalog) {
  return catalog.map((item) => item.key);
}
