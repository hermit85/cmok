import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { getFamilyStatus } from '../src/api/family';
import { MemberRow } from '../src/components/MemberRow';

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
        message: `Dolacz do mojej rodziny w Cmok! Kod: ${code}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>Wstecz</Text>
        </Pressable>
        <Text style={styles.title}>Rodzina</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MemberRow
            name={item.name}
            lastCmokAt={item.last_cmok_at}
            status={item.status}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListFooterComponent={
          <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>Kod rodziny:</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{code}</Text>
            </View>
            <Pressable style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>
                Udostepnij kod
              </Text>
            </Pressable>
            <Text style={styles.codeHint}>
              Wyslij ten kod bliskim, zeby dolaczyli do Twojej rodziny
            </Text>
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
    fontSize: 18,
    color: '#7F5BA6',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
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
    borderTopColor: '#F0E0E5',
  },
  codeLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  codeBox: {
    backgroundColor: '#FFF',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#E8578B',
    letterSpacing: 6,
  },
  shareButton: {
    backgroundColor: '#7F5BA6',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  codeHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
