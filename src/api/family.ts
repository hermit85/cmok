import { supabase } from './supabase';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getMemberStatus(lastCmokAt: string | null): string {
  if (!lastCmokAt) return '🔴';
  const diffHours = (Date.now() - new Date(lastCmokAt).getTime()) / 3600000;
  if (diffHours < 24) return '🟢';
  if (diffHours < 48) return '🟡';
  return '🔴';
}

export async function createFamily(params: {
  name: string;
  memberName: string;
  deviceId: string;
  expoPushToken: string;
}) {
  // Check if device already has a family
  const { data: existingMember } = await supabase
    .from('members')
    .select('id, family_id')
    .eq('device_id', params.deviceId)
    .maybeSingle();

  if (existingMember) {
    const { data: existingFamily } = await supabase
      .from('families')
      .select('code')
      .eq('id', existingMember.family_id)
      .single();

    return {
      family_id: existingMember.family_id,
      family_code: existingFamily?.code || '',
      member_id: existingMember.id,
    };
  }

  // Generate unique family code
  let code = generateCode();
  for (let attempts = 0; attempts < 10; attempts++) {
    const { data: existing } = await supabase
      .from('families')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!existing) break;
    code = generateCode();
  }

  // Create family
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ code, name: params.name || 'Moja rodzina' })
    .select()
    .single();

  if (familyError) throw familyError;

  // Create first member
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      family_id: family.id,
      name: params.memberName,
      device_id: params.deviceId,
      expo_push_token: params.expoPushToken || null,
    })
    .select()
    .single();

  if (memberError) throw memberError;

  return {
    family_id: family.id,
    family_code: family.code,
    member_id: member.id,
  };
}

export async function joinFamily(params: {
  code: string;
  memberName: string;
  deviceId: string;
  expoPushToken: string;
}) {
  const cleanCode = params.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Find family by code
  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('*')
    .eq('code', cleanCode)
    .single();

  if (familyError || !family) {
    throw new Error('Nie znaleziono rodziny z tym kodem');
  }

  // Check if device already a member
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('device_id', params.deviceId)
    .maybeSingle();

  let memberId: string;

  if (existingMember) {
    // Update existing member to join this family
    const { error: updateError } = await supabase
      .from('members')
      .update({
        family_id: family.id,
        name: params.memberName,
        expo_push_token: params.expoPushToken || null,
      })
      .eq('id', existingMember.id);

    if (updateError) throw updateError;
    memberId = existingMember.id;
  } else {
    // Create new member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        family_id: family.id,
        name: params.memberName,
        device_id: params.deviceId,
        expo_push_token: params.expoPushToken || null,
      })
      .select()
      .single();

    if (memberError) throw memberError;
    memberId = member.id;
  }

  // Get all family members
  const { data: members } = await supabase
    .from('members')
    .select('id, name, last_cmok_at')
    .eq('family_id', family.id);

  // Notify other members (fire and forget)
  notifyFamilyOfNewMember(memberId, params.memberName, family.id);

  return {
    family_id: family.id,
    member_id: memberId,
    members: members || [],
  };
}

export async function getFamilyStatus(memberId: string) {
  // Get member's family
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('family_id')
    .eq('id', memberId)
    .single();

  if (memberError || !member) throw new Error('Member not found');

  // Get family code
  const { data: family } = await supabase
    .from('families')
    .select('code')
    .eq('id', member.family_id)
    .single();

  // Get all family members
  const { data: members } = await supabase
    .from('members')
    .select('id, name, last_cmok_at, created_at')
    .eq('family_id', member.family_id)
    .order('created_at', { ascending: true });

  const membersWithStatus = (members || []).map((m) => ({
    id: m.id,
    name: m.name,
    last_cmok_at: m.last_cmok_at,
    status: getMemberStatus(m.last_cmok_at),
  }));

  // Calculate streak
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: cmoks } = await supabase
    .from('cmoks')
    .select('created_at')
    .eq('family_id', member.family_id)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  let streak = 0;
  if (cmoks && cmoks.length > 0) {
    const dates = new Set<string>();
    for (const cmok of cmoks) {
      dates.add(cmok.created_at.split('T')[0]);
    }

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
  }

  return {
    members: membersWithStatus,
    streak,
    family_code: family?.code || '',
  };
}

async function notifyFamilyOfNewMember(newMemberId: string, memberName: string, familyId: string) {
  try {
    const { data: others } = await supabase
      .from('members')
      .select('expo_push_token')
      .eq('family_id', familyId)
      .neq('id', newMemberId);

    if (!others) return;

    const tokens = others
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
          title: 'Nowy czlonek rodziny!',
          body: `${memberName} dolaczyl/a do rodziny!`,
          sound: 'default',
        }))
      ),
    });
  } catch (err) {
    console.log('Push notification error:', err);
  }
}
