export type PaystackKeyMode = "missing" | "test" | "live" | "unknown";

export function paystackKeyMode(secret: string | null): PaystackKeyMode {
  if (!secret) return "missing";
  if (secret.startsWith("sk_test_")) return "test";
  if (secret.startsWith("sk_live_")) return "live";
  return "unknown";
}
