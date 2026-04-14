import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useRelationship } from '../hooks/useRelationship';
import { shareInvite, logInviteEvent } from '../utils/invite';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius } from '../constants/tokens';

export function WaitingForConnectionScreen() {
  const router = useRouter();
  const { loading, profile, relationship, status, refreshRelationship } = useRelationship();

  useEffect(() => {
    if (!loading && status === 'active' && profile?.role === 'recipient') {
      router.replace('/recipient-home');
    }
    if (!loading && (profile?.role !== 'recipient' || status === 'none')) {
      router.replace('/onboarding');
    }
  }, [loading, profile?.role, router, status]);

  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(() => { refreshRelationship(); }, 5000);
    return () => clearInterval(interval);
  }, [refreshRelationship, status]);

  const handleCopyCode = async () => {
    if (!relationship?.inviteCode) return;
    try {
      await Clipboard.setStringAsync(relationship.inviteCode);
      logInviteEvent('invite_code_copied', { code: relationship.inviteCode });
      Alert.alert('Skopiowano', 'Kod jest w schowku.');
    } catch { /* silent */ }
  };

  const handleShare = async () => {
    if (!relationship?.inviteCode) return;
    await shareInvite({
      code: relationship.inviteCode,
      signalerLabel: relationship.signalerLabel,
    });
  };

  if (loading || profile?.role !== 'recipient' || status !== 'pending' || !relationship) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.miniLogo}>cmok</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>Prawie gotowe</Text>
        <Text style={styles.title}>Wyślij kod do{'\n'}{relationship.signalerLabel || 'bliskiej osoby'}</Text>
        <Text style={styles.subtitle}>
          Pokaż ten kod lub wyślij go.{'\n'}
          Gdy {relationship.signalerLabel || 'bliska osoba'} go wpisze, połączycie się.
        </Text>

        {relationship.inviteCode ? (
          <Pressable onPress={handleCopyCode} style={({ pressed }) => [styles.codeFrame, pressed && { opacity: 0.85 }]}>
            <Text style={styles.codeValue}>{relationship.inviteCode}</Text>
            <Text style={styles.copyHint}>Stuknij, żeby skopiować</Text>
            {relationship.inviteExpiresAt ? (
              <Text style={styles.expiryHint}>
                Kod ważny do {new Date(relationship.inviteExpiresAt).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.shareBtnText}>Wyślij zaproszenie</Text>
        </Pressable>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Gdy tylko się połączycie, zaczniecie Wasz codzienny cmok.
            Damy Ci znać, gdy {relationship.signalerLabel || 'bliska osoba'} dołączy.
          </Text>
        </View>

        <Pressable
          onPress={refreshRelationship}
          style={({ pressed }) => [styles.refreshLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.refreshLinkText}>Sprawdź teraz</Text>
        </Pressable>

        <View style={styles.bottomActions}>
          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/onboarding');
            }}
            style={({ pressed }) => [styles.bottomLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.bottomLinkText}>Wyloguj</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Alert.alert('Usunąć konto?', 'Wszystkie dane zostaną trwale usunięte.', [
                { text: 'Anuluj', style: 'cancel' },
                {
                  text: 'Usuń konto', style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
                      if (error) throw error;
                      await supabase.auth.signOut();
                      router.replace('/onboarding');
                    } catch { Alert.alert('Błąd', 'Nie udało się usunąć konta. Spróbuj ponownie.'); }
                  },
                },
              ]);
            }}
            style={({ pressed }) => [styles.bottomLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.deleteText}>Usuń konto</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  topBar: { paddingHorizontal: 28, paddingTop: 16 },
  miniLogo: { fontSize: 16, fontFamily: Typography.headingFamily, color: Colors.accent, marginBottom: 8 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  eyebrow: { fontSize: Typography.caption, fontFamily: Typography.headingFamily, color: Colors.accentStrong, marginBottom: 10 },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, textAlign: 'center', marginBottom: 12, lineHeight: 34 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  codeFrame: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingVertical: 24, paddingHorizontal: 40,
    marginBottom: 20, alignItems: 'center',
  },
  codeValue: { fontSize: 36, fontFamily: Typography.headingFamily, color: Colors.text, letterSpacing: 8 },
  copyHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  expiryHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 56, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', width: '100%',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 5,
  },
  shareBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  infoBox: {
    marginTop: 20, paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 14, backgroundColor: Colors.safeLight, alignItems: 'center',
  },
  infoText: { fontSize: 13, color: Colors.safeStrong, textAlign: 'center', lineHeight: 20 },
  refreshLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  refreshLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  bottomActions: { marginTop: 32, alignItems: 'center', gap: 12 },
  bottomLink: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  bottomLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  deleteText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.alert },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 8, minHeight: 44, marginBottom: 8, marginLeft: -8 },
  backText: { fontSize: 16, fontWeight: '500', color: Colors.accent },
});
