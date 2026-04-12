import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Alert, Animated, ScrollView, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { ScreenHeader } from '../components/ScreenHeader';
import { WeekDots } from '../components/WeekDots';
import { Particles } from '../components/Particles';
import { UrgentConfirmation } from '../components/UrgentConfirmation';
import { MilestoneCelebration } from '../components/MilestoneCelebration';
import { SupportParticipants } from '../components/SupportParticipants';
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
import type { Signal, SupportParticipant } from '../types';
import type { SignalerHomePreview } from '../dev/homePreview';
import { getRelationForms, relationDisplay } from '../utils/relationCopy';

/* ─── status moods ─── */

const STATUS_MOODS = [
  { key: 'good', symbol: '\u{2665}', label: 'Dobrze', color: Colors.love },
  { key: 'calm', symbol: '\u{2022}', label: 'Spokojnie', color: Colors.safe },
  { key: 'tired', symbol: '\u{223C}', label: 'Zm\u{0119}czona', color: Colors.delight },
  { key: 'walk', symbol: '\u{2192}', label: 'Na spacerze', color: Colors.accent },
  { key: 'doctor', symbol: '\u{2020}', label: 'U lekarza', color: Colors.alert },
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
  const {
    authReady, isAuthenticated, userId, checkedInToday,
    loading: checkinLoading, lastCheckin, performCheckin, refreshCheckin,
  } = useCheckin();
  const { recipients } = useCircle();
  const { todaySignals } = useSignals();
  const {
    isActive: urgentActive, currentAlert, urgentCase,
    loading: urgentLoading, preflight: urgentPreflight, sendUrgentSignal, retrySend, cancel: cancelUrgent,
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
  const [previewMode, setPreviewMode] = useState<SignalerHomePreview | null>(preview);

  const isSubmitting = useRef(false);
  const breatheScale = useRef(new Animated.Value(1)).current;
  const breatheShadow = useRef(new Animated.Value(0.4)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const releaseRingScale = useRef(new Animated.Value(0.84)).current;
  const releaseRingOpacity = useRef(new Animated.Value(0)).current;
  const afterFade = useRef(new Animated.Value(0)).current;
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const circleNames = useMemo(
    () => new Map(recipients.map((m) => [m.userId, m.name])), [recipients],
  );

  const pv = __DEV__ && !!previewMode;
  const pvChecked = previewMode === 'after';
  const pvSupport = previewMode === 'support';
  const primaryName = pv ? 'Mama' : recipients[0]?.name || null;
  const effectiveCircleNames = useMemo(() => {
    if (!pv) return circleNames;
    return new Map<string, string>([['r', primaryName || 'Mama'], ...circleNames.entries()]);
  }, [pv, circleNames, primaryName]);

  /* ─── effects ─── */

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
  }, [refreshCheckin, refreshWeek]);
  useEffect(() => () => { if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current); }, []);

  /* ─── derived: 4 clear states ─── */

  // DB-confirmed truth: the ONLY source for "done today"
  const confirmedDone = pv ? pvChecked : checkedInToday;
  // Transitional states: user acted but DB hasn't confirmed yet
  const isSending = !pv && justChecked && !checkedInToday && !pendingSaved;
  const isPendingOffline = !pv && pendingSaved && !checkedInToday;
  // For UI rendering: confirmed OR transitional
  const showChecked = confirmedDone || isSending || isPendingOffline;

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
    scaleLoop.start();
    shadowLoop.start();
    return () => { scaleLoop.stop(); shadowLoop.stop(); };
  }, [showChecked, canCheckin, breatheScale, breatheShadow]);

  /* ─── transition: animate afterFade when showChecked changes ─── */

  useEffect(() => { logInviteEvent('sender_home_viewed'); }, []);

  // Copy slide-up offset for done state
  const copySlide = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (showChecked) {
      afterFade.setValue(0);
      copySlide.setValue(8);
      // Delay copy appearance for 400ms after button transition
      setTimeout(() => {
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
  }, [showChecked, afterFade, copySlide]);

  /* ─── animations ─── */

  // Streak including today's check-in (computed early for animation use)
  const currentStreak = showChecked && !pv ? Math.max(dbStreak + 1, 1) : dbStreak;
  const isMilestone = currentStreak === 7 || currentStreak === 14 || currentStreak === 21 || currentStreak === 30;

  const playSuccess = useCallback(() => {
    if (isMilestone) {
      setCelebrationVisible(true);
      haptics.success(); // longer, more satisfying for milestones
    } else {
      haptics.medium();
    }

    releaseRingScale.setValue(0.84);
    releaseRingOpacity.setValue(0.28);

    // 1. Deep press down to 0.88 (120ms)
    Animated.timing(buttonScale, { toValue: 0.88, duration: 120, useNativeDriver: true }).start(() => {
      // 2. Spring bounce back (overshoots to ~1.05)
      Animated.parallel([
        Animated.spring(buttonScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(releaseRingScale, { toValue: 1.22, duration: 700, useNativeDriver: true }),
        Animated.timing(releaseRingOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    });

    // Stop breathing shadow on done
    breatheShadow.setValue(0);

    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    if (isMilestone) {
      celebrationTimeoutRef.current = setTimeout(() => {
        setCelebrationVisible(false);
        setMilestoneVisible(true); // show full-screen celebration after particle burst
      }, 1200);
    }
  }, [buttonScale, releaseRingOpacity, releaseRingScale, breatheShadow, isMilestone]);

  /* ─── handlers ─── */

  const handleCheckin = useCallback(async () => {
    // Explicit tap guard — prevent any auto-fire from mount/effect/restore
    if (isSubmitting.current) return;

    if (pv) {
      if (previewMode === 'before') { setPreviewMode('after'); setJustChecked(true); playSuccess(); }
      return;
    }
    if (!authReady) return;
    if (!isAuthenticated) { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
    if (showChecked || checkinLoading) return;
    isSubmitting.current = true;
    const now = new Date();
    const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (isOffline) {
      try {
        if (!userId) throw new Error('AUTH');
        await savePendingCheckin(userId); setPendingSaved(true); setPendingCheckinTime(t); setJustChecked(true); playSuccess();
      } catch { Alert.alert('Nie udało się', 'Spróbuj za chwilę.'); }
      finally { isSubmitting.current = false; }
      return;
    }
    try {
      if (isFirstEver) logInviteEvent('first_sign_started');
      await performCheckin();
      if (isFirstEver) logInviteEvent('first_sign_sent');
      const prevOk = realWeekDays.filter((d) => d === 'ok').length;
      if (prevOk === 1) logInviteEvent('second_day_sign_sent');
      if (prevOk === 2) logInviteEvent('third_day_sign_sent');
      if (hasGap) logInviteEvent('sign_sent_after_gap');
      setJustChecked(true); playSuccess();
      refreshWeek(); refreshStats();
    } catch (e) {
      if (e instanceof Error && e.name === 'AUTH_REQUIRED') { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
      Alert.alert('Nie udało się', 'Spróbuj za chwilę.');
    } finally {
      isSubmitting.current = false;
    }
  }, [pv, previewMode, authReady, isAuthenticated, showChecked, checkinLoading, isOffline, userId, performCheckin, playSuccess, refreshWeek, refreshStats]);

  const handleStatusPick = useCallback(async (statusKey: string) => {
    setStatusPicked(statusKey);
    haptics.light();
    if (pv || !userId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('daily_checkins').update({ status_emoji: statusKey }).eq('senior_id', userId).eq('local_date', today);
    } catch { /* silent — status is optional */ }
  }, [pv, userId]);

  const handleMilestoneShare = useCallback(async () => {
    const streakText = currentStreak === 7 ? 'tydzień' : currentStreak === 14 ? '2 tygodnie' : currentStreak === 21 ? '3 tygodnie' : currentStreak === 30 ? 'miesiąc' : `${currentStreak} dni`;
    const displayName = primaryName || null;
    const msg = displayName
      ? `${displayName} i ja, ${streakText} codziennego kontaktu w Cmok! Znasz kogoś, kto mieszka sam? Cmok daje spokój obu stronom.\n\nhttps://apps.apple.com/pl/app/cmok/id6760717645`
      : `${streakText} codziennego kontaktu w Cmok!\n\nhttps://apps.apple.com/pl/app/cmok/id6760717645`;
    try {
      await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'Cmok' });
    } catch { /* cancelled */ }
  }, [currentStreak, primaryName]);

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
          <Pressable onPress={() => retrySend().catch(() => {})} disabled={urgentLoading || localUrgentOffline}
            style={({ pressed }) => [s.urgentRetryBtn, (urgentLoading || localUrgentOffline) && s.urgentRetryBtnOff, pressed && { opacity: 0.9 }]}>
            <Text style={s.urgentRetryBtnText}>Wyślij ponownie</Text>
          </Pressable>
          <Pressable onPress={() => { if (currentAlert) cancelUrgent(currentAlert.id).catch(() => {}); else setLocalUrgentOffline(false); }}
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
  const hasResponse = signals.length > 0;
  const rawResponseName = hasResponse ? effectiveCircleNames.get(signals[0].from_user_id) : null;
  const responseName = rawResponseName && rawResponseName !== 'Bliska osoba' ? relationDisplay(rawResponseName) : null;
  const responseEmoji = hasResponse ? (signals[0].emoji || '\u{1F49B}') : null;

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
      <ScreenHeader subtitle={hasName ? name : undefined} />

      {isOffline ? <Text style={s.offlineBadge}>Brak internetu</Text> : null}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={s.center}>
          {/* ─── THE BUTTON ─── */}
          <View style={s.buttonArea}>
            <Animated.View pointerEvents="none" style={[s.releaseRing, { opacity: releaseRingOpacity, transform: [{ scale: releaseRingScale }] }]} />
            <Particles visible={celebrationVisible} count={14} colors={[Colors.safe, Colors.love, Colors.highlight, Colors.delight]} />

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
                    onPress={handleCheckin}
                    onLongPress={() => { if (canUrgent) { haptics.heavy(); setShowUrgentModal(true); } }}
                    delayLongPress={2000}
                    disabled={!canCheckin && !canUrgent}
                    style={({ pressed }) => [
                      s.btn, buttonDone && s.btnDone, buttonDisabled && s.btnOff, !buttonDone && !buttonDisabled && s.btnActive,
                      pressed && canCheckin && { transform: [{ scale: 0.96 }], opacity: 0.94 },
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
                <View style={s.responseReceipt}>
                  <Text style={s.responseReceiptText}>{responseName ? `${responseName} jest z Toba` : 'Jest znak'}</Text>
                </View>
              ) : null}
              {!statusPicked ? (
                <View style={s.statusSection}>
                  <Text style={s.statusPrompt}>Jak się dziś czujesz?</Text>
                  <View style={s.statusRow}>
                    {STATUS_MOODS.map((mood) => (
                      <Pressable
                        key={mood.key}
                        onPress={() => handleStatusPick(mood.key)}
                        style={({ pressed }) => [s.statusChip, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={[s.statusSymbol, { color: mood.color }]}>{mood.symbol}</Text>
                        <Text style={s.statusLabel}>{mood.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={s.statusPicked}>
                  {STATUS_MOODS.find((m) => m.key === statusPicked)?.label || ''}
                </Text>
              )}
              {!isMilestone && currentStreak >= 2 ? (
                <Text style={s.tomorrowHook}>Jutro dzień {currentStreak + 1}!</Text>
              ) : null}
            </Animated.View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={s.copyLine} maxFontSizeMultiplier={1.3}>{hasName ? `${name} czeka na Twój znak` : copyLine}</Text>
            </View>
          )}

          {/* ─── WEEK DOTS ─── */}
          {weekDots.length > 0 ? <View style={s.dotsWrap}><WeekDots days={weekDots as Array<'ok' | 'missing' | 'future'>} showLabel={showChecked} /></View> : null}

          {/* ─── VIRAL: subtle invite link ─── */}
          {showChecked && currentStreak >= 3 ? (
            <Pressable onPress={handleMilestoneShare} style={({ pressed }) => [s.viralLink, pressed && { opacity: 0.5 }]}>
              <Text style={s.viralLinkText}>Zaproś kogoś do kręgu</Text>
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
  copyLine: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center', marginTop: 20, maxWidth: 280 },
  copySubLine: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  copyLineDone: { fontSize: 17, lineHeight: 24, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, textAlign: 'center', marginTop: 20, maxWidth: 280 },
  timeLine: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  responseReceipt: {
    marginTop: 14, backgroundColor: Colors.safeLight, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, alignSelf: 'center',
  },
  responseReceiptText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },
  /* status mood picker */
  statusSection: { marginTop: 20, alignItems: 'center' },
  statusPrompt: { fontSize: 13, color: Colors.textMuted, marginBottom: 10 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: 'center', minWidth: 56,
  },
  statusSymbol: { fontSize: 16, marginBottom: 2 },
  statusLabel: { fontSize: 9, color: Colors.textMuted },
  statusPicked: { fontSize: 14, color: Colors.safe, fontFamily: Typography.headingFamilySemiBold, marginTop: 16 },
  tomorrowHook: { fontSize: 13, color: Colors.textMuted, marginTop: 16 },
  shareBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface },
  shareBtnText: { fontSize: 13, color: Colors.accent, fontFamily: Typography.headingFamilySemiBold },

  dotsWrap: { marginTop: 24 },
  viralLink: { marginTop: 16, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  viralLinkText: { fontSize: 13, color: Colors.textMuted },

  /* urgent button — visible but not alarming */
  urgentBtn: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, marginBottom: 32,
    alignSelf: 'stretch', marginHorizontal: 24,
    borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.cardStrong,
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
  urgentRetryBtn: { height: 56, borderRadius: 16, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  urgentRetryBtnOff: { backgroundColor: Colors.disabled },
  urgentRetryBtnText: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  urgentSecBtn: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  urgentSecBtnText: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: Colors.textSecondary },
  cancelLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  cancelLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
});
