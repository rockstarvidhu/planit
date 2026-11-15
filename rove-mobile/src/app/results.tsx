import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { formatRupees } from '../components/BudgetControls';
import { ItineraryView } from '../components/ItineraryView';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { warningText } from '../services/planPresentation';
import { useDiscovery } from '../state/DiscoveryContext';
import { usePlanning } from '../state/PlanningContext';
import type { PlannedItinerary } from '../types/api';

const providerMessage = (code?: string) => code === 'PROVIDER_QUOTA'
  ? 'Planning has reached its provider limit. Wait before starting another search.'
  : code === 'PLACES_DISABLED' || code === 'ROUTES_DISABLED'
    ? 'Planning is not enabled on this backend yet. Please try again later.'
    : code === 'PROVIDER_TIMEOUT'
      ? 'A place or route provider took too long. Try again later.'
      : 'Places or routes could not be checked. No plan was made. Try again later or adjust your choices.';

export default function Results() {
  const { colors } = useRoveTheme();
  const { location } = useDiscovery();
  const { response, request } = usePlanning();
  const back = () => router.dismissTo('/planning-entry');
  if (!response || !request) return <ScreenShell bottomSafe><Text style={[styles.title, { color: colors.text }]}>No plan to show yet.</Text><ActionButton label="Choose your day" onPress={back} /></ScreenShell>;

  const confirmed = response.status === 'ready' ? response.plans : [];
  const provisional = response.status === 'ready' || response.status === 'provisional' ? response.provisionalPlans : [];
  const heading = response.status === 'ready' ? 'Your day, planned.' : response.status === 'provisional'
    ? 'A possible day for you.' : response.status === 'provider_unavailable'
      ? 'Planning is unavailable.' : response.status === 'no_feasible_plan'
        ? 'No plan fits these choices.' : 'We need more information.';
  const explanation = response.status === 'provider_unavailable' ? providerMessage(response.providerFailure?.code)
    : response.status === 'no_feasible_plan' ? 'Try a longer time window, another area or different activities.'
      : response.status === 'insufficient_data' ? 'Try another area or a different activity.'
        : response.status === 'provisional' ? 'This schedule is provisional. Check hours, routes and prices before you go.'
          : 'Review the timing and costs before you go.';
  const showPlan = (plan: PlannedItinerary, tentative: boolean, index: number) => <View key={`${plan.id}-${index}`} style={styles.plan}>
    <ItineraryView plan={plan} provisional={tentative} demo={response.demo} warnings={response.warnings}
      googleRequired={response.attribution.googleMapsRequired} routesRequired={response.attribution.googleCopyrightRequired}
      credits={response.attribution.thirdParty} onStop={stopIndex => router.push({ pathname: '/stop-details', params: { planId: plan.id, stopIndex: String(stopIndex) } } as Href)} />
    <View style={styles.actions}>
      <ActionButton label="Edit this plan" secondary onPress={() => router.push({ pathname: '/edit-plan', params: { planId: plan.id } } as Href)} />
      <ActionButton label="Save this plan" onPress={() => router.push({ pathname: '/save-plan', params: { planId: plan.id } } as Href)} />
    </View>
  </View>;

  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to choices" onPress={back} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Your choices</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.accent }]}>{response.demo ? 'FICTIONAL DEMO RESULTS' : response.status === 'provisional' ? 'PROVISIONAL RESULTS' : 'YOUR OUTING'}</Text>
    <Text style={[styles.title, { color: colors.text }]}>{heading}</Text>
    <Text style={[styles.body, { color: colors.muted }]}>{explanation}</Text>
    <View style={[styles.summary, { borderColor: colors.border }]}>
      <Text style={[styles.summaryTitle, { color: colors.text }]}>Your day in {location?.label ?? 'your area'}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{formatRupees(request.budgetAmount)} {request.budgetMode === 'perPerson' ? 'per person' : 'total'} · {request.people} {request.people === 1 ? 'person' : 'people'} · {request.availableMinutes} min</Text>
      {request.budgetMode === 'perPerson' && <Text style={[styles.sub, { color: colors.muted }]}>Total group budget: {formatRupees(request.budgetAmount * request.people)}</Text>}
      <Text style={[styles.sub, { color: colors.muted }]}>Activities: {request.categories.join(', ')} · {request.transportMode === 'walk' ? 'Walking' : 'Driving'}</Text>
    </View>
    {confirmed.map((plan, index) => showPlan(plan, false, index))}
    {provisional.map((plan, index) => showPlan(plan, true, index))}
    {!confirmed.length && !provisional.length && response.warnings.length > 0 && <View style={styles.notices}>
      <Text style={[styles.section, { color: colors.text }]}>What happened</Text>
      {[...new Set(response.warnings.map(warningText))].map(item => <Text key={item} style={[styles.sub, { color: colors.muted }]}>• {item}</Text>)}
    </View>}
    <View style={styles.actions}><ActionButton label="Adjust choices and start a new search" onPress={back} /></View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 15 },
  title: { fontFamily: fonts.editorialExtraBold, fontSize: 30, lineHeight: 38, marginTop: 9 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: 10 },
  summary: { borderBottomWidth: 1, paddingBottom: 17, marginTop: 22 }, summaryTitle: { fontFamily: fonts.editorialBold, fontSize: 18 },
  sub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, marginTop: 5 },
  plan: { marginTop: 20 }, actions: { gap: 11, marginTop: 24 }, notices: { marginTop: 22 },
  section: { fontFamily: fonts.editorialBold, fontSize: 16 },
});
