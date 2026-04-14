import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useRelationship } from '../hooks/useRelationship';
import { shareInvite, logInviteEvent } from '../utils/invite';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/tokens';

export function WaitingForConnectionScreen() {
  const router = useRouter();
  const { loading, sessionReady, profile, relationship, status, refreshRelationship } = useRelationship();

  useEffect(() => {
    if (!sessionReady || loading) return; // Wait for full data before routing
    if (status === 'active' && profile?.role === 'recipient') {
      router.replace('/recipient-home');
    }
  }, [sessionReady, loading, profile?.role, router, status]);

  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(() => { refreshRelationship(); }, 5000);
    return () => clearInterval(interval);
  }, [refreshRelationship, status]);

  const sigName = relationship?.signalerLabel || 'bliska osoba';
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || !profile?.id) return;
    try {
      const { error } = await supabase.from('users').update({ name: trimmed }).eq('id', profile.id);
      if (error) throw error;
      setEditingName(false);
      refreshRelationship();
    } catch { Alert.alert('Błąd', 'Nie udało się zapisać.'); }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      logInviteEvent('invite_code_copied', { code: inviteCode });
      Alert.alert('Skopiowano', 'Kod jest w schowku.');
    } catch { /* silent */ }
  };

  const handleShare = async () => {
    if (!inviteCode) return;
    await shareInvite({
      code: inviteCode,
      signalerLabel: relationship?.signalerLabel,
    });
  };

  const handleDeleteAccount = () => {
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
  };

  // Only show loader on initial mount, not on polling refreshes
  const hasData = profile && relationship;
  if (!sessionReady || (!hasData && loading)) {
    return (
      <SafeAreaView style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  const inviteCode = relationship?.inviteCode;
  const inviteExpiry = relationship?.inviteExpiresAt;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={s.logo}>cmok</Text>
        <Text style={s.greeting}>Cześć, {profile?.name || 'hej'}</Text>
        <Text style={s.sub}>Twój codzienny rytuał bliskości zaraz się zacznie.</Text>

        {/* Card 1: Invite code */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Zaproś {sigName}</Text>
          <Text style={s.cardHint}>Pokaż ten kod lub wyślij go. Gdy {sigName} go wpisze, połączycie się.</Text>

          {inviteCode ? (
            <Pressable onPress={handleCopyCode} style={({ pressed }) => [s.codeFrame, pressed && { opacity: 0.85 }]}>
              <Text style={s.codeValue}>{inviteCode}</Text>
              <Text style={s.copyHint}>Stuknij, żeby skopiować</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={s.shareBtnText}>Wyślij zaproszenie</Text>
          </Pressable>

          {inviteExpiry ? (
            <Text style={s.expiryHint}>
              Kod ważny do {new Date(inviteExpiry).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
            </Text>
          ) : null}

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [s.resendLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={s.resendLinkText}>Wyślij ponownie</Text>
          </Pressable>
        </View>

        {/* Card 2: Status */}
        <View style={s.statusCard}>
          <View style={s.statusDot} />
          <View style={s.statusInfo}>
            <Text style={s.statusTitle}>Czekamy na {sigName}</Text>
            <Text style={s.statusHint}>Gdy się połączycie, zaczniecie Wasz codzienny cmok.</Text>
          </View>
          <Pressable onPress={refreshRelationship} style={({ pressed }) => [s.checkBtn, pressed && { opacity: 0.7 }]}>
            <Text style={s.checkBtnText}>Sprawdź</Text>
          </Pressable>
        </View>

        {/* Card 3: Account with edit + actions */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Twoje konto</Text>
          {editingName ? (
            <View style={s.editRow}>
              <TextInput
                style={s.nameInput}
                value={nameValue}
                onChangeText={setNameValue}
                autoFocus
                maxLength={30}
                placeholder="Twoje imię"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <Pressable onPress={handleSaveName} style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.7 }]}>
                <Text style={s.saveBtnText}>Zapisz</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => { setNameValue(profile?.name || ''); setEditingName(true); }} style={({ pressed }) => [s.nameRow, pressed && { opacity: 0.7 }]}>
              <Text style={s.accountName}>{profile?.name || 'Ustaw imię'}</Text>
              <Text style={s.editHint}>Zmień</Text>
            </Pressable>
          )}
          <Text style={s.accountPhone}>
            {profile?.phone ? profile.phone.replace(/^48/, '+48 ').replace(/(\d{3})(?=\d)/g, '$1 ') : ''}
          </Text>

          <View style={s.accountActions}>
            <Pressable
              onPress={async () => { await supabase.auth.signOut(); router.replace('/onboarding'); }}
              style={({ pressed }) => [s.accountLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={s.accountLinkText}>Wyloguj</Text>
            </Pressable>
            <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [s.accountLink, pressed && { opacity: 0.6 }]}>
              <Text style={s.deleteText}>Usuń konto i dane</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.screen, paddingTop: 16, paddingBottom: 32 },

  /* header */
  logo: { fontSize: 20, fontFamily: Typography.headingFamily, color: Colors.accent, marginBottom: 20 },
  greeting: { fontSize: 26, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },

  /* cards */
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: Spacing.card, marginBottom: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardLabel: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  cardHint: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },

  /* code */
  codeFrame: {
    backgroundColor: Colors.cardStrong, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 28,
    marginBottom: 14, alignItems: 'center',
  },
  codeValue: { fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.text, letterSpacing: 6 },
  copyHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  expiryHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 10 },
  resendLink: { minHeight: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  resendLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },

  /* share button */
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
  },
  shareBtnText: { fontSize: 16, fontFamily: Typography.headingFamily, color: '#FFFFFF' },

  /* status card */
  statusCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.safeLight, borderRadius: 20, padding: Spacing.card, marginBottom: 16,
    gap: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.highlight },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.safeStrong },
  statusHint: { fontSize: 12, color: Colors.safeStrong, opacity: 0.7, marginTop: 2 },
  checkBtn: {
    backgroundColor: Colors.safe, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  checkBtnText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: '#FFFFFF' },

  /* account */
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editHint: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1, fontSize: 17, color: Colors.text, fontFamily: Typography.fontFamilyMedium,
    backgroundColor: Colors.cardStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.safe,
  },
  saveBtn: { backgroundColor: Colors.safe, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: '#FFFFFF' },
  accountName: { fontSize: 17, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  accountPhone: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  accountLink: { minHeight: 36, justifyContent: 'center' },
  accountLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  deleteText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.alert },
});
