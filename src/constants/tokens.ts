/** Shared design tokens — single source of truth for radius, spacing, shadows */

export const Radius = {
  sm: 16,
  md: 24,
  lg: 32,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** Horizontal padding for screen-level content */
  screen: 20,
  /** Internal padding for cards */
  card: 20,
  /** Internal padding for hero / primary cards */
  cardLarge: 24,
  /** Gap between stacked cards / sections */
  sectionGap: 14,
  /** Smaller gap between related elements */
  itemGap: 8,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#201813',
    shadowOffset: { width: 0, height: 8 } as const,
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#201813',
    shadowOffset: { width: 0, height: 12 } as const,
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 6,
  },
  button: {
    shadowColor: '#201813',
    shadowOffset: { width: 0, height: 6 } as const,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  primaryGlow: {
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;
