import React from 'react';
import { buildFormulaExplanation } from '../engine/financialFormulaExplorer.js';

export default function FormulaExplorerModal({ formulaKey, state, industry, catalog, snapshot, onClose }) {
  if (!formulaKey) return null;
  const detail = buildFormulaExplanation(formulaKey, state, industry, catalog, snapshot);
  if (!detail) return null;

  return <div className="finance-modal-backdrop" role="presentation" onMouseDown={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}>
    <section className="finance-modal formula-modal" role="dialog" aria-modal="true" aria-labelledby="formula-title">
      <div className="finance-modal-head">
        <div>
          <div className="eyebrow">{detail.category} · Formula explorer</div>
          <h2 id="formula-title">{detail.title}</h2>
        </div>
        <button className="finance-modal-close" aria-label="Close formula explanation" onClick={onClose}>×</button>
      </div>

      <div className="formula-definition-card">
        <span>Formula</span>
        <b>{detail.formula}</b>
      </div>

      <div className="formula-explanation-block">
        <h3>What does it mean?</h3>
        <p>{detail.meaning}</p>
      </div>

      {detail.inputs.length > 0 && <div className="formula-inputs">
        <h3>Your company inputs</h3>
        <div className="formula-input-grid">
          {detail.inputs.map((input) => <span key={input.name}>
            {input.name}<b>{input.value}</b>
          </span>)}
        </div>
      </div>}

      <div className="worked-calculation">
        <h3>Worked calculation — Week {state.week}</h3>
        {detail.steps.map((step, index) => <div className="calculation-step" key={index}>
          <span>{index + 1}</span><b>{step}</b>
        </div>)}
        <div className="formula-result">
          <span>Calculated value</span>
          <b>{detail.result}</b>
        </div>
      </div>

      <div className="formula-interpretation">
        <h3>What your result means</h3>
        <p>{detail.interpretation}</p>
      </div>

      <div className="formula-direction">
        <h3>Higher or lower — which is better?</h3>
        <p>{detail.higherLower}</p>
      </div>

      <div className="formula-simple-example">
        <h3>Simple example</h3>
        <p>{detail.simpleExample}</p>
      </div>

      <div className="formula-warning">
        <b>Important:</b> ratios should be compared with the same company's history and similar businesses. A “good” value is rarely universal across industries.
      </div>

      <div className="finance-modal-actions">
        <button className="primary" onClick={onClose}>Got it</button>
      </div>
    </section>
  </div>;
}
