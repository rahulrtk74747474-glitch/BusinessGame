import { clamp } from './random.js';

function modeOf(operationsData) {
  return operationsData.inventoryMode || 'physical';
}

export function createOperationsState(industry, operationsData) {
  const mode = modeOf(operationsData);
  return {
    settings: { ...operationsData.defaults },
    inventoryUnits: mode === 'virtual' ? 0 : operationsData.initialInventoryUnits,
    inventoryUnitCost: industry.baseVariableCostPerOrder,
    purchaseOrders: [],
    nextPurchaseOrderId: 1,
    last: {
      inventoryMode: mode,
      receivedUnits: 0,
      producedUnits: 0,
      purchaseUnits: 0,
      purchaseCash: 0,
      endingInventory: mode === 'virtual' ? 0 : operationsData.initialInventoryUnits,
      spoilageUnits: 0,
      outsourcedOrders: 0,
      internalOrders: 0,
      cogs: 0,
      capacity: industry.capacityOrdersPerWeek,
      processCapacity: industry.capacityOrdersPerWeek,
      stockoutConstrained: false,
      defectRate: operationsData.qualityControl.baseDefectRate,
      fulfillmentRate: 1,
      reliabilitySignal: 1,
      weeklyFixedCost: operationsData.processModes[operationsData.defaults.processMode].weeklyFixedCost,
      estimatedUnitCost: industry.baseVariableCostPerOrder
    },
    lastRipple: null
  };
}

export function applyOperationsAction(state, action, operationsData) {
  if (state.status !== 'running') return state;
  if (action.type !== 'setOperationsSetting') return state;

  const settings = { ...state.operations.settings };
  if (action.key === 'processMode' && operationsData.processModes[action.value]) {
    settings.processMode = action.value;
  } else if (action.key === 'qualityControlSpend') {
    settings.qualityControlSpend = clamp(Number(action.value) || 0, 0, operationsData.limits.qualityControlSpendMax);
  } else if (action.key === 'reorderPoint' && modeOf(operationsData) === 'physical') {
    settings.reorderPoint = clamp(Number(action.value) || 0, 0, operationsData.limits.reorderPointMax);
  } else if (action.key === 'orderQuantity' && modeOf(operationsData) === 'physical') {
    settings.orderQuantity = clamp(
      Number(action.value) || operationsData.limits.orderQuantityMin,
      operationsData.limits.orderQuantityMin,
      operationsData.limits.orderQuantityMax
    );
  } else if (action.key === 'outsourceShare') {
    settings.outsourceShare = clamp(Number(action.value) || 0, 0, operationsData.limits.outsourceShareMax);
  } else {
    return state;
  }

  return {
    ...state,
    operations: {
      ...state.operations,
      settings,
      lastRipple: {
        title: 'Operations policy changed',
        nodes: [
          'Operations: capacity, inventory/production or quality changes',
          'Finance: working capital and cost structure change',
          'Customers: fulfillment and service quality change',
          'Sales: delivery reliability changes'
        ]
      }
    }
  };
}

