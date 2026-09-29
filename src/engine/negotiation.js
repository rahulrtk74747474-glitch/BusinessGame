import { clamp, createRng } from './random.js';
import { hireCandidateFromNegotiation } from './hiring.js';

const typeOrder = ['supplier', 'landlord', 'client', 'investor', 'candidate'];

const band = (value) => value < 0.38 ? 'low' : value < 0.68 ? 'medium' : 'high';
const tone = (mood) => mood < 0.34 ? 'tense' : mood < 0.68 ? 'neutral' : 'warm';

function relationshipKey(type, candidateId) {
  return type === 'candidate' ? `candidate:${candidateId}` : type;
}

function getRelationship(state, key) {
  return state.negotiation.relationships[key] || 0;
}

function computeLeverage(state, type, negotiationConfig) {
  const cashStrength = clamp(
    state.finance.cash / Math.max(1, state.finance.startingCapital * negotiationConfig.leverage.cashScaleMultiplier),
    0,
    1
  );
  const satisfaction = clamp(state.customers.satisfaction || 0, 0, 1);
  const marketShare = clamp((state.customers.marketShare || 0) / negotiationConfig.leverage.marketShareReference, 0, 1);
  const profitability = clamp(
    (state.finance.netProfit + negotiationConfig.leverage.profitOffset) / negotiationConfig.leverage.profitScale,
    0,
    1
  );
  const candidateAlternatives = clamp(
    state.hr.candidates.filter((c) => c.available).length / Math.max(1, state.hr.candidates.length),
    0,
    1
  );

  const w = negotiationConfig.leverage;
  let leverage =
    w.defaultWeights.cash * cashStrength +
    w.defaultWeights.satisfaction * satisfaction +
    w.defaultWeights.marketShare * marketShare +
    w.defaultWeights.profitability * profitability;
  if (type === 'candidate') {
    leverage =
      w.candidateWeights.cash * cashStrength +
      w.candidateWeights.alternatives * candidateAlternatives +
      w.candidateWeights.profitability * profitability;
  }
  if (type === 'client') {
    leverage =
      w.clientWeights.satisfaction * satisfaction +
      w.clientWeights.marketShare * marketShare +
      w.clientWeights.cash * cashStrength;
  }
  if (type === 'investor') {
    leverage =
      w.investorWeights.profitability * profitability +
      w.investorWeights.marketShare * marketShare +
      w.investorWeights.cash * cashStrength;
  }

  return clamp(leverage, negotiationConfig.leverageMin, negotiationConfig.leverageMax);
}

function candidatePreparation(candidate, negotiationConfig) {
  let prep = negotiationConfig.initialPreparation;
  if (candidate.insights.interview) prep += negotiationConfig.candidateDueDiligencePreparation.interview;
  if (candidate.insights.references) prep += negotiationConfig.candidateDueDiligencePreparation.references;
  if (candidate.trialCompleted) prep += negotiationConfig.candidateDueDiligencePreparation.trial;
  return clamp(prep, negotiationConfig.preparationMin, negotiationConfig.preparationMax);
}

function generalCounterparty(state, type, negotiationConfig) {
  const template = negotiationConfig.templates[type];
  const sessionIndex = state.negotiation.nextSessionId;
  const seed = state.seed + sessionIndex * 17041 + typeOrder.indexOf(type) * 7307;
  const rng = createRng(seed);
  const personality = negotiationConfig.personalities[Math.floor(rng.range(0, negotiationConfig.personalities.length))];
  const mood = clamp(
    rng.range(negotiationConfig.generalMoodRange.min, negotiationConfig.generalMoodRange.max),
    negotiationConfig.moodMin,
    negotiationConfig.moodMax
  );
  const relationship = getRelationship(state, type);

  let initialCounter = template.initialCounter;
  let playerOpening = template.playerOpening;
  let walkAway;

  if (type === 'investor') {
    const base = Math.max(state.finance.valuation, state.finance.startingCapital);
    initialCounter = Math.round(base * template.initialCounterMultiplier);
    playerOpening = Math.round(base * template.playerOpeningMultiplier);
    walkAway = Math.round(base * rng.range(template.walkAwayMinMultiplier, template.walkAwayMaxMultiplier));
  } else {
    walkAway = rng.range(template.walkAwayMin, template.walkAwayMax);
  }

  return {
    label: template.label,
    direction: template.direction,
    unit: template.unit,
    initialCounter,
    playerOpening,
    walkAway,
    personality,
    mood,
    relationship,
    preparation: negotiationConfig.initialPreparation
  };
}

