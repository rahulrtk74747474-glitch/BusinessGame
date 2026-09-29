import { clamp } from './random.js';

export function createCompetitorState(industry, competitorData) {
  return {
    rivals: competitorData.rivals.map((rival) => ({
      id: rival.id,
      name: rival.name,
      archetype: rival.archetype,
      publicDescription: rival.publicDescription,
      price: industry.referencePrice * rival.initialPriceMultiplier,
      quality: rival.initialQuality,
      marketing: rival.initialMarketing,
      reputation: rival.initialReputation,
      lastAction: 'Holding position'
    })),
    last: {
      demandModifier: 1,
      cacMultiplier: 1,
      pressureIndex: 0,
      averageStrength: 1
    }
  };
}

function move(current, target, speed) {
  return current + (target - current) * speed;
}

export function stepCompetitors(state, decisions, industry, competitorData, rng) {
  const reaction = competitorData.reaction;
  const playerShare = state.customers.marketShare || 0;
  const playerMarketingIntensity = clamp((decisions.marketingSpend || 0) / 900, 0, 1.4);
  const updated = [];

  for (const rival of state.competitors.rivals) {
    const cfg = competitorData.rivals.find((x) => x.id === rival.id);
    let targetPrice = rival.price;
    let targetQuality = rival.quality;
    let targetMarketing = rival.marketing;
    let action = 'Holding position';

    if (rival.archetype === 'price_cutter') {
      targetPrice = industry.referencePrice * cfg.targetPriceMultiplier;
      if (playerShare > cfg.priceWarTriggerShare || decisions.price < rival.price) {
        targetPrice = Math.min(targetPrice, decisions.price * (1 - cfg.priceWarCut));
        targetMarketing = Math.min(1, cfg.marketingTarget + 0.08);
        action = 'Cut price and increased promotions';
      } else {
        targetMarketing = cfg.marketingTarget;
        action = 'Maintained value pricing';
      }
      targetQuality = cfg.qualityTarget;
    }

    if (rival.archetype === 'premium') {
      targetPrice = industry.referencePrice * cfg.targetPriceMultiplier;
      targetQuality = cfg.qualityTarget + Math.max(0, decisions.qualitySpend - 180) / 10000;
      targetMarketing = cfg.marketingTarget + Math.max(0, playerMarketingIntensity - 0.7) * 0.08;
      action = decisions.qualitySpend > 260
        ? 'Raised quality to defend premium position'
        : 'Protected premium brand';
    }

    if (rival.archetype === 'copycat') {
      targetPrice =
        rival.price * (1 - cfg.copyPriceWeight) +
        decisions.price * cfg.copyPriceWeight;
      targetMarketing =
        rival.marketing * (1 - cfg.copyMarketingWeight) +
        playerMarketingIntensity * cfg.copyMarketingWeight;
      targetQuality = cfg.qualityTarget + Math.max(0, decisions.qualitySpend - 200) / 12000;
      action = 'Copied your recent pricing and promotion intensity';
    }

    const price = Math.max(
      industry.referencePrice * 0.55,
      move(rival.price, targetPrice, reaction.priceMoveSpeed) *
        clamp(rng.normal(1, reaction.noiseStd), 0.96, 1.04)
    );
    const quality = clamp(move(rival.quality, targetQuality, reaction.qualityMoveSpeed), 0.35, 0.98);
    const marketing = clamp(move(rival.marketing, targetMarketing, reaction.marketingMoveSpeed), 0.15, 1);
    const reputationTarget = 0.42 + quality * 0.45;
    const reputation = clamp(
      move(rival.reputation, reputationTarget, reaction.reputationMoveSpeed),
      0.3,
      0.96
    );

    updated.push({ ...rival, price, quality, marketing, reputation, lastAction: action });
  }

  const strengths = updated.map((rival) => {
    const s = competitorData.strength;
    const priceAttractiveness = clamp(decisions.price / Math.max(0.5, rival.price), 0.55, 1.65);
    return clamp(
      priceAttractiveness * s.priceWeight +
        (rival.quality / s.qualityReference) * s.qualityWeight +
        (rival.marketing / s.marketingReference) * s.marketingWeight +
        (rival.reputation / s.reputationReference) * s.reputationWeight,
      s.min,
      s.max
    );
  });

  const averageStrength = strengths.reduce((a, b) => a + b, 0) / Math.max(1, strengths.length);
  const averageMarketing = updated.reduce((sum, rival) => sum + rival.marketing, 0) / Math.max(1, updated.length);
  const demandModifier = clamp(
    competitorData.pressure.demandBase -
      averageStrength * competitorData.pressure.demandStrengthWeight,
    competitorData.pressure.demandMin,
    competitorData.pressure.demandMax
  );
  const cacMultiplier = clamp(
    competitorData.pressure.cacBase +
      averageMarketing * competitorData.pressure.cacMarketingWeight,
    competitorData.pressure.cacMin,
    competitorData.pressure.cacMax
  );
  const pressureIndex = clamp(averageStrength - 0.85, 0, 1);

  return {
    rivals: updated,
    last: { demandModifier, cacMultiplier, pressureIndex, averageStrength }
  };
}

export function competitorPublicView(state, competitorData) {
  return state.competitors.rivals.map((rival, index) => {
    const noise = ((state.week + 1) * (index + 3) % 7 - 3) * competitorData.publicIntel.priceNoisePct / 3;
    return {
      id: rival.id,
      name: rival.name,
      description: rival.publicDescription,
      observedPrice: rival.price * (1 + noise),
      reputationSignal: rival.reputation < 0.55 ? 'weak' : rival.reputation < 0.76 ? 'solid' : 'strong',
      marketingSignal: rival.marketing < 0.45 ? 'quiet' : rival.marketing < 0.72 ? 'active' : 'aggressive',
      qualitySignal: rival.quality < 0.6 ? 'basic' : rival.quality < 0.8 ? 'good' : 'premium',
      lastAction: rival.lastAction
    };
  });
}
