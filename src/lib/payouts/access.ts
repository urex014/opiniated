export function isAdminEmail(email: string, admins: readonly string[]): boolean {
  return admins.includes(email.trim().toLowerCase());
}
