import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Modal,
  ActivityIndicator, ScrollView, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../components/ScreenHeader';
import { WeekDots } from '../components/WeekDots';
import { Emoji } from '../components/Emoji';
import { Particles } from '../components/Particles';
import { MonthGrid } from '../components/MonthGrid';
import { SupportParticipants } from '../components/SupportParticipants';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius } from '../constants/tokens';
import { useCircle } from '../hooks/useCircle';
import { useSignals } from '../hooks/useSignals';
import { useUrgentSignal } from '../hooks/useUrgentSignal';
import { useWeekRhythm } from '../hooks/useWeekRhythm';
import { useCheckinStats } from '../hooks/useCheckinStats';
import { haptics } from '../utils/haptics';
import { openPhoneCall } from '../utils/linking';
import { supabase } from '../services/supabase';
import type { DailyCheckin, SupportParticipant as SParticipant } from '../types';
import type { RecipientHomePreview } from '../dev/homePreview';
import { formatClock } from '../utils/date';
import { todayDateKey } from '../utils/today';
import { logInviteEvent } from '../utils/invite';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import * as SecureStore from 'expo-secure-store';
import { analytics } from '../services/analytics';
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

function connectionLabel(days: number | null): string | null {
  if (days == null || days < 1) return null;
  if (days === 1) return 'Razem od 1 dnia';
  if (days === 7) return 'Razem od tygodnia';
  if (days === 14) return 'Razem od 2 tygodni';
  if (days === 30) return 'Razem od miesiąca';
  return `Razem od ${days} dni`;
}

/* ─── status moods (shared with SignalerHome) ─── */

const STATUS_MOOD_LABELS: Record<string, string> = {
  good: 'Dobrze',
  calm: 'Spokojnie',
  tired: 'Zm\u{0119}czona',
  walk: 'Na spacerze',
  doctor: 'U lekarza',
};

/* ─── Status circle ─── */

const MORNING_THOUGHTS = [
  { key: 'hug', emoji: '\u{1F917}', label: 'Przytulam', bg: Colors.loveLight },
  { key: 'coffee', emoji: '\u{2615}', label: 'Dobry dzień!', bg: Colors.accentWash },
  { key: 'think', emoji: '\u{1F4AD}', label: 'Myślę o Tobie', bg: '#F0EAFF' },
] as const;

const STATUS_SIZE = 180;

