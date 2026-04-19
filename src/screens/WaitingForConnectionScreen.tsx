import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useRelationship } from '../hooks/useRelationship';
import { shareInvite, logInviteEvent } from '../utils/invite';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/tokens';
import { haptics } from '../utils/haptics';
import { WarmToast } from '../components/WarmToast';

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
  const [justCopied, setJustCopied] = useState(false);
  const copyScale = useRef(new Animated.Value(1)).current;
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyResetRef.current) clearTimeout(copyResetRef.current); }, []);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || !profile?.id) return;
    try {
      const { error } = await supabase.from('users').update({ name: trimmed }).eq('id', profile.id);
      if (error) throw error;
      setEditingName(false);
      // Force fresh so the new name shows immediately, bypassing 500ms dedup.
      refreshRelationship(true);
    } catch { Alert.alert('Coś poszło nie tak', 'Nie udało się zapisać.'); }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      logInviteEvent('invite_code_copied', { code: inviteCode });
      haptics.success();
      setJustCopied(true);
      copyScale.setValue(0.94);
      Animated.spring(copyScale, { toValue: 1, tension: 140, friction: 6, useNativeDriver: true }).start();
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setJustCopied(false), 1800);
    } catch {
      // Clipboard can fail on some Android versions / WebView. Fall back to
      // share sheet so the code isn't lost.
      haptics.warning();
      Alert.alert(
        'Nie udało się skopiować',
        'Możesz wysłać kod przez "Wyślij zaproszenie" poniżej.',
      );
    }
  };

  const handleShare = async () => {
    if (!inviteCode) return;
    await shareInvite({
      code: inviteCode,
      signalerLabel: relationship?.signalerLabel,
      srcUserId: profile?.id,
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
          } catch { Alert.alert('Coś poszło nie tak', 'Nie udało się usunąć konta. Spróbuj ponownie.'); }
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

  // Edge case: recipient with an active pair + a pending additional pair
  // (post-AddPair flow). useRelationship prefers active, so relationship
  // here is the active row and inviteCode is null. Redirect to home
  // covers this on next render, but we show a transition loader meanwhile
  // instead of a dead screen with non-functional "Wyślij zaproszenie"
  // buttons.
  if (status === 'active' && profile?.role === 'recipient') {
    return (
      <SafeAreaView style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={{ marginTop: 12, color: Colors.textSecondary, fontFamily: Typography.fontFamilyMedium }}>
          Przekierowuję…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text style={s.logo}>cmok</Text>
        <Text style={s.greeting}>Cześć, {profile?.name || 'hej'}</Text>
        <Text style={s.sub}>Twój codzienny rytuał bliskości zaraz się zacznie.</Text>

        {/* Card 1: Invite code */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Zaproś {sigName}</Text>
          <Text style={s.cardHint}>Pokaż ten kod lub wyślij go. Gdy {sigName} go wpisze, połączycie się.</Text>

          {inviteCode ? (
            <Animated.View style={{ transform: [{ scale: copyScale }] }}>
              <Pressable
                onPress={handleCopyCode}
                style={({ pressed }) => [s.codeFrame, justCopied && s.codeFrameCopied, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`Kod zaproszenia ${inviteCode}. Stuknij, żeby skopiować.`}
              >
                <Text style={[s.codeValue, justCopied && s.codeValueCopied]}>{inviteCode}</Text>
                <Text style={[s.copyHint, justCopied && s.copyHintCopied]}>
                  {justCopied ? '\u2713 Skopiowane' : 'Stuknij, żeby skopiować'}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
          <WarmToast visible={justCopied} text="Kod skopiowany" tone="safe" />


          <Pressable
            onPress={handleShare}
            disabled={!inviteCode}
            style={({ pressed }) => [
              s.shareBtn,
              !inviteCode && s.shareBtnDisabled,
              pressed && inviteCode && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Wyślij zaproszenie do ${sigName}`}
            accessibilityState={{ disabled: !inviteCode }}
          >
            <Text style={s.shareBtnText}>Wyślij zaproszenie</Text>
          </Pressable>

          {inviteExpiry ? (
            <Text style={s.expiryHint}>
              Kod ważny do {new Date(inviteExpiry).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
            </Text>
          ) : null}

          {inviteCode ? (
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [s.resendLink, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Wyślij zaproszenie ponownie"
            >
              <Text style={s.resendLinkText}>Wyślij ponownie</Text>
            </Pressable>
          ) : (
            // No invite code on file — prompt a manual refresh instead of
            // showing a non-functional resend link (the old behaviour
            // rendered a tappable link whose onPress silently returned
            // early because !inviteCode).
            <Pressable
              onPress={() => refreshRelationship(true)}
              style={({ pressed }) => [s.resendLink, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Odśwież, żeby pobrać kod"
            >
              <Text style={s.resendLinkText}>Odśwież</Text>
            </Pressable>
          )}
        </View>

        {/* Card 2: Status */}
        <View style={s.statusCard}>
          <View style={s.statusDot} />
          <View style={s.statusInfo}>
            <Text style={s.statusTitle}>Czekamy na {sigName}</Text>
            <Text style={s.statusHint}>Gdy się połączycie, zaczniecie Wasz codzienny cmok.</Text>
          </View>
          <Pressable
            onPress={() => refreshRelationship(true)}
            style={({ pressed }) => [s.checkBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Sprawdź, czy bliska osoba już dołączyła"
          >
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
                accessibilityLabel="Twoje imię"
              />
              <Pressable
                onPress={handleSaveName}
                style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Zapisz imię"
              >
                <Text style={s.saveBtnText}>Zapisz</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { setNameValue(profile?.name || ''); setEditingName(true); }}
              style={({ pressed }) => [s.nameRow, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={profile?.name ? `Zmień imię: ${profile.name}` : 'Ustaw swoje imię'}
            >
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
              accessibilityRole="button"
              accessibilityLabel="Wyloguj się z tego telefonu"
            >
              <Text style={s.accountLinkText}>Wyloguj</Text>
            </Pressable>
            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => [s.accountLink, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Usuń konto i wszystkie dane"
              accessibilityHint="Ta operacja jest nieodwracalna"
            >
              <Text style={s.deleteText}>Usuń konto i dane</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    borderWidth: 1.5, borderColor: 'transparent',
  },
  codeFrameCopied: { backgroundColor: Colors.safeLight, borderColor: Colors.safe },
  codeValue: { fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.text, letterSpacing: 6 },
  codeValueCopied: { color: Colors.safeStrong },
  copyHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  copyHintCopied: { color: Colors.safeStrong },
  expiryHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 10 },
  resendLink: { minHeight: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  resendLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },

  /* share button */
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
  },
  shareBtnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
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
