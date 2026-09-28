export default function MiniChart({ values = [], label }) {
  const width = 420, height = 130, pad = 10;
  if (!values.length) return <div className="chart-empty">No history yet</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return <div className="mini-chart"><div className="chart-label">{label}</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}><polyline fill="none" stroke="currentColor" strokeWidth="3" points={points} /></svg><div className="chart-scale"><span>{Math.round(min).toLocaleString()}</span><span>{Math.round(max).toLocaleString()}</span></div></div>;
}
