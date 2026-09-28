import { clamp } from './random.js';

function monthIndexForWeek(week) {
  return Math.min(11, Math.floor(((week - 1) % 52) / (52 / 12)));
}

export function stepMarket(state, decisions, industry, config, rng, modeConfig) {
  const marketCfg = config.market;
  const volatility = modeConfig.economyVolatility;
  const economicShock = rng.normal(0, marketCfg.economicShockStd * volatility);
  const trendShock = rng.normal(0, marketCfg.trendShockStd * volatility);

  const economicIndex = clamp(
    state.market.economicIndex + marketCfg.economicMeanReversion * (1 - state.market.economicIndex) + economicShock,
    marketCfg.minIndex,
    marketCfg.maxIndex
  );
  const trendIndex = clamp(
    state.market.trendIndex + marketCfg.trendMeanReversion * (1 - state.market.trendIndex) + trendShock,
    marketCfg.minIndex,
    marketCfg.maxIndex
  );

  const monthIndex = monthIndexForWeek(state.week + 1);
  const seasonality = industry.seasonalityMonthly[monthIndex];
  const priceRatio = Math.max(marketCfg.minPriceRatio, decisions.price / industry.referencePrice);
  const priceDemandFactor = Math.pow(priceRatio, -industry.priceElasticity);
  const noise = clamp(
    rng.normal(1, marketCfg.weeklyDemandNoiseStd * volatility),
    marketCfg.weeklyDemandNoiseMin,
    marketCfg.weeklyDemandNoiseMax
  );

  const marketDemand = Math.max(0,
    industry.baseMarketDemand * seasonality * economicIndex * trendIndex * priceDemandFactor * noise
  );

  return { economicIndex, trendIndex, seasonality, marketDemand, priceDemandFactor };
}
