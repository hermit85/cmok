import { supabase } from './supabase';

export async function createFamily(params: {
  name: string;
  memberName: string;
  deviceId: string;
  expoPushToken: string;
}) {
  const { data, error } = await supabase.functions.invoke('create-family', {
    body: {
      name: params.name,
      member_name: params.memberName,
      device_id: params.deviceId,
      expo_push_token: params.expoPushToken,
    },
  });

  if (error) throw error;
  return data as { family_id: string; family_code: string; member_id: string };
}

export async function joinFamily(params: {
  code: string;
  memberName: string;
  deviceId: string;
  expoPushToken: string;
}) {
  const { data, error } = await supabase.functions.invoke('join-family', {
    body: {
      code: params.code,
      member_name: params.memberName,
      device_id: params.deviceId,
      expo_push_token: params.expoPushToken,
    },
  });

  if (error) throw error;
  return data as {
    family_id: string;
    member_id: string;
    members: Array<{ id: string; name: string; last_cmok_at: string | null }>;
  };
}

export async function getFamilyStatus(memberId: string) {
  const { data, error } = await supabase.functions.invoke('get-family-status', {
    body: { member_id: memberId },
  });

  if (error) throw error;
  return data as {
    members: Array<{
      name: string;
      last_cmok_at: string | null;
      status: string;
    }>;
    streak: number;
    family_code: string;
  };
}
