import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getMemberStatus(lastCmokAt: string | null): string {
  if (!lastCmokAt) return '🔴';

  const now = new Date();
  const lastCmok = new Date(lastCmokAt);
  const diffHours = (now.getTime() - lastCmok.getTime()) / 3600000;

  if (diffHours < 24) return '🟢';
  if (diffHours < 48) return '🟡';
  return '🔴';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Support both GET query params and POST body
    let memberId: string;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      memberId = url.searchParams.get('member_id') || '';
    } else {
      const body = await req.json();
      memberId = body.member_id || '';
    }

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'member_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get member's family
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('family_id')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    return new Response(
      JSON.stringify({
        members: membersWithStatus,
        streak,
        family_code: family?.code || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
