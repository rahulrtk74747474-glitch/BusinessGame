import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

export default function AssetInvestmentPanel({ state, industry, data, onAction }) {
  const [category, setCategory] = React.useState('All');
  const [recommendedOnly, setRecommendedOnly] = React.useState(false);
  const [treasuryAmount, setTreasuryAmount] = React.useState(5000);

  if (!data) return <section className="panel"><p>Asset investment data is unavailable.</p></section>;

  const catalog = Object.entries(data.catalog);
  const categories = ['All', ...new Set(catalog.map(([, item]) => item.category))];
  const visible = catalog.filter(([, item]) => {
    const categoryMatch = category === 'All' || item.category === category;
    const recommendedMatch = !recommendedOnly || item.recommendedFor?.includes(industry.id);
    return categoryMatch && recommendedMatch;
  });

  const last = state.assets?.last || {};
  const owned = state.assets?.ownedAssets || [];
  const holdings = state.assets?.treasuryHoldings || [];

  return <section className="assets-shell">
    <section className="panel">
      <div className="section-head">
        <div>
          <div className="eyebrow">India preset · capital allocation</div>
          <h2>Investments & depreciating assets</h2>
          <p>Buy operating assets with cash, place surplus cash in simple treasury investments, and learn how capex, depreciation, maintenance and book value affect the financial statements.</p>
        </div>
      </div>

      <div className="asset-summary-grid">
        <span>Gross PPE<b>{money(last.grossPpe)}</b></span>
        <span>Accumulated depreciation<b>{money(last.accumulatedDepreciation)}</b></span>
        <span>Net PPE<b>{money(last.netPpe)}</b></span>
        <span>Weekly depreciation<b>{money(last.depreciationExpense)}</b></span>
        <span>Weekly maintenance<b>{money(last.maintenanceCashCost)}</b></span>
        <span>Treasury investments<b>{money(last.financialInvestments)}</b></span>
        <span>Investment income/wk<b>{money(last.investmentIncome)}</b></span>
        <span>Tax WDV reference<b>{money(last.taxWdvReference)}</b></span>
      </div>

      <div className="india-accounting-note">
        <b>India learning basis:</b> book depreciation uses a straight-line useful-life model inspired by Schedule II to the Companies Act. The displayed tax WDV rate is a separate reference from the Income-tax depreciation table and is <b>not</b> currently used in the game's simplified tax calculation. Actual tax treatment depends on facts, asset block and put-to-use timing.
      </div>
    </section>

    <section className="panel">
      <div className="section-head">
        <div><h2>Operating asset marketplace</h2><p>Purchase price is capital expenditure: cash falls now, but the cost becomes an asset and is expensed gradually through depreciation.</p></div>
      </div>

      <div className="asset-filter-row">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <label className="asset-checkbox"><input type="checkbox" checked={recommendedOnly} onChange={(e) => setRecommendedOnly(e.target.checked)} /> Recommended for {industry.name}</label>
      </div>

      <div className="asset-market-grid">
        {visible.map(([id, item]) => {
          const weeklyDep = item.simulationCost * (1 - item.residualValueRate) / (item.usefulLifeYears * 52);
          return <article className="asset-card" key={id}>
            <div className="asset-card-head">
              <div><small>{item.category}</small><strong>{item.label}</strong><span>{item.model}</span></div>
              {item.recommendedFor?.includes(industry.id) && <em>Recommended</em>}
            </div>
            <p>{item.description}</p>
            <div className="asset-metrics">
              <span>Simulation cost<b>{money(item.simulationCost)}</b></span>
              <span>Book useful life<b>{item.usefulLifeYears} years</b></span>
              <span>Book depreciation<b>{money(weeklyDep)}/wk</b></span>
              <span>India tax WDV ref.<b>{pct(item.taxWDVRate)}</b></span>
              <span>Maintenance est.<b>{pct(item.annualMaintenanceRate)}/yr</b></span>
              <span>Capacity effect<b>+{item.capacityAdd || 0}/wk</b></span>
            </div>
            <div className="india-reference"><b>India reference:</b> {item.indiaReference}</div>
            <button className="primary" disabled={state.status !== 'running' || state.finance.cash < item.simulationCost} onClick={() => onAction({ type:'buyAsset', catalogId:id })}>
              Buy asset · {money(item.simulationCost)}
            </button>
          </article>;
        })}
      </div>
    </section>

    <section className="panel">
      <div className="section-head"><div><h2>Owned fixed assets</h2><p>Book value falls through depreciation even though depreciation itself does not use cash each week.</p></div></div>
      {owned.length === 0 ? <div className="empty-state">No depreciating fixed assets purchased yet.</div> :
        <div className="owned-asset-grid">{owned.map((asset) => {
          const item = data.catalog[asset.catalogId];
          const proceeds = asset.bookValue * (item?.resaleMultiplier ?? 0.85);
          return <article className="owned-asset-card" key={asset.id}>
            <strong>{asset.label}</strong>
            <small>Purchased week {asset.purchasedWeek}</small>
            <div className="asset-metrics">
              <span>Original cost<b>{money(asset.originalCost)}</b></span>
              <span>Accum. depreciation<b>{money(asset.accumulatedDepreciation)}</b></span>
              <span>Book value<b>{money(asset.bookValue)}</b></span>
              <span>Tax WDV reference<b>{money(asset.taxWdvReference)}</b></span>
            </div>
            <button className="secondary" disabled={state.status !== 'running'} onClick={() => onAction({ type:'sellAsset', assetId:asset.id })}>Sell · est. {money(proceeds)}</button>
          </article>;
        })}</div>
      }
    </section>

    <section className="panel">
      <div className="section-head">
        <div><h2>Treasury investments</h2><p>Move idle company cash into simplified low-risk investments. These do not depreciate like vehicles or machines; instead they remain financial assets and earn simulated investment income.</p></div>
      </div>
      <label className="treasury-amount">Amount to invest<input type="number" min="0" step="500" value={treasuryAmount} onChange={(e) => setTreasuryAmount(Number(e.target.value))} /></label>
      <div className="treasury-grid">
        {Object.entries(data.treasuryOptions).map(([id, item]) => <article className="treasury-card" key={id}>
          <small>{item.category}</small>
          <strong>{item.label}</strong>
          <span>Simulated annual return: <b>{pct(item.simulatedAnnualReturn)}</b></span>
          <span>Minimum: <b>{money(item.minimumInvestment)}</b></span>
          <span>Lock reference: <b>{item.lockWeeks} weeks</b></span>
          <p>{item.note}</p>
          <button className="primary" disabled={state.status !== 'running' || treasuryAmount < item.minimumInvestment || treasuryAmount > state.finance.cash} onClick={() => onAction({ type:'buyTreasury', optionId:id, amount:treasuryAmount })}>Invest {money(treasuryAmount)}</button>
        </article>)}
      </div>

      <div className="owned-investments">
        <h3>Current treasury holdings</h3>
        {holdings.length === 0 ? <div className="empty-state">No treasury investments.</div> : holdings.map((holding) => {
          const option = data.treasuryOptions[holding.optionId];
          const weeksHeld = state.week - holding.purchasedWeek;
          return <div className="holding-row" key={holding.id}>
            <span><b>{holding.label}</b><small>{money(holding.principal)} principal · held {weeksHeld} weeks</small></span>
            <button className="secondary" onClick={() => onAction({ type:'liquidateTreasury', holdingId:holding.id })}>{weeksHeld < option.lockWeeks ? 'Exit early' : 'Liquidate'}</button>
          </div>;
        })}
      </div>
    </section>

    <section className="panel asset-learning-box">
      <h3>What changes when you buy a ₹/capital asset?</h3>
      <p><b>Day of purchase:</b> cash decreases and fixed assets increase. Profit does not fall by the whole purchase price.</p>
      <p><b>Each week:</b> depreciation reduces book value and accounting profit; maintenance reduces both cash and profit.</p>
      <p><b>When sold:</b> cash increases, the asset leaves the balance sheet, and a gain/loss is recognized if sale proceeds differ from book value.</p>
      <p><b>Tax:</b> book depreciation and tax depreciation can differ. The game shows both concepts separately rather than pretending they are the same number.</p>
    </section>
  </section>;
}
