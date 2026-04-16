import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Alert, Animated, ScrollView, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { ScreenHeader } from '../components/ScreenHeader';
import { WeekDots } from '../components/WeekDots';
import { Particles } from '../components/Particles';
import { UrgentConfirmation } from '../components/UrgentConfirmation';
import { MilestoneCelebration } from '../components/MilestoneCelebration';
import { SupportParticipants } from '../components/SupportParticipants';
import { Emoji } from '../components/Emoji';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { haptics } from '../utils/haptics';
import { useCheckin } from '../hooks/useCheckin';
import { useCircle } from '../hooks/useCircle';
import { useSignals } from '../hooks/useSignals';
import { useUrgentSignal } from '../hooks/useUrgentSignal';
import { useWeekRhythm } from '../hooks/useWeekRhythm';
import { useCheckinStats } from '../hooks/useCheckinStats';
import { supabase } from '../services/supabase';
import { savePendingCheckin, syncPendingCheckin } from '../services/offlineSync';
import { logInviteEvent } from '../utils/invite';
import { todayDateKey } from '../utils/today';
import { analytics } from '../services/analytics';
import type { Signal, SupportParticipant } from '../types';
import type { SignalerHomePreview } from '../dev/homePreview';
import { getRelationForms, relationDisplay } from '../utils/relationCopy';

/* ─── status moods ─── */

const STATUS_MOODS = [
  { key: 'good', emoji: '\u{1F60A}', label: 'Dobrze' },
  { key: 'calm', emoji: '\u{1F60C}', label: 'Spokojnie' },
  { key: 'tired', emoji: '\u{1F634}', label: 'Zm\u{0119}czona' },
  { key: 'doctor', emoji: '\u{1FA7A}', label: 'U lekarza' },
] as const;

/* ─── helpers ─── */

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/* ─── preview data ─── */

const DEV_PARTICIPANTS: SupportParticipant[] = [
  { userId: 'r', name: 'Mama', phone: '+48600100200', kind: 'primary', deliveryStatus: 'sent', isClaimedBy: false },
  { userId: 't', name: 'Ela', phone: '+48600100300', kind: 'trusted', deliveryStatus: 'sent', isClaimedBy: true },
];

/* ─── main ─── */