export function stepOperationsPre(state, industry, operationsData, locationConfig, teamEffects, rng, expansionEffects = {}) {
  const mode = modeOf(operationsData);
  const currentWeek = state.week + 1;
  const settings = state.operations.settings;
  const process = operationsData.processModes[settings.processMode];
  let inventoryUnits = mode === 'virtual' ? 0 : state.operations.inventoryUnits;
  let inventoryUnitCost = state.operations.inventoryUnitCost;
  const pending = [];
  let receivedUnits = 0;
  let producedUnits = 0;
  let lateOrders = 0;

  const contracts = state.negotiation?.contracts || {};
  const supplierContractActive =
    (contracts.supplierRemainingWeeks || 0) > 0 &&
    Number.isFinite(contracts.supplierUnitCost);
  const supplierUnitCost = supplierContractActive
    ? contracts.supplierUnitCost
    : industry.baseVariableCostPerOrder;

  if (mode === 'physical') {
    for (const po of state.operations.purchaseOrders) {
      if (po.arrivalWeek > currentWeek) {
        pending.push(po);
        continue;
      }

      if (rng.uniform() <= operationsData.supplier.baseReliability) {
        const totalExistingCost = inventoryUnits * inventoryUnitCost;
        const receivedCost = po.quantity * po.unitCost;
        inventoryUnits += po.quantity;
        inventoryUnitCost = inventoryUnits > 0
          ? (totalExistingCost + receivedCost) / inventoryUnits
          : po.unitCost;
        receivedUnits += po.quantity;
      } else {
        lateOrders += 1;
        pending.push({
          ...po,
          arrivalWeek: currentWeek + operationsData.supplier.lateDelayWeeks
        });
      }
    }
  }

  const operationsEfficiency = 1 + (teamEffects.operationsEfficiencyAdd || 0);
  const processCapacity =
    (industry.capacityOrdersPerWeek * locationConfig.capacityMultiplier +
      (teamEffects.capacityAdd || 0) +
      (expansionEffects.capacityAdd || 0)) *
    process.capacityMultiplier *
    operationsEfficiency;

  let purchaseUnits = 0;
  let purchaseCash = 0;
  let nextPurchaseOrderId = state.operations.nextPurchaseOrderId;
  let spoilageUnits = 0;

  if (mode === 'production') {
    const productionCfg = operationsData.production;
    const productionNoise = clamp(rng.normal(1, productionCfg.variabilityStd || 0), 0.78, 1.2);
    producedUnits = Math.max(
      0,
      Math.min(
        processCapacity,
        productionCfg.weeklyUnits * process.capacityMultiplier * operationsEfficiency * productionNoise
      )
    );
    const totalExistingCost = inventoryUnits * inventoryUnitCost;
    const productionUnitCost = supplierContractActive
      ? supplierUnitCost
      : (productionCfg.cashCostPerUnit || industry.baseVariableCostPerOrder);
    const producedCost = producedUnits * productionUnitCost;
    inventoryUnits += producedUnits;
    inventoryUnitCost = inventoryUnits > 0
      ? (totalExistingCost + producedCost) / inventoryUnits
      : productionUnitCost;
    purchaseUnits = producedUnits;
    purchaseCash = producedCost;
  }

  if (mode !== 'virtual') {
    spoilageUnits = Math.min(
      inventoryUnits,
      inventoryUnits * operationsData.inventory.spoilageRatePerWeek * process.wasteMultiplier
    );
    inventoryUnits = Math.max(0, inventoryUnits - spoilageUnits);
  }

  if (mode === 'physical') {
    const lastOrders = state.history.at(-1)?.orders || industry.initialCustomers * industry.purchaseFrequency;
    const forecastDemand =
      lastOrders * operationsData.inventory.forecastDemandWeight +
      industry.initialCustomers * industry.purchaseFrequency * (1 - operationsData.inventory.forecastDemandWeight);
    const projectedInventory = inventoryUnits - forecastDemand;
    const onOrderUnits = pending.reduce((sum, po) => sum + po.quantity, 0);

    if (projectedInventory + onOrderUnits <= settings.reorderPoint) {
      purchaseUnits = settings.orderQuantity;
      purchaseCash =
        purchaseUnits * supplierUnitCost +
        operationsData.supplier.orderAdminCost;
      pending.push({
        id: nextPurchaseOrderId,
        quantity: purchaseUnits,
        unitCost: supplierUnitCost,
        arrivalWeek: currentWeek + operationsData.supplier.baseLeadTimeWeeks
      });
      nextPurchaseOrderId += 1;
    }
  }

  const outsourceCapacity = settings.outsourceShare * operationsData.outsource.capacityPerShare;
  const inventorySupportedCapacity =
    mode === 'virtual'
      ? processCapacity + outsourceCapacity
      : inventoryUnits + outsourceCapacity;
  const capacity = Math.max(
    0,
    mode === 'virtual'
      ? processCapacity + outsourceCapacity
      : Math.min(processCapacity + outsourceCapacity, inventorySupportedCapacity)
  );

  const qcReduction = Math.min(
    operationsData.qualityControl.maxDefectReduction,
    settings.qualityControlSpend /
      (operationsData.qualityControl.spendScale + settings.qualityControlSpend)
  );
  const defectRate = clamp(
    operationsData.qualityControl.baseDefectRate *
      (1 - qcReduction) /
      Math.max(0.75, operationsEfficiency),
    0.005,
    0.2
  );
  const serviceAdd =
    process.serviceAdd -
    settings.outsourceShare * operationsData.outsource.servicePenaltyPerShare -
    defectRate * operationsData.qualityControl.satisfactionPenaltyPerDefectRate;

  const estimatedUnitCost =
    (mode === 'virtual' ? supplierUnitCost : inventoryUnitCost) * (1 - settings.outsourceShare) +
    supplierUnitCost *
      (1 + operationsData.outsource.unitCostMarkup) *
      settings.outsourceShare;

  const reliabilitySignal = clamp(
    operationsData.supplier.baseReliability -
      lateOrders * 0.1 -
      (mode !== 'virtual' && inventorySupportedCapacity < processCapacity ? 0.08 : 0),
    0.55,
    1.05
  );

  return {
    inventoryMode: mode,
    inventoryUnits,
    inventoryUnitCost,
    purchaseOrders: pending,
    nextPurchaseOrderId,
    receivedUnits,
    producedUnits,
    spoilageUnits,
    purchaseUnits,
    purchaseCash,
    supplierUnitCost,
    supplierContractActive,
    processCapacity,
    outsourceCapacity,
    capacity,
    defectRate,
    serviceAdd,
    estimatedUnitCost,
    reliabilitySignal,
    weeklyFixedCost: process.weeklyFixedCost + settings.qualityControlSpend,
    stockoutConstrained: mode === 'virtual' ? false : inventorySupportedCapacity < processCapacity
  };
}

