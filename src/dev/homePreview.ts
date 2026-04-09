export type SignalerHomePreview = 'before' | 'after' | 'support';
export type RecipientHomePreview = 'before' | 'after' | 'response' | 'support';

function normalizeParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export function parseSignalerHomePreview(value: string | string[] | undefined): SignalerHomePreview | null {
  const normalized = normalizeParam(value);
  if (normalized === 'before' || normalized === 'after' || normalized === 'support') {
    return normalized;
  }
  return null;
}

export function parseRecipientHomePreview(value: string | string[] | undefined): RecipientHomePreview | null {
  const normalized = normalizeParam(value);
  if (normalized === 'before' || normalized === 'after' || normalized === 'response' || normalized === 'support') {
    return normalized;
  }
  return null;
}

