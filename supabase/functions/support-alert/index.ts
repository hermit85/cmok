import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupportAlertRequest =
  | {
      action: 'trigger';
      latitude?: number | null;
      longitude?: number | null;
    }
  | {
      action: 'retry';
      alert_id: string;
    };

interface DispatchRecipient {
  userId: string;
  audience: 'primary' | 'trusted';
  name: string;
  pushTokens: string[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isExpoPushToken(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = (await req.json()) as SupportAlertRequest;

    const { data: profile } = await serviceSupabase
      .from('users')
      .select('id, name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return jsonResponse({ error: 'User profile not found' }, 404);
    }

    const { data: relationshipRow } = await serviceSupabase
      .from('care_pairs')
      .select('id, senior_id, caregiver_id, status')
      .eq('senior_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!relationshipRow) {
      return jsonResponse({ error: 'Active relationship not found' }, 404);
    }

    const relationship = {
      id: relationshipRow.id,
      signalerUserId: relationshipRow.senior_id,
      recipientUserId: relationshipRow.caregiver_id,
    };

    const alertCase =
      body.action === 'trigger'
        ? await getOrCreateAlert(serviceSupabase, {
            signalerId: user.id,
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
          })
        : await getRetryAlert(serviceSupabase, {
            alertId: body.alert_id,
            signalerId: user.id,
          });

    const recipients = await loadDispatchRecipients(serviceSupabase, relationship.id, relationship.recipientUserId);
    const existingDeliveries = await loadExistingDeliveries(serviceSupabase, alertCase.id);
    const sendResults = await sendSupportPushes({
      alertId: alertCase.id,
      recipients,
      signalerName: profile.name || 'Bliska osoba',
      latitude: alertCase.latitude,
      longitude: alertCase.longitude,
    });

    const deliveries = recipients.map((recipient) => ({
      alert_case_id: alertCase.id,
      recipient_id: recipient.userId,
      channel: 'push',
      attempt_no: (existingDeliveries.get(recipient.userId) || 0) + 1,
      payload: {
        type: 'sos',
        audience: recipient.audience,
        signaler_name: profile.name || 'Bliska osoba',
        latitude: alertCase.latitude,
        longitude: alertCase.longitude,
      },
      status: sendResults.get(recipient.userId)?.sent ? 'sent' : 'failed',
    }));

    if (deliveries.length > 0) {
      await serviceSupabase.from('alert_deliveries').insert(deliveries);
    }

    return jsonResponse({
      ok: true,
      alert_case: alertCase,
      recipients: recipients.map((recipient) => ({
        user_id: recipient.userId,
        name: recipient.name,
        audience: recipient.audience,
        status: sendResults.get(recipient.userId)?.sent ? 'sent' : 'failed',
        tokens_attempted: recipient.pushTokens.length,
      })),
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

async function getOrCreateAlert(
  serviceSupabase: ReturnType<typeof createClient>,
  params: {
    signalerId: string;
    latitude: number | null;
    longitude: number | null;
  }
) {
  const { data: existing } = await serviceSupabase
    .from('alert_cases')
    .select('*')
    .eq('senior_id', params.signalerId)
    .eq('type', 'sos')
    .in('state', ['open', 'acknowledged'])
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: alertCase, error } = await serviceSupabase
    .from('alert_cases')
    .insert({
      senior_id: params.signalerId,
      type: 'sos',
      state: 'open',
      latitude: params.latitude,
      longitude: params.longitude,
    })
    .select()
    .single();

  if (error || !alertCase) {
    throw new Error(error?.message || 'Could not create alert case');
  }

  return alertCase;
}

async function getRetryAlert(
  serviceSupabase: ReturnType<typeof createClient>,
  params: {
    alertId: string;
    signalerId: string;
  }
) {
  const { data: alertCase, error } = await serviceSupabase
    .from('alert_cases')
    .select('*')
    .eq('id', params.alertId)
    .eq('senior_id', params.signalerId)
    .eq('type', 'sos')
    .in('state', ['open', 'acknowledged'])
    .maybeSingle();

  if (error || !alertCase) {
    throw new Error(error?.message || 'Alert case not found');
  }

  return alertCase;
}

async function loadDispatchRecipients(
  serviceSupabase: ReturnType<typeof createClient>,
  relationshipId: string,
  primaryRecipientId: string
): Promise<DispatchRecipient[]> {
  const { data: trustedContacts } = await serviceSupabase
    .from('trusted_contacts')
    .select('user_id')
    .eq('relationship_id', relationshipId)
    .eq('status', 'active');

  const recipients = new Map<string, { audience: 'primary' | 'trusted' }>();
  recipients.set(primaryRecipientId, { audience: 'primary' });

  for (const contact of trustedContacts || []) {
    recipients.set(contact.user_id, { audience: 'trusted' });
  }

  const recipientIds = [...recipients.keys()];
  if (recipientIds.length === 0) return [];

  const [{ data: users }, { data: devices }] = await Promise.all([
    serviceSupabase.from('users').select('id, name').in('id', recipientIds),
    serviceSupabase
      .from('device_installations')
      .select('user_id, push_token, notifications_enabled')
      .in('user_id', recipientIds)
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null),
  ]);

  const userMap = new Map((users || []).map((recipientUser) => [recipientUser.id, recipientUser]));
  const pushMap = new Map<string, string[]>();

  for (const device of devices || []) {
    if (!isExpoPushToken(device.push_token)) continue;
    const list = pushMap.get(device.user_id) || [];
    list.push(device.push_token);
    pushMap.set(device.user_id, list);
  }

  return recipientIds.map((recipientId) => ({
    userId: recipientId,
    audience: recipients.get(recipientId)?.audience || 'trusted',
    name: userMap.get(recipientId)?.name || 'Bliska osoba',
    pushTokens: [...new Set(pushMap.get(recipientId) || [])],
  }));
}

async function loadExistingDeliveries(
  serviceSupabase: ReturnType<typeof createClient>,
  alertId: string
) {
  const { data } = await serviceSupabase
    .from('alert_deliveries')
    .select('recipient_id, attempt_no')
    .eq('alert_case_id', alertId)
    .eq('channel', 'push');

  const attempts = new Map<string, number>();

  for (const item of data || []) {
    attempts.set(item.recipient_id, Math.max(attempts.get(item.recipient_id) || 0, item.attempt_no || 0));
  }

  return attempts;
}

async function sendSupportPushes(params: {
  alertId: string;
  recipients: DispatchRecipient[];
  signalerName: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const results = new Map<string, { sent: boolean }>();
  const tokenOwners = new Map<string, string>();

  const messages = params.recipients.flatMap((recipient) => {
    if (recipient.pushTokens.length === 0) {
      results.set(recipient.userId, { sent: false });
      return [];
    }

    return recipient.pushTokens.map((token) => {
      tokenOwners.set(token, recipient.userId);
      return {
        to: token,
        sound: 'default',
        title: 'Cmok',
        body: `${params.signalerName} wysyła pilny sygnał.`,
        data: {
          type: 'sos',
          alert_id: params.alertId,
          latitude: params.latitude,
          longitude: params.longitude,
        },
        priority: 'high',
        channelId: 'sos',
      };
    });
  });

  if (messages.length === 0) {
    return results;
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      for (const recipient of params.recipients) {
        if (!results.has(recipient.userId)) {
          results.set(recipient.userId, { sent: false });
        }
      }
      return results;
    }

    const payload = await response.json();
    const entries = Array.isArray(payload?.data) ? payload.data : [];

    entries.forEach((entry: any, index: number) => {
      const token = messages[index]?.to;
      const recipientId = tokenOwners.get(token);

      if (!recipientId) return;

      const current = results.get(recipientId)?.sent || false;
      const accepted = entry?.status === 'ok';
      results.set(recipientId, { sent: current || accepted });
    });

    for (const recipient of params.recipients) {
      if (!results.has(recipient.userId)) {
        results.set(recipient.userId, { sent: false });
      }
    }

    return results;
  } catch (_error) {
    for (const recipient of params.recipients) {
      results.set(recipient.userId, { sent: false });
    }
    return results;
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}
