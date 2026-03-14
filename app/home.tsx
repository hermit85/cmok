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
import { SurpriseOverlay, markTodaySurpriseDiscovered } from '../src/components/SurpriseOverlay';
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
  const [showSurprise, setShowSurprise] = useState(false);
  const [justSentCmok, setJustSentCmok] = useState(false);

  // Logo easter egg
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

  useEffect(() => {
    if (!lastCmokAt) return;
    const interval = setInterval(() => {
      setCooldownMs(getCooldownRemaining());
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
      setJustSentCmok(true);

      // Show surprise after a short delay + save discovery
      setTimeout(() => {
        setShowSurprise(true);
        markTodaySurpriseDiscovered();
      }, 1500);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleLogoTap}>
          <Animated.Text style={[styles.title, { transform: [{ rotate: logoSpin }] }]}>
            Cmok
          </Animated.Text>
        </Pressable>
        <PressableScale onPress={() => router.push('/family')} style={styles.familyButton}>
          <Text style={styles.familyLink}>Rodzina</Text>
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
                  Kolejny cmok za {formatCooldown(cooldownMs)} ⏳
                </Text>
              )}
            </View>

            <StreakBadge streak={streak} />

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

            {justSentCmok && (
              <View style={styles.tomorrowHint}>
                <Text style={styles.tomorrowText}>Jutro czeka nowa niespodzianka... 🎁</Text>
              </View>
            )}

            <View style={styles.bottomPadding} />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E07A5F"
          />
        }
      />

      {/* Surprise overlay */}
      <SurpriseOverlay
        visible={showSurprise}
        onClose={() => setShowSurprise(false)}
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#3D2C2C',
    fontFamily: 'Nunito_800ExtraBold',
  },
  familyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  familyLink: {
    fontSize: 16,
    color: '#E07A5F',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
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
  cooldownText: {
    fontSize: 15,
    color: '#8B7E7E',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Nunito_400Regular',
  },
  section: {
    width: '100%',
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D2C2C',
    marginBottom: 14,
    fontFamily: 'Nunito_700Bold',
  },
  tomorrowHint: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  tomorrowText: {
    fontSize: 15,
    color: '#8B7E7E',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Nunito_400Regular',
  },
  bottomPadding: {
    height: 40,
  },
});
