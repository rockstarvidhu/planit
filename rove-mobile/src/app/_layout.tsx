import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { palettes, useRoveTheme } from '../design/theme';
import { DiscoveryProvider, useDiscovery } from '../state/DiscoveryContext';
import { PlanningProvider } from '../state/PlanningContext';
import { PlanLibraryProvider } from '../state/PlanLibraryContext';
import { tokens } from '../design/tokens';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { ready } = useDiscovery();
  const pathname = usePathname();
  const { mode, colors } = useRoveTheme();
  const firstLaunch = pathname === '/' || pathname === '/welcome' || pathname.startsWith('/onboarding/') || pathname === '/dev/launch';
  const screenColors = firstLaunch ? palettes.light : colors;
  const [fontsLoaded, fontError] = useFonts({ DMSerifDisplay_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const prepared = ready && (fontsLoaded || !!fontError);
  // Entry hides the native splash only after its illustration has loaded.
  // Direct links to other routes still need a way to dismiss it.
  useEffect(() => { if (prepared && pathname !== '/') SplashScreen.hideAsync(); }, [prepared, pathname]);
  if (!prepared) return null;
  return <SafeAreaProvider style={{ flex: 1, backgroundColor: screenColors.outer }}>
    <View style={[styles.canvas, { backgroundColor: screenColors.background }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: screenColors.background } }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding/location" />
        <Stack.Screen name="onboarding/preferences" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="planning-entry" />
        <Stack.Screen name="planning" />
        <Stack.Screen name="results" />
        <Stack.Screen name="stop-details" />
        <Stack.Screen name="edit-plan" />
        <Stack.Screen name="save-plan" />
        <Stack.Screen name="save-confirmation" />
        <Stack.Screen name="plan/[id]" />
        <Stack.Screen name="places" />
        <Stack.Screen name="dev/health" options={{ headerShown: __DEV__, title: 'Backend check' }} />
        <Stack.Screen name="dev/launch" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="location" />
      </Stack>
      <StatusBar style={firstLaunch || mode === 'light' ? 'dark' : 'light'} />
    </View>
  </SafeAreaProvider>;
}

export default function RootLayout() {
  return <DiscoveryProvider><PlanningProvider><PlanLibraryProvider><RootContent /></PlanLibraryProvider></PlanningProvider></DiscoveryProvider>;
}

const styles = StyleSheet.create({
  canvas: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? tokens.layout.webCanvasWidth : undefined, alignSelf: 'center' },
});
