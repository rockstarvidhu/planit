import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { usePlanning } from '../state/PlanningContext';

const explorer = require('../../assets/discover/rove_map_holding_mascot.png');

export default function Planning() {
  const { colors } = useRoveTheme();
  const { phase, failure, response, request, retry, cancel } = usePlanning();
  useEffect(() => {
    if (phase === 'done' && response) router.replace('/results' as Href);
  }, [phase, response]);
  const back = () => { cancel(); if (router.canGoBack()) router.back(); else router.replace('/planning-entry'); };
  return <ScreenShell bottomSafe fill>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to preferences" onPress={back} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Back</Text></Pressable>
    <View style={styles.center}>
      <Image source={explorer} resizeMode="contain" style={styles.mascot} accessibilityLabel="Rove explorer holding a map" />
      <Text style={[styles.title, { color: colors.text }]}>{phase === 'error' ? 'We couldn’t plan this day.' : 'Planning your day…'}</Text>
      {phase === 'loading' && <><ActivityIndicator accessibilityLabel="Planning in progress" size="large" color={colors.accent} style={styles.spinner} /><Text style={[styles.body, { color: colors.muted }]}>Checking places, routes and budget for your outing.</Text></>}
      {phase === 'error' && <><Text accessibilityRole="alert" style={[styles.body, { color: colors.muted }]}>{failure?.message}</Text>
        {failure?.retryAfterSeconds && <Text style={[styles.body, { color: colors.muted }]}>Try again in about {Math.ceil(failure.retryAfterSeconds / 60)} minutes.</Text>}
        {failure?.kind !== 'rate_limited' && failure?.kind !== 'already_attempted' && <ActionButton label="Check this attempt again" onPress={retry} />}
        <ActionButton label="Edit choices and start a new search" secondary onPress={back} /></>}
      {phase === 'idle' && <><Text style={[styles.body, { color: colors.muted }]}>Your planning request is no longer active.</Text><ActionButton label="Edit choices" onPress={back} /></>}
      {phase === 'done' && !response && <ActionButton label="Edit choices" onPress={back} />}
      {request && <Text style={[styles.note, { color: colors.muted }]}>Budget ₹{request.budgetAmount.toLocaleString('en-IN')} {request.budgetMode === 'perPerson' ? 'per person' : 'total'} · {request.people} people</Text>}
    </View>
  </ScreenShell>;
}
const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, center: { flex: 1, minHeight: 500, alignItems: 'center', justifyContent: 'center', gap: 19 },
  mascot: { width: 180, height: 180 }, title: { fontFamily: fonts.editorialExtraBold, fontSize: 31, lineHeight: 38, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, textAlign: 'center' }, spinner: { marginVertical: 8 },
  note: { fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 14 },
});
