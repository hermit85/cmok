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

    const { code, member_name, device_id, expo_push_token } = await req.json();

    if (!code || !member_name || !device_id) {
      return new Response(
        JSON.stringify({ error: 'code, member_name, and device_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find family by code (case-insensitive)
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('code', code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .single();

    if (familyError || !family) {
      return new Response(
        JSON.stringify({ error: 'Nie znaleziono rodziny z tym kodem' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if device already a member
    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .eq('device_id', device_id)
      .single();

    if (existingMember) {
      // Update existing member to join this family
      const { error: updateError } = await supabase
        .from('members')
        .update({
          family_id: family.id,
          name: member_name,
          expo_push_token: expo_push_token || null,
        })
        .eq('id', existingMember.id);

      if (updateError) throw updateError;

      const { data: members } = await supabase
        .from('members')
        .select('id, name, last_cmok_at')
        .eq('family_id', family.id);

      return new Response(
        JSON.stringify({
          family_id: family.id,
          member_id: existingMember.id,
          members: members || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        family_id: family.id,
        name: member_name,
        device_id,
        expo_push_token: expo_push_token || null,
      })
      .select()
      .single();

    if (memberError) throw memberError;

    // Get all family members
    const { data: members } = await supabase
      .from('members')
      .select('id, name, last_cmok_at')
      .eq('family_id', family.id);

    // Send push to existing members that someone joined
    const otherMembers = (members || []).filter((m) => m.id !== member.id);
    for (const m of otherMembers) {
      const { data: memberData } = await supabase
        .from('members')
        .select('expo_push_token')
        .eq('id', m.id)
        .single();

      if (memberData?.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: memberData.expo_push_token,
            title: 'Nowy czlonek rodziny!',
            body: `${member_name} dolaczyl/a do rodziny!`,
            sound: 'default',
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        family_id: family.id,
        member_id: member.id,
        members: members || [],
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
