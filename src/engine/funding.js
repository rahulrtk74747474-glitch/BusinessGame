import { clamp } from './random.js';

export function createFundingState(startingCapital, data) {
  return {
    founderReserveRemaining: Math.round(startingCapital * data.founderInjection.reserveFractionOfStartingCapital),
    applications: [],
    termSheets: [],
    debts: [],
    capTable: [{ id: 'founder', label: 'Founder', ownership: 1 }],
    sourceUsage: {},
    esopPool: 0,
    nextApplicationId: 1,
    nextTermSheetId: 1,
    nextDebtId: 1,
    negativeCashWeeks: 0,
    pendingExpenseRecognition: 0,
    crowdfundingObligations: [],
    investorExpectations: [],
    lastRipple: null,
    lastEvents: []
  };
}

function trailingAverage(state, key, weeks = 4) {
  const rows = state.history.slice(-weeks);
  if (!rows.length) return state.finance?.[key] || 0;
  return rows.reduce((sum, row) => sum + (row[key] || 0), 0) / rows.length;
}

function pitchFit(source, pitchFocus) {
  if (!pitchFocus) return 0.5;
  return source.preferredPitch === pitchFocus ? 1 : 0.55;
}

function eligibilityScore(state, source, pitchFocus) {
  const revenue = trailingAverage(state, 'revenue');
  const profit = trailingAverage(state, 'netProfit');
  const compliance = state.legal?.complianceScore ?? 0.5;
  const risk = state.risk?.last?.riskScore ?? 0.5;
  const satisfaction = state.customers?.satisfaction ?? 0.5;
  const awareness = state.customers?.awareness ?? 0.3;
  const marketShare = state.customers?.marketShare ?? 0;
  const valuation = Math.max(1, state.finance?.valuation || 1);

  const revenueScore = clamp(revenue / Math.max(1, source.minimumTrailingWeeklyRevenue || 1), 0, 1.4) / 1.4;
  const profitScore = clamp((profit + 1200) / 3000, 0, 1);
  const tractionScore = clamp((satisfaction * 0.35 + awareness * 0.25 + marketShare * 1.2 + Math.log10(valuation + 10) / 8), 0, 1);

  return clamp(
    revenueScore * 0.24 +
    profitScore * 0.18 +
    compliance * 0.18 +
    (1 - risk) * 0.18 +
    tractionScore * 0.12 +
    pitchFit(source, pitchFocus) * 0.1,
    0,
    1
  );
}

export function sourceEligibility(state, sourceId, data) {
  const source = data.sources[sourceId];
  if (!source) return { eligible: false, reasons: ['Unknown funding source.'] };
  const reasons = [];
  const used = state.funding.sourceUsage[sourceId] || 0;
  const revenue = trailingAverage(state, 'revenue');

  if (state.week < source.minimumWeek) reasons.push('Company is too early for this source.');
  if (used >= source.maximumApplications) reasons.push('Application limit reached.');
  if (revenue < (source.minimumTrailingWeeklyRevenue || 0)) reasons.push('Trailing revenue is below the source threshold.');
  if ((state.legal?.complianceScore ?? 0.5) < (source.minimumCompliance || 0)) reasons.push('Compliance readiness is too low.');
  if ((state.risk?.last?.riskScore ?? 0.5) > (source.maximumRisk ?? 1)) reasons.push('Risk profile is too high.');

  return { eligible: reasons.length === 0, reasons };
}

function chargeImmediate(state, amount, description) {
  return {
    ...state,
    finance: { ...state.finance, cash: state.finance.cash - amount },
    funding: {
      ...state.funding,
      pendingExpenseRecognition: state.funding.pendingExpenseRecognition + amount,
      lastRipple: {
        title: description,
        nodes: ['Finance: cash decreases now', 'Funding: financing process advances', 'Runway: short-term liquidity changes']
      }
    }
  };
}

function amortizedWeeklyPayment(principal, apr, weeks) {
  const r = apr / 52;
  if (r <= 0) return principal / weeks;
  return principal * r / (1 - Math.pow(1 + r, -weeks));
}

