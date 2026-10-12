export type AccountState = {
  availableUnits: number;
  reservedUnits: number;
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
 * Reversal policy: a negative adjustment collects only from the spendable
 * balance (available minus reserved). Reserved withdrawal funds stay reserved.
 * Any amount that cannot be collected is stored as shortfallUnits. Available
 * balance never goes below the reserved amount, and never below zero.
 * Historical rows are not deleted.
 */
export function planReward(account: AccountState, type: MoneyEventType | "SCREENOUT", amountUnits: number): RewardPlan {
  const reservedUnits = account.reservedUnits;
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
          reservedUnits,
          lifetimeCreditedUnits: account.lifetimeCreditedUnits + amountUnits,
        },
      };
    }
    const requested = -amountUnits;
    const spendable = Math.max(0, account.availableUnits - reservedUnits);
    const collected = Math.min(spendable, requested);
    return {
      type,
      status: "REVERSED",
      amountUnits,
      appliedUnits: -collected,
      shortfallUnits: requested - collected,
      next: {
        availableUnits: account.availableUnits - collected,
        reservedUnits,
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
      reservedUnits,
      lifetimeCreditedUnits: account.lifetimeCreditedUnits + amountUnits,
    },
  };
}
