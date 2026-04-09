import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useTrustedContacts } from '../hooks/useTrustedContacts';

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export function TrustedContactsScreen() {
  const router = useRouter();
  const { relationship, profile, status } = useRelationship();
  const { contacts, loading, saving, addTrustedContact, removeTrustedContact } = useTrustedContacts(relationship?.id || null);
  const [phone, setPhone] = useState('');

  const canManage = profile?.role === 'recipient' && status === 'active' && !!relationship?.id;

  const handleAdd = async () => {
    if (!phone.trim() || !canManage || !relationship?.id) return;
    try {
      await addTrustedContact(phone);
      setPhone('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się dodać.';
      Alert.alert('Coś poszło nie tak', message);
    }
  };

  const handleRemove = async (contactId: string, name: string) => {
    try {
      await removeTrustedContact(contactId);
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
          Dodatkowe bliskie osoby dostaną tylko pilny sygnał — nie codzienny znak.
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
              <Text style={styles.helperText}>Ta osoba musi mieć konto w Cmok.</Text>
              <Pressable
                onPress={handleAdd}
                disabled={!phone.trim() || saving}
                style={({ pressed }) => [
                  styles.addButton,
                  (!phone.trim() || saving) && styles.addButtonDisabled,
                  pressed && phone.trim() && !saving && { opacity: 0.88 },
                ]}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>Dodaj</Text>}
              </Pressable>
            </View>

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
  backText: { fontSize: 16, fontWeight: '600', color: Colors.accent },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginTop: 8, marginBottom: 24 },
  infoCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.card,
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  infoText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 16 },
  infoCta: {
    backgroundColor: Colors.accent, minHeight: 48, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  infoCtaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  addCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.card, marginBottom: 20,
  },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  input: {
    height: 52, borderRadius: Radius.sm,
    backgroundColor: Colors.surface, paddingHorizontal: 16,
    fontSize: 17, color: Colors.text,
  },
  helperText: { fontSize: 13, color: Colors.textMuted, marginTop: 8, marginBottom: 14 },
  addButton: {
    height: 52, borderRadius: Radius.sm,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  addButtonDisabled: { backgroundColor: Colors.disabled },
  addButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  listSection: { marginTop: 4 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  contactMeta: { flex: 1, paddingRight: 12 },
  contactName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  contactPhone: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  removeButton: { minHeight: 40, justifyContent: 'center' },
  removeText: { fontSize: 14, fontWeight: '600', color: Colors.alertDark },
});
