import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '../design/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.ivory } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dev/health" options={{ headerShown: __DEV__, title: 'Backend check' }} />
      </Stack>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
