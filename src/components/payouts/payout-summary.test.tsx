import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayoutSummary, WithdrawalHistory } from "@/components/payouts/payout-summary";

describe("payout summary", () => {
  it("shows the spendable balance, the reserved amount, and the minimum", () => {
    const html = renderToStaticMarkup(
      <PayoutSummary
        spendableUnits={80}
        reservedUnits={20}
        minimumPoints={100}
        currencyCode="PTS"
        factor={1}
        koboPerPoint={100}
      />,
    );
    expect(html).toContain("Available to withdraw");
    expect(html).toContain("80 PTS");
    expect(html).toContain("Reserved for withdrawal");
    expect(html).toContain("20 PTS");
    expect(html).toContain("100 PTS");
    expect(html).toContain("100.00");
  });

  it("does not describe a submitted transfer as paid", () => {
    const html = renderToStaticMarkup(
      <WithdrawalHistory
        rows={[
          {
            id: "1",
            requestedAt: new Date("2026-10-11T12:00:00.000Z"),
            points: 100,
            amountKobo: 10000,
            status: "PROCESSING",
            failureReason: null,
          },
        ]}
        currencyCode="PTS"
        factor={1}
      />,
    );
    expect(html).toContain("Processing");
    expect(html).toContain("Your payout is being processed.");
    expect(html).not.toContain("Your payout has been completed.");
  });
});
