export function createExpansionState() {
  return {
    projects: [],
    completed: [],
    capitalizedAssets: 0,
    last: {
      demandMultiplier: 1,
      capacityAdd: 0,
      weeklyFixedCost: 0,
      weeklyRevenue: 0
    },
    lastEvents: [],
    lastRipple: null
  };
}

export function expansionEligibility(state, projectId, data) {
  const project = data.projects[projectId];
  if (!project) return { eligible: false, reasons: ['Unknown project.'] };
  const reasons = [];

  if (state.week < project.minimumWeek) reasons.push('Company is too early for this expansion.');
  if (state.finance.cash < project.upfrontCost) reasons.push('Not enough operating cash.');
  if ((state.legal?.complianceScore ?? 0) < project.minimumCompliance) reasons.push('Compliance readiness is too low.');
  if ((state.risk?.last?.riskScore ?? 1) > project.maximumRisk) reasons.push('Risk profile is too high.');
  if (state.finance.cumulativeProfit < project.minimumCumulativeProfit) reasons.push('Cumulative profit is below the project threshold.');
  if (state.expansion.projects.some((p) => p.projectId === projectId) || state.expansion.completed.includes(projectId)) reasons.push('This expansion is already underway or complete.');

  return { eligible: reasons.length === 0, reasons };
}

export function applyExpansionAction(state, action, data) {
  if (state.status !== 'running' || action.type !== 'startExpansion') return state;
  const project = data.projects[action.projectId];
  if (!project) return state;
  const eligibility = expansionEligibility(state, action.projectId, data);
  if (!eligibility.eligible) return state;

  return {
    ...state,
    finance: { ...state.finance, cash: state.finance.cash - project.upfrontCost },
    expansion: {
      ...state.expansion,
      projects: [
        ...state.expansion.projects,
        {
          projectId: action.projectId,
          remainingWeeks: project.buildWeeks,
          startedWeek: state.week
        }
      ],
      capitalizedAssets: state.expansion.capitalizedAssets + project.upfrontCost,
      lastRipple: {
        title: project.label + ' started',
        nodes: ['Finance: expansion capex uses cash', 'Growth: capacity/market upside is delayed', 'Risk: execution complexity increases']
      }
    }
  };
}

function aggregateEffects(completed, data) {
  return completed.reduce(
    (effects, projectId) => {
      const project = data.projects[projectId];
      if (!project) return effects;
      return {
        demandMultiplier: effects.demandMultiplier * (project.marketDemandMultiplier || 1),
        capacityAdd: effects.capacityAdd + (project.capacityAdd || 0),
        weeklyFixedCost: effects.weeklyFixedCost + (project.weeklyFixedCost || 0),
        weeklyRevenue: effects.weeklyRevenue + (project.weeklyRevenue || 0)
      };
    },
    { demandMultiplier: 1, capacityAdd: 0, weeklyFixedCost: 0, weeklyRevenue: 0 }
  );
}

export function stepExpansion(state, data) {
  const projects = [];
  const completed = [...state.expansion.completed];
  const events = [];

  for (const project of state.expansion.projects) {
    const remaining = project.remainingWeeks - 1;
    if (remaining <= 0) {
      completed.push(project.projectId);
      events.push({
        category: 'expansion',
        type: 'expansion-complete',
        message: data.projects[project.projectId].label + ' is now operational.',
        avoidable: false,
        causeChain: ['Project started at week ' + project.startedWeek]
      });
    } else {
      projects.push({ ...project, remainingWeeks: remaining });
    }
  }

  const effects = aggregateEffects(completed, data);

  return {
    state: {
      ...state.expansion,
      projects,
      completed,
      last: effects,
      lastEvents: events
    },
    ...effects,
    events
  };
}
