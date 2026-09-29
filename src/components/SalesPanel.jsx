import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => Math.round((n || 0) * 100) + '%';

export default function SalesPanel({ state, salesData, onAction }) {
  const s = state.sales.settings;
  const last = state.sales.last;

  const set = (key, value) => onAction({ type: 'setSalesSetting', key, value });

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 4 · Sales</div>
        <h2>B2B pipeline</h2>
        <p>Leads do not become revenue immediately. They move through lead → qualified → proposal → win stages, so sales spending today can pay back several weeks later.</p>
      </div>
    </div>

    <div className="commercial-summary">
      <span>New leads <b>{last.newLeads.toFixed(1)}</b></span>
      <span>Qualified <b>{last.qualified.toFixed(1)}</b></span>
      <span>Proposals <b>{last.proposals.toFixed(1)}</b></span>
      <span>Expected wins <b>{last.wins.toFixed(2)}</b></span>
      <span>Close rate <b>{pct(last.closeRate)}</b></span>
      <span>Sales revenue <b>{money(last.revenue)}</b></span>
      <span>Pipeline value <b>{money(last.pipelineValue)}</b></span>
      <span>Active recurring cohorts <b>{last.activeDealCount}</b></span>
    </div>

    <div className="sales-controls">
      <label>Outbound / prospecting spend <b>{money(s.outboundSpend)}/week</b>
        <input type="range" min="0" max={salesData.limits.outboundSpendMax} step="20" value={s.outboundSpend} onChange={(e) => set('outboundSpend', Number(e.target.value))} />
      </label>

      <label>Discount offered <b>{pct(s.discountRate)}</b>
        <input type="range" min="0" max={salesData.limits.discountRateMax} step="0.01" value={s.discountRate} onChange={(e) => set('discountRate', Number(e.target.value))} />
      </label>

      <label>Sales commission <b>{pct(s.commissionRate)}</b>
        <input type="range" min={salesData.limits.commissionRateMin} max={salesData.limits.commissionRateMax} step="0.01" value={s.commissionRate} onChange={(e) => set('commissionRate', Number(e.target.value))} />
      </label>

      <label>Pricing model
        <select value={s.pricingModel} onChange={(e) => set('pricingModel', e.target.value)}>
          {Object.entries(salesData.pricingModels).map(([id, model]) =>
            <option value={id} key={id}>{model.label}</option>
          )}
        </select>
      </label>
    </div>

    <div className="model-explainer">
      <strong>{salesData.pricingModels[s.pricingModel].label}</strong>
      <span>{salesData.pricingModels[s.pricingModel].description}</span>
      <small>Contract duration: {salesData.pricingModels[s.pricingModel].durationWeeks} week(s)</small>
    </div>

    <div className="pipeline-flow">
      <span>Leads <b>{state.sales.pipeline.leads.toFixed(1)}</b></span>
      <i>→</i>
      <span>Qualified <b>{state.sales.pipeline.qualified.toFixed(1)}</b></span>
      <i>→</i>
      <span>Proposals <b>{state.sales.pipeline.proposals.toFixed(1)}</b></span>
      <i>→</i>
      <span>Wins next <b>depends on close rate</b></span>
    </div>

    <div className="phase-note">
      <b>Business lesson:</b> discounts can raise conversion while destroying margin. A healthy pipeline is valuable only if customers can be served profitably and operations can deliver what sales promises.
    </div>
  </section>;
}
