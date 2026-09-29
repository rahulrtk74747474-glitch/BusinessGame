import React, { useMemo } from 'react';
import { candidateView } from '../engine/hiring.js';

const money = (n) => '$' + Math.round(n).toLocaleString();
const pct = (n) => Math.round(n * 100) + '%';

export default function HiringPanel({ state, rolesData, onHrAction, onStartNegotiation }) {
  const views = useMemo(
    () => state.hr.candidates.map((candidate) => candidateView(candidate, rolesData)),
    [state.hr.candidates, rolesData]
  );

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 2 + Phase 3 · Recruiting</div>
        <h2>Candidate pool</h2>
        <p>Skill, experience and salary ask are visible. Reliability, ambition, culture fit and work preferences remain hidden until you investigate them.</p>
      </div>
      <button className="secondary" onClick={() => onHrAction({ type: 'refreshCandidates' })}>
        Refresh pool · {money(rolesData.refreshPoolCost)}
      </button>
    </div>

    <div className="candidate-grid">
      {views.map((candidate) => {
        const role = rolesData.roles[candidate.roleId];
        const trial = state.hr.trials.find((t) => t.candidateId === candidate.id);

        return <article className={'candidate-card ' + (!candidate.available ? 'inactive' : '')} key={candidate.id}>
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
            <span>Interview: {candidate.interview ? 'culture ' + candidate.interview.cultureFit + ', ambition ' + candidate.interview.ambition : 'not done'}</span>
            <span>References: {candidate.references ? 'reliability ' + candidate.references.reliability : 'not checked'}</span>
            <span>Trial: {candidate.trialCompleted ? 'completed · observed score ' + pct(candidate.trialScore) : trial ? trial.remainingWeeks + ' week(s) remaining' : 'not run'}</span>
          </div>

          {candidate.offer?.message && <div className={'offer-message ' + candidate.offer.status}>{candidate.offer.message}</div>}

          {candidate.available && <>
            <div className="candidate-actions">
              <button className="secondary" onClick={() => onHrAction({ type: 'interview', candidateId: candidate.id })}>Interview · {money(rolesData.interviewCost)}</button>
              <button className="secondary" onClick={() => onHrAction({ type: 'referenceCheck', candidateId: candidate.id })}>References · {money(rolesData.referenceCheckCost)}</button>
              <button className="secondary" disabled={Boolean(trial)} onClick={() => onHrAction({ type: 'startTrial', candidateId: candidate.id })}>2-week trial · {money(rolesData.trialAdminCost)}</button>
            </div>

            <button className="primary" onClick={() => onStartNegotiation(candidate.id)}>
              Negotiate compensation
            </button>
          </>}
        </article>;
      })}
    </div>

    <div className="phase-note">
      Candidate compensation now uses the Phase 3 negotiation engine. Interviewing, reference checks and trials improve your preparation before you negotiate salary and bundled terms.
    </div>
  </section>;
}
