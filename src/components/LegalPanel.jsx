import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

export default function LegalPanel({ state, data, onAction }) {
  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 5 · Legal & compliance</div>
        <h2>Licenses, policies and legal exposure</h2>
        <p>Missing required compliance can create fines and temporary shutdowns. Processing takes time, so waiting until a deadline is risky.</p>
      </div>
    </div>

    <div className="team-summary">
      <span>Compliance score <b>{pct(state.legal.complianceScore)}</b></span>
      <span>Legal risk <b>{pct(state.legal.legalRisk)}</b></span>
      <span>Shutdown <b>{state.legal.shutdownWeeks > 0 ? state.legal.shutdownWeeks + ' wk' : 'No'}</b></span>
      <span>HR legal risk <b>{pct(state.hr.legalRisk)}</b></span>
    </div>

    <div className="candidate-grid">
      {Object.entries(data.items).map(([itemId, item]) => {
        const current = state.legal.items[itemId];
        return <article className="candidate-card" key={itemId}>
          <div className="candidate-head">
            <div><strong>{item.label}</strong><span>{item.required ? 'Required' : 'Optional protection'}</span></div>
            <span className="risk-pill">{current.status}</span>
          </div>
          <div className="candidate-stats">
            <span>Cost <b>{money(item.cost)}</b></span>
            <span>Processing <b>{item.processingWeeks} wk</b></span>
            {item.required && <span>Due trigger <b>{item.trigger === 'employees' ? 'After first hire' : 'Week ' + item.dueWeek}</b></span>}
            {item.fine > 0 && <span>Base fine <b>{money(item.fine)}</b></span>}
          </div>
          {current.status === 'processing' && <div className="insight-box"><span>{current.processingWeeks} week(s) remaining.</span></div>}
          {current.status === 'active' && <div className="insight-box"><span>Active until approximately week {current.activeUntilWeek}.</span></div>}
          {['missing', 'expired'].includes(current.status) && <button className="primary" onClick={() => onAction({ type: 'startCompliance', itemId })}>Start / renew</button>}
        </article>;
      })}
    </div>
  </section>;
}
