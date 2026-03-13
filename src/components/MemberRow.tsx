import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { timeAgo } from '../utils/time';

const AVATAR_COLORS = ['#C85A5A', '#D4A574', '#7B8EC8', '#8B6FAE', '#5A9E8F', '#C87A5A', '#6B8BBD', '#9E7BA5'];

interface MemberRowProps {
  name: string;
  lastCmokAt: string | null;
  status: string;
  index?: number;
}

function getStatusInfo(status: string): { emoji: string; label: string; color: string } {
  if (status === '🟢') return { emoji: '✨', label: 'Aktywny/a dziś', color: '#D4A574' };
  if (status === '🟡') return { emoji: '✦', label: 'Był(a) wczoraj', color: 'rgba(212,165,116,0.6)' };
  return { emoji: '💛', label: 'Dawno nie było cmoka...', color: 'rgba(200,90,90,0.7)' };
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function MemberRow({ name, lastCmokAt, status, index = 0 }: MemberRowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 100,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const statusInfo = getStatusInfo(status);
  const avatarColor = getAvatarColor(name);
  const initial = name.charAt(0).toUpperCase();

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor + '25' }]}>
        <View style={[styles.avatarBorder, { borderColor: avatarColor }]}>
          <Text style={[styles.avatarText, { color: avatarColor }]}>{initial}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusEmoji}>{statusInfo.emoji}</Text>
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
        <Text style={styles.time}>{timeAgo(lastCmokAt)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F0E6D3',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusEmoji: {
    fontSize: 13,
    marginRight: 5,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  time: {
    fontSize: 12,
    color: 'rgba(240,230,211,0.35)',
    marginTop: 2,
  },
});
