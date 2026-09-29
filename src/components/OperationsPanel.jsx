import React from 'react';

const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (n) => Math.round((n || 0) * 100) + '%';

export default function OperationsPanel({ state, industry, operationsData, onAction }) {
  const settings = state.operations.settings;
  const last = state.operations.last;
  const mode = operationsData.inventoryMode || 'physical';
  const set = (key, value) => onAction({ type: 'setOperationsSetting', key, value });

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Operations & supply chain</div>
        <h2>{industry.operationsLabel || 'Capacity, inventory and quality'}</h2>
        <p>
          {mode === 'virtual'
            ? 'This business has no physical inventory. Capacity comes from people, systems and infrastructure; outsourcing buys extra delivery capacity at a higher unit cost.'
            : mode === 'production'
              ? 'Output is produced each week before it can be sold. Production uses cash, unsold output can spoil, and outsourcing can cover shortages at a higher cost.'
              : 'Inventory is a working-capital decision: purchase orders use cash before inventory becomes cost of goods sold. Reordering too late creates stockouts; too early traps cash.'}
        </p>
      </div>
    </div>

    <div className="commercial-summary">
      {mode !== 'virtual' && <span>{industry.inventoryLabel || 'Inventory'} <b>{state.operations.inventoryUnits.toFixed(0)} {industry.unitLabel || 'units'}</b></span>}
      {mode !== 'virtual' && <span>Inventory asset <b>{money(state.finance.inventoryAsset)}</b></span>}
      <span>Capacity <b>{last.capacity.toFixed(0)} {industry.unitLabel || 'units'}/week</b></span>
      <span>Fulfillment <b>{pct(last.fulfillmentRate)}</b></span>
      <span>Quality/defect rate <b>{pct(last.defectRate)}</b></span>
      {mode === 'physical' && <span>Ordered last week <b>{last.purchaseUnits.toFixed(0)}</b></span>}
      {mode === 'production' && <span>Produced last week <b>{(last.producedUnits || 0).toFixed(0)}</b></span>}
      {mode !== 'virtual' && <span>{mode === 'production' ? 'Production cash' : 'Purchase cash'} <b>{money(last.purchaseCash)}</b></span>}
      {mode === 'physical' && <span>Pending POs <b>{state.operations.purchaseOrders.length}</b></span>}
      {mode === 'virtual' && <span>Estimated delivery cost <b>{money(last.estimatedUnitCost)}</b></span>}
    </div>

    <div className="operations-controls">
      <label>Process mode
        <select value={settings.processMode} onChange={(e) => set('processMode', e.target.value)}>
          {Object.entries(operationsData.processModes).map(([id, process]) =>
            <option value={id} key={id}>{process.label}</option>
          )}
        </select>
      </label>

      <label>{mode === 'virtual' ? 'QA / reliability spend' : 'Quality-control spend'} <b>{money(settings.qualityControlSpend)}/week</b>
        <input type="range" min="0" max={operationsData.limits.qualityControlSpendMax} step="10" value={settings.qualityControlSpend} onChange={(e) => set('qualityControlSpend', Number(e.target.value))} />
      </label>

      {mode === 'physical' && <label>Reorder point <b>{settings.reorderPoint} units</b>
        <input type="range" min="0" max={operationsData.limits.reorderPointMax} step="10" value={settings.reorderPoint} onChange={(e) => set('reorderPoint', Number(e.target.value))} />
      </label>}

      {mode === 'physical' && <label>Order quantity <b>{settings.orderQuantity} units</b>
        <input type="range" min={operationsData.limits.orderQuantityMin} max={operationsData.limits.orderQuantityMax} step="25" value={settings.orderQuantity} onChange={(e) => set('orderQuantity', Number(e.target.value))} />
      </label>}

      <label>{mode === 'virtual' ? 'Contractor / cloud outsource share' : mode === 'production' ? 'Partner-farm outsource share' : 'Outsource share'} <b>{pct(settings.outsourceShare)}</b>
        <input type="range" min="0" max={operationsData.limits.outsourceShareMax} step="0.05" value={settings.outsourceShare} onChange={(e) => set('outsourceShare', Number(e.target.value))} />
      </label>
    </div>

    <div className="operations-flags">
      {mode !== 'virtual' && <span className={last.stockoutConstrained ? 'bad-signal' : 'good-signal'}>
        {last.stockoutConstrained ? 'Available output/inventory is constraining capacity' : 'Available output supports current process capacity'}
      </span>}
      {mode === 'virtual' && <span className="good-signal">No physical stockout risk; delivery capacity is the binding resource.</span>}
      {mode !== 'virtual' && <span>Last spoilage: {last.spoilageUnits.toFixed(1)} {industry.unitLabel || 'units'}</span>}
      <span>Outsourced volume: {last.outsourcedOrders.toFixed(1)}</span>
      <span>Estimated unit cost: {money(last.estimatedUnitCost || state.operations.inventoryUnitCost)}</span>
    </div>

    <div className="phase-note">
      <b>Business lesson:</b> capacity is industry-specific. A cafe manages stock and service, software manages engineering/infrastructure capacity, and a farm manages production yield, spoilage and distribution. In every case, excess capacity costs money while insufficient capacity loses demand.
    </div>
  </section>;
}
