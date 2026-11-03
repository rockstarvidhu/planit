import { useColorScheme } from 'react-native';
import { useDiscovery } from '../state/DiscoveryContext';

export const palettes = {
  light: {
    background: '#F6F3EB', surface: '#FFFEFA', interactive: '#F0F1E8', text: '#182E25', muted: '#63766B', accent: '#244A39', border: '#D9DED5',
    card: '#E8EEDF', cardText: '#182E25', cardAction: '#185B2D', buttonText: '#FFFFFF', chip: '#E8EDDF', imageShade: '#182E25', outer: '#E5E9DF',
  },
  dark: {
    background: '#080908', surface: '#171A18', interactive: '#202520', text: '#F5F3EB', muted: '#A7B2A9', accent: '#88AC91', border: '#303831',
    card: '#162B1F', cardText: '#F5F3EB', cardAction: '#A7D39D', buttonText: '#102019', chip: '#1A2C20', imageShade: '#182E25', outer: '#101510',
  },
} as const;

export const fonts = {
  display: 'DMSerifDisplay_400Regular',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export function useRoveTheme() {
  const system = useColorScheme();
  const { themePreference } = useDiscovery();
  const mode = themePreference === 'system' ? (system === 'dark' ? 'dark' : 'light') : themePreference;
  return { mode, colors: palettes[mode], fonts };
}
