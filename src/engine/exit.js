import { clamp } from './random.js';
import { founderOwnership } from './logging.js';

export function createExitState() {
  return {
    successionScore: 0.15,
    review: null,
    offer: null,
    founderProceeds: 0,
    salePrice: 0,
    sold: false,
    pendingExpenseRecognition: 0,
    lastEvents: [],
    lastRipple: null
  };
}

function trailingAverage(state, key, weeks = 8) {
  const rows = state.history.slice(-weeks);
  if (!rows.length) return state.finance?.[key] || 0;
  return rows.reduce((sum, row) => sum + (row[key] || 0), 0) / rows.length;
}

export function exitReadiness(state, data) {
  const criteria = {
    age: state.week >= data.readiness.minimumWeek,
    revenue: trailingAverage(state, 'revenue') >= data.readiness.minimumTrailingAverageRevenue,
    profit: trailingAverage(state, 'netProfit') >= data.readiness.minimumTrailingAverageProfit,
    compliance: (state.legal?.complianceScore ?? 0) >= data.readiness.minimumCompliance,
    risk: (state.risk?.last?.riskScore ?? 1) <= data.readiness.maximumRisk,
    succession: state.exit.successionScore >= data.readiness.minimumSuccession
  };

  return {
    ready: Object.values(criteria).every(Boolean),
    criteria,
    trailingRevenue: trailingAverage(state, 'revenue'),
    trailingProfit: trailingAverage(state, 'netProfit')
  };
}

function successionGainFromManagers(state) {
  const managerCount = state.hr.employees.filter((employee) => employee.roleId === 'shift_manager').length;
  return Math.min(0.15, managerCount * 0.05);
}

export function applyExitAction(state, action, data) {
  if (state.status !== 'running') return state;

  if (action.type === 'prepareSuccession') {
    if (state.finance.cash < data.successionPreparationCost) return state;
    const gain = data.successionGain + successionGainFromManagers(state);
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash - data.successionPreparationCost },
      exit: {
        ...state.exit,
        successionScore: clamp(state.exit.successionScore + gain, 0, 1),
        pendingExpenseRecognition: state.exit.pendingExpenseRecognition + data.successionPreparationCost,
        lastRipple: {
          title: 'Succession systems improved',
          nodes: ['Leadership: owner dependence falls', 'Exit: buyer confidence improves', 'Finance: advisory/process cost paid now']
        }
      }
    };
  }

  if (action.type === 'requestExitReview') {
    const readiness = exitReadiness(state, data);
    if (!readiness.ready || state.exit.review || state.exit.offer) return state;
    if (state.finance.cash < data.brokerReviewCost) return state;

    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash - data.brokerReviewCost },
      exit: {
        ...state.exit,
        review: {
          remainingWeeks: data.brokerReviewWeeks,
          requestedWeek: state.week
        },
        pendingExpenseRecognition: state.exit.pendingExpenseRecognition + data.brokerReviewCost,
        lastRipple: {
          title: 'Exit review started',
          nodes: ['Exit: broker diligence begins', 'Finance: advisory cost paid', 'Leadership: succession and reporting are tested']
        }
      }
    };
  }

  if (action.type === 'rejectSaleOffer' && state.exit.offer) {
    return {
      ...state,
      exit: { ...state.exit, offer: null }
    };
  }

  if (action.type === 'acceptSaleOffer' && state.exit.offer) {
    const salePrice = state.exit.offer.salePrice;
    const fee = salePrice * data.transactionFeeRate;
    const ownership = founderOwnership(state);
    const founderProceeds = (salePrice - fee) * ownership;

    return {
      ...state,
      status: 'finished',
      resultReason: 'You sold the company for $' + Math.round(salePrice).toLocaleString() + '. Founder proceeds after transaction fees and dilution: $' + Math.round(founderProceeds).toLocaleString() + '.',
      exit: {
        ...state.exit,
        sold: true,
        salePrice,
        founderProceeds,
        offer: null,
        lastRipple: {
          title: 'Company sold',
          nodes: ['Exit: ownership transfers', 'Founder: proceeds realized', 'Run: operating control ends']
        }
      }
    };
  }

  return state;
}

export function stepExit(state, data, rng) {
  const events = [];
  let review = state.exit.review;
  let offer = state.exit.offer;

  if (review) {
    const remaining = review.remainingWeeks - 1;
    if (remaining <= 0) {
      const readiness = exitReadiness(state, data);
      const history = state.history.slice(-8);
      const firstRevenue = history[0]?.revenue || state.finance.revenue || 1;
      const lastRevenue = history.at(-1)?.revenue || firstRevenue;
      const growth = clamp((lastRevenue - firstRevenue) / Math.max(1, firstRevenue), -0.5, 1);
      const profitMargin = state.finance.revenue > 0 ? state.finance.netProfit / state.finance.revenue : 0;
      const compliance = state.legal?.complianceScore ?? 0;
      const risk = state.risk?.last?.riskScore ?? 1;
      const ownerDependence = 1 - state.exit.successionScore;

      const valuationMultiple = clamp(
        data.valuation.baseMultiple +
          Math.max(0, growth) * data.valuation.growthBonusMax +
          Math.max(0, profitMargin) * data.valuation.profitBonusMax +
          compliance * data.valuation.complianceBonusMax -
          risk * data.valuation.riskPenaltyMax -
          ownerDependence * data.valuation.ownerDependencePenaltyMax,
        0.65,
        1.35
      );

      const salePrice = Math.round(
        Math.max(state.finance.valuation, readiness.trailingRevenue * 52 * 0.3) *
        valuationMultiple *
        rng.range(data.valuation.noiseMin, data.valuation.noiseMax)
      );

      offer = {
        salePrice,
        expiresIn: data.offerValidityWeeks,
        createdWeek: state.week + 1
      };
      review = null;
      events.push({
        category: 'exit',
        type: 'sale-offer',
        message: 'Brokered buyer offer received at $' + salePrice.toLocaleString() + '.',
        avoidable: false,
        causeChain: [
          'Compliance: ' + compliance.toFixed(2),
          'Risk: ' + risk.toFixed(2),
          'Succession score: ' + state.exit.successionScore.toFixed(2)
        ]
      });
    } else {
      review = { ...review, remainingWeeks: remaining };
    }
  } else if (offer) {
    const expiresIn = offer.expiresIn - 1;
    if (expiresIn <= 0) {
      events.push({
        category: 'exit',
        type: 'sale-offer-expired',
        message: 'The buyer offer expired.',
        avoidable: true,
        causeChain: ['Offer was not accepted within the validity window.']
      });
      offer = null;
    } else {
      offer = { ...offer, expiresIn };
    }
  }

  return {
    state: {
      ...state.exit,
      review,
      offer,
      pendingExpenseRecognition: 0,
      lastEvents: events
    },
    events
  };
}
