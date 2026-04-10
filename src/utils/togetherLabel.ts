/**
 * togetherLabel — returns a warm "Razem od..." label
 * based on the number of days since the relationship was activated.
 */
export function getTogetherLabel(joinedAt: string | null): string | null {
  if (!joinedAt) return null;

  const start = new Date(joinedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const days = Math.max(1, Math.floor(diffMs / 86_400_000));

  if (days === 1) return 'Razem od 1 dnia';
  if (days < 7) return `Razem od ${days} dni`;
  if (days === 7) return 'Razem od tygodnia';
  if (days === 14) return 'Razem od 2 tygodni';
  if (days === 30) return 'Razem od miesiąca 💚';
  return `Razem od ${days} dni`;
}
