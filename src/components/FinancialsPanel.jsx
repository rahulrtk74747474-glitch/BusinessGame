import React from 'react';
import MiniChart from './MiniChart.jsx';
import FormulaExplorerModal from './FormulaExplorerModal.jsx';
import formulaCatalog from '../data/learning/financialFormulaCatalog.json';
import { createFinancialSnapshot } from '../engine/financialEducation.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';
const ratio = (n) => Number.isFinite(n) ? n.toFixed(2) + 'x' : 'N/M';

function Row({ label, value, strong = false, note = '', formulaKey, onExplain }) {
  return <div className={'financial-row ' + (strong ? 'strong' : '')}>
    <span>{label}{note && <small>{note}</small>}</span>
    <div className="financial-row-value">
      <b>{value}</b>
      {formulaKey && <button
        type="button"
        className="formula-help-button"
        onClick={() => onExplain(formulaKey)}
        aria-label={'Explain how ' + label + ' is calculated'}
        title={'How is ' + label + ' calculated?'}
      >?</button>}
    </div>
  </div>;
}

function SummaryCard({ label, value, formulaKey, onExplain }) {
  return <button type="button" className="finance-summary-card" onClick={() => formulaKey && onExplain(formulaKey)}>
    <span>{label}</span>
    <b>{value}</b>
    {formulaKey && <small>Tap for formula</small>}
  </button>;
}

