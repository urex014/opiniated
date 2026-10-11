export type AccountState = {
  availableUnits: number;
  lifetimeCreditedUnits: number;
};

export type MoneyEventType = "COMPLETE" | "START_BONUS" | "RECONCILIATION";

export type RewardPlan = {
  type: MoneyEventType | "SCREENOUT";
  status: "APPROVED" | "REVERSED" | "REJECTED";
  amountUnits: number;
  appliedUnits: number;
  shortfallUnits: number;
  next: AccountState;
};

/**
 * Reversal policy: a negative adjustment reduces the available balance down to
 * zero. Any amount that cannot be collected is stored as shortfallUnits.
 * Available balance never goes below zero. Historical rows are not deleted.
 */
export function planReward(account: AccountState, type: MoneyEventType | "SCREENOUT", amountUnits: number): RewardPlan {
  if (type === "SCREENOUT") {
    return {
      type,
      status: "REJECTED",
      amountUnits: 0,
      appliedUnits: 0,
      shortfallUnits: 0,
      next: account,
    };
  }

  if (type === "RECONCILIATION") {
    if (amountUnits >= 0) {
      return {
        type,
        status: "APPROVED",
        amountUnits,
        appliedUnits: amountUnits,
        shortfallUnits: 0,
        next: {
          availableUnits: account.availableUnits + amountUnits,
          lifetimeCreditedUnits: account.lifetimeCreditedUnits + amountUnits,
        },
      };
    }
    const requested = -amountUnits;
    const collected = Math.min(account.availableUnits, requested);
    return {
      type,
      status: "REVERSED",
      amountUnits,
      appliedUnits: -collected,
      shortfallUnits: requested - collected,
      next: {
        availableUnits: account.availableUnits - collected,
        lifetimeCreditedUnits: account.lifetimeCreditedUnits,
      },
    };
  }

  return {
    type,
    status: "APPROVED",
    amountUnits,
    appliedUnits: amountUnits,
    shortfallUnits: 0,
    next: {
      availableUnits: account.availableUnits + amountUnits,
      lifetimeCreditedUnits: account.lifetimeCreditedUnits + amountUnits,
    },
  };
}
