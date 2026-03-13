import Svg, { Path, Circle, Rect, G, Line } from 'react-native-svg';

interface GeometricHeartProps {
  size?: number;
  fillColor?: string;
  accentColor?: string;
  centerColor?: string;
}

export function GeometricHeart({
  size = 200,
  fillColor = '#E07A5F',
  accentColor = '#D4A574',
  centerColor = '#F0E6D3',
}: GeometricHeartProps) {
  const s = size / 200; // scale factor

  return (
    <Svg width={size} height={size * 0.9} viewBox="0 0 200 180">
      {/* Main heart shape */}
      <Path
        d="M100 170
           C100 170, 15 110, 15 65
           C15 35, 40 15, 65 15
           C80 15, 92 25, 100 42
           C108 25, 120 15, 135 15
           C160 15, 185 35, 185 65
           C185 110, 100 170, 100 170 Z"
        fill={fillColor}
        opacity={0.95}
      />

      {/* Inner geometric folk pattern — symmetric wycinanka */}
      <G opacity={0.6}>
        {/* Central vertical line */}
        <Line x1="100" y1="50" x2="100" y2="140" stroke={accentColor} strokeWidth="1.5" />

        {/* Symmetric diamond shapes */}
        <Path
          d="M100 60 L115 80 L100 100 L85 80 Z"
          fill="none"
          stroke={accentColor}
          strokeWidth="1.5"
        />
        <Path
          d="M100 70 L108 80 L100 90 L92 80 Z"
          fill={accentColor}
          opacity={0.4}
        />

        {/* Symmetric leaf/petal shapes — left */}
        <Path
          d="M70 55 Q80 70, 85 80 Q80 75, 65 70 Z"
          fill={accentColor}
          opacity={0.35}
        />
        {/* Symmetric leaf/petal shapes — right */}
        <Path
          d="M130 55 Q120 70, 115 80 Q120 75, 135 70 Z"
          fill={accentColor}
          opacity={0.35}
        />

        {/* Horizontal lines — folk bands */}
        <Line x1="75" y1="105" x2="125" y2="105" stroke={accentColor} strokeWidth="1" opacity={0.5} />
        <Line x1="80" y1="115" x2="120" y2="115" stroke={accentColor} strokeWidth="1" opacity={0.4} />
        <Line x1="85" y1="125" x2="115" y2="125" stroke={accentColor} strokeWidth="1" opacity={0.3} />

        {/* Small decorative dots */}
        <Circle cx="75" cy="50" r="2.5" fill={accentColor} opacity={0.5} />
        <Circle cx="125" cy="50" r="2.5" fill={accentColor} opacity={0.5} />
        <Circle cx="60" cy="75" r="2" fill={accentColor} opacity={0.35} />
        <Circle cx="140" cy="75" r="2" fill={accentColor} opacity={0.35} />

        {/* Tiny stars near top */}
        <Path d="M55 45 L57 40 L59 45 L54 42 L60 42 Z" fill={accentColor} opacity={0.3} />
        <Path d="M141 45 L143 40 L145 45 L140 42 L146 42 Z" fill={accentColor} opacity={0.3} />
      </G>

      {/* Center diamond — main folk accent */}
      <Rect
        x="93"
        y="73"
        width="14"
        height="14"
        rx="1"
        fill={accentColor}
        transform="rotate(45 100 80)"
      />

      {/* Center dot */}
      <Circle cx="100" cy="80" r="3" fill={centerColor} />
    </Svg>
  );
}
