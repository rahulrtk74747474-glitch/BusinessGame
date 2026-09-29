import React from 'react';
import { negotiationPublicView } from '../engine/negotiation.js';

const money = (n) => '$' + Math.round(n).toLocaleString();

function displayValue(value, unit) {
  if (value == null) return '—';
  if (unit === 'valuation') return money(value) + ' valuation';
  if (unit === '$/week') return money(value) + '/week';
  if (unit === '$/order') return '$' + Number(value).toFixed(2) + '/order';
  return String(value);
}

function scenarioStatus(state, type) {
  const c = state.negotiation.contracts;
  if (type === 'supplier' && c.supplierRemainingWeeks > 0) {
    return `Active: $${Number(c.supplierUnitCost).toFixed(2)}/order for ${c.supplierRemainingWeeks} more weeks`;
  }
  if (type === 'landlord' && c.landlordRemainingWeeks > 0) {
    return `Active: saving ${money(c.landlordWeeklySavings)}/week for ${c.landlordRemainingWeeks} more weeks`;
  }
  if (type === 'client' && c.clientRemainingWeeks > 0) {
    return `Active: ${money(c.clientWeeklyRevenue)}/week revenue for ${c.clientRemainingWeeks} more weeks`;
  }
  if (type === 'investor' && c.investorIndicativeValuation) {
    return `Indicative valuation: ${money(c.investorIndicativeValuation)}`;
  }
  return 'No active agreement';
}

