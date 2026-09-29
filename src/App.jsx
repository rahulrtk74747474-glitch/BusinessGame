import React, { useState } from 'react';
import gameConfig from './config/gameConfig.json';
import cafe from './data/industries/cafe.json';
import cafeRoles from './data/hr/cafeRoles.json';
import negotiationConfig from './data/negotiation/negotiationConfig.json';
import { createGameState } from './models/createGameState.js';
import { advanceWeek } from './engine/simulator.js';
import { applyHrAction } from './engine/hiring.js';
import { applyNegotiationAction } from './engine/negotiation.js';
import SetupFlow from './components/SetupFlow.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [game, setGame] = useState(null);

  const start = (setup) => setGame(createGameState(setup, gameConfig, cafe, cafeRoles, Date.now() % 2147483647));
  const nextWeek = (decisions) => setGame((current) => advanceWeek(current, decisions, gameConfig, cafe, cafeRoles));
  const hrAction = (action) => setGame((current) => applyHrAction(current, action, gameConfig, cafeRoles));
  const negotiationAction = (action) => setGame((current) => applyNegotiationAction(current, action, negotiationConfig, cafeRoles));

  if (!game) return <SetupFlow config={gameConfig} industry={cafe} onStart={start} />;
  return (
    <Dashboard
      state={game}
      config={gameConfig}
      industry={cafe}
      rolesData={cafeRoles}
      negotiationConfig={negotiationConfig}
      onAdvance={nextWeek}
      onHrAction={hrAction}
      onNegotiationAction={negotiationAction}
      onReset={() => setGame(null)}
    />
  );
}
