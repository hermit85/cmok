import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { timeAgo } from '../utils/time';

interface CmokRowProps {
  senderName: string;
  createdAt: string;
  index: number;
}

export function CmokRow({ senderName, createdAt, index }: CmokRowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current; // slide from right

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 80,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const initial = senderName.charAt(0).toUpperCase();

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {/* Gold left border accent */}
      <View style={styles.leftBorder} />

      {/* Avatar circle */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>{initial}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.text}>
          <Text style={styles.name}>{senderName}</Text>
          {' przesyła cmoka'}
        </Text>
        <Text style={styles.time}>{timeAgo(createdAt)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    marginBottom: 8,
    overflow: 'hidden',
  },
  leftBorder: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#D4A574',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(26,26,46,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#D4A574',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0E6D3',
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    color: '#F0E6D3',
  },
  name: {
    fontWeight: '700',
    color: '#D4A574',
  },
  time: {
    fontSize: 12,
    color: 'rgba(240,230,211,0.35)',
    marginTop: 3,
  },
});
