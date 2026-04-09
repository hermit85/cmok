import Svg, { Circle, Line } from 'react-native-svg';
import { Colors } from '../constants/colors';

interface BrandMotifProps {
  size?: number;
}

export function BrandMotif({ size = 72 }: BrandMotifProps) {
  const dotR = 7;
  const lineY = size / 2;
  const leftX = size * 0.25;
  const rightX = size * 0.75;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Line
        x1={leftX + dotR}
        y1={lineY}
        x2={rightX - dotR}
        y2={lineY}
        stroke={Colors.border}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={leftX} cy={lineY} r={dotR} fill={Colors.accent} />
      <Circle cx={rightX} cy={lineY} r={dotR} fill={Colors.safe} />
    </Svg>
  );
}