function StatusCircle({ ok, showCelebration }: { ok: boolean; showCelebration: boolean }) {
  const circleScale = useRef(new Animated.Value(1)).current;
  const checkOpacity = useRef(new Animated.Value(ok ? 1 : 0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const hasAnimated = useRef(false);

  // Pending: gentle pulse on the border (hope, not emptiness)
  useEffect(() => {
    if (!ok) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [ok]);

  // Ok: bounce in
  useEffect(() => {
    if (ok && !hasAnimated.current) {
      hasAnimated.current = true;
      Animated.sequence([
        Animated.timing(circleScale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
        Animated.spring(circleScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
      ]).start();
      Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [ok]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Particles visible={showCelebration} count={10} colors={[Colors.safe, Colors.love, Colors.highlight, Colors.delight]} />
      <Animated.View style={[
        st.statusCircle,
        ok ? st.statusCircleOk : st.statusCirclePending,
        { transform: [{ scale: ok ? circleScale : pulseScale }] },
      ]}>
        {ok ? (
          <Animated.View style={{ opacity: checkOpacity }}>
            <Text style={st.statusCheckmark}>✓</Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/* ─── Response tap ─── */

const REACTIONS = [
  { emoji: '\u{2764}\u{FE0F}', label: 'Kocham', bg: Colors.loveLight },
  { emoji: '\u{1F31B}', label: 'Dobranoc', bg: '#F0EAFF' },
  { emoji: '\u{1F44D}', label: 'OK!', bg: Colors.safeLight },
  { emoji: '\u{1F31E}', label: 'Super!', bg: '#FFF8E1' },
] as const;

function ResponseTap({ signalerName, signalerId, preview, sendSignal, hasSentReactionToday }: {
  signalerName: string; signalerId: string; preview: boolean;
  sendSignal: (toUserId: string, emoji: string, message?: string, signalType?: string) => Promise<boolean>;
  hasSentReactionToday: (toUserId: string) => boolean;
}) {
  const alreadySent = !preview && hasSentReactionToday(signalerId);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [showReactionParticles, setShowReactionParticles] = useState(false);
  const sent = alreadySent || !!justSent;
  const scales = useRef(REACTIONS.map(() => new Animated.Value(1))).current;
  const particleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alreadySent) logInviteEvent('recipient_response_state_restored');
    else logInviteEvent('recipient_response_cta_seen');
  }, [alreadySent]);

  useEffect(() => () => { if (particleTimerRef.current) clearTimeout(particleTimerRef.current); }, []);

  const handleTap = async (emoji: string, index: number) => {
    if (sent) return;
    haptics.medium();
    logInviteEvent('recipient_response_started');
    Animated.sequence([
      Animated.spring(scales[index], { toValue: 1.5, useNativeDriver: true, speed: 50, bounciness: 14 }),
      Animated.spring(scales[index], { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
    ]).start();
    try {
      if (!preview) {
        const ok = await sendSignal(signalerId, emoji);
        if (!ok) { logInviteEvent('recipient_response_duplicate_blocked'); return; }
        analytics.reactionSent(emoji);
      }
      setJustSent(emoji);
      setShowReactionParticles(true);
      haptics.success();
      logInviteEvent('recipient_response_sent');
      particleTimerRef.current = setTimeout(() => setShowReactionParticles(false), 1200);
    } catch { /* silent */ }
  };

  // Post-reaction celebration
  const sentScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (justSent) {
      sentScale.setValue(0);
      Animated.spring(sentScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }).start();
    }
  }, [justSent]);

  return (
    <View style={st.responseSection}>
      <Particles visible={showReactionParticles} count={10} colors={[Colors.safe, Colors.love, Colors.highlight, Colors.delight]} />
      {sent ? (
        <>
          <Animated.View style={[st.responseSentPill, justSent ? { transform: [{ scale: sentScale }] } : undefined]}>
            <Text style={st.responseSentText}>{signalerName} zobaczy Twój gest</Text>
          </Animated.View>
          <Text style={st.tomorrowHook}>Do zobaczenia jutro</Text>
        </>
      ) : (
        <View>
          <Text style={st.responsePrompt}>Odpowiedz jednym gestem</Text>
          <View style={st.reactionsRow}>
            {REACTIONS.map((r, i) => (
              <Animated.View key={r.emoji} style={{ transform: [{ scale: scales[i] }] }}>
                <Pressable
                  onPress={() => handleTap(r.emoji, i)}
                  style={({ pressed }) => [st.reactionBtn, { backgroundColor: r.bg }, pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }]}
                >
                  <Emoji style={st.reactionEmoji}>{r.emoji}</Emoji>
                  <Text style={st.reactionLabel}>{r.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
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
  const { sendSignal, todaySignals, hasSentReactionToday, hasSentPokeToday } = useSignals();
  const { urgentCase, currentAlert, claim, resolve, loading: urgentLoading } = useUrgentSignal();

  const signaler = signalers[0] || null;
  const { contacts: trustedContacts } = useTrustedContacts(signaler?.relationshipId || null);
  const circleSmall = trustedContacts.length < 2;
  const [previewMode, setPreviewMode] = useState<RecipientHomePreview | null>(preview);
  const pv = __DEV__ && !!previewMode;
  const sigName = pv ? 'Mama' : signaler?.name || null;
  const sigId = pv ? 'ps' : signaler?.userId || null;
  const callPhone = pv ? '+48600100200' : signaler?.phone || '';

  const { days: realWeekDays, refresh: refreshWeek } = useWeekRhythm(sigId);
  const { streak: sigStreak } = useCheckinStats(sigId);

  const [isOk, setIsOk] = useState(false);
  const [signerStatus, setSignerStatus] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showWarmToast, setShowWarmToast] = useState(false);
  const [showCirclePrompt, setShowCirclePrompt] = useState(false);
  const [pokePicked, setPokePicked] = useState<string | null>(null);
  const pokeAlreadySent = !pv && sigId ? hasSentPokeToday(sigId) : false;
  const hasSeenSign = useRef(false);
  const toastFade = useRef(new Animated.Value(0)).current;
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current); }, []);
  const [todayTime, setTodayTime] = useState<string | null>(null);
  const [lastContact, setLastContact] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [connectionDays, setConnectionDays] = useState<number | null>(null);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudgeSending, setNudgeSending] = useState(false);

  const afterFade = useRef(new Animated.Value(0)).current;

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  // Guard: redirect to root if relationship was deleted (e.g. other user removed account)
  useEffect(() => {
    if (pv || circleLoading) return;
    if (signalers.length === 0) {
      router.replace('/');
    }
  }, [pv, circleLoading, signalers.length, router]);

  /* ─── data ─── */

  const fetchData = useCallback(async () => {
    if (!sigId) return;
    try {
      const today = new Date();
      const todayStr = todayDateKey(today);
      const ago = new Date(today); ago.setDate(today.getDate() - 6);

      // Run all 3 queries in parallel
      const [todayResult, recentResult, pairResult] = await Promise.all([
        supabase.from('daily_checkins').select('local_date, checked_at, status_emoji')
          .eq('senior_id', sigId).gte('local_date', todayStr).lte('local_date', todayStr).limit(1).maybeSingle(),
        supabase.from('daily_checkins').select('local_date, checked_at')
          .eq('senior_id', sigId).gte('local_date', todayDateKey(ago)).lte('local_date', todayStr)
          .order('local_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('care_pairs').select('joined_at')
          .eq('senior_id', sigId).eq('status', 'active').limit(1).maybeSingle(),
      ]);

      const todayRow = todayResult.data as (DailyCheckin & { status_emoji?: string | null }) | null;
      const latestRow = recentResult.data as DailyCheckin | null;
      const pair = pairResult.data;

      if (pair?.joined_at) {
        const diff = Math.floor((Date.now() - new Date(pair.joined_at).getTime()) / 86400000);
        setConnectionDays(Math.max(diff, 1));
      }

      setTodayTime(todayRow ? fmtTime(todayRow.checked_at) : null);
      setSignerStatus(todayRow?.status_emoji || null);
      setLastContact(fmtRelative(latestRow?.local_date ?? null, latestRow?.checked_at ?? null));
      setIsOk(urgentCase?.viewerRole === 'primary' && currentAlert ? false : !!todayRow);
    } catch (e) { console.warn('fetchData:', e); } finally { setDataLoading(false); }
  }, [sigId, urgentCase?.viewerRole, currentAlert]);

  useEffect(() => {
    if (pv) { setDataLoading(false); return; }
    if (sigId) fetchData(); else if (!circleLoading) setDataLoading(false);
  }, [pv, sigId, circleLoading, fetchData]);

  useEffect(() => {
    if (pv || !sigId) return;
    const filter = `senior_id=eq.${sigId}`;
    const ch = supabase.channel('r-checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_checkins', filter }, () => { fetchData(); refreshWeek(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'daily_checkins', filter }, () => { fetchData(); refreshWeek(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pv, sigId, fetchData, refreshWeek]);

  /* ─── transition ─── */

  const effOk = previewMode === 'before' ? false : previewMode === 'after' || previewMode === 'response' ? true : isOk;

  useEffect(() => {
    if (effOk) {
      // Celebrate on first view of today's sign
      if (!hasSeenSign.current) {
        hasSeenSign.current = true;
        setShowCelebration(true);
        setShowWarmToast(true);
        haptics.success();
        celebrationTimerRef.current = setTimeout(() => setShowCelebration(false), 1200);
        // Warm toast: fade in, hold 2.5s, fade out
        toastFade.setValue(0);
        Animated.sequence([
          Animated.timing(toastFade, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(2500),
          Animated.timing(toastFade, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start(() => setShowWarmToast(false));
      }
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

  // One-time circle prompt after first sign
  const CIRCLE_PROMPT_KEY = 'cmok_circle_prompt_shown';
  useEffect(() => {
    if (!isFirstEver || !effOk || !circleSmall || pv) return;
    (async () => {
      const shown = Platform.OS === 'web'
        ? localStorage.getItem(CIRCLE_PROMPT_KEY)
        : await SecureStore.getItemAsync(CIRCLE_PROMPT_KEY);
      if (!shown) {
        // Delay so the first-sign celebration lands first
        setTimeout(() => setShowCirclePrompt(true), 2500);
      }
    })();
  }, [isFirstEver, effOk, circleSmall, pv]);

  const dismissCirclePrompt = useCallback(async () => {
    setShowCirclePrompt(false);
    if (Platform.OS === 'web') localStorage.setItem(CIRCLE_PROMPT_KEY, '1');
    else await SecureStore.setItemAsync(CIRCLE_PROMPT_KEY, '1');
  }, []);

  // Poke handler — standalone gesture
  const handlePokePick = useCallback(async (emoji: string) => {
    if (pokePicked || pokeAlreadySent || !sigId) return;
    haptics.light();
    setPokePicked(emoji);
    haptics.success();
    if (pv) return;
    try {
      const ok = await sendSignal(sigId, emoji, undefined, 'poke');
      if (ok) analytics.pokeSent(emoji);
    } catch { /* silent */ }
  }, [pokePicked, pokeAlreadySent, sigId, pv, sendSignal]);

  // Incoming poke from signaler
  const signalerPoke = !pv ? todaySignals.find(s => s.type === 'poke' && s.from_user_id === sigId) : null;

  /* ─── handlers ─── */
  const handleClaim = async () => {
    if (!currentAlert) { Alert.alert('Ładowanie...', 'Poczekaj chwilę i spróbuj ponownie.'); return; }
    try { await claim(currentAlert.id); analytics.urgentClaimed(); } catch { Alert.alert('Nie udało się', 'Spróbuj ponownie.'); }
  };
  const handleResolve = async () => { if (!currentAlert) return; try { await resolve(currentAlert.id); analytics.urgentResolved(); } catch { Alert.alert('Nie udało się', 'Spróbuj ponownie.'); } };
  const handleNudge = async () => {
    if (nudgeSent || nudgeSending) return;
    setNudgeSending(true);
    try {
      const { error: nudgeErr } = await supabase.functions.invoke('nudge-signal', { body: {} });
      if (nudgeErr) throw nudgeErr;
      analytics.nudgeSent();
      setNudgeSent(true);
    } catch { Alert.alert('Nie udało się', 'Spróbuj ponownie za chwilę.'); }
    finally { setNudgeSending(false); }
  };

  const [morningSent, setMorningSent] = useState(false);
  const handleMorningThought = async (emoji: string, toUserId: string) => {
    if (morningSent) return;
    haptics.light();
    try {
      await sendSignal(toUserId, emoji, undefined, 'morning_thought');
      analytics.morningThoughtSent(emoji);
      setMorningSent(true);
    } catch { /* silent */ }
  };

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
          {effAlert.latitude != null && effAlert.longitude != null ? (
            <Pressable
              onPress={() => Linking.openURL(`https://maps.apple.com/?ll=${effAlert.latitude},${effAlert.longitude}&q=${encodeURIComponent(relationDisplay(effUrgent.signalerName))}`)}
              style={({ pressed }) => [st.mapLink, pressed && { opacity: 0.7 }]}
            >
              <Text style={st.mapLinkText}>Pokaż lokalizację na mapie</Text>
            </Pressable>
          ) : (
            <Text style={st.noLocationHint}>Bez lokalizacji</Text>
          )}
          {!claimed ? (
            <Pressable onPress={handleClaim} disabled={urgentLoading} style={({ pressed }) => [st.claimBtn, pressed && { opacity: 0.9 }]}>
              <Text style={st.claimBtnText}>Zajmuję się tym</Text>
            </Pressable>
          ) : null}
          {claimed ? (
            <Pressable onPress={handleResolve} disabled={urgentLoading} style={({ pressed }) => [st.resolveBtn, pressed && { opacity: 0.8 }]}>
              <Text style={st.resolveBtnText}>Wszystko OK, zamknij</Text>
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

  const streakLabel = effOk && sigStreak >= 2 ? `${sigStreak} dni z rzędu` : null;
  const title = effOk
    ? isFirstEver
      ? `Pierwszy znak!`
      : `Jest znak`
    : hasReceiverGap
      ? 'Dziś ciszej niż zwykle'
      : effLast
        ? 'Czekamy na dzisiejszy znak'
        : 'Czekamy na pierwszy znak';
  const statusLabel = signerStatus ? STATUS_MOOD_LABELS[signerStatus] || null : null;
  const sub = effOk
    ? statusLabel
      ? `${statusLabel}${effTime ? ` · ${effTime}` : ''}`
      : `Na dziś jest kontakt${effTime ? ` · ${effTime}` : ''}`
    : hasReceiverGap
      ? 'Warto się odezwać'
      : effLast
        ? `Ostatnio: ${effLast}`
        : 'Spokojnie, dopiero zaczynacie';

  return (
    <SafeAreaView style={[st.container, effOk && st.containerAfter]}>
      {/* ─── Circle prompt (one-time after first sign) ─── */}
      <Modal visible={showCirclePrompt} transparent animationType="fade" onRequestClose={dismissCirclePrompt}>
        <View style={st.promptOverlay}>
          <View style={st.promptCard}>
            <Text style={st.promptTitle}>Kto jeszcze powinien wiedzieć?</Text>
            <Text style={st.promptBody}>
              {name} daje Ci znak. Dodaj sąsiada, brata, kogoś zaufanego, dostaną wiadomość, jeśli {name.toLowerCase()} poprosi o pomoc.
            </Text>
            <Pressable
              onPress={() => { dismissCirclePrompt(); router.push('/trusted-contacts'); }}
              style={({ pressed }) => [st.promptCta, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={st.promptCtaText}>Dodaj osobę</Text>
            </Pressable>
            <Pressable onPress={dismissCirclePrompt} style={({ pressed }) => [st.promptDismiss, pressed && { opacity: 0.5 }]}>
              <Text style={st.promptDismissText}>Później</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ScreenHeader subtitle={`od ${nameFrom}`} />
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        {/* ─── Warm toast on first view ─── */}
        {showWarmToast ? (
          <Animated.View style={[st.warmToast, { opacity: toastFade }]}>
            <Text style={st.warmToastText}>{name} pamięta o Tobie</Text>
          </Animated.View>
        ) : null}

        {/* ─── SECTION 1: Status hero ─── */}
        <View style={st.heroSection}>
          <StatusCircle ok={effOk} showCelebration={showCelebration} />
          {effOk ? (
            <Animated.View style={{ opacity: afterFade, alignItems: 'center' }}>
              <Text style={st.title} maxFontSizeMultiplier={1.3}>{title}</Text>
              {sub ? <Text style={st.sub}>{sub}</Text> : null}
              {/* streak shown in WeekDots below — no duplicate here */}
            </Animated.View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={st.titlePending} maxFontSizeMultiplier={1.3}>{title}</Text>
              {sub ? <Text style={st.sub}>{sub}</Text> : null}
              {/* Morning thought — give recipient something to DO */}
              {sigId && !pv ? (
                morningSent || hasSentReactionToday(sigId) ? (
                  <Text style={st.morningSent}>Wysłano poranną myśl</Text>
                ) : (
                  <View style={st.morningSection}>
                    <Text style={st.morningPrompt}>Wyślij poranną myśl</Text>
                    <View style={st.morningRow}>
                      {MORNING_THOUGHTS.map((t) => (
                        <Pressable
                          key={t.key}
                          onPress={() => handleMorningThought(t.emoji, sigId)}
                          style={({ pressed }) => [st.morningChip, { backgroundColor: t.bg }, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
                        >
                          <Emoji style={st.morningSymbol}>{t.emoji}</Emoji>
                          <Text style={st.morningLabel}>{t.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )
              ) : null}
            </View>
          )}
        </View>

        {/* ─── SECTION 2: Actions (above fold) ─── */}
        <View style={st.actionsSection}>
          {/* Incoming poke from signaler */}
          {signalerPoke ? (
            <View style={st.pokeSentPill}>
              <Emoji style={st.pokeEmoji}>{signalerPoke.emoji || '\u{1F49A}'}</Emoji>
              <Text style={st.pokeSentText}>{name} myśli o Tobie</Text>
            </View>
          ) : null}
          {effOk && sigId ? (
            <Animated.View style={{ opacity: afterFade, alignItems: 'center' }}>
              <ResponseTap signalerName={name} signalerId={sigId} preview={pv} sendSignal={sendSignal} hasSentReactionToday={hasSentReactionToday} />
            </Animated.View>
          ) : null}
          {/* Poke — standalone gesture, only before check-in (ResponseTap serves this role after) */}
          {sigId && !effOk ? (
            <View style={st.pokeSection}>
              {pokePicked || pokeAlreadySent ? (
                <View style={st.pokeSentPill}>
                  <Emoji style={st.pokeEmoji}>{pokePicked || '\u{1F49A}'}</Emoji>
                  <Text style={st.pokeSentText}>{name} zobaczy Twój gest</Text>
                </View>
              ) : (
                <>
                  <Text style={st.pokePrompt}>Wyślij gest</Text>
                  <View style={st.pokeRow}>
                    {REACTIONS.map((r) => (
                      <Pressable
                        key={r.emoji}
                        onPress={() => handlePokePick(r.emoji)}
                        style={({ pressed }) => [st.pokeChip, { backgroundColor: r.bg }, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
                      >
                        <Emoji style={st.pokeChipEmoji}>{r.emoji}</Emoji>
                        <Text style={st.pokeChipLabel}>{r.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          ) : null}
          {/* Circle nudge: show when circle has < 2 trusted contacts */}
          {effOk && circleSmall ? (
            <Pressable onPress={() => router.push('/trusted-contacts')} style={({ pressed }) => [st.circleNudge, pressed && { opacity: 0.6 }]}>
              <Text style={st.circleNudgeText}>Dodaj kogoś do kręgu bliskich</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ─── SECTION 3: Rhythm (below actions) ─── */}
        <View style={st.rhythmSection}>
          {effWeek.length > 0 ? <WeekDots days={effWeek} /> : null}
          {connectionLabel(connectionDays) ? <Text style={st.connectionLabel}>{connectionLabel(connectionDays)}</Text> : null}
          {/* Nudge button — only when no sign today */}
          {!effOk && sigId && !pv ? (
            <Pressable
              onPress={handleNudge}
              disabled={nudgeSent || nudgeSending}
              style={({ pressed }) => [st.nudgeBtn, pressed && !nudgeSent && { opacity: 0.7 }]}
            >
              <Text style={[st.nudgeBtnText, nudgeSent && st.nudgeBtnTextSent]}>
                {nudgeSent ? <Text>Wysłano <Text style={{ fontFamily: undefined }}>✓</Text></Text> : nudgeSending ? <Text>...</Text> : <Text>Przypomnij delikatnie</Text>}
              </Text>
            </Pressable>
          ) : null}
          {sigId ? <MonthGrid signalerId={sigId} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  containerAfter: { backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* sections */
  heroSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 16 },
  rhythmSection: { alignItems: 'center', paddingVertical: 24 },
  actionsSection: { alignItems: 'center', paddingBottom: 16 },

  /* warm toast */
  warmToast: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: Colors.safeLight, marginBottom: 12 },
  warmToastText: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.safeStrong },

  /* status circle */
  statusCircle: { width: STATUS_SIZE, height: STATUS_SIZE, borderRadius: STATUS_SIZE / 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statusCircleOk: {
    backgroundColor: Colors.safeLight, borderWidth: 3, borderColor: Colors.safe,
    shadowColor: Colors.safe, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4,
  },
  statusCirclePending: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.safe, opacity: 0.5 },
  statusCheckmark: { fontSize: 48, color: Colors.safe, fontWeight: '300' },

  /* status text */
  title: { fontSize: 20, fontFamily: Typography.headingFamily, color: Colors.text, textAlign: 'center' },
  titlePending: { fontSize: 18, fontFamily: Typography.headingFamilySemiBold, color: Colors.textSecondary, textAlign: 'center' },
  sub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  streakBadge: { fontSize: 13, fontFamily: Typography.headingFamilySemiBold, color: Colors.safe, marginTop: 8 },

  /* morning thoughts — recipient proactive engagement */
  morningSection: { marginTop: 24, alignItems: 'center' },
  morningPrompt: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  morningRow: { flexDirection: 'row', gap: 12 },
  morningChip: {
    width: 84, paddingVertical: 12, borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  morningSymbol: { fontSize: 20, marginBottom: 4 },
  morningLabel: { fontSize: 10, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  morningSent: { fontSize: 14, color: Colors.safe, fontFamily: Typography.headingFamilySemiBold, marginTop: 20 },

  /* nudge */
  nudgeBtn: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: Colors.surface, borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  nudgeBtnText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  nudgeBtnTextSent: { color: Colors.safe },

  /* rhythm */
  connectionLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },

  /* response — reaction buttons */
  responseSection: { alignItems: 'center', marginBottom: 16 },
  responsePrompt: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 12 },
  reactionsRow: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  reactionBtn: {
    width: 74, height: 74, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  reactionEmoji: { fontSize: 30 },
  reactionLabel: { fontSize: 10, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginTop: 3 },
  responseSentPill: {
    backgroundColor: Colors.safeLight, minHeight: 44, paddingHorizontal: 24,
    borderRadius: 999, justifyContent: 'center', alignItems: 'center',
  },
  responseSentText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },
  tomorrowHook: { fontSize: 13, color: Colors.textMuted, marginTop: 12, textAlign: 'center' },

  /* viral — subtle link */
  /* poke — standalone gesture */
  pokeSection: { alignItems: 'center', paddingVertical: 20 },
  pokePrompt: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  pokeRow: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  pokeChip: { width: 64, paddingVertical: 12, borderRadius: 16, alignItems: 'center' as const, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  pokeChipEmoji: { fontSize: 28, marginBottom: 4 },
  pokeChipLabel: { fontSize: 9, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  pokeSentPill: { flexDirection: 'row', alignItems: 'center' as const, backgroundColor: Colors.safeLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, gap: 8, marginBottom: 8 },
  pokeEmoji: { fontSize: 18 },
  pokeSentText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },

  circleNudge: { marginTop: 16, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  circleNudgeText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.safe },
  viralLink: { marginTop: 20, marginBottom: 4, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  viralLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },

  /* bottom — text-only link */
  bottomLink: { alignItems: 'center', paddingVertical: 14, marginBottom: 32 },
  bottomLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },

  /* empty */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontFamily: Typography.headingFamily, color: Colors.text, textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  emptyCta: { backgroundColor: Colors.accent, minHeight: 52, borderRadius: Radius.sm, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },
  emptyCtaText: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },

  /* urgent */
  urgentScroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  urgentLabel: { fontSize: 13, fontFamily: Typography.fontFamilyBold, color: Colors.alert, marginBottom: 10 },
  urgentTitle: { fontSize: 26, lineHeight: 32, fontFamily: Typography.headingFamily, color: Colors.text },
  urgentBody: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, marginTop: 8, marginBottom: 6 },
  urgentTime: { fontSize: 14, color: Colors.textMuted, marginBottom: 10 },
  mapLink: { backgroundColor: Colors.safe, minHeight: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  mapLinkText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: '#FFFFFF' },
  noLocationHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 18 },
  claimBtn: { height: 56, borderRadius: Radius.sm, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  claimBtnText: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  resolveBtn: { height: 52, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  resolveBtnText: { fontSize: 15, fontFamily: Typography.fontFamilyBold, color: Colors.textSecondary },
  textLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  textLinkText: { fontSize: 14, color: Colors.textMuted },

  /* circle prompt modal */
  promptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  promptCard: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 40 },
  promptTitle: { fontSize: 22, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 10 },
  promptBody: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 24 },
  promptCta: { height: 56, borderRadius: 18, backgroundColor: Colors.safe, alignItems: 'center' as const, justifyContent: 'center' as const, shadowColor: '#2EC4B6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6 },
  promptCtaText: { fontSize: 17, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  promptDismiss: { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 8 },
  promptDismissText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
});
