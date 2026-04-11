import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../components/ScreenHeader';
import { WeekDots } from '../components/WeekDots';
import { SupportParticipants } from '../components/SupportParticipants';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/tokens';
import { useCircle } from '../hooks/useCircle';
import { useSignals } from '../hooks/useSignals';
import { useUrgentSignal } from '../hooks/useUrgentSignal';
import { useWeekRhythm } from '../hooks/useWeekRhythm';
import { haptics } from '../utils/haptics';
import { openPhoneCall } from '../utils/linking';
import { supabase } from '../services/supabase';
import type { DailyCheckin, SupportParticipant as SParticipant } from '../types';
import type { RecipientHomePreview } from '../dev/homePreview';
import { formatClock } from '../utils/date';
import { todayDateKey } from '../utils/today';
import { logInviteEvent } from '../utils/invite';
import { relationDisplay, relationFor, relationFrom, relationTo } from '../utils/relationCopy';

/* ─── helpers ─── */

type DayStatus = 'ok' | 'missing' | 'future';
// Single response emoji — warm, simple, one-tap
function fmtTime(iso: string): string { return formatClock(iso) || '--:--'; }
function fmtRelative(ld: string | null, ca: string | null): string | null {
  if (!ld || !ca) return null;
  const today = todayDateKey(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const t = fmtTime(ca);
  if (ld === today) return `dziś o ${t}`;
  if (ld === todayDateKey(y)) return `wczoraj o ${t}`;
  const [yr, mo, dy] = ld.split('-');
  return `${dy}.${mo}.${yr} o ${t}`;
}

/* ─── Avatar ─── */

function Avatar({ name, ok }: { name: string; ok: boolean | null }) {
  const letter = (name || '?').charAt(0).toUpperCase();
  const dotColor = ok === true ? Colors.safe : ok === false ? Colors.accent : Colors.border;
  return (
    <View style={st.avatar}>
      <Text style={st.avatarLetter}>{letter}</Text>
      <View style={[st.dot, { backgroundColor: dotColor }]} />
    </View>
  );
}

/* ─── Response tap ─── */

function ResponseTap({ signalerName, signalerId, preview }: { signalerName: string; signalerId: string; preview: boolean }) {
  const { sendSignal, hasSentReactionToday } = useSignals();
  const alreadySent = !preview && hasSentReactionToday(signalerId);
  const [justSent, setJustSent] = useState(false);
  const sent = alreadySent || justSent;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (alreadySent) logInviteEvent('recipient_response_state_restored');
    else logInviteEvent('recipient_response_cta_seen');
  }, [alreadySent]);

  const handleTap = async () => {
    if (sent) {
      logInviteEvent('recipient_response_duplicate_blocked');
      return;
    }
    haptics.medium();
    logInviteEvent('recipient_response_started');
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 50, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start();
    try {
      if (!preview) {
        const ok = await sendSignal(signalerId, '\u{1F49B}');
        if (!ok) { logInviteEvent('recipient_response_duplicate_blocked'); return; }
      }
      setJustSent(true);
      logInviteEvent('recipient_response_sent');
    } catch { /* silent */ }
  };

  return (
    <View style={st.responseSection}>
      {sent ? (
        <View style={st.responseSentWrap}>
          <Text style={st.responseSentText}>Poszło {relationFor(signalerName)} {'\u{1F49B}'}</Text>
        </View>
      ) : (
        <>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable onPress={handleTap} style={({ pressed }) => [st.responseBtn, pressed && { opacity: 0.85 }]}>
              <Text style={st.responseBtnEmoji}>{'\u{1F49B}'}</Text>
            </Pressable>
          </Animated.View>
          <Text style={st.responseHint}>Stuknij, żeby dać znać</Text>
        </>
      )}
    </View>
  );
}

/* ─── preview data ─── */

const PV_PARTICIPANTS: SParticipant[] = [
  { userId: 'r', name: 'Ania', phone: '+48600100400', kind: 'primary', deliveryStatus: 'sent', isClaimedBy: true },
  { userId: 't', name: 'Ela', phone: '+48600100300', kind: 'trusted', deliveryStatus: 'sent', isClaimedBy: false },
];

/* ─── main ─── */

