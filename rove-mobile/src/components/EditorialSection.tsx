import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../design/tokens';

export function EditorialSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.rule} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: tokens.spacing.xxxl },
  title: {
    color: tokens.colors.ink,
    fontFamily: tokens.typography.displayFamily,
    fontSize: tokens.typography.sizes.section,
    lineHeight: tokens.typography.lineHeights.section,
  },
  rule: { height: tokens.borders.hairline, backgroundColor: tokens.colors.line, marginTop: tokens.spacing.md },
});