export function stepOperationsPost(state, customers, operationsData, pre) {
  const outsourceShare = state.operations.settings.outsourceShare;
  const maxOutsourced = pre.outsourceCapacity;
  const outsourcedOrders = Math.min(customers.orders * outsourceShare, maxOutsourced);
  const internalOrders = Math.max(0, customers.orders - outsourcedOrders);

  const endingInventory = pre.inventoryMode === 'virtual'
    ? 0
    : Math.max(0, pre.inventoryUnits - internalOrders);

  const internalUnitCost = pre.inventoryMode === 'virtual'
    ? pre.supplierUnitCost
    : pre.inventoryUnitCost;
  const internalCogs = internalOrders * internalUnitCost;
  const outsourcedCogs =
    outsourcedOrders *
    pre.supplierUnitCost *
    (1 + operationsData.outsource.unitCostMarkup);
  const cogs = internalCogs + outsourcedCogs;
  const fulfillmentRate =
    customers.orders + customers.lostOrders > 0
      ? customers.orders / (customers.orders + customers.lostOrders)
      : 1;

  return {
    ...state.operations,
    inventoryUnits: endingInventory,
    inventoryUnitCost: internalUnitCost,
    purchaseOrders: pre.purchaseOrders,
    nextPurchaseOrderId: pre.nextPurchaseOrderId,
    last: {
      inventoryMode: pre.inventoryMode,
      receivedUnits: pre.receivedUnits,
      producedUnits: pre.producedUnits,
      purchaseUnits: pre.purchaseUnits,
      purchaseCash: pre.purchaseCash,
      endingInventory,
      spoilageUnits: pre.spoilageUnits,
      outsourcedOrders,
      internalOrders,
      cogs,
      capacity: pre.capacity,
      processCapacity: pre.processCapacity,
      stockoutConstrained: pre.stockoutConstrained,
      defectRate: pre.defectRate,
      fulfillmentRate,
      reliabilitySignal: pre.reliabilitySignal,
      weeklyFixedCost: pre.weeklyFixedCost,
      estimatedUnitCost: pre.estimatedUnitCost,
      supplierContractActive: pre.supplierContractActive,
      supplierUnitCost: pre.supplierUnitCost
    }
  };
}
