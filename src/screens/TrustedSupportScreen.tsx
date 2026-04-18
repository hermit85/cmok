import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { SupportParticipants } from '../components/SupportParticipants';
import { PostResolveShare } from '../components/PostResolveShare';
import { useUrgentSignal } from '../hooks/useUrgentSignal';
import { useRelationship } from '../hooks/useRelationship';
import { openPhoneCall } from '../utils/linking';
import { analytics } from '../services/analytics';
import { buildPeerShareUrl } from '../utils/invite';
import { useState } from 'react';

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function TrustedSupportScreen() {
  const router = useRouter();
  const { urgentCase, currentAlert, loading, refreshing, claim, resolve } = useUrgentSignal();
  const { profile } = useRelationship();
  const [postResolve, setPostResolve] = useState<{ name: string | null } | null>(null);

  const handleClaim = async () => {
    if (!currentAlert) return;
    try { await claim(currentAlert.id); }
    catch { Alert.alert('Coś poszło nie tak', 'Nie udało się przejąć.'); }
  };

  const handleResolve = async () => {
    if (!currentAlert) return;
    const signalerName = urgentCase?.signalerName ?? null;
    try {
      await resolve(currentAlert.id);
      // Capture the "hero moment" share right after resolve succeeds.
      setPostResolve({ name: signalerName });
    }
    catch { Alert.alert('Coś poszło nie tak', 'Nie udało się zamknąć.'); }
  };

  /* ─── Viral share handlers (empty state) ─── */
  // Only fire analytics when the user actually completes a share (not on
  // dismiss / cancel) — prevents inflated K-factor metrics from sheet-peeks.
  const handleShareSenior = async () => {
    const url = buildPeerShareUrl(profile?.id, 'peer_senior');
    const msg = `Znasz kogoś starszego, kto mieszka sam? cmok to codzienny znak, że wszystko OK. Jeden gest dziennie, spokój dla bliskich.\n\n${url}`;
    try {
      const result = await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
      if (result.action === Share.sharedAction) analytics.inviteShared('peer_senior');
    } catch { /* cancelled */ }
  };

  const handleShareFamily = async () => {
    const url = buildPeerShareUrl(profile?.id, 'peer_family');
    const msg = `Martwisz się o rodzica, babcię, dziadka? cmok daje codzienny znak, że wszystko u nich OK. Bez dzwonienia "czy żyjesz".\n\n${url}`;
    try {
      const result = await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
      if (result.action === Share.sharedAction) analytics.inviteShared('peer_family');
    } catch { /* cancelled */ }
  };

  if (refreshing) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  /* ─── empty state ─── */

  if (!urgentCase || !currentAlert) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Post-resolve celebration (rendered at empty state — SOS is over) */}
        <PostResolveShare
          visible={!!postResolve}
          role="trusted"
          signalerName={postResolve?.name ?? null}
          srcUserId={profile?.id}
          onDismiss={() => setPostResolve(null)}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.topLink, pressed && { opacity: 0.65 }]}
            accessibilityRole="link"
            accessibilityLabel="Otwórz ustawienia"
          >
            <Text style={styles.topLinkText}>Ustawienia</Text>
          </Pressable>

          <Text style={styles.title}>Jesteś na wezwanie</Text>
          <Text style={styles.subtitle}>Ktoś bliski ma Cię w swoim kręgu. Jeśli da znać, że coś się dzieje, zobaczysz to tutaj.</Text>

          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Teraz jest spokojnie</Text>
            <Text style={styles.emptyText}>Jeśli ktoś z kręgu da znać, że coś się dzieje, zobaczysz to tutaj.</Text>
          </View>

          {/* ─── Viral hub: keep trusted from being a dead-end ─── */}
          <Text style={styles.viralSectionLabel}>A u Ciebie?</Text>

          <Pressable
            onPress={handleShareSenior}
            style={({ pressed }) => [styles.viralCard, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Znasz kogoś samotnego? Podziel się cmok"
          >
            <Text style={styles.viralTitle}>Znasz kogoś, kto mieszka sam?</Text>
            <Text style={styles.viralBody}>
              cmok daje bliskim spokój, jednym gestem dziennie. Opowiedz koleżance, sąsiadce, bratu.
            </Text>
            <Text style={styles.viralCta}>Podziel się →</Text>
          </Pressable>

          <Pressable
            onPress={handleShareFamily}
            style={({ pressed }) => [styles.viralCardSoft, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Martwisz się o rodzica? Zobacz jak cmok może pomóc"
          >
            <Text style={styles.viralTitle}>Martwisz się o rodzica, babcię?</Text>
            <Text style={styles.viralBody}>
              cmok to codzienny znak od bliskiej osoby, że u niej wszystko OK. Bez dzwonienia „czy żyjesz".
            </Text>
            <Text style={styles.viralCtaSoft}>Poleć cmok →</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── active support case ─── */

  const hasLocation = currentAlert.latitude != null && currentAlert.longitude != null;
  const isClaimed = !!urgentCase.claimerId;
  const isClaimedByMe = urgentCase.claimerId === urgentCase.viewerUserId;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.urgentLabel}>Coś się dzieje</Text>
        <Text style={styles.urgentTitle}>{urgentCase.signalerName} daje znać</Text>
        <Text style={styles.urgentBody}>
          {isClaimed
            ? isClaimedByMe
              ? 'Zajmujesz się tym.'
              : `${urgentCase.claimerName} już się tym zajmuje.`
            : 'Nikt jeszcze nie odpowiedział.'}
        </Text>

        <View style={styles.detailCard}>
          <Text style={styles.detailEyebrow}>Szczegóły</Text>
          <Text style={styles.detailText}>Wysłano o {formatTime(currentAlert.triggered_at)}</Text>
          <Text style={styles.detailText}>
            {hasLocation ? 'Lokalizacja dołączona' : 'Bez lokalizacji'}
          </Text>
        </View>

        {!isClaimed ? (
          <Pressable
            onPress={handleClaim}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={`Zajmę się tym, powiadom ${urgentCase.signalerName}`}
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryButtonText}>Zajmuję się tym</Text>
          </Pressable>
        ) : null}

        {isClaimedByMe ? (
          <Pressable
            onPress={handleResolve}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Wszystko OK, zamknij sygnał"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.secondaryButtonText}>Wszystko OK, zamknij</Text>
          </Pressable>
        ) : null}

        <SupportParticipants participants={urgentCase.participants} />

        {isClaimedByMe && urgentCase.participants[0]?.phone ? (
          <Pressable
            onPress={() => openPhoneCall(urgentCase.participants[0].phone, 'Nie udało się połączyć.')}
            style={({ pressed }) => [styles.callLink, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
            accessibilityLabel={`Zadzwoń do ${urgentCase.signalerName}`}
          >
            <Text style={styles.callLinkText}>Zadzwoń</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingScreen: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: Spacing.screen, paddingTop: 18, paddingBottom: 28 },
  topLink: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', marginBottom: 12 },
  topLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginTop: 8, marginBottom: 20 },
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.card,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary },

  /* viral hub */
  viralSectionLabel: {
    fontSize: 12, fontFamily: Typography.headingFamilySemiBold,
    color: Colors.textMuted, marginTop: 32, marginBottom: 12,
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
  },
  viralCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 20, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.accent + '22',
  },
  viralCardSoft: {
    backgroundColor: Colors.safeLight,
    borderRadius: 20, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.safe + '22',
  },
  viralTitle: {
    fontSize: 16, fontFamily: Typography.headingFamilySemiBold,
    color: Colors.text, marginBottom: 6,
  },
  viralBody: {
    fontSize: 14, lineHeight: 20, color: Colors.textSecondary, marginBottom: 10,
  },
  viralCta: {
    fontSize: 14, fontFamily: Typography.headingFamilySemiBold,
    color: Colors.accent,
  },
  viralCtaSoft: {
    fontSize: 14, fontFamily: Typography.headingFamilySemiBold,
    color: Colors.safeStrong,
  },

  /* urgent state */
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
  primaryButton: {
    height: 56, borderRadius: Radius.sm, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryButton: {
    height: 52, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  callLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  callLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted, textDecorationLine: 'underline' },
});
