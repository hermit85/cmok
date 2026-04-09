import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusPill } from '../components/StatusPill';
import { Particles } from '../components/Particles';
import { UrgentConfirmation } from '../components/UrgentConfirmation';
import { SupportParticipants } from '../components/SupportParticipants';
import { Colors } from '../constants/colors';
import { Radius, Spacing, Shadows } from '../constants/tokens';
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/* ─── sub-components ─── */

function ResponseChips({
  signals,
  circleNames,
}: {
  signals: Signal[];
  circleNames: Map<string, string>;
}) {
  if (signals.length === 0) return null;

  return (
    <View style={s.responsesRow}>
      <Text style={s.responsesLabel}>Wróciło od bliskich</Text>
      <View style={s.chipWrap}>
        {signals.map((signal) => {
          const name = relationDisplay(circleNames.get(signal.from_user_id));
          return (
            <View key={signal.id} style={s.chip}>
              <Text style={s.chipText}>
                {signal.emoji || '💛'} {name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── preview data ─── */

const DEV_PREVIEW_PARTICIPANTS: SupportParticipant[] = [
  {
    userId: 'recipient-preview',
    name: 'Mama',
    phone: '+48600100200',
    kind: 'primary',
    deliveryStatus: 'sent',
    isClaimedBy: false,
  },
  {
    userId: 'trusted-preview',
    name: 'Ela',
    phone: '+48600100300',
    kind: 'trusted',
    deliveryStatus: 'sent',
    isClaimedBy: true,
  },
];

/* ─── main component ─── */

export function SignalerHomeScreen({ preview = null }: { preview?: SignalerHomePreview | null }) {
  const {
    authReady,
    isAuthenticated,
    userId,
    checkedInToday,
    loading: checkinLoading,
    lastCheckin,
    performCheckin,
    refreshCheckin,
  } = useCheckin();
  const { recipients } = useCircle();
  const { todaySignals } = useSignals();
  const {
    isActive: urgentActive,
    currentAlert,
    urgentCase,
    loading: urgentLoading,
    sendUrgentSignal,
    retrySend,
    cancel: cancelUrgent,
  } = useUrgentSignal();

  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [localSupportState, setLocalSupportState] = useState<'none' | 'offline'>('none');
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
    () => new Map(recipients.map((m) => [m.userId, m.name])),
    [recipients],
  );

  /* preview helpers */
  const previewEnabled = __DEV__ && !!previewMode;
  const previewShowChecked = previewMode === 'after';
  const previewIsSupport = previewMode === 'support';
  const primaryRecipientName = previewEnabled ? 'Mama' : recipients[0]?.name || null;

  const effectiveCircleNames = useMemo(() => {
    if (!previewEnabled) return circleNames;
    return new Map<string, string>([
      ['recipient-preview', primaryRecipientName || 'Mama'],
      ...Array.from(circleNames.entries()),
    ]);
  }, [previewEnabled, circleNames, primaryRecipientName]);

  /* ─── effects ─── */

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      if (!offline && pendingSaved) {
        syncPendingCheckin().then((synced) => {
          if (synced) {
            setPendingSaved(false);
            setPendingCheckinTime(null);
            refreshCheckin();
          }
        });
      }
    });
    return () => unsubscribe();
  }, [pendingSaved, refreshCheckin]);

  useEffect(() => {
    syncPendingCheckin().then((synced) => { if (synced) refreshCheckin(); });
  }, [refreshCheckin]);

  useEffect(() => () => {
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
  }, []);

  /* ─── derived state ─── */

  const showChecked = previewEnabled
    ? previewShowChecked
    : checkedInToday || pendingSaved || justChecked;

  const displayTime = previewEnabled
    ? previewShowChecked ? '08:14' : null
    : pendingSaved
      ? pendingCheckinTime
      : formatTime(lastCheckin?.checked_at ?? null);

  const authBlocked = !previewEnabled && authReady && !isAuthenticated;
  const canTriggerCheckin = previewEnabled
    ? !showChecked
    : authReady && isAuthenticated && !showChecked && !checkinLoading;
  const canTriggerSupport = previewEnabled ? true : authReady && isAuthenticated;

  /* ─── animations ─── */

  const playSuccessRelease = useCallback(() => {
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
      if (previewMode === 'before') {
        setPreviewMode('after');
        setJustChecked(true);
        haptics.success();
        playSuccessRelease();
      }
      return;
    }

    if (!authReady) return;
    if (!isAuthenticated) {
      Alert.alert('Zaloguj ten telefon ponownie', 'Żeby dać znak, ten telefon musi być znowu połączony z kontem.');
      return;
    }
    if (showChecked || checkinLoading) return;

    const now = new Date();
    const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (isOffline) {
      try {
        if (!userId) {
          const error = new Error('Brak zalogowanego użytkownika');
          error.name = 'AUTH_REQUIRED';
          throw error;
        }
        await savePendingCheckin(userId);
        setPendingSaved(true);
        setPendingCheckinTime(localTime);
        setJustChecked(true);
        haptics.success();
        playSuccessRelease();
      } catch {
        Alert.alert('Nie udało się teraz', 'Ten telefon nie jest jeszcze gotowy albo nie udało się zapisać znaku.');
      }
      return;
    }

    try {
      await performCheckin();
      setJustChecked(true);
      haptics.success();
      playSuccessRelease();
    } catch (error) {
      if (error instanceof Error && error.name === 'AUTH_REQUIRED') {
        Alert.alert('Zaloguj ten telefon ponownie', 'Żeby dać znak, ten telefon musi być znowu połączony z kontem.');
        return;
      }
      Alert.alert('Nie udało się teraz', 'Dziś znak nie poszedł. Spróbuj jeszcze raz za chwilę.');
    }
  }, [previewEnabled, previewMode, authReady, isAuthenticated, showChecked, checkinLoading, isOffline, userId, performCheckin, playSuccessRelease]);

  const handleUrgentConfirm = async () => {
    setShowUrgentModal(false);
    if (previewEnabled) { setPreviewMode('support'); return; }
    if (!authReady || !isAuthenticated) {
      Alert.alert('Zaloguj ten telefon ponownie', 'Żeby wysłać pilny sygnał, ten telefon musi być połączony z kontem.');
      return;
    }
    if (isOffline) { setLocalSupportState('offline'); return; }
    try {
      await sendUrgentSignal();
      setLocalSupportState('none');
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać sygnału.');
    }
  };

  const handleCancelAlarm = async () => {
    if (!currentAlert) { setLocalSupportState('none'); return; }
    try {
      await cancelUrgent(currentAlert.id);
      setLocalSupportState('none');
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się anulować.');
    }
  };

  const handleRetry = async () => {
    if (isOffline || localSupportState === 'offline') { setLocalSupportState('offline'); return; }
    try { await retrySend(); } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się ponowić.');
    }
  };

  /* ─── support / urgent state ─── */

  const effectiveAlert = previewIsSupport
    ? {
        id: 'preview-alert',
        senior_id: 'preview-signaler',
        type: 'sos' as const,
        state: 'open' as const,
        triggered_at: new Date().toISOString(),
        latitude: 49.6218,
        longitude: 20.6971,
        acknowledged_by: 'trusted-preview',
        acknowledged_at: new Date().toISOString(),
        resolved_at: null,
      }
    : currentAlert;

  const effectiveSupportCase = previewIsSupport
    ? {
        alert: effectiveAlert!,
        relationshipId: 'preview-relationship',
        viewerUserId: 'preview-signaler',
        signalerId: 'preview-signaler',
        signalerName: 'Mama',
        primaryRecipientId: 'recipient-preview',
        claimerId: 'trusted-preview',
        claimerName: 'Ela',
        viewerRole: 'signaler' as const,
        participants: DEV_PREVIEW_PARTICIPANTS,
      }
    : urgentCase;

  const shouldShowSupport =
    localSupportState === 'offline' ||
    previewIsSupport ||
    (urgentActive && effectiveAlert && effectiveSupportCase?.viewerRole === 'signaler');

  if (shouldShowSupport) {
    const hasLocation = effectiveAlert?.latitude != null && effectiveAlert?.longitude != null;
    const claimerName = effectiveSupportCase?.claimerName;

    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.supportScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.urgentLabel}>Pilne</Text>
          <Text style={s.urgentTitle} maxFontSizeMultiplier={1.3}>
            {localSupportState === 'offline'
              ? 'Brak internetu'
              : 'Krąg bliskich dostał sygnał'}
          </Text>
          <Text style={s.urgentBody}>
            {localSupportState === 'offline'
              ? 'Bez internetu nie możemy wysłać sygnału. Jeśli to pilne, zadzwoń bezpośrednio.'
              : claimerName
                ? `${claimerName} już się tym zajmuje.`
                : 'Czekamy, aż ktoś z kręgu odpowie.'}
          </Text>

          {effectiveAlert ? (
            <View style={s.detailCard}>
              <Text style={s.detailEyebrow}>Szczegóły</Text>
              <Text style={s.detailText}>Wysłano o {formatTime(effectiveAlert.triggered_at)}</Text>
              <Text style={s.detailText}>
                {hasLocation
                  ? `Lokalizacja dołączona`
                  : 'Bez lokalizacji'}
              </Text>
            </View>
          ) : null}

          {effectiveSupportCase ? (
            <SupportParticipants participants={effectiveSupportCase.participants} />
          ) : null}

          <View style={s.urgentActions}>
            <Pressable
              onPress={handleRetry}
              disabled={urgentLoading || localSupportState === 'offline'}
              style={({ pressed }) => [
                s.urgentPrimary,
                (urgentLoading || localSupportState === 'offline') && s.urgentPrimaryDisabled,
                pressed && !urgentLoading && localSupportState !== 'offline' && { opacity: 0.9 },
              ]}
            >
              <Text style={s.urgentPrimaryText}>Wyślij ponownie</Text>
            </Pressable>

            <Pressable
              onPress={() => openPhoneCall('112', 'To urządzenie nie obsługuje połączeń.')}
              style={({ pressed }) => [s.urgentSecondary, pressed && { opacity: 0.75 }]}
            >
              <Text style={s.urgentSecondaryText}>Zadzwoń na 112</Text>
            </Pressable>

            <Pressable
              onPress={handleCancelAlarm}
              style={({ pressed }) => [s.cancelLink, pressed && { opacity: 0.65 }]}
            >
              <Text style={s.cancelLinkText}>To pomyłka — anuluj</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── daily ritual view ─── */

  const relationForms = getRelationForms(primaryRecipientName);
  const hasRealName = !relationForms.isFallback;
  const relationName = relationForms.nominative;

  // Copy
  const title = showChecked
    ? hasRealName ? `${relationName} już wie` : 'Gotowe'
    : hasRealName ? `Daj dziś znak ${relationForms.dative}` : 'Daj dziś spokojny znak';

  const subtitle = showChecked
    ? pendingSaved
      ? 'Wyślemy, gdy wróci internet.'
      : displayTime
        ? `Poszedł o ${displayTime}`
        : null
    : hasRealName
      ? `Jedno stuknięcie i ${relationName} wie, że jest dobrze.`
      : 'Jedno stuknięcie — nic więcej nie trzeba.';

  const pillVariant = showChecked ? 'done' : 'waiting';
  const pillLabel = showChecked ? 'Na dziś gotowe' : 'Jeszcze bez znaku';

  const buttonLabel = !previewEnabled && !authReady
    ? '...'
    : showChecked
      ? 'Gotowe'
      : authBlocked
        ? 'Zaloguj'
        : 'Daj znak';

  // Button visual state
  const buttonDone = showChecked;
  const buttonDisabled = !canTriggerCheckin && !showChecked;

  const effectiveTodaySignals = previewEnabled && showChecked
    ? [{
        id: 'preview-signal-1',
        from_user_id: 'recipient-preview',
        to_user_id: 'preview-signaler',
        type: 'reaction' as const,
        emoji: '💛',
        message: null,
        created_at: new Date().toISOString(),
        seen_at: null,
      }]
    : todaySignals;

  return (
    <SafeAreaView style={s.container}>
      <UrgentConfirmation visible={showUrgentModal} onConfirm={handleUrgentConfirm} onCancel={() => setShowUrgentModal(false)} />

      <ScreenHeader subtitle={relationName} />

      {isOffline ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>Brak internetu</Text>
        </View>
      ) : null}

      {!previewEnabled && !authReady ? (
        <View style={s.badge}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={s.badgeText}>Łączymy z kontem…</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero: title + button + status ─── */}
        <View style={s.hero}>
          <Text style={s.heroTitle} maxFontSizeMultiplier={1.3}>{title}</Text>
          {subtitle ? <Text style={s.heroSubtitle} maxFontSizeMultiplier={1.4}>{subtitle}</Text> : null}

          <View style={s.buttonArea}>
            <Animated.View
              pointerEvents="none"
              style={[
                s.releaseRing,
                { opacity: releaseRingOpacity, transform: [{ scale: releaseRingScale }] },
              ]}
            />
            <Particles visible={celebrationVisible} count={12} colors={[Colors.safe, Colors.accent, '#E5B865']} />

            {checkinLoading && !showChecked ? (
              <View style={s.loadingCircle}>
                <ActivityIndicator size="large" color={Colors.safe} />
              </View>
            ) : (
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable
                  onPress={handleCheckin}
                  disabled={!canTriggerCheckin}
                  style={({ pressed }) => [
                    s.mainButton,
                    buttonDone && s.mainButtonDone,
                    buttonDisabled && s.mainButtonDisabled,
                    !buttonDone && !buttonDisabled && s.mainButtonActive,
                    pressed && canTriggerCheckin && { transform: [{ scale: 0.96 }], opacity: 0.94 },
                  ]}
                >
                  <Text
                    style={[
                      s.mainButtonText,
                      buttonDone && s.mainButtonTextDone,
                      buttonDisabled && s.mainButtonTextDisabled,
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {buttonLabel}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          <View style={s.metaRow}>
            <StatusPill variant={pillVariant} label={pillLabel} />
            {displayTime ? <Text style={s.timeText}>o {displayTime}</Text> : null}
          </View>
        </View>

        {/* ─── Responses ─── */}
        {showChecked ? (
          <ResponseChips signals={effectiveTodaySignals} circleNames={effectiveCircleNames} />
        ) : null}

        {/* ─── Urgent trigger (subtle) ─── */}
        <View style={s.urgentEntry}>
          <Pressable
            onPress={() => {
              if (!canTriggerSupport) {
                Alert.alert('Zaloguj ten telefon ponownie', 'Żeby wysłać pilny sygnał, ten telefon musi być połączony z kontem.');
                return;
              }
              setShowUrgentModal(true);
            }}
            style={({ pressed }) => [
              s.urgentTrigger,
              !canTriggerSupport && s.urgentTriggerDisabled,
              pressed && canTriggerSupport && { opacity: 0.85 },
            ]}
          >
            <Text style={s.urgentTriggerText}>Potrzebuję pomocy</Text>
            <Text style={s.urgentTriggerHint}>Wyśle pilny sygnał do bliskich</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const BUTTON_SIZE = 188;

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* badges */
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  /* scroll */
  scroll: {
    paddingHorizontal: Spacing.screen,
    paddingTop: 8,
    paddingBottom: 32,
  },

  /* hero — no card, just content on background */
  hero: {
    alignItems: 'center',
    paddingTop: 12,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    maxWidth: 300,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },

  /* main button */
  buttonArea: {
    justifyContent: 'center',
    alignItems: 'center',
    height: BUTTON_SIZE + 40,
    marginTop: 16,
  },
  releaseRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 20,
    height: BUTTON_SIZE + 20,
    borderRadius: (BUTTON_SIZE + 20) / 2,
    backgroundColor: Colors.safeLight,
  },
  loadingCircle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonActive: {
    backgroundColor: Colors.safe,
    ...Shadows.elevated,
    shadowColor: Colors.safe,
  },
  mainButtonDone: {
    backgroundColor: Colors.safeLight,
    borderWidth: 2,
    borderColor: Colors.safe,
  },
  mainButtonDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  mainButtonText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mainButtonTextDone: {
    color: Colors.safeStrong,
    fontSize: 22,
  },
  mainButtonTextDisabled: {
    color: Colors.textMuted,
    fontSize: 22,
  },

  /* meta row under button */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  /* response chips */
  responsesRow: {
    marginTop: 24,
  },
  responsesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.cardStrong,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  /* urgent entry — subtle, not a heavy card */
  urgentEntry: {
    marginTop: 32,
    alignItems: 'center',
  },
  urgentTrigger: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
  },
  urgentTriggerDisabled: {
    backgroundColor: Colors.surface,
    opacity: 0.6,
  },
  urgentTriggerText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.alertDark,
  },
  urgentTriggerHint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },

  /* ─── support / urgent full state ─── */
  supportScroll: {
    paddingHorizontal: Spacing.screen,
    paddingTop: 26,
    paddingBottom: 28,
  },
  urgentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.alert,
    marginBottom: 10,
  },
  urgentTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: Colors.text,
  },
  urgentBody: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 18,
  },
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.card,
    marginBottom: Spacing.sectionGap,
  },
  detailEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  urgentActions: {
    marginTop: 4,
  },
  urgentPrimary: {
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentPrimaryDisabled: {
    backgroundColor: Colors.disabled,
  },
  urgentPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  urgentSecondary: {
    height: 54,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    marginTop: 12,
  },
  urgentSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  cancelLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