export function SignalerHomeScreen({ preview = null }: { preview?: SignalerHomePreview | null }) {
  const router = useRouter();
  const {
    authReady, isAuthenticated, userId, checkedInToday,
    loading: checkinLoading, lastCheckin, statusEmoji: dbStatusEmoji,
    performCheckin, refreshCheckin,
  } = useCheckin();
  const { recipients, loading: circleLoading } = useCircle();
  const { todaySignals, sendSignal, hasSentPokeToday, refresh: refreshSignals } = useSignals();
  const {
    isActive: urgentActive, currentAlert, urgentCase,
    loading: urgentLoading, preflight: urgentPreflight, sendUrgentSignal, retrySend,
    resolve: resolveUrgent, cancel: cancelUrgent,
  } = useUrgentSignal();
  const { days: realWeekDays, refresh: refreshWeek } = useWeekRhythm(userId);
  const { streak: dbStreak, totalCount: dbTotalCount, refresh: refreshStats } = useCheckinStats(userId);

  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [localUrgentOffline, setLocalUrgentOffline] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSaved, setPendingSaved] = useState(false);
  const [pendingCheckinTime, setPendingCheckinTime] = useState<string | null>(null);
  const [justChecked, setJustChecked] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const [statusPicked, setStatusPicked] = useState<string | null>(null);
  const statusLoadedFromDb = useRef(false);
  const [previewMode, setPreviewMode] = useState<SignalerHomePreview | null>(preview);
  const [showWarmToast, setShowWarmToast] = useState(false);

  const isSubmitting = useRef(false);
  const breatheScale = useRef(new Animated.Value(1)).current;
  const breatheShadow = useRef(new Animated.Value(0.4)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const releaseRingScale = useRef(new Animated.Value(0.84)).current;
  const releaseRingOpacity = useRef(new Animated.Value(0)).current;
  const afterFade = useRef(new Animated.Value(0)).current;
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const responseReceiptScale = useRef(new Animated.Value(0)).current;
  const moodScales = useRef(STATUS_MOODS.map(() => new Animated.Value(1))).current;

  // Press & release refs
  const pressStartRef = useRef(0);
  const chargeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chargeTriggeredUrgent = useRef(false);
  const breatheLoopRef = useRef<{ scale: Animated.CompositeAnimation; shadow: Animated.CompositeAnimation } | null>(null);
  const [particleCount, setParticleCount] = useState(14);

  const circleNames = useMemo(
    () => new Map(recipients.map((m) => [m.userId, m.name])), [recipients],
  );

  const pv = __DEV__ && !!previewMode;
  const pvChecked = previewMode === 'after';
  const pvSupport = previewMode === 'support';
  const primaryName = pv ? 'Mama' : recipients[0]?.name || null;
  const primaryRecipientId = pv ? 'r' : recipients[0]?.userId || null;
  const pokeAlreadySent = !pv && primaryRecipientId ? hasSentPokeToday(primaryRecipientId) : false;
  const effectiveCircleNames = useMemo(() => {
    if (!pv) return circleNames;
    return new Map<string, string>([['r', primaryName || 'Mama'], ...circleNames.entries()]);
  }, [pv, circleNames, primaryName]);

  /* ─── effects ─── */

  // Guard: redirect to root if relationship was deleted (e.g. other user removed account)
  useEffect(() => {
    if (pv || circleLoading) return;
    if (authReady && isAuthenticated && recipients.length === 0) {
      router.replace('/');
    }
  }, [pv, circleLoading, authReady, isAuthenticated, recipients.length, router]);

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const off = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(off);
      if (!off && pendingSaved) {
        syncPendingCheckin().then((ok) => {
          if (ok) { setPendingSaved(false); setPendingCheckinTime(null); refreshCheckin(); refreshWeek(); refreshStats(); }
        });
      }
    });
    return () => unsub();
  }, [pendingSaved, refreshCheckin, refreshWeek]);

  // Sync offline pending ONCE on mount (not on every callback identity change)
  const hasSyncedPending = useRef(false);
  useEffect(() => {
    if (hasSyncedPending.current) return;
    hasSyncedPending.current = true;
    syncPendingCheckin().then((ok) => { if (ok) { refreshCheckin(); refreshWeek(); refreshStats(); } });
  }, [refreshCheckin, refreshWeek, refreshStats]);
  useEffect(() => () => {
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    if (breatheLoopRef.current) { breatheLoopRef.current.scale.stop(); breatheLoopRef.current.shadow.stop(); }
  }, []);

  /* ─── derived: 4 clear states ─── */

  // DB-confirmed truth: the ONLY source for "done today"
  const confirmedDone = pv ? pvChecked : checkedInToday;
  // Transitional states: user acted but DB hasn't confirmed yet
  const isSending = !pv && justChecked && !checkedInToday && !pendingSaved;
  const isPendingOffline = !pv && pendingSaved && !checkedInToday;
  // For UI rendering: confirmed OR transitional
  const showChecked = confirmedDone || isSending || isPendingOffline;

  // Fallback poll for reactions (realtime is primary, this catches dropped events)
  useEffect(() => {
    if (!showChecked) return;
    const interval = setInterval(() => refreshSignals(), 60000);
    return () => clearInterval(interval);
  }, [showChecked, refreshSignals]);

  const displayTime = pv
    ? pvChecked ? '08:14' : null
    : isPendingOffline ? pendingCheckinTime : formatTime(lastCheckin?.checked_at ?? null);
  const authBlocked = !pv && authReady && !isAuthenticated;
  const canCheckin = pv ? !showChecked : authReady && isAuthenticated && !showChecked && !checkinLoading;
  const canUrgent = pv ? true : authReady && isAuthenticated;

  // Breathing pulse for the pending state button
  useEffect(() => {
    if (showChecked || !canCheckin) {
      breatheScale.setValue(1);
      breatheLoopRef.current = null;
      return;
    }
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, { toValue: 1.03, duration: 1250, useNativeDriver: true }),
        Animated.timing(breatheScale, { toValue: 1, duration: 1250, useNativeDriver: true }),
      ]),
    );
    const shadowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheShadow, { toValue: 0.2, duration: 1250, useNativeDriver: false }),
        Animated.timing(breatheShadow, { toValue: 0.4, duration: 1250, useNativeDriver: false }),
      ]),
    );
    breatheLoopRef.current = { scale: scaleLoop, shadow: shadowLoop };
    scaleLoop.start();
    shadowLoop.start();
    return () => { scaleLoop.stop(); shadowLoop.stop(); breatheLoopRef.current = null; };
  }, [showChecked, canCheckin, breatheScale, breatheShadow]);

  /* ─── transition: animate afterFade when showChecked changes ─── */

  useEffect(() => { logInviteEvent('sender_home_viewed'); }, []);

  // Copy slide-up offset for done state
  const copySlide = useRef(new Animated.Value(8)).current;
  const copyDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showChecked) {
      afterFade.setValue(0);
      copySlide.setValue(8);
      copyDelayRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(afterFade, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(copySlide, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 400);
      if (isFirstEver) logInviteEvent('first_sign_success_seen');
    } else {
      afterFade.setValue(0);
      copySlide.setValue(8);
    }
    return () => { if (copyDelayRef.current) clearTimeout(copyDelayRef.current); };
  }, [showChecked, afterFade, copySlide]);

  /* ─── animations ─── */

  // Streak including today's check-in (computed early for animation use)
  // Only add +1 during transitional state (justChecked but DB hasn't confirmed yet)
  const currentStreak = (justChecked && !checkedInToday && !pv) ? Math.max(dbStreak + 1, 1) : dbStreak;
  const isMilestone = currentStreak === 7 || currentStreak === 14 || currentStreak === 21 || currentStreak === 30;

  /* ─── success animations ─── */

  const playSuccessCommon = useCallback(() => {
    breatheShadow.setValue(0);
    // Warm toast
    setShowWarmToast(true);
    toastFade.setValue(0);
    Animated.sequence([
      Animated.timing(toastFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastFade, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setShowWarmToast(false));
    // Milestone
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    if (isMilestone) {
      analytics.milestoneReached(currentStreak);
      celebrationTimeoutRef.current = setTimeout(() => {
        setCelebrationVisible(false);
        setMilestoneVisible(true);
        celebrationTimeoutRef.current = null;
      }, 1200);
    }
  }, [breatheShadow, isMilestone, toastFade, currentStreak]);

  /** Quick tap success (< 150ms hold) — same feel as before */
  const playSuccess = useCallback(() => {
    if (isMilestone) { setCelebrationVisible(true); haptics.success(); } else { haptics.medium(); }
    setParticleCount(14);

    releaseRingScale.setValue(0.84);
    releaseRingOpacity.setValue(0.28);
    Animated.timing(buttonScale, { toValue: 0.88, duration: 120, useNativeDriver: true }).start(() => {
      Animated.parallel([
        Animated.spring(buttonScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(releaseRingScale, { toValue: 1.22, duration: 700, useNativeDriver: true }),
        Animated.timing(releaseRingOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    });
    playSuccessCommon();
  }, [buttonScale, releaseRingOpacity, releaseRingScale, isMilestone, playSuccessCommon]);

  const restartBreatheLoop = useCallback(() => {
    if (showChecked || !canCheckin) return;
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, { toValue: 1.03, duration: 1250, useNativeDriver: true }),
        Animated.timing(breatheScale, { toValue: 1, duration: 1250, useNativeDriver: true }),
      ]),
    );
    const shadowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheShadow, { toValue: 0.2, duration: 1250, useNativeDriver: false }),
        Animated.timing(breatheShadow, { toValue: 0.4, duration: 1250, useNativeDriver: false }),
      ]),
    );
    breatheLoopRef.current = { scale: scaleLoop, shadow: shadowLoop };
    scaleLoop.start();
    shadowLoop.start();
  }, [showChecked, canCheckin, breatheScale, breatheShadow]);

  /* ─── core check-in logic (shared by quick tap + charged) ─── */

  const performCheckinLogic = useCallback(async (successFn: () => void) => {
    if (isSubmitting.current) return;
    if (pv) {
      if (previewMode === 'before') { setPreviewMode('after'); setJustChecked(true); successFn(); }
      return;
    }
    if (!authReady) return;
    if (!isAuthenticated) { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
    if (showChecked || checkinLoading) return;
    isSubmitting.current = true;
    // Safety timer starts only after entering real submit path
    const safetyTimer = setTimeout(() => { isSubmitting.current = false; }, 15000);
    const now = new Date();
    const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (isOffline) {
      try {
        if (!userId) throw new Error('AUTH');
        await savePendingCheckin(userId); setPendingSaved(true); setPendingCheckinTime(t); setJustChecked(true); successFn();
      } catch { Alert.alert('Nie udało się', 'Spróbuj za chwilę.'); }
      finally { clearTimeout(safetyTimer); isSubmitting.current = false; }
      return;
    }
    try {
      if (isFirstEver) logInviteEvent('first_sign_started');
      await performCheckin();
      analytics.checkinSent(currentStreak + 1);
      if (isFirstEver) logInviteEvent('first_sign_sent');
      const prevOk = realWeekDays.filter((d) => d === 'ok').length;
      if (prevOk === 1) logInviteEvent('second_day_sign_sent');
      if (prevOk === 2) logInviteEvent('third_day_sign_sent');
      if (hasGap) logInviteEvent('sign_sent_after_gap');
      setJustChecked(true); successFn();
      refreshWeek(); refreshStats();
    } catch (e) {
      if (e instanceof Error && e.name === 'AUTH_REQUIRED') { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
      Alert.alert('Nie udało się', 'Spróbuj za chwilę.');
    } finally {
      clearTimeout(safetyTimer);
      isSubmitting.current = false;
    }
  }, [pv, previewMode, authReady, isAuthenticated, showChecked, checkinLoading, isOffline, userId, performCheckin, refreshWeek, refreshStats, currentStreak, realWeekDays]);

  /* ─── press handlers: charge & release ─── */

  const handleCheckinPress = useCallback(() => {
    if (!canCheckin) return;
    haptics.light();
    performCheckinLogic(playSuccess);
  }, [canCheckin, performCheckinLogic, playSuccess]);

  const moodPickedScale = useRef(new Animated.Value(0)).current;
  const moodPickedOpacity = useRef(new Animated.Value(0)).current;
  const moodFadeOut = useRef(new Animated.Value(1)).current;

  const handleStatusPick = useCallback(async (statusKey: string, index: number) => {
    haptics.light();

    // 1. Bounce the tapped chip big (1.4x)
    Animated.spring(moodScales[index], { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 14 }).start(() => {
      // 2. After peak: haptic confirmation + fade out all chips
      haptics.success();
      setStatusPicked(statusKey);

      // 3. Fade out chips row, scale in the result pill
      moodFadeOut.setValue(1);
      moodPickedScale.setValue(0.6);
      moodPickedOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(moodFadeOut, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.spring(moodPickedScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(moodPickedOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });

    if (pv || !userId) return;
    try {
      const today = todayDateKey();
      const { error } = await supabase.from('daily_checkins').update({ status_emoji: statusKey }).eq('senior_id', userId).eq('local_date', today);
      if (error) console.warn('[status] update failed:', error.message);
      // Also send as poke so recipient gets push (if not already sent today)
      if (primaryRecipientId && !pokeAlreadySent) {
        const mood = STATUS_MOODS.find(m => m.key === statusKey);
        sendSignal(primaryRecipientId, mood?.emoji || statusKey, undefined, 'poke').catch(() => {});
      }
    } catch (err) { console.warn('[status] update error:', err); }
  }, [pv, userId, primaryRecipientId, pokeAlreadySent, sendSignal, moodScales, moodFadeOut, moodPickedScale, moodPickedOpacity]);

  const handleMilestoneShare = useCallback(async () => {
    const streakText = currentStreak === 7 ? 'tydzień' : currentStreak === 14 ? '2 tygodnie' : currentStreak === 21 ? '3 tygodnie' : currentStreak === 30 ? 'miesiąc' : `${currentStreak} dni`;
    const displayName = primaryName || null;
    const msg = displayName
      ? `Od ${streakText} codziennie daję ${displayName} znak, że jest OK. Bez dzwonienia, bez SMS-ów. Jeden tap i obie strony mają spokój.\n\ncmok, darmowa apka:\nhttps://cmok.app/pobierz`
      : `Od ${streakText} codziennie daję bliskiej osobie znak, że jest OK. Jeden tap i spokój.\n\nhttps://cmok.app/pobierz`;
    try {
      await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
    } catch { /* cancelled */ }
  }, [currentStreak, primaryName]);

  // Restore status from DB when screen loads (so picked pill persists across visits)
  useEffect(() => {
    if (pv || statusLoadedFromDb.current) return;
    if (dbStatusEmoji && !statusPicked) {
      setStatusPicked(dbStatusEmoji);
      moodPickedOpacity.setValue(1);
      moodPickedScale.setValue(1);
      moodFadeOut.setValue(0);
      statusLoadedFromDb.current = true;
    }
  }, [pv, dbStatusEmoji, statusPicked, moodPickedOpacity, moodPickedScale, moodFadeOut]);

  const handleUrgentConfirm = async () => {
    setShowUrgentModal(false);
    if (pv) { setPreviewMode('support'); return; }
    if (!authReady || !isAuthenticated) {
      Alert.alert('Zaloguj się', 'Żeby dać znać bliskim, połącz telefon z kontem.');
      return;
    }
    if (isOffline) { setLocalUrgentOffline(true); return; }

    // Preflight: check if urgent can actually be sent
    const check = await urgentPreflight();
    if (!check.ok) {
      const messages: Record<string, string> = {
        no_auth: 'Połącz telefon z kontem.',
        no_relationship: 'Najpierw połącz się z bliską osobą.',
        no_active_relationship: 'Nie masz jeszcze aktywnego połączenia z bliską osobą. Zaproś kogoś do kręgu.',
        wrong_role: 'Ta funkcja jest dostępna na telefonie osoby w centrum kręgu.',
      };
      Alert.alert('Nie można wysłać', messages[check.reason] || 'Spróbuj ponownie.');
      return;
    }

    try {
      await sendUrgentSignal();
      analytics.urgentTriggered(false);
      setLocalUrgentOffline(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'NO_RELATIONSHIP') {
        Alert.alert('Brak połączenia', 'Nie masz aktywnego połączenia. Zaproś bliską osobę do kręgu.');
      } else if (msg === 'NO_AUTH') {
        Alert.alert('Zaloguj się', 'Połącz telefon z kontem.');
      } else {
        Alert.alert('Nie udało się', 'Coś poszło nie tak. Spróbuj ponownie za chwilę.');
      }
    }
  };

  /* ─── urgent full state ─── */

  const effectiveAlert = pvSupport
    ? { id: 'pa', senior_id: 'ps', type: 'sos' as const, state: 'open' as const,
        triggered_at: new Date().toISOString(), latitude: 49.6218, longitude: 20.6971,
        acknowledged_by: 't', acknowledged_at: new Date().toISOString(), resolved_at: null }
    : currentAlert;
  const effectiveUrgent = pvSupport
    ? { alert: effectiveAlert!, relationshipId: 'pr', viewerUserId: 'ps', signalerId: 'ps',
        signalerName: 'Mama', primaryRecipientId: 'r', claimerId: 't', claimerName: 'Ela',
        viewerRole: 'signaler' as const, participants: DEV_PARTICIPANTS }
    : urgentCase;
  const showUrgent = localUrgentOffline || pvSupport || (urgentActive && effectiveAlert && effectiveUrgent?.viewerRole === 'signaler');

  // These tracking hooks must be called unconditionally (React rules of hooks)
  const showCheckedEarly = !showUrgent && (confirmedDone || isSending || isPendingOffline);
  useEffect(() => {
    if (showUrgent) return;
    if (showCheckedEarly) logInviteEvent('daily_sign_completed_seen');
    else logInviteEvent('daily_sign_pending_seen');
  }, [showUrgent, showCheckedEarly]);

  // Bounce the response receipt (must be before early return for hook stability)
  const hasResponseForEffect = todaySignals.filter(s => s.type === 'reaction').length > 0;
  useEffect(() => {
    if (hasResponseForEffect && showChecked) {
      responseReceiptScale.setValue(0);
      Animated.spring(responseReceiptScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }).start();
    }
  }, [hasResponseForEffect, showChecked, responseReceiptScale]);

  if (showUrgent) {
    const loc = effectiveAlert?.latitude != null;
    const claimer = effectiveUrgent?.claimerName;
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.urgentScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.urgentLabel}>W toku</Text>
          <Text style={s.urgentTitle} maxFontSizeMultiplier={1.3}>
            {localUrgentOffline ? 'Brak internetu' : 'Krąg bliskich dostał sygnał'}
          </Text>
          <Text style={s.urgentBody}>
            {localUrgentOffline
              ? 'Bez internetu nie możemy wysłać wiadomości. Spróbuj ponownie, gdy wrócisz online.'
              : claimer ? `${claimer} już się tym zajmuje.` : 'Czekamy, aż ktoś z kręgu odpowie.'}
          </Text>
          {effectiveAlert ? (
            <View style={s.urgentDetail}>
              <Text style={s.urgentDetailText}>Wysłano o {formatTime(effectiveAlert.triggered_at)}</Text>
              <Text style={s.urgentDetailText}>{loc ? 'Lokalizacja dołączona' : 'Bez lokalizacji'}</Text>
            </View>
          ) : null}
          {effectiveUrgent ? <SupportParticipants participants={effectiveUrgent.participants} /> : null}
          <Pressable onPress={() => { if (currentAlert) resolveUrgent(currentAlert.id).catch(() => Alert.alert('Nie udało się', 'Spróbuj ponownie za chwilę.')); }}
            disabled={urgentLoading || localUrgentOffline || !currentAlert}
            style={({ pressed }) => [s.urgentResolveBtn, (urgentLoading || localUrgentOffline || !currentAlert) && { opacity: 0.4 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
            <Text style={s.urgentResolveBtnText}>Już jest dobrze</Text>
          </Pressable>
          <Pressable onPress={() => retrySend().catch(() => Alert.alert('Nie udało się', 'Spróbuj ponownie za chwilę.'))} disabled={urgentLoading || localUrgentOffline}
            style={({ pressed }) => [s.urgentRetryBtn, (urgentLoading || localUrgentOffline) && s.urgentRetryBtnOff, pressed && { opacity: 0.9 }]}>
            <Text style={s.urgentRetryBtnText}>Wyślij ponownie</Text>
          </Pressable>
          <Pressable onPress={() => { if (currentAlert) cancelUrgent(currentAlert.id).catch(() => Alert.alert('Nie udało się', 'Spróbuj ponownie.')); else setLocalUrgentOffline(false); }}
            style={({ pressed }) => [s.cancelLink, pressed && { opacity: 0.65 }]}>
            <Text style={s.cancelLinkText}>To pomyłka, anuluj</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── daily ritual ─── */

  const rf = getRelationForms(primaryName);
  const hasName = !rf.isFallback;
  const name = rf.nominative;

  const isFirstEver = !pv && realWeekDays.length > 0 && realWeekDays.every((d) => d !== 'ok');
  const okDays = realWeekDays.filter((d) => d === 'ok').length + (showChecked && !pv ? 1 : 0);

  // Signals / response data (computed first, used in copy and tracking)
  const signals = pv && showChecked
    ? [{ id: 'p1', from_user_id: 'r', to_user_id: 'ps', type: 'reaction' as const, emoji: '\u{1F49B}', message: null, created_at: new Date().toISOString(), seen_at: null }]
    : todaySignals;
  const hasResponse = signals.filter(s => s.type === 'reaction').length > 0;
  const hasNudge = !showChecked && signals.some(s => s.type === 'nudge');
  const nudgeFrom = hasNudge ? effectiveCircleNames.get(signals.find(s => s.type === 'nudge')!.from_user_id) || primaryName : null;

  const firstReaction = hasResponse ? signals.find(s => s.type === 'reaction') : null;
  const rawResponseName = firstReaction ? (effectiveCircleNames.get(firstReaction.from_user_id) || primaryName) : null;
  const responseName = rawResponseName && rawResponseName !== 'Bliska osoba' ? relationDisplay(rawResponseName) : null;
  const responseEmoji = firstReaction ? (firstReaction.emoji || '\u{1F49B}') : null;

  const incomingPoke = signals.find(s => s.type === 'poke');
  const pokeFromName = incomingPoke ? (effectiveCircleNames.get(incomingPoke.from_user_id) || primaryName) : null;

  // Gap detection
  const hasGap = !pv && !showChecked && !isFirstEver && realWeekDays.length >= 2 && (() => {
    const pastDays = realWeekDays.filter((d) => d !== 'future');
    if (pastDays.length < 2) return false;
    const yesterday = pastDays[pastDays.length - 1];
    const hadContact = pastDays.some((d) => d === 'ok');
    return yesterday === 'missing' && hadContact;
  })();


  const isReallyFirstEver = isFirstEver && dbTotalCount === 0;
  const isComeback = showChecked && !isReallyFirstEver && currentStreak === 1 && dbTotalCount > 0;

  // Copy — 4 clear states
  let copyLine: string;
  let buttonLabel: string;

  if (isSending) {
    copyLine = 'Wysyłamy...';
    buttonLabel = '...';
  } else if (isPendingOffline) {
    copyLine = 'Zapisano. Wyślemy, gdy wróci internet.';
    buttonLabel = 'Zapisano';
  } else if (confirmedDone) {
    // Contextual confirmation copy based on streak/milestone
    if (isReallyFirstEver) {
      copyLine = 'Pierwszy znak wysłany!';
    } else if (isComeback) {
      copyLine = 'Dobrze, że jesteś z powrotem';
    } else if (currentStreak === 2) {
      copyLine = 'Drugi dzień z rzędu';
    } else if (currentStreak >= 3 && currentStreak <= 6) {
      copyLine = `Dzień ${currentStreak} z rzędu`;
    } else if (currentStreak === 7) {
      copyLine = 'Cały tydzień!';
    } else if (currentStreak === 14) {
      copyLine = 'Dwa tygodnie razem';
    } else if (currentStreak === 21) {
      copyLine = 'Trzy tygodnie, to już nawyk';
    } else if (currentStreak === 30) {
      copyLine = hasName ? `Miesiąc! ${name} może na Ciebie liczyć` : 'Miesiąc!';
    } else {
      // Default pool — deterministic pick based on day-of-year
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const pool = [
        hasName ? `${name} wie, że wszystko OK` : 'Znak wysłany',
        hasName ? `Spokojny dzień dla ${rf.genitive}` : 'Spokojny dzień',
        hasName ? `${name} może być spokojna` : 'Gotowe na dziś',
      ];
      copyLine = pool[dayOfYear % pool.length];
    }
    buttonLabel = 'Gotowe';
  } else {
    // Pending today — main action
    if (isFirstEver) {
      copyLine = hasName ? `Wyślij pierwszy znak ${rf.dative}` : 'Wyślij pierwszy znak';
    } else if (hasGap) {
      copyLine = hasName ? `Wróćmy do kontaktu z ${rf.instrumental}` : 'Wróćmy dziś do kontaktu';
    } else {
      copyLine = hasName ? `Daj dziś znak ${rf.dative}` : 'Daj dziś spokojny znak';
    }
    buttonLabel = !pv && !authReady ? '...' : authBlocked ? 'Zaloguj' : 'Daj znak';
  }

  const timeLine = confirmedDone && displayTime ? `o ${displayTime}` : null;
  const buttonDone = confirmedDone || isPendingOffline;
  const buttonDisabled = !canCheckin && !showChecked;

  const weekDots = pv
    ? showChecked ? ['ok','ok','ok','ok','ok','ok','ok'] as const : ['ok','ok','missing','ok','ok','missing','future'] as const
    : realWeekDays;

  return (
    <SafeAreaView style={[s.container, showChecked && s.containerAfter]}>
      <UrgentConfirmation visible={showUrgentModal} onConfirm={handleUrgentConfirm} onCancel={() => setShowUrgentModal(false)} circleCount={recipients.length} />
      <MilestoneCelebration visible={milestoneVisible} streak={currentStreak} recipientName={primaryName} onDismiss={() => setMilestoneVisible(false)} />
      <ScreenHeader subtitle={hasName ? `dla ${rf.genitive}` : undefined} />

      {isOffline ? <Text style={s.offlineBadge}>Brak internetu</Text> : null}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        {/* ─── Warm toast ─── */}
        {showWarmToast ? (
          <Animated.View style={[s.warmToast, { opacity: toastFade }]}>
            <Text style={s.warmToastText}>{hasName ? `${name} już wie` : 'Znak wysłany'}</Text>
          </Animated.View>
        ) : null}

        <View style={s.center}>
          {/* ─── THE BUTTON ─── */}
          <View style={s.buttonArea}>
            {/* Release ring */}
            <Animated.View pointerEvents="none" style={[s.releaseRing, { opacity: releaseRingOpacity, transform: [{ scale: releaseRingScale }] }]} />
            <Particles key={particleCount} visible={celebrationVisible} count={particleCount} colors={[Colors.safe, Colors.love, Colors.highlight, Colors.delight]} />

            {checkinLoading && !showChecked ? (
              <View style={s.loadingCircle}><ActivityIndicator size="large" color={Colors.safe} /></View>
            ) : (
              <Animated.View style={!buttonDone && !buttonDisabled ? {
                  shadowColor: '#2EC4B6',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: breatheShadow,
                  shadowRadius: 32,
                  elevation: 8,
                  borderRadius: BTN / 2,
                } : undefined}>
                <Animated.View style={{ transform: [{ scale: Animated.multiply(buttonScale, breatheScale) }] }}>
                  <Pressable
                    onPress={handleCheckinPress}
                    disabled={!canCheckin}
                    style={({ pressed }) => [
                      s.btn, buttonDone && s.btnDone, buttonDisabled && s.btnOff, !buttonDone && !buttonDisabled && s.btnActive,
                      pressed && canCheckin && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    <Text style={[s.btnText, buttonDone && s.btnTextDone, buttonDisabled && s.btnTextOff]} maxFontSizeMultiplier={1.2}>
                      {buttonLabel}
                    </Text>
                    {buttonDone ? <Text style={[s.btnCheck, { fontFamily: undefined }]}>✓</Text> : null}
                  </Pressable>
                </Animated.View>
              </Animated.View>
            )}
          </View>

          {/* ─── COPY ─── */}
          {showChecked ? (
            <Animated.View style={{ opacity: afterFade, transform: [{ translateY: copySlide }], alignItems: 'center' }}>
              <Text style={s.copyLineDone} maxFontSizeMultiplier={1.3}>{copyLine}</Text>
              {timeLine ? <Text style={s.timeLine}>{timeLine}</Text> : null}
              {hasResponse ? (
                <Animated.View style={[s.responseReceipt, { transform: [{ scale: responseReceiptScale }] }]}>
                  <View style={s.responseReceiptRow}>
                    {responseEmoji ? <Emoji style={s.responseReceiptEmoji}>{responseEmoji}</Emoji> : null}
                    <Text style={s.responseReceiptText}>
                      {responseName ? `${responseName} jest z Tobą` : 'Jest znak'}
                    </Text>
                  </View>
                </Animated.View>
              ) : null}
              {incomingPoke ? (
                <View style={s.pokeReceipt}>
                  <Emoji style={s.responseReceiptEmoji}>{incomingPoke.emoji || '\u{1F49A}'}</Emoji>
                  <Text style={s.pokeReceiptText}>
                    {pokeFromName ? `${pokeFromName} myśli o Tobie` : 'Ktoś myśli o Tobie'}
                  </Text>
                </View>
              ) : null}
              {!statusPicked ? (
                <Animated.View style={[s.statusSection, { opacity: moodFadeOut }]}>
                  <Text style={s.statusPrompt}>Jak się dziś czujesz?</Text>
                  <View style={s.statusRow}>
                    {STATUS_MOODS.map((mood, i) => (
                      <Animated.View key={mood.key} style={{ transform: [{ scale: moodScales[i] }] }}>
                        <Pressable
                          onPress={() => handleStatusPick(mood.key, i)}
                          style={({ pressed }) => [s.statusChip, pressed && { backgroundColor: Colors.surfacePressed }]}
                        >
                          <Emoji style={s.statusEmoji}>{mood.emoji}</Emoji>
                          <Text style={s.statusLabel}>{mood.label}</Text>
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>
              ) : (
                <>
                  <Animated.View style={[s.statusPickedPill, { opacity: moodPickedOpacity, transform: [{ scale: moodPickedScale }] }]}>
                    <Emoji style={s.statusPickedSymbol}>
                      {STATUS_MOODS.find((m) => m.key === statusPicked)?.emoji ?? ''}
                    </Emoji>
                    <Text style={s.statusPickedText}>
                      {STATUS_MOODS.find((m) => m.key === statusPicked)?.label || ''}
                    </Text>
                  </Animated.View>
                  <Text style={s.statusSentHint}>{primaryName ? `${primaryName} zobaczy` : 'Wysłano'}</Text>
                </>
              )}
              {!isReallyFirstEver ? <Text style={s.tomorrowHook}>Gotowe na dziś. Jutro Ci przypomnimy.</Text> : null}
              {!isMilestone && currentStreak >= 2 && currentStreak < 7 ? (
                <Text style={s.streakHook}>Jeszcze {7 - currentStreak} {7 - currentStreak === 1 ? 'dzień' : 'dni'} do pełnego tygodnia</Text>
              ) : !isMilestone && currentStreak >= 7 ? (
                <Text style={s.streakHook}>Wasz codzienny rytuał trwa</Text>
              ) : null}
            </Animated.View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              {hasNudge ? (
                <View style={s.nudgeReceived}>
                  <Text style={s.nudgeReceivedText}>{nudgeFrom ? `${nudgeFrom} czeka na Twój znak` : 'Ktoś bliski czeka na Twój znak'}</Text>
                </View>
              ) : null}
              <Text style={s.copyLine} maxFontSizeMultiplier={1.3}>{copyLine}</Text>
            </View>
          )}

          {/* ─── WEEK DOTS ─── */}
          {weekDots.length > 0 ? <View style={s.dotsWrap}><WeekDots days={weekDots as Array<'ok' | 'missing' | 'future'>} /></View> : null}

          {/* ─── STATS: streak + total (show only when streak is meaningful) ─── */}
          {showChecked && currentStreak >= 3 ? (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statNumber}>{currentStreak}</Text>
                <Text style={s.statLabel}>z rzędu</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statNumber}>{dbTotalCount}</Text>
                <Text style={s.statLabel}>łącznie</Text>
              </View>
            </View>
          ) : null}

          {/* ─── Circle CTA: build safety network ─── */}
          {showChecked ? (
            <Pressable onPress={() => router.push('/trusted-contacts')} style={({ pressed }) => [s.circleLink, pressed && { opacity: 0.6 }]}>
              <Text style={s.circleLinkText}>Dodaj kogoś do kręgu bliskich</Text>
            </Pressable>
          ) : null}

        </View>

        {/* ─── URGENT BUTTON ─── */}
        <Pressable
          onPress={() => {
            if (!canUrgent) { Alert.alert('Zaloguj się', 'Żeby dać znać bliskim, połącz telefon z kontem.'); return; }
            setShowUrgentModal(true);
          }}
          style={({ pressed }) => [s.urgentBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={s.urgentBtnLabel}>Potrzebuję pomocy</Text>
          <Text style={s.urgentBtnSub}>Wyślij sygnał do kręgu bliskich</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const BTN = 200;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  containerAfter: { backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  offlineBadge: { textAlign: 'center', fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, backgroundColor: Colors.surface, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', marginTop: 4 },

  /* button */
  buttonArea: { justifyContent: 'center', alignItems: 'center', height: BTN + 48 },
  releaseRing: { position: 'absolute', width: BTN + 24, height: BTN + 24, borderRadius: (BTN + 24) / 2, backgroundColor: Colors.safeLight },
  loadingCircle: { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  btn: { width: BTN, height: BTN, borderRadius: BTN / 2, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: Colors.safe },
  btnDone: { backgroundColor: Colors.safeLight, borderWidth: 3, borderColor: Colors.safe },
  btnOff: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  btnText: { fontSize: 22, fontFamily: Typography.headingFamily, color: '#FFFFFF', textAlign: 'center' },
  btnTextDone: { color: Colors.safe, fontSize: 22, fontFamily: Typography.headingFamilySemiBold },
  btnTextOff: { color: Colors.textMuted, fontSize: 22 },
  btnCheck: { fontSize: 14, color: Colors.safeStrong, marginTop: 2 },

  /* copy */
  copyLine: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, textAlign: 'center', marginTop: 20, maxWidth: 280 },
  copyLineDone: { fontSize: 20, lineHeight: 28, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, textAlign: 'center', marginTop: 20, maxWidth: 300 },
  timeLine: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  responseReceipt: {
    marginTop: 14, backgroundColor: Colors.safeLight, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, alignSelf: 'center',
  },
  responseReceiptRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  responseReceiptEmoji: { fontSize: 16 },
  responseReceiptText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },
  pokeReceipt: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, backgroundColor: Colors.loveLight, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999,
  },
  pokeReceiptText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.love },
  /* nudge received */
  nudgeReceived: {
    backgroundColor: Colors.loveLight, paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 999, marginBottom: 12,
  },
  nudgeReceivedText: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.love },

  /* warm toast */
  warmToast: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: Colors.safeLight, marginTop: 8 },
  warmToastText: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.safeStrong },

  /* status mood picker */
  statusSection: { marginTop: 14, alignItems: 'center' },
  statusPrompt: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  statusRow: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  statusChip: {
    width: 64, paddingVertical: 12, borderRadius: 16,
    backgroundColor: Colors.surface, alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  statusEmoji: { fontSize: 28, marginBottom: 4 },
  statusLabel: { fontSize: 9, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  statusPickedPill: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
    backgroundColor: Colors.safeLight, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 999, gap: 8,
  },
  statusPickedSymbol: { fontSize: 18 },
  statusPickedText: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.safeStrong },
  statusSentHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  tomorrowHook: { fontSize: 13, color: Colors.textMuted, marginTop: 16 },
  streakHook: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  dotsWrap: { marginTop: 16 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 24,
    backgroundColor: Colors.safeWash, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24,
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontFamily: Typography.headingFamily, color: Colors.safe },
  statLabel: { fontSize: 11, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.safe, opacity: 0.2 },
  circleLink: { marginTop: 18, minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const },
  circleLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.safe },

  /* urgent button — visible but not alarming */
  urgentBtn: {
    alignItems: 'center', paddingVertical: 18, paddingHorizontal: 24, marginBottom: 32,
    alignSelf: 'stretch', marginHorizontal: 24,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.cardStrong,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  urgentBtnLabel: { fontSize: 15, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  urgentBtnSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  /* urgent full state */
  urgentScroll: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 28 },
  urgentLabel: { fontSize: 13, fontFamily: Typography.fontFamilyBold, color: Colors.alert, marginBottom: 10 },
  urgentTitle: { fontSize: 28, lineHeight: 34, fontFamily: Typography.headingFamily, color: Colors.text },
  urgentBody: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, marginTop: 8, marginBottom: 18 },
  urgentDetail: { backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 14 },
  urgentDetailText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 2 },
  urgentResolveBtn: { height: 56, borderRadius: 18, backgroundColor: Colors.safe, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12, shadowColor: '#2EC4B6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6 },
  urgentResolveBtnText: { fontSize: 17, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  urgentRetryBtn: { height: 56, borderRadius: 16, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  urgentRetryBtnOff: { backgroundColor: Colors.disabled },
  urgentRetryBtnText: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  urgentSecBtn: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  urgentSecBtnText: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: Colors.textSecondary },
  cancelLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  cancelLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
});
