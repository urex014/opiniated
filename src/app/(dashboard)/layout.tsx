import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireUser } from "@/lib/auth/current-user";
import { readEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/payouts/access";

export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-muted">Loading your account…</p>}>
      <AuthenticatedFrame>{children}</AuthenticatedFrame>
    </Suspense>
  );
}

async function AuthenticatedFrame({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const admin = isAdminEmail(user.email, readEnv().adminEmails);
  return (
    <DashboardShell user={{ name: user.name, email: user.email }} showAdmin={admin}>
      {children}
    </DashboardShell>
  );
}
