const safe = (n) => Number.isFinite(n) ? n : 0;

export function createAssetInvestmentState() {
  return {
    ownedAssets: [],
    treasuryHoldings: [],
    nextAssetId: 1,
    nextHoldingId: 1,
    pendingDisposalGainLoss: 0,
    last: {
      grossPpe: 0,
      accumulatedDepreciation: 0,
      netPpe: 0,
      depreciationExpense: 0,
      maintenanceCashCost: 0,
      investmentIncome: 0,
      financialInvestments: 0,
      taxWdvReference: 0,
      capacityAdd: 0,
      serviceAdd: 0
    },
    lastRipple: null
  };
}

function assetDef(data, catalogId) {
  return data?.catalog?.[catalogId] || null;
}

export function applyAssetAction(state, action, data) {
  if (state.status !== 'running' || !data) return state;

  if (action.type === 'buyAsset') {
    const def = assetDef(data, action.catalogId);
    if (!def || state.finance.cash < def.simulationCost) return state;

    const asset = {
      id: state.assets.nextAssetId,
      catalogId: action.catalogId,
      label: def.label,
      purchasedWeek: state.week,
      originalCost: def.simulationCost,
      accumulatedDepreciation: 0,
      bookValue: def.simulationCost,
      taxWdvReference: def.simulationCost
    };

    return {
      ...state,
      finance: {
        ...state.finance,
        cash: state.finance.cash - def.simulationCost,
        ppeGross: (state.finance.ppeGross || 0) + def.simulationCost,
        ppeNet: (state.finance.ppeNet || 0) + def.simulationCost,
        totalAssets: state.finance.totalAssets,
        bookEquity: state.finance.bookEquity
      },
      assets: {
        ...state.assets,
        ownedAssets: [...state.assets.ownedAssets, asset],
        nextAssetId: state.assets.nextAssetId + 1,
        lastRipple: {
          title: def.label + ' purchased',
          nodes: [
            'Cash: falls by capex paid',
            'Balance sheet: PPE increases',
            'P&L: purchase is not expensed immediately',
            'Future weeks: depreciation + maintenance begin'
          ]
        }
      }
    };
  }

  if (action.type === 'sellAsset') {
    const owned = state.assets.ownedAssets.find((item) => item.id === action.assetId);
    if (!owned) return state;
    const def = assetDef(data, owned.catalogId);
    if (!def) return state;

    const saleProceeds = Math.max(0, owned.bookValue * (def.resaleMultiplier ?? 0.85));
    const gainLoss = saleProceeds - owned.bookValue;

    return {
      ...state,
      finance: {
        ...state.finance,
        cash: state.finance.cash + saleProceeds,
        ppeGross: Math.max(0, (state.finance.ppeGross || 0) - owned.originalCost),
        accumulatedDepreciation: Math.max(0, (state.finance.accumulatedDepreciation || 0) - owned.accumulatedDepreciation),
        ppeNet: Math.max(0, (state.finance.ppeNet || 0) - owned.bookValue),
        totalAssets: (state.finance.totalAssets || 0) + gainLoss,
        bookEquity: (state.finance.bookEquity || 0) + gainLoss
      },
      assets: {
        ...state.assets,
        ownedAssets: state.assets.ownedAssets.filter((item) => item.id !== owned.id),
        pendingDisposalGainLoss: state.assets.pendingDisposalGainLoss + gainLoss,
        lastRipple: {
          title: def.label + ' sold',
          nodes: [
            'Cash: sale proceeds received',
            'Balance sheet: asset removed',
            'P&L: sale gain/loss recognized next weekly close',
            'Operations: asset capacity/quality benefit ends'
          ]
        }
      }
    };
  }

  if (action.type === 'buyTreasury') {
    const option = data.treasuryOptions?.[action.optionId];
    if (!option) return state;
    const amount = Math.max(0, Number(action.amount) || 0);
    if (amount < option.minimumInvestment || amount > state.finance.cash) return state;

    const holding = {
      id: state.assets.nextHoldingId,
      optionId: action.optionId,
      label: option.label,
      principal: amount,
      purchasedWeek: state.week
    };

    return {
      ...state,
      finance: {
        ...state.finance,
        cash: state.finance.cash - amount,
        financialInvestments: (state.finance.financialInvestments || 0) + amount,
        totalAssets: state.finance.totalAssets,
        bookEquity: state.finance.bookEquity
      },
      assets: {
        ...state.assets,
        treasuryHoldings: [...state.assets.treasuryHoldings, holding],
        nextHoldingId: state.assets.nextHoldingId + 1,
        lastRipple: {
          title: option.label + ' investment made',
          nodes: [
            'Operating cash: decreases',
            'Financial investments: increase by the same principal',
            'Weekly investment income begins',
            'Liquidity: lock/early-exit terms now matter'
          ]
        }
      }
    };
  }

  if (action.type === 'liquidateTreasury') {
    const holding = state.assets.treasuryHoldings.find((item) => item.id === action.holdingId);
    if (!holding) return state;
    const option = data.treasuryOptions?.[holding.optionId];
    if (!option) return state;
    const weeksHeld = Math.max(0, state.week - holding.purchasedWeek);
    const early = weeksHeld < option.lockWeeks;
    const penalty = early ? holding.principal * option.earlyExitPenaltyRate : 0;
    const proceeds = Math.max(0, holding.principal - penalty);

    return {
      ...state,
      finance: {
        ...state.finance,
        cash: state.finance.cash + proceeds,
        financialInvestments: Math.max(0, (state.finance.financialInvestments || 0) - holding.principal),
        totalAssets: (state.finance.totalAssets || 0) - penalty,
        bookEquity: (state.finance.bookEquity || 0) - penalty
      },
      assets: {
        ...state.assets,
        treasuryHoldings: state.assets.treasuryHoldings.filter((item) => item.id !== holding.id),
        pendingDisposalGainLoss: state.assets.pendingDisposalGainLoss - penalty,
        lastRipple: {
          title: option.label + ' liquidated',
          nodes: [
            'Cash: principal returns' + (early ? ' less early-exit penalty' : ''),
            'Financial investments: decrease',
            early ? 'P&L: early-exit penalty recognized' : 'P&L: no disposal penalty'
          ]
        }
      }
    };
  }

  return state;
}

