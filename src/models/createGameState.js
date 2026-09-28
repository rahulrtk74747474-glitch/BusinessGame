import { scoreBusinessPlan } from '../engine/businessPlan.js';

export function createGameState(setup, config, industry, seed = 42) {
  const structure = config.structures[setup.structure];
  const location = config.locations[setup.location];
  const planResult = scoreBusinessPlan(setup.plan, industry);
  const initialPrice = Number(setup.plan.price) || industry.referencePrice;

  return {
    seed,
    week: 0,
    maxWeeks: Number(setup.duration),
    status: 'running',
    resultReason: '',
    mode: setup.mode,
    goal: setup.goal,
    goalTarget: Number(setup.goalTarget),
    industryId: industry.id,
    structureId: setup.structure,
    locationId: setup.location,
    plan: setup.plan,
    planScore: planResult.score,
    planFeedback: planResult.feedback,
    decisions: {
      price: initialPrice,
      marketingSpend: config.initialDecisions.marketingSpend,
      qualitySpend: config.initialDecisions.qualitySpend
    },
    market: { economicIndex: 1, trendIndex: 1, seasonality: 1, marketDemand: industry.baseMarketDemand },
    customers: {
      active: industry.initialCustomers * location.awarenessModifier,
      awareness: industry.initialAwareness * location.awarenessModifier,
      satisfaction: industry.initialSatisfaction,
      marketShare: 0,
      churnRate: industry.baseWeeklyChurn,
      effectiveCAC: industry.basePaidCAC,
      estimatedLtv: 0,
      orders: 0
    },
    finance: {
      cash: Number(setup.startingCapital),
      startingCapital: Number(setup.startingCapital),
      revenue: 0,
      variableCosts: 0,
      fixedCosts: industry.baseFixedCostPerWeek * location.fixedCostMultiplier + structure.weeklyAdminCost,
      discretionaryCosts: 0,
      grossProfit: 0,
      grossMargin: 0,
      operatingProfit: 0,
      taxAccrued: 0,
      taxPayment: 0,
      taxPayable: 0,
      netProfit: 0,
      cumulativeRevenue: 0,
      cumulativeProfit: 0,
      runwayWeeks: Infinity,
      valuation: Number(setup.startingCapital)
    },
    history: [],
    reports: []
  };
}
