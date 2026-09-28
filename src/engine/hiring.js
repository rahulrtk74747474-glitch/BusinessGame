import { createRng, clamp } from './random.js';

const band = (value) => value < 0.58 ? 'low' : value < 0.78 ? 'medium' : 'high';

function candidateSeed(baseSeed, index, refreshCount = 0) {
  return baseSeed + 12017 * (index + 1) + refreshCount * 99173;
}

export function generateCandidatePool(seed, rolesData, refreshCount = 0) {
  const roleIds = Object.keys(rolesData.roles);
  const names = rolesData.candidateNames;
  return Array.from({ length: rolesData.candidatePoolSize }, (_, index) => {
    const rng = createRng(candidateSeed(seed, index, refreshCount));
    const roleId = roleIds[Math.floor(rng.range(0, roleIds.length))];
    const role = rolesData.roles[roleId];
    const experienceYears = Math.floor(rng.range(0, 9));
    const skill = clamp(rng.range(0.5, 0.86) + experienceYears * 0.018, 0.48, 0.96);
    const reliability = rng.range(0.42, 0.98);
    const ambition = rng.range(0.28, 0.98);
    const cultureFit = rng.range(0.38, 0.98);
    const remotePreference = rng.range(0.05, 0.95);
    const salaryAsk = Math.round(
      role.baseWeeklySalary *
      (0.84 + skill * 0.17 + experienceYears * 0.014 + rng.range(-0.04, 0.06))
    );
    return {
      id: `candidate-${refreshCount}-${index + 1}`,
      name: names[(index + refreshCount * 3) % names.length],
      roleId,
      experienceYears,
      skill,
      salaryAsk,
      available: true,
      insights: {},
      offer: null,
      trialCompleted: false,
      trialScore: null,
      hidden: {
        reliability,
        ambition,
        cultureFit,
        remotePreference,
        walkAwayRatio: clamp(0.82 + ambition * 0.09 - cultureFit * 0.035 + rng.range(-0.025, 0.025), 0.82, 0.93)
      }
    };
  });
}

export function candidateView(candidate, rolesData) {
  const role = rolesData.roles[candidate.roleId];
  const dueDiligence = Number(Boolean(candidate.insights.interview)) + Number(Boolean(candidate.insights.references)) + Number(candidate.trialCompleted);
  return {
    id: candidate.id,
    name: candidate.name,
    roleId: candidate.roleId,
    roleLabel: role.label,
    experienceYears: candidate.experienceYears,
    skill: candidate.skill,
    salaryAsk: candidate.salaryAsk,
    available: candidate.available,
    interview: candidate.insights.interview || null,
    references: candidate.insights.references || null,
    trialCompleted: candidate.trialCompleted,
    trialScore: candidate.trialScore,
    offer: candidate.offer,
    riskLabel: dueDiligence === 0 ? 'High uncertainty' : dueDiligence === 1 ? 'Medium uncertainty' : 'Lower uncertainty'
  };
}

function chargeImmediate(state, amount, description) {
  return {
    ...state,
    finance: { ...state.finance, cash: state.finance.cash - amount },
    hr: {
      ...state.hr,
      pendingExpenseRecognition: state.hr.pendingExpenseRecognition + amount,
      transactions: [...state.hr.transactions, { week: state.week, amount, description }]
    }
  };
}

function replaceCandidate(state, candidate) {
  return {
    ...state,
    hr: {
      ...state.hr,
      candidates: state.hr.candidates.map((c) => c.id === candidate.id ? candidate : c)
    }
  };
}

function getCandidate(state, candidateId) {
  return state.hr.candidates.find((c) => c.id === candidateId);
}

function makeEmployee(candidate, offer, state, rolesData) {
  return {
    id: `employee-${state.hr.nextEmployeeId}`,
    name: candidate.name,
    roleId: candidate.roleId,
    experienceYears: candidate.experienceYears,
    skill: candidate.skill,
    weeklySalary: offer.weeklySalary,
    perksWeekly: offer.perksWeekly,
    equityBps: offer.equityBps,
    hireWeek: state.week,
    morale: 0.74,
    burnout: 0.08,
    loyalty: 0.68,
    training: 0,
    reviews: 0,
    workMode: rolesData.roles[candidate.roleId].remoteEligible ? 'hybrid' : 'onsite',
    hidden: { ...candidate.hidden },
    productivity: 0,
    lastPerformance: null
  };
}