export default function FinancialsPanel({ state, industry }) {
  const s = createFinancialSnapshot(state, industry);
  const history = state.history;
  const [formulaKey, setFormulaKey] = React.useState(null);
  const [formulaSearch, setFormulaSearch] = React.useState('');
  const [formulaCategory, setFormulaCategory] = React.useState('All');

  const categories = React.useMemo(
    () => ['All', ...new Set(formulaCatalog.map((item) => item.category))],
    []
  );

  const visibleFormulas = React.useMemo(() => {
    const q = formulaSearch.trim().toLowerCase();
    return formulaCatalog.filter((item) => {
      const matchesCategory = formulaCategory === 'All' || item.category === formulaCategory;
      const matchesSearch = !q || [item.title, item.formula, item.meaning, item.category]
        .some((value) => value.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [formulaSearch, formulaCategory]);

  return <section className="financials-shell">
    <section className="panel">
      <div className="section-head">
        <div>
          <div className="eyebrow">Financial learning center</div>
          <h2>Company financial statements</h2>
          <p>Tap any <b>?</b> or formula card to see the formula, your actual inputs, a step-by-step calculation, a simple example and how to interpret the result.</p>
        </div>
        <div className={'finance-health ' + (s.pnl.netProfit >= 0 ? 'positive' : 'negative')}>
          <span>Week {state.week} result</span>
          <b>{money(s.pnl.netProfit)}</b>
          <small>{s.pnl.netProfit >= 0 ? 'Net profit' : 'Net loss'}</small>
        </div>
      </div>

      <div className="finance-summary-grid">
        <SummaryCard label="Revenue" value={money(s.pnl.revenue)} formulaKey="revenue" onExplain={setFormulaKey} />
        <SummaryCard label="Gross profit" value={money(s.pnl.grossProfit)} formulaKey="grossProfit" onExplain={setFormulaKey} />
        <SummaryCard label="Gross margin" value={pct(s.pnl.grossMargin)} formulaKey="grossMargin" onExplain={setFormulaKey} />
        <SummaryCard label="Operating profit" value={money(s.pnl.operatingProfit)} formulaKey="operatingProfit" onExplain={setFormulaKey} />
        <SummaryCard label="Ending cash" value={money(s.cashFlow.endingCash)} formulaKey="cashChange" onExplain={setFormulaKey} />
        <SummaryCard label="Book equity" value={money(s.balanceSheet.bookEquity)} formulaKey="bookEquity" onExplain={setFormulaKey} />
        <SummaryCard label="Debt : equity" value={ratio(s.ratios.debtToEquity)} formulaKey="debtToEquity" onExplain={setFormulaKey} />
        <SummaryCard label="Valuation" value={money(s.ratios.valuation)} formulaKey="valuation" onExplain={setFormulaKey} />
      </div>
    </section>

    <section className="financial-grid">
      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">P&L</div><h3>Income statement</h3></div>
          <small>Week {state.week}</small>
        </div>
        <Row label="Revenue" value={money(s.pnl.revenue)} strong formulaKey="revenue" onExplain={setFormulaKey} />
        <Row label="Direct / variable costs" value={'(' + money(s.pnl.variableCosts) + ')'} formulaKey="variableCosts" onExplain={setFormulaKey} />
        <Row label="Gross profit" value={money(s.pnl.grossProfit)} strong note={'Gross margin ' + pct(s.pnl.grossMargin)} formulaKey="grossProfit" onExplain={setFormulaKey} />
        <Row label="Gross margin" value={pct(s.pnl.grossMargin)} formulaKey="grossMargin" onExplain={setFormulaKey} />
        <Row label="Fixed operating costs" value={'(' + money(s.pnl.fixedCosts) + ')'} />
        <Row label="Marketing, quality, sales & other discretionary" value={'(' + money(s.pnl.discretionaryCosts) + ')'} />
        <Row label="Payroll" value={'(' + money(s.pnl.payrollCosts) + ')'} />
        <Row label="One-time operating expenses" value={'(' + money(s.pnl.oneTimeExpenses) + ')'} />
        <Row label="Total operating expenses" value={'(' + money(s.pnl.operatingExpenses) + ')'} formulaKey="operatingExpenses" onExplain={setFormulaKey} />
        <Row label="Operating profit (EBITDA-like)" value={money(s.pnl.operatingProfit)} strong note={'Margin ' + pct(s.pnl.operatingMargin)} formulaKey="operatingProfit" onExplain={setFormulaKey} />
        <Row label="Operating margin" value={pct(s.pnl.operatingMargin)} formulaKey="operatingMargin" onExplain={setFormulaKey} />
        <Row label="Interest expense" value={'(' + money(s.pnl.interestExpense) + ')'} />
        <Row label="Legal penalty expense" value={'(' + money(s.pnl.legalPenaltyExpense) + ')'} />
        <Row label="Profit before tax" value={money(s.pnl.preTaxProfit)} formulaKey="preTaxProfit" onExplain={setFormulaKey} />
        <Row label="Tax accrued" value={'(' + money(s.pnl.taxAccrued) + ')'} formulaKey="taxAccrued" onExplain={setFormulaKey} />
        <Row label="Net profit / loss" value={money(s.pnl.netProfit)} strong formulaKey="netProfit" onExplain={setFormulaKey} />
        <Row label="Net margin" value={pct(s.pnl.netMargin)} note="Net profit as % of revenue" formulaKey="netMargin" onExplain={setFormulaKey} />
        <div className="statement-note">The game does not yet model depreciation/amortization separately, so operating profit is shown as an EBITDA-like teaching measure rather than formal reported EBITDA.</div>
      </section>

      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">Balance sheet</div><h3>Financial position</h3></div>
          <small>End of week {state.week}</small>
        </div>
        <Row label="Operating cash" value={money(s.balanceSheet.cash)} />
        <Row label="Emergency reserve" value={money(s.balanceSheet.reserveCash)} />
        <Row label="Inventory asset" value={money(s.balanceSheet.inventoryAsset)} formulaKey="inventoryAsset" onExplain={setFormulaKey} />
        <Row label="Expansion assets" value={money(s.balanceSheet.expansionAssets)} />
        <Row label="Total assets" value={money(s.balanceSheet.totalAssets)} strong formulaKey="totalAssets" onExplain={setFormulaKey} />
        <div className="statement-spacer" />
        <Row label="Debt" value={money(s.balanceSheet.debtBalance)} />
        <Row label="Tax payable" value={money(s.balanceSheet.taxPayable)} />
        <Row label="Total liabilities" value={money(s.balanceSheet.totalLiabilities)} strong formulaKey="totalLiabilities" onExplain={setFormulaKey} />
        <Row label="Book equity" value={money(s.balanceSheet.bookEquity)} strong formulaKey="bookEquity" onExplain={setFormulaKey} />
        <button className="balance-equation formula-equation-button" type="button" onClick={() => setFormulaKey('bookEquity')}>
          {money(s.balanceSheet.totalAssets)} assets = {money(s.balanceSheet.totalLiabilities)} liabilities + {money(s.balanceSheet.bookEquity)} equity
          <small>Tap to see why this equation must balance</small>
        </button>
      </section>

      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">Cash</div><h3>Weekly cash movement</h3></div>
          <small>Liquidity view</small>
        </div>
        <Row label="Previous ending cash" value={money(s.cashFlow.openingCash)} />
        <Row label="Change in operating cash" value={money(s.cashFlow.cashChange)} strong formulaKey="cashChange" onExplain={setFormulaKey} />
        <Row label="Ending operating cash" value={money(s.cashFlow.endingCash)} strong />
        <Row label="Inventory / production cash used" value={money(s.cashFlow.inventoryPurchases)} />
        <Row label="Debt service" value={money(s.cashFlow.debtService)} />
        <Row label="Tax paid in cash" value={money(s.cashFlow.taxPayment)} />
        <Row label="Protected emergency reserve" value={money(s.cashFlow.reserveCash)} />
        <Row label="Runway" value={Number.isFinite(s.ratios.runwayWeeks) ? s.ratios.runwayWeeks.toFixed(1) + ' weeks' : 'No current burn'} formulaKey="runway" onExplain={setFormulaKey} />
        <div className="statement-note">Cash movement can differ from net profit because financing, inventory purchases, loan principal, tax timing and prior-week actions affect cash differently from accounting profit.</div>
      </section>

      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">Ratios</div><h3>Decision metrics</h3></div>
          <small>Tap ? for worked examples</small>
        </div>
        <Row label="Contribution margin" value={pct(s.ratios.contributionMargin)} formulaKey="contributionMargin" onExplain={setFormulaKey} />
        <Row label="Estimated break-even revenue / week" value={Number.isFinite(s.ratios.breakEvenRevenue) ? money(s.ratios.breakEvenRevenue) : 'No finite break-even'} formulaKey="breakEvenRevenue" onExplain={setFormulaKey} />
        <Row label="Runway" value={Number.isFinite(s.ratios.runwayWeeks) ? s.ratios.runwayWeeks.toFixed(1) + ' weeks' : 'No current burn'} formulaKey="runway" onExplain={setFormulaKey} />
        <Row label="Effective CAC" value={money(s.ratios.cac)} formulaKey="cac" onExplain={setFormulaKey} />
        <Row label="Estimated LTV" value={money(s.ratios.ltv)} formulaKey="ltv" onExplain={setFormulaKey} />
        <Row label="LTV : CAC" value={ratio(s.ratios.ltvCac)} formulaKey="ltvCac" onExplain={setFormulaKey} />
        <Row label="Marketing ROAS" value={ratio(s.ratios.roas)} formulaKey="roas" onExplain={setFormulaKey} />
        <Row label="Debt : book equity" value={ratio(s.ratios.debtToEquity)} formulaKey="debtToEquity" onExplain={setFormulaKey} />
        <Row label="Annualized current revenue" value={money(s.ratios.annualizedRevenue)} formulaKey="annualizedRevenue" onExplain={setFormulaKey} />
        <Row label="Valuation : annualized revenue" value={ratio(s.ratios.valuationToRevenue)} formulaKey="valuationToRevenue" onExplain={setFormulaKey} />
      </section>
    </section>

    {history.length > 1 && <section className="charts-grid">
      <MiniChart label="Net profit / loss" values={history.map((x) => x.netProfit)} />
      <MiniChart label="Gross margin" values={history.map((x) => (x.grossMargin || 0) * 100)} />
      <MiniChart label="Cash" values={history.map((x) => x.cash)} />
    </section>}

    <section className="panel formula-library">
      <div className="section-head">
        <div>
          <div className="eyebrow">Formula library</div>
          <h2>Check any financial formula</h2>
          <p>Search for a value or ratio. Opening a formula automatically substitutes the current week's company numbers.</p>
        </div>
      </div>

      <div className="formula-library-controls">
        <input
          type="search"
          placeholder="Search: gross margin, CAC, break-even, equity…"
          value={formulaSearch}
          onChange={(e) => setFormulaSearch(e.target.value)}
        />
        <select value={formulaCategory} onChange={(e) => setFormulaCategory(e.target.value)}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      <div className="formula-card-grid">
        {visibleFormulas.map((item) => <button className="formula-card" type="button" key={item.key} onClick={() => setFormulaKey(item.key)}>
          <small>{item.category}</small>
          <strong>{item.title}</strong>
          <span>{item.formula}</span>
          <em>Show worked example →</em>
        </button>)}
      </div>

      {visibleFormulas.length === 0 && <div className="empty-state">No formula matched your search.</div>}
    </section>

    <section className="panel finance-learning-guide">
      <h3>How to read the company in 60 seconds</h3>
      <ol>
        <li><b>Revenue:</b> Is demand growing, flat or shrinking?</li>
        <li><b>Gross margin:</b> Does each sale leave enough money to fund the company?</li>
        <li><b>Operating profit:</b> Is the core business viable before interest and tax?</li>
        <li><b>Net profit:</b> Is growth actually producing an accounting return?</li>
        <li><b>Cash:</b> Can the company pay the next several weeks of obligations?</li>
        <li><b>Balance sheet:</b> What does the company own and owe?</li>
        <li><b>Unit economics:</b> Are LTV, CAC and contribution margin strong enough to scale?</li>
      </ol>
    </section>

    <FormulaExplorerModal
      formulaKey={formulaKey}
      state={state}
      industry={industry}
      catalog={formulaCatalog}
      snapshot={s}
      onClose={() => setFormulaKey(null)}
    />
  </section>;
}
