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
  const slideAnim = useRef(new Animated.Value(30)).current;

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
      <Text style={styles.emoji}>💜</Text>
      <View style={styles.content}>
        <Text style={styles.text}>
          <Text style={styles.name}>{senderName}</Text>
          {' wysłał(a) cmoka 💜'}
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
    paddingHorizontal: 16,
    backgroundColor: '#FFF5F8',
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDDDE6',
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  emoji: {
    fontSize: 22,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    color: '#555',
  },
  name: {
    fontWeight: '700',
    color: '#E8578B',
  },
  time: {
    fontSize: 12,
    color: '#BBB',
    marginTop: 3,
  },
});
