import type { Metadata } from "next";
import { ResetForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };
export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  return (
    <>
      <h1 className="text-[28px] font-medium">Choose a new password</h1>
      {token ? (
        <div className="mt-6 border border-line bg-white p-4">
          <ResetForm token={token} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-danger">This reset link is missing a token.</p>
      )}
    </>
  );
}
