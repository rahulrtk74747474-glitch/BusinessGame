import { clamp } from './random.js';

export function createLegalState(data) {
  const items = {};
  for (const id of Object.keys(data.items)) {
    items[id] = {
      status: 'missing',
      processingWeeks: 0,
      activeUntilWeek: null,
      lastCompletedWeek: null
    };
  }

  return {
    registrationComplete: data.initialRegistrationComplete,
    items,
    complianceScore: data.initialRegistrationComplete ? 0.25 : 0,
    legalRisk: 0.35,
    shutdownWeeks: 0,
    pendingExpenseRecognition: 0,
    lastEvents: [],
    lastRipple: null
  };
}

function itemTriggered(state, item) {
  if (item.trigger === 'employees') return state.hr?.employees?.length > 0;
  return true;
}

function requiredItems(state, data) {
  return Object.entries(data.items)
    .filter(([, item]) => item.required && itemTriggered(state, item));
}

export function legalReadiness(state, data) {
  const required = requiredItems(state, data);
  if (!required.length) return { score: 1, missing: [] };

  let totalWeight = 0;
  let activeWeight = 0;
  const missing = [];

  for (const [id, item] of required) {
    totalWeight += item.weight;
    const status = state.legal.items[id]?.status;
    if (status === 'active') activeWeight += item.weight;
    else missing.push(id);
  }

  return {
    score: totalWeight > 0 ? activeWeight / totalWeight : 1,
    missing
  };
}

export function applyLegalAction(state, action, data) {
  if (state.status !== 'running' || action.type !== 'startCompliance') return state;
  const item = data.items[action.itemId];
  const current = state.legal.items[action.itemId];
  if (!item || !current || current.status === 'processing' || current.status === 'active') return state;
  if (state.finance.cash < item.cost) return state;

  return {
    ...state,
    finance: { ...state.finance, cash: state.finance.cash - item.cost },
    legal: {
      ...state.legal,
      items: {
        ...state.legal.items,
        [action.itemId]: {
          ...current,
          status: 'processing',
          processingWeeks: item.processingWeeks
        }
      },
      pendingExpenseRecognition: state.legal.pendingExpenseRecognition + item.cost,
      lastRipple: {
        title: item.label + ' started',
        nodes: ['Legal: compliance gap begins closing', 'Finance: professional/filing cost paid', 'Risk: future enforcement exposure can fall']
      }
    }
  };
}

export function stepLegal(state, data, riskStep, rng) {
  const currentWeek = state.week + 1;
  const items = {};
  const events = [];
  let penaltyCash = 0;
  let penaltyExpense = 0;
  let newShutdownWeeks = Math.max(0, (state.legal.shutdownWeeks || 0) - 1);

  for (const [id, current] of Object.entries(state.legal.items)) {
    const item = data.items[id];
    let next = { ...current };

    if (current.status === 'processing') {
      const remaining = current.processingWeeks - 1;
      if (remaining <= 0) {
        next = {
          ...current,
          status: 'active',
          processingWeeks: 0,
          lastCompletedWeek: currentWeek,
          activeUntilWeek: currentWeek + item.renewalWeeks
        };
        events.push({
          category: 'legal',
          type: 'compliance-complete',
          message: item.label + ' is now active.',
          avoidable: false
        });
      } else {
        next.processingWeeks = remaining;
      }
    } else if (
      current.status === 'active' &&
      Number.isFinite(current.activeUntilWeek) &&
      currentWeek >= current.activeUntilWeek
    ) {
      next = {
        ...current,
        status: 'expired',
        activeUntilWeek: null
      };
      events.push({
        category: 'legal',
        type: 'compliance-expired',
        message: item.label + ' expired and must be renewed.',
        avoidable: true,
        causeChain: ['Renewal deadline reached at week ' + currentWeek]
      });
    }

    items[id] = next;
  }

  const legalDraft = {
    ...state.legal,
    items,
    shutdownWeeks: newShutdownWeeks
  };
  const readiness = legalReadiness({ ...state, legal: legalDraft }, data);
  const hrRisk = state.hr?.legalRisk || 0;
  const legalRisk = clamp(
    (1 - readiness.score) * 0.72 + hrRisk * data.hrLegalRiskWeight,
    0,
    1
  );

  const overdue = requiredItems({ ...state, legal: legalDraft }, data)
    .filter(([id, item]) => {
      const current = items[id];
      if (current?.status === 'active' || current?.status === 'processing') return false;
      if (item.trigger === 'employees' && state.hr.employees.length > 0) {
        const firstHireWeek = Math.min(...state.hr.employees.map((employee) => employee.hireWeek));
        return currentWeek >= firstHireWeek + item.dueWeek;
      }
      return currentWeek >= item.dueWeek;
    });

  if (overdue.length) {
    const [id, item] = overdue[Math.floor(rng.range(0, overdue.length))];
    const chance = clamp(
      data.enforcementBaseChance + legalRisk * data.enforcementRiskWeight,
      0,
      0.35
    );

    if (rng.uniform() < chance) {
      const mitigation = riskStep?.coverage?.legalMitigation || 0;
      const fine = Math.round(item.fine * (1 - mitigation));
      penaltyCash += fine;
      penaltyExpense += fine;
      newShutdownWeeks = Math.max(newShutdownWeeks, item.shutdownWeeks || 0);
      events.push({
        category: 'legal',
        type: 'enforcement',
        message: item.label + ' non-compliance triggered a $' + fine.toLocaleString() + ' penalty' + (item.shutdownWeeks ? ' and a temporary shutdown.' : '.'),
        avoidable: true,
        impact: { cash: -fine, shutdownWeeks: item.shutdownWeeks || 0 },
        causeChain: [
          'Required item was overdue.',
          'Compliance score: ' + readiness.score.toFixed(2),
          'Legal risk: ' + legalRisk.toFixed(2)
        ]
      });
    }
  }

  return {
    state: {
      ...state.legal,
      items,
      complianceScore: readiness.score,
      legalRisk,
      shutdownWeeks: newShutdownWeeks,
      pendingExpenseRecognition: 0,
      lastEvents: events
    },
    complianceScore: readiness.score,
    legalRisk,
    shutdownActive: newShutdownWeeks > 0,
    penaltyCash,
    penaltyExpense,
    events
  };
}
