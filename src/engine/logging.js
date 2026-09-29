function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function stateSnapshot(state) {
  return {
    week: state.week,
    status: state.status,
    cash: finite(state.finance?.cash),
    revenue: finite(state.finance?.revenue),
    netProfit: finite(state.finance?.netProfit),
    cumulativeProfit: finite(state.finance?.cumulativeProfit),
    valuation: finite(state.finance?.valuation),
    customers: finite(state.customers?.active),
    satisfaction: finite(state.customers?.satisfaction),
    marketShare: finite(state.customers?.marketShare),
    headcount: state.hr?.employees?.length || 0,
    morale: finite(state.hr?.averageMorale),
    burnout: finite(state.hr?.averageBurnout),
    compliance: finite(state.legal?.complianceScore),
    risk: finite(state.risk?.last?.riskScore),
    debt: (state.funding?.debts || []).reduce((sum, debt) => sum + finite(debt.balance), 0),
    founderOwnership: founderOwnership(state)
  };
}

export function founderOwnership(state) {
  return state.funding?.capTable?.find((holder) => holder.id === 'founder')?.ownership ?? 1;
}

function safeChoice(choice) {
  if (!choice || typeof choice !== 'object') return choice;
  const copy = { ...choice };
  delete copy.hidden;
  return copy;
}

export function recordDecision(before, after, category, choice, options = []) {
  const audit = before.audit || { decisions: [], events: [], causeLinks: [] };
  const entry = {
    id: 'decision-' + (audit.decisions.length + 1),
    turn: before.week,
    category,
    choice: safeChoice(choice),
    options,
    information: {
      state: stateSnapshot(before),
      visibleNegotiation: before.negotiation?.active
        ? {
            type: before.negotiation.active.type,
            round: before.negotiation.active.round,
            playerOffer: before.negotiation.active.playerOffer,
            counterOffer: before.negotiation.active.counterOffer,
            revealed: before.negotiation.active.revealed
          }
        : null
    },
    stateBefore: stateSnapshot(before),
    stateAfter: stateSnapshot(after)
  };
  return {
    ...after,
    audit: {
      ...(after.audit || audit),
      decisions: [...audit.decisions, entry]
    }
  };
}

export function recordEvents(state, events = []) {
  if (!events.length) return state;
  const audit = state.audit || { decisions: [], events: [], causeLinks: [] };
  const appended = events.map((event, index) => ({
    id: 'event-' + (audit.events.length + index + 1),
    turn: state.week,
    category: event.category || 'system',
    type: event.type || 'event',
    message: event.message,
    impact: event.impact || null,
    avoidable: event.avoidable ?? null,
    causeChain: event.causeChain || []
  }));
  return {
    ...state,
    audit: {
      ...audit,
      events: [...audit.events, ...appended]
    }
  };
}
