// ============================================================
// cmok, checkin-monitor Edge Function
// Uruchamiana co 30 minut (cron).
// Sprawdza które seniorki nie kliknęły "JESTEM OK" i eskaluje.
//
// Cron setup w Supabase Dashboard → Database → Extensions → pg_cron:
//   SELECT cron.schedule('checkin-monitor', '*/30 * * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/checkin-monitor',
//       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//     )$$
//   );
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let processed = 0;
  let reminders = 0;
  let alerts = 0;
  const errors: string[] = [];

  try {
    // 1. Pobierz wszystkich aktywnych seniorów z care_pair
    const { data: seniors, error: fetchError } = await supabase
      .from('care_pairs')
      .select(`
        senior_id,
        caregiver_id,
        sms_fallback_phone,
        users!care_pairs_senior_id_fkey (
          id,
          name,
          checkin_time,
          timezone,
          last_reminder_date
        )
      `)
      .eq('status', 'active');

    if (fetchError) throw fetchError;
    if (!seniors || seniors.length === 0) {
      return jsonResponse({ processed: 0, reminders: 0, alerts: 0, message: 'Brak aktywnych seniorów' });
    }

    for (const pair of seniors) {
      try {
        const senior = (pair as any).users;
        if (!senior) continue;

        processed++;

        const tz = senior.timezone || 'Europe/Warsaw';
        const checkinTime = senior.checkin_time || '08:00';

        // Oblicz czas lokalny seniora
        const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
        const todayStr = formatDate(nowLocal);

        // Oblicz deadline check-inu
        const [deadlineH, deadlineM] = checkinTime.split(':').map(Number);
        const deadline = new Date(nowLocal);
        deadline.setHours(deadlineH, deadlineM, 0, 0);

        const hoursSinceDeadline = (nowLocal.getTime() - deadline.getTime()) / (1000 * 60 * 60);

        // Jeśli jeszcze przed deadline — skip
        if (hoursSinceDeadline < 0) continue;

        // Sprawdź czy dziś jest check-in
        const { data: todayCheckin } = await supabase
          .from('daily_checkins')
          .select('id')
          .eq('senior_id', senior.id)
          .eq('local_date', todayStr)
          .limit(1)
          .maybeSingle();

        if (todayCheckin) continue; // Jest check-in → OK

        // ── Eskalacja wg czasu ──

        // 0-2h → nic
        if (hoursSinceDeadline < 2) continue;

        // 2-4h → push reminder do seniora
        if (hoursSinceDeadline >= 2 && hoursSinceDeadline < 4) {
          // Sprawdź czy już wysłano reminder dziś
          if (senior.last_reminder_date === todayStr) continue;

          const { data: existingReminder } = await supabase
            .from('alert_deliveries')
            .select('id')
            .eq('recipient_id', senior.id)
            .eq('channel', 'push')
            .gte('sent_at', todayStr + 'T00:00:00Z')
            .limit(1)
            .maybeSingle();

          if (existingReminder) continue; // Już wysłano

          // Wyślij reminder
          await supabase.from('alert_deliveries').insert({
            alert_case_id: null as any, // brak alert_case — to tylko reminder
            recipient_id: senior.id,
            channel: 'push',
            attempt_no: 1,
            payload: {
              title: 'cmok',
              body: 'Cześć! Daj znać że wszystko OK 😊',
              type: 'checkin_reminder',
            },
            status: 'sent',
          });

          // Zapisz datę reminderu
          await supabase
            .from('users')
            .update({ last_reminder_date: todayStr })
            .eq('id', senior.id);

          reminders++;
          continue;
        }

        // 4h+ → alert do caregivera
        if (hoursSinceDeadline >= 4) {
          // Sprawdź czy już jest otwarty missed_checkin alert na dziś
          const { data: existingAlert } = await supabase
            .from('alert_cases')
            .select('id')
            .eq('senior_id', senior.id)
            .eq('type', 'missed_checkin')
            .in('state', ['open', 'acknowledged'])
            .gte('triggered_at', todayStr + 'T00:00:00Z')
            .limit(1)
            .maybeSingle();

          if (existingAlert) continue; // Już jest alert

          // Stwórz alert_case
          const { data: alertCase, error: alertError } = await supabase
            .from('alert_cases')
            .insert({
              senior_id: senior.id,
              type: 'missed_checkin',
              state: 'open',
            })
            .select()
            .single();

          if (alertError) {
            errors.push(`Alert insert error for ${senior.id}: ${alertError.message}`);
            continue;
          }

          // Push delivery do caregivera
          await supabase.from('alert_deliveries').insert({
            alert_case_id: alertCase.id,
            recipient_id: pair.caregiver_id,
            channel: 'push',
            attempt_no: 1,
            payload: {
              title: 'cmok, brak znaku',
              body: `${senior.name} — dziś jeszcze bez znaku.`,
              type: 'missed_checkin',
            },
            status: 'sent',
          });

          // SMS backup delivery
          await supabase.from('alert_deliveries').insert({
            alert_case_id: alertCase.id,
            recipient_id: pair.caregiver_id,
            channel: 'sms',
            attempt_no: 1,
            payload: {
              phone: pair.sms_fallback_phone,
              body: `cmok: ${senior.name} — dziś jeszcze bez znaku. Sprawdź czy wszystko OK.`,
              type: 'missed_checkin',
            },
            status: 'sent',
          });

          alerts++;
        }
      } catch (pairErr) {
        errors.push(`Error processing senior ${pair.senior_id}: ${String(pairErr)}`);
      }
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }

  return jsonResponse({ processed, reminders, alerts, errors: errors.length > 0 ? errors : undefined });
});

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
