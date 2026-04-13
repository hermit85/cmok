/**
 * Resolve display name for a relationship partner.
 *
 * Priority:
 * 1. signaler_label / senior_name from care_pairs (relationship-specific, user-chosen)
 * 2. users.name IF it's not a generic default
 * 3. fallback "Bliska osoba"
 */

const GENERIC_NAMES = ['Ja', 'Bliska osoba', 'cmok'];

export function resolveLabel(
  relLabel: string | null | undefined,
  dbName: string | null | undefined,
  fallback = 'Bliska osoba',
): string {
  if (relLabel && relLabel.trim().length > 0) return relLabel;
  if (dbName && !GENERIC_NAMES.includes(dbName)) return dbName;
  return fallback;
}