export function RecipientHomeScreen({ preview = null }: { preview?: RecipientHomePreview | null }) {
  const router = useRouter();
  const { signalers, loading: circleLoading } = useCircle();
  const { urgentCase, currentAlert, claim, resolve, loading: urgentLoading } = useUrgentSignal();

  const signaler = signalers[0] || null;
  const [previewMode, setPreviewMode] = useState<RecipientHomePreview | null>(preview);
  const pv = __DEV__ && !!previewMode;
  const sigName = pv ? 'Mama' : signaler?.name || null;
  const sigId = pv ? 'ps' : signaler?.userId || null;
  const callPhone = pv ? '+48600100200' : signaler?.phone || '';

  const { days: realWeekDays, refresh: refreshWeek } = useWeekRhythm(sigId);

  const [isOk, setIsOk] = useState(false);
  const [todayTime, setTodayTime] = useState<string | null>(null);
  const [lastContact, setLastContact] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const afterFade = useRef(new Animated.Value(0)).current;

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  /* ─── data ─── */

  const fetchData = useCallback(async () => {
    if (!sigId) return;
    try {
      const today = new Date();
      const todayStr = todayDateKey(today);
      const { data } = await supabase.from('daily_checkins').select('local_date, checked_at')
        .eq('senior_id', sigId).gte('local_date', todayStr).lte('local_date', todayStr).limit(1).maybeSingle();

      const todayRow = data as DailyCheckin | null;

      // Last contact from recent history
      const ago = new Date(today); ago.setDate(today.getDate() - 6);
      const { data: recent } = await supabase.from('daily_checkins').select('local_date, checked_at')
        .eq('senior_id', sigId).gte('local_date', todayDateKey(ago)).lte('local_date', todayStr)
        .order('local_date', { ascending: false }).limit(1).maybeSingle();
      const latestRow = recent as DailyCheckin | null;

      setTodayTime(todayRow ? fmtTime(todayRow.checked_at) : null);
      setLastContact(fmtRelative(latestRow?.local_date ?? null, latestRow?.checked_at ?? null));
      setIsOk(urgentCase?.viewerRole === 'primary' && currentAlert ? false : !!todayRow);
    } catch (e) { console.error('fetchData:', e); } finally { setDataLoading(false); }
  }, [sigId, urgentCase?.viewerRole, currentAlert]);

  useEffect(() => {
    if (pv) { setDataLoading(false); return; }
    if (sigId) fetchData(); else if (!circleLoading) setDataLoading(false);
  }, [pv, sigId, circleLoading, fetchData]);

  useEffect(() => {
    if (pv || !sigId) return;
    const ch = supabase.channel('r-checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_checkins', filter: `senior_id=eq.${sigId}` }, () => { fetchData(); refreshWeek(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pv, sigId, fetchData, refreshWeek]);

  /* ─── transition ─── */

  const effOk = previewMode === 'before' ? false : previewMode === 'after' || previewMode === 'response' ? true : isOk;

  useEffect(() => {
    if (effOk) {
      afterFade.setValue(0);
      Animated.timing(afterFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } else {
      afterFade.setValue(1);
    }
  }, [effOk, afterFade]);

  /* ─── computed values (must be before early returns for hook stability) ─── */

  const effTime = previewMode === 'after' || previewMode === 'response' ? '07:55' : todayTime;
  const effLast = previewMode === 'before' ? 'wczoraj o 19:40' : lastContact;
  const effWeek = previewMode === 'before' ? (['ok','missing','ok','ok','ok','missing','future'] as DayStatus[])
    : previewMode === 'after' || previewMode === 'response' ? (['ok','ok','ok','ok','ok','ok','ok'] as DayStatus[])
    : realWeekDays;
  const name = relationDisplay(sigName);
  const nameFrom = relationFrom(sigName).replace('od ', '');

  const isFirstEver = !pv && realWeekDays.length > 0 && realWeekDays.filter((d) => d === 'ok').length <= 1 && effOk;

  // Gap detection for receiver
  const hasReceiverGap = !pv && !effOk && effWeek.length >= 2 && (() => {
    const past = effWeek.filter((d) => d !== 'future');
    if (past.length < 2) return false;
    let missingRun = 0;
    for (let i = past.length - 1; i >= 0; i--) {
      if (past[i] === 'missing') missingRun++;
      else break;
    }
    return missingRun >= 2 && past.some((d) => d === 'ok');
  })();

  const pvUrgent = previewMode === 'support' ? {
    alert: { id: 'pa', senior_id: 'ps', type: 'sos' as const, state: 'acknowledged' as const,
      triggered_at: new Date().toISOString(), latitude: 49.62, longitude: 20.70,
      acknowledged_by: 'r', acknowledged_at: new Date().toISOString(), resolved_at: null },
    relationshipId: 'pr', viewerUserId: 'r', signalerId: 'ps', signalerName: 'Mama',
    primaryRecipientId: 'r', claimerId: 'r', claimerName: 'Ania', viewerRole: 'primary' as const, participants: PV_PARTICIPANTS,
  } : null;
  const effUrgent = pv ? pvUrgent : urgentCase;
  const effAlert = pv ? pvUrgent?.alert ?? null : currentAlert;

  /* ─── tracking (must be before early returns — hooks can't be conditional) ─── */

  useEffect(() => { logInviteEvent('recipient_home_viewed'); }, []);
  useEffect(() => {
    if (effOk) logInviteEvent('recipient_sign_seen_today');
    else if (hasReceiverGap) logInviteEvent('recipient_gap_waiting_seen');
    else logInviteEvent('recipient_waiting_seen_today');
  }, [effOk, hasReceiverGap]);
  useEffect(() => {
    if (effWeek.length > 0) logInviteEvent('streak_strip_seen');
  }, [effWeek.length]);
  useEffect(() => {
    if (isFirstEver && effOk) logInviteEvent('first_sign_received_viewed');
  }, [isFirstEver, effOk]);

  /* ─── handlers ─── */
  const handleClaim = async () => { if (!currentAlert) return; try { await claim(currentAlert.id); } catch { Alert.alert('Nie udało się', 'Spróbuj ponownie.'); } };
  const handleResolve = async () => { if (!currentAlert) return; try { await resolve(currentAlert.id); } catch { Alert.alert('Nie udało się', 'Spróbuj ponownie.'); } };

  /* ─── loading ─── */
  if (!pv && (circleLoading || dataLoading)) {
    return <SafeAreaView style={st.container}><View style={st.loadingWrap}><ActivityIndicator size="large" color={Colors.accent} /></View></SafeAreaView>;
  }

  /* ─── empty ─── */
  if (!pv && !sigId) {
    return (
      <SafeAreaView style={st.container}>
        <ScreenHeader subtitle={relationFrom(sigName)} />
        <View style={st.emptyWrap}>
          <Text style={st.emptyTitle}>Nie ma jeszcze połączenia</Text>
          <Text style={st.emptyText}>Połącz się z bliską osobą, żeby widzieć codzienny znak.</Text>
          <Pressable onPress={() => router.replace('/onboarding')} style={({ pressed }) => [st.emptyCta, pressed && { opacity: 0.85 }]}>
            <Text style={st.emptyCtaText}>Połącz się</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── urgent state ─── */

  if (effUrgent?.viewerRole === 'primary' && effAlert) {
    const claimed = !!effUrgent.claimerId;
    const byMe = effUrgent.claimerId === effUrgent.viewerUserId;
    return (
      <SafeAreaView style={st.container}>
        <ScreenHeader subtitle={relationFrom(effUrgent.signalerName)} />
        <ScrollView contentContainerStyle={st.urgentScroll} showsVerticalScrollIndicator={false}>
          <Text style={st.urgentLabel}>Coś się dzieje</Text>
          <Text style={st.urgentTitle} maxFontSizeMultiplier={1.3}>{relationDisplay(effUrgent.signalerName)} daje znać</Text>
          <Text style={st.urgentBody}>
            {claimed ? byMe ? 'Zajmujesz się tym.' : `${effUrgent.claimerName} już się tym zajmuje.` : 'Nikt jeszcze nie odpowiedział.'}
          </Text>
          <Text style={st.urgentTime}>Wysłano o {fmtTime(effAlert.triggered_at)}</Text>
          {!claimed ? (
            <Pressable onPress={handleClaim} disabled={urgentLoading} style={({ pressed }) => [st.claimBtn, pressed && { opacity: 0.9 }]}>
              <Text style={st.claimBtnText}>Zajmuję się tym</Text>
            </Pressable>
          ) : null}
          {byMe ? (
            <Pressable onPress={handleResolve} disabled={urgentLoading} style={({ pressed }) => [st.resolveBtn, pressed && { opacity: 0.8 }]}>
              <Text style={st.resolveBtnText}>Wszystko OK — zamknij</Text>
            </Pressable>
          ) : null}
          <SupportParticipants participants={effUrgent.participants} />
          <Pressable onPress={() => openPhoneCall(callPhone, 'Nie można połączyć.')} style={({ pressed }) => [st.textLink, pressed && { opacity: 0.7 }]}>
            <Text style={st.textLinkText}>Zadzwoń {relationTo(sigName)}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── daily view ─── */

  const title = effOk
    ? isFirstEver
      ? `Pierwszy znak od ${nameFrom}`
      : `Znak od ${nameFrom}`
    : hasReceiverGap
      ? 'Kilka dni bez znaku'
      : effLast
        ? 'Jeszcze bez znaku'
        : 'Czekamy na pierwszy znak';
  const sub = effOk
    ? `Na dziś jest kontakt${effTime ? ` · ${effTime}` : ''}`
    : hasReceiverGap
      ? 'To bywa. Może odezwij się bezpośrednio?'
      : effLast
        ? `Ostatnio: ${effLast}`
        : 'To dopiero początek';

  return (
    <SafeAreaView style={[st.container, effOk && st.containerAfter]}>
      <ScreenHeader subtitle={relationFrom(sigName)} />
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={st.center}>
          {/* Avatar */}
          <Avatar name={name} ok={effOk ? true : null} />

          {/* Status */}
          {effOk ? (
            <Animated.View style={{ opacity: afterFade, alignItems: 'center' }}>
              <Text style={st.title} maxFontSizeMultiplier={1.3}>{title}</Text>
              {sub ? <Text style={st.sub}>{sub}</Text> : null}
            </Animated.View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={st.title} maxFontSizeMultiplier={1.3}>{title}</Text>
              {sub ? <Text style={st.sub}>{sub}</Text> : null}
            </View>
          )}

          {/* Week dots */}
          {effWeek.length > 0 ? <View style={st.dotsWrap}><WeekDots days={effWeek} showLabel /></View> : null}

          {/* Response */}
          {effOk && sigId ? (
            <Animated.View style={{ opacity: afterFade }}>
              <ResponseTap signalerName={name} signalerId={sigId} preview={pv} />
            </Animated.View>
          ) : null}
        </View>

        {/* Bottom link */}
        <Pressable
          onPress={() => openPhoneCall(callPhone, 'Nie można połączyć.')}
          style={({ pressed }) => [st.bottomLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={st.bottomLinkText}>W razie czego</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const AVATAR = 64;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  containerAfter: { backgroundColor: '#F5F9F4' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* avatar */
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: Colors.safeLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarLetter: { fontSize: 28, fontWeight: '700', color: Colors.safe },
  dot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: Colors.background },

  /* status */
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  sub: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  dotsWrap: { marginTop: 24 },

  /* response */
  responseSection: { alignItems: 'center', marginTop: 28 },
  responseBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.safeLight, justifyContent: 'center', alignItems: 'center',
  },
  responseBtnEmoji: { fontSize: 32 },
  responseHint: { fontSize: 13, color: Colors.textMuted, marginTop: 10 },
  responseSentWrap: { paddingVertical: 8 },
  responseSentText: { fontSize: 16, fontWeight: '600', color: Colors.safe },

  /* bottom */
  bottomLink: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.surface, borderRadius: 14, alignSelf: 'center',
  },
  bottomLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  /* empty */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  emptyCta: { backgroundColor: Colors.accent, minHeight: 52, borderRadius: Radius.sm, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },
  emptyCtaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  /* urgent */
  urgentScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  urgentLabel: { fontSize: 13, fontWeight: '700', color: Colors.alert, marginBottom: 10 },
  urgentTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: Colors.text },
  urgentBody: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, marginTop: 8, marginBottom: 6 },
  urgentTime: { fontSize: 14, color: Colors.textMuted, marginBottom: 18 },
  claimBtn: { height: 56, borderRadius: Radius.sm, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  claimBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  resolveBtn: { height: 52, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  resolveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  textLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  textLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted, textDecorationLine: 'underline' },
});
