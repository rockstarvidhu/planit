import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { v2Art } from '../../assets/v2Art';
import { ActionButton } from '../../components/ActionButton';
import { HandoffIcon } from '../../components/HandoffIcon';
import { OnboardingHeader } from '../../components/OnboardingHeader';
import { ScreenShell } from '../../components/ScreenShell';
import { fonts, useRoveTheme } from '../../design/theme';
import { demoAreas, useDiscovery } from '../../state/DiscoveryContext';

export default function OnboardingLocation() {
  const { location, setLocation, setStep } = useDiscovery();
  const { colors, mode } = useRoveTheme();
  const { width } = useWindowDimensions();
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const next = () => { setStep('preferences'); router.replace('/onboarding/preferences'); };
  const back = () => { setStep('welcome'); router.replace('/welcome'); };
  const useDevice = async () => {
    setBusy(true); setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setMessage('Location access was not granted. Choose a demo area or skip for now.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const found = places[0];
      const label = [found?.city || found?.subregion, found?.region].filter(Boolean).join(', ');
      if (!label) { setMessage('We could not name your area. Choose a demo area or skip for now.'); return; }
      setLocation({ kind: 'device', id: `device:${label.toLowerCase()}`, label }); next();
    } catch { setMessage('Location is unavailable right now. Choose a demo area or skip for now.'); }
    finally { setBusy(false); }
  };
  const choices = demoAreas.filter((area) => area.label.toLowerCase().includes(query.trim().toLowerCase()));
  const artHeight = Math.min(360, Math.max(270, (Math.min(width, 430) - 44) * 0.90));
  return <ScreenShell bottomSafe fill>
    <OnboardingHeader current={1} onBack={back} />
    <Text style={[styles.title, { color: colors.text }]}>Where are we exploring?</Text>
    <Text style={[styles.body, { color: colors.muted }]}>Find places and experiences around you.</Text>
    <Image source={v2Art.location[mode]} resizeMode="cover" style={[styles.art, { height: artHeight }]} accessibilityLabel="Illustrated folded map in a Rove landscape" />
    <View style={styles.actions}>
      <ActionButton label={busy ? 'Finding your area…' : 'Use my current location'} onPress={useDevice} disabled={busy} />
      {busy && <ActivityIndicator color={colors.accent} style={styles.indicator} />}
      {!!message && <Text accessibilityRole="alert" style={[styles.message, { color: colors.muted }]}>{message}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: manual }} accessibilityLabel="Enter a city or area" onPress={() => setManual((open) => !open)} style={[styles.manualButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <HandoffIcon name="map-pin" color={colors.accent} size={20} />
        <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 14 }}>Enter a city or area</Text>
      </Pressable>
      {manual && <View style={styles.manualPanel}>
        <TextInput accessibilityLabel="Search demo areas" autoFocus value={query} onChangeText={setQuery} placeholder="Search demo cities" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} />
        <Text style={[styles.note, { color: colors.muted }]}>Local examples only; typing a name does not geocode it.</Text>
        {choices.map((area) => <Pressable key={area.id} accessibilityRole="button" accessibilityState={{ selected: location?.id === area.id }} onPress={() => { setLocation(area); next(); }} style={[styles.choice, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 14 }}>{area.label}</Text>
          <Text style={{ color: colors.accent, fontFamily: fonts.medium, fontSize: 13 }}>Choose</Text>
        </Pressable>)}
        {!choices.length && <Text style={[styles.note, { color: colors.muted }]}>No demo area matches. Try Bengaluru, Mumbai, Delhi, Chennai, Hyderabad or Pune.</Text>}
      </View>}
    </View>
    <View style={styles.skip}><ActionButton label="Skip for now" secondary onPress={() => { setLocation(null); next(); }} /></View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 33, lineHeight: 39, marginTop: 27 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: 8 },
  art: { width: '100%', marginTop: 18 },
  actions: { marginTop: 19, gap: 5 },
  skip: { marginTop: 'auto', paddingTop: 12 },
  indicator: { marginTop: 5 }, message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginVertical: 5 },
  manualButton: { minHeight: 52, borderWidth: 1, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  manualPanel: { paddingVertical: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontFamily: fonts.body, fontSize: 14 },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 7 },
  choice: { minHeight: 47, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
