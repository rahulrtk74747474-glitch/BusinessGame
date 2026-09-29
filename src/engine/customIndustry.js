import { clamp } from './random.js';

const archetypeDefaults = {
  service: {
    category: 'Custom service',
    price: 75,
    variableCost: 12,
    fixedCost: 1200,
    capacity: 120,
    marketDemand: 200,
    initialCustomers: 18,
    purchaseFrequency: 1,
    churn: 0.04,
    basePaidCAC: 65,
    profileId: 'software_saas'
  },
  product: {
    category: 'Custom product business',
    price: 20,
    variableCost: 8,
    fixedCost: 1300,
    capacity: 450,
    marketDemand: 650,
    initialCustomers: 70,
    purchaseFrequency: 1.2,
    churn: 0.05,
    basePaidCAC: 18,
    profileId: 'cafe'
  },
  agriculture: {
    category: 'Custom agriculture business',
    price: 1.5,
    variableCost: 0.8,
    fixedCost: 1500,
    capacity: 4000,
    marketDemand: 5200,
    initialCustomers: 180,
    purchaseFrequency: 8,
    churn: 0.03,
    basePaidCAC: 22,
    profileId: 'dairy_farm'
  }
};

export function customDefaults(archetype = 'service') {
  return { ...archetypeDefaults[archetype] };
}

export function buildCustomIndustry(input) {
  const archetype = input.archetype || 'service';
  const defaults = archetypeDefaults[archetype] || archetypeDefaults.service;
  const price = Math.max(0.25, Number(input.price) || defaults.price);
  const variableCost = clamp(Number(input.variableCost) || defaults.variableCost, 0, price * 0.95);
  const fixedCost = Math.max(0, Number(input.fixedCost) || defaults.fixedCost);
  const capacity = Math.max(10, Number(input.capacity) || defaults.capacity);
  const marketDemand = Math.max(capacity * 0.7, Number(input.marketDemand) || defaults.marketDemand);
  const businessName = (input.businessName || 'My Custom Business').trim();

  return {
    id: 'custom',
    name: businessName,
    category: input.category?.trim() || defaults.category,
    description: 'A custom business generated from your own unit economics. The engine uses a ' + archetype + ' operating model while preserving the price, cost, capacity and demand assumptions you entered.',
    unitLabel: input.unitLabel?.trim() || (archetype === 'service' ? 'service units / subscriptions' : archetype === 'agriculture' ? 'production units' : 'units sold'),
    customerLabel: 'customers',
    operationsLabel: archetype === 'service' ? 'Delivery capacity & systems' : archetype === 'agriculture' ? 'Production & distribution' : 'Inventory & fulfillment',
    inventoryLabel: archetype === 'service' ? 'No physical inventory' : archetype === 'agriculture' ? 'Produced inventory' : 'Inventory',
    referencePrice: price,
    priceElasticity: archetype === 'agriculture' ? 0.8 : archetype === 'service' ? 1.1 : 1.35,
    baseMarketDemand: marketDemand,
    weeklyNewCustomerPool: Math.max(25, marketDemand * 0.18),
    organicConversionRate: archetype === 'service' ? 0.14 : 0.2,
    basePaidCAC: Number(input.basePaidCAC) || defaults.basePaidCAC,
    baseVariableCostPerOrder: variableCost,
    baseFixedCostPerWeek: fixedCost,
    capacityOrdersPerWeek: capacity,
    initialCustomers: Math.max(5, Number(input.initialCustomers) || defaults.initialCustomers),
    initialAwareness: 0.16,
    initialSatisfaction: 0.7,
    purchaseFrequency: Math.max(0.2, Number(input.purchaseFrequency) || defaults.purchaseFrequency),
    baseWeeklyChurn: defaults.churn,
    referralRate: 0.035,
    qualitySpendReference: Math.max(80, fixedCost * 0.15),
    qualitySpendEffect: 0.13,
    serviceBaseline: 0.72,
    marketingEfficiencyCeiling: 1.28,
    seasonalityMonthly: [0.97,0.98,1,1.02,1.03,1.01,0.98,0.99,1.02,1.05,1.06,1.04],
    allowedLocations: archetype === 'agriculture' ? ['home','coworking','rented'] : ['home','coworking','rented','online'],
    locationLabels: archetype === 'service'
      ? { home:'Home office', coworking:'Shared office', rented:'Leased office/shop', online:'Online / remote-first' }
      : archetype === 'agriculture'
        ? { home:'Owned/home site', coworking:'Shared production facility', rented:'Leased commercial site' }
        : { home:'Home-based', coworking:'Shared facility', rented:'Rented shop/factory', online:'Online-first' },
    starterPlan: {
      idea: businessName + ' serving a defined customer problem with clear unit economics.',
      targetCustomer: input.targetCustomer?.trim() || 'A specific customer group with a recurring need and willingness to pay.',
      weeklyFixedCostEstimate: fixedCost,
      variableCostEstimate: variableCost
    },
    negotiation: {
      supplier: {
        label: archetype === 'service' ? 'Infrastructure / contractor supplier' : 'Primary supplier',
        unit: '$/order',
        initialCounter: variableCost,
        playerOpening: variableCost * 0.82,
        walkAwayMin: variableCost * 0.84,
        walkAwayMax: variableCost * 0.94,
        bundleLabel: 'Longer commitment + better payment terms'
      },
      client: {
        label: 'Large business client',
        initialCounter: price * Math.max(10, capacity * 0.06),
        playerOpening: price * Math.max(14, capacity * 0.085),
        walkAwayMin: price * Math.max(11, capacity * 0.068),
        walkAwayMax: price * Math.max(13, capacity * 0.08),
        bundleLabel: 'Volume commitment + service terms',
        clientVariableCostRate: price > 0 ? variableCost / price : 0.4
      }
    },
    regulations: ['Business registration/tax','Contracts and consumer/customer rules','Employment obligations','Industry-specific local compliance'],
    typicalFailureModes: ['Weak demand validation','Poor unit economics','Growing fixed costs too quickly','Cash-flow mismatch','Ignoring compliance or operational risk'],
    kpis: ['revenue','gross margin','CAC','customers','capacity utilization','runway'],
    customArchetype: archetype,
    simulationProfileId: defaults.profileId
  };
}
