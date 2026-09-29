import { clamp } from './random.js';

export function createOperationsState(industry, operationsData) {
  return {
    settings: { ...operationsData.defaults },
    inventoryUnits: operationsData.initialInventoryUnits,
    inventoryUnitCost: industry.baseVariableCostPerOrder,
    purchaseOrders: [],
    nextPurchaseOrderId: 1,
    last: {
      receivedUnits: 0,
      purchaseUnits: 0,
      purchaseCash: 0,
      endingInventory: operationsData.initialInventoryUnits,
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
      weeklyFixedCost: operationsData.processModes[operationsData.defaults.processMode].weeklyFixedCost
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
  } else if (action.key === 'reorderPoint') {
    settings.reorderPoint = clamp(Number(action.value) || 0, 0, operationsData.limits.reorderPointMax);
  } else if (action.key === 'orderQuantity') {
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
          'Operations: capacity, inventory or quality changes',
          'Finance: working capital and cost structure change',
          'Customers: fulfillment and service quality change',
          'Sales: delivery reliability changes'
        ]
      }
    }
  };
}

export function stepOperationsPre(state, industry, operationsData, locationConfig, teamEffects, rng) {
  const currentWeek = state.week + 1;
  const settings = state.operations.settings;
  const process = operationsData.processModes[settings.processMode];
  let inventoryUnits = state.operations.inventoryUnits;
  let inventoryUnitCost = state.operations.inventoryUnitCost;
  const pending = [];
  let receivedUnits = 0;
  let lateOrders = 0;

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

  const spoilageUnits = Math.min(
    inventoryUnits,
    inventoryUnits * operationsData.inventory.spoilageRatePerWeek * process.wasteMultiplier
  );
  inventoryUnits = Math.max(0, inventoryUnits - spoilageUnits);

  const contracts = state.negotiation?.contracts || {};
  const supplierContractActive =
    (contracts.supplierRemainingWeeks || 0) > 0 &&
    Number.isFinite(contracts.supplierUnitCost);
  const supplierUnitCost = supplierContractActive
    ? contracts.supplierUnitCost
    : industry.baseVariableCostPerOrder;

  const lastOrders = state.history.at(-1)?.orders || industry.initialCustomers * industry.purchaseFrequency;
  const forecastDemand =
    lastOrders * operationsData.inventory.forecastDemandWeight +
    industry.initialCustomers * industry.purchaseFrequency * (1 - operationsData.inventory.forecastDemandWeight);
  const projectedInventory = inventoryUnits - forecastDemand;
  const onOrderUnits = pending.reduce((sum, po) => sum + po.quantity, 0);

  let purchaseUnits = 0;
  let purchaseCash = 0;
  let nextPurchaseOrderId = state.operations.nextPurchaseOrderId;

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

  const operationsEfficiency = 1 + (teamEffects.operationsEfficiencyAdd || 0);
  const processCapacity =
    (industry.capacityOrdersPerWeek * locationConfig.capacityMultiplier +
      (teamEffects.capacityAdd || 0)) *
    process.capacityMultiplier *
    operationsEfficiency;

  const outsourceCapacity =
    settings.outsourceShare * operationsData.outsource.capacityPerShare;
  const inventorySupportedCapacity = inventoryUnits + outsourceCapacity;
  const capacity = Math.max(0, Math.min(processCapacity + outsourceCapacity, inventorySupportedCapacity));

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
    inventoryUnitCost * (1 - settings.outsourceShare) +
    supplierUnitCost *
      (1 + operationsData.outsource.unitCostMarkup) *
      settings.outsourceShare;

  const reliabilitySignal = clamp(
    operationsData.supplier.baseReliability -
      lateOrders * 0.1 -
      (projectedInventory < 0 ? 0.08 : 0),
    0.55,
    1.05
  );

  return {
    inventoryUnits,
    inventoryUnitCost,
    purchaseOrders: pending,
    nextPurchaseOrderId,
    receivedUnits,
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
    stockoutConstrained: inventorySupportedCapacity < processCapacity
  };
}

export function stepOperationsPost(state, customers, operationsData, pre) {
  const outsourceShare = state.operations.settings.outsourceShare;
  const maxOutsourced = pre.outsourceCapacity;
  const outsourcedOrders = Math.min(customers.orders * outsourceShare, maxOutsourced);
  const internalOrders = Math.max(0, customers.orders - outsourcedOrders);
  const endingInventory = Math.max(0, pre.inventoryUnits - internalOrders);

  const internalCogs = internalOrders * pre.inventoryUnitCost;
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
    inventoryUnitCost: pre.inventoryUnitCost,
    purchaseOrders: pre.purchaseOrders,
    nextPurchaseOrderId: pre.nextPurchaseOrderId,
    last: {
      receivedUnits: pre.receivedUnits,
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
