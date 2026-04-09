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
import { haptics } from '../utils/haptics';
import { openPhoneCall } from '../utils/linking';
import { supabase } from '../services/supabase';
import type { DailyCheckin, SupportParticipant as SParticipant } from '../types';
import type { RecipientHomePreview } from '../dev/homePreview';
import { formatClock, formatLocalDateKey } from '../utils/date';
import { relationDisplay, relationFor, relationFrom, relationTo } from '../utils/relationCopy';

/* ─── types & constants ─── */

type DayStatus = 'ok' | 'missing' | 'future';
const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
const EMOJIS = ['💛', '☀️', '🤗', '😘'];

function fmtTime(iso: string): string { return formatClock(iso) || '--:--'; }
function fmtRelative(localDate: string | null, checkedAt: string | null): string | null {
  if (!localDate || !checkedAt) return null;
  const today = formatLocalDateKey(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const time = fmtTime(checkedAt);
  if (localDate === today) return `dziś o ${time}`;
  if (localDate === formatLocalDateKey(y)) return `wczoraj o ${time}`;
  const [yr, mo, dy] = localDate.split('-');
  return `${dy}.${mo}.${yr} o ${time}`;
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

/* ─── Emoji row (no card) ─── */

function EmojiRow({ signalerName, signalerId, preview }: { signalerName: string; signalerId: string; preview: boolean }) {
  const { sendSignal } = useSignals();
  const [sentEmoji, setSentEmoji] = useState<string | null>(null);
  const sentOpacity = useRef(new Animated.Value(0)).current;
  const scales = useRef(EMOJIS.map(() => new Animated.Value(1))).current;

  const send = async (emoji: string, i: number) => {
    haptics.light();
    Animated.sequence([
      Animated.spring(scales[i], { toValue: 1.22, useNativeDriver: true, speed: 50, bounciness: 10 }),
      Animated.spring(scales[i], { toValue: 1, useNativeDriver: true, speed: 45, bounciness: 5 }),
    ]).start();
    try {
      if (!preview) await sendSignal(signalerId, emoji);
      setSentEmoji(emoji);
      sentOpacity.setValue(1);
      Animated.timing(sentOpacity, { toValue: 0, duration: 1800, delay: 500, useNativeDriver: true }).start(() => setSentEmoji(null));
    } catch { /* silent */ }
  };

  return (
    <View style={st.emojiSection}>
      <Text style={st.emojiHint}>Wyślij {relationTo(signalerName)} coś małego</Text>
      <View style={st.emojiRow}>
        {EMOJIS.map((e, i) => (
          <Animated.View key={e} style={{ transform: [{ scale: scales[i] }] }}>
            <Pressable onPress={() => send(e, i)} style={({ pressed }) => [st.emojiBtn, pressed && { opacity: 0.78 }]}>
              <Text style={st.emojiBtnText}>{e}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
      {sentEmoji ? <Animated.Text style={[st.sentToast, { opacity: sentOpacity }]}>Poszło {relationFor(signalerName)} {sentEmoji}</Animated.Text> : null}
    </View>
  );
}

/* ─── preview data ─── */

const PV_WEEK_OK: DayStatus[] = ['ok','ok','ok','ok','ok','ok','future'];
const PV_WEEK_MISS: DayStatus[] = ['ok','missing','ok','ok','ok','missing','future'];
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

  const [isOk, setIsOk] = useState(false);
  const [weekDots, setWeekDots] = useState<DayStatus[]>([]);
  const [todayTime, setTodayTime] = useState<string | null>(null);
  const [lastContact, setLastContact] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { setPreviewMode(preview); }, [preview]);

  /* ─── data ─── */

  const fetchData = useCallback(async () => {
    if (!sigId) return;
    try {
      const today = new Date();
      const ago = new Date(today); ago.setDate(today.getDate() - 6);
      const { data: checks } = await supabase.from('daily_checkins').select('*')
        .eq('senior_id', sigId).gte('local_date', formatLocalDateKey(ago)).lte('local_date', formatLocalDateKey(today))
        .order('local_date', { ascending: true });
      const rows = (checks || []) as DailyCheckin[];
      const dates = new Set(rows.map((r) => r.local_date));
      const todayStr = formatLocalDateKey(today);
      const w: DayStatus[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const ds = formatLocalDateKey(d);
        w.push(dates.has(ds) ? 'ok' : ds === todayStr ? 'future' : 'missing');
      }
      setWeekDots(w);
      const todayRow = rows.find((r) => r.local_date === todayStr);
      const latest = rows.length > 0 ? rows[rows.length - 1] : null;
      setTodayTime(todayRow ? fmtTime(todayRow.checked_at) : null);
      setLastContact(fmtRelative(latest?.local_date ?? null, latest?.checked_at ?? null));
      setIsOk(
        urgentCase?.viewerRole === 'primary' && currentAlert ? false
        : !!todayRow
      );
    } catch (e) { console.error('fetchData:', e); } finally { setDataLoading(false); }
  }, [sigId, urgentCase?.viewerRole, currentAlert]);

  useEffect(() => {
    if (pv) { setDataLoading(false); return; }
    if (sigId) fetchData(); else if (!circleLoading) setDataLoading(false);
  }, [pv, sigId, circleLoading, fetchData]);

  useEffect(() => {
    if (pv || !sigId) return;
    const ch = supabase.channel('r-checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_checkins', filter: `senior_id=eq.${sigId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pv, sigId, fetchData]);

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

  const pvUrgent = previewMode === 'support' ? {
    alert: { id: 'pa', senior_id: 'ps', type: 'sos' as const, state: 'acknowledged' as const,
      triggered_at: new Date().toISOString(), latitude: 49.62, longitude: 20.70,
      acknowledged_by: 'r', acknowledged_at: new Date().toISOString(), resolved_at: null },
    relationshipId: 'pr', viewerUserId: 'r', signalerId: 'ps', signalerName: 'Mama',
    primaryRecipientId: 'r', claimerId: 'r', claimerName: 'Ania', viewerRole: 'primary' as const, participants: PV_PARTICIPANTS,
  } : null;
  const effUrgent = pv ? pvUrgent : urgentCase;
  const effAlert = pv ? pvUrgent?.alert ?? null : currentAlert;

  if (effUrgent?.viewerRole === 'primary' && effAlert) {
    const claimed = !!effUrgent.claimerId;
    const byMe = effUrgent.claimerId === effUrgent.viewerUserId;
    return (
      <SafeAreaView style={st.container}>
        <ScreenHeader subtitle={relationFrom(effUrgent.signalerName)} />
        <ScrollView contentContainerStyle={st.urgentScroll} showsVerticalScrollIndicator={false}>
          <Text style={st.urgentLabel}>Pilne</Text>
          <Text style={st.urgentTitle} maxFontSizeMultiplier={1.3}>{relationDisplay(effUrgent.signalerName)} potrzebuje pomocy</Text>
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

  const effOk = previewMode === 'before' ? false : previewMode === 'after' || previewMode === 'response' ? true : isOk;
  const effTime = previewMode === 'after' || previewMode === 'response' ? '07:55' : todayTime;
  const effLast = previewMode === 'before' ? 'wczoraj o 19:40' : lastContact;
  const effWeek = previewMode === 'before' ? PV_WEEK_MISS : previewMode === 'after' || previewMode === 'response' ? PV_WEEK_OK : weekDots;
  const name = relationDisplay(sigName);

  const title = effOk ? 'Dziś znak już dotarł' : 'Jeszcze bez znaku';
  const sub = effOk
    ? effTime ? `o ${effTime}` : null
    : effLast ? `Ostatnio: ${effLast}` : null;

  return (
    <SafeAreaView style={st.container}>
      <ScreenHeader subtitle={relationFrom(sigName)} />
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={st.center}>
          {/* Avatar */}
          <Avatar name={name} ok={effOk ? true : null} />

          {/* Status */}
          <Text style={st.title} maxFontSizeMultiplier={1.3}>{title}</Text>
          {sub ? <Text style={st.sub}>{sub}</Text> : null}

          {/* Week dots */}
          {effWeek.length > 0 ? <View style={st.dotsWrap}><WeekDots days={effWeek} /></View> : null}

          {/* Emoji (only when sign received) */}
          {effOk && sigId ? <EmojiRow signalerName={name} signalerId={sigId} preview={pv} /> : null}
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
  dotsWrap: { marginTop: 20 },

  /* emoji */
  emojiSection: { alignItems: 'center', marginTop: 28 },
  emojiHint: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12 },
  emojiRow: { flexDirection: 'row', gap: 12 },
  emojiBtn: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Colors.cardStrong, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  emojiBtnText: { fontSize: 22 },
  sentToast: { marginTop: 10, fontSize: 14, fontWeight: '600', color: Colors.safe },

  /* bottom */
  bottomLink: { alignItems: 'center', paddingVertical: 20, marginBottom: 16 },
  bottomLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },

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