function candidateCounterparty(state, candidateId, negotiationConfig) {
  const candidate = state.hr.candidates.find((c) => c.id === candidateId && c.available);
  if (!candidate) return null;
  const template = negotiationConfig.templates.candidate;
  const personality =
    candidate.hidden.ambition > negotiationConfig.candidatePersonality.aggressiveAmbitionThreshold ? 'aggressive' :
    candidate.hidden.cultureFit > negotiationConfig.candidatePersonality.friendlyCultureThreshold ? 'friendly' :
    'analytical';
  const mood = clamp(
    negotiationConfig.candidateMood.base +
      candidate.hidden.cultureFit * negotiationConfig.candidateMood.cultureFitWeight -
      candidate.hidden.ambition * negotiationConfig.candidateMood.ambitionWeight,
    negotiationConfig.moodMin,
    negotiationConfig.moodMax
  );
  return {
    label: candidate.name,
    direction: template.direction,
    unit: template.unit,
    initialCounter: candidate.salaryAsk,
    playerOpening: Math.round(candidate.salaryAsk * template.playerOpeningMultiplier),
    walkAway: Math.round(candidate.salaryAsk * candidate.hidden.walkAwayRatio),
    personality,
    mood,
    relationship: getRelationship(state, relationshipKey('candidate', candidateId)),
    preparation: candidatePreparation(candidate, negotiationConfig),
    candidate
  };
}

export function startNegotiation(state, type, negotiationConfig, candidateId = null) {
  if (state.status !== 'running') return state;
  if (!negotiationConfig.templates[type]) return state;
  if (state.negotiation.active?.status === 'active') return state;

  const cp = type === 'candidate'
    ? candidateCounterparty(state, candidateId, negotiationConfig)
    : generalCounterparty(state, type, negotiationConfig);
  if (!cp) return state;

  const template = negotiationConfig.templates[type];
  const key = relationshipKey(type, candidateId);
  const session = {
    id: state.negotiation.nextSessionId,
    type,
    candidateId,
    label: cp.label,
    direction: cp.direction,
    unit: cp.unit,
    round: 0,
    maxRounds: negotiationConfig.maxRounds,
    playerOffer: cp.playerOpening,
    counterOffer: cp.initialCounter,
    initialCounter: cp.initialCounter,
    preparation: cp.preparation,
    leverage: computeLeverage(state, type, negotiationConfig),
    relationship: cp.relationship,
    researchActions: 0,
    bundleUsed: false,
    revealed: {},
    status: 'active',
    outcome: null,
    lesson: template.lesson,
    bundleLabel: template.bundleLabel,
    transcript: [
      {
        speaker: 'system',
        text: `${cp.label} opened at ${formatTerm(cp.initialCounter, cp.unit)}. Your leverage and their limits are not fully known.`
      }
    ],
    hidden: {
      walkAway: cp.walkAway,
      mood: cp.mood,
      personality: cp.personality,
      relationshipKey: key
    }
  };

  return {
    ...state,
    negotiation: {
      ...state.negotiation,
      active: session,
      nextSessionId: state.negotiation.nextSessionId + 1
    }
  };
}

function formatTerm(value, unit) {
  if (unit === 'valuation') return '$' + Math.round(value).toLocaleString() + ' valuation';
  if (unit === '$/week') return '$' + Math.round(value).toLocaleString() + '/week';
  if (unit === '$/order') return '$' + Number(value).toFixed(2) + '/order';
  return String(value);
}

function proposalWithinWalkAway(session, proposal) {
  return session.direction === 'lower'
    ? proposal >= session.hidden.walkAway
    : proposal <= session.hidden.walkAway;
}

function dealFit(session, proposal) {
  const best = session.initialCounter;
  const walk = session.hidden.walkAway;
  const denominator = Math.max(0.0001, Math.abs(best - walk));

  if (session.direction === 'lower') {
    return clamp((proposal - walk) / denominator, 0, 1);
  }
  return clamp((walk - proposal) / denominator, 0, 1);
}

