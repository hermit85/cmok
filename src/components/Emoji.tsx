import { Text, TextStyle, StyleProp } from 'react-native';

interface EmojiProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Renders emoji with platform-native font (no custom fontFamily).
 * Use this everywhere emoji appears inside Text with custom fonts,
 * otherwise the emoji may render as squares or tofu on some devices.
 */
export function Emoji({ children, style }: EmojiProps) {
  return <Text style={[{ fontFamily: undefined }, style]}>{children}</Text>;
}
