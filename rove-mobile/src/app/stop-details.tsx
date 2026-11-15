import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { findPlan, formatTime, warningText } from '../services/planPresentation';
import { usePlanLibrary } from '../state/PlanLibraryContext';
import { usePlanning } from '../state/PlanningContext';

export default function StopDetails() {
  const { planId, savedId, stopIndex } = useLocalSearchParams<{ planId?: string; savedId?: string; stopIndex?: string }>();
  const { colors, mode } = useRoveTheme();
  const { response } = usePlanning();
  const { plans } = usePlanLibrary();
  const saved = savedId ? plans.find(item => item.id === savedId) : null;
  const selected = saved ? { plan: saved.plan, provisional: true } : findPlan(response, planId);
  const index = stopIndex !== undefined && /^\d+$/.test(stopIndex) ? Number(stopIndex) : -1;
  const stop = selected?.plan.stops[index];
  const suggestion = saved ? undefined : response?.suggestions.find(item => item.id === stop?.placeId);
  const latitude = suggestion?.latitude;
  const longitude = suggestion?.longitude;
  const hasCoordinates = typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const leg = selected?.plan.travelLegs.find(item => item.toId === stop?.placeId);
  const duration = selected?.plan.planningDurations?.find(item => item.placeId === stop?.placeId);
  const back = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/plans');
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to itinerary" onPress={back} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Your itinerary</Text></Pressable>
    {!stop ? <><Text style={[styles.title, { color: colors.text }]}>Stop unavailable</Text><Text style={[styles.body, { color: colors.muted }]}>This stop is not in the current plan. Open it again from Results or Plans.</Text><ActionButton label="Go to Plans" onPress={() => router.replace('/(tabs)/plans')} /></> : <>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>{saved ? 'SAVED FICTIONAL PLAN' : response?.demo ? 'FICTIONAL DEMO STOP' : selected?.provisional ? 'PROVISIONAL STOP' : 'PLANNED STOP'}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{stop.name}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{stop.category}</Text>
      <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.heading, { color: colors.text }]}>Plan details</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Arrive {formatTime(stop.arrivalAt)} · Leave {formatTime(stop.departureAt)}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{stop.visitMinutes} minute visit{stop.waitMinutes > 0 ? ` · ${stop.waitMinutes} minute wait` : ''}</Text>
        {leg && <Text style={[styles.body, { color: colors.muted }]}>{leg.durationMinutes} minute {leg.mode} trip to this stop</Text>}
        <Text style={[styles.body, { color: colors.muted }]}>{duration?.source === 'user_supplied_estimate' ? 'Visit time entered by you.' : 'Visit time is a Rove planning estimate.'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>What to check</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Price: {selected?.plan.dataQuality.prices === 'known' ? 'See the itinerary budget assessment.' : 'Unknown'}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Opening hours: {selected?.plan.dataQuality.openingHours === 'known' ? 'Check before you travel' : 'Unverified'}</Text>
        {[...new Set((selected?.plan.warnings ?? []).filter(item => !item.placeId || item.placeId === stop.placeId).map(warningText))].map(item =>
          <Text key={item} style={[styles.body, { color: colors.muted }]}>• {item}</Text>)}
        <Text style={[styles.body, { color: colors.muted }]}>Source: {saved ? 'Rove fictional fixture, saved locally' : suggestion?.source?.name ?? (response?.demo ? 'Rove fictional fixture' : 'Backend place provider')}</Text>
      </View>
      <Text style={[styles.body, { color: colors.muted, marginTop: 25 }]}>{hasCoordinates ? 'No authorized place photograph is available for this stop. Check directions in your maps app.' : 'No authorized place photograph or verified directions are available for this stop.'}</Text>
      <ActionButton label={hasCoordinates ? 'Open directions' : 'Directions unavailable'} disabled={!hasCoordinates} onPress={() => {
        if (!hasCoordinates) return;
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`)
          .catch(() => Alert.alert('Directions unavailable', 'Please try again when a maps app is available.'));
      }} secondary />
      {!saved && response && (response.attribution.googleMapsRequired || response.attribution.googleCopyrightRequired || response.attribution.thirdParty.length > 0) &&
        <View style={[styles.attribution, { borderColor: colors.border }]}>
          {(response.attribution.googleMapsRequired || response.attribution.googleCopyrightRequired) &&
            <Image source={mode === 'dark' ? require('../../assets/attribution/google-maps-white-2x.png') : require('../../assets/attribution/google-maps-darkgray-2x.png')} resizeMode="contain" accessibilityLabel="Google Maps" style={styles.logo} />}
          {response.attribution.googleCopyrightRequired && <Text style={[styles.body, { color: colors.muted }]}>Route information © {new Date().getFullYear()} Google</Text>}
          {response.attribution.thirdParty.map((credit, creditIndex) => {
            if (!credit || typeof credit !== 'object' || !('provider' in credit) || typeof credit.provider !== 'string') return null;
            const raw = 'providerUri' in credit && typeof credit.providerUri === 'string' ? credit.providerUri : null;
            let uri: string | null = null;
            try { if (raw) { const parsed = new URL(raw); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) uri = parsed.toString(); } } catch {}
            return <Pressable key={creditIndex} accessibilityRole={uri ? 'link' : 'text'} onPress={uri ? () => { Linking.openURL(uri!).catch(() => {}); } : undefined}>
              <Text style={[styles.body, { color: colors.muted }]}>Place credit: {credit.provider}{uri ? ' ↗' : ''}</Text>
            </Pressable>;
          })}
        </View>}
    </>}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, marginTop: 17 },
  title: { fontFamily: fonts.editorialExtraBold, fontSize: 32, lineHeight: 39, marginTop: 9 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: 9 },
  panel: { borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 27 },
  heading: { fontFamily: fonts.editorialBold, fontSize: 17 }, section: { marginTop: 25 },
  attribution: { borderTopWidth: 1, paddingTop: 12, marginTop: 25 }, logo: { width: 106, height: 24, marginVertical: 8 },
});
