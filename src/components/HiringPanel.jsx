import React, { useMemo, useState } from 'react';
import { candidateView } from '../engine/hiring.js';

const money = (n) => `$${Math.round(n).toLocaleString()}`;
const pct = (n) => `${Math.round(n * 100)}%`;

export default function HiringPanel({ state, rolesData, onHrAction }) {
  const views = useMemo(
    () => state.hr.candidates.map((candidate) => candidateView(candidate, rolesData)),
    [state.hr.candidates, rolesData]
  );
  const [offers, setOffers] = useState({});

  const draftFor = (candidate) => offers[candidate.id] || {
    weeklySalary: candidate.offer?.counterSalary || candidate.salaryAsk,
    perksWeekly: 0,
    equityBps: 0
  };

  const setDraft = (candidateId, key, value) => {
    setOffers((current) => ({
      ...current,
      [candidateId]: { ...draftFor(views.find((v) => v.id === candidateId)), ...current[candidateId], [key]: Number(value) }
    }));
  };

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 2 · Recruiting</div>
        <h2>Candidate pool</h2>
        <p>Visible: skill, experience, salary ask. Hidden: reliability, ambition, culture fit, and work preferences. Due diligence reduces uncertainty.</p>
      </div>
      <button className="secondary" onClick={() => onHrAction({ type: 'refreshCandidates' })}>
        Refresh pool · {money(rolesData.refreshPoolCost)}
      </button>
    </div>

    <div className="candidate-grid">
      {views.map((candidate) => {
        const role = rolesData.roles[candidate.roleId];
        const draft = draftFor(candidate);
        const trial = state.hr.trials.find((t) => t.candidateId === candidate.id);

        return <article className={"candidate-card " + (!candidate.available ? 'inactive' : '')} key={candidate.id}>
          <div className="candidate-head">
            <div><strong>{candidate.name}</strong><span>{candidate.roleLabel}</span></div>
            <span className="risk-pill">{candidate.riskLabel}</span>
          </div>

          <div className="candidate-stats">
            <span>Skill <b>{pct(candidate.skill)}</b></span>
            <span>Experience <b>{candidate.experienceYears} yr</b></span>
            <span>Salary ask <b>{money(candidate.salaryAsk)}/wk</b></span>
            <span>Remote eligible <b>{role.remoteEligible ? 'Yes' : 'No'}</b></span>
          </div>

          <div className="insight-box">
            <b>What you know</b>
            <span>Interview: {candidate.interview ? `culture ${candidate.interview.cultureFit}, ambition ${candidate.interview.ambition}` : 'not done'}</span>
            <span>References: {candidate.references ? `reliability ${candidate.references.reliability}` : 'not checked'}</span>
            <span>Trial: {candidate.trialCompleted ? `completed · observed score ${pct(candidate.trialScore)}` : trial ? `${trial.remainingWeeks} week(s) remaining` : 'not run'}</span>
          </div>

          {candidate.offer?.message && <div className={"offer-message " + candidate.offer.status}>{candidate.offer.message}</div>}

          {candidate.available && <>
            <div className="candidate-actions">
              <button className="secondary" onClick={() => onHrAction({ type: 'interview', candidateId: candidate.id })}>Interview · {money(rolesData.interviewCost)}</button>
              <button className="secondary" onClick={() => onHrAction({ type: 'referenceCheck', candidateId: candidate.id })}>References · {money(rolesData.referenceCheckCost)}</button>
              <button className="secondary" disabled={Boolean(trial)} onClick={() => onHrAction({ type: 'startTrial', candidateId: candidate.id })}>2-week trial · {money(rolesData.trialAdminCost)}</button>
            </div>

            <div className="offer-form">
              <label>Salary / week<input type="number" min="1" value={draft.weeklySalary} onChange={(e) => setDraft(candidate.id, 'weeklySalary', e.target.value)} /></label>
              <label>Perks / week<input type="number" min="0" step="10" value={draft.perksWeekly} onChange={(e) => setDraft(candidate.id, 'perksWeekly', e.target.value)} /></label>
              <label>Equity (bps)<input type="number" min="0" max="100" value={draft.equityBps} onChange={(e) => setDraft(candidate.id, 'equityBps', e.target.value)} /></label>
            </div>
            <button className="primary" onClick={() => onHrAction({ type: 'makeOffer', candidateId: candidate.id, ...draft })}>Make one-shot offer</button>
          </>}
        </article>;
      })}
    </div>
    <div className="phase-note">Phase 2 uses a one-shot offer/counter/decline model. Phase 3 will replace this with the full tactic-based negotiation engine.</div>
  </section>;
}
