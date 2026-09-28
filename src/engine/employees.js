import { clamp } from './random.js';

function rampFactor(tenureWeeks, rolesData) {
  if (tenureWeeks <= 4) return rolesData.ramp.weeks1to4;
  if (tenureWeeks <= 8) return rolesData.ramp.weeks5to8;
  if (tenureWeeks <= 12) return rolesData.ramp.weeks9to12;
  return rolesData.ramp.after12;
}

function workModeFit(employee, role) {
  if (!role.remoteEligible) return 1;
  const preference = employee.hidden.remotePreference;
  if (employee.workMode === 'remote') return 0.94 + preference * 0.08;
  if (employee.workMode === 'hybrid') return 0.99;
  return 1.02 - preference * 0.08;
}

export function stepEmployees(state, config, rolesData, rng) {
  const priorLostOrders = state.history.at(-1)?.lostOrders || 0;
  const priorCapacity = Math.max(1, state.history.at(-1)?.capacity || 1);
  const workloadPressure = clamp(priorLostOrders / priorCapacity, 0, 1.5);

  const managerEmployees = state.hr.employees.filter((e) => rolesData.roles[e.roleId]?.managerQualityAdd > 0);
  const managerContribution = managerEmployees.reduce((sum, employee) => {
    const role = rolesData.roles[employee.roleId];
    return sum + role.managerQualityAdd * employee.skill * employee.morale;
  }, 0);
  const managerQuality = clamp(
    rolesData.baseFounderManagerQuality + managerContribution,
    rolesData.managerQualityMin,
    rolesData.managerQualityMax
  );

  const events = [];
  const continuing = [];
  let payrollCost = 0;
  let capacityAdd = 0;
  let serviceAdd = 0;
  let marketingEfficiencyAdd = 0;
  let awarenessAdd = 0;
  let productivitySum = 0;
  let moraleSum = 0;
  let burnoutSum = 0;

  for (const employee of state.hr.employees) {
    const role = rolesData.roles[employee.roleId];
    const tenureWeeks = Math.max(1, state.week + 1 - employee.hireWeek);
    const ramp = rampFactor(tenureWeeks, rolesData);
    const salaryMarketRatio = employee.weeklySalary / Math.max(1, role.baseWeeklySalary);
    const modeFit = workModeFit(employee, role);

    const burnout = clamp(
      employee.burnout +
      workloadPressure * 0.055 +
      Math.max(0, 0.93 - managerQuality) * 0.025 -
      Math.max(0, employee.morale - 0.72) * 0.018,
      0,
      0.98
    );

    const moraleTarget = clamp(
      0.46 +
      0.18 * Math.min(1.2, salaryMarketRatio) +
      0.16 * employee.hidden.cultureFit +
      0.12 * managerQuality +
      0.08 * modeFit -
      0.24 * burnout,
      0.2,
      0.98
    );
    const morale = clamp(employee.morale * 0.82 + moraleTarget * 0.18, 0.2, 0.98);

    const loyaltyTarget = clamp(
      0.24 +
      0.3 * morale +
      0.2 * Math.min(1.2, salaryMarketRatio) +
      0.18 * employee.hidden.cultureFit -
      0.12 * employee.hidden.ambition -
      0.12 * burnout,
      0.08,
      0.99
    );
    const loyalty = clamp(employee.loyalty * 0.86 + loyaltyTarget * 0.14, 0.08, 0.99);

    const productivity = clamp(
      employee.skill *
      morale *
      (1 + employee.training) *
      managerQuality *
      ramp *
      modeFit *
      (0.72 + 0.28 * employee.hidden.reliability),
      0.08,
      1.35
    );

    const quitRisk = clamp(
      0.002 +
      Math.max(0, 0.5 - loyalty) * 0.08 +
      Math.max(0, burnout - 0.72) * 0.09 +
      Math.max(0, employee.hidden.ambition - 0.82) * Math.max(0, 0.68 - morale) * 0.05,
      0.001,
      0.12
    );

    if (rng.uniform() < quitRisk) {
      events.push({ type: 'quit', employeeId: employee.id, message: `${employee.name} resigned after morale/loyalty deteriorated.` });
      continue;
    }

    const updated = { ...employee, morale, burnout, loyalty, productivity };
    continuing.push(updated);
    payrollCost += updated.weeklySalary + updated.perksWeekly + state.hr.benefitsPerEmployee;
    capacityAdd += role.capacityAdd * productivity;
    serviceAdd += role.serviceAdd * productivity;
    marketingEfficiencyAdd += role.marketingEfficiencyAdd * productivity;
    awarenessAdd += role.awarenessAdd * productivity;
    productivitySum += productivity;
    moraleSum += morale;
    burnoutSum += burnout;
  }

  const candidates = state.hr.candidates.map((c) => ({ ...c }));
  const activeTrials = [];
  for (const trial of state.hr.trials) {
    const candidate = candidates.find((c) => c.id === trial.candidateId);
    if (!candidate) continue;
    const role = rolesData.roles[trial.roleId];
    const observed = clamp(
      trial.skill *
      (0.7 + 0.3 * candidate.hidden.reliability) *
      (0.78 + 0.22 * candidate.hidden.cultureFit) *
      rng.range(0.92, 1.08),
      0.2,
      1.1
    );
    payrollCost += trial.salaryAsk;
    capacityAdd += role.capacityAdd * observed * 0.75;
    serviceAdd += role.serviceAdd * observed * 0.75;
    marketingEfficiencyAdd += role.marketingEfficiencyAdd * observed * 0.75;
    awarenessAdd += role.awarenessAdd * observed * 0.75;

    const remainingWeeks = trial.remainingWeeks - 1;
    const observedScores = [...trial.observedScores, observed];
    if (remainingWeeks <= 0) {
      candidate.trialCompleted = true;
      candidate.trialScore = observedScores.reduce((a, b) => a + b, 0) / observedScores.length;
      candidate.offer = { status: 'trial-complete', message: 'Trial completed. You now have direct performance evidence.' };
      events.push({ type: 'trial-complete', candidateId: candidate.id, message: `${candidate.name}'s trial is complete.` });
    } else {
      activeTrials.push({ ...trial, remainingWeeks, weeksWorked: trial.weeksWorked + 1, observedScores });
    }
  }

  return {
    employees: continuing,
    candidates,
    trials: activeTrials,
    payrollCost,
    managerQuality,
    capacityMultiplier: 1,
    capacityAdd,
    serviceAdd,
    marketingEfficiencyAdd,
    awarenessAdd,
    averageProductivity: continuing.length ? productivitySum / continuing.length : 0,
    averageMorale: continuing.length ? moraleSum / continuing.length : 0,
    averageBurnout: continuing.length ? burnoutSum / continuing.length : 0,
    events
  };
}
