import { useMemo, useState } from 'react';
import { scoreBusinessPlan } from '../engine/businessPlan.js';

export default function SetupFlow({ config, industry, onStart }) {
  const [setup, setSetup] = useState({
    mode: 'tutorial',
    startingCapital: 50000,
    duration: 104,
    goal: 'profit',
    goalTarget: config.goals.profit.defaultTarget,
    structure: 'llc',
    location: 'rented',
    plan: {
      idea: 'Friendly neighborhood cafe with fast service and reliable quality.',
      targetCustomer: 'Nearby workers and residents who buy coffee or a light meal several times per week.',
      price: industry.referencePrice,
      weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
      variableCostEstimate: industry.baseVariableCostPerOrder
    }
  });

  const planScore = useMemo(() => scoreBusinessPlan(setup.plan, industry), [setup.plan, industry]);
  const update = (key, value) => setSetup((s) => ({ ...s, [key]: value }));
  const updatePlan = (key, value) => setSetup((s) => ({ ...s, plan: { ...s.plan, [key]: value } }));
  const setGoal = (goal) => setSetup((s) => ({ ...s, goal, goalTarget: config.goals[goal].defaultTarget }));

  return <div className="setup-shell">
    <section className="hero">
      <div>
        <div className="eyebrow">Phase 1 prototype</div>
        <h1>Founder Lab</h1>
        <p>Build a company one week at a time. The market is partially hidden; your reports reveal what your decisions are doing.</p>
      </div>
      <div className="industry-card">
        <strong>{industry.name}</strong>
        <span>{industry.category}</span>
        <p>{industry.description}</p>
      </div>
    </section>

    <section className="panel setup-grid">
      <label>Mode<select value={setup.mode} onChange={(e) => update('mode', e.target.value)}>{Object.entries(config.modes).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></label>
      <label>Starting capital<select value={setup.startingCapital} onChange={(e) => update('startingCapital', Number(e.target.value))}>{config.startingCapital.map((x) => <option key={x} value={x}>${x.toLocaleString()} · {config.difficultyMultiplierByCapital[x]}× score</option>)}</select></label>
      <label>Length<select value={setup.duration} onChange={(e) => update('duration', Number(e.target.value))}>{config.durations.map((x) => <option key={x} value={x}>{x} weeks</option>)}</select></label>
      <label>Goal<select value={setup.goal} onChange={(e) => setGoal(e.target.value)}>{Object.entries(config.goals).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></label>
      <label>Goal target<input type="number" step={setup.goal === 'marketShare' ? 0.05 : 1000} value={setup.goalTarget} onChange={(e) => update('goalTarget', Number(e.target.value))} /></label>
      <label>Location/model<select value={setup.location} onChange={(e) => update('location', e.target.value)}>{Object.entries(config.locations).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></label>
    </section>

    <section className="panel">
      <div className="section-head"><div><h2>Business structure</h2><p>{config.jurisdictionNote}</p></div></div>
      <div className="choice-grid">{Object.entries(config.structures).map(([id, s]) => <button className={`choice ${setup.structure === id ? 'selected' : ''}`} key={id} onClick={() => update('structure', id)}><strong>{s.label}</strong><span>{s.liability}</span><small>{s.taxModel}</small></button>)}</div>
    </section>

    <section className="panel">
      <div className="section-head"><div><h2>Simple business plan</h2><p>Score: <b>{planScore.score}/100</b>. This score evaluates clarity and internal consistency, not whether the idea is guaranteed to work.</p></div></div>
      <div className="plan-grid">
        <label className="wide">Idea<textarea value={setup.plan.idea} onChange={(e) => updatePlan('idea', e.target.value)} /></label>
        <label className="wide">Target customer<textarea value={setup.plan.targetCustomer} onChange={(e) => updatePlan('targetCustomer', e.target.value)} /></label>
        <label>Price<input type="number" step="0.5" value={setup.plan.price} onChange={(e) => updatePlan('price', Number(e.target.value))} /></label>
        <label>Weekly fixed-cost estimate<input type="number" value={setup.plan.weeklyFixedCostEstimate} onChange={(e) => updatePlan('weeklyFixedCostEstimate', Number(e.target.value))} /></label>
        <label>Variable cost / sale<input type="number" step="0.25" value={setup.plan.variableCostEstimate} onChange={(e) => updatePlan('variableCostEstimate', Number(e.target.value))} /></label>
      </div>
      <ul className="feedback">{planScore.feedback.map((f) => <li key={f}>{f}</li>)}</ul>
      <button className="primary" onClick={() => onStart(setup)}>Start company</button>
    </section>
  </div>;
}
