import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Alert, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { ScreenHeader } from '../components/ScreenHeader';
import { WeekDots } from '../components/WeekDots';
import { Particles } from '../components/Particles';
import { UrgentConfirmation } from '../components/UrgentConfirmation';
import { SupportParticipants } from '../components/SupportParticipants';
import { Colors } from '../constants/colors';
import { Shadows } from '../constants/tokens';
import { haptics } from '../utils/haptics';
import { openPhoneCall } from '../utils/linking';
import { useCheckin } from '../hooks/useCheckin';
import { useCircle } from '../hooks/useCircle';
import { useSignals } from '../hooks/useSignals';
import { useUrgentSignal } from '../hooks/useUrgentSignal';
import { useWeekRhythm } from '../hooks/useWeekRhythm';
import { savePendingCheckin, syncPendingCheckin } from '../services/offlineSync';
import { logInviteEvent } from '../utils/invite';
import type { Signal, SupportParticipant } from '../types';
import type { SignalerHomePreview } from '../dev/homePreview';
import { getRelationForms, relationDisplay } from '../utils/relationCopy';

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
    loading: urgentLoading, sendUrgentSignal, retrySend, cancel: cancelUrgent,
  } = useUrgentSignal();
  const { days: realWeekDays, refresh: refreshWeek } = useWeekRhythm(userId);

  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [localUrgentOffline, setLocalUrgentOffline] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSaved, setPendingSaved] = useState(false);
  const [pendingCheckinTime, setPendingCheckinTime] = useState<string | null>(null);
  const [justChecked, setJustChecked] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [previewMode, setPreviewMode] = useState<SignalerHomePreview | null>(preview);

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
          if (ok) { setPendingSaved(false); setPendingCheckinTime(null); refreshCheckin(); refreshWeek(); }
        });
      }
    });
    return () => unsub();
  }, [pendingSaved, refreshCheckin, refreshWeek]);

  useEffect(() => { syncPendingCheckin().then((ok) => { if (ok) { refreshCheckin(); refreshWeek(); } }); }, [refreshCheckin, refreshWeek]);
  useEffect(() => () => { if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current); }, []);

  /* ─── derived ─── */

  const showChecked = pv ? pvChecked : checkedInToday || pendingSaved || justChecked;
  const displayTime = pv
    ? pvChecked ? '08:14' : null
    : pendingSaved ? pendingCheckinTime : formatTime(lastCheckin?.checked_at ?? null);
  const authBlocked = !pv && authReady && !isAuthenticated;
  const canCheckin = pv ? !showChecked : authReady && isAuthenticated && !showChecked && !checkinLoading;
  const canUrgent = pv ? true : authReady && isAuthenticated;

  /* ─── transition: animate afterFade when showChecked changes ─── */

  useEffect(() => { logInviteEvent('sender_home_viewed'); }, []);

  useEffect(() => {
    if (showChecked) {
      afterFade.setValue(0);
      Animated.timing(afterFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      if (isFirstEver) logInviteEvent('first_sign_success_seen');
    } else {
      afterFade.setValue(0);
    }
  }, [showChecked, afterFade]);

  /* ─── animations ─── */

  const playSuccess = useCallback(() => {
    setCelebrationVisible(true);
    releaseRingScale.setValue(0.84);
    releaseRingOpacity.setValue(0.28);
    Animated.parallel([
      Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true, speed: 22, bounciness: 9 }),
      Animated.timing(releaseRingScale, { toValue: 1.22, duration: 700, useNativeDriver: true }),
      Animated.timing(releaseRingOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start(() => {
      Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
    });
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    celebrationTimeoutRef.current = setTimeout(() => setCelebrationVisible(false), 1200);
  }, [buttonScale, releaseRingOpacity, releaseRingScale]);

  /* ─── handlers ─── */

  const handleCheckin = useCallback(async () => {
    if (pv) {
      if (previewMode === 'before') { setPreviewMode('after'); setJustChecked(true); haptics.success(); playSuccess(); }
      return;
    }
    if (!authReady) return;
    if (!isAuthenticated) { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
    if (showChecked || checkinLoading) return;
    const now = new Date();
    const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (isOffline) {
      try {
        if (!userId) throw new Error('AUTH');
        await savePendingCheckin(userId); setPendingSaved(true); setPendingCheckinTime(t); setJustChecked(true); haptics.success(); playSuccess();
      } catch { Alert.alert('Nie udało się', 'Spróbuj za chwilę.'); }
      return;
    }
    try {
      logInviteEvent('first_sign_started');
      await performCheckin();
      logInviteEvent('first_sign_sent');
      // Day-N and gap tracking
      const prevOk = realWeekDays.filter((d) => d === 'ok').length;
      if (prevOk === 1) logInviteEvent('second_day_sign_sent');
      if (prevOk === 2) logInviteEvent('third_day_sign_sent');
      if (hasGap) logInviteEvent('sign_sent_after_gap');
      setJustChecked(true); haptics.success(); playSuccess();
      refreshWeek();
    } catch (e) {
      if (e instanceof Error && e.name === 'AUTH_REQUIRED') { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
      Alert.alert('Nie udało się', 'Spróbuj za chwilę.');
    }
  }, [pv, previewMode, authReady, isAuthenticated, showChecked, checkinLoading, isOffline, userId, performCheckin, playSuccess, refreshWeek]);

  const handleUrgentConfirm = async () => {
    setShowUrgentModal(false);
    if (pv) { setPreviewMode('support'); return; }
    if (!authReady || !isAuthenticated) { Alert.alert('Zaloguj się', 'Żeby dać znać bliskim, połącz telefon z kontem.'); return; }
    if (isOffline) { setLocalUrgentOffline(true); return; }
    try { await sendUrgentSignal(); setLocalUrgentOffline(false); }
    catch { Alert.alert('Nie udało się', 'Nie udało się wysłać sygnału.'); }
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
              ? 'Bez internetu nie możemy wysłać wiadomości. Zadzwoń bezpośrednio.'
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
            style={({ pressed }) => [s.urgentBtn, (urgentLoading || localUrgentOffline) && s.urgentBtnOff, pressed && { opacity: 0.9 }]}>
            <Text style={s.urgentBtnText}>Wyślij ponownie</Text>
          </Pressable>
          <Pressable onPress={() => openPhoneCall('112', 'Nie można połączyć.')} style={({ pressed }) => [s.urgentSecBtn, pressed && { opacity: 0.75 }]}>
            <Text style={s.urgentSecBtnText}>Zadzwoń bezpośrednio</Text>
          </Pressable>
          <Pressable onPress={() => { if (currentAlert) cancelUrgent(currentAlert.id).catch(() => {}); else setLocalUrgentOffline(false); }}
            style={({ pressed }) => [s.cancelLink, pressed && { opacity: 0.65 }]}>
            <Text style={s.cancelLinkText}>To pomyłka — anuluj</Text>
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
  const responseName = hasResponse ? relationDisplay(effectiveCircleNames.get(signals[0].from_user_id)) : null;
  const responseEmoji = hasResponse ? (signals[0].emoji || '\u{1F49B}') : null;

  // Gap detection
  const hasGap = !pv && !showChecked && !isFirstEver && realWeekDays.length >= 2 && (() => {
    const pastDays = realWeekDays.filter((d) => d !== 'future');
    if (pastDays.length < 2) return false;
    const yesterday = pastDays[pastDays.length - 1];
    const hadContact = pastDays.some((d) => d === 'ok');
    return yesterday === 'missing' && hadContact;
  })();

  // Track state views
  useEffect(() => {
    if (showChecked) logInviteEvent('daily_sign_completed_seen');
    else if (hasGap) logInviteEvent('sender_recovery_state_seen');
    else logInviteEvent('daily_sign_pending_seen');
  }, [showChecked, hasGap]);

  useEffect(() => {
    if (hasResponse && showChecked) {
      logInviteEvent('sender_response_seen');
      logInviteEvent('sender_response_receipt_restored');
    }
  }, [hasResponse, showChecked]);

  // Copy states
  const afterCopy = isFirstEver && showChecked
    ? hasName ? `Pierwszy znak poszedł do ${rf.genitive}` : 'Pierwszy znak poszedł'
    : showChecked && hasGap
      ? 'Wróciło'
      : showChecked
        ? hasResponse ? 'Na dziś jesteście w kontakcie' : hasName ? `${name} zobaczy` : 'Znak poszedł'
        : '';

  const copyLine = showChecked
    ? afterCopy
    : isFirstEver
      ? hasName ? `Wyślij pierwszy znak ${rf.dative}` : 'Wyślij pierwszy znak'
      : hasGap
        ? hasName ? `Wróćmy do kontaktu z ${rf.instrumental}` : 'Wróćmy dziś do kontaktu'
        : hasName ? `Daj dziś znak ${rf.dative}` : 'Daj dziś spokojny znak';

  const timeLine = showChecked && displayTime ? `o ${displayTime}` : null;
  const offlineLine = pendingSaved ? 'Wyślemy, gdy wróci internet' : null;
  const buttonLabel = !pv && !authReady ? '...' : showChecked ? 'Gotowe' : authBlocked ? 'Zaloguj' : isFirstEver ? 'Wyślij' : 'Daj znak';
  const buttonDone = showChecked;
  const buttonDisabled = !canCheckin && !showChecked;

  const weekDots = pv
    ? showChecked ? ['ok','ok','ok','ok','ok','ok','ok'] as const : ['ok','ok','missing','ok','ok','missing','future'] as const
    : realWeekDays;

  return (
    <SafeAreaView style={[s.container, showChecked && s.containerAfter]}>
      <UrgentConfirmation visible={showUrgentModal} onConfirm={handleUrgentConfirm} onCancel={() => setShowUrgentModal(false)} />
      <ScreenHeader subtitle={name} />

      {isOffline ? <Text style={s.offlineBadge}>Brak internetu</Text> : null}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={s.center}>
          {/* ─── THE BUTTON ─── */}
          <View style={s.buttonArea}>
            <Animated.View pointerEvents="none" style={[s.releaseRing, { opacity: releaseRingOpacity, transform: [{ scale: releaseRingScale }] }]} />
            <Particles visible={celebrationVisible} count={12} colors={[Colors.safe, Colors.accent, '#E5B865']} />

            {checkinLoading && !showChecked ? (
              <View style={s.loadingCircle}><ActivityIndicator size="large" color={Colors.safe} /></View>
            ) : (
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable
                  onPress={handleCheckin} disabled={!canCheckin}
                  style={({ pressed }) => [
                    s.btn, buttonDone && s.btnDone, buttonDisabled && s.btnOff, !buttonDone && !buttonDisabled && s.btnActive,
                    pressed && canCheckin && { transform: [{ scale: 0.96 }], opacity: 0.94 },
                  ]}
                >
                  <Text style={[s.btnText, buttonDone && s.btnTextDone, buttonDisabled && s.btnTextOff]} maxFontSizeMultiplier={1.2}>
                    {buttonLabel}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* ─── COPY ─── */}
          {showChecked ? (
            <Animated.View style={{ opacity: afterFade, alignItems: 'center' }}>
              <Text style={s.copyLine} maxFontSizeMultiplier={1.3}>{offlineLine || copyLine}</Text>
              {timeLine ? <Text style={s.timeLine}>{timeLine}</Text> : null}
              {hasResponse ? (
                <View style={s.responseReceipt}>
                  <Text style={s.responseReceiptText}>{responseEmoji} od {responseName}</Text>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <Text style={s.copyLine} maxFontSizeMultiplier={1.3}>{copyLine}</Text>
          )}

          {/* ─── WEEK DOTS ─── */}
          {weekDots.length > 0 ? <View style={s.dotsWrap}><WeekDots days={weekDots as Array<'ok' | 'missing' | 'future'>} showLabel={showChecked} /></View> : null}
        </View>

        {/* ─── URGENT LINK ─── */}
        <Pressable
          onPress={() => {
            if (!canUrgent) { Alert.alert('Zaloguj się', 'Żeby dać znać bliskim, połącz telefon z kontem.'); return; }
            setShowUrgentModal(true);
          }}
          style={({ pressed }) => [s.urgentLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.urgentLinkText}>Daj znać, że coś się dzieje</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const BTN = 200;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  containerAfter: { backgroundColor: '#F7F4EE' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  offlineBadge: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textSecondary, backgroundColor: Colors.surface, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', marginTop: 4 },

  /* button */
  buttonArea: { justifyContent: 'center', alignItems: 'center', height: BTN + 40 },
  releaseRing: { position: 'absolute', width: BTN + 24, height: BTN + 24, borderRadius: (BTN + 24) / 2, backgroundColor: Colors.safeLight },
  loadingCircle: { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  btn: { width: BTN, height: BTN, borderRadius: BTN / 2, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: Colors.safe, ...Shadows.elevated, shadowColor: Colors.safe },
  btnDone: { backgroundColor: Colors.safeLight, borderWidth: 2, borderColor: Colors.safe },
  btnOff: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  btnText: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  btnTextDone: { color: Colors.safeStrong, fontSize: 24 },
  btnTextOff: { color: Colors.textMuted, fontSize: 22 },

  /* copy */
  copyLine: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center', marginTop: 16, maxWidth: 280 },
  timeLine: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  responseReceipt: {
    marginTop: 14, backgroundColor: Colors.safeLight, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999, alignSelf: 'center',
  },
  responseReceiptText: { fontSize: 15, fontWeight: '600', color: Colors.safeStrong },
  dotsWrap: { marginTop: 24 },

  /* urgent link */
  urgentLink: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.surface, borderRadius: 14, alignSelf: 'center',
  },
  urgentLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  /* urgent full state */
  urgentScroll: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 28 },
  urgentLabel: { fontSize: 13, fontWeight: '700', color: Colors.alert, marginBottom: 10 },
  urgentTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: Colors.text },
  urgentBody: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, marginTop: 8, marginBottom: 18 },
  urgentDetail: { backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 14 },
  urgentDetailText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 2 },
  urgentBtn: { height: 56, borderRadius: 16, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  urgentBtnOff: { backgroundColor: Colors.disabled },
  urgentBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  urgentSecBtn: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  urgentSecBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  cancelLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  cancelLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
