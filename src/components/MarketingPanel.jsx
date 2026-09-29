import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();

export default function MarketingPanel({ state, marketingData, onAction }) {
  const totalWeight = Object.values(state.marketing.channelWeights).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 4 · Marketing</div>
        <h2>Channel portfolio</h2>
        <p>Your Dashboard controls the total weekly marketing budget. Here you decide how that money is allocated; channels differ in CAC, saturation, awareness, volatility and long-term compounding.</p>
      </div>
      <div className="round-pill">{money(state.decisions.marketingSpend)}/week</div>
    </div>

    <div className="commercial-summary">
      <span>Last paid customers <b>{state.marketing.last.totalAcquired.toFixed(1)}</b></span>
      <span>Blended CAC <b>{state.marketing.last.totalAcquired > 0 ? money(state.marketing.last.effectiveCAC) : '—'}</b></span>
      <span>Est. contribution ROAS <b>{state.marketing.last.estimatedROAS.toFixed(2)}x</b></span>
      <span>B2B leads assisted <b>{state.marketing.last.b2bLeads.toFixed(1)}</b></span>
    </div>

    <div className="channel-grid">
      {Object.entries(marketingData.channels).map(([id, channel]) => {
        const last = state.marketing.last.channels[id];
        const rawWeight = state.marketing.channelWeights[id] || 0;
        const share = totalWeight > 0 ? rawWeight / totalWeight : 0;
        return <article className="channel-card" key={id}>
          <div className="channel-title">
            <div><strong>{channel.label}</strong><span>{channel.description}</span></div>
            <b>{Math.round(share * 100)}%</b>
          </div>

          <label>Allocation weight <b>{rawWeight}</b>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={rawWeight}
              onChange={(e) => onAction({ type: 'setChannelWeight', channelId: id, weight: Number(e.target.value) })}
            />
          </label>

          <div className="channel-metrics">
            <span>Spend <b>{last ? money(last.budget) : money(state.decisions.marketingSpend * share)}</b></span>
            <span>CAC <b>{last && last.acquired > 0 ? money(last.effectiveCAC) : '—'}</b></span>
            <span>Customers <b>{last ? last.acquired.toFixed(1) : '—'}</b></span>
            <span>Channel strength <b>{(state.marketing.channelStrengths[id] || 1).toFixed(2)}x</b></span>
          </div>
        </article>;
      })}
    </div>

    <div className="phase-note">
      <b>Business lesson:</b> optimizing marketing means comparing incremental CAC and customer value, not simply putting all money into the channel with the lowest historical CAC. Saturation and competitor bidding make marginal returns worsen.
    </div>
  </section>;
}
