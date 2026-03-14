import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { timeAgo } from '../utils/time';

const AVATAR_COLORS = ['#E07A5F', '#D4A373', '#7D8B6A', '#C27D5F', '#8B7BA5', '#6A8B7D', '#A37D5F', '#7D6A8B'];

interface MemberRowProps {
  name: string;
  lastCmokAt: string | null;
  status: string;
  index?: number;
}

function getStatusInfo(status: string): { icon: string; label: string; color: string } {
  if (status === '🟢') return { icon: '✅', label: 'Aktywny/a dziś', color: '#7D8B6A' };
  if (status === '🟡') return { icon: '🌙', label: 'Był/a wczoraj', color: '#D4A373' };
  return { icon: '💛', label: 'Dawno nie było cmoka...', color: '#C85A5A' };
}

function getAvatarColor(name: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[(Math.abs(hash) + index) % AVATAR_COLORS.length];
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
  const avatarColor = getAvatarColor(name, index);
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
        <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
          {statusInfo.icon} {statusInfo.label}
        </Text>
        <Text style={styles.time}>{timeAgo(lastCmokAt)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    color: '#FFFFFF',
    fontFamily: 'Nunito_700Bold',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3D2C2C',
    fontFamily: 'Nunito_700Bold',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
    fontFamily: 'Nunito_500Medium',
  },
  time: {
    fontSize: 14,
    color: '#8B7E7E',
    marginTop: 2,
    fontFamily: 'Nunito_400Regular',
  },
});
