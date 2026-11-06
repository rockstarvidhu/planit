import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { BrandWordmark } from './BrandWordmark';
import { HandoffIcon } from './HandoffIcon';
import { useRoveTheme } from '../design/theme';

export function DiscoverHeader() {
  const { colors, mode } = useRoveTheme();
  return <View style={styles.row}>
    <BrandWordmark width={105} color={mode === 'dark' ? colors.text : colors.accent} />
    <Link href="/you" asChild>
      <Pressable accessibilityLabel="Open profile" accessibilityRole="button" style={styles.profile}>
        <HandoffIcon name="user" color={colors.text} size={26} />
      </Pressable>
    </Link>
  </View>;
}

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
