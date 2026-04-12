import { Text, TextStyle, StyleProp, Platform } from 'react-native';

interface EmojiProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Renders emoji with platform-native system font.
 * Must NOT be nested inside <Text> with custom fontFamily —
 * place as a sibling View, or use allowFontScaling={false}.
 */
export function Emoji({ children, style }: EmojiProps) {
  return (
    <Text
      style={[
        {
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
        },
        style,
      ]}
      allowFontScaling={false}
    >
      {children}
    </Text>
  );
}
