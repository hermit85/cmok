/**
 * MilestoneCelebration — full-screen celebration overlay on streak milestones.
 * Shows confetti particles + warm copy + share button.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Share, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Particles } from './Particles';
import { analytics } from '../services/analytics';
import { haptics } from '../utils/haptics';
import { buildPeerShareUrl } from '../utils/invite';

interface Props {
  visible: boolean;
  streak: number;
  /** Name to use in share copy. For signaler: recipient's name. For recipient: signaler's name. */
  recipientName: string | null;
  /** Perspective changes body copy + share framing. Default 'signaler' (Mama's side). */
  perspective?: 'signaler' | 'recipient';
  /** Current user id — passed in as prop (instead of calling useRelationship here)
   *  so we don't duplicate the hook's fetches for the parent screen. */
  srcUserId?: string | null;
  onDismiss: () => void;
}

function milestoneTextSignaler(streak: number): { headline: string; body: string } {
  if (streak === 7) return { headline: 'Cały tydzień!', body: 'Siedem dni z rzędu.\nTo już rytuał.' };
  if (streak === 14) return { headline: 'Dwa tygodnie!', body: 'Połowa miesiąca codziennego kontaktu.' };
  if (streak === 21) return { headline: 'Trzy tygodnie!', body: 'To już nawyk.\nJesteś niesamowita.' };
  if (streak === 30) return { headline: 'Cały miesiąc!', body: '30 dni spokoju\ndla Ciebie i Twoich bliskich.' };
  if (streak === 50) return { headline: '50 dni!', body: 'Ponad siedem tygodni z rzędu.\nRobisz to, co najważniejsze.' };
  if (streak === 100) return { headline: 'Setka!', body: '100 dni codziennego gestu.\nTo jest coś wielkiego.' };
  if (streak === 365) return { headline: 'Cały rok!', body: '365 dni spokoju.\nJesteś niesamowita.' };
  return { headline: `${streak} dni!`, body: 'Świetna seria!' };
}

function milestoneTextRecipient(streak: number, name: string): { headline: string; body: string } {
  if (streak === 7) return { headline: 'Cały tydzień!', body: `${name} daje znak siedem dni z rzędu.\nMacie rytuał.` };
  if (streak === 14) return { headline: 'Dwa tygodnie!', body: `Połowa miesiąca codziennego kontaktu z ${name.toLowerCase()}.` };
  if (streak === 21) return { headline: 'Trzy tygodnie!', body: `${name} trzyma rytm.\nTo już nawyk.` };
  if (streak === 30) return { headline: 'Cały miesiąc!', body: `30 dni spokoju,\nże u ${name.toLowerCase()} wszystko OK.` };
  if (streak === 50) return { headline: '50 dni!', body: `${name} nie opuszcza dnia.\nMacie to.` };
  if (streak === 100) return { headline: 'Setka!', body: `100 dni znaku od ${name.toLowerCase()}.\nNiesamowite.` };
  if (streak === 365) return { headline: 'Cały rok!', body: `365 dni spokoju\nz ${name.toLowerCase()}.` };
  return { headline: `${streak} dni!`, body: `${name} trzyma serię.` };
}

export function MilestoneCelebration({ visible, streak, recipientName, perspective = 'signaler', srcUserId = null, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      haptics.success();
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const name = recipientName || 'bliska osoba';
  const { headline, body } = perspective === 'recipient'
    ? milestoneTextRecipient(streak, name)
    : milestoneTextSignaler(streak);

  const handleShare = async () => {
    const shareType = `milestone_${perspective}_${streak}d`;
    const url = buildPeerShareUrl(srcUserId, shareType);
    const msg = perspective === 'recipient'
      ? `Od ${streak} dni dostaję od ${name} codzienny znak, że u niej OK. Bez dzwonienia, bez stresu. Spokój w tle.\n\n${url}`
      : `Od ${streak} dni codziennie daję ${name} znak, że u mnie OK. Bez dzwonienia, bez stresu. Jeden tap i spokój.\n\n${url}`;
    try {
      const result = await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
      if (result.action === Share.sharedAction) analytics.milestoneShared(streak, perspective, shareType);
    } catch { /* cancelled */ }
  };

  return (
    <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
      <Particles visible={true} count={16} colors={[Colors.safe, Colors.love, Colors.highlight, Colors.delight]} />
      <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={s.streakNumber}>{streak}</Text>
        <Text style={s.headline}>{headline}</Text>
        <Text style={s.body}>{body}</Text>

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          accessibilityRole="button"
          accessibilityLabel={`Podziel się ${streak}-dniową serią z kimś bliskim`}
        >
          <Text style={s.shareBtnText}>Podziel się z kimś bliskim</Text>
        </Pressable>

        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [s.dismissBtn, pressed && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel="Zamknij gratulacje"
        >
          <Text style={s.dismissText}>Zamknij</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayStrong,
    justifyContent: 'center', alignItems: 'center', padding: 32,
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.background, borderRadius: 28, padding: 36,
    alignItems: 'center', width: '100%', maxWidth: 320,
  },
  streakNumber: {
    fontSize: 56, fontFamily: Typography.headingFamily, color: Colors.safe,
    marginBottom: 4,
  },
  headline: {
    fontSize: 24, fontFamily: Typography.headingFamily, color: Colors.text,
    textAlign: 'center', marginBottom: 8,
  },
  body: {
    fontSize: 15, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: 16,
    paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center',
    width: '100%',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16,
  },
  shareBtnText: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: '#FFFFFF' },
  dismissBtn: { marginTop: 16, minHeight: 40, justifyContent: 'center' },
  dismissText: { fontSize: 14, color: Colors.textMuted },
});
