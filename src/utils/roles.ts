import type { AppRole } from '../types';

type RawRole = AppRole | 'senior' | 'caregiver' | null | undefined;

export function normalizeAppRole(role: RawRole): AppRole | null {
  if (role === 'signaler' || role === 'senior') return 'signaler';
  if (role === 'recipient' || role === 'caregiver') return 'recipient';
  return null;
}

export function toLegacyRole(role: AppRole): 'senior' | 'caregiver' {
  return role === 'signaler' ? 'senior' : 'caregiver';
}

