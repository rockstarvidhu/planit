import { router } from 'expo-router';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { v2Art } from '../assets/v2Art';
import { ActionButton } from '../components/ActionButton';
import { BrandWordmark } from '../components/BrandWordmark';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';

export default function Welcome() {
  const { setStep, completeOnboarding } = useDiscovery(); const { colors, mode } = useRoveTheme();
  const { height } = useWindowDimensions();
  const getStarted = () => { setStep('location'); router.replace('/onboarding/location'); };
  const explore = async () => { await completeOnboarding(); router.replace('/(tabs)'); };
  return <ScreenShell bottomSafe fill>
    <View style={styles.brand}><BrandWordmark width={94} color={mode==='dark'?'#F5F3EB':'#193D2E'} /></View>
    <Text style={[styles.title,{color:colors.text}]}>Hi, I’m Rove!</Text>
    <Text style={[styles.support,{color:colors.accent}]}>Your little companion for better days out.</Text>
    <Text style={[styles.body,{color:colors.muted}]}>Tell me your budget and what you’re in the mood for. I’ll help you figure out your day.</Text>
    <Image source={v2Art.welcome[mode]} resizeMode="cover" style={[styles.art,{height:Math.min(485,Math.max(330,height*0.50))}]} accessibilityLabel="Rove explorer in an illustrated landscape" />
    <View style={styles.actions}><ActionButton label="Get started" onPress={getStarted} /><ActionButton label="Explore Rove" secondary onPress={explore} /></View>
  </ScreenShell>;
}
const styles=StyleSheet.create({
  brand:{marginTop:8},art:{width:'100%',marginTop:14},
  title:{fontFamily:fonts.display,fontSize:39,lineHeight:44,marginTop:34},support:{fontFamily:fonts.medium,fontSize:16,lineHeight:24,marginTop:8},
  body:{fontFamily:fonts.body,fontSize:15,lineHeight:23,marginTop:15},actions:{gap:4,marginTop:'auto',paddingTop:15},
});
