import { readEnv } from "@/lib/env";

export function SupportContact({ lead }: { lead: string }) {
  const email = readEnv().supportEmail;
  if (!email) {
    return (
      <p>
        {lead} The operator has not published a support email yet. Set NEXT_PUBLIC_SUPPORT_EMAIL to a monitored inbox
        before launch.
      </p>
    );
  }
  return (
    <p>
      {lead}{" "}
      <a className="text-brand" href={`mailto:${email}`}>
        {email}
      </a>
      .
    </p>
  );
}
