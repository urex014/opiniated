export function assertSameUser(actorId: string, ownerId: string): void {
  if (actorId !== ownerId) {
    throw new Error("You cannot access another account.");
  }
}
