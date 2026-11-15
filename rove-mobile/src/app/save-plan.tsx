import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { canSaveFixture, findPlan } from '../services/planPresentation';
import { useDiscovery } from '../state/DiscoveryContext';
import { usePlanLibrary } from '../state/PlanLibraryContext';
import { usePlanning } from '../state/PlanningContext';

export default function SavePlan() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const { colors } = useRoveTheme();
  const { location } = useDiscovery();
  const { response, request } = usePlanning();
  const { ready, error: storageError, save } = usePlanLibrary();
  const selection = findPlan(response, planId);
  const allowed = !!selection && !!response && canSaveFixture(response, selection.plan);
  const [name, setName] = useState('My day out');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    if (busy || !selection || !response || !request || !allowed) return;
    setBusy(true); setMessage('');
    try {
      const saved = await save(name, selection.plan, request, response, location?.label ?? 'Your area');
      router.replace({ pathname: '/save-confirmation', params: { id: saved.id } } as Href);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'This plan could not be saved. Try again.'); }
    finally { setBusy(false); }
  };
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Results" onPress={() => router.back()} style={styles.back}><Text style={{ color: colors.accent, fontFamily: fonts.semibold }}>←  Results</Text></Pressable>
    <Text style={[styles.title, { color: colors.text }]}>Save your plan</Text>
    <Text style={[styles.body, { color: colors.muted }]}>Give this outing a name. A saved fictional plan stays provisional and its prices and hours still need checking.</Text>
    {!selection && <Text style={[styles.notice, { color: colors.accent }]}>This plan is no longer available. Return to Results and choose a plan.</Text>}
    {selection && !allowed && <Text style={[styles.notice, { color: colors.accent }]}>Saving live provider plans is unavailable until Rove can refresh their details without storing restricted provider content.</Text>}
    {storageError && <Text accessibilityRole="alert" style={[styles.notice, { color: colors.accent }]}>{storageError}</Text>}
    {allowed && <>
      <Text style={[styles.label, { color: colors.text }]}>Plan name</Text>
      <TextInput accessibilityLabel="Plan name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" returnKeyType="done"
        placeholder="My day out" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      <Text style={[styles.body, { color: colors.muted }]}>Stored on this device. No account is required. Fictional fixture details are saved for reopening offline.</Text>
      {!!message && <Text accessibilityRole="alert" style={[styles.notice, { color: colors.accent }]}>{message}</Text>}
      <ActionButton label={busy ? 'Saving…' : 'Save plan'} onPress={submit} disabled={!ready || busy || !name.trim() || !!storageError} />
    </>}
  </ScreenShell>;
}
const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: 'center' }, title: { fontFamily: fonts.editorialExtraBold, fontSize: 31, marginTop: 20 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: 12 },
  label: { fontFamily: fonts.semibold, fontSize: 14, marginTop: 28, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 56, paddingHorizontal: 15, fontFamily: fonts.body, fontSize: 16 },
  notice: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, marginTop: 18 },
});
