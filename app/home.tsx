import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { sendCmok, getRecentCmoks, RecentCmok } from '../src/api/cmok';
import { getFamilyStatus } from '../src/api/family';
import { HeartButton } from '../src/components/HeartButton';
import { StreakBadge } from '../src/components/StreakBadge';
import { CmokRow } from '../src/components/CmokRow';
import { PressableScale } from '../src/components/PressableScale';
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
  const [recentCmoks, setRecentCmoks] = useState<RecentCmok[]>([]);
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

      const familyId = useAppStore.getState().familyId;
      if (familyId) {
        const cmoks = await getRecentCmoks(familyId);
        setRecentCmoks(cmoks);
      }
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
      {/* Gradient-like background layers */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cmok 💜</Text>
          <Text style={styles.subtitle}>Wyślij buziaczka bliskim</Text>
        </View>
        <PressableScale onPress={() => router.push('/family')} style={styles.familyButton}>
          <Text style={styles.familyLink}>👨‍👩‍👧‍👦 Rodzina</Text>
        </PressableScale>
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
                  Możesz wysłać kolejnego cmoka za chwilę ⏳
                </Text>
              )}
            </View>

            <StreakBadge streak={streak} />

            {otherMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>👨‍👩‍👧 Bliscy</Text>
                {otherMembers.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <Text style={styles.memberEmoji}>
                      {member.status === '🟢' ? '💚' : member.status === '🟡' ? '💛' : '❤️\u200D🩹'}
                    </Text>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberTime}>
                        {timeAgo(member.last_cmok_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {recentCmoks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💌 Ostatnie cmoki</Text>
                {recentCmoks.map((cmok, index) => (
                  <CmokRow
                    key={cmok.id}
                    senderName={cmok.sender_name}
                    createdAt={cmok.created_at}
                    index={index}
                  />
                ))}
              </View>
            )}

            <View style={styles.bottomPadding} />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E8578B"
          />
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
  bgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: '#FFFBFC',
  },
  bgBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: '#FFF0F3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#E8578B',
  },
  subtitle: {
    fontSize: 14,
    color: '#C48FA3',
    marginTop: 2,
  },
  familyButton: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  familyLink: {
    fontSize: 15,
    color: '#7F5BA6',
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heartContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  cooldownText: {
    fontSize: 14,
    color: '#C48FA3',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7F5BA6',
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  memberEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  memberTime: {
    fontSize: 13,
    color: '#BBB',
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});
