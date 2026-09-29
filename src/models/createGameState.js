import { scoreBusinessPlan } from '../engine/businessPlan.js';
import { generateCandidatePool } from '../engine/hiring.js';
import { createMarketingState } from '../engine/marketing.js';
import { createSalesState } from '../engine/sales.js';
import { createOperationsState } from '../engine/operations.js';
import { createCompetitorState } from '../engine/competitors.js';
import { createFundingState } from '../engine/funding.js';
import { createLegalState } from '../engine/legal.js';
import { createRiskState } from '../engine/risk.js';
import { createExpansionState } from '../engine/expansion.js';
import { createExitState } from '../engine/exit.js';

export function createGameState(setup, config, industry, rolesData, seed = 42, phase4Data, phase5Data) {
  if (!phase4Data?.marketing || !phase4Data?.sales || !phase4Data?.operations || !phase4Data?.competitors) {
    throw new Error('Phase 4 data modules are required to create the game state.');
  }
  if (!phase5Data?.funding || !phase5Data?.legal || !phase5Data?.risk || !phase5Data?.expansion || !phase5Data?.exit) {
    throw new Error('Phase 5 data modules are required to create the game state.');
  }

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
    simulationProfileId: setup.simulationProfileId || industry.id,
    customIndustry: setup.customIndustry || null,
    startPath: setup.startPath || 'scratch',
    structureId: setup.structure,
    locationId: setup.location,
    plan: setup.plan,
    planScore: planResult.score,
    planFeedback: planResult.feedback,
    decisions: { price: initialPrice, marketingSpend: config.initialDecisions.marketingSpend, qualitySpend: config.initialDecisions.qualitySpend },
    market: { economicIndex: 1, trendIndex: 1, seasonality: 1, marketDemand: industry.baseMarketDemand },
    customers: {
      active: industry.initialCustomers * location.awarenessModifier,
      awareness: industry.initialAwareness * location.awarenessModifier,
      satisfaction: industry.initialSatisfaction,
      marketShare: 0,
      churnRate: industry.baseWeeklyChurn,
      effectiveCAC: industry.basePaidCAC,
      estimatedLtv: 0,
      orders: 0,
      capacity: industry.capacityOrdersPerWeek * location.capacityMultiplier
    },
    finance: {
      cash: Number(setup.startingCapital),
      startingCapital: Number(setup.startingCapital),
      revenue: 0, coreRevenue: 0, clientRevenue: 0, salesRevenue: 0, expansionRevenue: 0,
      variableCosts: 0,
      fixedCosts: industry.baseFixedCostPerWeek * location.fixedCostMultiplier + structure.weeklyAdminCost,
      discretionaryCosts: 0, payrollCosts: 0,
      hrOneTimeExpenses: 0, negotiationOneTimeExpenses: 0, fundingOneTimeExpenses: 0, legalOneTimeExpenses: 0, riskOneTimeExpenses: 0, exitOneTimeExpenses: 0,
      inventoryPurchases: 0,
      inventoryAsset: (phase4Data.operations.inventoryMode === 'virtual' ? 0 : phase4Data.operations.initialInventoryUnits) * industry.baseVariableCostPerOrder,
      expansionAssets: 0, grossProfit: 0, grossMargin: 0, operatingProfit: 0, interestExpense: 0, debtService: 0,
      taxAccrued: 0, taxPayment: 0, taxPayable: 0, netProfit: 0, cumulativeRevenue: 0, cumulativeProfit: 0,
      runwayWeeks: Infinity, valuation: Number(setup.startingCapital), totalLiquidity: Number(setup.startingCapital),
      debtBalance: 0, totalAssets: Number(setup.startingCapital), totalLiabilities: 0, bookEquity: Number(setup.startingCapital)
    },
    hr: {
      employees: [], candidates: generateCandidatePool(seed, rolesData, 0), trials: [], benefitsPerEmployee: 0, refreshCount: 0,
      nextEmployeeId: 1, pendingExpenseRecognition: 0, managerQuality: rolesData.baseFounderManagerQuality,
      averageProductivity: 0, averageMorale: 0, averageBurnout: 0, legalRisk: 0, transactions: [], events: [], lastRipple: null
    },
    negotiation: {
      active: null, nextSessionId: 1, relationships: { supplier: 0, landlord: 0, client: 0, investor: 0 }, history: [],
      pendingExpenseRecognition: 0,
      contracts: {
        supplierUnitCost: null, supplierRemainingWeeks: 0, landlordWeeklySavings: 0, landlordRemainingWeeks: 0,
        clientWeeklyRevenue: 0, clientVariableCostRate: 0, clientRemainingWeeks: 0, investorIndicativeValuation: null
      },
      lastRipple: null
    },
    marketing: createMarketingState(phase4Data.marketing),
    sales: createSalesState(phase4Data.sales),
    operations: createOperationsState(industry, phase4Data.operations),
    competitors: createCompetitorState(industry, phase4Data.competitors),
    funding: createFundingState(Number(setup.startingCapital), phase5Data.funding),
    legal: createLegalState(phase5Data.legal),
    risk: createRiskState(),
    expansion: createExpansionState(),
    exit: createExitState(),
    audit: { decisions: [], events: [], causeLinks: [] },
    history: [],
    reports: []
  };
}
