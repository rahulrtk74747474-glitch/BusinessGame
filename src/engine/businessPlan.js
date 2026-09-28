const nonEmpty = (v) => typeof v === 'string' && v.trim().length >= 8;

export function scoreBusinessPlan(plan, industry) {
  let score = 0;
  const feedback = [];

  if (nonEmpty(plan.idea)) score += 20;
  else feedback.push('State clearly what you sell and why a customer would choose it.');

  if (nonEmpty(plan.targetCustomer)) score += 20;
  else feedback.push('Describe a specific target customer, not “everyone”.');

  const price = Number(plan.price);
  if (Number.isFinite(price) && price > 0) {
    score += 15;
    const ratio = price / industry.referencePrice;
    if (ratio >= 0.8 && ratio <= 1.25) score += 10;
    else feedback.push(`Your price is far from the industry reference of $${industry.referencePrice.toFixed(2)}; explain how the value proposition supports it.`);
  } else feedback.push('Add a realistic selling price.');

  const fixed = Number(plan.weeklyFixedCostEstimate);
  const variable = Number(plan.variableCostEstimate);
  if (fixed > 0) score += 10;
  else feedback.push('Estimate weekly fixed costs such as rent, software, utilities, and admin.');

  if (variable >= 0 && variable < price) {
    score += 15;
    const grossMargin = price > 0 ? (price - variable) / price : 0;
    if (grossMargin >= 0.45) score += 10;
    else feedback.push('Your estimated gross margin is thin; check supplier/input costs or pricing.');
  } else feedback.push('Variable cost per sale must normally be below the selling price.');

  if (feedback.length === 0) feedback.push('The plan is coherent. The simulation will now test whether the assumptions survive real demand and cash-flow pressure.');
  return { score: Math.min(100, score), feedback };
}
