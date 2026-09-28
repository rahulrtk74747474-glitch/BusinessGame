import React, { useState } from 'react';
import gameConfig from './config/gameConfig.json';
import cafe from './data/industries/cafe.json';
import { createGameState } from './models/createGameState.js';
import { advanceWeek } from './engine/simulator.js';
import SetupFlow from './components/SetupFlow.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [game, setGame] = useState(null);

  const start = (setup) => setGame(createGameState(setup, gameConfig, cafe, Date.now() % 2147483647));
  const nextWeek = (decisions) => setGame((current) => advanceWeek(current, decisions, gameConfig, cafe));

  if (!game) return <SetupFlow config={gameConfig} industry={cafe} onStart={start} />;
  return <Dashboard state={game} config={gameConfig} industry={cafe} onAdvance={nextWeek} onReset={() => setGame(null)} />;
}
