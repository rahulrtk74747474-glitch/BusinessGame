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

function hireCandidate(state, candidate, terms, rolesData) {
  const acceptedOffer = {
    status: 'accepted',
    weeklySalary: Math.max(1, Math.round(terms.weeklySalary)),
    perksWeekly: Math.max(0, Math.round(terms.perksWeekly || 0)),
    equityBps: clamp(Math.round(terms.equityBps || 0), 0, 100),
    message: 'Offer accepted.'
  };
  const employee = makeEmployee(candidate, acceptedOffer, state, rolesData);
  const updated = { ...candidate, available: false, offer: acceptedOffer };
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

export function hireCandidateFromNegotiation(state, candidateId, terms, rolesData) {
  const candidate = getCandidate(state, candidateId);
  if (!candidate?.available) return state;
  return hireCandidate(state, candidate, terms, rolesData);
}

function evaluateOffer(candidate, terms) {
  const weeklySalary = Math.max(1, Math.round(Number(terms.weeklySalary)));
  const perksWeekly = Math.max(0, Math.round(Number(terms.perksWeekly || 0)));
  const equityBps = clamp(Math.round(Number(terms.equityBps || 0)), 0, 100);

  // Salary ask is intentionally a realistic asking point, not an unreachable
  // minimum. A full asking-salary offer should normally be acceptable.
  const cashCompRatio = (weeklySalary + perksWeekly * 0.75) / Math.max(1, candidate.salaryAsk);
  const equityValueRatio = equityBps * 0.0008;
  const relationshipBonus =
    (candidate.insights.interview ? 0.008 : 0) +
    (candidate.insights.references ? 0.006 : 0) +
    (candidate.trialCompleted ? 0.025 : 0);
  const fitBonus = candidate.hidden.cultureFit * 0.02;

  const effectiveOffer = cashCompRatio + equityValueRatio + relationshipBonus + fitBonus;
  const acceptanceThreshold = clamp(
    0.955 + candidate.hidden.ambition * 0.025 - candidate.hidden.cultureFit * 0.012,
    0.95,
    0.982
  );

  return {
    weeklySalary,
    perksWeekly,
    equityBps,
    effectiveOffer,
    acceptanceThreshold
  };
}

function counterTerms(candidate, evaluated) {
  const nonSalaryValue =
    (evaluated.perksWeekly * 0.75) / Math.max(1, candidate.salaryAsk) +
    evaluated.equityBps * 0.0008 +
    (candidate.insights.interview ? 0.008 : 0) +
    (candidate.insights.references ? 0.006 : 0) +
    (candidate.trialCompleted ? 0.025 : 0) +
    candidate.hidden.cultureFit * 0.02;

  const requiredSalaryRatio = Math.max(
    candidate.hidden.walkAwayRatio,
    evaluated.acceptanceThreshold - nonSalaryValue
  );

  return Math.max(
    evaluated.weeklySalary + 1,
    Math.ceil(candidate.salaryAsk * requiredSalaryRatio)
  );
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

  if (action.type === 'acceptCounter' && candidate?.available && candidate.offer?.status === 'counter') {
    return hireCandidate(state, candidate, {
      weeklySalary: candidate.offer.counterSalary,
      perksWeekly: candidate.offer.perksWeekly || 0,
      equityBps: candidate.offer.equityBps || 0
    }, rolesData);
  }

  if (action.type === 'makeOffer' && candidate?.available) {
    const evaluated = evaluateOffer(candidate, action);
    const cashOnlyRatio = (evaluated.weeklySalary + evaluated.perksWeekly * 0.75) / Math.max(1, candidate.salaryAsk);

    // A genuinely weak offer can make the candidate leave.
    if (cashOnlyRatio < candidate.hidden.walkAwayRatio - 0.015) {
      const updated = {
        ...candidate,
        available: false,
        offer: { status: 'declined', message: 'The candidate declined the offer and left the process.' }
      };
      return replaceCandidate(state, updated);
    }

    // At or near the stated ask, acceptance is now normal rather than impossible.
    if (evaluated.effectiveOffer >= evaluated.acceptanceThreshold) {
      return hireCandidate(state, candidate, evaluated, rolesData);
    }

    const counterSalary = counterTerms(candidate, evaluated);
    const updated = {
      ...candidate,
      offer: {
        status: 'counter',
        counterSalary,
        perksWeekly: evaluated.perksWeekly,
        equityBps: evaluated.equityBps,
        message: `Candidate countered at $${counterSalary}/week. You can accept it directly or submit another offer.`
      }
    };
    return replaceCandidate(state, updated);
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