function diluteCapTable(capTable, newHolderId, newHolderLabel, newOwnership) {
  const scale = 1 - newOwnership;
  return [
    ...capTable.map((holder) => ({ ...holder, ownership: holder.ownership * scale })),
    { id: newHolderId, label: newHolderLabel, ownership: newOwnership }
  ];
}

function setEsopPool(capTable, currentPool, targetPool) {
  if (targetPool <= currentPool + 1e-9) return capTable;
  const nonEsop = capTable.filter((holder) => holder.id !== 'esop');
  const scale = (1 - targetPool) / Math.max(1e-9, 1 - currentPool);
  return [
    ...nonEsop.map((holder) => ({ ...holder, ownership: holder.ownership * scale })),
    { id: 'esop', label: 'ESOP pool', ownership: targetPool }
  ];
}

export function applyFundingAction(state, action, data) {
  if (state.status !== 'running') return state;

  if (action.type === 'founderInjection') {
    const amount = Math.max(0, Math.min(Number(action.amount) || 0, state.funding.founderReserveRemaining));
    if (amount < data.founderInjection.minimumInjection) return state;
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash + amount },
      funding: {
        ...state.funding,
        founderReserveRemaining: state.funding.founderReserveRemaining - amount,
        lastRipple: {
          title: 'Founder capital added',
          nodes: ['Finance: cash increases', 'Ownership: no dilution', 'Risk: founder concentration increases']
        }
      }
    };
  }

  if (action.type === 'setEsopPool') {
    const target = Number(action.target) || 0;
    if (!data.esopPoolOptions.includes(target) || target < state.funding.esopPool) return state;
    return {
      ...state,
      funding: {
        ...state.funding,
        capTable: setEsopPool(state.funding.capTable, state.funding.esopPool, target),
        esopPool: target,
        lastRipple: {
          title: 'ESOP pool changed',
          nodes: ['HR: equity capacity improves', 'Ownership: existing holders dilute', 'Funding: investor-ready cap table improves']
        }
      }
    };
  }

  if (action.type === 'apply') {
    const source = data.sources[action.sourceId];
    if (!source) return state;
    const eligibility = sourceEligibility(state, action.sourceId, data);
    if (!eligibility.eligible) return state;

    const amount = clamp(Number(action.amount) || source.minimumAmount, source.minimumAmount, source.maximumAmount);
    const requestedValuation = Math.max(
      state.finance.valuation,
      Number(action.requestedValuation) || state.finance.valuation
    );
    const score = eligibilityScore(state, source, action.pitchFocus);
    const application = {
      id: state.funding.nextApplicationId,
      sourceId: action.sourceId,
      amount,
      requestedValuation,
      pitchFocus: action.pitchFocus || source.preferredPitch,
      score,
      weeksRemaining: source.decisionWeeks,
      status: 'pending'
    };
    let next = {
      ...state,
      funding: {
        ...state.funding,
        applications: [...state.funding.applications, application],
        nextApplicationId: state.funding.nextApplicationId + 1,
        sourceUsage: {
          ...state.funding.sourceUsage,
          [action.sourceId]: (state.funding.sourceUsage[action.sourceId] || 0) + 1
        }
      }
    };
    return chargeImmediate(next, source.applicationCost, source.label + ' application submitted');
  }

  if (action.type === 'rejectTermSheet') {
    return {
      ...state,
      funding: {
        ...state.funding,
        termSheets: state.funding.termSheets.filter((term) => term.id !== action.termSheetId)
      }
    };
  }

  if (action.type === 'acceptTermSheet') {
    const term = state.funding.termSheets.find((item) => item.id === action.termSheetId);
    if (!term) return state;
    let next = {
      ...state,
      funding: {
        ...state.funding,
        termSheets: state.funding.termSheets.filter((item) => item.id !== term.id)
      }
    };

    if (term.type === 'debt') {
      const fee = term.amount * term.originationFeeRate;
      const debt = {
        id: state.funding.nextDebtId,
        label: term.label,
        balance: term.amount,
        originalPrincipal: term.amount,
        apr: term.apr,
        weeklyPayment: amortizedWeeklyPayment(term.amount, term.apr, term.termWeeks),
        remainingWeeks: term.termWeeks
      };
      next = {
        ...next,
        finance: { ...next.finance, cash: next.finance.cash + term.amount - fee },
        funding: {
          ...next.funding,
          debts: [...next.funding.debts, debt],
          nextDebtId: next.funding.nextDebtId + 1,
          pendingExpenseRecognition: next.funding.pendingExpenseRecognition + fee,
          lastRipple: {
            title: 'Loan funded',
            nodes: ['Finance: cash rises', 'Finance: debt service begins', 'Risk: leverage increases', 'Funding: future borrowing capacity changes']
          }
        }
      };
    }

    if (term.type === 'equity') {
      const postMoney = term.preMoneyValuation + term.amount;
      const newOwnership = term.amount / postMoney;
      const investorId = term.sourceId + '-' + term.id;
      next = {
        ...next,
        finance: { ...next.finance, cash: next.finance.cash + term.amount },
        funding: {
          ...next.funding,
          capTable: diluteCapTable(next.funding.capTable, investorId, term.label, newOwnership),
          investorExpectations: term.expectation
            ? [...next.funding.investorExpectations, term.expectation]
            : next.funding.investorExpectations,
          lastRipple: {
            title: 'Equity round closed',
            nodes: ['Finance: cash rises', 'Ownership: founder and existing holders dilute', 'Governance: investor expectations increase', 'Growth: runway expands']
          }
        }
      };
    }

    if (term.type === 'grant') {
      next = {
        ...next,
        finance: { ...next.finance, cash: next.finance.cash + term.amount },
        funding: {
          ...next.funding,
          lastRipple: {
            title: 'Grant accepted',
            nodes: ['Finance: non-dilutive cash rises', 'Ownership: unchanged', 'Compliance: grant conditions still matter']
          }
        }
      };
    }

    if (term.type === 'crowdfunding') {
      const fee = term.amount * term.platformFeeRate;
      next = {
        ...next,
        finance: { ...next.finance, cash: next.finance.cash + term.amount - fee },
        funding: {
          ...next.funding,
          pendingExpenseRecognition: next.funding.pendingExpenseRecognition + fee,
          crowdfundingObligations: [
            ...next.funding.crowdfundingObligations,
            {
              weeklyCost: (term.amount * term.fulfillmentCostRate) / term.fulfillmentWeeks,
              remainingWeeks: term.fulfillmentWeeks
            }
          ],
          lastRipple: {
            title: 'Crowdfunding campaign funded',
            nodes: ['Finance: cash rises', 'Customers: fulfillment obligation begins', 'Reputation: delivery execution now matters']
          }
        }
      };
    }

    return next;
  }

  return state;
}

