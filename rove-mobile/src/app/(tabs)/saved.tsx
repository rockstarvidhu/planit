import { StyleSheet, Text, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { ScreenShell } from '../../components/ScreenShell';
import { tokens } from '../../design/tokens';

export default function Saved() {
  return (
    <ScreenShell>
      <Text style={styles.eyebrow}>KEEP CLOSE</Text>
      <Text style={styles.title}>Saved</Text>
      <Text style={styles.intro}>Keep a little list of places worth returning to.</Text>

      <EditorialSection title="Places">
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>Places you save while exploring will live here.</Text>
        </View>
      </EditorialSection>
      <EditorialSection title="Outings">
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No saved outings</Text>
          <Text style={styles.emptyBody}>Keep a favorite day close for another time.</Text>
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
