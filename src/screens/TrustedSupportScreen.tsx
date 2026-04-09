import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Radius, Spacing } from '../constants/tokens';
import { SupportParticipants } from '../components/SupportParticipants';
import { useSOS } from '../hooks/useSOS';
import { openPhoneCall } from '../utils/linking';

function formatTime(isoString: string) {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function TrustedSupportScreen() {
  const router = useRouter();
  const { supportCase, currentAlert, loading, refreshing, acknowledgeSOS, resolveSOS } = useSOS();

  const handleClaim = async () => {
    if (!currentAlert) return;
    try { await acknowledgeSOS(currentAlert.id); }
    catch { Alert.alert('Coś poszło nie tak', 'Nie udało się przejąć.'); }
  };

  const handleResolve = async () => {
    if (!currentAlert) return;
    try { await resolveSOS(currentAlert.id); }
    catch { Alert.alert('Coś poszło nie tak', 'Nie udało się zamknąć.'); }
  };

  if (refreshing) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  /* ─── empty state ─── */

  if (!supportCase || !currentAlert) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.push('/settings')} style={({ pressed }) => [styles.topLink, pressed && { opacity: 0.65 }]}>
            <Text style={styles.topLinkText}>Ustawienia</Text>
          </Pressable>

          <Text style={styles.title}>Krąg bliskich</Text>
          <Text style={styles.subtitle}>Jeśli ktoś doda Cię do kręgu, zobaczysz tu pilne sygnały.</Text>

          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Teraz jest spokojnie</Text>
            <Text style={styles.emptyText}>Gdy ktoś z kręgu wyśle pilny sygnał, zobaczysz go tutaj.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ─── active support case ─── */

  const hasLocation = currentAlert.latitude != null && currentAlert.longitude != null;
  const isClaimed = !!supportCase.claimerId;
  const isClaimedByMe = supportCase.claimerId === supportCase.viewerUserId;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.urgentLabel}>Pilne</Text>
        <Text style={styles.urgentTitle}>{supportCase.signalerName} potrzebuje pomocy</Text>
        <Text style={styles.urgentBody}>
          {isClaimed
            ? isClaimedByMe
              ? 'Zajmujesz się tym.'
              : `${supportCase.claimerName} już się tym zajmuje.`
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
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryButtonText}>Zajmuję się tym</Text>
          </Pressable>
        ) : null}

        {isClaimedByMe ? (
          <Pressable
            onPress={handleResolve}
            disabled={loading}
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.secondaryButtonText}>Wszystko OK — zamknij</Text>
          </Pressable>
        ) : null}

        <SupportParticipants participants={supportCase.participants} />

        {isClaimedByMe && supportCase.participants[0]?.phone ? (
          <Pressable
            onPress={() => openPhoneCall(supportCase.participants[0].phone, 'Nie udało się połączyć.')}
            style={({ pressed }) => [styles.callLink, pressed && { opacity: 0.7 }]}
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
