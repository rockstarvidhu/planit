import { router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { v2Art } from '../../assets/v2Art';
import { ActionButton } from '../../components/ActionButton';
import { BudgetEditor, PeopleStepper } from '../../components/BudgetControls';
import { OnboardingHeader } from '../../components/OnboardingHeader';
import { ScreenShell } from '../../components/ScreenShell';
import { fonts, useRoveTheme } from '../../design/theme';
import { useDiscovery } from '../../state/DiscoveryContext';

export default function Preferences() {
  const { setStep, completeOnboarding } = useDiscovery();
  const { colors, mode } = useRoveTheme();
  const { width } = useWindowDimensions();
  const [budgetValid, setBudgetValid] = useState(true);
  const finish = async () => { await completeOnboarding(); router.replace('/(tabs)'); };
  const back = () => { setStep('location'); router.replace('/onboarding/location'); };
  const artHeight = Math.min(180, Math.max(136, (Math.min(width, 430) - 44) * 0.42));
  return <ScreenShell bottomSafe fill>
    <OnboardingHeader current={2} onBack={back} />
    <Text style={[styles.title, { color: colors.text }]}>A little about your outings.</Text>
    <Text style={[styles.body, { color: colors.muted }]}>You can always change these later.</Text>
    <Image source={v2Art.budget[mode]} resizeMode="cover" style={[styles.art, { height: artHeight }]} accessibilityLabel="Illustrated wallet and landscape" />
    <View style={styles.budget}><BudgetEditor onValidityChange={setBudgetValid} showSaveAction={false} large /></View>
    <Text style={[styles.groupLabel, { color: colors.text }]}>How many people?</Text>
    <PeopleStepper />
    <View style={styles.actions}>
      <ActionButton label="Let’s explore" onPress={finish} disabled={!budgetValid} />
      <ActionButton label="Skip for now" secondary onPress={finish} />
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, marginTop: 27 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: 8 },
  art: { width: '100%', marginTop: 12 },
  budget: { marginTop: 17 },
  groupLabel: { fontFamily: fonts.semibold, fontSize: 14, marginTop: 21, marginBottom: 12 },
  actions: { gap: 4, marginTop: 'auto', paddingTop: 23 },
});
