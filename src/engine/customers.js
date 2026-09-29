import { clamp } from './random.js';

export function stepCustomers(
  state,
  decisions,
  industry,
  config,
  market,
  rng,
  locationConfig,
  teamEffects = {},
  marketingEffects = {},
  operationsEffects = {},
  competitorEffects = {}
) {
  const cCfg = config.customer;
  const satisfaction = state.customers.satisfaction;

  const priceValue = clamp(
    industry.referencePrice / Math.max(decisions.price, config.simulation.minDecisionPrice),
    cCfg.priceValueMin,
    cCfg.priceValueMax
  );
  const qualityFactor = clamp(
    1 + industry.qualitySpendEffect * (decisions.qualitySpend / industry.qualitySpendReference - 1),
    cCfg.qualityFactorMin,
    cCfg.qualityFactorMax
  );

  const paidAcquired = Math.max(0, marketingEffects.totalAcquired || 0);
  const effectiveCAC = paidAcquired > 0
    ? marketingEffects.effectiveCAC
    : industry.basePaidCAC;

  const reputationAwarenessGain =
    Math.max(0, satisfaction - cCfg.reputationAwarenessThreshold) *
    cCfg.reputationAwarenessGain;
  const awareness = clamp(
    state.customers.awareness * (1 - cCfg.awarenessDecay) +
      (marketingEffects.awarenessGain || 0) +
      reputationAwarenessGain +
      (teamEffects.awarenessAdd || 0),
    cCfg.awarenessMin,
    cCfg.awarenessMax
  );

  const competitionDemand = competitorEffects.demandModifier || 1;
  const organicPool =
    industry.weeklyNewCustomerPool *
    market.economicIndex *
    market.trendIndex *
    competitionDemand;
  const organicAcquired =
    organicPool *
    awareness *
    industry.organicConversionRate *
    priceValue *
    locationConfig.awarenessModifier;
  const referrals =
    state.customers.active *
    industry.referralRate *
    Math.max(0, satisfaction - cCfg.referralSatisfactionThreshold) *
    cCfg.referralSatisfactionMultiplier;
  const acquisitionNoise = clamp(
    rng.normal(1, cCfg.acquisitionNoiseStd),
    cCfg.acquisitionNoiseMin,
    cCfg.acquisitionNoiseMax
  );
  const newCustomers = Math.max(
    0,
    (paidAcquired + organicAcquired + referrals) * acquisitionNoise
  );

  const premiumPenalty =
    decisions.price > industry.referencePrice * cCfg.premiumPriceThreshold
      ? cCfg.premiumChurnPenalty
      : 1;
  const churnRate = clamp(
    industry.baseWeeklyChurn *
      (cCfg.churnSatisfactionIntercept - satisfaction) *
      premiumPenalty,
    cCfg.churnMin,
    cCfg.churnMax
  );
  const churned = Math.min(
    state.customers.active,
    state.customers.active * churnRate
  );
  const activeBeforeOrders = Math.max(
    0,
    state.customers.active + newCustomers - churned
  );

  const potentialOrdersFromCustomers =
    activeBeforeOrders *
    industry.purchaseFrequency *
    (cCfg.purchaseBase + cCfg.purchaseSatisfactionWeight * satisfaction);
  const shareCeiling = clamp(
    cCfg.shareBase + awareness * cCfg.shareAwarenessWeight,
    cCfg.shareMin,
    cCfg.shareMax
  );
  const demandAvailable =
    market.marketDemand *
    shareCeiling *
    competitionDemand;

  const capacity = Number.isFinite(operationsEffects.capacity)
    ? operationsEffects.capacity
    : industry.capacityOrdersPerWeek * locationConfig.capacityMultiplier +
      (teamEffects.capacityAdd || 0);

  const orders = Math.max(
    0,
    Math.min(potentialOrdersFromCustomers, demandAvailable, capacity)
  );
  const unconstrainedDemand = Math.min(
    potentialOrdersFromCustomers,
    demandAvailable
  );
  const lostOrders = Math.max(0, unconstrainedDemand - capacity);
  const capacityPressure = capacity > 0 ? lostOrders / capacity : 0;

  const qualitySignal = clamp(
    industry.serviceBaseline * qualityFactor * priceValue +
      (teamEffects.serviceAdd || 0) +
      (operationsEffects.serviceAdd || 0) -
      capacityPressure * cCfg.capacityPressureSatisfactionPenalty +
      rng.normal(0, cCfg.qualitySignalNoiseStd),
    cCfg.minSatisfaction,
    cCfg.maxSatisfaction
  );
  const nextSatisfaction = clamp(
    cCfg.satisfactionMemory * satisfaction +
      (1 - cCfg.satisfactionMemory) * qualitySignal,
    cCfg.minSatisfaction,
    cCfg.maxSatisfaction
  );

  const marketShare =
    market.marketDemand > 0 ? orders / market.marketDemand : 0;
  const revenuePerCustomer =
    activeBeforeOrders > 0
      ? (orders * decisions.price) / activeBeforeOrders
      : 0;
  const estimatedUnitCost = Number.isFinite(operationsEffects.estimatedUnitCost)
    ? operationsEffects.estimatedUnitCost
    : industry.baseVariableCostPerOrder;
  const unitGrossMargin =
    decisions.price > 0
      ? Math.max(0, decisions.price - estimatedUnitCost) / decisions.price
      : 0;
  const estimatedLtv =
    churnRate > 0
      ? Math.max(0, (revenuePerCustomer * unitGrossMargin) / churnRate)
      : 0;

  return {
    active: activeBeforeOrders,
    newCustomers,
    churned,
    churnRate,
    awareness,
    satisfaction: nextSatisfaction,
    referrals,
    paidAcquired,
    organicAcquired,
    effectiveCAC,
    estimatedLtv,
    orders,
    lostOrders,
    marketShare,
    capacity,
    potentialOrders: unconstrainedDemand,
    competitionDemandModifier: competitionDemand
  };
}