function outsideWalkAwayDistance(session, proposal) {
  const walk = Math.max(0.0001, Math.abs(session.hidden.walkAway));
  if (session.direction === 'lower' && proposal < session.hidden.walkAway) {
    return (session.hidden.walkAway - proposal) / walk;
  }
  if (session.direction === 'higher' && proposal > session.hidden.walkAway) {
    return (proposal - session.hidden.walkAway) / walk;
  }
  return 0;
}

function acceptanceScore(session, tactic, proposal, negotiationConfig) {
  const cfg = negotiationConfig.acceptance;
  const fit = negotiationConfig.tacticFit[session.hidden.personality][tactic] || 0;
  const relationshipNormalized = (session.relationship + 1) / 2;
  const bundleBonus = tactic === 'bundle' ? negotiationConfig.bundleConcessionValue : 0;
  const deadlineBonus = tactic === 'deadline' ? negotiationConfig.deadlinePressureValue : 0;

  const score =
    dealFit(session, proposal) * cfg.dealFitWeight +
    session.hidden.mood * cfg.moodWeight +
    relationshipNormalized * cfg.relationshipWeight +
    session.preparation * cfg.preparationWeight +
    session.leverage * cfg.leverageWeight +
    fit * cfg.tacticFitWeight +
    bundleBonus +
    deadlineBonus;

  const personalityAdjustment =
    session.hidden.personality === 'aggressive' ? cfg.aggressiveThresholdAdjustment :
    session.hidden.personality === 'friendly' ? cfg.friendlyThresholdAdjustment :
    cfg.analyticalThresholdAdjustment;

  return {
    score,
    threshold: cfg.baseThreshold + personalityAdjustment,
    fit: dealFit(session, proposal)
  };
}

function updateMoodAndRelationship(session, tactic, negotiationConfig) {
  const personalityFit = negotiationConfig.tacticFit[session.hidden.personality][tactic] || 0;
  const moodImpact =
    (negotiationConfig.tacticMoodImpact[tactic] || 0) +
    personalityFit * negotiationConfig.socialFitMoodWeight;
  const relationshipImpact =
    (negotiationConfig.tacticRelationshipImpact[tactic] || 0) +
    personalityFit * negotiationConfig.socialFitRelationshipWeight;
  return {
    mood: clamp(
      session.hidden.mood + moodImpact,
      negotiationConfig.moodMin,
      negotiationConfig.moodMax
    ),
    relationship: clamp(
      session.relationship + relationshipImpact,
      negotiationConfig.relationshipMin,
      negotiationConfig.relationshipMax
    )
  };
}

function nextCounterOffer(session, tactic, proposal, negotiationConfig, rng) {
  const cfg = negotiationConfig.counter;
  const tacticFit = negotiationConfig.tacticFit[session.hidden.personality][tactic] || 0;
  const relationshipNormalized = (session.relationship + 1) / 2;
  const movement = clamp(
    cfg.baseMovement +
      session.leverage * cfg.leverageWeight +
      session.preparation * cfg.preparationWeight +
      Math.max(cfg.negativeFitFloor, tacticFit) * cfg.tacticFitWeight +
      relationshipNormalized * cfg.relationshipWeight +
      rng.range(-cfg.noise, cfg.noise),
    cfg.movementMin,
    cfg.movementMax
  );

  if (session.direction === 'lower') {
    const target = Math.max(proposal, session.hidden.walkAway);
    return Math.max(session.hidden.walkAway, session.counterOffer - (session.counterOffer - target) * movement);
  }

  const target = Math.min(proposal, session.hidden.walkAway);
  return Math.min(session.hidden.walkAway, session.counterOffer + (target - session.counterOffer) * movement);
}

function shouldLeave(session, tactic, proposal, negotiationConfig, rng) {
  const outside = outsideWalkAwayDistance(session, proposal);
  if (outside <= negotiationConfig.leave.outsideWalkAwayTolerance && tactic !== 'deadline') return false;

  const negativeRelationship = Math.max(0, -session.relationship);
  const chance = clamp(
    negotiationConfig.leave.baseChance +
      (1 - session.hidden.mood) * negotiationConfig.leave.badMoodWeight +
      (tactic === 'deadline' ? negotiationConfig.leave.deadlineExtraChance : 0) +
      negativeRelationship * negotiationConfig.leave.negativeRelationshipWeight +
      Math.min(negotiationConfig.outsideDistanceChanceCap, outside),
    0,
    negotiationConfig.leave.chanceMax
  );
  return rng.uniform() < chance;
}

