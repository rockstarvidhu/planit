import { StyleSheet, View } from 'react-native';
import { useRoveTheme } from '../design/theme';
export function OnboardingProgress({ current }: { current: 1 | 2 }) {
  const { colors } = useRoveTheme();
  return <View accessibilityLabel={`Setup step ${current} of 2`} style={styles.row}>
    {[1,2].map((step) => <View key={step} style={[styles.bar,{ backgroundColor: step <= current ? colors.accent : colors.border }]} />)}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection:'row', gap:8, alignItems:'center' }, bar: { width:36, height:4, borderRadius:2 } });
