import { supabase } from './supabase';

export async function sendCmok(memberId: string) {
  const { data, error } = await supabase.functions.invoke('send-cmok', {
    body: { member_id: memberId },
  });

  if (error) throw error;
  return data as { success: boolean; streak: number };
}
