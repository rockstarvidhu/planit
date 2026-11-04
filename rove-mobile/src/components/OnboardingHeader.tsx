import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingProgress } from './OnboardingProgress';
import { fonts, useRoveTheme } from '../design/theme';

export function OnboardingHeader({ current, onBack, onSkip }: { current: 1 | 2; onBack: () => void; onSkip: () => void }) {
  const { colors } = useRoveTheme();
  return <>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
        <Text style={{ color: colors.accent, fontFamily: fonts.body, fontSize: 29, lineHeight: 34 }}>←</Text>
      </Pressable>
      <OnboardingProgress current={current} />
      <Pressable accessibilityRole="button" accessibilityLabel="Skip optional setup" onPress={onSkip} style={styles.skip}>
        <Text style={{ color: colors.accent, fontFamily: fonts.medium, fontSize: 15 }}>Skip</Text>
      </Pressable>
    </View>
  </>;
}

const styles = StyleSheet.create({ row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 52, minHeight: 48, justifyContent: 'center' }, skip: { width: 52, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end' } });
