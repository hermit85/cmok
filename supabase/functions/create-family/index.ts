import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

    const { name, member_name, device_id, expo_push_token } = await req.json();

    if (!member_name || !device_id) {
      return new Response(
        JSON.stringify({ error: 'member_name and device_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if device already has a family
    const { data: existingMember } = await supabase
      .from('members')
      .select('id, family_id')
      .eq('device_id', device_id)
      .single();

    if (existingMember) {
      // Get existing family code
      const { data: existingFamily } = await supabase
        .from('families')
        .select('code')
        .eq('id', existingMember.family_id)
        .single();

      return new Response(
        JSON.stringify({
          family_id: existingMember.family_id,
          family_code: existingFamily?.code,
          member_id: existingMember.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique family code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('families')
        .select('id')
        .eq('code', code)
        .single();

      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    // Create family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ code, name: name || 'Moja rodzina' })
      .select()
      .single();

    if (familyError) throw familyError;

    // Create first member
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

    return new Response(
      JSON.stringify({
        family_id: family.id,
        family_code: family.code,
        member_id: member.id,
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
