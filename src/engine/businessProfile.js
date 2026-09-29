export function negotiationForIndustry(baseConfig, industry) {
  const overrides = industry.negotiation || {};
  return {
    ...baseConfig,
    templates: {
      ...baseConfig.templates,
      ...Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key,
          { ...baseConfig.templates[key], ...value }
        ])
      )
    }
  };
}

export function locationOptions(config, industry) {
  const allowed = industry.allowedLocations || Object.keys(config.locations);
  return allowed
    .filter((id) => config.locations[id])
    .map((id) => ({
      id,
      ...config.locations[id],
      label: industry.locationLabels?.[id] || config.locations[id].label
    }));
}

export function industryPlanDefaults(industry) {
  return {
    idea: industry.starterPlan?.idea || ('A focused ' + industry.name + ' with a clear customer problem and disciplined unit economics.'),
    targetCustomer: industry.starterPlan?.targetCustomer || 'A specific customer segment with a recurring need and willingness to pay.',
    price: industry.referencePrice,
    weeklyFixedCostEstimate: industry.starterPlan?.weeklyFixedCostEstimate ?? industry.baseFixedCostPerWeek,
    variableCostEstimate: industry.starterPlan?.variableCostEstimate ?? industry.baseVariableCostPerOrder
  };
}
