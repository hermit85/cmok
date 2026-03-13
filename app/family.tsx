import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Share,
  Alert,
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
        message: `Dołącz do mojej rodziny w Cmok! 💜 Kod: ${code}`,
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()}>
          <Text style={styles.backButton}>← Wstecz</Text>
        </PressableScale>
        <Text style={styles.title}>👨‍👩‍👧‍👦 Rodzina</Text>
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
            tintColor="#E8578B"
          />
        }
        ListFooterComponent={
          <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>🔑 Kod rodziny</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{code}</Text>
            </View>

            <PressableScale onPress={handleShare} style={styles.shareButton}>
              <Text style={styles.shareButtonText}>
                📤 Udostępnij kod
              </Text>
            </PressableScale>

            <Text style={styles.codeHint}>
              Wyślij ten kod bliskim, żeby dołączyli do Twojej rodziny 💜
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
    backgroundColor: '#FFF5F7',
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
    color: '#7F5BA6',
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E8578B',
  },
  list: {
    padding: 24,
  },
  codeSection: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#FDDDE6',
  },
  codeLabel: {
    fontSize: 16,
    color: '#7F5BA6',
    fontWeight: '600',
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: '#FFF',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FDDDE6',
  },
  codeText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#E8578B',
    letterSpacing: 6,
  },
  shareButton: {
    backgroundColor: '#7F5BA6',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#7F5BA6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  codeHint: {
    fontSize: 14,
    color: '#C48FA3',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  resetButton: {
    marginTop: 48,
    marginBottom: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0B0B0',
  },
  resetButtonText: {
    color: '#C48080',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
