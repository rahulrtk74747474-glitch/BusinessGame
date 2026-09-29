import { clamp } from './random.js';

export function createSalesState(salesData) {
  return {
    settings: { ...salesData.defaults },
    pipeline: { leads: 0, qualified: 0, proposals: 0 },
    activeDeals: [],
    nextDealId: 1,
    last: {
      newLeads: 0,
      qualified: 0,
      proposals: 0,
      wins: 0,
      revenue: 0,
      variableCosts: 0,
      commissionCost: 0,
      outboundSpend: salesData.defaults.outboundSpend,
      closeRate: 0,
      pipelineValue: 0,
      activeDealCount: 0
    },
    lastRipple: null
  };
}

export function applySalesAction(state, action, salesData) {
  if (state.status !== 'running') return state;
  if (action.type !== 'setSalesSetting') return state;

  const nextSettings = { ...state.sales.settings };
  if (action.key === 'outboundSpend') {
    nextSettings.outboundSpend = clamp(Number(action.value) || 0, 0, salesData.limits.outboundSpendMax);
  } else if (action.key === 'discountRate') {
    nextSettings.discountRate = clamp(Number(action.value) || 0, 0, salesData.limits.discountRateMax);
  } else if (action.key === 'commissionRate') {
    nextSettings.commissionRate = clamp(
      Number(action.value) || 0,
      salesData.limits.commissionRateMin,
      salesData.limits.commissionRateMax
    );
  } else if (action.key === 'pricingModel' && salesData.pricingModels[action.value]) {
    nextSettings.pricingModel = action.value;
  } else {
    return state;
  }

  return {
    ...state,
    sales: {
      ...state.sales,
      settings: nextSettings,
      lastRipple: {
        title: 'Sales policy changed',
        nodes: [
          'Sales: conversion economics change',
          'Finance: selling cost or revenue per win changes',
          'Operations: future delivery load may change',
          'Customers: pricing expectations may shift'
        ]
      }
    }
  };
}

export function stepSales(state, salesData, marketingEffects, teamEffects, competitorEffects, operationsEffects, rng) {
  const settings = state.sales.settings;
  const pricing = salesData.pricingModels[settings.pricingModel];
  const teamEfficiency = 1 + (teamEffects.salesEfficiencyAdd || 0) * salesData.teamEfficiencyWeight;
  const competitorPenalty = clamp(
    1 - (competitorEffects.pressureIndex || 0) * salesData.competitorPressureWeight,
    0.55,
    1.05
  );
  const operationsTrust = clamp(operationsEffects.reliabilitySignal || 1, 0.65, 1.08);

  const marketingLeads = (marketingEffects.b2bLeads || 0) * salesData.marketingB2BLeadWeight;
  const outboundLeads =
    settings.outboundSpend > 0
      ? (settings.outboundSpend / salesData.leadCost) * teamEfficiency
      : 0;
  const newLeads = Math.max(
    0,
    (marketingLeads + outboundLeads) * clamp(rng.normal(1, salesData.leadNoiseStd), 0.7, 1.3)
  );

  const qualified = Math.max(
    0,
    state.sales.pipeline.leads *
      salesData.qualificationRate *
      teamEfficiency *
      competitorPenalty *
      operationsTrust
  );

  const proposals = Math.max(
    0,
    state.sales.pipeline.qualified *
      salesData.proposalRate *
      (0.9 + 0.1 * teamEfficiency)
  );

  const closeLiftFromDiscount = 1 + settings.discountRate * salesData.discountCloseLift;
  const commissionMotivation = 1 + settings.commissionRate * salesData.commissionMotivationWeight;
  const closeRate = clamp(
    salesData.baseCloseRate *
      pricing.closeMultiplier *
      closeLiftFromDiscount *
      commissionMotivation *
      competitorPenalty *
      operationsTrust *
      clamp(rng.normal(1, salesData.closeNoiseStd), 0.75, 1.25),
    0.02,
    0.75
  );

  const wins = Math.max(0, state.sales.pipeline.proposals * closeRate);
  const discountedWeeklyValue =
    salesData.averageDealValue *
    pricing.weeklyValueMultiplier *
    (1 - settings.discountRate);
  const newWeeklyRevenue = wins * discountedWeeklyValue;

  let recurringRevenue = 0;
  const activeDeals = [];
  for (const deal of state.sales.activeDeals) {
    if (deal.remainingWeeks <= 0) continue;
    recurringRevenue += deal.weeklyRevenue;
    if (deal.remainingWeeks > 1) {
      activeDeals.push({ ...deal, remainingWeeks: deal.remainingWeeks - 1 });
    }
  }

  if (newWeeklyRevenue > 0 && pricing.durationWeeks > 1) {
    activeDeals.push({
      id: state.sales.nextDealId,
      weeklyRevenue: newWeeklyRevenue,
      remainingWeeks: pricing.durationWeeks - 1,
      model: settings.pricingModel
    });
  }

  const revenue = recurringRevenue + newWeeklyRevenue;
  const variableCosts = revenue * salesData.variableCostRate;
  const commissionCost = revenue * settings.commissionRate;
  const pipelineValue =
    proposals *
    salesData.averageDealValue *
    pricing.weeklyValueMultiplier *
    pricing.durationWeeks *
    (1 - settings.discountRate);

  return {
    ...state.sales,
    pipeline: { leads: newLeads, qualified, proposals },
    activeDeals,
    nextDealId: state.sales.nextDealId + (newWeeklyRevenue > 0 && pricing.durationWeeks > 1 ? 1 : 0),
    last: {
      newLeads,
      qualified,
      proposals,
      wins,
      revenue,
      variableCosts,
      commissionCost,
      outboundSpend: settings.outboundSpend,
      closeRate,
      pipelineValue,
      activeDealCount: activeDeals.length
    }
  };
}
