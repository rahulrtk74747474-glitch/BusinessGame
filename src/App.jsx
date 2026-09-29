import React, { useState } from 'react';
import gameConfig from './config/gameConfig.json';
import cafe from './data/industries/cafe.json';
import cafeRoles from './data/hr/cafeRoles.json';
import negotiationConfig from './data/negotiation/negotiationConfig.json';
import cafeMarketing from './data/marketing/cafeMarketing.json';
import cafeSales from './data/sales/cafeSales.json';
import cafeOperations from './data/operations/cafeOperations.json';
import cafeCompetitors from './data/competitors/cafeCompetitors.json';
import cafeFunding from './data/funding/cafeFunding.json';
import cafeLegal from './data/legal/cafeLegal.json';
import cafeRisk from './data/risk/cafeRisk.json';
import cafeExpansion from './data/expansion/cafeExpansion.json';
import cafeExit from './data/exit/cafeExit.json';
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
import { recordDecision } from './engine/logging.js';
import SetupFlow from './components/SetupFlow.jsx';
import Dashboard from './components/Dashboard.jsx';

const phase4Data = {
  marketing: cafeMarketing,
  sales: cafeSales,
  operations: cafeOperations,
  competitors: cafeCompetitors
};

const phase5Data = {
  funding: cafeFunding,
  legal: cafeLegal,
  risk: cafeRisk,
  expansion: cafeExpansion,
  exit: cafeExit
};

export default function App() {
  const [game, setGame] = useState(null);

  const start = (setup) => setGame(
    createGameState(
      setup,
      gameConfig,
      cafe,
      cafeRoles,
      Date.now() % 2147483647,
      phase4Data,
      phase5Data
    )
  );

  const transition = (category, action, options, reducer) => {
    setGame((current) => {
      const next = reducer(current);
      return recordDecision(current, next, category, action, options);
    });
  };

  const nextWeek = (decisions) => transition(
    'weekly-operations',
    decisions,
    [
      'Price within configured range',
      'Marketing budget within configured range',
      'Quality/service budget within configured range'
    ],
    (current) => advanceWeek(
      current,
      decisions,
      gameConfig,
      cafe,
      cafeRoles,
      phase4Data,
      phase5Data
    )
  );

  const hrAction = (action) => transition(
    'hr',
    action,
    ['Interview', 'Reference check', 'Trial', 'Training', 'Review', 'Raise', 'Promotion', 'Work mode', 'Termination'],
    (current) => applyHrAction(current, action, gameConfig, cafeRoles)
  );

  const negotiationAction = (action) => transition(
    'negotiation',
    action,
    ['Prepare', 'Anchor', 'Split difference', 'Bundle terms', 'Deadline', 'Ask for information', 'Walk away'],
    (current) => applyNegotiationAction(current, action, negotiationConfig, cafeRoles)
  );

  const marketingAction = (action) => transition(
    'marketing',
    action,
    Object.keys(cafeMarketing.channels),
    (current) => applyMarketingAction(current, action, cafeMarketing)
  );

  const salesAction = (action) => transition(
    'sales',
    action,
    ['Outbound spend', 'Discount rate', 'Commission rate', 'Pricing model'],
    (current) => applySalesAction(current, action, cafeSales)
  );

  const operationsAction = (action) => transition(
    'operations',
    action,
    ['Process mode', 'Quality control', 'Reorder point', 'Order quantity', 'Outsource share'],
    (current) => applyOperationsAction(current, action, cafeOperations)
  );

  const fundingAction = (action) => transition(
    'funding',
    action,
    ['Founder capital', 'Loan', 'Grant', 'Crowdfunding', 'Angel', 'VC', 'ESOP pool', 'Accept/reject term sheet'],
    (current) => applyFundingAction(current, action, cafeFunding)
  );

  const legalAction = (action) => transition(
    'legal',
    action,
    Object.keys(cafeLegal.items),
    (current) => applyLegalAction(current, action, cafeLegal)
  );

  const riskAction = (action) => transition(
    'risk',
    action,
    [...Object.keys(cafeRisk.policies), ...Object.keys(cafeRisk.controls), 'Emergency reserve'],
    (current) => applyRiskAction(current, action, cafeRisk)
  );

  const expansionAction = (action) => transition(
    'expansion',
    action,
    Object.keys(cafeExpansion.projects),
    (current) => applyExpansionAction(current, action, cafeExpansion)
  );

  const exitAction = (action) => transition(
    'exit',
    action,
    ['Prepare succession', 'Request broker review', 'Accept sale', 'Reject sale'],
    (current) => applyExitAction(current, action, cafeExit)
  );

  if (!game) return <SetupFlow config={gameConfig} industry={cafe} onStart={start} />;

  return (
    <Dashboard
      state={game}
      config={gameConfig}
      industry={cafe}
      rolesData={cafeRoles}
      negotiationConfig={negotiationConfig}
      phase4Data={phase4Data}
      phase5Data={phase5Data}
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
      onReset={() => setGame(null)}
    />
  );
}
