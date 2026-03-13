import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../src/store/useAppStore';
import { getFamilyStatus } from '../src/api/family';
import { MemberRow } from '../src/components/MemberRow';
import { PressableScale } from '../src/components/PressableScale';

interface FamilyMember {
  id: string;
  name: string;
  last_cmok_at: string | null;
  status: string;
}

export default function FamilyScreen() {
  const router = useRouter();
  const memberId = useAppStore((s) => s.memberId);
  const familyCode = useAppStore((s) => s.familyCode);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [code, setCode] = useState(familyCode || '');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!memberId) return;
    try {
      const data = await getFamilyStatus(memberId);
      setMembers(data.members);
      if (data.family_code) setCode(data.family_code);
    } catch (error) {
      console.log('Failed to fetch family:', error);
    }
  }, [memberId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Dołącz do mojej rodziny w Cmok! ✦ Kod: ${code}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Resetuj apkę',
      'Czy na pewno chcesz zresetować aplikację? Utracisz powiązanie z rodziną.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Resetuj',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            useAppStore.getState().reset();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const otherMembers = members.filter((m) => m.id !== memberId);
  const isSolo = otherMembers.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()}>
          <Text style={styles.backButton}>← Wstecz</Text>
        </PressableScale>
        <Text style={styles.title}>✦ Rodzina</Text>
        <View style={{ width: 70 }} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MemberRow
            name={item.name}
            lastCmokAt={item.last_cmok_at}
            status={item.status}
            index={index}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D4A574"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✧</Text>
            <Text style={styles.emptyText}>Ładowanie...</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.codeSection}>
            {/* Solo member easter egg */}
            {isSolo && (
              <View style={styles.soloCard}>
                <Text style={styles.soloEmoji}>🏡</Text>
                <Text style={styles.soloText}>Trochę tu pusto... Zaproś kogoś!</Text>
              </View>
            )}

            <Text style={styles.codeLabel}>✦ Kod rodziny</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{code}</Text>
            </View>

            <PressableScale onPress={handleShare} style={styles.shareButton}>
              <Text style={styles.shareButtonText}>
                Udostępnij kod ✦
              </Text>
            </PressableScale>

            <Text style={styles.codeHint}>
              Wyślij ten kod bliskim, żeby dołączyli do Twojej rodziny ✦
            </Text>

            <PressableScale onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Resetuj apkę</Text>
            </PressableScale>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: {
    fontSize: 16,
    color: 'rgba(212,165,116,0.6)',
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D4A574',
    letterSpacing: 1,
  },
  list: {
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 32,
    color: 'rgba(212,165,116,0.3)',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(240,230,211,0.3)',
  },
  // Solo easter egg
  soloCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(212,165,116,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)',
    marginBottom: 28,
    borderStyle: 'dashed',
  },
  soloEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  soloText: {
    fontSize: 16,
    color: 'rgba(212,165,116,0.7)',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Code section
  codeSection: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,165,116,0.15)',
  },
  codeLabel: {
    fontSize: 16,
    color: '#D4A574',
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#D4A574',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  codeText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#D4A574',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareButton: {
    backgroundColor: 'rgba(200,90,90,0.8)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.3)',
    shadowColor: '#C85A5A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  shareButtonText: {
    color: '#F0E6D3',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeHint: {
    fontSize: 14,
    color: 'rgba(212,165,116,0.45)',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  resetButton: {
    marginTop: 48,
    marginBottom: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,90,90,0.3)',
  },
  resetButtonText: {
    color: 'rgba(200,90,90,0.6)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
