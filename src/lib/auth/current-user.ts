import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, createdAt: true, emailVerifiedAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    session.destroy();
    await session.save();
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
