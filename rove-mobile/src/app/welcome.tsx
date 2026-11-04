import { router } from 'expo-router';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { onboardingArt } from '../assets/onboardingArt';
import { BrandWordmark } from '../components/BrandWordmark';
import { FirstLaunchButton } from '../components/FirstLaunchButton';
import { FirstLaunchScreen } from '../components/FirstLaunchScreen';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';

export default function Welcome() {
  const { setStep, completeOnboarding } = useDiscovery();
  const { colors, mode } = useRoveTheme();
  const { width } = useWindowDimensions();
  const artWidth = Math.min(width - 44, 370);
  const artHeight = artWidth * 1110 / 1580;
  const getStarted = () => { setStep('location'); router.replace('/onboarding/location'); };
  const explore = async () => { await completeOnboarding(); router.replace('/(tabs)'); };
  return <FirstLaunchScreen contentStyle={styles.centered}>
    <View style={styles.heading}>
      <Text style={[styles.hello, { color: colors.text }]}>Hi, I’m</Text>
      <BrandWordmark width={Math.min(artWidth * 0.62, 225)} color={mode === 'dark' ? colors.text : '#244A39'} />
    </View>
    <Image source={onboardingArt.welcome[mode]} resizeMode="contain" style={[styles.art, { width: artWidth, height: artHeight }]} accessibilityLabel="Rove waving hello" />
    <View style={styles.copy}>
      <Text style={[styles.title, { color: colors.text }]}>Your local outing companion.</Text>
      <Text style={[styles.body, { color: colors.text }]}>Discover places, get personalized plans and make the most of your day.</Text>
    </View>
    <View style={styles.actions}>
      <FirstLaunchButton label="Get started" arrow onPress={getStarted} />
      <FirstLaunchButton label="Explore Rove" secondary onPress={explore} />
    </View>
  </FirstLaunchScreen>;
}

const styles = StyleSheet.create({
  centered: { justifyContent: 'center' },
  heading: { alignItems: 'center', gap: 2 },
  hello: { fontFamily: fonts.display, fontSize: 43, lineHeight: 50, textAlign: 'center' },
  art: { alignSelf: 'center', marginTop: 16 },
  copy: { alignItems: 'center', marginTop: 10, gap: 9 },
  title: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 28, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 330 },
  actions: { gap: 12, marginTop: 32, paddingHorizontal: 12 },
});
