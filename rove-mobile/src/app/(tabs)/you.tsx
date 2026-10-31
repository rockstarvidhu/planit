import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { ScreenShell } from '../../components/ScreenShell';
import { tokens } from '../../design/tokens';

export default function You() {
  return (
    <ScreenShell>
      <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
      <Text style={styles.title}>You</Text>
      <Text style={styles.intro}>A few small choices will make Rove feel like yours.</Text>

      <EditorialSection title="Preferences">
        <View style={styles.row}><Text style={styles.rowTitle}>Home area</Text><Text style={styles.rowNote}>Coming later</Text></View>
        <View style={styles.row}><Text style={styles.rowTitle}>Interests</Text><Text style={styles.rowNote}>Coming later</Text></View>
      </EditorialSection>

      {__DEV__ && (
        <EditorialSection title="Development">
          <Link href="/dev/health" asChild>
            <Pressable accessibilityRole="button" style={styles.devLink}>
              <Text style={styles.devLinkText}>Backend connectivity check</Text>
            </Pressable>
          </Link>
        </EditorialSection>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: tokens.colors.forestMuted, fontSize: tokens.typography.sizes.caption, fontWeight: '700', letterSpacing: 1.6 },
  title: { color: tokens.colors.ink, fontFamily: tokens.typography.displayFamily, fontSize: tokens.typography.sizes.title, lineHeight: tokens.typography.lineHeights.title, marginTop: tokens.spacing.xxl },
  intro: { color: tokens.colors.forestMuted, fontSize: tokens.typography.sizes.body, lineHeight: tokens.typography.lineHeights.body, marginTop: tokens.spacing.sm },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: tokens.colors.line, borderBottomWidth: tokens.borders.hairline },
  rowTitle: { color: tokens.colors.ink, fontSize: tokens.typography.sizes.body },
  rowNote: { color: tokens.colors.mutedText, fontSize: tokens.typography.sizes.caption },
  devLink: { minHeight: tokens.layout.touchTarget, justifyContent: 'center' },
  devLinkText: { color: tokens.colors.forest, fontSize: tokens.typography.sizes.body, fontWeight: '600' },
});
