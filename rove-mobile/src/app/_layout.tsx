import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useRoveTheme } from '../design/theme';
import { DiscoveryProvider, useDiscovery } from '../state/DiscoveryContext';
import { tokens } from '../design/tokens';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { ready } = useDiscovery();
  const { mode, colors } = useRoveTheme();
  const [fontsLoaded, fontError] = useFonts({ DMSerifDisplay_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const prepared = ready && (fontsLoaded || !!fontError);
  useEffect(() => { if (prepared) SplashScreen.hideAsync(); }, [prepared]);
  if (!prepared) return null;
  return <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.outer }}>
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding/location" />
        <Stack.Screen name="onboarding/preferences" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="planning-entry" />
        <Stack.Screen name="places" />
        <Stack.Screen name="dev/health" options={{ headerShown: __DEV__, title: 'Backend check' }} />
        <Stack.Screen name="dev/launch" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="location" />
      </Stack>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </View>
  </SafeAreaProvider>;
}

export default function RootLayout() {
  return <DiscoveryProvider><RootContent /></DiscoveryProvider>;
}

const styles = StyleSheet.create({
  canvas: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? tokens.layout.webCanvasWidth : undefined, alignSelf: 'center' },
});
