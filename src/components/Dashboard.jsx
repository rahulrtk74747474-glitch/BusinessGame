import React from 'react';
import MiniChart from './MiniChart.jsx';
import MonthlyReport from './MonthlyReport.jsx';
import HiringPanel from './HiringPanel.jsx';
import TeamPanel from './TeamPanel.jsx';
import RippleMap from './RippleMap.jsx';
import NegotiationPanel from './NegotiationPanel.jsx';
import MarketingPanel from './MarketingPanel.jsx';
import SalesPanel from './SalesPanel.jsx';
import OperationsPanel from './OperationsPanel.jsx';
import CompetitorsPanel from './CompetitorsPanel.jsx';
import FundingPanel from './FundingPanel.jsx';
import LegalPanel from './LegalPanel.jsx';
import RiskPanel from './RiskPanel.jsx';
import GrowthExitPanel from './GrowthExitPanel.jsx';
import FinancialsPanel from './FinancialsPanel.jsx';
import FinancialLessonModal from './FinancialLessonModal.jsx';
import financialLessons from '../data/learning/financialLessons.json';
import { goalProgress } from '../engine/simulator.js';
import { founderOwnership } from '../engine/logging.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';
const formatPrice = (n, reference) => String.fromCharCode(36) + Number(n || 0).toFixed(reference < 5 ? 2 : 0);

