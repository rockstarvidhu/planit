import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { onboardingArt } from '../../assets/onboardingArt';
import { FirstLaunchButton } from '../../components/FirstLaunchButton';
import { FirstLaunchScreen } from '../../components/FirstLaunchScreen';
import { OnboardingHeader } from '../../components/OnboardingHeader';
import { fonts, useRoveTheme } from '../../design/theme';
import { demoAreas, useDiscovery } from '../../state/DiscoveryContext';

export default function OnboardingLocation() {
  const { location, setLocation, setStep } = useDiscovery();
  const { colors, mode } = useRoveTheme();
  const { width, height } = useWindowDimensions();
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const next = () => { setStep('preferences'); router.replace('/onboarding/preferences'); };
  const back = () => { setStep('welcome'); router.replace('/welcome'); };
  const skip = () => { setLocation(null); next(); };
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
  const artWidth = Math.min(width - 44, height < 820 ? 320 : 350);
  const compact = height < 820;
  return <FirstLaunchScreen>
    <OnboardingHeader current={1} onBack={back} onSkip={skip} />
    <View style={styles.main}>
    <Text style={[styles.title, { color: colors.text, marginTop: compact ? 16 : 22 }]}>Where are you planning a day out?</Text>
    <Text style={[styles.body, { color: colors.text }]}>Share your location so we can find the best places around you.</Text>
    <Image source={onboardingArt.location[mode]} resizeMode="contain" style={[styles.art, { width: artWidth, height: artWidth * 1130 / 1582 }]} accessibilityLabel="Rove explorer holding a map" />
    <View style={styles.actions}>
      <FirstLaunchButton label={busy ? 'Finding your area…' : 'Use my current location'} leadingIcon="map-pin" onPress={useDevice} disabled={busy} />
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!message && <Text accessibilityRole="alert" style={[styles.message, { color: colors.muted }]}>{message}</Text>}
      <FirstLaunchButton label="Enter location manually" leadingIcon="search" secondary onPress={() => setManual((open) => !open)} />
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
    <Text style={[styles.privacy, { color: colors.muted }]}>Your location is only used to find nearby recommendations.</Text>
    </View>
  </FirstLaunchScreen>;
}

const styles = StyleSheet.create({
  main: { flexGrow: 1, justifyContent: 'center', paddingBottom: 10 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, textAlign: 'center', paddingHorizontal: 8 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 13, paddingHorizontal: 10 },
  art: { alignSelf: 'center', marginTop: 16 },
  actions: { gap: 11, marginTop: 16, paddingHorizontal: 6 },
  privacy: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 24 },
  message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  manualPanel: { paddingVertical: 5 },
  input: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontFamily: fonts.body, fontSize: 14 },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 7 },
  choice: { minHeight: 47, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
