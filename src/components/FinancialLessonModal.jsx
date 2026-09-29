import React from 'react';
import { buildWeeklyFinancialLesson } from '../engine/financialEducation.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

export default function FinancialLessonModal({ state, industry, lessons, onClose, onOpenFinancials }) {
  const lesson = buildWeeklyFinancialLesson(state, industry, lessons);
  if (!lesson) return null;

  const s = lesson.snapshot;
  return <div className="finance-modal-backdrop" role="presentation">
    <section className="finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-lesson-title">
      <div className="finance-modal-head">
        <div>
          <div className="eyebrow">Financial learning · Week {state.week} of {lessons.length}</div>
          <h2 id="finance-lesson-title">{lesson.title}</h2>
        </div>
        <button className="finance-modal-close" aria-label="Close financial lesson" onClick={onClose}>×</button>
      </div>

      <div className="lesson-progress"><i style={{ width: (lesson.progress * 100) + '%' }} /></div>

      <div className="lesson-result-grid">
        <span>Revenue<b>{money(s.pnl.revenue)}</b></span>
        <span>Gross profit<b>{money(s.pnl.grossProfit)}</b></span>
        <span>Net {s.outcome}<b className={s.pnl.netProfit >= 0 ? 'positive-number' : 'negative-number'}>{money(s.pnl.netProfit)}</b></span>
        <span>Ending cash<b>{money(s.cashFlow.endingCash)}</b></span>
      </div>

      <div className="lesson-block">
        <strong>Concept</strong>
        <p>{lesson.concept}</p>
      </div>

      <div className="lesson-formula">
        <span>Formula</span>
        <b>{lesson.formula}</b>
      </div>

      <div className="lesson-block live-example">
        <strong>Your company this week</strong>
        <p>{lesson.example}</p>
      </div>

      <div className={'lesson-diagnosis ' + (s.pnl.netProfit >= 0 ? 'positive' : 'negative')}>
        <strong>What the numbers are saying</strong>
        <p>{lesson.diagnosis}</p>
      </div>

      <div className="lesson-block">
        <strong>What to do next</strong>
        <p>{lesson.action}</p>
      </div>

      <div className="lesson-skill">
        <span>Financial skill to remember</span>
        <b>{lesson.skill}</b>
      </div>

      <div className="finance-modal-actions">
        <button className="secondary" onClick={onOpenFinancials}>Open full Financials</button>
        <button className="primary" onClick={onClose}>Continue to week {state.week + 1}</button>
      </div>

      <small className="lesson-footnote">This is an educational simulation. Real financial reporting can require depreciation, receivables/payables, deferred revenue, jurisdiction-specific taxes and other accounting adjustments not yet modeled here.</small>
    </section>
  </div>;
}