function buildTermSheet(state, application, source, data, rng, nextId) {
  const risk = state.risk?.last?.riskScore ?? 0.5;
  const score = application.score;

  if (source.type === 'debt') {
    const apr = source.baseApr + risk * source.riskAprSpread;
    return {
      id: nextId,
      sourceId: application.sourceId,
      label: source.label,
      type: 'debt',
      amount: application.amount,
      apr,
      termWeeks: source.termWeeks,
      originationFeeRate: source.originationFeeRate,
      expiresIn: data.termSheetExpiryWeeks
    };
  }

  if (source.type === 'equity') {
    const valuationFactor = clamp(
      source.valuationFloorMultiple +
        score * (source.valuationCeilingMultiple - source.valuationFloorMultiple) +
        rng.range(-0.04, 0.04),
      source.valuationFloorMultiple,
      source.valuationCeilingMultiple
    );
    const reference = Math.max(state.finance.valuation, application.requestedValuation * 0.75);
    const preMoneyValuation = Math.round(reference * valuationFactor);
    return {
      id: nextId,
      sourceId: application.sourceId,
      label: source.label,
      type: 'equity',
      amount: application.amount,
      preMoneyValuation,
      expectation: source.expectation,
      expiresIn: data.termSheetExpiryWeeks
    };
  }

  if (source.type === 'grant') {
    return {
      id: nextId,
      sourceId: application.sourceId,
      label: source.label,
      type: 'grant',
      amount: application.amount,
      expiresIn: data.termSheetExpiryWeeks
    };
  }

  return {
    id: nextId,
    sourceId: application.sourceId,
    label: source.label,
    type: 'crowdfunding',
    amount: application.amount,
    platformFeeRate: source.platformFeeRate,
    fulfillmentCostRate: source.fulfillmentCostRate,
    fulfillmentWeeks: source.fulfillmentWeeks,
    expiresIn: data.termSheetExpiryWeeks
  };
}

