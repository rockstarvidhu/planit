import { router } from 'expo-router';
import type { ComponentRef } from 'react';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { onboardingArt } from '../../assets/onboardingArt';
import { FirstLaunchButton } from '../../components/FirstLaunchButton';
import { FirstLaunchScreen } from '../../components/FirstLaunchScreen';
import { OnboardingHeader } from '../../components/OnboardingHeader';
import { formatRupees } from '../../components/BudgetControls';
import { fonts, useRoveTheme } from '../../design/theme';
import { parseBudget, totalBudget, useDiscovery } from '../../state/DiscoveryContext';

const presets = [500, 1000, 2000] as const;

export default function Preferences() {
  const { budgetAmount, setBudgetAmount, budgetMode, setBudgetMode, people, setPeople, setStep, completeOnboarding } = useDiscovery();
  const { colors, mode } = useRoveTheme();
  const { width, height } = useWindowDimensions();
  const [draft, setDraft] = useState(formatRupees(budgetAmount));
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const amount = parseBudget(draft);
  const compact = height < 820;
  const artWidth = Math.min(width - 44, compact ? 215 : height < 900 ? 230 : 255);
  const finish = async () => { await completeOnboarding(); router.replace('/(tabs)'); };
  const back = () => { setStep('location'); router.replace('/onboarding/location'); };
  const selectAmount = (next: number) => { setBudgetAmount(next); setDraft(formatRupees(next)); };
  const adjustAmount = (delta: number) => selectAmount(Math.min(1000000, Math.max(100, (amount ?? budgetAmount) + delta)));
  const total = totalBudget(amount ?? budgetAmount, budgetMode, people);
  return <FirstLaunchScreen>
    <OnboardingHeader current={2} onBack={back} onSkip={finish} />
    <Text style={[styles.title, { color: colors.text, marginTop: compact ? 19 : 24 }]}>What’s your plan for today?</Text>
    <Text style={[styles.body, { color: colors.text }]}>Tell us your budget and we’ll curate the best options for you.</Text>
    <Image source={onboardingArt.budget[mode]} resizeMode="contain" style={[styles.art, { width: artWidth, height: artWidth * 1110 / 1582 }]} accessibilityLabel="Rove explorer holding a wallet" />
    <Text style={[styles.label, { color: colors.text }]}>Your budget (for the day)</Text>
    <View style={[styles.amountRow, { borderColor: colors.accent, backgroundColor: colors.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Decrease budget by 500 rupees" onPress={() => adjustAmount(-500)} style={styles.adjust}><Text style={[styles.adjustText, { color: colors.accent }]}>−</Text></Pressable>
      <TextInput ref={input} accessibilityLabel="Budget in Indian rupees" keyboardType="number-pad" selectTextOnFocus value={draft}
        onChangeText={(text) => { const valid = parseBudget(text); setDraft(valid === null ? text : formatRupees(valid)); if (valid !== null) setBudgetAmount(valid); }}
        onBlur={() => { if (amount !== null) setDraft(formatRupees(amount)); }} placeholder="₹1,000" placeholderTextColor={colors.muted}
        style={[styles.amountInput, { color: colors.text }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Increase budget by 500 rupees" onPress={() => adjustAmount(500)} style={styles.adjust}><Text style={[styles.adjustText, { color: colors.accent }]}>+</Text></Pressable>
    </View>
    <View style={styles.presets}>
      {presets.map((preset) => <Pressable key={preset} accessibilityRole="button" accessibilityState={{ selected: amount === preset }} onPress={() => selectAmount(preset)} style={[styles.preset, { backgroundColor: amount === preset ? colors.accent : 'transparent', borderColor: colors.accent }]}>
        <Text style={{ color: amount === preset ? colors.buttonText : colors.accent, fontFamily: fonts.semibold, fontSize: 13 }}>{formatRupees(preset)}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Enter a custom budget" onPress={() => input.current?.focus()} style={[styles.preset, { borderColor: colors.accent }]}>
        <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 13 }}>Custom</Text>
      </Pressable>
    </View>
    <View style={styles.modes}>
      {(['total', 'perPerson'] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: budgetMode === option }} onPress={() => setBudgetMode(option)} style={[styles.mode, { backgroundColor: budgetMode === option ? colors.accent : colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: budgetMode === option ? colors.buttonText : colors.text, fontFamily: budgetMode === option ? fonts.semibold : fonts.medium, fontSize: 13 }}>{option === 'total' ? 'Total budget' : 'Per person'}</Text>
      </Pressable>)}
    </View>
    <Text style={[styles.groupLabel, { color: colors.text }]}>How many people?</Text>
    <View style={styles.peopleRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Decrease people" disabled={people <= 1} onPress={() => setPeople(Math.max(1, people - 1))}
        style={[styles.peopleButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: people <= 1 ? 0.4 : 1 }]}>
        <Text style={[styles.peopleSymbol, { color: colors.text }]}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${people} people`} style={[styles.peopleCount, { color: colors.text }]}>{people} {people === 1 ? 'person' : 'people'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Increase people" disabled={people >= 20} onPress={() => setPeople(Math.min(20, people + 1))}
        style={[styles.peopleButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: people >= 20 ? 0.4 : 1 }]}>
        <Text style={[styles.peopleSymbol, { color: colors.text }]}>+</Text>
      </Pressable>
    </View>
    <Text style={[styles.calculation, { color: colors.muted }]}>{amount === null ? 'Enter a whole amount from ₹100 to ₹10,00,000.' : `${formatRupees(total)} total · ${formatRupees(Math.round(total / people))} per person`}</Text>
    <View style={styles.action}><FirstLaunchButton label="Continue" arrow onPress={finish} disabled={amount === null} /></View>
  </FirstLaunchScreen>;
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, textAlign: 'center', paddingHorizontal: 9 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 13, paddingHorizontal: 12 },
  art: { alignSelf: 'center', marginTop: 10 },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, marginTop: 10, marginBottom: 9 },
  amountRow: { minHeight: 62, borderWidth: 1.5, borderRadius: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adjust: { width: 50, minHeight: 59, alignItems: 'center', justifyContent: 'center' },
  adjustText: { fontFamily: fonts.body, fontSize: 28, lineHeight: 34 },
  amountInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 25, textAlign: 'center', paddingVertical: 0 },
  presets: { flexDirection: 'row', gap: 7, marginTop: 12 },
  preset: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', gap: 9, marginTop: 20 },
  mode: { minHeight: 42, borderWidth: 1, borderRadius: 22, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { fontFamily: fonts.semibold, fontSize: 14, marginTop: 19, marginBottom: 9 },
  peopleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  peopleButton: { width: 46, height: 46, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  peopleSymbol: { fontFamily: fonts.body, fontSize: 23, lineHeight: 29 },
  peopleCount: { minWidth: 108, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'center' },
  calculation: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  action: { marginTop: 'auto', paddingTop: 20, paddingHorizontal: 6, paddingBottom: 22 },
});