export default function NegotiationPanel({ state, negotiationConfig, onAction }) {
  const view = negotiationPublicView(state, negotiationConfig);
  const [proposal, setProposal] = React.useState(view?.playerOffer || 0);

  React.useEffect(() => {
    if (view) setProposal(view.playerOffer);
  }, [view?.id, view?.round, view?.playerOffer]);

  const start = (type) => onAction({ type: 'start', counterpartyType: type });
  const tactic = (name) => onAction({ type: 'tactic', tactic: name, proposal: Number(proposal) });

  if (!view) {
    const scenarioTypes = ['supplier', 'landlord', 'client', 'investor'];
    return <section className="panel">
      <div className="section-head">
        <div>
          <div className="eyebrow">Phase 3 · Negotiation</div>
          <h2>Choose a counterparty</h2>
          <p>Every negotiation has hidden limits, mood and personality. Preparation and leverage matter, and the same tactic will not fit everyone.</p>
        </div>
      </div>

      <div className="negotiation-scenario-grid">
        {scenarioTypes.map((type) => {
          const template = negotiationConfig.templates[type];
          return <article className="scenario-card" key={type}>
            <strong>{template.label}</strong>
            <span>{template.lesson}</span>
            <small>{scenarioStatus(state, type)}</small>
            {type === 'investor' && <em>Phase 3 records only indicative terms. Funding, dilution and cash settlement unlock in Phase 5.</em>}
            <button className="primary" onClick={() => start(type)}>Start negotiation</button>
          </article>;
        })}
      </div>

      <div className="negotiation-history">
        <h3>Negotiation history</h3>
        {state.negotiation.history.length === 0
          ? <div className="empty-state">No completed negotiations yet.</div>
          : state.negotiation.history.slice(-8).reverse().map((row) =>
            <div className="history-row" key={row.id}>
              <span>{row.label}</span>
              <b>{row.status}</b>
              <span>{row.finalValue == null ? 'No deal' : displayValue(row.finalValue, negotiationConfig.templates[row.type].unit)}</span>
              <small>{row.rounds} rounds</small>
            </div>
          )}
      </div>
    </section>;
  }

  const active = view.status === 'active';
  return <section className="panel negotiation-panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 3 · Live negotiation</div>
        <h2>{view.label}</h2>
        <p>{view.lesson}</p>
      </div>
      <div className="round-pill">Round {view.round}/{view.maxRounds}</div>
    </div>

    <div className="negotiation-metrics">
      <span>Your current position <b>{displayValue(view.playerOffer, view.unit)}</b></span>
      <span>Their current position <b>{displayValue(view.counterOffer, view.unit)}</b></span>
      <span>Preparation <b>{Math.round(view.preparation * 100)}%</b></span>
      <span>Leverage <b>{view.leverageSignal}</b></span>
      <span>Relationship <b>{view.relationshipSignal}</b></span>
      <span>Visible tone <b>{view.counterpartyTone}</b></span>
    </div>

    {(view.revealed.personality || view.revealed.walkAwayBand || view.revealed.moodSignal || view.revealed.leverageSignal) &&
      <div className="intel-box">
        <strong>Information discovered</strong>
        {view.revealed.personality && <span>Likely personality: <b>{view.revealed.personality}</b></span>}
        {view.revealed.walkAwayBand && <span>Estimated walk-away zone: <b>{displayValue(view.revealed.walkAwayBand.low, view.unit)} – {displayValue(view.revealed.walkAwayBand.high, view.unit)}</b></span>}
        {view.revealed.moodSignal && <span>Deeper mood signal: <b>{view.revealed.moodSignal}</b></span>}
        {view.revealed.leverageSignal && <span>Your leverage estimate: <b>{view.revealed.leverageSignal}</b></span>}
      </div>}

    {active && <>
      <div className="preparation-bar">
        <div>
          <strong>Prepare before pushing terms</strong>
          <span>Research improves preparation and gradually reveals hidden information.</span>
        </div>
        <button
          className="secondary"
          disabled={view.researchActions >= view.researchLimit}
          onClick={() => onAction({ type: 'prepare' })}
        >
          Research dossier · {money(view.researchCost)}
        </button>
      </div>

      <label className="proposal-field">
        Proposed primary term
        <input
          type="number"
          step={view.unit === '$/order' ? '0.01' : '1'}
          min="0.01"
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
        />
        <small>
          {view.direction === 'lower'
            ? 'Lower is better for you; pushing too far below their hidden minimum can end the negotiation.'
            : 'Higher is better for you; pushing above their hidden maximum can end the negotiation.'}
        </small>
      </label>

      <div className="tactic-grid">
        <button onClick={() => tactic('anchor')}><b>Anchor aggressively</b><span>Push your proposed value strongly. Works better with some aggressive personalities.</span></button>
        <button onClick={() => tactic('split')}><b>Split the difference</b><span>Offer the midpoint between your position and theirs. Often relationship-friendly.</span></button>
        <button onClick={() => tactic('bundle')}><b>Bundle terms</b><span>{view.bundleLabel}. Adds non-price value but creates another commitment.</span></button>
        <button onClick={() => tactic('deadline')}><b>Set a deadline</b><span>Add pressure. Can improve acceptance or damage mood and relationship.</span></button>
        <button onClick={() => onAction({ type: 'tactic', tactic: 'ask_info' })}><b>Ask for more information</b><span>Use a round to learn more and improve preparation before changing terms.</span></button>
        <button className="walk-away" onClick={() => onAction({ type: 'tactic', tactic: 'walk_away' })}><b>Walk away</b><span>Protect yourself from a bad deal. No agreement is sometimes the correct business outcome.</span></button>
      </div>
    </>}

    {!active && <div className={'negotiation-outcome ' + view.status}>
      <strong>{view.status === 'accepted' ? 'Deal reached' : 'Negotiation ended'}</strong>
      <span>{view.outcome?.message}</span>
      <button className="primary" onClick={() => onAction({ type: 'close' })}>Close negotiation</button>
    </div>}

    <div className="transcript">
      <h3>Negotiation log</h3>
      {view.transcript.slice().reverse().map((entry, index) =>
        <div className={'transcript-row ' + entry.speaker} key={index}>
          <b>{entry.speaker === 'you' ? 'You' : entry.speaker === 'counterparty' ? view.label : 'Coach'}</b>
          <span>{entry.text}</span>
        </div>
      )}
    </div>
  </section>;
}
