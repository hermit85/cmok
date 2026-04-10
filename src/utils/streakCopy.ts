/**
 * streakCopy — contextual copy after daily check-in based on streak length.
 *
 * streak: consecutive days including today (1 = just today, 7 = full week, etc.)
 * isFirstEver: true if this is the very first check-in in history
 * isGapReturn: true if user missed yesterday but had previous check-ins
 * recipientName: nominative form of recipient name, or null
 */
export function getStreakCopy(
  streak: number,
  isFirstEver: boolean,
  isGapReturn: boolean,
  recipientName: string | null,
): string {
  // Gap return — missed at least one day, came back
  if (isGapReturn) return 'Dobrze, że jesteś z powrotem';

  // Milestones
  if (streak === 1 && isFirstEver) return 'Pierwszy znak wysłany! 🎉';
  if (streak === 2) return 'Drugi dzień z rzędu';
  if (streak >= 3 && streak <= 6) return `Dzień ${streak} z rzędu`;
  if (streak === 7) return 'Cały tydzień! 💚';
  if (streak === 14) return 'Dwa tygodnie razem';
  if (streak === 21) return 'Trzy tygodnie — to już nawyk';
  if (streak === 30) {
    return recipientName
      ? `Miesiąc! ${recipientName} może na Ciebie liczyć`
      : 'Miesiąc!';
  }

  // Default pool — deterministic by day-of-year so copy stays stable all day
  const pool = recipientName
    ? [
        `${recipientName} będzie wiedział(a)`,
        'Znak wysłany',
        `Gotowe — spokojny dzień dla ${recipientName}`,
      ]
    : ['Znak wysłany', 'Gotowe'];

  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000);
  return pool[dayOfYear % pool.length];
}
