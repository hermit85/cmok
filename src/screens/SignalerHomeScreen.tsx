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
import { savePendingCheckin, syncPendingCheckin } from '../services/offlineSync';
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

const DEV_PREVIEW_PARTICIPANTS: SupportParticipant[] = [
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
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const circleNames = useMemo(
    () => new Map(recipients.map((m) => [m.userId, m.name])), [recipients],
  );

  const previewEnabled = __DEV__ && !!previewMode;
  const previewShowChecked = previewMode === 'after';
  const previewIsSupport = previewMode === 'support';
  const primaryName = previewEnabled ? 'Mama' : recipients[0]?.name || null;
  const effectiveCircleNames = useMemo(() => {
    if (!previewEnabled) return circleNames;
    return new Map<string, string>([['r', primaryName || 'Mama'], ...circleNames.entries()]);
  }, [previewEnabled, circleNames, primaryName]);

  /* ─── effects ─── */

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const off = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(off);
      if (!off && pendingSaved) {
        syncPendingCheckin().then((ok) => { if (ok) { setPendingSaved(false); setPendingCheckinTime(null); refreshCheckin(); } });
      }
    });
    return () => unsub();
  }, [pendingSaved, refreshCheckin]);

  useEffect(() => { syncPendingCheckin().then((ok) => { if (ok) refreshCheckin(); }); }, [refreshCheckin]);
  useEffect(() => () => { if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current); }, []);

  /* ─── derived ─── */

  const showChecked = previewEnabled ? previewShowChecked : checkedInToday || pendingSaved || justChecked;
  const displayTime = previewEnabled
    ? previewShowChecked ? '08:14' : null
    : pendingSaved ? pendingCheckinTime : formatTime(lastCheckin?.checked_at ?? null);
  const authBlocked = !previewEnabled && authReady && !isAuthenticated;
  const canCheckin = previewEnabled ? !showChecked : authReady && isAuthenticated && !showChecked && !checkinLoading;
  const canUrgent = previewEnabled ? true : authReady && isAuthenticated;

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
    if (previewEnabled) {
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
    try { await performCheckin(); setJustChecked(true); haptics.success(); playSuccess(); }
    catch (e) {
      if (e instanceof Error && e.name === 'AUTH_REQUIRED') { Alert.alert('Zaloguj się', 'Ten telefon musi być połączony z kontem.'); return; }
      Alert.alert('Nie udało się', 'Spróbuj za chwilę.');
    }
  }, [previewEnabled, previewMode, authReady, isAuthenticated, showChecked, checkinLoading, isOffline, userId, performCheckin, playSuccess]);

  const handleUrgentConfirm = async () => {
    setShowUrgentModal(false);
    if (previewEnabled) { setPreviewMode('support'); return; }
    if (!authReady || !isAuthenticated) { Alert.alert('Zaloguj się', 'Żeby wysłać pilny sygnał, połącz telefon z kontem.'); return; }
    if (isOffline) { setLocalUrgentOffline(true); return; }
    try { await sendUrgentSignal(); setLocalUrgentOffline(false); }
    catch { Alert.alert('Nie udało się', 'Nie udało się wysłać sygnału.'); }
  };

  /* ─── urgent full state ─── */

  const effectiveAlert = previewIsSupport
    ? { id: 'pa', senior_id: 'ps', type: 'sos' as const, state: 'open' as const,
        triggered_at: new Date().toISOString(), latitude: 49.6218, longitude: 20.6971,
        acknowledged_by: 't', acknowledged_at: new Date().toISOString(), resolved_at: null }
    : currentAlert;
  const effectiveUrgentCase = previewIsSupport
    ? { alert: effectiveAlert!, relationshipId: 'pr', viewerUserId: 'ps', signalerId: 'ps',
        signalerName: 'Mama', primaryRecipientId: 'r', claimerId: 't', claimerName: 'Ela',
        viewerRole: 'signaler' as const, participants: DEV_PREVIEW_PARTICIPANTS }
    : urgentCase;
  const showUrgent = localUrgentOffline || previewIsSupport || (urgentActive && effectiveAlert && effectiveUrgentCase?.viewerRole === 'signaler');

  if (showUrgent) {
    const loc = effectiveAlert?.latitude != null;
    const claimer = effectiveUrgentCase?.claimerName;
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.urgentScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.urgentLabel}>Pilne</Text>
          <Text style={s.urgentTitle} maxFontSizeMultiplier={1.3}>
            {localUrgentOffline ? 'Brak internetu' : 'Krąg bliskich dostał sygnał'}
          </Text>
          <Text style={s.urgentBody}>
            {localUrgentOffline
              ? 'Bez internetu nie możemy wysłać sygnału. Zadzwoń bezpośrednio.'
              : claimer ? `${claimer} już się tym zajmuje.` : 'Czekamy, aż ktoś z kręgu odpowie.'}
          </Text>
          {effectiveAlert ? (
            <View style={s.urgentDetail}>
              <Text style={s.urgentDetailText}>Wysłano o {formatTime(effectiveAlert.triggered_at)}</Text>
              <Text style={s.urgentDetailText}>{loc ? 'Lokalizacja dołączona' : 'Bez lokalizacji'}</Text>
            </View>
          ) : null}
          {effectiveUrgentCase ? <SupportParticipants participants={effectiveUrgentCase.participants} /> : null}
          <Pressable onPress={() => retrySend().catch(() => {})} disabled={urgentLoading || localUrgentOffline}
            style={({ pressed }) => [s.urgentBtn, (urgentLoading || localUrgentOffline) && s.urgentBtnOff, pressed && { opacity: 0.9 }]}>
            <Text style={s.urgentBtnText}>Wyślij ponownie</Text>
          </Pressable>
          <Pressable onPress={() => openPhoneCall('112', 'Nie można połączyć.')} style={({ pressed }) => [s.urgentSecBtn, pressed && { opacity: 0.75 }]}>
            <Text style={s.urgentSecBtnText}>Zadzwoń na 112</Text>
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

  const copyLine = showChecked
    ? hasName
      ? displayTime ? `${name} już wie. Poszedł o ${displayTime}` : `${name} już wie`
      : displayTime ? `Gotowe. Poszedł o ${displayTime}` : 'Gotowe'
    : hasName ? `Daj dziś znak ${rf.dative}` : 'Daj dziś spokojny znak';

  const offlineLine = pendingSaved ? 'Wyślemy, gdy wróci internet' : null;
  const buttonLabel = !previewEnabled && !authReady ? '...' : showChecked ? 'Gotowe' : authBlocked ? 'Zaloguj' : 'Daj znak';
  const buttonDone = showChecked;
  const buttonDisabled = !canCheckin && !showChecked;

  // Response signals — inline, no card
  const signals = previewEnabled && showChecked
    ? [{ id: 'p1', from_user_id: 'r', to_user_id: 'ps', type: 'reaction' as const, emoji: '💛', message: null, created_at: new Date().toISOString(), seen_at: null }]
    : todaySignals;
  const responseInline = signals.length > 0
    ? signals.map((sig) => `${sig.emoji || '💛'} od ${relationDisplay(effectiveCircleNames.get(sig.from_user_id))}`).join('  ')
    : null;

  // Week dots — simple array from last 7 days
  const weekDots: Array<'ok' | 'missing' | 'future'> = previewEnabled
    ? showChecked ? ['ok','ok','ok','ok','ok','ok','future'] : ['ok','ok','missing','ok','ok','missing','future']
    : []; // Real data would come from a hook; for now empty = hidden

  return (
    <SafeAreaView style={s.container}>
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

          {/* ─── ONE LINE ─── */}
          <Text style={s.copyLine} maxFontSizeMultiplier={1.3}>{offlineLine || copyLine}</Text>

          {/* ─── RESPONSE (inline) ─── */}
          {showChecked && responseInline ? <Text style={s.responseInline}>{responseInline}</Text> : null}

          {/* ─── WEEK DOTS ─── */}
          {weekDots.length > 0 ? <View style={s.dotsWrap}><WeekDots days={weekDots} /></View> : null}
        </View>

        {/* ─── URGENT LINK ─── */}
        <Pressable
          onPress={() => {
            if (!canUrgent) { Alert.alert('Zaloguj się', 'Żeby wysłać pilny sygnał, połącz telefon z kontem.'); return; }
            setShowUrgentModal(true);
          }}
          style={({ pressed }) => [s.urgentLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.urgentLinkText}>Potrzebuję pomocy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const BTN = 200;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  responseInline: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginTop: 10 },
  dotsWrap: { marginTop: 20 },

  /* urgent link */
  urgentLink: { alignItems: 'center', paddingVertical: 20, marginBottom: 16 },
  urgentLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },

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
