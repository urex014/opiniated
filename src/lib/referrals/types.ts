export type UserReferralSummary = {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  pendingCount: number;
  qualifiedCount: number;
  totalEarningsUnits: number;
  approvedEarningsUnits: number;
  heldEarningsUnits: number;
  reversedEarningsUnits: number;
  referrals: Array<{
    id: string;
    maskedEmail: string;
    signupDate: Date;
    isQualified: boolean;
  }>;
  commissions: Array<{
    id: string;
    amountUnits: number;
    status: string;
    eventType: string;
    createdAt: Date;
    surveyTxId: string;
  }>;
};

export type AdminReferralSummary = {
  rateBps: number;
  totalReferrals: number;
  qualifiedReferrals: number;
  qualificationRate: number;
  totalCommissionsUnits: number;
  approvedCommissionsUnits: number;
  heldCommissionsUnits: number;
  reversedCommissionsUnits: number;
  paidCommissionsUnits: number;
  financialBreakdown: {
    grossProviderRevenueUnits: number;
    userRewardsUnits: number;
    opiniatedGrossShareUnits: number;
    referralCommissionsUnits: number;
    netRetainedUnits: number;
  };
  recentCommissions: Array<{
    id: string;
    referrerEmail: string;
    referredEmail: string;
    surveyTxId: string;
    amountUnits: number;
    status: string;
    eventType: string;
    holdReason: string | null;
    createdAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    actorId: string;
    action: string;
    targetId: string | null;
    detail: string | null;
    createdAt: Date;
  }>;
};

export type CommissionReviewInput = {
  commissionId: string;
  action: "hold" | "release";
  reason: string;
  actorEmail: string;
};
