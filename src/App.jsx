import React, { useState } from 'react';
import gameConfig from './config/gameConfig.json';
import industryCatalog from './data/industryCatalog.json';

import cafe from './data/industries/cafe.json';
import softwareSaas from './data/industries/softwareSaas.json';
import dairyFarm from './data/industries/dairyFarm.json';
import carDealership from './data/industries/carDealership.json';
import autoWorkshop from './data/industries/autoWorkshop.json';

import cafeRoles from './data/hr/cafeRoles.json';
import softwareRoles from './data/hr/softwareRoles.json';
import dairyRoles from './data/hr/dairyRoles.json';
import carDealershipRoles from './data/hr/carDealershipRoles.json';
import autoWorkshopRoles from './data/hr/autoWorkshopRoles.json';

import baseNegotiationConfig from './data/negotiation/negotiationConfig.json';

import cafeMarketing from './data/marketing/cafeMarketing.json';
import softwareMarketing from './data/marketing/softwareMarketing.json';
import dairyMarketing from './data/marketing/dairyMarketing.json';
import carDealershipMarketing from './data/marketing/carDealershipMarketing.json';
import autoWorkshopMarketing from './data/marketing/autoWorkshopMarketing.json';

import cafeSales from './data/sales/cafeSales.json';
import softwareSales from './data/sales/softwareSales.json';
import dairySales from './data/sales/dairySales.json';
import carDealershipSales from './data/sales/carDealershipSales.json';
import autoWorkshopSales from './data/sales/autoWorkshopSales.json';

import cafeOperations from './data/operations/cafeOperations.json';
import softwareOperations from './data/operations/softwareOperations.json';
import dairyOperations from './data/operations/dairyOperations.json';
import carDealershipOperations from './data/operations/carDealershipOperations.json';
import autoWorkshopOperations from './data/operations/autoWorkshopOperations.json';

import cafeCompetitors from './data/competitors/cafeCompetitors.json';
import softwareCompetitors from './data/competitors/softwareCompetitors.json';
import dairyCompetitors from './data/competitors/dairyCompetitors.json';
import carDealershipCompetitors from './data/competitors/carDealershipCompetitors.json';
import autoWorkshopCompetitors from './data/competitors/autoWorkshopCompetitors.json';

import genericFunding from './data/funding/cafeFunding.json';
import cafeLegal from './data/legal/cafeLegal.json';
import softwareLegal from './data/legal/softwareLegal.json';
import dairyLegal from './data/legal/dairyLegal.json';
import carDealershipLegal from './data/legal/carDealershipLegal.json';
import autoWorkshopLegal from './data/legal/autoWorkshopLegal.json';
import genericRisk from './data/risk/cafeRisk.json';
import cafeExpansion from './data/expansion/cafeExpansion.json';
import softwareExpansion from './data/expansion/softwareExpansion.json';
import dairyExpansion from './data/expansion/dairyExpansion.json';
import carDealershipExpansion from './data/expansion/carDealershipExpansion.json';
import autoWorkshopExpansion from './data/expansion/autoWorkshopExpansion.json';
import genericExit from './data/exit/cafeExit.json';
import indiaAssets from './data/assets/indiaAssets.json';

import { createGameState } from './models/createGameState.js';
import { advanceWeek } from './engine/simulator.js';
import { applyHrAction } from './engine/hiring.js';
import { applyNegotiationAction } from './engine/negotiation.js';
import { applyMarketingAction } from './engine/marketing.js';
import { applySalesAction } from './engine/sales.js';
import { applyOperationsAction } from './engine/operations.js';
import { applyFundingAction } from './engine/funding.js';
import { applyLegalAction } from './engine/legal.js';
import { applyRiskAction } from './engine/risk.js';
import { applyExpansionAction } from './engine/expansion.js';
import { applyExitAction } from './engine/exit.js';
import { applyAssetAction } from './engine/assets.js';
import { negotiationForIndustry } from './engine/businessProfile.js';
import { recordDecision } from './engine/logging.js';
import SetupFlow from './components/SetupFlow.jsx';
import Dashboard from './components/Dashboard.jsx';

const profiles = {
  cafe: {
    industry: cafe,
    roles: cafeRoles,
    marketing: cafeMarketing,
    sales: cafeSales,
    operations: cafeOperations,
    competitors: cafeCompetitors,
    legal: cafeLegal,
    expansion: cafeExpansion
  },
  software_saas: {
    industry: softwareSaas,
    roles: softwareRoles,
    marketing: softwareMarketing,
    sales: softwareSales,
    operations: softwareOperations,
    competitors: softwareCompetitors,
    legal: softwareLegal,
    expansion: softwareExpansion
  },
  dairy_farm: {
    industry: dairyFarm,
    roles: dairyRoles,
    marketing: dairyMarketing,
    sales: dairySales,
    operations: dairyOperations,
    competitors: dairyCompetitors,
    legal: dairyLegal,
    expansion: dairyExpansion
  },
  car_dealership: {
    industry: carDealership,
    roles: carDealershipRoles,
    marketing: carDealershipMarketing,
    sales: carDealershipSales,
    operations: carDealershipOperations,
    competitors: carDealershipCompetitors,
    legal: carDealershipLegal,
    expansion: carDealershipExpansion
  },
  auto_workshop: {
    industry: autoWorkshop,
    roles: autoWorkshopRoles,
    marketing: autoWorkshopMarketing,
    sales: autoWorkshopSales,
    operations: autoWorkshopOperations,
    competitors: autoWorkshopCompetitors,
    legal: autoWorkshopLegal,
    expansion: autoWorkshopExpansion
  }
};

