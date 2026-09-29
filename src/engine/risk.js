import { clamp } from './random.js';

export function createRiskState() {
  return {
    activePolicies: [],
    controls: [],
    reserveCash: 0,
    pendingExpenseRecognition: 0,
    last: {
      riskScore: 0.5,
      weeklyPremiums: 0,
      controlReduction: 0,
      legalMitigation: 0,
      propertyMitigation: 0,
      cyberMitigation: 0
    },
    lastRipple: null
  };
}

export function applyRiskAction(state, action, data) {
  if (state.status !== 'running') return state;

  if (action.type === 'buyPolicy') {
    const policy = data.policies[action.policyId];
    if (!policy || state.risk.activePolicies.includes(action.policyId)) return state;
    if (state.finance.cash < policy.setupFee) return state;
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash - policy.setupFee },
      risk: {
        ...state.risk,
        activePolicies: [...state.risk.activePolicies, action.policyId],
        pendingExpenseRecognition: state.risk.pendingExpenseRecognition + policy.setupFee,
        lastRipple: {
          title: policy.label + ' purchased',
          nodes: ['Risk: loss severity falls', 'Finance: recurring premiums rise', 'Funding: risk profile can improve']
        }
      }
    };
  }

  if (action.type === 'cancelPolicy') {
    if (!state.risk.activePolicies.includes(action.policyId)) return state;
    return {
      ...state,
      risk: {
        ...state.risk,
        activePolicies: state.risk.activePolicies.filter((id) => id !== action.policyId),
        lastRipple: {
          title: 'Insurance cancelled',
          nodes: ['Finance: premiums fall', 'Risk: uninsured loss exposure rises']
        }
      }
    };
  }

  if (action.type === 'implementControl') {
    const control = data.controls[action.controlId];
    if (!control || state.risk.controls.includes(action.controlId)) return state;
    if (state.finance.cash < control.cost) return state;
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash - control.cost },
      risk: {
        ...state.risk,
        controls: [...state.risk.controls, action.controlId],
        pendingExpenseRecognition: state.risk.pendingExpenseRecognition + control.cost,
        lastRipple: {
          title: control.label + ' implemented',
          nodes: ['Risk: preventable exposure falls', 'Finance: cash spent now', 'Operations: resilience improves']
        }
      }
    };
  }

  if (action.type === 'moveToReserve') {
    const amount = Math.max(0, Math.min(Number(action.amount) || 0, state.finance.cash));
    if (amount < data.reserve.minimumTransfer) return state;
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash - amount },
      risk: {
        ...state.risk,
        reserveCash: state.risk.reserveCash + amount,
        lastRipple: {
          title: 'Emergency reserve increased',
          nodes: ['Liquidity: operating cash falls', 'Risk: protected reserve rises', 'Runway: emergency resilience improves']
        }
      }
    };
  }

  if (action.type === 'releaseReserve') {
    const amount = Math.max(0, Math.min(Number(action.amount) || 0, state.risk.reserveCash));
    if (amount <= 0) return state;
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash + amount },
      risk: {
        ...state.risk,
        reserveCash: state.risk.reserveCash - amount,
        lastRipple: {
          title: 'Emergency reserve released',
          nodes: ['Liquidity: operating cash rises', 'Risk: emergency cushion falls']
        }
      }
    };
  }

  return state;
}

export function stepRisk(state, data) {
  let weeklyPremiums = 0;
  let legalMitigation = 0;
  let propertyMitigation = 0;
  let cyberMitigation = 0;

  for (const policyId of state.risk.activePolicies) {
    const policy = data.policies[policyId];
    if (!policy) continue;
    weeklyPremiums += policy.weeklyPremium;
    legalMitigation = Math.max(legalMitigation, policy.legalMitigation || 0);
    propertyMitigation = Math.max(propertyMitigation, policy.propertyMitigation || 0);
    cyberMitigation = Math.max(cyberMitigation, policy.cyberMitigation || 0);
  }

  const controlReduction = clamp(
    state.risk.controls.reduce((sum, controlId) => sum + (data.controls[controlId]?.riskReduction || 0), 0),
    0,
    0.45
  );

  const legalRisk = state.legal?.legalRisk ?? state.hr?.legalRisk ?? 0;
  const burnout = state.hr?.averageBurnout || 0;
  const supplierRisk = 1 - (state.operations?.last?.reliabilitySignal || 1);
  const cashRisk = Number.isFinite(state.finance?.runwayWeeks)
    ? clamp((8 - state.finance.runwayWeeks) / 8, 0, 1)
    : 0;
  const competition = state.competitors?.last?.pressureIndex || 0;

  const raw =
    legalRisk * data.weights.legal +
    burnout * data.weights.burnout +
    supplierRisk * data.weights.supplier +
    cashRisk * data.weights.cash +
    competition * data.weights.competition;

  const reserveReference = Math.max(1, (state.finance?.fixedCosts || 1000) * data.reserve.recommendedWeeksOfFixedCost);
  const reserveReduction = clamp(state.risk.reserveCash / reserveReference, 0, 1) * 0.12;

  const riskScore = clamp(raw - controlReduction - reserveReduction, data.riskMin, data.riskMax);

  return {
    state: {
      ...state.risk,
      pendingExpenseRecognition: 0,
      last: {
        riskScore,
        weeklyPremiums,
        controlReduction,
        legalMitigation,
        propertyMitigation,
        cyberMitigation
      }
    },
    weeklyPremiums,
    riskScore,
    coverage: { legalMitigation, propertyMitigation, cyberMitigation }
  };
}
