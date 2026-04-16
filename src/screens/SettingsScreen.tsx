import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { analytics } from '../services/analytics';

export function SettingsScreen() {
  const router = useRouter();
  const { profile, relationship, status, refreshRelationship } = useRelationship();
  const { signalers, recipients, loading: circleLoading } = useCircle();
  const { contacts } = useTrustedContacts(relationship?.id || null);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const isRecipient = profile?.role === 'recipient';
  const isSignaler = profile?.role === 'signaler';
  const circlePerson = isRecipient ? signalers[0] : recipients[0];
  const mainPersonName = circlePerson?.name || relationship?.signalerLabel || null;
  const mainPerson = circlePerson || (relationship && mainPersonName ? { name: mainPersonName } : null);
  const circleCount = contacts.length;
  const isActive = status === 'active';

  const displayPhone = profile?.phone
    ? profile.phone.replace(/^48/, '+48 ').replace(/(\d{3})(?=\d)/g, '$1 ')
    : '';

  /* ─── Edit name ─── */
  const startEditName = () => {
    setNameValue(profile?.name || '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || !profile?.id) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from('users').update({ name: trimmed }).eq('id', profile.id);
      if (error) throw error;
      setEditingName(false);
      analytics.nameChanged();
      refreshRelationship?.();
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się zapisać imienia.');
    } finally {
      setSavingName(false);
    }
  };

  /* ─── Delete account ─── */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Usunąć konto?',
      'Wszystkie Twoje dane zostaną trwale usunięte. Tej operacji nie można cofnąć.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń konto',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: result, error: invokeErr } = await supabase.functions.invoke('delete-account', { body: {} });
              if (invokeErr || !result?.ok) {
                Alert.alert('Coś poszło nie tak', 'Nie udało się usunąć konta. Spróbuj ponownie.');
                return;
              }
              analytics.accountDeleted();
              await supabase.auth.signOut();
              router.replace('/onboarding');
            } catch {
              Alert.alert('Coś poszło nie tak', 'Nie udało się usunąć konta. Sprawdź połączenie.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    try {
      analytics.loggedOut();
      await supabase.auth.signOut();
      router.replace('/onboarding');
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wylogować.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Ustawienia</Text>

        {/* ─── Main relationship ─── */}
        <Pressable
          onPress={() => router.push('/circle')}
          style={({ pressed }) => [styles.card, styles.relationCard, pressed && { opacity: 0.88 }]}
        >
          {mainPerson ? (
            <View style={styles.circleRow}>
              <View style={styles.relationAvatar}>
                <Text style={styles.relationAvatarText}>{(mainPerson.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.circleInfo}>
                <Text style={styles.relationName}>{mainPerson.name}</Text>
                <Text style={styles.relationRole}>
                  {isRecipient ? 'Daje Ci codzienny znak' : 'Dostaje Twój codzienny znak'}
                </Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </View>
          ) : circleLoading ? (
            <Text style={styles.cardDetail}>Sprawdzamy połączenie…</Text>
          ) : (
            <Text style={styles.cardDetail}>
              {status === 'pending' ? 'Czeka na połączenie' : 'Jeszcze nie połączono'}
            </Text>
          )}
        </Pressable>

        {/* ─── Safety circle (trusted contacts) ─── */}
        {status === 'active' ? (
          <Pressable
            onPress={() => router.push('/trusted-contacts')}
            style={({ pressed }) => [styles.card, styles.safetyCard, pressed && { opacity: 0.88 }]}
          >
            <View style={styles.circleRow}>
              <View style={styles.safetyIcon}>
                <Text style={styles.safetyIconText}>+</Text>
              </View>
              <View style={styles.circleInfo}>
                <Text style={styles.safetyTitle}>
                  {circleCount > 0
                    ? `${circleCount} ${circleCount === 1 ? 'osoba w kręgu bliskich' : 'osób w kręgu bliskich'}`
                    : 'Krąg bliskich'}
                </Text>
                <Text style={styles.safetySubtitle}>
                  {circleCount > 0
                    ? 'Dotkni\u0119cie, żeby zobaczyć lub dodać kolejną osobę'
                    : 'Dodaj sąsiada lub kogoś zaufanego, dostaną wiadomość gdy poprosisz o pomoc'}
                </Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </View>
          </Pressable>
        ) : null}

        {/* ─── Account with editable name ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Twoje konto</Text>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.nameInput}
                value={nameValue}
                onChangeText={setNameValue}
                autoFocus
                maxLength={30}
                placeholder="Twoje imię"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              {savingName ? (
                <ActivityIndicator size="small" color={Colors.safe} />
              ) : (
                <Pressable onPress={saveName} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.saveBtnText}>Zapisz</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable onPress={startEditName} style={({ pressed }) => [styles.nameRow, pressed && { opacity: 0.7 }]}>
              <Text style={styles.cardValue}>{profile?.name || 'Ustaw imię'}</Text>
              <Text style={styles.editHint}>Zmień</Text>
            </Pressable>
          )}
          {displayPhone ? <Text style={styles.cardDetail}>{displayPhone}</Text> : null}
          {isRecipient || isSignaler ? (
            <Text style={styles.roleTag}>
              {isRecipient ? 'Dostajesz codzienny znak' : 'Dajesz codzienny znak'}
            </Text>
          ) : null}
        </View>

        {/* Reminder — hidden until backend integration is ready */}

        {/* ─── Legal center ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Prawne</Text>
          <Pressable onPress={() => Linking.openURL('https://cmok.app/regulamin')} style={({ pressed }) => [styles.legalItem, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Regulamin</Text>
            <Text style={styles.chevron}>→</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://cmok.app/polityka-prywatnosci')} style={({ pressed }) => [styles.legalItem, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Polityka prywatności</Text>
            <Text style={styles.chevron}>→</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('mailto:cmok.app@gmail.com')} style={({ pressed }) => [styles.legalItem, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Kontakt</Text>
            <Text style={styles.legalDetail}>cmok.app@gmail.com</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.logoutText}>Wyloguj ten telefon</Text>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.deleteText}>Usuń konto i dane</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const MINI_AV = 36;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screen + 4, paddingTop: 16, paddingBottom: 32 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4, minHeight: 44, marginBottom: 20 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: Spacing.card, marginBottom: 12,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardLabel: { fontSize: 11, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardValue: { fontSize: Typography.bodyLarge, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  cardDetail: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  circleRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: MINI_AV, height: MINI_AV, borderRadius: MINI_AV / 2,
    backgroundColor: Colors.safe, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  miniAvatarText: { fontSize: 14, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  circleInfo: { flex: 1 },
  chevron: { fontSize: 18, color: Colors.textMuted },

  /* Main relationship card (highlighted) */
  relationCard: {
    backgroundColor: Colors.safeLight,
    borderWidth: 1, borderColor: Colors.safe + '33',
  },
  relationAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.safe, justifyContent: 'center' as const, alignItems: 'center' as const, marginRight: 14,
  },
  relationAvatarText: { fontSize: 22, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  relationName: { fontSize: 18, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  relationRole: { fontSize: 13, color: Colors.safeStrong, marginTop: 2, fontFamily: Typography.fontFamilyMedium },

  /* Safety circle card (warm accent) */
  safetyCard: {
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1, borderColor: Colors.accent + '22',
  },
  safetyIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accent + '15', justifyContent: 'center' as const, alignItems: 'center' as const, marginRight: 14,
    borderWidth: 2, borderColor: Colors.accent + '33', borderStyle: 'dashed' as const,
  },
  safetyIconText: { fontSize: 26, fontFamily: Typography.headingFamily, color: Colors.accent, marginTop: -2 },
  safetyTitle: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  safetySubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  inviteCard: { },
  inviteText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.accent, marginBottom: 4 },
  codeFrame: {
    backgroundColor: Colors.cardStrong, borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 32,
    marginTop: 14, marginBottom: 14, alignItems: 'center',
  },
  codeValue: { fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.text, letterSpacing: 6 },
  codeHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 4,
  },
  shareBtnText: { fontSize: 16, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  dismissLink: { minHeight: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  dismissLinkText: { fontSize: 13, color: Colors.textMuted },
  // Editable name
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editHint: { fontSize: 13, color: Colors.accent, fontFamily: Typography.fontFamilyMedium },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: {
    flex: 1, fontSize: 17, color: Colors.text, fontFamily: Typography.fontFamilyMedium,
    backgroundColor: Colors.cardStrong, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.safe,
  },
  saveBtn: { backgroundColor: Colors.safe, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  saveBtnText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: '#FFFFFF' },
  roleTag: { fontSize: 12, color: Colors.safe, fontFamily: Typography.fontFamilyMedium, marginTop: 8 },
  legalItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legalItemText: { fontSize: 14, color: Colors.text },
  legalDetail: { fontSize: 12, color: Colors.textMuted },
  logoutButton: {
    backgroundColor: 'transparent', minHeight: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  logoutText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  deleteButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  deleteText: { fontSize: 14, color: Colors.alert },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  legalLink: { fontSize: 13, color: Colors.textMuted },
  legalDot: { fontSize: 13, color: Colors.textMuted },
});