function revealNext(session, negotiationConfig) {
  if (!session.revealed.personality) {
    return { ...session.revealed, personality: session.hidden.personality };
  }
  if (!session.revealed.walkAwayBand) {
    const walk = session.hidden.walkAway;
    return {
      ...session.revealed,
      walkAwayBand: {
        low: walk * (1 - negotiationConfig.walkAwayRevealBand),
        high: walk * (1 + negotiationConfig.walkAwayRevealBand)
      }
    };
  }
  if (!session.revealed.moodSignal) {
    return { ...session.revealed, moodSignal: tone(session.hidden.mood) };
  }
  return { ...session.revealed, leverageSignal: band(session.leverage) };
}

function historyEntry(session) {
  return {
    id: session.id,
    type: session.type,
    label: session.label,
    status: session.status,
    finalValue: session.outcome?.value ?? null,
    rounds: session.round,
    bundleUsed: session.bundleUsed,
    relationshipEnd: session.relationship
  };
}

function updateStoredRelationship(state, session) {
  return {
    ...state.negotiation.relationships,
    [session.hidden.relationshipKey]: session.relationship
  };
}

function settleDeal(state, session, value, negotiationConfig, rolesData) {
  const template = negotiationConfig.templates[session.type];
  const successfulRelationship = clamp(
    session.relationship + negotiationConfig.relationshipSuccessGain,
    negotiationConfig.relationshipMin,
    negotiationConfig.relationshipMax
  );
  let settledSession = {
    ...session,
    relationship: successfulRelationship,
    status: 'accepted',
    outcome: {
      value,
      message: `Deal agreed at ${formatTerm(value, session.unit)}.`
    },
    transcript: [
      ...session.transcript,
      { speaker: 'counterparty', text: `Agreed. We have a deal at ${formatTerm(value, session.unit)}.` }
    ]
  };

  let next = {
    ...state,
    negotiation: {
      ...state.negotiation,
      active: settledSession,
      relationships: {
        ...state.negotiation.relationships,
        [session.hidden.relationshipKey]: successfulRelationship
      }
    }
  };

  if (session.type === 'supplier') {
    next = {
      ...next,
      negotiation: {
        ...next.negotiation,
        contracts: {
          ...next.negotiation.contracts,
          supplierUnitCost: value,
          supplierRemainingWeeks: template.contractWeeks
        },
        lastRipple: {
          title: 'Supplier deal signed',
          nodes: ['Operations: input cost changes', 'Finance: gross margin changes', 'Risk: supplier relationship now matters']
        }
      }
    };
  }

  if (session.type === 'landlord') {
    const weeklySavings = Math.max(0, session.initialCounter - value);
    next = {
      ...next,
      negotiation: {
        ...next.negotiation,
        contracts: {
          ...next.negotiation.contracts,
          landlordWeeklySavings: weeklySavings,
          landlordRemainingWeeks: template.contractWeeks
        },
        lastRipple: {
          title: 'Lease terms agreed',
          nodes: ['Facilities: lease cost changes', 'Finance: weekly fixed costs change', 'Risk: lease commitment extends']
        }
      }
    };
  }

  if (session.type === 'client') {
    next = {
      ...next,
      negotiation: {
        ...next.negotiation,
        contracts: {
          ...next.negotiation.contracts,
          clientWeeklyRevenue: value,
          clientVariableCostRate: template.clientVariableCostRate,
          clientRemainingWeeks: template.contractWeeks
        },
        lastRipple: {
          title: 'Client contract won',
          nodes: ['Sales: contracted revenue added', 'Finance: revenue and delivery cost rise', 'Operations: service commitment increases']
        }
      }
    };
  }

  if (session.type === 'investor') {
    next = {
      ...next,
      negotiation: {
        ...next.negotiation,
        contracts: {
          ...next.negotiation.contracts,
          investorIndicativeValuation: value
        },
        lastRipple: {
          title: 'Indicative investor terms agreed',
          nodes: ['Funding: valuation reference created', 'Ownership: dilution still unresolved', 'Phase 5: capital/term-sheet settlement remains locked']
        }
      }
    };
  }

  if (session.type === 'candidate') {
    const perksWeekly = session.bundleUsed ? template.candidateBundlePerksWeekly : 0;
    const equityBps = session.bundleUsed ? template.candidateBundleEquityBps : 0;
    next = hireCandidateFromNegotiation(
      next,
      session.candidateId,
      { weeklySalary: value, perksWeekly, equityBps },
      rolesData
    );
    next = {
      ...next,
      negotiation: {
        ...next.negotiation,
        active: settledSession,
        relationships: {
          ...next.negotiation.relationships,
          [session.hidden.relationshipKey]: successfulRelationship
        },
        lastRipple: {
          title: 'Candidate terms agreed',
          nodes: ['HR: candidate becomes employee', 'Finance: payroll increases', 'Operations: capacity/productivity can improve', 'Leadership: onboarding load begins']
        }
      }
    };
  }

  return {
    ...next,
    negotiation: {
      ...next.negotiation,
      history: [...next.negotiation.history, historyEntry(settledSession)]
    }
  };
}