export default function Dashboard({
  state,
  config,
  industry,
  rolesData,
  negotiationConfig,
  phase4Data,
  phase5Data,
  onAdvance,
  onHrAction,
  onNegotiationAction,
  onMarketingAction,
  onSalesAction,
  onOperationsAction,
  onFundingAction,
  onLegalAction,
  onRiskAction,
  onExpansionAction,
  onExitAction,
  onReset
}) {
  const progress = goalProgress(state);
  const latestReport = state.reports.at(-1);
  const goalIsPct = state.goal === 'marketShare';
  const [decisionDraft, setDecisionDraft] = React.useState(state.decisions);
  const [tab, setTab] = React.useState('dashboard');
  const [financialLessonWeek, setFinancialLessonWeek] = React.useState(null);
  React.useEffect(() => setDecisionDraft(state.decisions), [state.week]);
  React.useEffect(() => {
    if (state.week >= 1 && state.week <= 20) setFinancialLessonWeek(state.week);
  }, [state.week]);
  const setDecision = (key, value) => setDecisionDraft((d) => ({ ...d, [key]: Number(value) }));
  const runway = Number.isFinite(state.finance.runwayWeeks) ? state.finance.runwayWeeks.toFixed(1) + ' w' : 'Profitable';
  const priceMin = industry.priceDecisionMin ?? Math.max(0.01, industry.referencePrice * 0.45);
  const priceMax = industry.priceDecisionMax ?? industry.referencePrice * 2.2;
  const priceStep = industry.priceDecisionStep ?? (industry.referencePrice < 2 ? 0.01 : industry.referencePrice < 20 ? 0.25 : 1);
  const operationsMode = phase4Data.operations.inventoryMode || 'physical';

  return <div className="app-shell">
    <header className="topbar">
      <div><div className="eyebrow">{industry.name} - {config.modes[state.mode].label}</div><h1>Week {state.week} / {state.maxWeeks}</h1></div>
      <button className="secondary" onClick={onReset}>New run</button>
    </header>

    <nav className="game-tabs" aria-label="Game sections">
      <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
      <button className={tab === 'financials' ? 'active' : ''} onClick={() => setTab('financials')}>Financials <span>{state.week <= 20 ? state.week + '/20' : '✓'}</span></button>
      <button className={tab === 'hiring' ? 'active' : ''} onClick={() => setTab('hiring')}>Hiring <span>{state.hr.candidates.filter((c) => c.available).length}</span></button>
      <button className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}>Team <span>{state.hr.employees.length}</span></button>
      <button className={tab === 'negotiation' ? 'active' : ''} onClick={() => setTab('negotiation')}>Negotiate <span>{state.negotiation.history.length}</span></button>
      <button className={tab === 'marketing' ? 'active' : ''} onClick={() => setTab('marketing')}>Marketing</button>
      <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>Sales</button>
      <button className={tab === 'operations' ? 'active' : ''} onClick={() => setTab('operations')}>Operations</button>
      <button className={tab === 'competitors' ? 'active' : ''} onClick={() => setTab('competitors')}>Competitors</button>
      <button className={tab === 'funding' ? 'active' : ''} onClick={() => setTab('funding')}>Funding <span>{state.funding.termSheets.length}</span></button>
      <button className={tab === 'legal' ? 'active' : ''} onClick={() => setTab('legal')}>Legal</button>
      <button className={tab === 'risk' ? 'active' : ''} onClick={() => setTab('risk')}>Risk</button>
      <button className={tab === 'growth' ? 'active' : ''} onClick={() => setTab('growth')}>Growth / Exit</button>
    </nav>

    {state.status !== 'running' && <section className={'status-banner ' + state.status}><strong>{state.status === 'won' ? 'Goal reached' : state.status === 'lost' ? 'Company failed' : 'Run complete'}</strong><span>{state.resultReason}</span></section>}
    {state.status === 'running' && state.finance.cash <= 0 && <section className="status-banner finished"><strong>Liquidity distress</strong><span>{state.resultReason}</span></section>}

    {tab === 'financials' && <FinancialsPanel state={state} industry={industry} />}

    {tab === 'hiring' && <>
      <HiringPanel
        state={state}
        rolesData={rolesData}
        onHrAction={onHrAction}
        onStartNegotiation={(candidateId) => {
          onNegotiationAction({ type: 'start', counterpartyType: 'candidate', candidateId });
          setTab('negotiation');
        }}
      />
      <RippleMap ripple={state.hr.lastRipple} />
    </>}

    {tab === 'team' && <>
      <TeamPanel state={state} rolesData={rolesData} onHrAction={onHrAction} />
      <RippleMap ripple={state.hr.lastRipple} />
    </>}

    {tab === 'negotiation' && <>
      <NegotiationPanel state={state} negotiationConfig={negotiationConfig} onAction={onNegotiationAction} />
      <RippleMap ripple={state.negotiation.lastRipple} />
    </>}

    {tab === 'marketing' && <>
      <MarketingPanel state={state} marketingData={phase4Data.marketing} onAction={onMarketingAction} />
      <RippleMap ripple={state.marketing.lastRipple} />
    </>}

    {tab === 'sales' && <>
      <SalesPanel state={state} salesData={phase4Data.sales} onAction={onSalesAction} />
      <RippleMap ripple={state.sales.lastRipple} />
    </>}

    {tab === 'operations' && <>
      <OperationsPanel state={state} industry={industry} operationsData={phase4Data.operations} onAction={onOperationsAction} />
      <RippleMap ripple={state.operations.lastRipple} />
    </>}

    {tab === 'competitors' && <CompetitorsPanel state={state} competitorData={phase4Data.competitors} />}

    {tab === 'funding' && <>
      <FundingPanel state={state} data={phase5Data.funding} onAction={onFundingAction} />
      <RippleMap ripple={state.funding.lastRipple} />
    </>}

    {tab === 'legal' && <>
      <LegalPanel state={state} data={phase5Data.legal} onAction={onLegalAction} />
      <RippleMap ripple={state.legal.lastRipple} />
    </>}

    {tab === 'risk' && <>
      <RiskPanel state={state} data={phase5Data.risk} onAction={onRiskAction} />
      <RippleMap ripple={state.risk.lastRipple} />
    </>}

    {tab === 'growth' && <>
      <GrowthExitPanel
        state={state}
        expansionData={phase5Data.expansion}
        exitData={phase5Data.exit}
        onExpansionAction={onExpansionAction}
        onExitAction={onExitAction}
      />
      <RippleMap ripple={state.exit.lastRipple || state.expansion.lastRipple} />
    </>}

    {tab === 'dashboard' && <>
      <section className="kpi-grid">
        <div className="kpi"><span>Cash</span><b>{money(state.finance.cash)}</b><small>Total liquidity {money(state.finance.totalLiquidity)}</small></div>
        <div className="kpi"><span>Weekly revenue</span><b>{money(state.finance.revenue)}</b><small>Gross margin {pct(state.finance.grossMargin)}</small></div>
        <div className="kpi"><span>Weekly net profit</span><b>{money(state.finance.netProfit)}</b><small>Cumulative {money(state.finance.cumulativeProfit)}</small></div>
        <div className="kpi"><span>Customers</span><b>{state.customers.active.toFixed(0)}</b><small>Satisfaction {pct(state.customers.satisfaction)}</small></div>
        <div className="kpi"><span>Market share</span><b>{pct(state.customers.marketShare)}</b><small>Orders {state.customers.orders.toFixed(0)}</small></div>
        <div className="kpi"><span>Valuation</span><b>{money(state.finance.valuation)}</b><small>Founder owns {pct(founderOwnership(state))}</small></div>
        <div className="kpi"><span>Team</span><b>{state.hr.employees.length}</b><small>Payroll {money(state.finance.payrollCosts || 0)}/wk</small></div>
        <div className="kpi"><span>Team morale</span><b>{state.hr.employees.length ? pct(state.hr.averageMorale) : '-'}</b><small>Burnout {state.hr.employees.length ? pct(state.hr.averageBurnout) : '-'}</small></div>
        <div className="kpi"><span>{operationsMode === 'virtual' ? 'Delivery capacity' : (industry.inventoryLabel || 'Inventory')}</span><b>{operationsMode === 'virtual' ? state.operations.last.capacity.toFixed(0) : state.operations.inventoryUnits.toFixed(0)}</b><small>{operationsMode === 'virtual' ? (industry.unitLabel || 'units') + '/week' : 'Asset ' + money(state.finance.inventoryAsset || 0)}</small></div>
        <div className="kpi"><span>B2B sales</span><b>{money(state.finance.salesRevenue || 0)}</b><small>Pipeline {money(state.sales.last.pipelineValue || 0)}</small></div>
        <div className="kpi"><span>Debt</span><b>{money(state.finance.debtBalance)}</b><small>Service {money(state.finance.debtService)}/wk</small></div>
        <div className="kpi"><span>Compliance</span><b>{pct(state.legal.complianceScore)}</b><small>Risk {pct(state.risk.last.riskScore)}</small></div>
      </section>

      <section className="panel goal-panel">
        <div><div className="eyebrow">Goal</div><strong>{config.goals[state.goal].label}</strong><div className="progress"><i style={{ width: (progress.ratio * 100) + '%' }} /></div><small>{goalIsPct ? pct(progress.value) : state.goal === 'customers' ? progress.value.toFixed(0) : money(progress.value)} / {goalIsPct ? pct(progress.target) : state.goal === 'customers' ? progress.target.toFixed(0) : money(progress.target)}</small></div>
        <div className="plan-score">Plan score <b>{state.planScore}/100</b></div>
      </section>

      <section className="content-grid">
        <section className="panel controls">
          <div className="section-head"><div><h2>Weekly decisions</h2><p>Pricing, growth, quality, people, compliance and capital structure now interact in the same weekly model.</p></div></div>
          <label>Average selling price <b>{formatPrice(decisionDraft.price, industry.referencePrice)}</b><input type="range" min={priceMin} max={priceMax} step={priceStep} value={decisionDraft.price} onChange={(e) => setDecision('price', e.target.value)} /></label>
          <label>Marketing spend <b>{money(decisionDraft.marketingSpend)}</b><input type="range" min={config.decisions.marketingSpend.min} max={config.decisions.marketingSpend.max} step={config.decisions.marketingSpend.step} value={decisionDraft.marketingSpend} onChange={(e) => setDecision('marketingSpend', e.target.value)} /></label>
          <label>Quality/service spend <b>{money(decisionDraft.qualitySpend)}</b><input type="range" min={config.decisions.qualitySpend.min} max={config.decisions.qualitySpend.max} step={config.decisions.qualitySpend.step} value={decisionDraft.qualitySpend} onChange={(e) => setDecision('qualitySpend', e.target.value)} /></label>
          <button className="primary" disabled={state.status !== 'running'} onClick={() => onAdvance(decisionDraft)}>Advance one week</button>
          <div className="hidden-info"><b>What you can observe:</b> the game logs every player action and the visible information available at that moment. Hidden traits and market variables remain hidden until their systems reveal them.</div>
        </section>

        <section className="panel">
          <h2>Company signals</h2>
          <div className="signal-list">
            <span>Awareness <b>{pct(state.customers.awareness)}</b></span>
            <span>Churn <b>{pct(state.customers.churnRate)}</b></span>
            <span>Lost orders <b>{state.history.at(-1)?.lostOrders?.toFixed(0) || 0}</b></span>
            <span>Capacity <b>{state.customers.capacity?.toFixed(0) || industry.capacityOrdersPerWeek} {industry.unitLabel || 'units'}/wk</b></span>
            <span>Economy <b>{state.market.economicIndex > config.market.signalStrongThreshold ? 'Strong' : state.market.economicIndex < config.market.signalWeakThreshold ? 'Weak' : 'Stable'}</b></span>
            <span>Trend <b>{state.market.trendIndex > config.market.signalStrongThreshold ? 'Favorable' : state.market.trendIndex < config.market.signalWeakThreshold ? 'Unfavorable' : 'Flat'}</b></span>
            <span>Manager quality <b>{pct(state.hr.managerQuality)}</b></span>
            <span>Client contract <b>{money(state.finance.clientRevenue || 0)}/wk</b></span>
            <span>Fulfillment <b>{pct(state.operations.last.fulfillmentRate)}</b></span>
            <span>Competitor pressure <b>{pct(state.competitors.last.pressureIndex)}</b></span>
            <span>Marketing ROAS <b>{state.marketing.last.estimatedROAS.toFixed(2)}x</b></span>
            <span>Emergency reserve <b>{money(state.risk.reserveCash)}</b></span>
            <span>Legal shutdown <b>{state.legal.shutdownWeeks > 0 ? state.legal.shutdownWeeks + ' wk' : 'No'}</b></span>
            <span>Expansion projects <b>{state.expansion.projects.length} active / {state.expansion.completed.length} complete</b></span>
          </div>
          <div className="industry-notes"><h3>Typical failure modes</h3><ul>{industry.typicalFailureModes.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </section>
      </section>

      <RippleMap ripple={state.exit.lastRipple || state.expansion.lastRipple || state.risk.lastRipple || state.legal.lastRipple || state.funding.lastRipple || state.operations.lastRipple || state.sales.lastRipple || state.marketing.lastRipple || state.negotiation.lastRipple || state.hr.lastRipple} />

      <section className="charts-grid">
        <MiniChart label="Cash" values={state.history.map((x) => x.cash)} />
        <MiniChart label="Weekly revenue" values={state.history.map((x) => x.revenue)} />
        <MiniChart label="Active customers" values={state.history.map((x) => x.activeCustomers)} />
      </section>
      <MonthlyReport report={latestReport} />
    </>}

    {financialLessonWeek === state.week && state.week >= 1 && state.week <= 20 && <FinancialLessonModal
      state={state}
      industry={industry}
      lessons={financialLessons}
      onClose={() => setFinancialLessonWeek(null)}
      onOpenFinancials={() => {
        setFinancialLessonWeek(null);
        setTab('financials');
      }}
    />}
  </div>;
}
