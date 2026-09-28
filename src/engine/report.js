const pct = (n) => `${(n * 100).toFixed(1)}%`;
const money = (n) => `$${Math.round(n).toLocaleString()}`;

export function createMonthlyReport(state, config) {
  const period = config.turn.reportEveryWeeks;
  const recent = state.history.slice(-period);
  if (!recent.length) return null;
  const previous = state.history.slice(-(period * 2), -period);
  const rCfg = config.reports;

  const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
  const avg = (rows, key) => rows.length ? sum(rows, key) / rows.length : 0;
  const currentRevenue = sum(recent, 'revenue');
  const currentProfit = sum(recent, 'netProfit');
  const previousRevenue = sum(previous, 'revenue');
  const explanations = [];

  if (previous.length) {
    const revenueDelta = previousRevenue ? (currentRevenue - previousRevenue) / previousRevenue : 0;
    if (Math.abs(revenueDelta) > rCfg.revenueChangeExplainThreshold) {
      explanations.push(`Revenue ${revenueDelta > 0 ? 'rose' : 'fell'} ${pct(Math.abs(revenueDelta))}, mainly because weekly orders moved from ${avg(previous, 'orders').toFixed(0)} to ${avg(recent, 'orders').toFixed(0)}.`);
    }
  }

  const first = recent[0];
  const last = recent[recent.length - 1];
  const awarenessDelta = last.awareness - first.awareness;
  if (Math.abs(awarenessDelta) > rCfg.awarenessChangeExplainThreshold) explanations.push(`Awareness ${awarenessDelta > 0 ? 'improved' : 'declined'} from ${pct(first.awareness)} to ${pct(last.awareness)}, changing organic customer acquisition.`);
  const satisfactionDelta = last.satisfaction - first.satisfaction;
  if (Math.abs(satisfactionDelta) > rCfg.satisfactionChangeExplainThreshold) explanations.push(`Customer satisfaction ${satisfactionDelta > 0 ? 'improved' : 'weakened'} from ${pct(first.satisfaction)} to ${pct(last.satisfaction)}, affecting churn, referrals, and ad efficiency.`);
  if (avg(recent, 'lostOrders') > rCfg.lostOrdersExplainThreshold) explanations.push(`Capacity constraints caused about ${avg(recent, 'lostOrders').toFixed(0)} lost orders per week, so some demand could not become revenue.`);
  if (avg(recent, 'grossMargin') < rCfg.lowGrossMarginThreshold) explanations.push(`Gross margin averaged ${pct(avg(recent, 'grossMargin'))}; price versus variable cost is limiting how much each sale contributes to fixed costs.`);

  const payroll = sum(recent, 'payrollCosts');
  if (payroll > 0) {
    const headcount = avg(recent, 'headcount');
    const productivity = avg(recent, 'teamProductivity');
    explanations.push(`Payroll cost ${money(payroll)} over four weeks. Average headcount was ${headcount.toFixed(1)} and team productivity averaged ${pct(productivity)}; new hires ramp gradually rather than paying back immediately.`);
  }

  if (avg(recent, 'teamBurnout') > 0.55) {
    explanations.push(`Average burnout reached ${pct(avg(recent, 'teamBurnout'))}, increasing retention risk and weakening morale/productivity.`);
  }

  if (currentProfit < 0) explanations.push(`The business lost ${money(Math.abs(currentProfit))} this report period because gross profit did not cover fixed, marketing, quality, payroll, HR, and tax costs.`);
  else explanations.push(`The business earned ${money(currentProfit)} after tax accrual this report period; operating volume and margins covered the current cost base.`);

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
    explanations: explanations.slice(0, rCfg.maxExplanations)
  };
}
