import { supabase } from '../services/supabase';

/**
 * Look up inviter info from an invite code.
 * Returns the signaler_label (display name chosen by the recipient who created the invite)
 * or null if not found / expired.
 */
export async function lookupInviter(code: string): Promise<{ label: string } | null> {
  const cleanCode = code.replace(/\D/g, '');
  if (cleanCode.length !== 6) return null;

  try {
    const { data } = await supabase
      .from('care_pairs')
      .select('signaler_label, senior_name')
      .eq('invite_code', cleanCode)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    const label = data.signaler_label || data.senior_name || null;
    return label ? { label } : null;
  } catch {
    return null;
  }
}
