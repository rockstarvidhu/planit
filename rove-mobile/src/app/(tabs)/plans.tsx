import { StyleSheet, Text, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { ScreenShell } from '../../components/ScreenShell';
import { tokens } from '../../design/tokens';

export default function Plans() {
  return (
    <ScreenShell>
      <Text style={styles.eyebrow}>YOUR DAYS OUT</Text>
      <Text style={styles.title}>Plans</Text>
      <Text style={styles.intro}>A place for the days you want to make happen.</Text>

      <EditorialSection title="Coming up">
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No upcoming plans yet</Text>
          <Text style={styles.emptyBody}>When you make a plan, it will appear here.</Text>
        </View>
      </EditorialSection>
      <EditorialSection title="Past plans">
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your story starts here</Text>
          <Text style={styles.emptyBody}>Past outings will have their own place.</Text>
        </View>
      </EditorialSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: tokens.colors.forestMuted, fontSize: tokens.typography.sizes.caption, fontWeight: '700', letterSpacing: 1.6 },
  title: { color: tokens.colors.ink, fontFamily: tokens.typography.displayFamily, fontSize: tokens.typography.sizes.title, lineHeight: tokens.typography.lineHeights.title, marginTop: tokens.spacing.xxl },
  intro: { color: tokens.colors.forestMuted, fontSize: tokens.typography.sizes.body, lineHeight: tokens.typography.lineHeights.body, marginTop: tokens.spacing.sm },
  empty: { paddingVertical: tokens.spacing.xl },
  emptyTitle: { color: tokens.colors.ink, fontSize: tokens.typography.sizes.body, fontWeight: '600' },
  emptyBody: { color: tokens.colors.mutedText, fontSize: tokens.typography.sizes.body, lineHeight: tokens.typography.lineHeights.body, marginTop: tokens.spacing.sm },
});
