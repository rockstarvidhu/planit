import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { EmptyState } from '../../components/EmptyState';
import { ScreenShell } from '../../components/ScreenShell';
import { fonts, useRoveTheme } from '../../design/theme';
import { usePlanLibrary } from '../../state/PlanLibraryContext';
import type { SavedPlan } from '../../state/PlanLibraryContext';

export default function Plans() {
  const { colors } = useRoveTheme();
  const { plans, ready, error, remove } = usePlanLibrary();
  const [message, setMessage] = useState('');
  const [viewedAt] = useState(() => Date.now());
  const open = (item: SavedPlan) => router.push({ pathname: '/plan/[id]', params: { id: item.id } } as Href);
  const confirmDelete = (item: SavedPlan) => Alert.alert('Delete saved plan?', `${item.name} will be removed from this device.`, [
    { text: 'Keep plan', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { remove(item.id).catch(() => setMessage('Could not delete this plan. Try again.')); } },
  ]);
  const row = (item: SavedPlan) => <View key={item.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={() => open(item)} style={styles.open}>
      <Text style={[styles.name, { color: colors.text }]}>{item.name} →</Text>
      <Text style={[styles.meta, { color: colors.muted }]}>{item.area} · {item.plan.stops.length} {item.plan.stops.length === 1 ? 'stop' : 'stops'}</Text>
      <Text style={[styles.flag, { color: colors.accent }]}>FICTIONAL DEMO · PROVISIONAL</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} onPress={() => confirmDelete(item)} style={styles.delete}><Text style={[styles.meta, { color: colors.accent }]}>Delete</Text></Pressable>
  </View>;
  const upcoming = plans.filter(item => Date.parse(item.plan.startAt) >= viewedAt);
  const past = plans.filter(item => Date.parse(item.plan.startAt) < viewedAt);
  return <ScreenShell>
    <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR DAYS OUT</Text>
    <Text style={[styles.title, { color: colors.text }]}>Plans</Text>
    <Text style={[styles.intro, { color: colors.muted }]}>Outings saved on this device. Fictional plans stay provisional.</Text>
    {error && <Text accessibilityRole="alert" style={[styles.intro, { color: colors.accent }]}>{error}</Text>}
    {!!message && <Text accessibilityRole="alert" style={[styles.intro, { color: colors.accent }]}>{message}</Text>}
    <EditorialSection title="Coming up">{!ready ? <Text style={[styles.meta, { color: colors.muted }]}>Loading saved plans…</Text>
      : upcoming.length ? <View style={styles.list}>{upcoming.map(row)}</View>
        : <EmptyState title="No upcoming plans yet" body="Make a fictional demo plan and save it to see it here." exploreAction />}</EditorialSection>
    <EditorialSection title="Past plans">{past.length ? <View style={styles.list}>{past.map(row)}</View>
      : <EmptyState title="No past plans" body="Your earlier saved outings will appear here." />}</EditorialSection>
  </ScreenShell>;
}
const styles = StyleSheet.create({
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.3 }, title: { fontFamily: fonts.editorialExtraBold, fontSize: 32, lineHeight: 39, marginTop: 32 },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: 8 }, list: { gap: 12, paddingTop: 13 },
  row: { borderWidth: 1, borderRadius: 14, padding: 15 }, open: { minHeight: 72 }, delete: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  name: { fontFamily: fonts.editorialBold, fontSize: 17 }, meta: { fontFamily: fonts.body, fontSize: 12, marginTop: 5 },
  flag: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, marginTop: 8 },
});
