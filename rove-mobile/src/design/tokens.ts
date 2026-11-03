import { Platform } from 'react-native';

/** Working values guided by the approved reference; final brand tokens remain provisional. */
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
    // Platform fonts require no bundled font license.
    displayFamily: Platform.OS === 'web' ? 'Georgia' : 'serif',
    bodyFamily: Platform.OS === 'web' ? 'Arial' : 'sans-serif',
    sizes: { micro: 11, caption: 12, body: 14, section: 19, title: 30 },
    lineHeights: { caption: 17, body: 21, section: 26, title: 36 },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radii: { small: 8, input: 18, pill: 999 },
  borders: { hairline: 1, color: '#D8DDD4' },
  layout: { webCanvasWidth: 430, contentMaxWidth: 430, pagePadding: 22, touchTarget: 48, tabBarMinHeight: 64 },
} as const;
