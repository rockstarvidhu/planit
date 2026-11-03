import { Pressable, StyleSheet, Text } from 'react-native';
import { useRoveTheme } from '../design/theme';

export function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const { colors, fonts } = useRoveTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.button, { backgroundColor: secondary ? 'transparent' : colors.accent, opacity: disabled ? 0.5 : 1 }]}>
    <Text style={{ color: secondary ? colors.accent : colors.buttonText, fontFamily: fonts.semibold, fontSize: 15 }}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: 52, width: '100%', borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 } });
