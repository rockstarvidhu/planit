import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { usePlanLibrary } from '../state/PlanLibraryContext';

const mascot = require('../../assets/discover/rove_map_holding_mascot.png');
export default function SaveConfirmation() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useRoveTheme();
  const { ready, plans } = usePlanLibrary();
  const item = plans.find(plan => plan.id === id);
  return <ScreenShell bottomSafe fill><View style={styles.center}>
    {item && <Image source={mascot} resizeMode="contain" accessibilityLabel="Rove explorer" style={styles.mascot} />}
    <Text style={[styles.title, { color: colors.text }]}>{item ? 'Plan saved!' : ready ? 'Plan unavailable' : 'Checking your plans…'}</Text>
    <Text style={[styles.body, { color: colors.muted }]}>{item ? `${item.name} is saved on this device as a fictional, provisional plan.` : ready ? 'This plan was not found in local storage.' : 'Please wait while saved plans load.'}</Text>
    {item && <ActionButton label="View plan" onPress={() => router.replace({ pathname: '/plan/[id]', params: { id: item.id } } as Href)} />}
    <ActionButton label="Plan another day" secondary onPress={() => router.replace('/(tabs)')} />
  </View></ScreenShell>;
}
const styles = StyleSheet.create({
  center: { flex: 1, minHeight: 510, alignItems: 'center', justifyContent: 'center', gap: 15 },
  mascot: { width: 170, height: 170 }, title: { fontFamily: fonts.editorialExtraBold, fontSize: 32, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 22 },
});
