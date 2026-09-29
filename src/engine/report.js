const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';
const money = (n) => '$' + Math.round(n || 0).toLocaleString();

export function createMonthlyReport(state, config) {
  const period = config.turn.reportEveryWeeks;
  const recent = state.history.slice(-period);
  if (!recent.length) return null;
  const previous = state.history.slice(-(period * 2), -period);
  const rCfg = config.reports;

  const sum = (rows, key) => rows.reduce((s, row) => s + (row[key] || 0), 0);
  const avg = (rows, key) => rows.length ? sum(rows, key) / rows.length : 0;

  const currentRevenue = sum(recent, 'revenue');
  const currentProfit = sum(recent, 'netProfit');
  const previousRevenue = sum(previous, 'revenue');
  const explanations = [];

  if (previous.length && previousRevenue !== 0) {
    const revenueDelta = (currentRevenue - previousRevenue) / previousRevenue;
    if (Math.abs(revenueDelta) > rCfg.revenueChangeExplainThreshold) {
      explanations.push(
        'Revenue ' + (revenueDelta > 0 ? 'rose ' : 'fell ') +
        pct(Math.abs(revenueDelta)) +
        ', while average weekly orders moved from ' +
        avg(previous, 'orders').toFixed(0) + ' to ' +
        avg(recent, 'orders').toFixed(0) + '.'
      );
    }
  }

  const first = recent[0];
  const last = recent.at(-1);
  const awarenessDelta = last.awareness - first.awareness;
  if (Math.abs(awarenessDelta) > rCfg.awarenessChangeExplainThreshold) {
    explanations.push(
      'Awareness ' + (awarenessDelta > 0 ? 'improved' : 'declined') +
      ' from ' + pct(first.awareness) + ' to ' + pct(last.awareness) +
      ', affecting organic acquisition.'
    );
  }

  const satisfactionDelta = last.satisfaction - first.satisfaction;
  if (Math.abs(satisfactionDelta) > rCfg.satisfactionChangeExplainThreshold) {
    explanations.push(
      'Customer satisfaction ' + (satisfactionDelta > 0 ? 'improved' : 'weakened') +
      ' from ' + pct(first.satisfaction) + ' to ' + pct(last.satisfaction) +
      ', affecting churn, referrals and conversion.'
    );
  }

  if (avg(recent, 'lostOrders') > rCfg.lostOrdersExplainThreshold) {
    explanations.push(
      'Capacity or inventory constraints caused about ' +
      avg(recent, 'lostOrders').toFixed(0) +
      ' lost orders per week.'
    );
  }

  if (avg(recent, 'grossMargin') < rCfg.lowGrossMarginThreshold) {
    explanations.push(
      'Gross margin averaged ' + pct(avg(recent, 'grossMargin')) +
      '; pricing, input costs and delivery costs are limiting contribution.'
    );
  }

  const marketingSpend = sum(recent, 'marketingSpend');
  if (marketingSpend > 0) {
    explanations.push(
      'Marketing spent ' + money(marketingSpend) +
      ', acquired about ' + sum(recent, 'paidAcquired').toFixed(0) +
      ' paid customers and averaged ' +
      avg(recent, 'marketingROAS').toFixed(2) + 'x estimated contribution ROAS.'
    );
  }

  const salesRevenue = sum(recent, 'salesRevenue');
  if (salesRevenue > 0 || sum(recent, 'salesNewLeads') > 0) {
    explanations.push(
      'B2B sales produced ' + money(salesRevenue) +
      ' of revenue this period, while the current pipeline is about ' +
      money(last.salesPipelineValue || 0) + '.'
    );
  }

  const inventoryPurchases = sum(recent, 'inventoryPurchases');
  if (inventoryPurchases > 0 || recent.some((row) => row.stockoutConstrained)) {
    explanations.push(
      'Inventory purchases used ' + money(inventoryPurchases) +
      ' of cash. Average fulfillment was ' +
      pct(avg(recent, 'fulfillmentRate')) +
      ', showing the working-capital trade-off between stockouts and excess inventory.'
    );
  }

  const competitorPressure = avg(recent, 'competitorPressure');
  if (competitorPressure > 0.12) {
    explanations.push(
      'Competitive pressure averaged ' + pct(competitorPressure) +
      ', reducing accessible demand and increasing acquisition difficulty.'
    );
  }

  const payroll = sum(recent, 'payrollCosts');
  if (payroll > 0) {
    explanations.push(
      'Payroll cost ' + money(payroll) +
      ' over four weeks. Team productivity averaged ' +
      pct(avg(recent, 'teamProductivity')) +
      ' and burnout averaged ' + pct(avg(recent, 'teamBurnout')) + '.'
    );
  }

  const negotiationExpenses = sum(recent, 'negotiationOneTimeExpenses');
  const clientContractRevenue = sum(recent, 'clientContractRevenue');
  const landlordSavings = sum(recent, 'landlordSavings');
  if (negotiationExpenses > 0 || clientContractRevenue > 0 || landlordSavings > 0) {
    explanations.push(
      'Negotiated contracts contributed ' + money(clientContractRevenue) +
      ' of client revenue and ' + money(landlordSavings) +
      ' of lease savings this period.'
    );
  }

  const debtService = sum(recent, 'debtService');
  const interestExpense = sum(recent, 'interestExpense');
  if (debtService > 0) {
    explanations.push(
      'Debt consumed ' + money(debtService) +
      ' of cash this period, including about ' +
      money(interestExpense) +
      ' of interest expense. Debt raises runway today but creates a fixed future claim on cash.'
    );
  }

  const insurancePremiums = sum(recent, 'insurancePremiums');
  if (insurancePremiums > 0) {
    explanations.push(
      'Insurance cost ' + money(insurancePremiums) +
      ' this period while reducing loss severity and improving the company risk profile.'
    );
  }

  const legalPenalty = sum(recent, 'legalPenalty');
  if (legalPenalty > 0 || recent.some((row) => row.shutdownActive)) {
    explanations.push(
      'Compliance failures cost ' + money(legalPenalty) +
      ' this period' +
      (recent.some((row) => row.shutdownActive) ? ' and disrupted operations through a shutdown.' : '.')
    );
  }

  const expansionRevenue = sum(recent, 'expansionRevenue');
  if (expansionRevenue > 0 || avg(recent, 'expansionCapacityAdd') > 0) {
    explanations.push(
      'Completed expansion projects added ' + money(expansionRevenue) +
      ' of direct revenue this period and about ' +
      avg(recent, 'expansionCapacityAdd').toFixed(0) +
      ' units of extra weekly capacity.'
    );
  }

  explanations.push(
    currentProfit < 0
      ? 'The business lost ' + money(Math.abs(currentProfit)) + ' this report period because the full operating and financing cost base exceeded gross profit.'
      : 'The business earned ' + money(currentProfit) + ' after tax accrual this report period.'
  );

  return {
    week: state.week,
    revenue: currentRevenue,
    netProfit: currentProfit,
    endingCash: state.finance.cash,
    averageOrders: avg(recent, 'orders'),
    averageCAC: avg(recent, 'effectiveCAC'),
    averageSatisfaction: avg(recent, 'satisfaction'),
    payroll,
    averageHeadcount: avg(recent, 'headcount'),
    averageTeamProductivity: avg(recent, 'teamProductivity'),
    marketingSpend,
    salesRevenue,
    inventoryPurchases,
    averageFulfillment: avg(recent, 'fulfillmentRate'),
    competitorPressure,
    clientContractRevenue,
    landlordSavings,
    negotiationExpenses,
    debtService,
    interestExpense,
    endingDebt: state.finance.debtBalance || 0,
    complianceScore: state.legal?.complianceScore || 0,
    riskScore: state.risk?.last?.riskScore || 0,
    insurancePremiums,
    legalPenalty,
    expansionRevenue,
    emergencyReserve: state.risk?.reserveCash || 0,
    explanations: explanations.slice(0, Math.max(rCfg.maxExplanations, 8))
  };
}
