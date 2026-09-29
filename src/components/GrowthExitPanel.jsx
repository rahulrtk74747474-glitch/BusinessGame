import React from 'react';
import { expansionEligibility } from '../engine/expansion.js';
import { exitReadiness } from '../engine/exit.js';
import { founderOwnership } from '../engine/logging.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

export default function GrowthExitPanel({ state, expansionData, exitData, onExpansionAction, onExitAction }) {
  const readiness = exitReadiness(state, exitData);

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 5 · Expansion & exit</div>
        <h2>Scale systems before you scale complexity</h2>
        <p>Expansion consumes cash before benefits appear. Exit value improves when the company is compliant, low-risk and can operate without the founder.</p>
      </div>
    </div>

    <h3>Expansion projects</h3>
    <div className="candidate-grid">
      {Object.entries(expansionData.projects).map(([projectId, project]) => {
        const eligibility = expansionEligibility(state, projectId, expansionData);
        const active = state.expansion.projects.find((p) => p.projectId === projectId);
        const complete = state.expansion.completed.includes(projectId);

        return <article className="candidate-card" key={projectId}>
          <div className="candidate-head"><strong>{project.label}</strong><span className="risk-pill">{complete ? 'complete' : active ? 'building' : eligibility.eligible ? 'ready' : 'locked'}</span></div>
          <div className="candidate-stats">
            <span>Upfront investment <b>{money(project.upfrontCost)}</b></span>
            <span>Build time <b>{project.buildWeeks} wk</b></span>
            <span>Weekly fixed cost <b>{money(project.weeklyFixedCost)}</b></span>
            <span>Demand effect <b>{pct(project.marketDemandMultiplier - 1)}</b></span>
          </div>
          {active && <div className="insight-box"><span>{active.remainingWeeks} week(s) until operational.</span></div>}
          {!eligibility.eligible && !active && !complete && <div className="insight-box">{eligibility.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>}
          <button className="primary" disabled={!eligibility.eligible || active || complete} onClick={() => onExpansionAction({ type: 'startExpansion', projectId })}>{complete ? 'Completed' : active ? 'In progress' : 'Start project'}</button>
        </article>;
      })}
    </div>

    <h3>Exit readiness</h3>
    <div className="team-summary">
      <span>Founder ownership <b>{pct(founderOwnership(state))}</b></span>
      <span>Succession score <b>{pct(state.exit.successionScore)}</b></span>
      <span>Trailing revenue / wk <b>{money(readiness.trailingRevenue)}</b></span>
      <span>Trailing profit / wk <b>{money(readiness.trailingProfit)}</b></span>
      <span>Readiness <b>{readiness.ready ? 'Ready' : 'Not ready'}</b></span>
    </div>

    <div className="signal-list">
      {Object.entries(readiness.criteria).map(([key, passed]) => <span key={key}>{key}<b>{passed ? '✓ ready' : '✕ missing'}</b></span>)}
    </div>

    <div className="candidate-actions">
      <button className="secondary" onClick={() => onExitAction({ type: 'prepareSuccession' })}>Improve succession · {money(exitData.successionPreparationCost)}</button>
      <button className="primary" disabled={!readiness.ready || Boolean(state.exit.review) || Boolean(state.exit.offer)} onClick={() => onExitAction({ type: 'requestExitReview' })}>Request broker sale review · {money(exitData.brokerReviewCost)}</button>
    </div>

    {state.exit.review && <div className="hidden-info">Broker review in progress: {state.exit.review.remainingWeeks} week(s) remaining.</div>}

    {state.exit.offer && <div className="subcard">
      <h3>Buyer offer</h3>
      <p>Sale price: <b>{money(state.exit.offer.salePrice)}</b> · Valid for {state.exit.offer.expiresIn} week(s).</p>
      <p>Estimated founder gross share before transaction fee: <b>{money(state.exit.offer.salePrice * founderOwnership(state))}</b></p>
      <div className="candidate-actions">
        <button className="primary" onClick={() => onExitAction({ type: 'acceptSaleOffer' })}>Accept and end run</button>
        <button className="secondary" onClick={() => onExitAction({ type: 'rejectSaleOffer' })}>Reject</button>
      </div>
    </div>}

    {state.exit.sold && <div className="status-banner won"><strong>Company sold</strong><span>Founder proceeds: {money(state.exit.founderProceeds)}</span></div>}
  </section>;
}
