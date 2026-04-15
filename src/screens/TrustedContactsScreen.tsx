import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { generateAndShareInvite } from '../utils/invite';
import { analytics } from '../services/analytics';

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export function TrustedContactsScreen() {
  const router = useRouter();
  const { relationship, profile, status } = useRelationship();
  const { contacts, loading, saving, addTrustedContact, removeTrustedContact } = useTrustedContacts(relationship?.id || null);
  const [phone, setPhone] = useState('');

  const canManage = status === 'active' && !!relationship?.id;

  const cleanPhone = phone.replace(/\D/g, '');
  const isPhoneValid = cleanPhone.length === 9 || (cleanPhone.startsWith('48') && cleanPhone.length === 11);

  const handleAdd = async () => {
    if (!isPhoneValid || !canManage || !relationship?.id) return;
    // Normalize to 48XXXXXXXXX format
    const normalized = cleanPhone.length === 9 ? `48${cleanPhone}` : cleanPhone;
    try {
      await addTrustedContact(normalized);
      analytics.contactAdded();
      setPhone('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('not found') || msg.includes('nie znaleziono')) {
        Alert.alert('Nie znaleziono', 'Ta osoba nie ma jeszcze konta w cmok. Wyślij jej zaproszenie.');
      } else if (msg.includes('already') || msg.includes('już')) {
        Alert.alert('Już w kręgu', 'Ta osoba jest już w Twoim kręgu.');
      } else {
        Alert.alert('Coś poszło nie tak', msg || 'Nie udało się dodać. Sprawdź numer i spróbuj ponownie.');
      }
    }
  };

  const handleRemove = async (contactId: string, name: string) => {
    try {
      await removeTrustedContact(contactId);
      analytics.contactRemoved();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Nie udało się usunąć ${name}.`;
      Alert.alert('Coś poszło nie tak', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          hitSlop={16}
        >
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Osoby w kręgu</Text>
        <Text style={styles.subtitle}>
          Te osoby dostaną wiadomość, jeśli coś się będzie działo, ale nie codzienny znak.
        </Text>

        {!canManage ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Najpierw połącz główną relację</Text>
            <Text style={styles.infoText}>Wróć tutaj, gdy oba telefony będą połączone.</Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.infoCta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.infoCtaText}>Wróć</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.addCard}>
              <Text style={styles.sectionLabel}>Dodaj kogoś bliskiego</Text>
              <TextInput
                value={phone}
                onChangeText={(value) => setPhone(normalizePhone(value))}
                placeholder="Numer telefonu"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                style={styles.input}
              />
              <Text style={styles.helperText}>
                {phone.length === 0 ? 'Wpisz numer telefonu osoby z cmok.' : isPhoneValid ? 'Numer wygląda dobrze.' : `Wpisz 9-cyfrowy numer telefonu.`}
              </Text>
              <Pressable
                onPress={handleAdd}
                disabled={!isPhoneValid || saving}
                style={({ pressed }) => [
                  styles.addButton,
                  (!isPhoneValid || saving) && styles.addButtonDisabled,
                  pressed && isPhoneValid && !saving && { opacity: 0.88 },
                ]}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>Dodaj</Text>}
              </Pressable>
            </View>

            <Pressable
              onPress={() => generateAndShareInvite()}
              style={({ pressed }) => [styles.shareLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.shareLinkText}>Zaproś kogoś do cmok</Text>
            </Pressable>

            <View style={styles.listSection}>
              <Text style={styles.sectionLabel}>W kręgu</Text>
              {loading ? (
                <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 16 }} />
              ) : contacts.length === 0 ? (
                <Text style={styles.emptyText}>Na razie nikogo tu nie ma.</Text>
              ) : (
                contacts.map((contact) => (
                  <View key={contact.id} style={styles.contactRow}>
                    <View style={styles.contactMeta}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemove(contact.id, contact.name)}
                      style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.removeText}>Usuń</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screen, paddingTop: 16, paddingBottom: 28 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 18 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: 26, lineHeight: 32, fontFamily: Typography.headingFamily, color: Colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginTop: 8, marginBottom: 24 },
  infoCard: {
    backgroundColor: Colors.surfaceWarm, borderRadius: 20,
    padding: Spacing.card,
  },
  infoTitle: { fontSize: 18, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 6 },
  infoText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 16 },
  infoCta: {
    backgroundColor: Colors.accent, minHeight: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
  },
  infoCtaText: { fontSize: 15, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  addCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: Spacing.card, marginBottom: 16,
  },
  sectionLabel: { fontSize: 14, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 12 },
  input: {
    height: 52, borderRadius: 16,
    backgroundColor: Colors.cardStrong, paddingHorizontal: 16,
    fontSize: 17, color: Colors.text,
  },
  helperText: { fontSize: 13, color: Colors.textMuted, marginTop: 8, marginBottom: 14 },
  addButton: {
    height: 52, borderRadius: 16,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
  },
  addButtonDisabled: { backgroundColor: Colors.disabled, shadowOpacity: 0 },
  addButtonText: { fontSize: 16, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  shareLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  shareLinkText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  listSection: { marginTop: 4 },
  emptyText: { fontSize: 15, color: Colors.textMuted, fontStyle: 'italic' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  contactMeta: { flex: 1, paddingRight: 12 },
  contactName: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.text },
  contactPhone: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  removeButton: { minHeight: 40, justifyContent: 'center' },
  removeText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.alertDark },
});
