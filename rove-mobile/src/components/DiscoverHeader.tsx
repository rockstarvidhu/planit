import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandWordmark } from './BrandWordmark';
import { HandoffIcon } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';

export function DiscoverHeader() {
  const { colors, mode } = useRoveTheme();
  const { location } = useDiscovery();
  return <View>
    <View style={styles.row}>
      <BrandWordmark width={105} color={mode === 'dark' ? colors.text : colors.accent} />
      <Link href="/you" asChild>
        <Pressable accessibilityLabel="Open profile" accessibilityRole="button" style={styles.profile}>
          <HandoffIcon name="user" color={colors.text} size={26} />
        </Pressable>
      </Link>
    </View>
    <Link href="/location" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose area, current area ${location?.label ?? 'not selected'}`} style={styles.location}>
        <HandoffIcon name="map-pin" color={colors.accent} size={18} />
        <Text numberOfLines={1} style={[styles.locationText, { color: colors.accent }]}>{location?.label ?? 'Choose area'}</Text>
        <Text style={[styles.chevron, { color: colors.accent }]}>⌄</Text>
      </Pressable>
    </Link>
  </View>;
}

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  location: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  locationText: { fontFamily: fonts.semibold, fontSize: 14, flexShrink: 1 },
  chevron: { fontSize: 19, lineHeight: 22, marginLeft: 2 },
});