function endNoDeal(state, session, status, message, negotiationConfig) {
  const ended = {
    ...session,
    status,
    outcome: { value: null, message },
    transcript: [...session.transcript, { speaker: 'system', text: message }]
  };

  let next = {
    ...state,
    negotiation: {
      ...state.negotiation,
      active: ended,
      relationships: updateStoredRelationship(state, ended),
      history: [...state.negotiation.history, historyEntry(ended)]
    }
  };

  if (session.type === 'candidate' && status === 'left') {
    next = {
      ...next,
      hr: {
        ...next.hr,
        candidates: next.hr.candidates.map((candidate) =>
          candidate.id === session.candidateId
            ? {
                ...candidate,
                available: false,
                offer: { status: 'declined', message: 'The candidate left after negotiations broke down.' }
              }
            : candidate
        )
      }
    };
  }

  return next;
}

export function applyNegotiationAction(state, action, negotiationConfig, rolesData) {
  if (action.type === 'start') {
    return startNegotiation(state, action.counterpartyType, negotiationConfig, action.candidateId || null);
  }

  const session = state.negotiation.active;
  if (!session || session.status !== 'active') {
    if (action.type === 'close') {
      return { ...state, negotiation: { ...state.negotiation, active: null } };
    }
    return state;
  }

  if (action.type === 'close') {
    return state;
  }

  if (action.type === 'prepare') {
    if (session.researchActions >= negotiationConfig.maxResearchActions) return state;
    const cost = negotiationConfig.researchCost;
    const prepared = {
      ...session,
      preparation: clamp(
        session.preparation + negotiationConfig.researchPreparationGain,
        negotiationConfig.preparationMin,
        negotiationConfig.preparationMax
      ),
      researchActions: session.researchActions + 1,
      revealed: revealNext(session, negotiationConfig),
      transcript: [
        ...session.transcript,
        { speaker: 'system', text: 'You prepared a research dossier and improved your information position.' }
      ]
    };
    return {
      ...state,
      finance: { ...state.finance, cash: state.finance.cash - cost },
      negotiation: {
        ...state.negotiation,
        active: prepared,
        pendingExpenseRecognition: state.negotiation.pendingExpenseRecognition + cost
      }
    };
  }

  const tactic = action.tactic;
  if (tactic === 'walk_away') {
    const updated = {
      ...session,
      relationship: clamp(
        session.relationship + negotiationConfig.tacticRelationshipImpact.walk_away,
        negotiationConfig.relationshipMin,
        negotiationConfig.relationshipMax
      )
    };
    return endNoDeal(state, updated, 'walked-away', 'You walked away without a deal.', negotiationConfig);
  }

  if (!['anchor', 'split', 'bundle', 'deadline', 'ask_info'].includes(tactic)) return state;

  const rng = createRng(state.seed + session.id * 5501 + (session.round + 1) * 1229);
  const social = updateMoodAndRelationship(session, tactic, negotiationConfig);
  let working = {
    ...session,
    round: session.round + 1,
    relationship: social.relationship,
    hidden: { ...session.hidden, mood: social.mood }
  };

  if (tactic === 'ask_info') {
    working = {
      ...working,
      preparation: clamp(
        working.preparation + negotiationConfig.askInfoPreparationGain,
        negotiationConfig.preparationMin,
        negotiationConfig.preparationMax
      ),
      revealed: revealNext(working, negotiationConfig),
      transcript: [
        ...working.transcript,
        { speaker: 'you', text: 'I asked for more information before changing the offer.' },
        { speaker: 'counterparty', text: 'They shared additional context, but kept their current position.' }
      ]
    };
    if (working.round >= working.maxRounds) {
      return endNoDeal(state, working, 'expired', 'Negotiations ran out of time without agreement.', negotiationConfig);
    }
    return {
      ...state,
      negotiation: {
        ...state.negotiation,
        active: working,
        relationships: {
          ...state.negotiation.relationships,
          [working.hidden.relationshipKey]: working.relationship
        }
      }
    };
  }

  let proposal;
  if (tactic === 'split') {
    proposal = (working.playerOffer + working.counterOffer) / 2;
  } else {
    proposal = Number(action.proposal);
    if (!Number.isFinite(proposal) || proposal <= 0) proposal = working.playerOffer;
  }

  working = {
    ...working,
    playerOffer: proposal,
    bundleUsed: working.bundleUsed || tactic === 'bundle',
    transcript: [
      ...working.transcript,
      {
        speaker: 'you',
        text:
          tactic === 'anchor' ? `I anchored at ${formatTerm(proposal, working.unit)}.` :
          tactic === 'split' ? `I proposed splitting the difference at ${formatTerm(proposal, working.unit)}.` :
          tactic === 'bundle' ? `I proposed ${formatTerm(proposal, working.unit)} and bundled additional terms.` :
          `I set a deadline around an offer of ${formatTerm(proposal, working.unit)}.`
      }
    ]
  };

  if (shouldLeave(working, tactic, proposal, negotiationConfig, rng)) {
    return endNoDeal(
      state,
      working,
      'left',
      'The counterparty ended the negotiation because the offer/tactic crossed their tolerance.',
      negotiationConfig
    );
  }

  const acceptance = acceptanceScore(working, tactic, proposal, negotiationConfig);
  const withinWalkAway = proposalWithinWalkAway(working, proposal);
  if (
    withinWalkAway &&
    (acceptance.score >= acceptance.threshold || acceptance.fit >= negotiationConfig.acceptance.automaticBestOfferFit)
  ) {
    return settleDeal(state, working, proposal, negotiationConfig, rolesData);
  }

  const counter = nextCounterOffer(working, tactic, proposal, negotiationConfig, rng);
  working = {
    ...working,
    counterOffer: counter,
    transcript: [
      ...working.transcript,
      {
        speaker: 'counterparty',
        text: `No deal yet. They moved to ${formatTerm(counter, working.unit)}.`
      }
    ]
  };

  if (working.round >= working.maxRounds) {
    return endNoDeal(state, working, 'expired', 'Negotiations ran out of time without agreement.', negotiationConfig);
  }

  return {
    ...state,
    negotiation: {
      ...state.negotiation,
      active: working,
      relationships: {
        ...state.negotiation.relationships,
        [working.hidden.relationshipKey]: working.relationship
      }
    }
  };
}

