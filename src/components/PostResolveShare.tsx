/**
 * PostResolveShare — celebratory share moment after an SOS alert is resolved.
 *
 * The strongest real-world story in cmok: someone needed help, the circle
 * showed up, everyone's OK. We capture that moment and invite the user to
 * share it. Copy varies by role (who resolved, who was in trouble).
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Share, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Particles } from './Particles';
import { analytics } from '../services/analytics';
import { haptics } from '../utils/haptics';
import { buildPeerShareUrl } from '../utils/invite';

type Role = 'signaler' | 'primary' | 'trusted';

interface Props {
  visible: boolean;
  role: Role;
  /** Signaler's name (who was in trouble). For signaler perspective this is null. */
  signalerName: string | null;
  /** Current user id — passed in as prop to avoid a duplicate useRelationship
   *  call when the parent screen already has the profile loaded. */
  srcUserId?: string | null;
  onDismiss: () => void;
}

function copyFor(role: Role, name: string, shareUrl: string): { headline: string; body: string; share: string } {
  if (role === 'signaler') {
    return {
      headline: 'Już dobrze',
      body: 'Dziękujemy za to, że macie siebie.\nSpokój wraca.',
      share: `Byłam w potrzebie, krąg zareagował w kilka minut. cmok po prostu działa. Jeden tap i ktoś był ze mną.\n\n${shareUrl}`,
    };
  }
  if (role === 'primary') {
    return {
      headline: 'Zamknięte',
      body: `${name} jest bezpieczna.\nDobrze, że tam byłeś.`,
      share: `${name} potrzebowała pomocy, cmok nas powiadomił, byliśmy na miejscu w kilka minut. Każdemu z rodzicem samotnie mieszkającym się przyda.\n\n${shareUrl}`,
    };
  }
  // trusted
  return {
    headline: 'Już spokojnie',
    body: `${name} jest bezpieczna.\nDobrze, że byłeś na wezwanie.`,
    share: `${name} potrzebowała pomocy, cmok powiadomił sąsiadów i rodzinę. W kilka minut ktoś był przy niej. Działa jak bezpiecznik.\n\n${shareUrl}`,
  };
}

export function PostResolveShare({ visible, role, signalerName, srcUserId = null, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      haptics.success();
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const name = signalerName || 'bliska osoba';
  const shareType = `sos_resolved_${role}`;
  const shareUrl = buildPeerShareUrl(srcUserId, shareType);
  const { headline, body, share } = copyFor(role, name, shareUrl);

  const handleShare = async () => {
    try {
      const result = await Share.share(
        Platform.OS === 'ios' ? { message: share } : { message: share, title: 'cmok' },
      );
      if (result.action === Share.sharedAction) {
        // Use the sos_resolved_* variant so analytics matches the URL
        // `type=` param. Previously logged as peer_* which made the SOS
        // funnel look like organic peer shares — inflated peer metrics,
        // hid SOS conversion entirely.
        analytics.inviteShared(
          role === 'signaler' ? 'sos_resolved_signaler'
            : role === 'primary' ? 'sos_resolved_primary'
              : 'sos_resolved_trusted',
        );
      }
    } catch { /* cancelled */ }
  };

  return (
    <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
      <Particles visible={true} count={10} colors={[Colors.safe, Colors.love, Colors.highlight]} />
      <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={s.checkmark}>{'\u{2713}'}</Text>
        <Text style={s.headline}>{headline}</Text>
        <Text style={s.body}>{body}</Text>

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [s.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Opowiedz o cmok"
        >
          <Text style={s.shareBtnText}>Opowiedz o cmok</Text>
        </Pressable>

        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [s.dismissBtn, pressed && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
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
    justifyContent: 'center' as const, alignItems: 'center' as const, padding: 32,
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.background, borderRadius: 28, padding: 36,
    alignItems: 'center' as const, width: '100%', maxWidth: 320,
  },
  checkmark: {
    fontSize: 56, color: Colors.safe, marginBottom: 8,
    fontWeight: '300' as const,
  },
  headline: {
    fontSize: 26, fontFamily: Typography.headingFamily, color: Colors.text,
    textAlign: 'center' as const, marginBottom: 8,
  },
  body: {
    fontSize: 15, color: Colors.textSecondary, textAlign: 'center' as const,
    lineHeight: 22, marginBottom: 28,
  },
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: 16,
    paddingHorizontal: 32, justifyContent: 'center' as const, alignItems: 'center' as const,
    width: '100%',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16,
  },
  shareBtnText: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: '#FFFFFF' },
  dismissBtn: { marginTop: 16, minHeight: 40, justifyContent: 'center' as const },
  dismissText: { fontSize: 14, color: Colors.textMuted },
});
