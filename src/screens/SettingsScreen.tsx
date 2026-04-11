import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';

export function SettingsScreen() {
  const router = useRouter();
  const { profile, relationship, status } = useRelationship();
  const { signalers, recipients, loading: circleLoading } = useCircle();
  const { contacts } = useTrustedContacts(relationship?.id || null);

  const isRecipient = profile?.role === 'recipient';
  const circlePerson = isRecipient ? signalers[0] : recipients[0];
  // Fallback: use relationship label if circle data hasn't loaded yet
  const mainPersonName = circlePerson?.name || relationship?.signalerLabel || null;
  const mainPerson = circlePerson || (relationship && mainPersonName ? { name: mainPersonName } : null);
  const circleCount = contacts.length;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/onboarding');
    } catch {
      Alert.alert('Błąd', 'Nie udało się wylogować.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Ustawienia</Text>

        {/* ─── Circle summary ─── */}
        <Pressable
          onPress={() => router.push('/circle')}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.cardLabel}>Twój krąg</Text>
          {mainPerson ? (
            <View style={styles.circleRow}>
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>{(mainPerson.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.circleInfo}>
                <Text style={styles.cardValue}>{mainPerson.name}</Text>
                <Text style={styles.cardDetail}>
                  {isRecipient ? 'Codzienny znak' : 'Dostaje Twój znak'}
                  {circleCount > 0 ? ` · ${circleCount} w kręgu` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </View>
          ) : circleLoading ? (
            <Text style={styles.cardDetail}>Ładowanie...</Text>
          ) : (
            <Text style={styles.cardDetail}>
              {status === 'pending' ? 'Czeka na połączenie' : 'Jeszcze nie połączono'}
            </Text>
          )}
        </Pressable>

        {/* ─── Account ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Konto</Text>
          <Text style={styles.cardValue}>{profile?.name || 'Cmok'}</Text>
          {profile?.phone ? <Text style={styles.cardDetail}>{profile.phone}</Text> : null}
        </View>

        {/* ─── Reminder surface ─── */}
        {profile?.role === 'signaler' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Przypomnienie</Text>
            <Text style={styles.cardValue}>Codzienny znak</Text>
            <Text style={styles.cardDetail}>Powiadomienie przypominające o znaku — wkrótce.</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.logoutText}>Wyloguj ten telefon</Text>
        </Pressable>
        <Text style={styles.logoutHint}>Wyloguje tylko to urządzenie.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const MINI_AV = 36;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screen + 4, paddingTop: 16, paddingBottom: 32 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4, minHeight: 44, marginBottom: 20 },
  backText: { fontSize: 16, fontWeight: '500', color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 20 },
  card: {
    backgroundColor: Colors.cardStrong, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.card, marginBottom: 16,
  },
  cardLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 8 },
  cardValue: { fontSize: Typography.bodyLarge, fontFamily: Typography.fontFamilyBold, color: Colors.text },
  cardDetail: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  circleRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: MINI_AV, height: MINI_AV, borderRadius: MINI_AV / 2,
    backgroundColor: Colors.safeLight, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  miniAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.safe },
  circleInfo: { flex: 1 },
  chevron: { fontSize: 18, color: Colors.textMuted },
  logoutButton: {
    backgroundColor: Colors.surface, minHeight: 52, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  logoutText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  logoutHint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 10 },
});
