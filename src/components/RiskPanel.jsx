import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

export default function RiskPanel({ state, data, onAction }) {
  const [reserveAmount, setReserveAmount] = React.useState(1000);

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 5 · Risk management</div>
        <h2>Insurance, controls and emergency liquidity</h2>
        <p>Risk management costs money before anything goes wrong; its value appears when it reduces severity, improves financing access, or prevents failure.</p>
      </div>
    </div>

    <div className="team-summary">
      <span>Risk score <b>{pct(state.risk.last.riskScore)}</b></span>
      <span>Reserve cash <b>{money(state.risk.reserveCash)}</b></span>
      <span>Premiums / week <b>{money(state.risk.last.weeklyPremiums)}</b></span>
      <span>Control reduction <b>{pct(state.risk.last.controlReduction)}</b></span>
      <span>Legal mitigation <b>{pct(state.risk.last.legalMitigation)}</b></span>
    </div>

    <div className="funding-actions">
      <div className="subcard">
        <h3>Emergency reserve</h3>
        <label>Amount<input type="number" value={reserveAmount} onChange={(e) => setReserveAmount(Number(e.target.value))} /></label>
        <div className="candidate-actions">
          <button className="primary" onClick={() => onAction({ type: 'moveToReserve', amount: reserveAmount })}>Move to reserve</button>
          <button className="secondary" onClick={() => onAction({ type: 'releaseReserve', amount: reserveAmount })}>Release reserve</button>
        </div>
      </div>
    </div>

    <h3>Insurance</h3>
    <div className="candidate-grid">
      {Object.entries(data.policies).map(([policyId, policy]) => {
        const active = state.risk.activePolicies.includes(policyId);
        return <article className="candidate-card" key={policyId}>
          <div className="candidate-head"><strong>{policy.label}</strong><span className="risk-pill">{active ? 'active' : 'not covered'}</span></div>
          <div className="candidate-stats">
            <span>Setup fee <b>{money(policy.setupFee)}</b></span>
            <span>Weekly premium <b>{money(policy.weeklyPremium)}</b></span>
            <span>Legal mitigation <b>{pct(policy.legalMitigation)}</b></span>
            <span>Property mitigation <b>{pct(policy.propertyMitigation)}</b></span>
          </div>
          <button className={active ? 'secondary' : 'primary'} onClick={() => onAction({ type: active ? 'cancelPolicy' : 'buyPolicy', policyId })}>{active ? 'Cancel policy' : 'Buy policy'}</button>
        </article>;
      })}
    </div>

    <h3>Preventive controls</h3>
    <div className="candidate-grid">
      {Object.entries(data.controls).map(([controlId, control]) => {
        const active = state.risk.controls.includes(controlId);
        return <article className="candidate-card" key={controlId}>
          <strong>{control.label}</strong>
          <div className="candidate-stats"><span>Cost <b>{money(control.cost)}</b></span><span>Risk reduction <b>{pct(control.riskReduction)}</b></span></div>
          <button className="primary" disabled={active} onClick={() => onAction({ type: 'implementControl', controlId })}>{active ? 'Implemented' : 'Implement'}</button>
        </article>;
      })}
    </div>
  </section>;
}
