/**
 * Draft values copied from assets/tokens/design-tokens.proposed.json.
 * The archive calls them approximate reference samples; it provides no pixel
 * coordinates, color profile, or measured typography data. Do not treat them
 * as approved brand standards until the owner confirms the values.
 * No screen or component imports this module yet.
 */
export const proposedRoveTokens = {
  status: 'PROVISIONAL' as const,
  colors: {
    forest: '#193829',
    forestMuted: '#365E4C',
    ivory: '#F5F2E9',
    sage: '#DDE4D8',
    ink: '#172B24',
    mutedText: '#65766E',
    line: '#D8DDD4',
  },
  typography: {
    display: null, // Editorial serif; exact family and license not supplied.
    body: null, // Clean sans-serif; exact family and license not supplied.
  },
  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  radii: { small: 8, medium: 14, large: 22, pill: 999 },
} as const;
