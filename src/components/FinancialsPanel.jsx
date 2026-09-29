import React from 'react';
import MiniChart from './MiniChart.jsx';
import { createFinancialSnapshot } from '../engine/financialEducation.js';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';
const ratio = (n) => Number.isFinite(n) ? n.toFixed(2) + 'x' : 'N/M';

function Row({ label, value, strong = false, note = '' }) {
  return <div className={'financial-row ' + (strong ? 'strong' : '')}>
    <span>{label}{note && <small>{note}</small>}</span>
    <b>{value}</b>
  </div>;
}

export default function FinancialsPanel({ state, industry }) {
  const s = createFinancialSnapshot(state, industry);
  const history = state.history;

  return <section className="financials-shell">
    <section className="panel">
      <div className="section-head">
        <div>
          <div className="eyebrow">Financial learning center</div>
          <h2>Company financial statements</h2>
          <p>These statements use the game company's actual weekly transactions. Read them together: profit tells you performance, the balance sheet tells you position, and cash movement tells you liquidity.</p>
        </div>
        <div className={'finance-health ' + (s.pnl.netProfit >= 0 ? 'positive' : 'negative')}>
          <span>Week {state.week} result</span>
          <b>{money(s.pnl.netProfit)}</b>
          <small>{s.pnl.netProfit >= 0 ? 'Net profit' : 'Net loss'}</small>
        </div>
      </div>

      <div className="finance-summary-grid">
        <span>Revenue<b>{money(s.pnl.revenue)}</b></span>
        <span>Gross profit<b>{money(s.pnl.grossProfit)}</b></span>
        <span>Gross margin<b>{pct(s.pnl.grossMargin)}</b></span>
        <span>Operating profit<b>{money(s.pnl.operatingProfit)}</b></span>
        <span>Ending cash<b>{money(s.cashFlow.endingCash)}</b></span>
        <span>Book equity<b>{money(s.balanceSheet.bookEquity)}</b></span>
        <span>Debt<b>{money(s.balanceSheet.debtBalance)}</b></span>
        <span>Valuation<b>{money(s.ratios.valuation)}</b></span>
      </div>
    </section>

    <section className="financial-grid">
      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">P&L</div><h3>Income statement</h3></div>
          <small>Week {state.week}</small>
        </div>
        <Row label="Revenue" value={money(s.pnl.revenue)} strong />
        <Row label="Direct / variable costs" value={'(' + money(s.pnl.variableCosts) + ')'} />
        <Row label="Gross profit" value={money(s.pnl.grossProfit)} strong note={'Gross margin ' + pct(s.pnl.grossMargin)} />
        <Row label="Fixed operating costs" value={'(' + money(s.pnl.fixedCosts) + ')'} />
        <Row label="Marketing, quality, sales & other discretionary" value={'(' + money(s.pnl.discretionaryCosts) + ')'} />
        <Row label="Payroll" value={'(' + money(s.pnl.payrollCosts) + ')'} />
        <Row label="One-time operating expenses" value={'(' + money(s.pnl.oneTimeExpenses) + ')'} />
        <Row label="Operating profit (EBITDA-like)" value={money(s.pnl.operatingProfit)} strong note={'Margin ' + pct(s.pnl.operatingMargin)} />
        <Row label="Interest expense" value={'(' + money(s.pnl.interestExpense) + ')'} />
        <Row label="Legal penalty expense" value={'(' + money(s.pnl.legalPenaltyExpense) + ')'} />
        <Row label="Profit before tax" value={money(s.pnl.preTaxProfit)} />
        <Row label="Tax accrued" value={'(' + money(s.pnl.taxAccrued) + ')'} />
        <Row label="Net profit / loss" value={money(s.pnl.netProfit)} strong note={'Net margin ' + pct(s.pnl.netMargin)} />
        <div className="statement-note">The game does not yet model depreciation/amortization separately, so operating profit is shown as an EBITDA-like teaching measure rather than formal reported EBITDA.</div>
      </section>

      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">Balance sheet</div><h3>Financial position</h3></div>
          <small>End of week {state.week}</small>
        </div>
        <Row label="Operating cash" value={money(s.balanceSheet.cash)} />
        <Row label="Emergency reserve" value={money(s.balanceSheet.reserveCash)} />
        <Row label="Inventory asset" value={money(s.balanceSheet.inventoryAsset)} />
        <Row label="Expansion assets" value={money(s.balanceSheet.expansionAssets)} />
        <Row label="Total assets" value={money(s.balanceSheet.totalAssets)} strong />
        <div className="statement-spacer" />
        <Row label="Debt" value={money(s.balanceSheet.debtBalance)} />
        <Row label="Tax payable" value={money(s.balanceSheet.taxPayable)} />
        <Row label="Total liabilities" value={money(s.balanceSheet.totalLiabilities)} strong />
        <Row label="Book equity" value={money(s.balanceSheet.bookEquity)} strong />
        <div className="balance-equation">
          {money(s.balanceSheet.totalAssets)} assets = {money(s.balanceSheet.totalLiabilities)} liabilities + {money(s.balanceSheet.bookEquity)} equity
        </div>
      </section>

      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">Cash</div><h3>Weekly cash movement</h3></div>
          <small>Liquidity view</small>
        </div>
        <Row label="Previous ending cash" value={money(s.cashFlow.openingCash)} />
        <Row label="Change in operating cash" value={money(s.cashFlow.cashChange)} strong />
        <Row label="Ending operating cash" value={money(s.cashFlow.endingCash)} strong />
        <Row label="Inventory / production cash used" value={money(s.cashFlow.inventoryPurchases)} />
        <Row label="Debt service" value={money(s.cashFlow.debtService)} />
        <Row label="Tax paid in cash" value={money(s.cashFlow.taxPayment)} />
        <Row label="Protected emergency reserve" value={money(s.cashFlow.reserveCash)} />
        <div className="statement-note">Cash movement can differ from net profit because financing, inventory purchases, loan principal, tax timing and prior-week actions affect cash differently from accounting profit.</div>
      </section>

      <section className="panel financial-statement">
        <div className="statement-title">
          <div><div className="eyebrow">Ratios</div><h3>Decision metrics</h3></div>
          <small>Interpret, don't memorize</small>
        </div>
        <Row label="Contribution margin" value={pct(s.ratios.contributionMargin)} />
        <Row label="Estimated break-even revenue / week" value={Number.isFinite(s.ratios.breakEvenRevenue) ? money(s.ratios.breakEvenRevenue) : 'No finite break-even'} />
        <Row label="Runway" value={Number.isFinite(s.ratios.runwayWeeks) ? s.ratios.runwayWeeks.toFixed(1) + ' weeks' : 'No current burn'} />
        <Row label="Effective CAC" value={money(s.ratios.cac)} />
        <Row label="Estimated LTV" value={money(s.ratios.ltv)} />
        <Row label="LTV : CAC" value={ratio(s.ratios.ltvCac)} />
        <Row label="Debt : book equity" value={ratio(s.ratios.debtToEquity)} />
        <Row label="Annualized current revenue" value={money(s.ratios.annualizedRevenue)} />
        <Row label="Valuation : annualized revenue" value={ratio(s.ratios.valuationToRevenue)} />
      </section>
    </section>

    {history.length > 1 && <section className="charts-grid">
      <MiniChart label="Net profit / loss" values={history.map((x) => x.netProfit)} />
      <MiniChart label="Gross margin" values={history.map((x) => (x.grossMargin || 0) * 100)} />
      <MiniChart label="Cash" values={history.map((x) => x.cash)} />
    </section>}

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
  </section>;
}
