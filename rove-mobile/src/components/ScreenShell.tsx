import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoveTheme } from '../design/theme';
import { tokens } from '../design/tokens';

export function ScreenShell({ children, bottomSafe = false, fill = false }: { children: ReactNode; bottomSafe?: boolean; fill?: boolean }) {
  const { colors } = useRoveTheme();
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={bottomSafe ? ['top','bottom','left','right'] : ['top','left','right']}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <View style={[styles.content, fill && styles.fill]}>{children}</View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: tokens.layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 17, paddingBottom: 48 },
  fill: { flexGrow: 1 },
});
