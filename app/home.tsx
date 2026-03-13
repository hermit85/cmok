import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../src/store/useAppStore';
import { sendCmok, getRecentCmoks, RecentCmok } from '../src/api/cmok';
import { getFamilyStatus } from '../src/api/family';
import { HeartButton } from '../src/components/HeartButton';
import { StreakBadge } from '../src/components/StreakBadge';
import { CmokRow } from '../src/components/CmokRow';
import { PressableScale } from '../src/components/PressableScale';
import { FloatingStars } from '../src/components/FloatingStars';
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

  // Logo easter egg: rotate 360 on tap
  const logoRotation = useRef(new Animated.Value(0)).current;
  const [logoTapCount, setLogoTapCount] = useState(0);

  // Cooldown: 1 hour
  const getCooldownRemaining = useCallback(() => {
    if (!lastCmokAt) return 0;
    const elapsed = Date.now() - new Date(lastCmokAt).getTime();
    return Math.max(0, 3600000 - elapsed);
  }, [lastCmokAt]);

  const [cooldownMs, setCooldownMs] = useState(getCooldownRemaining());
  const isCooldown = cooldownMs > 0;

  // Update cooldown timer every second
  useEffect(() => {
    if (!lastCmokAt) return;
    const interval = setInterval(() => {
      const remaining = getCooldownRemaining();
      setCooldownMs(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastCmokAt, getCooldownRemaining]);

  const formatCooldown = (ms: number) => {
    const mins = Math.ceil(ms / 60000);
    return `${mins} min`;
  };

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

  const handleLogoTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLogoTapCount(prev => prev + 1);
    // Easter egg: logo tap → heart spins 360
    Animated.timing(logoRotation, {
      toValue: logoTapCount + 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const logoSpin = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const otherMembers = members.filter((m) => m.id !== memberId);

  const getStatusEmoji = (status: string) => {
    if (status === '🟢') return '✨';
    if (status === '🟡') return '✦';
    return '💛';
  };

  return (
    <View style={styles.container}>
      <FloatingStars />

      <View style={styles.header}>
        <Pressable onPress={handleLogoTap}>
          <Animated.Text style={[styles.title, { transform: [{ rotate: logoSpin }] }]}>
            Cmok ✦
          </Animated.Text>
        </Pressable>
        <PressableScale onPress={() => router.push('/family')} style={styles.familyButton}>
          <Text style={styles.familyLink}>✦ Rodzina</Text>
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
                <View style={styles.cooldownContainer}>
                  <Text style={styles.cooldownText}>
                    Kolejny cmok za {formatCooldown(cooldownMs)} ⏳
                  </Text>
                </View>
              )}
            </View>

            <StreakBadge streak={streak} />

            {otherMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✦ Bliscy</Text>
                {otherMembers.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberDot}>
                      <Text style={styles.memberDotText}>{getStatusEmoji(member.status)}</Text>
                    </View>
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
            tintColor="#D4A574"
          />
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
    paddingBottom: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F0E6D3',
    letterSpacing: 1,
  },
  familyButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.3)',
  },
  familyLink: {
    fontSize: 15,
    color: '#D4A574',
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  heartContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  cooldownContainer: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cooldownText: {
    fontSize: 14,
    color: 'rgba(212,165,116,0.5)',
    textAlign: 'center',
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0E6D3',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    marginBottom: 8,
  },
  memberDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(212,165,116,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)',
  },
  memberDotText: {
    fontSize: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F0E6D3',
  },
  memberTime: {
    fontSize: 12,
    color: 'rgba(240,230,211,0.35)',
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});
