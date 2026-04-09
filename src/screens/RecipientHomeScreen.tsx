import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusPill } from '../components/StatusPill';
import { SupportParticipants } from '../components/SupportParticipants';
import { Colors } from '../constants/colors';
import { Radius, Spacing } from '../constants/tokens';
import { useCircle } from '../hooks/useCircle';
import { useSignals } from '../hooks/useSignals';
import { useUrgentSignal } from '../hooks/useUrgentSignal';
import { haptics } from '../utils/haptics';
import { openPhoneCall } from '../utils/linking';
import { supabase } from '../services/supabase';
import type { DailyCheckin, SupportParticipant as SupportParticipantType } from '../types';
import type { RecipientHomePreview } from '../dev/homePreview';
import { formatClock, formatLocalDateKey } from '../utils/date';
import { relationDisplay, relationFor, relationFrom, relationTo } from '../utils/relationCopy';

/* ─── types ─── */

type SignalerStatus = 'ok' | 'missing' | 'sos';
type DayStatus = 'ok' | 'missing' | 'future';

/* ─── constants ─── */

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
const SIGNALS = [
  { emoji: '💛', label: 'ciepło' },
  { emoji: '☀️', label: 'spokój' },
  { emoji: '🤗', label: 'uścisk' },
  { emoji: '😘', label: 'cmok' },
];

/* ─── helpers ─── */

function formatTime(isoString: string): string {
  return formatClock(isoString) || '--:--';
}

function formatRelativeMoment(localDate: string | null, checkedAt: string | null): string | null {
  if (!localDate || !checkedAt) return null;
  const today = formatLocalDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayLabel = formatLocalDateKey(yesterday);
  const time = formatTime(checkedAt);
  if (localDate === today) return `dziś o ${time}`;
  if (localDate === yesterdayLabel) return `wczoraj o ${time}`;
  const [year, month, day] = localDate.split('-');
  if (!year || !month || !day) return `${localDate} o ${time}`;
  return `${day}.${month}.${year} o ${time}`;
}

/* ─── sub-components ─── */

function NameAvatar({ name, status }: { name: string; status: SignalerStatus }) {
  const letter = (name || '?').charAt(0).toUpperCase();
  const dotColor = status === 'ok' ? Colors.safe : status === 'missing' ? Colors.accent : Colors.alert;
  return (
    <View style={st.avatar}>
      <Text style={st.avatarText}>{letter}</Text>
      <View style={[st.statusDot, { backgroundColor: dotColor }]} />
    </View>
  );
}

