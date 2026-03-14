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
        duration: 400,
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
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Avatar circle */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>{initial}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.text}>
          <Text style={styles.name}>{senderName}</Text>
          {' przesyła cmoka'}
        </Text>
      </View>

      <Text style={styles.time}>{timeAgo(createdAt)}</Text>
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
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E07A5F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Nunito_700Bold',
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    color: '#3D2C2C',
    fontFamily: 'Nunito_400Regular',
  },
  name: {
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  time: {
    fontSize: 14,
    color: '#8B7E7E',
    marginLeft: 8,
    fontFamily: 'Nunito_400Regular',
  },
});
