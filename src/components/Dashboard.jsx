import React from 'react';
import MiniChart from './MiniChart.jsx';
import MonthlyReport from './MonthlyReport.jsx';
import { goalProgress } from '../engine/simulator.js';

const money = (n) => `$${Math.round(n).toLocaleString()}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

export default function Dashboard({ state, config, industry, onAdvance, onReset }) {
  const progress = goalProgress(state);
  const latestReport = state.reports.at(-1);
  const goalIsPct = state.goal === 'marketShare';
  const [decisionDraft, setDecisionDraft] = React.useState(state.decisions);
  React.useEffect(() => setDecisionDraft(state.decisions), [state.week]);
  const setDecision = (key, value) => setDecisionDraft((d) => ({ ...d, [key]: Number(value) }));
  const runway = Number.isFinite(state.finance.runwayWeeks) ? `${state.finance.runwayWeeks.toFixed(1)} w` : 'Profitable';

  return <div className="app-shell">
    <header className="topbar"><div><div className="eyebrow">{industry.name} · {config.modes[state.mode].label}</div><h1>Week {state.week} / {state.maxWeeks}</h1></div><button className="secondary" onClick={onReset}>New run</button></header>

    {state.status !== 'running' && <section className={`status-banner ${state.status}`}><strong>{state.status === 'won' ? 'Goal reached' : state.status === 'lost' ? 'Company failed' : 'Run complete'}</strong><span>{state.resultReason}</span></section>}

    <section className="kpi-grid">
      <div className="kpi"><span>Cash</span><b>{money(state.finance.cash)}</b><small>Runway {runway}</small></div>
      <div className="kpi"><span>Weekly revenue</span><b>{money(state.finance.revenue)}</b><small>Gross margin {pct(state.finance.grossMargin)}</small></div>
      <div className="kpi"><span>Weekly net profit</span><b>{money(state.finance.netProfit)}</b><small>Cumulative {money(state.finance.cumulativeProfit)}</small></div>
      <div className="kpi"><span>Customers</span><b>{state.customers.active.toFixed(0)}</b><small>Satisfaction {pct(state.customers.satisfaction)}</small></div>
      <div className="kpi"><span>Market share</span><b>{pct(state.customers.marketShare)}</b><small>Orders {state.customers.orders.toFixed(0)}</small></div>
      <div className="kpi"><span>Valuation</span><b>{money(state.finance.valuation)}</b><small>CAC {money(state.customers.effectiveCAC)} · LTV {money(state.customers.estimatedLtv)}</small></div>
    </section>

    <section className="panel goal-panel"><div><div className="eyebrow">Goal</div><strong>{config.goals[state.goal].label}</strong><div className="progress"><i style={{ width: `${progress.ratio * 100}%` }} /></div><small>{goalIsPct ? pct(progress.value) : state.goal === 'customers' ? progress.value.toFixed(0) : money(progress.value)} / {goalIsPct ? pct(progress.target) : state.goal === 'customers' ? progress.target.toFixed(0) : money(progress.target)}</small></div><div className="plan-score">Plan score <b>{state.planScore}/100</b></div></section>

    <section className="content-grid">
      <section className="panel controls">
        <div className="section-head"><div><h2>Weekly decisions</h2><p>These decisions feed the engine; the UI contains no simulation rules.</p></div></div>
        <label>Average selling price <b>${decisionDraft.price.toFixed(2)}</b><input type="range" min={config.decisions.price.min} max={config.decisions.price.max} step={config.decisions.price.step} value={decisionDraft.price} onChange={(e) => setDecision('price', e.target.value)} /></label>
        <label>Marketing spend <b>{money(decisionDraft.marketingSpend)}</b><input type="range" min={config.decisions.marketingSpend.min} max={config.decisions.marketingSpend.max} step={config.decisions.marketingSpend.step} value={decisionDraft.marketingSpend} onChange={(e) => setDecision('marketingSpend', e.target.value)} /></label>
        <label>Quality/service spend <b>{money(decisionDraft.qualitySpend)}</b><input type="range" min={config.decisions.qualitySpend.min} max={config.decisions.qualitySpend.max} step={config.decisions.qualitySpend.step} value={decisionDraft.qualitySpend} onChange={(e) => setDecision('qualitySpend', e.target.value)} /></label>
        <button className="primary" disabled={state.status !== 'running'} onClick={() => onAdvance(decisionDraft)}>Advance one week</button>
        <div className="hidden-info"><b>What you can observe:</b> demand itself is hidden. Use orders, CAC, satisfaction, share, seasonality effects, and monthly explanations to infer it.</div>
      </section>
      <section className="panel">
        <h2>Market signals</h2>
        <div className="signal-list"><span>Awareness <b>{pct(state.customers.awareness)}</b></span><span>Churn <b>{pct(state.customers.churnRate)}</b></span><span>Lost orders <b>{state.history.at(-1)?.lostOrders?.toFixed(0) || 0}</b></span><span>Economy <b>{state.market.economicIndex > config.market.signalStrongThreshold ? 'Strong' : state.market.economicIndex < config.market.signalWeakThreshold ? 'Weak' : 'Stable'}</b></span><span>Trend <b>{state.market.trendIndex > config.market.signalStrongThreshold ? 'Favorable' : state.market.trendIndex < config.market.signalWeakThreshold ? 'Unfavorable' : 'Flat'}</b></span></div>
        <div className="industry-notes"><h3>Typical failure modes</h3><ul>{industry.typicalFailureModes.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </section>
    </section>

    <section className="charts-grid"><MiniChart label="Cash" values={state.history.map((x) => x.cash)} /><MiniChart label="Weekly revenue" values={state.history.map((x) => x.revenue)} /><MiniChart label="Active customers" values={state.history.map((x) => x.activeCustomers)} /></section>
    <MonthlyReport report={latestReport} />
  </div>;
}
