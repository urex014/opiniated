const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class ResendDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendDeliveryError";
  }
}

export async function sendResendEmail(
  input: {
    apiKey: string;
    from: string;
    to: string;
    subject: string;
    text: string;
    fetchImpl?: typeof fetch;
  },
): Promise<void> {
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
  } catch {
    throw new ResendDeliveryError("Resend could not be reached.");
  }

  if (!response.ok) {
    throw new ResendDeliveryError(`Resend rejected the message (${response.status}).`);
  }
}
