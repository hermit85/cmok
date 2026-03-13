import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { timeAgo } from '../utils/time';

const AVATAR_COLORS = ['#E8578B', '#7F5BA6', '#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4'];

interface MemberRowProps {
  name: string;
  lastCmokAt: string | null;
  status: string;
  index?: number;
}

function getStatusInfo(status: string): { emoji: string; label: string; color: string } {
  if (status === '🟢') return { emoji: '💚', label: 'Aktywny/a dziś', color: '#4CAF50' };
  if (status === '🟡') return { emoji: '💛', label: 'Wczoraj', color: '#FF9800' };
  return { emoji: '❤️\u200D🩹', label: 'Dawno nie było cmoka...', color: '#E57373' };
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
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
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
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initial}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  time: {
    fontSize: 13,
    color: '#BBB',
    marginTop: 2,
  },
});
