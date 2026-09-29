import config from '../src/config/gameConfig.json' with { type: 'json' };
import industry from '../src/data/industries/cafe.json' with { type: 'json' };
import rolesData from '../src/data/hr/cafeRoles.json' with { type: 'json' };
import { createGameState } from '../src/models/createGameState.js';
import { advanceWeek } from '../src/engine/simulator.js';

const finite = (value) => Number.isFinite(value);
let cases = 0;

for (const mode of Object.keys(config.modes)) {
  for (const startingCapital of config.startingCapital) {
    for (const structure of Object.keys(config.structures)) {
      for (const location of Object.keys(config.locations)) {
        const setup = {
          mode,
          startingCapital,
          duration: 52,
          goal: 'profit',
          goalTarget: config.goals.profit.defaultTarget,
          structure,
          location,
          plan: {
            idea: 'A specific neighborhood cafe concept with clear value.',
            targetCustomer: 'Nearby workers and residents who buy repeatedly.',
            price: industry.referencePrice,
            weeklyFixedCostEstimate: industry.baseFixedCostPerWeek,
            variableCostEstimate: industry.baseVariableCostPerOrder
          }
        };
        let state = createGameState(setup, config, industry, rolesData, 4242 + cases);
        for (let i = 0; i < 8 && state.status === 'running'; i += 1) {
          state = advanceWeek(state, state.decisions, config, industry, rolesData);
        }

        const values = [
          state.finance.cash,
          state.finance.startingCapital,
          state.finance.revenue,
          state.finance.netProfit,
          state.finance.valuation,
          state.customers.active,
          state.customers.satisfaction,
          state.customers.awareness,
          state.market.economicIndex,
          state.market.trendIndex,
          state.hr.managerQuality,
          state.hr.legalRisk
        ];
        if (!values.every(finite)) throw new Error('Non-finite state in case ' + cases);
        if (state.customers.satisfaction < config.customer.minSatisfaction || state.customers.satisfaction > config.customer.maxSatisfaction) {
          throw new Error('Satisfaction out of bounds in case ' + cases);
        }
        if (state.hr.candidates.length !== rolesData.candidatePoolSize) {
          throw new Error('Candidate pool size incorrect in case ' + cases);
        }
        cases += 1;
      }
    }
  }
}

console.log('Smoke test passed: ' + cases + ' mode/capital/structure/location combinations.');
