import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useRelationship } from '../hooks/useRelationship';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';

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
    } catch {
      /* silent */
    }
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
        <Text style={styles.title}>Pokaż ten kod{'\n'}drugiej osobie</Text>

        {relationship.inviteCode ? (
          <Pressable onPress={handleCopyCode} style={({ pressed }) => [styles.codeFrame, pressed && { opacity: 0.85 }]}>
            <Text style={styles.codeValue}>{relationship.inviteCode}</Text>
            <Text style={styles.copyHint}>Stuknij, żeby skopiować</Text>
          </Pressable>
        ) : null}

        <Text style={styles.helperText}>
          {relationship.signalerLabel
            ? `Kod dla: ${relationship.signalerLabel}`
            : 'Połączycie się automatycznie.'}
        </Text>

        <Pressable
          onPress={refreshRelationship}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.refreshBtnText}>Odśwież</Text>
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
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, textAlign: 'center', marginBottom: 24, lineHeight: 34 },
  codeFrame: {
    backgroundColor: Colors.cardStrong,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 24,
    paddingHorizontal: 40,
    marginBottom: 16,
    alignItems: 'center',
  },
  codeValue: { fontSize: 42, fontWeight: '700', color: Colors.text, letterSpacing: 8 },
  copyHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  helperText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  refreshBtn: {
    backgroundColor: Colors.accent,
    minHeight: 56,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  refreshBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
