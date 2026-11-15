import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { ApiClientError, createApiClient } from '../services/api';
import { editedRequest, validatedEditedResponse } from '../services/planEditing';
import { findPlan, formatTime } from '../services/planPresentation';
import { newPlanningKey } from '../services/planningFlow';
import { usePlanning } from '../state/PlanningContext';

export default function EditPlan() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const { colors } = useRoveTheme();
  const { request, response, replaceResult } = usePlanning();
  const selection = findPlan(response, planId);
  const [removed, setRemoved] = useState<string[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fixture = !!response && response.demo && response.providers.places === 'rove_fixture' && response.providers.routes === 'rove_fixture';
  const changeDuration = (id: string, current: number, delta: number) => setDurations(values => ({ ...values,
    [id]: Math.max(15, Math.min(360, (values[id] ?? current) + delta)) }));
  const save = async () => {
    if (busy || !selection || !request || !response) return;
    setBusy(true); setMessage('');
    try {
      const nextRequest = editedRequest(request, response, selection.plan,
        { excludedPlaceIds: removed, visitDurations: durations });
      const nextResponse = await createApiClient().createPlan(nextRequest, newPlanningKey());
      validatedEditedResponse(nextResponse);
      replaceResult(nextRequest, nextResponse);
      router.replace('/results');
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : 'Changes could not be saved.');
    } finally { setBusy(false); }
  };
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Results" onPress={() => router.back()} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Results</Text></Pressable>
    <Text style={[styles.title, { color: colors.text }]}>Edit your plan</Text>
    <Text style={[styles.body, { color: colors.muted }]}>Remove a stop or change a visit-time estimate. Rove checks routes, schedule and budget again before applying edits. If the original start time has passed, the new plan starts soon.</Text>
    {!selection || !request || !response ? <Text style={[styles.body, { color: colors.muted }]}>This plan is no longer available. Return to Results or start a new search.</Text> : <>
      {!fixture && <Text style={[styles.notice, { color: colors.accent }]}>Editing live plans is unavailable until a compliant revalidation flow is approved. Your original plan remains unchanged.</Text>}
      {selection.plan.stops.map((stop, index) => <View key={`${stop.placeId}-${index}`} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface, opacity: removed.includes(stop.placeId) ? 0.55 : 1 }]}>
        <Text style={[styles.stop, { color: colors.text }]}>{index + 1}. {stop.name}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{formatTime(stop.arrivalAt)} · {stop.category}</Text>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Shorten ${stop.name} visit`} disabled={!fixture || busy || removed.includes(stop.placeId)} onPress={() => changeDuration(stop.placeId, stop.visitMinutes, -15)} style={styles.touch}><Text style={[styles.control, { color: colors.accent }]}>−</Text></Pressable>
          <Text style={[styles.body, { color: colors.text }]}>{durations[stop.placeId] ?? stop.visitMinutes} min estimate</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Lengthen ${stop.name} visit`} disabled={!fixture || busy || removed.includes(stop.placeId)} onPress={() => changeDuration(stop.placeId, stop.visitMinutes, 15)} style={styles.touch}><Text style={[styles.control, { color: colors.accent }]}>+</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${removed.includes(stop.placeId) ? 'Restore' : 'Remove'} ${stop.name}`} disabled={!fixture || busy} onPress={() => setRemoved(values => values.includes(stop.placeId) ? values.filter(id => id !== stop.placeId) : [...values, stop.placeId])} style={styles.touch}>
            <Text style={[styles.remove, { color: colors.accent }]}>{removed.includes(stop.placeId) ? 'Restore' : 'Remove'}</Text>
          </Pressable>
        </View>
      </View>)}
      <Text style={[styles.body, { color: colors.muted, marginTop: 20 }]}>Reordering and alternative-stop search are unavailable: the backend cannot verify that order or find substitutes without a new provider request.</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Changes to timing and costs appear only after the backend returns a new plan. Unknown costs remain unknown.</Text>
      {!!message && <Text accessibilityRole="alert" style={[styles.notice, { color: colors.accent }]}>{message}</Text>}
      <ActionButton label={busy ? 'Checking changes…' : 'Save validated changes'} onPress={save} disabled={!fixture || busy || (!removed.length && !Object.keys(durations).length)} />
      <ActionButton label="Return to original itinerary" secondary onPress={() => router.back()} />
    </>}
  </ScreenShell>;
}
const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, title: { fontFamily: fonts.editorialExtraBold, fontSize: 31, lineHeight: 39, marginTop: 15 },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, marginTop: 7 },
  row: { borderWidth: 1, borderRadius: 13, padding: 15, marginTop: 15 }, stop: { fontFamily: fonts.editorialBold, fontSize: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  touch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, control: { fontFamily: fonts.semibold, fontSize: 22 },
  remove: { fontFamily: fonts.semibold, fontSize: 12 }, notice: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, marginTop: 19 },
});