function ContinuityRow({ weekData }: { weekData: Array<{ day: string; status: DayStatus }> }) {
  return (
    <View style={st.continuityRow}>
      {weekData.map((item, index) => {
        const isOk = item.status === 'ok';
        const isMissing = item.status === 'missing';
        return (
          <View key={`${item.day}-${index}`} style={st.dayItem}>
            <View style={[st.dayMark, isOk && st.dayMarkOk, isMissing && st.dayMarkMissing]} />
            <Text style={st.dayLabel}>{item.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

function EmojiSignalPanel({
  signalerName,
  signalerId,
  preview = false,
}: {
  signalerName: string;
  signalerId: string;
  preview?: boolean;
}) {
  const { sendSignal } = useSignals();
  const [sentText, setSentText] = useState<string | null>(null);
  const sentOpacity = useRef(new Animated.Value(0)).current;
  const emojiScales = useRef(SIGNALS.map(() => new Animated.Value(1))).current;

  const handleSend = async (emoji: string, index: number) => {
    haptics.light();
    Animated.sequence([
      Animated.spring(emojiScales[index], { toValue: 1.22, useNativeDriver: true, speed: 50, bounciness: 10 }),
      Animated.spring(emojiScales[index], { toValue: 1, useNativeDriver: true, speed: 45, bounciness: 5 }),
    ]).start();
    try {
      if (!preview) await sendSignal(signalerId, emoji);
      setSentText(`${emoji}`);
      sentOpacity.setValue(1);
      Animated.timing(sentOpacity, { toValue: 0, duration: 1800, delay: 500, useNativeDriver: true })
        .start(() => setSentText(null));
    } catch {
      /* silent */
    }
  };

  return (
    <View style={st.replySection}>
      <Text style={st.replyHint}>Wyślij {relationTo(signalerName)} coś małego</Text>
      <View style={st.emojiRow}>
        {SIGNALS.map((item, index) => (
          <Animated.View key={item.label} style={{ transform: [{ scale: emojiScales[index] }] }}>
            <Pressable
              onPress={() => handleSend(item.emoji, index)}
              style={({ pressed }) => [st.emojiButton, pressed && { opacity: 0.78 }]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={st.emojiButtonText}>{item.emoji}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
      {sentText ? (
        <Animated.Text style={[st.sentToast, { opacity: sentOpacity }]}>
          Poszło {relationFor(signalerName)} {sentText}
        </Animated.Text>
      ) : null}
    </View>
  );
}

/* ─── preview data ─── */

const PREVIEW_WEEK_AFTER: Array<{ day: string; status: DayStatus }> = [
  { day: 'Pt', status: 'ok' }, { day: 'So', status: 'ok' }, { day: 'Nd', status: 'ok' },
  { day: 'Pn', status: 'ok' }, { day: 'Wt', status: 'ok' }, { day: 'Śr', status: 'ok' },
  { day: 'Cz', status: 'future' },
];
const PREVIEW_WEEK_BEFORE: Array<{ day: string; status: DayStatus }> = [
  { day: 'Pt', status: 'ok' }, { day: 'So', status: 'missing' }, { day: 'Nd', status: 'ok' },
  { day: 'Pn', status: 'ok' }, { day: 'Wt', status: 'ok' }, { day: 'Śr', status: 'missing' },
  { day: 'Cz', status: 'future' },
];
const PREVIEW_SUPPORT_PARTICIPANTS: SupportParticipantType[] = [
  { userId: 'recipient-preview', name: 'Ania', phone: '+48600100400', kind: 'primary', deliveryStatus: 'sent', isClaimedBy: true },
  { userId: 'trusted-preview', name: 'Ela', phone: '+48600100300', kind: 'trusted', deliveryStatus: 'sent', isClaimedBy: false },
];

/* ─── main component ─── */

export function RecipientHomeScreen({ preview = null }: { preview?: RecipientHomePreview | null }) {
  const router = useRouter();
  const { signalers, loading: circleLoading } = useCircle();
  const { urgentCase, currentAlert, claim, resolve, loading: urgentLoading } = useUrgentSignal();

  const signaler = signalers[0] || null;
  const [previewMode, setPreviewMode] = useState<RecipientHomePreview | null>(preview);
  const previewEnabled = __DEV__ && !!previewMode;
  const previewSignalerName = 'Mama';
  const signalerName = previewEnabled ? previewSignalerName : signaler?.name || null;
  const signalerId = previewEnabled ? 'preview-signaler' : signaler?.userId || null;
  const callPhone = previewEnabled ? '+48600100200' : signaler?.phone || '';

  const [signalerStatus, setSignalerStatus] = useState<SignalerStatus>('ok');
  const [weekData, setWeekData] = useState<Array<{ day: string; status: DayStatus }>>([]);
  const [todayCheckinTime, setTodayCheckinTime] = useState<string | null>(null);
  const [lastContactText, setLastContactText] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  /* ─── data fetching (unchanged logic) ─── */

  const fetchData = useCallback(async () => {
    if (!signalerId) return;
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('senior_id', signalerId)
        .gte('local_date', formatLocalDateKey(sevenDaysAgo))
        .lte('local_date', formatLocalDateKey(today))
        .order('local_date', { ascending: true });

      const normalizedCheckins = (checkins || []) as DailyCheckin[];
      const checkinDates = new Set(normalizedCheckins.map((c) => c.local_date));
      const todayStr = formatLocalDateKey(today);
      const week: Array<{ day: string; status: DayStatus }> = [];

      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = formatLocalDateKey(d);
        const dayLabel = DAY_LABELS[d.getDay()];
        if (checkinDates.has(dateStr)) week.push({ day: dayLabel, status: 'ok' });
        else if (dateStr === todayStr) week.push({ day: dayLabel, status: 'future' });
        else week.push({ day: dayLabel, status: 'missing' });
      }
      setWeekData(week);

      const todayCheckin = normalizedCheckins.find((c) => c.local_date === todayStr) || null;
      const latestCheckin = normalizedCheckins.length > 0 ? normalizedCheckins[normalizedCheckins.length - 1] : null;

      setTodayCheckinTime(todayCheckin ? formatTime(todayCheckin.checked_at) : null);
      setLastContactText(formatRelativeMoment(latestCheckin?.local_date ?? null, latestCheckin?.checked_at ?? null));
      setSignalerStatus(urgentCase?.viewerRole === 'primary' && currentAlert ? 'sos' : todayCheckin ? 'ok' : 'missing');
    } catch (error) {
      console.error('fetchData error:', error);
    } finally {
      setDataLoading(false);
    }
  }, [signalerId, urgentCase?.viewerRole, currentAlert]);

  useEffect(() => {
    if (previewEnabled) { setDataLoading(false); return; }
    if (signalerId) fetchData();
    else if (!circleLoading) setDataLoading(false);
  }, [previewEnabled, signalerId, circleLoading, fetchData]);

  useEffect(() => {
    if (previewEnabled || !signalerId) return;
    const channel = supabase
      .channel('recipient-checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_checkins', filter: `senior_id=eq.${signalerId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [previewEnabled, signalerId, fetchData]);

  /* ─── handlers ─── */

  const handleCall = async () => {
    await openPhoneCall(callPhone, 'Nie udało się wykonać połączenia.');
  };

  const handleAcknowledge = async () => {
    if (!currentAlert) return;
    try { await claim(currentAlert.id); }
    catch { Alert.alert('Coś poszło nie tak', 'Nie udało się przejąć.'); }
  };

  const handleResolve = async () => {
    if (!currentAlert) return;
    try { await resolve(currentAlert.id); }
    catch { Alert.alert('Coś poszło nie tak', 'Nie udało się zamknąć.'); }
  };

  /* ─── loading ─── */

  if (!previewEnabled && (circleLoading || dataLoading)) {
    return (
      <SafeAreaView style={st.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  /* ─── empty / no connection ─── */

  if (!previewEnabled && !signalerId) {
    return (
      <SafeAreaView style={st.container}>
        <ScreenHeader subtitle={relationFrom(signalerName)} />
        <View style={st.emptyState}>
          <Text style={st.emptyTitle}>Nie ma jeszcze połączenia</Text>
          <Text style={st.emptyText}>Połącz się z bliską osobą, żeby widzieć codzienny znak.</Text>
          <Pressable
            onPress={() => router.replace('/onboarding')}
            style={({ pressed }) => [st.emptyCta, pressed && { opacity: 0.85 }]}
          >
            <Text style={st.emptyCtaText}>Połącz się</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── support state ─── */

  const previewSupportCase = previewMode === 'support' ? {
    alert: {
      id: 'preview-alert', senior_id: 'preview-signaler', type: 'sos' as const,
      state: 'acknowledged' as const, triggered_at: new Date().toISOString(),
      latitude: 49.6218, longitude: 20.6971, acknowledged_by: 'recipient-preview',
      acknowledged_at: new Date().toISOString(), resolved_at: null,
    },
    relationshipId: 'preview-relationship', viewerUserId: 'recipient-preview',
    signalerId: 'preview-signaler', signalerName: previewSignalerName,
    primaryRecipientId: 'recipient-preview', claimerId: 'recipient-preview',
    claimerName: 'Ania', viewerRole: 'primary' as const,
    participants: PREVIEW_SUPPORT_PARTICIPANTS,
  } : null;

  const effectiveSupportCase = previewEnabled ? previewSupportCase : urgentCase;
  const effectiveAlert = previewEnabled ? previewSupportCase?.alert ?? null : currentAlert;

  if (effectiveSupportCase?.viewerRole === 'primary' && effectiveAlert) {
    const hasLocation = effectiveAlert.latitude != null && effectiveAlert.longitude != null;
    const isClaimed = !!effectiveSupportCase.claimerId;
    const isClaimedByMe = effectiveSupportCase.claimerId === effectiveSupportCase.viewerUserId;

    return (
      <SafeAreaView style={st.container}>
        <ScreenHeader subtitle={relationFrom(effectiveSupportCase.signalerName)} />
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          <Text style={st.urgentLabel}>Pilne</Text>
          <Text style={st.urgentTitle}>
            {relationDisplay(effectiveSupportCase.signalerName)} potrzebuje pomocy
          </Text>
          <Text style={st.urgentBody}>
            {isClaimed
              ? isClaimedByMe
                ? 'Zajmujesz się tym.'
                : `${effectiveSupportCase.claimerName} już się tym zajmuje.`
              : 'Nikt jeszcze nie odpowiedział.'}
          </Text>

          <View style={st.detailCard}>
            <Text style={st.detailEyebrow}>Szczegóły</Text>
            <Text style={st.detailText}>Wysłano o {formatTime(effectiveAlert.triggered_at)}</Text>
            <Text style={st.detailText}>
              {hasLocation ? 'Lokalizacja dołączona' : 'Bez lokalizacji'}
            </Text>
          </View>

          <View style={st.claimSection}>
            {!isClaimed ? (
              <Pressable
                onPress={handleAcknowledge}
                disabled={urgentLoading}
                style={({ pressed }) => [st.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={st.primaryBtnText}>Zajmuję się tym</Text>
              </Pressable>
            ) : null}
            {isClaimedByMe ? (
              <Pressable
                onPress={handleResolve}
                disabled={urgentLoading}
                style={({ pressed }) => [st.secondaryBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={st.secondaryBtnText}>Wszystko OK — zamknij</Text>
              </Pressable>
            ) : null}
          </View>

          <SupportParticipants participants={effectiveSupportCase.participants} />

          <View style={st.bottomActions}>
            <Pressable
              onPress={handleCall}
              style={({ pressed }) => [st.textLink, pressed && { opacity: 0.7 }]}
            >
              <Text style={st.textLinkLabel}>Zadzwoń {relationTo(signalerName)}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/trusted-contacts')}
              style={({ pressed }) => [st.textLink, pressed && { opacity: 0.7 }]}
            >
              <Text style={st.textLinkLabel}>Osoby w kręgu</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── daily view ─── */

  const effectiveStatus = previewMode === 'before' ? 'missing'
    : previewMode === 'after' || previewMode === 'response' ? 'ok'
    : signalerStatus;
  const effectiveTime = previewMode === 'after' || previewMode === 'response' ? '07:55' : todayCheckinTime;
  const effectiveLastContact = previewMode === 'before' ? 'wczoraj o 19:40' : lastContactText;
  const effectiveWeek = previewMode === 'before' ? PREVIEW_WEEK_BEFORE
    : previewMode === 'after' || previewMode === 'response' ? PREVIEW_WEEK_AFTER
    : weekData;

  const name = relationDisplay(signalerName);
  const isOk = effectiveStatus === 'ok';

  const title = isOk
    ? `Dziś znak już dotarł`
    : 'Jeszcze bez znaku';

  const subtitle = isOk
    ? `Dotarł o ${effectiveTime}. Możesz odetchnąć.`
    : effectiveLastContact
      ? `Ostatnio: ${effectiveLastContact}`
      : 'To może być zwykły dzień.';

  const pillVariant = isOk ? 'ok' : 'missing';
  const pillLabel = isOk ? 'Spokojnie' : 'Jeszcze chwila';

  return (
    <SafeAreaView style={st.container}>
      <ScreenHeader subtitle={relationFrom(signalerName)} />

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── Avatar + name ─── */}
        <View style={st.personRow}>
          <NameAvatar name={name} status={effectiveStatus} />
          <Text style={st.personName}>{name}</Text>
        </View>

        {/* ─── Main status ─── */}
        <Text style={st.title} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={st.subtitle} maxFontSizeMultiplier={1.4}>{subtitle}</Text>

        <View style={st.metaRow}>
          <StatusPill variant={pillVariant} label={pillLabel} />
          {effectiveTime ? <Text style={st.timeText}>o {effectiveTime}</Text> : null}
        </View>

        {/* ─── Continuity (background element) ─── */}
        <View style={st.continuitySection}>
          <ContinuityRow weekData={effectiveWeek} />
        </View>

        {/* ─── Emoji response ─── */}
        {isOk && signalerId ? (
          <EmojiSignalPanel signalerName={name} signalerId={signalerId} preview={previewEnabled} />
        ) : null}

        {/* ─── Bottom: subtle emergency ─── */}
        <View style={st.bottomSection}>
          <Text style={st.bottomLabel}>W razie czego</Text>
          <View style={st.bottomRow}>
            <Pressable
              onPress={handleCall}
              style={({ pressed }) => [st.bottomCard, pressed && { opacity: 0.84 }]}
            >
              <Text style={st.bottomCardText}>Zadzwoń {relationTo(signalerName)}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/trusted-contacts')}
              style={({ pressed }) => [st.bottomCard, pressed && { opacity: 0.84 }]}
            >
              <Text style={st.bottomCardText}>Osoby w kręgu</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.screen, paddingTop: 4, paddingBottom: 32 },

  /* person */
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.safeLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: Colors.safe },
  statusDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2.5, borderColor: Colors.background,
  },
  personName: { fontSize: 22, fontWeight: '700', color: Colors.text },

  /* main content */
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginTop: 6, maxWidth: 300 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  timeText: { fontSize: 13, color: Colors.textMuted },

  /* continuity */
  continuitySection: {
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  continuityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayItem: { alignItems: 'center', gap: 6 },
  dayMark: { width: 28, height: 10, borderRadius: Radius.pill, backgroundColor: '#ECE6DF' },
  dayMarkOk: { backgroundColor: Colors.safe },
  dayMarkMissing: { backgroundColor: Colors.surface },
  dayLabel: { fontSize: 11, color: Colors.textMuted },

  /* emoji reply */
  replySection: { marginTop: 20 },
  replyHint: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  emojiRow: { flexDirection: 'row', gap: 10 },
  emojiButton: {
    width: 56, height: 56, borderRadius: Radius.sm,
    backgroundColor: Colors.cardStrong, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  emojiButtonText: { fontSize: 24 },
  sentToast: { marginTop: 10, fontSize: 14, fontWeight: '600', color: Colors.safe, textAlign: 'center' },

  /* bottom / emergency */
  bottomSection: { marginTop: 28 },
  bottomLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 10 },
  bottomRow: { flexDirection: 'row', gap: 10 },
  bottomCard: {
    flex: 1, backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  bottomCardText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

  /* support / urgent state */
  urgentLabel: { fontSize: 13, fontWeight: '700', color: Colors.alert, marginBottom: 10 },
  urgentTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: Colors.text },
  urgentBody: { fontSize: 16, lineHeight: 24, color: Colors.textSecondary, marginTop: 8, marginBottom: 18 },
  detailCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.card, marginBottom: Spacing.sectionGap,
  },
  detailEyebrow: { fontSize: 12, fontWeight: '600', color: Colors.accent, marginBottom: 8 },
  detailText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 4 },
  claimSection: { marginBottom: 14 },
  primaryBtn: {
    height: 56, borderRadius: Radius.sm, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryBtn: {
    height: 52, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 10,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  bottomActions: { marginTop: 8, gap: 4 },
  textLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  textLinkLabel: { fontSize: 14, fontWeight: '600', color: Colors.textMuted, textDecorationLine: 'underline' },

  /* empty state */
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  emptyCta: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: Radius.sm,
    paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center',
  },
  emptyCtaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
