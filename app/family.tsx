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

// Surprise emojis for achievement wall
const SURPRISE_EMOJIS = ['🐕', '🐈', '🦔', '🌻', '🧸', '🦉', '🐝', '🌈', '🎵', '🌙', '🍀', '🐦', '🧁', '🦋', '🌟', '🐧', '🎈', '🦊'];

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
  const [discoveredDays, setDiscoveredDays] = useState<number[]>([]);

  // Load discovered surprises
  useEffect(() => {
    AsyncStorage.getItem('cmok_discovered_surprises').then((val) => {
      if (val) {
        try { setDiscoveredDays(JSON.parse(val)); } catch {}
      }
    });
  }, []);

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
        message: `Dołącz do mojej rodziny w Cmok! ❤️ Kod: ${code}`,
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
        <Text style={styles.title}>Rodzina</Text>
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
            tintColor="#E07A5F"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Ładowanie...</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {/* Solo member easter egg */}
            {isSolo && (
              <View style={styles.soloCard}>
                <Text style={styles.soloEmoji}>🏡</Text>
                <Text style={styles.soloText}>Trochę tu pusto... Zaproś kogoś!</Text>
              </View>
            )}

            {/* Code section */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Kod rodziny</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{code}</Text>
              </View>
              <PressableScale onPress={handleShare} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Udostępnij</Text>
              </PressableScale>
            </View>

            {/* Discovered surprises — achievement wall */}
            <View style={styles.surprisesCard}>
              <Text style={styles.surprisesTitle}>🎁 Odkryte niespodzianki</Text>
              <View style={styles.surprisesGrid}>
                {SURPRISE_EMOJIS.map((emoji, i) => {
                  const discovered = discoveredDays.includes(i);
                  return (
                    <View key={i} style={[styles.surpriseCell, discovered && styles.surpriseCellDiscovered]}>
                      <Text style={styles.surpriseCellText}>
                        {discovered ? emoji : '❓'}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.surprisesHint}>
                Wysyłaj cmoki codziennie, żeby odkryć wszystkie!
              </Text>
            </View>

            {/* Reset */}
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
    backgroundColor: '#FDF6F0',
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
    color: '#E07A5F',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3D2C2C',
    fontFamily: 'Nunito_800ExtraBold',
  },
  list: {
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8B7E7E',
    fontFamily: 'Nunito_400Regular',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  // Solo easter egg
  soloCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E8DDD5',
    borderStyle: 'dashed',
    width: '100%',
  },
  soloEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  soloText: {
    fontSize: 17,
    color: '#8B7E7E',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
  },
  // Code section
  codeCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  codeLabel: {
    fontSize: 16,
    color: '#8B7E7E',
    fontWeight: '600',
    marginBottom: 14,
    fontFamily: 'Nunito_600SemiBold',
  },
  codeBox: {
    backgroundColor: '#FDF6F0',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 18,
  },
  codeText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#3D2C2C',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareButton: {
    backgroundColor: '#E07A5F',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  // Surprises grid
  surprisesCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  surprisesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3D2C2C',
    marginBottom: 16,
    fontFamily: 'Nunito_700Bold',
  },
  surprisesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 12,
  },
  surpriseCell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5EDE5',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  surpriseCellDiscovered: {
    backgroundColor: '#FFF3EC',
    borderWidth: 1,
    borderColor: 'rgba(224,122,95,0.15)',
  },
  surpriseCellText: {
    fontSize: 22,
  },
  surprisesHint: {
    fontSize: 14,
    color: '#8B7E7E',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Nunito_400Regular',
  },
  // Reset
  resetButton: {
    marginBottom: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  resetButtonText: {
    color: '#C85A5A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
  },
});
