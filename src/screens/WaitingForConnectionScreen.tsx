import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useRelationship } from '../hooks/useRelationship';
import { shareInvite } from '../utils/invite';
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
      <Text style={styles.miniLogo}>Cmok</Text>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>Prawie gotowe</Text>
        <Text style={styles.title}>Zaproś{'\n'}{relationship.signalerLabel || 'bliską osobę'}</Text>
        <Text style={styles.subtitle}>Wyślij kod lub pokaż go na tym ekranie.</Text>

        {relationship.inviteCode ? (
          <Pressable onPress={handleCopyCode} style={({ pressed }) => [styles.codeFrame, pressed && { opacity: 0.85 }]}>
            <Text style={styles.codeValue}>{relationship.inviteCode}</Text>
            <Text style={styles.copyHint}>Stuknij, żeby skopiować</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.shareBtnText}>Wyślij zaproszenie</Text>
        </Pressable>

        <Pressable
          onPress={refreshRelationship}
          style={({ pressed }) => [styles.refreshLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.refreshLinkText}>Odśwież status</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  miniLogo: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: Colors.accent, paddingHorizontal: 28, paddingTop: 16 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  eyebrow: { fontSize: Typography.caption, fontFamily: Typography.fontFamilyBold, color: Colors.accentStrong, marginBottom: 10 },
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, textAlign: 'center', marginBottom: 12, lineHeight: 34 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  codeFrame: {
    backgroundColor: Colors.cardStrong, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 24, paddingHorizontal: 40,
    marginBottom: 20, alignItems: 'center',
  },
  codeValue: { fontSize: 42, fontWeight: '700', color: Colors.text, letterSpacing: 8 },
  copyHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 56, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', width: '100%',
  },
  shareBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  refreshLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  refreshLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