export function stepAssets(state, data) {
  if (!data) {
    return {
      state: state.assets || createAssetInvestmentState(),
      depreciationExpense: 0,
      maintenanceCashCost: 0,
      investmentIncome: 0,
      disposalGainLoss: 0,
      grossPpe: 0,
      accumulatedDepreciation: 0,
      netPpe: 0,
      financialInvestments: 0,
      taxWdvReference: 0,
      capacityAdd: 0,
      serviceAdd: 0
    };
  }

  let depreciationExpense = 0;
  let maintenanceCashCost = 0;
  let grossPpe = 0;
  let accumulatedDepreciation = 0;
  let netPpe = 0;
  let taxWdvReference = 0;
  let capacityAdd = 0;
  let serviceAdd = 0;

  const ownedAssets = (state.assets?.ownedAssets || []).map((asset) => {
    const def = assetDef(data, asset.catalogId);
    if (!def) return asset;

    const residualRate = def.residualValueRate ?? data.accounting.residualValueRateDefault ?? 0.05;
    const residualValue = asset.originalCost * residualRate;
    const depreciableAmount = Math.max(0, asset.originalCost - residualValue);
    const weeklyBookDep = depreciableAmount / Math.max(52, def.usefulLifeYears * 52);
    const remainingDepreciable = Math.max(0, asset.bookValue - residualValue);
    const depreciation = Math.min(weeklyBookDep, remainingDepreciable);
    const bookValue = Math.max(residualValue, asset.bookValue - depreciation);
    const accumulated = asset.accumulatedDepreciation + depreciation;

    const annualTaxRate = Math.max(0, Math.min(0.95, def.taxWDVRate || 0));
    const weeklyTaxRate = annualTaxRate > 0 ? 1 - Math.pow(1 - annualTaxRate, 1 / 52) : 0;
    const taxWdv = Math.max(0, asset.taxWdvReference * (1 - weeklyTaxRate));

    depreciationExpense += depreciation;
    maintenanceCashCost += asset.originalCost * (def.annualMaintenanceRate || 0) / 52;
    grossPpe += asset.originalCost;
    accumulatedDepreciation += accumulated;
    netPpe += bookValue;
    taxWdvReference += taxWdv;
    capacityAdd += def.capacityAdd || 0;
    serviceAdd += def.serviceAdd || 0;

    return {
      ...asset,
      accumulatedDepreciation: accumulated,
      bookValue,
      taxWdvReference: taxWdv
    };
  });

  const treasuryHoldings = state.assets?.treasuryHoldings || [];
  const investmentIncome = treasuryHoldings.reduce((sum, holding) => {
    const option = data.treasuryOptions?.[holding.optionId];
    return sum + (option ? holding.principal * option.simulatedAnnualReturn / 52 : 0);
  }, 0);
  const financialInvestments = treasuryHoldings.reduce((sum, holding) => sum + holding.principal, 0);
  const disposalGainLoss = state.assets?.pendingDisposalGainLoss || 0;

  return {
    state: {
      ...(state.assets || createAssetInvestmentState()),
      ownedAssets,
      pendingDisposalGainLoss: 0,
      last: {
        grossPpe,
        accumulatedDepreciation,
        netPpe,
        depreciationExpense,
        maintenanceCashCost,
        investmentIncome,
        financialInvestments,
        taxWdvReference,
        capacityAdd,
        serviceAdd
      }
    },
    depreciationExpense,
    maintenanceCashCost,
    investmentIncome,
    disposalGainLoss,
    grossPpe,
    accumulatedDepreciation,
    netPpe,
    financialInvestments,
    taxWdvReference,
    capacityAdd,
    serviceAdd
  };
}
