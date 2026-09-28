const money = (n) => `$${Math.round(n).toLocaleString()}`;
export default function MonthlyReport({ report }) {
  if (!report) return null;
  return <section className="panel report">
    <div className="section-head"><div><div className="eyebrow">4-week management report</div><h2>Week {report.week}</h2></div></div>
    <div className="report-stats"><span>Revenue <b>{money(report.revenue)}</b></span><span>Net profit <b>{money(report.netProfit)}</b></span><span>Ending cash <b>{money(report.endingCash)}</b></span><span>Avg orders <b>{report.averageOrders.toFixed(0)}</b></span></div>
    <h3>Why the numbers changed</h3>
    <ol>{report.explanations.map((x) => <li key={x}>{x}</li>)}</ol>
  </section>;
}
