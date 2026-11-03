import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandWordmark } from './BrandWordmark';
import { OnboardingProgress } from './OnboardingProgress';
import { fonts, useRoveTheme } from '../design/theme';

export function OnboardingHeader({ current, onBack }: { current: 1 | 2; onBack: () => void }) {
  const { colors, mode } = useRoveTheme();
  return <>
    <View style={styles.row}>
      <BrandWordmark width={77} color={mode === 'dark' ? colors.text : '#193D2E'} />
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
        <Text style={{ color: colors.accent, fontFamily: fonts.medium, fontSize: 14 }}>Back</Text>
      </Pressable>
    </View>
    <OnboardingProgress current={current} />
  </>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end' } });
