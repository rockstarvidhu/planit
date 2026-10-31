import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../design/tokens';

export function ScreenShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.ivory },
  scroll: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: tokens.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: tokens.layout.pagePadding,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxxl,
  },
});
