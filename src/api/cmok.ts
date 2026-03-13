import { supabase } from './supabase';

export interface RecentCmok {
  id: string;
  sender_name: string;
  created_at: string;
}

export async function getRecentCmoks(familyId: string): Promise<RecentCmok[]> {
  const { data, error } = await supabase
    .from('cmoks')
    .select('id, created_at, sender_id, members!cmoks_sender_id_fkey(name)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    // Fallback: if join doesn't work, fetch cmoks and members separately
    const { data: cmoks } = await supabase
      .from('cmoks')
      .select('id, created_at, sender_id')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!cmoks || cmoks.length === 0) return [];

    const senderIds = [...new Set(cmoks.map((c) => c.sender_id))];
    const { data: members } = await supabase
      .from('members')
      .select('id, name')
      .in('id', senderIds);

    const nameMap = new Map((members || []).map((m) => [m.id, m.name]));

    return cmoks.map((c) => ({
      id: c.id,
      sender_name: nameMap.get(c.sender_id) || 'Nieznany',
      created_at: c.created_at,
    }));
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    sender_name: c.members?.name || 'Nieznany',
    created_at: c.created_at,
  }));
}

export async function sendCmok(memberId: string) {
  // Get sender info
  const { data: sender, error: senderError } = await supabase
    .from('members')
    .select('id, name, family_id')
    .eq('id', memberId)
    .single();

  if (senderError || !sender) throw new Error('Member not found');

  // Save cmok
  const { error: cmokError } = await supabase
    .from('cmoks')
    .insert({
      sender_id: sender.id,
      family_id: sender.family_id,
    });

  if (cmokError) throw cmokError;

  // Update last_cmok_at
  await supabase
    .from('members')
    .update({ last_cmok_at: new Date().toISOString() })
    .eq('id', sender.id);

  // Calculate streak
  const streak = await calculateStreak(sender.family_id);

  // Send push to other family members (fire and forget)
  sendPushToFamily(sender.id, sender.name, sender.family_id);

  return { success: true, streak };
}

async function calculateStreak(familyId: string): Promise<number> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: cmoks } = await supabase
    .from('cmoks')
    .select('created_at')
    .eq('family_id', familyId)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (!cmoks || cmoks.length === 0) return 0;

  const dates = new Set<string>();
  for (const cmok of cmoks) {
    dates.add(cmok.created_at.split('T')[0]);
  }

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 90; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (dates.has(dateStr)) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  return streak;
}

async function sendPushToFamily(senderId: string, senderName: string, familyId: string) {
  try {
    const { data: familyMembers } = await supabase
      .from('members')
      .select('expo_push_token')
      .eq('family_id', familyId)
      .neq('id', senderId);

    if (!familyMembers) return;

    const tokens = familyMembers
      .filter((m) => m.expo_push_token)
      .map((m) => m.expo_push_token);

    if (tokens.length === 0) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: 'Cmok!',
          body: `${senderName} wysłał(a) Ci cmoka 💜`,
          sound: 'default',
          badge: 1,
        }))
      ),
    });
  } catch (err) {
    console.log('Push notification error:', err);
  }
}
