import { useEffect, useMemo, useState } from 'react';
import { scoreBusinessPlan } from '../engine/businessPlan.js';
import { buildCustomIndustry, customDefaults } from '../engine/customIndustry.js';
import { industryPlanDefaults, locationOptions } from '../engine/businessProfile.js';

export default function SetupFlow({ config, industryOptions, catalog, onStart }) {
  const [industryId, setIndustryId] = useState('cafe');
  const [customDraft, setCustomDraft] = useState({
    archetype: 'service',
    businessName: 'My Custom Business',
    category: 'Custom business',
    unitLabel: 'units sold',
    targetCustomer: 'A specific customer group with a recurring need.',
    ...customDefaults('service')
  });

  const preset = industryOptions.find((item) => item.id === industryId);
  const industry = useMemo(
    () => industryId === 'custom' ? buildCustomIndustry(customDraft) : preset.industry,
    [industryId, customDraft, preset]
  );

  const [setup, setSetup] = useState(() => ({
    mode: 'tutorial',
    startingCapital: 50000,
    duration: 104,
    goal: 'profit',
    goalTarget: config.goals.profit.defaultTarget,
    structure: 'llc',
    location: 'rented',
    startPath: 'scratch',
    plan: industryPlanDefaults(industry)
  }));

  const locations = useMemo(() => locationOptions(config, industry), [config, industry]);
  const planScore = useMemo(() => scoreBusinessPlan(setup.plan, industry), [setup.plan, industry]);

  const update = (key, value) => setSetup((s) => ({ ...s, [key]: value }));
  const updatePlan = (key, value) => setSetup((s) => ({ ...s, plan: { ...s.plan, [key]: value } }));
  const setGoal = (goal) => setSetup((s) => ({ ...s, goal, goalTarget: config.goals[goal].defaultTarget }));

  useEffect(() => {
    const defaults = industryPlanDefaults(industry);
    setSetup((current) => {
      const nextLocation = locations.some((item) => item.id === current.location)
        ? current.location
        : (locations[0]?.id || 'rented');
      return { ...current, location: nextLocation, plan: defaults };
    });
  }, [industryId]);

  const selectCustomArchetype = (archetype) => {
    const defaults = customDefaults(archetype);
    setCustomDraft((current) => ({
      ...current,
      ...defaults,
      archetype,
      unitLabel:
        archetype === 'service' ? 'service units / subscriptions' :
        archetype === 'agriculture' ? 'production units' :
        'units sold'
    }));
  };

  const chooseIndustry = (id) => setIndustryId(id);

  const start = () => {
    const simulationProfileId =
      industryId === 'custom'
        ? catalog.customArchetypes.find((item) => item.id === customDraft.archetype)?.simulationProfileId || 'software_saas'
        : industryId;

    onStart({
      ...setup,
      industryId,
      simulationProfileId,
      customIndustry: industryId === 'custom' ? industry : null
    });
  };

  return <div className="setup-shell">
    <section className="hero">
      <div>
        <div className="eyebrow">Founder Lab · Multi-business simulator</div>
        <h1>What company do you want to build?</h1>
        <p>Choose a realistic preset or create your own business. The simulation engine changes its economics and operating model instead of merely changing the company name.</p>
      </div>
      <div className="industry-card">
        <strong>{industry.name}</strong>
        <span>{industry.category}</span>
        <p>{industry.description}</p>
      </div>
    </section>

    <section className="panel">
      <div className="section-head">
        <div><h2>1. Choose your business</h2><p>Quick-start businesses have tailored roles, operations, competitors, compliance and growth paths.</p></div>
      </div>
      <div className="business-choice-grid">
        {industryOptions.map((option) => <button
          key={option.id}
          className={'business-choice ' + (industryId === option.id ? 'selected' : '')}
          onClick={() => chooseIndustry(option.id)}
        >
          <span className="business-icon">{option.icon}</span>
          <strong>{option.industry.name}</strong>
          <small>{option.industry.category}</small>
          <p>{option.industry.description}</p>
        </button>)}
        <button className={'business-choice ' + (industryId === 'custom' ? 'selected' : '')} onClick={() => chooseIndustry('custom')}>
          <span className="business-icon">🧩</span>
          <strong>Custom Business</strong>
          <small>Any field</small>
          <p>Enter your own price, variable cost, fixed cost, demand and capacity; choose the closest operating archetype.</p>
        </button>
      </div>
    </section>

    {industryId === 'custom' && <section className="panel">
      <div className="section-head"><div><h2>Custom business generator</h2><p>This creates a real industry configuration from your assumptions. You can model agencies, factories, farms, stores, services and other businesses.</p></div></div>

      <div className="choice-grid">
        {catalog.customArchetypes.map((item) => <button
          className={'choice ' + (customDraft.archetype === item.id ? 'selected' : '')}
          key={item.id}
          onClick={() => selectCustomArchetype(item.id)}
        >
          <strong>{item.label}</strong>
          <span>{item.description}</span>
        </button>)}
      </div>

      <div className="plan-grid custom-economics">
        <label>Business name<input value={customDraft.businessName} onChange={(e) => setCustomDraft((d) => ({ ...d, businessName: e.target.value }))} /></label>
        <label>Industry/category<input value={customDraft.category} onChange={(e) => setCustomDraft((d) => ({ ...d, category: e.target.value }))} /></label>
        <label>Unit sold<input value={customDraft.unitLabel} onChange={(e) => setCustomDraft((d) => ({ ...d, unitLabel: e.target.value }))} /></label>
        <label>Selling price<input type="number" step="0.01" value={customDraft.price} onChange={(e) => setCustomDraft((d) => ({ ...d, price: Number(e.target.value) }))} /></label>
        <label>Variable cost / unit<input type="number" step="0.01" value={customDraft.variableCost} onChange={(e) => setCustomDraft((d) => ({ ...d, variableCost: Number(e.target.value) }))} /></label>
        <label>Weekly fixed cost<input type="number" value={customDraft.fixedCost} onChange={(e) => setCustomDraft((d) => ({ ...d, fixedCost: Number(e.target.value) }))} /></label>
        <label>Weekly capacity<input type="number" value={customDraft.capacity} onChange={(e) => setCustomDraft((d) => ({ ...d, capacity: Number(e.target.value) }))} /></label>
        <label>Weekly market demand<input type="number" value={customDraft.marketDemand} onChange={(e) => setCustomDraft((d) => ({ ...d, marketDemand: Number(e.target.value) }))} /></label>
        <label>Initial customers<input type="number" value={customDraft.initialCustomers} onChange={(e) => setCustomDraft((d) => ({ ...d, initialCustomers: Number(e.target.value) }))} /></label>
      </div>
    </section>}

    <section className="panel">
      <div className="section-head"><div><h2>2. Start path</h2><p>Acquisition paths unlock with the dedicated acquisition system.</p></div></div>
      <div className="choice-grid">
        <button className="choice selected" onClick={() => update('startPath', 'scratch')}><strong>Start from scratch</strong><span>Build the company from zero using your chosen starting capital.</span></button>
        <button className="choice locked-choice" disabled><strong>Buy existing business</strong><span>Unlocks in Phase 5B: marketplace, due diligence and acquisitions.</span></button>
        <button className="choice locked-choice" disabled><strong>Mixed</strong><span>Build companies and acquire others after Phase 5B.</span></button>
      </div>
    </section>

    <section className="panel setup-grid">
      <label>Mode<select value={setup.mode} onChange={(e) => update('mode', e.target.value)}>{Object.entries(config.modes).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></label>
      <label>Starting capital<select value={setup.startingCapital} onChange={(e) => update('startingCapital', Number(e.target.value))}>{config.startingCapital.map((x) => <option key={x} value={x}>{'$' + x.toLocaleString() + ' · ' + config.difficultyMultiplierByCapital[x] + '× score'}</option>)}</select></label>
      <label>Length<select value={setup.duration} onChange={(e) => update('duration', Number(e.target.value))}>{config.durations.map((x) => <option key={x} value={x}>{x} weeks</option>)}</select></label>
      <label>Goal<select value={setup.goal} onChange={(e) => setGoal(e.target.value)}>{Object.entries(config.goals).map(([id, x]) => <option key={id} value={id}>{x.label}</option>)}</select></label>
      <label>Goal target<input type="number" step={setup.goal === 'marketShare' ? 0.05 : 1000} value={setup.goalTarget} onChange={(e) => update('goalTarget', Number(e.target.value))} /></label>
      <label>Location/model<select value={setup.location} onChange={(e) => update('location', e.target.value)}>{locations.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    </section>

    <section className="panel">
      <div className="section-head"><div><h2>3. Business structure</h2><p>{config.jurisdictionNote}</p></div></div>
      <div className="choice-grid">{Object.entries(config.structures).map(([id, s]) => <button className={'choice ' + (setup.structure === id ? 'selected' : '')} key={id} onClick={() => update('structure', id)}><strong>{s.label}</strong><span>{s.liability}</span><small>{s.taxModel}</small></button>)}</div>
    </section>

    <section className="panel">
      <div className="section-head"><div><h2>4. Simple business plan</h2><p>Score: <b>{planScore.score}/100</b>. The score checks clarity and consistency; it does not guarantee success.</p></div></div>
      <div className="plan-grid">
        <label className="wide">Idea<textarea value={setup.plan.idea} onChange={(e) => updatePlan('idea', e.target.value)} /></label>
        <label className="wide">Target customer<textarea value={setup.plan.targetCustomer} onChange={(e) => updatePlan('targetCustomer', e.target.value)} /></label>
        <label>Selling price<input type="number" step={industry.referencePrice < 5 ? 0.01 : 0.5} value={setup.plan.price} onChange={(e) => updatePlan('price', Number(e.target.value))} /></label>
        <label>Weekly fixed-cost estimate<input type="number" value={setup.plan.weeklyFixedCostEstimate} onChange={(e) => updatePlan('weeklyFixedCostEstimate', Number(e.target.value))} /></label>
        <label>Variable cost / {industry.unitLabel || 'unit'}<input type="number" step={industry.referencePrice < 5 ? 0.01 : 0.25} value={setup.plan.variableCostEstimate} onChange={(e) => updatePlan('variableCostEstimate', Number(e.target.value))} /></label>
      </div>
      <ul className="feedback">{planScore.feedback.map((f) => <li key={f}>{f}</li>)}</ul>
      <button className="primary start-company" onClick={start}>Start {industry.name}</button>
    </section>
  </div>;
}
