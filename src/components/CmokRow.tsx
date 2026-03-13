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
  const slideAnim = useRef(new Animated.Value(20)).current;

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
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>✦</Text>
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(200,90,90,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
    color: '#C85A5A',
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
    color: 'rgba(240,230,211,0.4)',
    marginTop: 3,
  },
});
