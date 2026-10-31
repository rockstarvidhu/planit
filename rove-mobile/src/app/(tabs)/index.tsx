import { useState } from 'react';
import { Image, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { ScreenShell } from '../../components/ScreenShell';
import { tokens } from '../../design/tokens';

const mascot = require('../../../assets/mascot/explorer-walking-original.png');

export default function Discover() {
  const [location, setLocation] = useState('');

  return (
    <ScreenShell>
      <Text style={styles.eyebrow}>DISCOVER</Text>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Where to today?</Text>
          <Text style={styles.intro}>Good places, closer to home.</Text>
        </View>
        <Image source={mascot} resizeMode="contain" style={styles.mascot} accessibilityLabel="Rove explorer mascot" />
      </View>

      <Text style={styles.label}>Start with a place</Text>
      <TextInput
        accessibilityLabel="City or area"
        autoCapitalize="words"
        autoCorrect={false}
        onChangeText={setLocation}
        onSubmitEditing={Keyboard.dismiss}
        placeholder="City or area"
        placeholderTextColor={tokens.colors.mutedText}
        returnKeyType="done"
        style={styles.input}
        value={location}
      />
      <Text style={styles.helper}>
        {location.trim() ? `Exploring from ${location.trim()} — suggestions arrive in a later milestone.`
          : 'Enter a starting point. Suggestions arrive in a later milestone.'}
      </Text>

      <EditorialSection title="For your kind of day">
        <View style={styles.row}><Text style={styles.rowTitle}>Food & drinks</Text><Text style={styles.rowNote}>Coming soon</Text></View>
        <View style={styles.row}><Text style={styles.rowTitle}>Nature & outdoors</Text><Text style={styles.rowNote}>Coming soon</Text></View>
        <View style={styles.row}><Text style={styles.rowTitle}>Culture & more</Text><Text style={styles.rowNote}>Coming soon</Text></View>
      </EditorialSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: tokens.colors.forestMuted, fontSize: tokens.typography.sizes.caption, fontWeight: '700', letterSpacing: 1.6 },
  hero: { flexDirection: 'row', alignItems: 'center', marginTop: tokens.spacing.xxl, marginBottom: tokens.spacing.xxxl },
  heroCopy: { flex: 1, paddingRight: tokens.spacing.sm },
  title: { color: tokens.colors.ink, fontFamily: tokens.typography.displayFamily, fontSize: tokens.typography.sizes.title, lineHeight: tokens.typography.lineHeights.title },
  intro: { color: tokens.colors.forestMuted, fontSize: tokens.typography.sizes.body, lineHeight: tokens.typography.lineHeights.body, marginTop: tokens.spacing.sm },
  mascot: { width: 92, height: 100 },
  label: { color: tokens.colors.ink, fontSize: tokens.typography.sizes.body, fontWeight: '600', marginBottom: tokens.spacing.md },
  input: { backgroundColor: tokens.colors.paper, borderColor: tokens.colors.line, borderWidth: tokens.borders.hairline, borderRadius: tokens.radii.input, color: tokens.colors.ink, fontSize: tokens.typography.sizes.body, minHeight: tokens.layout.touchTarget, paddingHorizontal: tokens.spacing.lg },
  helper: { color: tokens.colors.mutedText, fontSize: tokens.typography.sizes.caption, lineHeight: tokens.typography.lineHeights.caption, marginTop: tokens.spacing.sm },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: tokens.colors.line, borderBottomWidth: tokens.borders.hairline },
  rowTitle: { color: tokens.colors.ink, fontSize: tokens.typography.sizes.body },
  rowNote: { color: tokens.colors.mutedText, fontSize: tokens.typography.sizes.caption },
});
