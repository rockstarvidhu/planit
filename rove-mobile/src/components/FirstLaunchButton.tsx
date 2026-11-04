import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HandoffIcon } from './HandoffIcon';
import type { HandoffIconName } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';

export function FirstLaunchButton({ label, onPress, secondary = false, disabled = false, arrow = false, leadingIcon }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; arrow?: boolean; leadingIcon?: HandoffIconName;
}) {
  const { colors } = useRoveTheme();
  const foreground = secondary ? colors.accent : colors.buttonText;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.button, { backgroundColor: secondary ? 'transparent' : colors.accent, borderColor: colors.accent, opacity: disabled ? 0.5 : 1 }]}>
    <View style={styles.contents}>
      {leadingIcon && <HandoffIcon name={leadingIcon} color={foreground} size={20} />}
      <Text style={{ color: foreground, fontFamily: fonts.semibold, fontSize: 16 }}>{label}</Text>
      {arrow && <HandoffIcon name="arrow-right" color={foreground} size={21} />}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 54, width: '100%', borderWidth: 1.5, borderRadius: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  contents: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