const industryOptions = industryCatalog.presets.map((item) => ({
  ...item,
  industry: profiles[item.id].industry
}));

function runtimeFromSetup(setup) {
  const profile = profiles[setup.simulationProfileId || setup.industryId] || profiles.cafe;
  const industry = setup.customIndustry || profiles[setup.industryId]?.industry || profile.industry;
  return runtimeFromParts(profile, industry);
}

function runtimeFromGame(game) {
  const profile = profiles[game.simulationProfileId || game.industryId] || profiles.cafe;
  const industry = game.customIndustry || profiles[game.industryId]?.industry || profile.industry;
  return runtimeFromParts(profile, industry);
}

function runtimeFromParts(profile, industry) {
  return {
    industry,
    rolesData: profile.roles,
    negotiationConfig: negotiationForIndustry(baseNegotiationConfig, industry),
    phase4Data: {
      marketing: profile.marketing,
      sales: profile.sales,
      operations: profile.operations,
      competitors: profile.competitors
    },
    phase5Data: {
      funding: genericFunding,
      legal: profile.legal,
      risk: genericRisk,
      expansion: profile.expansion,
      exit: genericExit,
      assets: indiaAssets
    }
  };
}

export default function App() {
  const [game, setGame] = useState(null);

  const start = (setup) => {
    const runtime = runtimeFromSetup(setup);
    setGame(
      createGameState(
        setup,
        gameConfig,
        runtime.industry,
        runtime.rolesData,
        Date.now() % 2147483647,
        runtime.phase4Data,
        runtime.phase5Data
      )
    );
  };

  const transition = (category, action, options, reducer) => {
    setGame((current) => {
      const next = reducer(current);
      return recordDecision(current, next, category, action, options);
    });
  };

  const nextWeek = (decisions) => transition(
    'weekly-operations',
    decisions,
    ['Price', 'Marketing budget', 'Quality/service budget'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return advanceWeek(
        current,
        decisions,
        gameConfig,
        runtime.industry,
        runtime.rolesData,
        runtime.phase4Data,
        runtime.phase5Data
      );
    }
  );

  const hrAction = (action) => transition(
    'hr',
    action,
    ['Interview', 'Reference check', 'Trial', 'Training', 'Review', 'Raise', 'Promotion', 'Work mode', 'Termination'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyHrAction(current, action, gameConfig, runtime.rolesData);
    }
  );

  const negotiationAction = (action) => transition(
    'negotiation',
    action,
    ['Prepare', 'Anchor', 'Split difference', 'Bundle terms', 'Deadline', 'Ask for information', 'Walk away'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyNegotiationAction(current, action, runtime.negotiationConfig, runtime.rolesData);
    }
  );

  const marketingAction = (action) => transition(
    'marketing',
    action,
    ['Change channel allocation'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyMarketingAction(current, action, runtime.phase4Data.marketing);
    }
  );

  const salesAction = (action) => transition(
    'sales',
    action,
    ['Outbound spend', 'Discount rate', 'Commission rate', 'Pricing model'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applySalesAction(current, action, runtime.phase4Data.sales);
    }
  );

  const operationsAction = (action) => transition(
    'operations',
    action,
    ['Process mode', 'Quality control', 'Inventory/production policy', 'Outsource share'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyOperationsAction(current, action, runtime.phase4Data.operations);
    }
  );

  const fundingAction = (action) => transition(
    'funding',
    action,
    ['Founder capital', 'Loan', 'Grant', 'Crowdfunding', 'Angel', 'VC', 'ESOP pool', 'Accept/reject term sheet'],
    (current) => applyFundingAction(current, action, genericFunding)
  );

  const legalAction = (action) => transition(
    'legal',
    action,
    ['Start or renew a compliance item'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyLegalAction(current, action, runtime.phase5Data.legal);
    }
  );

  const riskAction = (action) => transition(
    'risk',
    action,
    ['Insurance', 'Preventive control', 'Emergency reserve'],
    (current) => applyRiskAction(current, action, genericRisk)
  );

  const expansionAction = (action) => transition(
    'expansion',
    action,
    ['Start growth project'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyExpansionAction(current, action, runtime.phase5Data.expansion);
    }
  );

  const exitAction = (action) => transition(
    'exit',
    action,
    ['Prepare succession', 'Request broker review', 'Accept sale', 'Reject sale'],
    (current) => applyExitAction(current, action, genericExit)
  );

  const assetAction = (action) => transition(
    'assets',
    action,
    ['Buy fixed asset', 'Sell fixed asset', 'Invest treasury cash', 'Liquidate treasury investment'],
    (current) => {
      const runtime = runtimeFromGame(current);
      return applyAssetAction(current, action, runtime.phase5Data.assets);
    }
  );

  if (!game) {
    return <SetupFlow config={gameConfig} industryOptions={industryOptions} catalog={industryCatalog} onStart={start} />;
  }

  const runtime = runtimeFromGame(game);

  return (
    <Dashboard
      state={game}
      config={gameConfig}
      industry={runtime.industry}
      rolesData={runtime.rolesData}
      negotiationConfig={runtime.negotiationConfig}
      phase4Data={runtime.phase4Data}
      phase5Data={runtime.phase5Data}
      onAdvance={nextWeek}
      onHrAction={hrAction}
      onNegotiationAction={negotiationAction}
      onMarketingAction={marketingAction}
      onSalesAction={salesAction}
      onOperationsAction={operationsAction}
      onFundingAction={fundingAction}
      onLegalAction={legalAction}
      onRiskAction={riskAction}
      onExpansionAction={expansionAction}
      onExitAction={exitAction}
      onAssetAction={assetAction}
      onReset={() => setGame(null)}
    />
  );
}
