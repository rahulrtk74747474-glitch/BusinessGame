import { clamp } from './random.js';

export function createMarketingState(marketingData) {
  const strengths = {};
  for (const id of Object.keys(marketingData.channels)) strengths[id] = 1;
  return {
    channelWeights: { ...marketingData.defaultWeights },
    channelStrengths: strengths,
    last: {
      totalSpend: 0,
      totalAcquired: 0,
      effectiveCAC: 0,
      awarenessGain: 0,
      b2bLeads: 0,
      estimatedROAS: 0,
      channels: {}
    },
    lastRipple: null
  };
}

export function applyMarketingAction(state, action, marketingData) {
  if (state.status !== 'running') return state;
  if (action.type !== 'setChannelWeight') return state;
  if (!marketingData.channels[action.channelId]) return state;
  const weight = clamp(Number(action.weight) || 0, 0, 100);

  return {
    ...state,
    marketing: {
      ...state.marketing,
      channelWeights: {
        ...state.marketing.channelWeights,
        [action.channelId]: weight
      },
      lastRipple: {
        title: 'Marketing mix changed',
        nodes: [
          'Marketing: channel allocation changes',
          'Customers: CAC and acquisition mix change',
          'Sales: B2B lead flow may change',
          'Finance: total weekly budget stays controlled separately'
        ]
      }
    }
  };
}

function normalizedWeights(weights, channelIds) {
  const total = channelIds.reduce((sum, id) => sum + Math.max(0, Number(weights[id]) || 0), 0);
  if (total <= 0) {
    const even = 1 / channelIds.length;
    return Object.fromEntries(channelIds.map((id) => [id, even]));
  }
  return Object.fromEntries(channelIds.map((id) => [id, Math.max(0, Number(weights[id]) || 0) / total]));
}

export function stepMarketing(state, decisions, industry, marketingData, rng, teamEffects = {}, competitorEffects = {}) {
  const channelIds = Object.keys(marketingData.channels);
  const shares = normalizedWeights(state.marketing.channelWeights, channelIds);
  const totalSpend = Math.max(0, Number(decisions.marketingSpend) || 0);
  const satisfaction = state.customers.satisfaction;

  let totalAcquired = 0;
  let awarenessGain = 0;
  let b2bLeads = 0;
  const channels = {};
  const nextStrengths = { ...state.marketing.channelStrengths };

  const baseEfficiency = clamp(
    marketingData.efficiency.base +
      satisfaction * marketingData.efficiency.satisfactionWeight +
      (teamEffects.marketingEfficiencyAdd || 0) * marketingData.efficiency.teamWeight,
    marketingData.efficiency.min,
    marketingData.efficiency.max
  );

  for (const id of channelIds) {
    const cfg = marketingData.channels[id];
    const budget = totalSpend * shares[id];
    const priorStrength = state.marketing.channelStrengths[id] || 1;
    const saturationExcess = Math.max(0, budget - cfg.saturationSpend) / Math.max(1, cfg.saturationSpend);
    const saturationPenalty = 1 + saturationExcess * cfg.saturationSlope;
    const strength = clamp(
      priorStrength * cfg.strengthDecay + (budget / 100) * cfg.strengthGrowthPer100,
      marketingData.strength.min,
      marketingData.strength.max
    );
    nextStrengths[id] = strength;

    const competitorCAC = competitorEffects.cacMultiplier || 1;
    const effectiveCAC = Math.max(
      0.5,
      cfg.baseCAC * saturationPenalty * competitorCAC / Math.max(0.2, baseEfficiency * strength)
    );
    const acquisitionNoise = clamp(rng.normal(1, cfg.noiseStd), 0.55, 1.55);
    let acquired = budget > 0 ? (budget / effectiveCAC) * acquisitionNoise : 0;

    if (cfg.audienceCapRate) {
      acquired = Math.min(acquired, state.customers.active * cfg.audienceCapRate);
    }

    const channelAwareness =
      cfg.awarenessPer100 *
      Math.pow(Math.max(0, budget) / 100, 0.72) *
      strength;

    const channelB2BLeads = (budget / 100) * cfg.b2bLeadsPer100 * strength;

    const grossContributionPerCustomer =
      Math.max(0, industry.referencePrice - industry.baseVariableCostPerOrder) *
      industry.purchaseFrequency *
      marketingData.roasContributionWeeks;
    const estimatedRevenueContribution = acquired * grossContributionPerCustomer;
    const estimatedROAS = budget > 0 ? estimatedRevenueContribution / budget : 0;

    channels[id] = {
      budget,
      share: shares[id],
      acquired,
      effectiveCAC,
      awarenessGain: channelAwareness,
      b2bLeads: channelB2BLeads,
      strength,
      estimatedROAS
    };

    totalAcquired += acquired;
    awarenessGain += channelAwareness;
    b2bLeads += channelB2BLeads;
  }

  const effectiveCAC = totalAcquired > 0 ? totalSpend / totalAcquired : 0;
  const estimatedROAS = totalSpend > 0
    ? Object.values(channels).reduce((sum, x) => sum + x.estimatedROAS * x.budget, 0) / totalSpend
    : 0;

  return {
    ...state.marketing,
    channelStrengths: nextStrengths,
    last: {
      totalSpend,
      totalAcquired,
      effectiveCAC,
      awarenessGain,
      b2bLeads,
      estimatedROAS,
      channels
    }
  };
}
