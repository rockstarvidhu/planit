/** Milestone 2 working tokens. The supplied reference values remain provisional. */
export const tokens = {
  status: 'PROVISIONAL' as const,
  colors: {
    forest: '#193829',
    forestMuted: '#365E4C',
    ivory: '#F5F2E9',
    paper: '#FBFAF5',
    sage: '#DDE4D8',
    ink: '#172B24',
    mutedText: '#65766E',
    line: '#D8DDD4',
    white: '#FFFFFF',
  },
  typography: {
    // Android system families until the owner supplies approved, licensed fonts.
    displayFamily: 'serif',
    bodyFamily: 'sans-serif',
    sizes: { caption: 12, body: 15, section: 19, title: 34 },
    lineHeights: { caption: 17, body: 23, section: 26, title: 39 },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radii: { small: 8, input: 14, pill: 999 },
  borders: { hairline: 1, color: '#D8DDD4' },
  layout: { contentMaxWidth: 600, pagePadding: 24, touchTarget: 48, tabBarMinHeight: 60 },
} as const;
