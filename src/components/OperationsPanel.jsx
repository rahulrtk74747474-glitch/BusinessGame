import React from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString();
const pct = (n) => Math.round((n || 0) * 100) + '%';

export default function OperationsPanel({ state, operationsData, onAction }) {
  const settings = state.operations.settings;
  const last = state.operations.last;
  const set = (key, value) => onAction({ type: 'setOperationsSetting', key, value });

  return <section className="panel">
    <div className="section-head">
      <div>
        <div className="eyebrow">Phase 4 · Operations & supply chain</div>
        <h2>Capacity, inventory and quality</h2>
        <p>Inventory is now a working-capital decision: purchase orders use cash before the inventory becomes cost of goods sold. Reordering too late creates stockouts; too early traps cash.</p>
      </div>
    </div>

    <div className="commercial-summary">
      <span>Inventory <b>{state.operations.inventoryUnits.toFixed(0)} units</b></span>
      <span>Inventory asset <b>{money(state.finance.inventoryAsset)}</b></span>
      <span>Capacity <b>{last.capacity.toFixed(0)}/week</b></span>
      <span>Fulfillment <b>{pct(last.fulfillmentRate)}</b></span>
      <span>Defect rate <b>{pct(last.defectRate)}</b></span>
      <span>Ordered last week <b>{last.purchaseUnits.toFixed(0)}</b></span>
      <span>Purchase cash <b>{money(last.purchaseCash)}</b></span>
      <span>Pending POs <b>{state.operations.purchaseOrders.length}</b></span>
    </div>

    <div className="operations-controls">
      <label>Process mode
        <select value={settings.processMode} onChange={(e) => set('processMode', e.target.value)}>
          {Object.entries(operationsData.processModes).map(([id, mode]) =>
            <option value={id} key={id}>{mode.label}</option>
          )}
        </select>
      </label>

      <label>Quality-control spend <b>{money(settings.qualityControlSpend)}/week</b>
        <input type="range" min="0" max={operationsData.limits.qualityControlSpendMax} step="10" value={settings.qualityControlSpend} onChange={(e) => set('qualityControlSpend', Number(e.target.value))} />
      </label>

      <label>Reorder point <b>{settings.reorderPoint} units</b>
        <input type="range" min="0" max={operationsData.limits.reorderPointMax} step="10" value={settings.reorderPoint} onChange={(e) => set('reorderPoint', Number(e.target.value))} />
      </label>

      <label>Order quantity <b>{settings.orderQuantity} units</b>
        <input type="range" min={operationsData.limits.orderQuantityMin} max={operationsData.limits.orderQuantityMax} step="25" value={settings.orderQuantity} onChange={(e) => set('orderQuantity', Number(e.target.value))} />
      </label>

      <label>Outsource share <b>{pct(settings.outsourceShare)}</b>
        <input type="range" min="0" max={operationsData.limits.outsourceShareMax} step="0.05" value={settings.outsourceShare} onChange={(e) => set('outsourceShare', Number(e.target.value))} />
      </label>
    </div>

    <div className="operations-flags">
      <span className={last.stockoutConstrained ? 'bad-signal' : 'good-signal'}>
        {last.stockoutConstrained ? 'Inventory is constraining capacity' : 'Inventory supports current process capacity'}
      </span>
      <span>Last spoilage: {last.spoilageUnits.toFixed(1)} units</span>
      <span>Outsourced orders: {last.outsourcedOrders.toFixed(1)}</span>
      <span>Estimated unit cost: {money(last.estimatedUnitCost || state.operations.inventoryUnitCost)}</span>
    </div>

    <div className="phase-note">
      <b>Business lesson:</b> lean operations reduce waste, service-first processes can improve customer experience, and outsourcing buys flexibility at a higher unit cost. The best choice depends on demand, cash and service expectations.
    </div>
  </section>;
}