export function stepFunding(state, data, rng) {
  const events = [];
  const applications = [];
  let termSheets = state.funding.termSheets
    .map((term) => ({ ...term, expiresIn: term.expiresIn - 1 }))
    .filter((term) => term.expiresIn > 0);
  let nextTermSheetId = state.funding.nextTermSheetId;

  for (const application of state.funding.applications) {
    const source = data.sources[application.sourceId];
    const remaining = application.weeksRemaining - 1;
    if (remaining > 0) {
      applications.push({ ...application, weeksRemaining: remaining });
      continue;
    }

    const probability = clamp(source.baseApproval + application.score * 0.48, 0.05, 0.96);
    const approved =
      application.score >= source.guaranteedApprovalScore ||
      rng.uniform() < probability;

    if (approved) {
      const term = buildTermSheet(state, application, source, data, rng, nextTermSheetId);
      termSheets.push(term);
      nextTermSheetId += 1;
      events.push({
        category: 'funding',
        type: 'term-sheet',
        message: source.label + ' produced a term sheet.',
        avoidable: false,
        causeChain: [
          'Application score: ' + application.score.toFixed(2),
          'Pitch focus: ' + application.pitchFocus
        ]
      });
    } else {
      events.push({
        category: 'funding',
        type: 'rejected',
        message: source.label + ' rejected the application.',
        avoidable: null,
        causeChain: [
          'Application score: ' + application.score.toFixed(2),
          'Weak traction, risk, compliance or pitch fit can reduce approval odds.'
        ]
      });
    }
  }

  let debtService = 0;
  let interestExpense = 0;
  let principalPayment = 0;
  const debts = [];

  for (const debt of state.funding.debts) {
    if (debt.balance <= 0) continue;
    const interest = debt.balance * debt.apr / 52;
    const payment = Math.min(debt.weeklyPayment, debt.balance + interest);
    const principal = Math.max(0, payment - interest);
    const balance = Math.max(0, debt.balance - principal);

    debtService += payment;
    interestExpense += interest;
    principalPayment += principal;

    if (balance > 0.01 && debt.remainingWeeks > 1) {
      debts.push({ ...debt, balance, remainingWeeks: debt.remainingWeeks - 1 });
    } else {
      events.push({
        category: 'funding',
        type: 'debt-repaid',
        message: debt.label + ' was fully repaid.',
        avoidable: false
      });
    }
  }

  let crowdfundingCost = 0;
  const crowdfundingObligations = [];
  for (const obligation of state.funding.crowdfundingObligations) {
    crowdfundingCost += obligation.weeklyCost;
    if (obligation.remainingWeeks > 1) {
      crowdfundingObligations.push({ ...obligation, remainingWeeks: obligation.remainingWeeks - 1 });
    }
  }

  return {
    state: {
      ...state.funding,
      applications,
      termSheets,
      debts,
      crowdfundingObligations,
      nextTermSheetId,
      pendingExpenseRecognition: 0,
      lastEvents: events
    },
    debtService,
    interestExpense,
    principalPayment,
    crowdfundingCost,
    events
  };
}

export function updateFundingDistress(fundingState, cash) {
  return {
    ...fundingState,
    negativeCashWeeks: cash <= 0 ? fundingState.negativeCashWeeks + 1 : 0
  };
}

export function hasFinancingOptions(state, data) {
  if (state.risk?.reserveCash > 0) return true;
  if (state.funding.founderReserveRemaining >= data.founderInjection.minimumInjection) return true;
  if (state.funding.applications.length > 0 || state.funding.termSheets.length > 0) return true;

  return Object.keys(data.sources).some((sourceId) => {
    const source = data.sources[sourceId];
    const used = state.funding.sourceUsage[sourceId] || 0;
    if (used >= source.maximumApplications) return false;
    return sourceEligibility(state, sourceId, data).eligible;
  });
}

export function totalDebt(state) {
  return state.funding.debts.reduce((sum, debt) => sum + debt.balance, 0);
}
