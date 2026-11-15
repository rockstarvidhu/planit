import * as Location from 'expo-location';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { BudgetEditor, DurationSelector, formatRupees, PeopleStepper } from '../components/BudgetControls';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { activities, activityLimitation, buildPlanningRequest, initialActivities, moodLimitation, moods, planningOrigin } from '../services/planningFlow';
import type { Activity, Mood } from '../services/planningFlow';
import { totalBudget, useDiscovery } from '../state/DiscoveryContext';
import { usePlanning } from '../state/PlanningContext';

export default function Personalize() {
  const { colors } = useRoveTheme();
  const { location, setLocation, budgetAmount, budgetMode, people, duration, setDuration, category } = useDiscovery();
  const { begin, phase } = usePlanning();
  const [mood, setMood] = useState<Mood | null>(null);
  const [selected, setSelected] = useState<Activity[]>(() => initialActivities(category));
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [budgetValid, setBudgetValid] = useState(true);
  const toggle = (activity: Activity) => setSelected(current => current.includes(activity)
    ? current.filter(item => item !== activity) : current.length < 3 ? [...current, activity] : current);
  const refreshDevice = async () => {
    setLocating(true); setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location access was not granted.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ kind: 'device', id: location?.kind === 'device' ? location.id : 'device:current',
        label: location?.kind === 'device' ? location.label : 'Current location',
        coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude } });
    } catch { setMessage('Could not get your current location. Choose a demo area instead.'); }
    finally { setLocating(false); }
  };
  const submit = () => {
    setMessage('');
    try {
      if (!budgetValid) throw new Error('Enter a valid budget before planning.');
      const request = buildPlanningRequest({ location, budgetAmount, budgetMode, people, duration, mood, activities: selected });
      if (begin(request)) router.push('/planning' as Href);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Complete your planning choices.'); }
  };
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Discover" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Back</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.accent }]}>MAKE IT YOUR DAY</Text>
    <Text style={[styles.title, { color: colors.text }]}>What’s the vibe today?</Text>
    <Text style={[styles.body, { color: colors.muted }]}>Help us curate a plan that fits your mood.</Text>
    <View style={styles.moods}>{moods.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={item + (moodLimitation(item) ? ', unavailable for planning' : '')} accessibilityState={{ selected: mood === item, disabled: !!moodLimitation(item) }} disabled={!!moodLimitation(item)} onPress={() => setMood(mood === item ? null : item)} style={[styles.mood, { backgroundColor: mood === item ? colors.accent : colors.surface, borderColor: colors.border, opacity: moodLimitation(item) ? 0.5 : 1 }]}><Text style={{ color: mood === item ? colors.buttonText : colors.text, fontFamily: fonts.semibold }}>{item}</Text></Pressable>)}</View>
    <Text style={[styles.label, { color: colors.text }]}>What do you feel like doing?</Text>
    <Text style={[styles.hint, { color: colors.muted, marginTop: -4, marginBottom: 12 }]}>Pick one or more.</Text>
    <View style={styles.choices}>{activities.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={item + (activityLimitation(item) ? ', unavailable for planning' : '')} accessibilityState={{ selected: selected.includes(item), disabled: !!activityLimitation(item) }} disabled={!!activityLimitation(item)} onPress={() => toggle(item)} style={[styles.chip, { backgroundColor: selected.includes(item) ? colors.accent : colors.interactive, borderColor: colors.border, opacity: activityLimitation(item) ? 0.55 : 1 }]}><Text style={{ color: selected.includes(item) ? colors.buttonText : colors.text, fontFamily: fonts.medium }}>{item}</Text></Pressable>)}</View>
    <Text style={[styles.hint, { color: colors.muted }]}>Movies need showtimes. General activities and some moods are not yet supported.</Text>
    <Text style={[styles.label, { color: colors.text }]}>Starting area</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose starting area" onPress={() => router.push('/location')} style={[styles.location, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text, fontFamily: fonts.medium }}>{location?.label ?? 'Choose an area'}</Text><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>Change →</Text></Pressable>
    {location?.kind === 'demo' && <Text style={[styles.hint, { color: colors.muted }]}>Planning uses the approximate center of {location.label}, not your exact position.</Text>}
    {location?.kind === 'device' && !planningOrigin(location) && <ActionButton label={locating ? 'Finding location…' : 'Refresh device location'} onPress={refreshDevice} disabled={locating} secondary />}
    {locating && <ActivityIndicator color={colors.accent} />}
    <View style={[styles.budget, { borderColor: colors.border, backgroundColor: colors.surface }]}><BudgetEditor showSaveAction={false} onValidityChange={setBudgetValid} /></View>
    <Text style={[styles.label, { color: colors.text }]}>People</Text><PeopleStepper />
    <Text style={[styles.label, { color: colors.text }]}>Time available</Text><DurationSelector value={duration} onSelect={setDuration} />
    <Text style={[styles.summary, { color: colors.muted }]}>{formatRupees(totalBudget(budgetAmount, budgetMode, people))} total · {people} {people === 1 ? 'person' : 'people'} · {duration ?? 'Choose time'} · Starting soon · Walking</Text>
    {!!message && <Text accessibilityRole="alert" style={[styles.message, { color: colors.accent }]}>{message}</Text>}
    <ActionButton label="Find my day" onPress={submit} disabled={phase === 'loading' || locating || !budgetValid} />
  </ScreenShell>;
}
const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 13 },
  title: { fontFamily: fonts.editorialExtraBold, fontSize: 30, lineHeight: 36, marginTop: 8 }, body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: 10 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 }, mood: { width: '48%', minHeight: 72, borderWidth: 1, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 15, marginTop: 24, marginBottom: 11 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 24, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, marginTop: 8 }, location: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budget: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 25 }, summary: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, marginVertical: 24 }, message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginBottom: 12 },
});
