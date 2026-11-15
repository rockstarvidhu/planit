import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatRupees } from './BudgetControls';
import { fonts, useRoveTheme } from '../design/theme';
import { formatTime, warningText } from '../services/planPresentation';
import type { PlanWarning, PlannedItinerary } from '../types/api';

const logos = {
  light: require('../../assets/attribution/google-maps-darkgray-2x.png'),
  dark: require('../../assets/attribution/google-maps-white-2x.png'),
};
const money = (value: number | null) => value === null ? 'Unknown' : formatRupees(value);

export function ItineraryView({ plan, provisional, demo, warnings, googleRequired = false,
  routesRequired = false, credits = [], onStop }: {
  plan: PlannedItinerary; provisional: boolean; demo: boolean; warnings: PlanWarning[];
  googleRequired?: boolean; routesRequired?: boolean; credits?: unknown[];
  onStop?: (index: number) => void;
}) {
  const { colors, mode } = useRoveTheme();
  const combined = [...new Set([...warnings, ...plan.warnings].map(warningText))];
  return <>
    <Text style={[styles.status, { color: colors.accent }]}>{demo ? 'FICTIONAL DEMO · ' : ''}{provisional ? 'PROVISIONAL PLAN' : 'CONFIRMED PLAN'}</Text>
    <Text style={[styles.head, { color: colors.text }]}>{formatTime(plan.startAt)} – {formatTime(plan.endAt)}</Text>
    <Text style={[styles.sub, { color: colors.muted }]}>{plan.stops.length} {plan.stops.length === 1 ? 'stop' : 'stops'} · {provisional ? 'Verify before you go' : 'Based on available data'}</Text>
    <View style={[styles.timeline, { borderColor: colors.border }]}>
      {plan.stops.map((stop, index) => {
        const leg = plan.travelLegs.find(item => item.toId === stop.placeId);
        const duration = plan.planningDurations?.find(item => item.placeId === stop.placeId);
        return <View key={`${stop.placeId}-${index}`} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <View style={styles.rowContent}>
            <Text style={[styles.time, { color: colors.accent }]}>{formatTime(stop.arrivalAt)}</Text>
            {onStop ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${stop.name} details`} onPress={() => onStop(index)} style={styles.stopButton}>
              <Text style={[styles.stopName, { color: colors.text }]}>{stop.name} →</Text>
            </Pressable> : <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>}
            <Text style={[styles.sub, { color: colors.muted }]}>{stop.category} · {stop.visitMinutes} min visit · Leave {formatTime(stop.departureAt)}</Text>
            {duration && <Text style={[styles.sub, { color: colors.muted }]}>{duration.source === 'user_supplied_estimate' ? 'Your visit-time estimate' : 'Rove-assumed visit time'}</Text>}
            {leg && <Text style={[styles.sub, { color: colors.muted }]}>Travel: {leg.durationMinutes} min {leg.mode} · Arrive {formatTime(leg.arriveAt)}</Text>}
          </View>
        </View>;
      })}
    </View>
    <View style={[styles.budget, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.section, { color: colors.text }]}>Budget outlook</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Expected spending: {money(plan.estimatedSpendingRange.expected)}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Estimated range: {money(plan.estimatedSpendingRange.minimum)} – {money(plan.estimatedSpendingRange.maximum)}</Text>
      {plan.budgetSummary.knownCostSubtotalRange.expected !== null && <Text style={[styles.sub, { color: colors.muted }]}>Known costs only: {money(plan.budgetSummary.knownCostSubtotalRange.expected)}</Text>}
      {plan.budgetSummary.assessment === 'cannot_determine' ?
        <Text style={[styles.caution, { color: colors.accent }]}>Budget fit cannot be confirmed.</Text> :
        <Text style={[styles.caution, { color: colors.accent }]}>Assessment: {plan.budgetSummary.assessment.replace(/_/g, ' ')}.</Text>}
      {plan.budgetSummary.unknownExpenseCategories.length > 0 && <Text style={[styles.sub, { color: colors.muted }]}>Unknown costs: {plan.budgetSummary.unknownExpenseCategories.join(', ')}.</Text>}
      {plan.budgetSummary.expectedRemaining !== null && <Text style={[styles.sub, { color: colors.muted }]}>Expected remaining: {money(plan.budgetSummary.expectedRemaining)}</Text>}
      {plan.dataQuality.openingHours === 'unknown' && <Text style={[styles.caution, { color: colors.accent }]}>Opening hours are unverified.</Text>}
    </View>
    {combined.length > 0 && <View style={styles.notices}><Text style={[styles.section, { color: colors.text }]}>Before you go</Text>
      {combined.map(text => <Text key={text} style={[styles.sub, { color: colors.muted }]}>• {text}</Text>)}
    </View>}
    {(googleRequired || routesRequired || credits.length > 0) && <View style={[styles.attribution, { borderColor: colors.border }]}>
      {(googleRequired || routesRequired) && <Image source={logos[mode]} resizeMode="contain" accessibilityLabel="Google Maps" style={styles.logo} />}
      {routesRequired && <Text style={[styles.sub, { color: colors.muted }]}>Route information © {new Date().getFullYear()} Google</Text>}
      {credits.map((credit, index) => {
        if (!credit || typeof credit !== 'object' || !('provider' in credit) || typeof credit.provider !== 'string') return null;
        const provider = credit.provider;
        const raw = 'providerUri' in credit && typeof credit.providerUri === 'string' ? credit.providerUri : null;
        let uri: string | null = null;
        try { if (raw) { const parsed = new URL(raw); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) uri = parsed.toString(); } } catch {}
        return <Pressable key={index} accessibilityRole={uri ? 'link' : 'text'} onPress={uri ? () => { Linking.openURL(uri!).catch(() => {}); } : undefined}>
          <Text style={[styles.sub, { color: colors.muted }]}>Place credit: {provider}{uri ? ' ↗' : ''}</Text>
        </Pressable>;
      })}
    </View>}
  </>;
}

const styles = StyleSheet.create({
  status: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 16 },
  head: { fontFamily: fonts.editorialExtraBold, fontSize: 23, lineHeight: 30, marginTop: 5 },
  sub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, marginTop: 5 },
  timeline: { borderLeftWidth: 1, marginLeft: 9, marginTop: 22 }, row: { flexDirection: 'row', marginLeft: -6, paddingBottom: 25 },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 7 }, rowContent: { flex: 1, paddingLeft: 17 },
  time: { fontFamily: fonts.semibold, fontSize: 12 }, stopButton: { minHeight: 44, justifyContent: 'center' },
  stopName: { fontFamily: fonts.editorialBold, fontSize: 17, lineHeight: 23 },
  budget: { borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 4 },
  section: { fontFamily: fonts.editorialBold, fontSize: 17, marginBottom: 5 },
  caution: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 19, marginTop: 10 },
  notices: { marginTop: 25 }, attribution: { borderTopWidth: 1, marginTop: 25, paddingTop: 12 },
  logo: { width: 106, height: 24, marginVertical: 8 },
});