export function closeNegotiation(state) {
  return { ...state, negotiation: { ...state.negotiation, active: null } };
}

export function stepNegotiationContracts(state) {
  const contracts = state.negotiation.contracts;
  return {
    ...state.negotiation,
    contracts: {
      ...contracts,
      supplierRemainingWeeks: Math.max(0, (contracts.supplierRemainingWeeks || 0) - 1),
      landlordRemainingWeeks: Math.max(0, (contracts.landlordRemainingWeeks || 0) - 1),
      clientRemainingWeeks: Math.max(0, (contracts.clientRemainingWeeks || 0) - 1)
    },
    pendingExpenseRecognition: 0
  };
}

export function negotiationPublicView(state, negotiationConfig) {
  const session = state.negotiation.active;
  if (!session) return null;
  return {
    id: session.id,
    type: session.type,
    label: session.label,
    unit: session.unit,
    direction: session.direction,
    round: session.round,
    maxRounds: session.maxRounds,
    playerOffer: session.playerOffer,
    counterOffer: session.counterOffer,
    preparation: session.preparation,
    leverageSignal: band(session.leverage),
    relationshipSignal: session.relationship < -0.2 ? 'strained' : session.relationship > 0.2 ? 'positive' : 'neutral',
    counterpartyTone: tone(session.hidden.mood),
    revealed: session.revealed,
    status: session.status,
    outcome: session.outcome,
    transcript: session.transcript,
    lesson: session.lesson,
    bundleLabel: session.bundleLabel,
    researchActions: session.researchActions,
    researchLimit: negotiationConfig.maxResearchActions,
    researchCost: negotiationConfig.researchCost,
    bundleUsed: session.bundleUsed
  };
}
