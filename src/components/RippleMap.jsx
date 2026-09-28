export default function RippleMap({ ripple }) {
  if (!ripple) return null;
  return <section className="panel ripple">
    <div className="eyebrow">Decision ripple map</div>
    <h2>{ripple.title}</h2>
    <div className="ripple-flow">
      {ripple.nodes.map((node, index) => <div className="ripple-node-wrap" key={node}>
        <span className="ripple-node">{node}</span>
        {index < ripple.nodes.length - 1 && <span className="ripple-arrow">→</span>}
      </div>)}
    </div>
  </section>;
}
