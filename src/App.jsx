import React, { useState } from 'react';
import gameConfig from './config/gameConfig.json';
import cafe from './data/industries/cafe.json';
import cafeRoles from './data/hr/cafeRoles.json';
import negotiationConfig from './data/negotiation/negotiationConfig.json';
import cafeMarketing from './data/marketing/cafeMarketing.json';
import cafeSales from './data/sales/cafeSales.json';
import cafeOperations from './data/operations/cafeOperations.json';
import cafeCompetitors from './data/competitors/cafeCompetitors.json';
import { createGameState } from './models/createGameState.js';
import { advanceWeek } from './engine/simulator.js';
import { applyHrAction } from './engine/hiring.js';
import { applyNegotiationAction } from './engine/negotiation.js';
import { applyMarketingAction } from './engine/marketing.js';
import { applySalesAction } from './engine/sales.js';
import { applyOperationsAction } from './engine/operations.js';
import SetupFlow from './components/SetupFlow.jsx';
import Dashboard from './components/Dashboard.jsx';

const phase4Data = {
  marketing: cafeMarketing,
  sales: cafeSales,
  operations: cafeOperations,
  competitors: cafeCompetitors
};

export default function App() {
  const [game, setGame] = useState(null);

  const start = (setup) => setGame(createGameState(setup, gameConfig, cafe, cafeRoles, Date.now() % 2147483647, phase4Data));
  const nextWeek = (decisions) => setGame((current) => advanceWeek(current, decisions, gameConfig, cafe, cafeRoles, phase4Data));
  const hrAction = (action) => setGame((current) => applyHrAction(current, action, gameConfig, cafeRoles));
  const negotiationAction = (action) => setGame((current) => applyNegotiationAction(current, action, negotiationConfig, cafeRoles));
  const marketingAction = (action) => setGame((current) => applyMarketingAction(current, action, cafeMarketing));
  const salesAction = (action) => setGame((current) => applySalesAction(current, action, cafeSales));
  const operationsAction = (action) => setGame((current) => applyOperationsAction(current, action, cafeOperations));

  if (!game) return <SetupFlow config={gameConfig} industry={cafe} onStart={start} />;
  return (
    <Dashboard
      state={game}
      config={gameConfig}
      industry={cafe}
      rolesData={cafeRoles}
      negotiationConfig={negotiationConfig}
      phase4Data={phase4Data}
      onAdvance={nextWeek}
      onHrAction={hrAction}
      onNegotiationAction={negotiationAction}
      onMarketingAction={marketingAction}
      onSalesAction={salesAction}
      onOperationsAction={operationsAction}
      onReset={() => setGame(null)}
    />
  );
}
