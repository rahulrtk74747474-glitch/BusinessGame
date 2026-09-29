import React from 'react';
import { competitorPublicView } from '../engine/competitors.js';

const money = (n) => '$' + Number(n || 0).toFixed(2);
const pct = (n) => Math.round((n || 0) * 100) + '%';

export default function CompetitorsPanel({ state, competitorData }) {
  const rivals = competitorPublicView(state, competitorData);

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 4 · Competitive market</div>
        <h2>Rival intelligence</h2>
        <p>Competitors react every week. You see market observations, not their exact internal thresholds. Their pricing, quality, reputation and advertising affect both accessible demand and your acquisition costs.</p>
      </div>
      <div className="round-pill">Pressure {pct(state.competitors.last.pressureIndex)}</div>
    </div>

    <div className="competitor-grid">
      {rivals.map((rival) => <article className="competitor-card" key={rival.id}>
        <strong>{rival.name}</strong>
        <p>{rival.description}</p>
        <div className="channel-metrics">
          <span>Observed price <b>{money(rival.observedPrice)}</b></span>
          <span>Quality <b>{rival.qualitySignal}</b></span>
          <span>Marketing <b>{rival.marketingSignal}</b></span>
          <span>Reputation <b>{rival.reputationSignal}</b></span>
        </div>
        <div className="competitor-action">{rival.lastAction}</div>
      </article>)}
    </div>

    <div className="commercial-summary">
      <span>Demand modifier <b>{state.competitors.last.demandModifier.toFixed(2)}x</b></span>
      <span>Marketing CAC pressure <b>{state.competitors.last.cacMultiplier.toFixed(2)}x</b></span>
      <span>Average rival strength <b>{state.competitors.last.averageStrength.toFixed(2)}x</b></span>
    </div>

    <div className="phase-note">
      <b>Business lesson:</b> competitor reactions make strategy endogenous. Cutting price may win demand initially but can trigger a price cutter; increasing quality can push a premium rival to defend its position.
    </div>
  </section>;
}
