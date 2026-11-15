import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ActionButton } from '../../components/ActionButton';
import { formatRupees } from '../../components/BudgetControls';
import { ItineraryView } from '../../components/ItineraryView';
import { ScreenShell } from '../../components/ScreenShell';
import { fonts, useRoveTheme } from '../../design/theme';
import { usePlanLibrary } from '../../state/PlanLibraryContext';

export default function SavedPlanDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useRoveTheme();
  const { ready, plans } = usePlanLibrary();
  const item = plans.find(plan => plan.id === id);
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Plans" onPress={() => router.replace('/(tabs)/plans')} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Plans</Text></Pressable>
    {!item ? <><Text style={[styles.title, { color: colors.text }]}>{ready ? 'Saved plan unavailable' : 'Loading your plan…'}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>This plan is missing or its stored data could not be verified.</Text>
      <ActionButton label="Go to Plans" onPress={() => router.replace('/(tabs)/plans')} /></> : <>
      <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{item.area} · {item.preferences.people} {item.preferences.people === 1 ? 'person' : 'people'} · {item.preferences.availableMinutes} min</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Budget: {formatRupees(item.preferences.budgetAmount)} {item.preferences.budgetMode === 'perPerson' ? 'per person' : 'total'}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Saved locally on {new Date(item.savedAt).toLocaleDateString()}.</Text>
      <ItineraryView plan={item.plan} provisional demo warnings={[{ code: 'FICTIONAL_FIXTURE_DATA' }]}
        onStop={index => router.push({ pathname: '/stop-details', params: { savedId: item.id, stopIndex: String(index) } } as Href)} />
      <Text style={[styles.body, { color: colors.muted, marginTop: 25 }]}>Saved schedules are snapshots. Recheck all details before traveling. Editing a saved snapshot requires a fresh planning request and is unavailable offline.</Text>
      <ActionButton label="Plan another day" onPress={() => router.replace('/(tabs)')} />
    </>}
  </ScreenShell>;
}
const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, title: { fontFamily: fonts.editorialExtraBold, fontSize: 31, lineHeight: 38, marginTop: 20 },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, marginTop: 9 },
});
