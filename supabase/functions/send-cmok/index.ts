import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { member_id } = await req.json();

    if (!member_id) {
      return new Response(
        JSON.stringify({ error: 'member_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender info
    const { data: sender, error: senderError } = await supabase
      .from('members')
      .select('id, name, family_id')
      .eq('id', member_id)
      .single();

    if (senderError || !sender) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const streak = await calculateStreak(supabase, sender.family_id);

    // Send push to all other family members
    const { data: familyMembers } = await supabase
      .from('members')
      .select('id, expo_push_token')
      .eq('family_id', sender.family_id)
      .neq('id', sender.id);

    if (familyMembers) {
      const pushPromises = familyMembers
        .filter((m) => m.expo_push_token)
        .map((m) =>
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: m.expo_push_token,
              title: 'Cmok!',
              body: `${sender.name} wysłał/a Ci cmoka 💜`,
              sound: 'default',
              badge: 1,
            }),
          })
        );

      await Promise.all(pushPromises);
    }

    return new Response(
      JSON.stringify({ success: true, streak }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateStreak(supabase: any, familyId: string): Promise<number> {
  // Get cmoks for last 90 days, grouped by date
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: cmoks } = await supabase
    .from('cmoks')
    .select('created_at')
    .eq('family_id', familyId)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (!cmoks || cmoks.length === 0) return 0;

  // Get unique dates (in local timezone approximation)
  const dates = new Set<string>();
  for (const cmok of cmoks) {
    const date = cmok.created_at.split('T')[0];
    dates.add(date);
  }

  // Count consecutive days from today
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 90; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (dates.has(dateStr)) {
      streak++;
    } else if (i === 0) {
      // Today has no cmok yet, that's ok — check from yesterday
      continue;
    } else {
      break;
    }
  }

  return streak;
}
