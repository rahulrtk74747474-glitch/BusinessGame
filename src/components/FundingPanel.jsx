import React from 'react';
import { sourceEligibility, totalDebt } from '../engine/funding.js';
import { founderOwnership } from '../engine/logging.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

export default function FundingPanel({ state, data, onAction }) {
  const [founderAmount, setFounderAmount] = React.useState(5000);
  const [drafts, setDrafts] = React.useState({});

  const draft = (sourceId) => {
    const source = data.sources[sourceId];
    return drafts[sourceId] || {
      amount: source.minimumAmount,
      requestedValuation: Math.max(state.finance.valuation, 50000),
      pitchFocus: source.preferredPitch
    };
  };

  const updateDraft = (sourceId, key, value) => {
    setDrafts((current) => ({
      ...current,
      [sourceId]: {
        ...draft(sourceId),
        ...current[sourceId],
        [key]: key === 'pitchFocus' ? value : Number(value)
      }
    }));
  };

  const debt = totalDebt(state);

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 5 · Funding</div>
        <h2>Capital, debt and dilution</h2>
        <p>Financing extends runway, but debt creates fixed repayments and equity permanently changes ownership.</p>
      </div>
    </div>

    <div className="team-summary">
      <span>Operating cash <b>{money(state.finance.cash)}</b></span>
      <span>Emergency reserve <b>{money(state.risk.reserveCash)}</b></span>
      <span>Total debt <b>{money(debt)}</b></span>
      <span>Debt service / week <b>{money(state.finance.debtService)}</b></span>
      <span>Founder ownership <b>{pct(founderOwnership(state))}</b></span>
      <span>ESOP pool <b>{pct(state.funding.esopPool)}</b></span>
    </div>

    <div className="funding-actions">
      <div className="subcard">
        <h3>Bootstrap</h3>
        <p>Founder reserve remaining: <b>{money(state.funding.founderReserveRemaining)}</b></p>
        <label>Additional founder capital
          <input type="number" min="0" value={founderAmount} onChange={(e) => setFounderAmount(Number(e.target.value))} />
        </label>
        <button className="primary" onClick={() => onAction({ type: 'founderInjection', amount: founderAmount })}>Add founder capital</button>
      </div>

      <div className="subcard">
        <h3>ESOP pool</h3>
        <p>An option pool helps recruit talent but dilutes existing holders immediately.</p>
        <select value={state.funding.esopPool} onChange={(e) => onAction({ type: 'setEsopPool', target: Number(e.target.value) })}>
          {data.esopPoolOptions.map((value) => <option key={value} value={value}>{pct(value)}</option>)}
        </select>
      </div>
    </div>

    <h3>Funding sources</h3>
    <div className="candidate-grid">
      {Object.entries(data.sources).map(([sourceId, source]) => {
        const eligibility = sourceEligibility(state, sourceId, data);
        const d = draft(sourceId);
        return <article className="candidate-card" key={sourceId}>
          <div className="candidate-head">
            <div><strong>{source.label}</strong><span>{source.type}</span></div>
            <span className="risk-pill">{source.decisionWeeks} wk decision</span>
          </div>
          <div className="candidate-stats">
            <span>Application cost <b>{money(source.applicationCost)}</b></span>
            <span>Ask range <b>{money(source.minimumAmount)}–{money(source.maximumAmount)}</b></span>
            <span>Applications used <b>{state.funding.sourceUsage[sourceId] || 0}/{source.maximumApplications}</b></span>
            <span>Eligibility <b>{eligibility.eligible ? 'Eligible' : 'Not ready'}</b></span>
          </div>
          {!eligibility.eligible && <div className="insight-box">{eligibility.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>}
          <div className="offer-form">
            <label>Amount<input type="number" value={d.amount} onChange={(e) => updateDraft(sourceId, 'amount', e.target.value)} /></label>
            {source.type === 'equity' && <label>Requested valuation<input type="number" value={d.requestedValuation} onChange={(e) => updateDraft(sourceId, 'requestedValuation', e.target.value)} /></label>}
            <label>Pitch focus
              <select value={d.pitchFocus} onChange={(e) => updateDraft(sourceId, 'pitchFocus', e.target.value)}>
                {Object.entries(data.pitchFocus).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <button className="primary" disabled={!eligibility.eligible} onClick={() => onAction({ type: 'apply', sourceId, ...d })}>Submit application</button>
        </article>;
      })}
    </div>

    {state.funding.applications.length > 0 && <>
      <h3>Pending applications</h3>
      <div className="signal-list">
        {state.funding.applications.map((application) => <span key={application.id}>{data.sources[application.sourceId].label}<b>{application.weeksRemaining} week(s) remaining</b></span>)}
      </div>
    </>}

    {state.funding.termSheets.length > 0 && <>
      <h3>Term sheets</h3>
      <div className="candidate-grid">
        {state.funding.termSheets.map((term) => <article className="candidate-card" key={term.id}>
          <strong>{term.label}</strong>
          <div className="candidate-stats">
            <span>Capital <b>{money(term.amount)}</b></span>
            {term.type === 'debt' && <span>APR <b>{pct(term.apr)}</b></span>}
            {term.type === 'equity' && <span>Pre-money valuation <b>{money(term.preMoneyValuation)}</b></span>}
            <span>Expires <b>{term.expiresIn} wk</b></span>
          </div>
          {term.expectation && <div className="insight-box"><b>Investor expectation</b><span>{term.expectation}</span></div>}
          <div className="candidate-actions">
            <button className="primary" onClick={() => onAction({ type: 'acceptTermSheet', termSheetId: term.id })}>Accept</button>
            <button className="secondary" onClick={() => onAction({ type: 'rejectTermSheet', termSheetId: term.id })}>Reject</button>
          </div>
        </article>)}
      </div>
    </>}

    <h3>Cap table</h3>
    <div className="signal-list">
      {state.funding.capTable.map((holder) => <span key={holder.id}>{holder.label}<b>{pct(holder.ownership)}</b></span>)}
    </div>

    <h3>Basic balance sheet</h3>
    <div className="report-stats">
      <span>Total assets <b>{money(state.finance.totalAssets)}</b></span>
      <span>Total liabilities <b>{money(state.finance.totalLiabilities)}</b></span>
      <span>Book equity <b>{money(state.finance.bookEquity)}</b></span>
      <span>Inventory asset <b>{money(state.finance.inventoryAsset)}</b></span>
      <span>Expansion assets <b>{money(state.finance.expansionAssets)}</b></span>
      <span>Tax payable <b>{money(state.finance.taxPayable)}</b></span>
    </div>
  </section>;
}
