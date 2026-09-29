const pct = (n) => `${(n * 100).toFixed(1)}%`;
const money = (n) => `$${Math.round(n).toLocaleString()}`;

export function createMonthlyReport(state, config) {
  const period = config.turn.reportEveryWeeks;
  const recent = state.history.slice(-period);
  if (!recent.length) return null;
  const previous = state.history.slice(-(period * 2), -period);
  const rCfg = config.reports;

  const sum = (rows, key) =>
    rows.reduce((s, r) => s + (r[key] || 0), 0);
  const avg = (rows, key) =>
    rows.length ? sum(rows, key) / rows.length : 0;

  const currentRevenue = sum(recent, 'revenue');
  const currentProfit = sum(recent, 'netProfit');
  const previousRevenue = sum(previous, 'revenue');
  const explanations = [];

  if (previous.length) {
    const revenueDelta = previousRevenue
      ? (currentRevenue - previousRevenue) / previousRevenue
      : 0;
    if (
      Math.abs(revenueDelta) >
      rCfg.revenueChangeExplainThreshold
    ) {
      explanations.push(
        `Revenue ${revenueDelta > 0 ? 'rose' : 'fell'} ${pct(
          Math.abs(revenueDelta)
        )}, while average weekly orders moved from ${avg(
          previous,
          'orders'
        ).toFixed(0)} to ${avg(recent, 'orders').toFixed(0)}.`
      );
    }
  }

  const first = recent[0];
  const last = recent[recent.length - 1];
  const awarenessDelta = last.awareness - first.awareness;
  if (
    Math.abs(awarenessDelta) >
    rCfg.awarenessChangeExplainThreshold
  ) {
    explanations.push(
      `Awareness ${awarenessDelta > 0 ? 'improved' : 'declined'} from ${pct(
        first.awareness
      )} to ${pct(
        last.awareness
      )}, changing organic customer acquisition.`
    );
  }

  const satisfactionDelta =
    last.satisfaction - first.satisfaction;
  if (
    Math.abs(satisfactionDelta) >
    rCfg.satisfactionChangeExplainThreshold
  ) {
    explanations.push(
      `Customer satisfaction ${satisfactionDelta > 0 ? 'improved' : 'weakened'} from ${pct(
        first.satisfaction
      )} to ${pct(
        last.satisfaction
      )}, affecting churn, referrals, and conversion.`
    );
  }

  if (avg(recent, 'lostOrders') > rCfg.lostOrdersExplainThreshold) {
    explanations.push(
      `Capacity or inventory constraints caused about ${avg(
        recent,
        'lostOrders'
      ).toFixed(
        0
      )} lost orders per week, so existing demand could not fully become revenue.`
    );
  }

  if (
    avg(recent, 'grossMargin') <
    rCfg.lowGrossMarginThreshold
  ) {
    explanations.push(
      `Gross margin averaged ${pct(
        avg(recent, 'grossMargin')
      )}; pricing and delivery/input costs are limiting contribution toward fixed costs.`
    );
  }

  const marketingSpend = sum(recent, 'marketingSpend');
  const paidAcquired = sum(recent, 'paidAcquired');
  const avgMarketingROAS = avg(recent, 'marketingROAS');
  if (marketingSpend > 0) {
    explanations.push(
      `Marketing spent ${money(
        marketingSpend
      )}, acquired about ${paidAcquired.toFixed(
        0
      )} paid customers, and produced an estimated contribution ROAS of ${avgMarketingROAS.toFixed(
        2
      )}x. Channel mix and saturation explain why equal budgets can produce different CAC.`
    );
  }

  const salesRevenue = sum(recent, 'salesRevenue');
  const salesWins = sum(recent, 'salesWins');
  const pipelineValue = last.salesPipelineValue || 0;
  if (
    salesRevenue > 0 ||
    sum(recent, 'salesNewLeads') > 0
  ) {
    explanations.push(
      `The B2B sales funnel produced ${salesWins.toFixed(
        1
      )} expected wins and ${money(
        salesRevenue
      )} of revenue this period. Current proposal pipeline value is about ${money(
        pipelineValue
      )}; leads progress with a delay instead of converting instantly.`
    );
  }

  const inventoryPurchases = sum(
    recent,
    'inventoryPurchases'
  );
  const avgInventory = avg(recent, 'inventoryUnits');
  const avgFulfillment = avg(recent, 'fulfillmentRate');
  if (
    inventoryPurchases > 0 ||
    recent.some((row) => row.stockoutConstrained)
  ) {
    explanations.push(
      `Inventory purchases used ${money(
        inventoryPurchases
      )} of cash while average on-hand stock was ${avgInventory.toFixed(
        0
      )} units. Fulfillment averaged ${pct(
        avgFulfillment
      )}; buying too late creates stockouts, while buying too early ties up cash.`
    );
  }

  const avgDefectRate = avg(recent, 'operationsDefectRate');
  if (avgDefectRate > 0.035) {
    explanations.push(
      `Operational defect rate averaged ${pct(
        avgDefectRate
      )}. Quality control, process choice, outsourcing, and operations staffing affect customer satisfaction as well as cost.`
    );
  }

  const competitorPressure = avg(
    recent,
    'competitorPressure'
  );
  if (competitorPressure > 0.12) {
    explanations.push(
      `Competitive pressure averaged ${pct(
        competitorPressure
      )}; rival pricing, quality, reputation, and promotion reduced accessible demand and pushed acquisition costs higher.`
    );
  }

  const clientContractRevenue = sum(
    recent,
    'clientContractRevenue'
  );
  const landlordSavings = sum(recent, 'landlordSavings');
  const negotiationExpenses = sum(
    recent,
    'negotiationOneTimeExpenses'
  );
  const supplierRows = recent.filter(
    (row) => row.supplierContractActive
  );
  const negotiatedUnitCost = avg(
    supplierRows,
    'negotiatedUnitCost'
  );

  if (clientContractRevenue > 0) {
    explanations.push(
      `Negotiated client work contributed ${money(
        clientContractRevenue
      )} of revenue this period, with delivery costs included in variable costs.`
    );
  }
  if (landlordSavings > 0) {
    explanations.push(
      `Lease negotiation reduced fixed costs by ${money(
        landlordSavings
      )} over this report period.`
    );
  }
  if (
    supplierRows.length > 0 &&
    negotiatedUnitCost > 0
  ) {
    explanations.push(
      `Supplier terms fed into inventory purchases at an effective unit-cost signal of about ${money(
        negotiatedUnitCost
      )}, linking negotiation to working capital and gross margin.`
    );
  }
  if (negotiationExpenses > 0) {
    explanations.push(
      `Negotiation preparation cost ${money(
        negotiationExpenses
      )} this period. Better information can improve deal quality, but preparation is still a real expense.`
    );
  }

  const payroll = sum(recent, 'payrollCosts');
  if (payroll > 0) {
    explanations.push(
      `Payroll cost ${money(
        payroll
      )} over four weeks. Average headcount was ${avg(
        recent,
        'headcount'
      ).toFixed(
        1
      )} and team productivity averaged ${pct(
        avg(recent, 'teamProductivity')
      )}.`
    );
  }

  if (avg(recent, 'teamBurnout') > 0.55) {
    explanations.push(
      `Average burnout reached ${pct(
        avg(recent, 'teamBurnout')
      )}, increasing retention risk and weakening morale/productivity.`
    );
  }

  if (currentProfit < 0) {
    explanations.push(
      `The business lost ${money(
        Math.abs(currentProfit)
      )} this report period because gross profit did not cover the full operating cost base.`
    );
  } else {
    explanations.push(
      `The business earned ${money(
        currentProfit
      )} after tax accrual this report period; operating volume and margins covered the current cost base.`
    );
  }

  return {
    week: state.week,
    revenue: currentRevenue,
    netProfit: currentProfit,
    endingCash: state.finance.cash,
    averageOrders: avg(recent, 'orders'),
    averageCAC: avg(recent, 'effectiveCAC'),
    averageSatisfaction: avg(
      recent,
      'satisfaction'
    ),
    payroll,
    averageHeadcount: avg(recent, 'headcount'),
    averageTeamProductivity: avg(
      recent,
      'teamProductivity'
    ),
    marketingSpend,
    paidAcquired,
    averageMarketingROAS: avgMarketingROAS,
    salesRevenue,
    salesWins,
    pipelineValue,
    inventoryPurchases,
    averageInventory: avgInventory,
    averageFulfillment: avgFulfillment,
    averageDefectRate: avgDefectRate,
    competitorPressure,
    clientContractRevenue,
    landlordSavings,
    negotiationExpenses,
    negotiatedUnitCost,
    explanations: explanations.slice(
      0,
      rCfg.maxExplanations
    )
  };
}