export function applyHrAction(state, action, config, rolesData) {
  if (state.status !== 'running') return state;

  if (action.type === 'refreshCandidates') {
    const nextRefresh = state.hr.refreshCount + 1;
    let next = chargeImmediate(state, rolesData.refreshPoolCost, 'Recruiting: refresh candidate pool');
    return {
      ...next,
      hr: {
        ...next.hr,
        refreshCount: nextRefresh,
        candidates: generateCandidatePool(state.seed, rolesData, nextRefresh),
        trials: []
      }
    };
  }

  if (action.type === 'setBenefits') {
    if (!rolesData.benefitOptions.includes(Number(action.amount))) return state;
    return { ...state, hr: { ...state.hr, benefitsPerEmployee: Number(action.amount) } };
  }

  const candidate = action.candidateId ? getCandidate(state, action.candidateId) : null;

  if (action.type === 'interview' && candidate?.available) {
    const updated = {
      ...candidate,
      insights: {
        ...candidate.insights,
        interview: {
          cultureFit: band(candidate.hidden.cultureFit),
          ambition: band(candidate.hidden.ambition)
        }
      }
    };
    return chargeImmediate(replaceCandidate(state, updated), rolesData.interviewCost, `Interview: ${candidate.name}`);
  }

  if (action.type === 'referenceCheck' && candidate?.available) {
    const updated = {
      ...candidate,
      insights: {
        ...candidate.insights,
        references: { reliability: band(candidate.hidden.reliability) }
      }
    };
    return chargeImmediate(replaceCandidate(state, updated), rolesData.referenceCheckCost, `Reference check: ${candidate.name}`);
  }

  if (action.type === 'startTrial' && candidate?.available && !state.hr.trials.some((t) => t.candidateId === candidate.id)) {
    const trial = {
      candidateId: candidate.id,
      name: candidate.name,
      roleId: candidate.roleId,
      skill: candidate.skill,
      salaryAsk: candidate.salaryAsk,
      remainingWeeks: rolesData.trialLengthWeeks,
      weeksWorked: 0,
      observedScores: []
    };
    const updated = { ...candidate, offer: { status: 'trial', message: 'Trial started.' } };
    let next = replaceCandidate(state, updated);
    next = { ...next, hr: { ...next.hr, trials: [...next.hr.trials, trial] } };
    return chargeImmediate(next, rolesData.trialAdminCost, `Trial setup: ${candidate.name}`);
  }

  if (action.type === 'makeOffer' && candidate?.available) {
    const weeklySalary = Math.max(1, Math.round(Number(action.weeklySalary)));
    const perksWeekly = Math.max(0, Math.round(Number(action.perksWeekly || 0)));
    const equityBps = clamp(Math.round(Number(action.equityBps || 0)), 0, 100);
    const salaryRatio = weeklySalary / candidate.salaryAsk;
    const offerValue =
      salaryRatio * 0.78 +
      Math.min(1, perksWeekly / 80) * 0.08 +
      Math.min(1, equityBps / 50) * 0.06 +
      candidate.hidden.cultureFit * 0.08;

    const rng = createRng(state.seed + state.week * 4909 + Number(candidate.id.split('-').at(-1)) * 313);
    const noise = rng.range(-0.025, 0.025);
    const walkAway = candidate.hidden.walkAwayRatio;

    if (salaryRatio + perksWeekly / Math.max(1, candidate.salaryAsk) < walkAway && offerValue + noise < 0.9) {
      const updated = {
        ...candidate,
        available: false,
        offer: { status: 'declined', message: 'The candidate declined and left the process.' }
      };
      return replaceCandidate(state, updated);
    }

    if (offerValue + noise < 0.99) {
      const counterSalary = Math.max(weeklySalary + 1, Math.round(candidate.salaryAsk * (0.96 - Math.min(0.05, perksWeekly / 2000))));
      const updated = {
        ...candidate,
        offer: { status: 'counter', counterSalary, message: `Candidate countered at $${counterSalary}/week.` }
      };
      return replaceCandidate(state, updated);
    }

    const offer = { status: 'accepted', weeklySalary, perksWeekly, equityBps, message: 'Offer accepted.' };
    const employee = makeEmployee(candidate, offer, state, rolesData);
    const updated = { ...candidate, available: false, offer };
    let next = replaceCandidate(state, updated);
    next = {
      ...next,
      hr: {
        ...next.hr,
        employees: [...next.hr.employees, employee],
        trials: next.hr.trials.filter((t) => t.candidateId !== candidate.id),
        nextEmployeeId: next.hr.nextEmployeeId + 1,
        lastRipple: {
          title: `Hired ${candidate.name}`,
          nodes: ['HR: headcount +1', 'Finance: weekly payroll rises', 'Operations: capacity/service may improve', 'Leadership: manager load changes']
        }
      }
    };
    return chargeImmediate(next, rolesData.hireAdminCost, `Hiring/admin: ${candidate.name}`);
  }

  const employeeIndex = action.employeeId ? state.hr.employees.findIndex((e) => e.id === action.employeeId) : -1;
  if (employeeIndex < 0) return state;
  const employee = state.hr.employees[employeeIndex];
  const role = rolesData.roles[employee.roleId];

  if (action.type === 'train') {
    const updated = {
      ...employee,
      training: clamp(employee.training + rolesData.trainingBoost, 0, rolesData.trainingCap),
      morale: clamp(employee.morale + 0.025, 0.2, 0.98)
    };
    let next = {
      ...state,
      hr: {
        ...state.hr,
        employees: state.hr.employees.map((e) => e.id === employee.id ? updated : e),
        lastRipple: {
          title: `Training: ${employee.name}`,
          nodes: ['HR: skill utilization rises', 'Finance: training cost now', 'Operations: productivity improves after training', 'People: morale usually improves']
        }
      }
    };
    return chargeImmediate(next, rolesData.trainingCost, `Training: ${employee.name}`);
  }

  if (action.type === 'review') {
    const updated = {
      ...employee,
      reviews: employee.reviews + 1,
      lastPerformance: {
        productivity: employee.productivity,
        reliabilitySignal: band(employee.hidden.reliability),
        ambitionSignal: band(employee.hidden.ambition),
        cultureFitSignal: band(employee.hidden.cultureFit)
      },
      morale: clamp(employee.morale + 0.015, 0.2, 0.98)
    };
    return {
      ...state,
      hr: {
        ...state.hr,
        employees: state.hr.employees.map((e) => e.id === employee.id ? updated : e)
      }
    };
  }

  if (action.type === 'raise') {
    const updated = {
      ...employee,
      weeklySalary: Math.round(employee.weeklySalary * (1 + rolesData.raisePercent)),
      morale: clamp(employee.morale + 0.05, 0.2, 0.98),
      loyalty: clamp(employee.loyalty + 0.05, 0.1, 0.99)
    };
    return {
      ...state,
      hr: {
        ...state.hr,
        employees: state.hr.employees.map((e) => e.id === employee.id ? updated : e),
        lastRipple: {
          title: `Raise: ${employee.name}`,
          nodes: ['Finance: payroll increases', 'HR: morale and loyalty improve', 'Risk: quit probability may fall']
        }
      }
    };
  }

  if (action.type === 'promote' && role.promotionTo) {
    const nextRole = rolesData.roles[role.promotionTo];
    const updated = {
      ...employee,
      roleId: role.promotionTo,
      weeklySalary: Math.max(Math.round(employee.weeklySalary * 1.12), Math.round(nextRole.baseWeeklySalary * 0.95)),
      morale: clamp(employee.morale + 0.08, 0.2, 0.98),
      loyalty: clamp(employee.loyalty + 0.04, 0.1, 0.99)
    };
    return {
      ...state,
      hr: {
        ...state.hr,
        employees: state.hr.employees.map((e) => e.id === employee.id ? updated : e),
        lastRipple: {
          title: `Promotion: ${employee.name}`,
          nodes: ['Leadership: management capacity improves', 'Finance: salary increases', 'HR: ambition is rewarded', 'Operations: team productivity may improve']
        }
      }
    };
  }

  if (action.type === 'setWorkMode') {
    const requested = action.workMode;
    if (!['onsite', 'hybrid', 'remote'].includes(requested)) return state;
    if (!role.remoteEligible && requested !== 'onsite') return state;
    const updated = { ...employee, workMode: requested };
    return {
      ...state,
      hr: { ...state.hr, employees: state.hr.employees.map((e) => e.id === employee.id ? updated : e) }
    };
  }

  if (action.type === 'terminate') {
    const reason = action.reason === 'layoff' ? 'layoff' : 'fire';
    const severanceWeeks = reason === 'layoff' ? rolesData.layoffSeveranceWeeks : rolesData.fireSeveranceWeeks;
    const severance = Math.round(employee.weeklySalary * severanceWeeks);
    const moralePenalty = reason === 'layoff' ? rolesData.layoffMoralePenalty : rolesData.fireMoralePenalty;
    const legalRiskAdd = reason === 'fire' && employee.reviews === 0 ? rolesData.unreviewedFireLegalRisk : 0;
    const remaining = state.hr.employees
      .filter((e) => e.id !== employee.id)
      .map((e) => ({ ...e, morale: clamp(e.morale - moralePenalty, 0.2, 0.98) }));
    let next = {
      ...state,
      hr: {
        ...state.hr,
        employees: remaining,
        legalRisk: clamp(state.hr.legalRisk + legalRiskAdd, 0, 1),
        lastRipple: {
          title: `${reason === 'layoff' ? 'Layoff' : 'Termination'}: ${employee.name}`,
          nodes: ['Finance: payroll falls, severance paid now', 'HR: remaining-team morale falls', 'Operations: capacity/productivity may fall', legalRiskAdd > 0 ? 'Legal: documentation risk increased' : 'Legal: documentation risk contained']
        }
      }
    };
    return chargeImmediate(next, severance, `Severance: ${employee.name}`);
  }

  return state;
}
