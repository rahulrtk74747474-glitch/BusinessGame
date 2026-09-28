import React from 'react';

const money = (n) => `$${Math.round(n).toLocaleString()}`;
const pct = (n) => `${Math.round(n * 100)}%`;

function signal(value, low = 0.45, high = 0.75) {
  return value < low ? 'Low' : value < high ? 'Medium' : 'High';
}

export default function TeamPanel({ state, rolesData, onHrAction }) {
  const payroll = state.hr.employees.reduce(
    (sum, e) => sum + e.weeklySalary + e.perksWeekly + state.hr.benefitsPerEmployee,
    0
  ) + state.hr.trials.reduce((sum, t) => sum + t.salaryAsk, 0);

  const terminate = (employeeId, reason, name) => {
    const label = reason === 'layoff' ? 'lay off' : 'fire';
    if (window.confirm(`Are you sure you want to ${label} ${name}? This has severance and morale effects.`)) {
      onHrAction({ type: 'terminate', employeeId, reason });
    }
  };

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 2 · People operations</div>
        <h2>Team management</h2>
        <p>Productivity = skill × morale × training × manager quality × ramp-up × reliability/work-mode fit.</p>
      </div>
    </div>

    <div className="team-summary">
      <span>Headcount <b>{state.hr.employees.length}</b></span>
      <span>Weekly payroll <b>{money(payroll)}</b></span>
      <span>Avg productivity <b>{state.hr.employees.length ? pct(state.hr.averageProductivity) : '—'}</b></span>
      <span>Avg morale <b>{state.hr.employees.length ? pct(state.hr.averageMorale) : '—'}</b></span>
      <span>Avg burnout <b>{state.hr.employees.length ? pct(state.hr.averageBurnout) : '—'}</b></span>
      <span>Manager quality <b>{pct(state.hr.managerQuality)}</b></span>
      <span>Employment legal risk <b>{signal(state.hr.legalRisk, 0.12, 0.35)}</b></span>
    </div>

    <div className="benefits-row">
      <label>Benefits per employee / week
        <select value={state.hr.benefitsPerEmployee} onChange={(e) => onHrAction({ type: 'setBenefits', amount: Number(e.target.value) })}>
          {rolesData.benefitOptions.map((x) => <option value={x} key={x}>{money(x)}</option>)}
        </select>
      </label>
      <small>Benefits raise recurring payroll; salary competitiveness and morale influence loyalty and quit risk.</small>
    </div>

    {state.hr.employees.length === 0
      ? <div className="empty-state">You are still founder-only. Hire when capacity, execution quality, or management bandwidth justifies the payroll.</div>
      : <div className="employee-grid">
          {state.hr.employees.map((employee) => {
            const role = rolesData.roles[employee.roleId];
            return <article className="employee-card" key={employee.id}>
              <div className="candidate-head">
                <div><strong>{employee.name}</strong><span>{role.label}</span></div>
                <span className="risk-pill">{money(employee.weeklySalary)}/wk</span>
              </div>
              <div className="candidate-stats">
                <span>Productivity <b>{pct(employee.productivity)}</b></span>
                <span>Morale <b>{pct(employee.morale)}</b></span>
                <span>Burnout <b>{pct(employee.burnout)}</b></span>
                <span>Loyalty <b>{pct(employee.loyalty)}</b></span>
                <span>Training <b>+{pct(employee.training)}</b></span>
                <span>Reviews <b>{employee.reviews}</b></span>
              </div>

              {employee.lastPerformance && <div className="insight-box">
                <b>Latest review signals</b>
                <span>Reliability: {employee.lastPerformance.reliabilitySignal}</span>
                <span>Ambition: {employee.lastPerformance.ambitionSignal}</span>
                <span>Culture fit: {employee.lastPerformance.cultureFitSignal}</span>
              </div>}

              <div className="workmode-row">
                <label>Work mode
                  <select value={employee.workMode} onChange={(e) => onHrAction({ type: 'setWorkMode', employeeId: employee.id, workMode: e.target.value })}>
                    <option value="onsite">On-site</option>
                    {role.remoteEligible && <option value="hybrid">Hybrid</option>}
                    {role.remoteEligible && <option value="remote">Remote</option>}
                  </select>
                </label>
              </div>

              <div className="employee-actions">
                <button className="secondary" onClick={() => onHrAction({ type: 'train', employeeId: employee.id })}>Train · {money(rolesData.trainingCost)}</button>
                <button className="secondary" onClick={() => onHrAction({ type: 'review', employeeId: employee.id })}>Performance review</button>
                <button className="secondary" onClick={() => onHrAction({ type: 'raise', employeeId: employee.id })}>Raise +{Math.round(rolesData.raisePercent * 100)}%</button>
                {role.promotionTo && <button className="secondary" onClick={() => onHrAction({ type: 'promote', employeeId: employee.id })}>Promote</button>}
                <button className="danger" onClick={() => terminate(employee.id, 'fire', employee.name)}>Fire</button>
                <button className="danger subtle" onClick={() => terminate(employee.id, 'layoff', employee.name)}>Lay off</button>
              </div>
            </article>;
          })}
        </div>}

    {state.hr.events.length > 0 && <div className="hr-events">
      <h3>Recent people events</h3>
      {state.hr.events.slice(-5).reverse().map((event, i) => <div key={`${event.message}-${i}`}>{event.message}</div>)}
    </div>}
  </section>;
}
