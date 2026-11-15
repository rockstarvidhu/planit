import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fonts, useRoveTheme } from '../design/theme';

const mascot = require('../../assets/discover/rove_map_holding_mascot.png');
const backdrop = require('../../assets/discover/rove_discover_sage_aqua_splash.png');

export function DiscoverHero() {
  const { colors } = useRoveTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 390 || fontScale > 1.2;
  const artWidth = Math.min(compact ? 142 : 174, width * 0.4);
  return <View style={styles.hero}>
    <View style={styles.copy}>
      <Text style={[styles.title, compact && styles.compactTitle, { color: colors.text }]}>Find your kind of day.</Text>
      <Text style={[styles.support, { color: colors.text }]}>Local outings, within your budget.{"\n"}Tell us what you’re in the mood for.</Text>
    </View>
    <View style={[styles.art, { width: artWidth, height: artWidth }]}>
      <Image source={backdrop} resizeMode="contain" style={styles.backdrop} accessibilityIgnoresInvertColors />
      <Image source={mascot} resizeMode="contain" style={styles.mascot} accessibilityLabel="Rove explorer holding a map" accessibilityIgnoresInvertColors />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, marginBottom: 10 },
  copy: { flex: 1, minWidth: 0, paddingVertical: 6 },
  title: { fontFamily: fonts.editorialExtraBold, fontSize: 35, lineHeight: 39, letterSpacing: -1.5 },
  compactTitle: { fontSize: 30, lineHeight: 34, letterSpacing: -1.2 },
  support: { fontFamily: fonts.body, fontSize: 10, lineHeight: 16, marginTop: 9 },
  art: { alignSelf: 'flex-end', flexShrink: 0 },
  backdrop: { position: 'absolute', width: '117%', height: '100%', right: -6, bottom: 0 },
  mascot: { width: '100%', height: '100%' },
});
