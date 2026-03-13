import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { sendCmok } from '../src/api/cmok';
import { getFamilyStatus } from '../src/api/family';
import { HeartButton } from '../src/components/HeartButton';
import { StreakBadge } from '../src/components/StreakBadge';
import { timeAgo } from '../src/utils/time';

interface FamilyMember {
  id: string;
  name: string;
  last_cmok_at: string | null;
  status: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const memberId = useAppStore((s) => s.memberId);
  const streak = useAppStore((s) => s.streak);
  const lastCmokAt = useAppStore((s) => s.lastCmokAt);
  const setStreak = useAppStore((s) => s.setStreak);
  const setLastCmokAt = useAppStore((s) => s.setLastCmokAt);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Check if cooldown is active (1 hour)
  const isCooldown = lastCmokAt
    ? Date.now() - new Date(lastCmokAt).getTime() < 3600000
    : false;

  const fetchStatus = useCallback(async () => {
    if (!memberId) return;
    try {
      const data = await getFamilyStatus(memberId);
      setMembers(data.members);
      setStreak(data.streak);
    } catch (error) {
      console.log('Failed to fetch status:', error);
    }
  }, [memberId, setStreak]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleSendCmok = async () => {
    if (!memberId || isCooldown || sent) return;
    setLoading(true);
    try {
      const result = await sendCmok(memberId);
      setSent(true);
      setStreak(result.streak);
      setLastCmokAt(new Date().toISOString());
      setTimeout(() => setSent(false), 3000);
      fetchStatus();
    } catch (error) {
      console.log('Failed to send cmok:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const otherMembers = members.filter((m) => m.id !== memberId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cmok</Text>
        <Pressable onPress={() => router.push('/family')}>
          <Text style={styles.familyLink}>Rodzina</Text>
        </Pressable>
      </View>

      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View style={styles.content}>
            <View style={styles.heartContainer}>
              <HeartButton
                onPress={handleSendCmok}
                disabled={isCooldown || loading}
                sent={sent}
              />
              {isCooldown && !sent && (
                <Text style={styles.cooldownText}>
                  Mozesz wyslac kolejnego cmoka za chwile
                </Text>
              )}
            </View>

            <StreakBadge streak={streak} />

            {otherMembers.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Ostatnio:</Text>
                {otherMembers.map((member) => (
                  <View key={member.id} style={styles.recentRow}>
                    <Text style={styles.recentEmoji}>
                      {member.status === '🟢' ? '💜' : '🤍'}
                    </Text>
                    <Text style={styles.recentName}>{member.name}</Text>
                    <Text style={styles.recentTime}>
                      {timeAgo(member.last_cmok_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#E8578B',
  },
  familyLink: {
    fontSize: 18,
    color: '#7F5BA6',
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  heartContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cooldownText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  recentSection: {
    width: '100%',
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 8,
  },
  recentEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  recentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  recentTime: {
    fontSize: 14,
    color: '#999',
  },
});
