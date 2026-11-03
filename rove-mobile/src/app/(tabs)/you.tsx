import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { ScreenShell } from '../../components/ScreenShell';
import { fonts, useRoveTheme } from '../../design/theme';
import { useDiscovery } from '../../state/DiscoveryContext';
import type { ThemePreference } from '../../state/DiscoveryContext';
export default function You(){
  const {colors}=useRoveTheme();const {themePreference,setThemePreference,location}=useDiscovery();
  return <ScreenShell><Text style={[styles.eyebrow,{color:colors.accent}]}>MAKE IT YOURS</Text><Text style={[styles.title,{color:colors.text}]}>You</Text><Text style={[styles.intro,{color:colors.muted}]}>A few small choices will make Rove feel like yours.</Text>
    <EditorialSection title="Appearance"><View style={styles.row}>{(['system','light','dark'] as ThemePreference[]).map(option=><Pressable key={option} accessibilityRole="button" accessibilityLabel={`${option} appearance`} accessibilityState={{selected:themePreference===option}} onPress={()=>setThemePreference(option)} style={[styles.option,{backgroundColor:themePreference===option?colors.accent:colors.interactive}]}><Text style={{color:themePreference===option?colors.buttonText:colors.text,fontFamily:fonts.medium,fontSize:13}}>{option[0].toUpperCase()+option.slice(1)}</Text></Pressable>)}</View></EditorialSection>
    <EditorialSection title="Preferences"><Link href="/location" asChild><Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.pref,{borderBottomColor:colors.border}])}><Text style={{color:colors.text,fontFamily:fonts.medium}}>Home area</Text><Text style={{color:colors.muted,fontFamily:fonts.body}}>{location?.label??'Choose area'}</Text></Pressable></Link><View style={[styles.pref,{borderBottomColor:colors.border}]}><Text style={{color:colors.text,fontFamily:fonts.medium}}>Interests</Text><Text style={{color:colors.muted,fontFamily:fonts.body}}>Coming later</Text></View></EditorialSection>
    {__DEV__&&<EditorialSection title="Development"><Link href="/dev/health" asChild><Pressable accessibilityRole="button" style={styles.devLink}><Text style={{color:colors.accent,fontFamily:fonts.semibold}}>Backend connectivity check</Text></Pressable></Link></EditorialSection>}
  </ScreenShell>;
}
const styles=StyleSheet.create({eyebrow:{fontFamily:fonts.semibold,fontSize:11,letterSpacing:1.3},title:{fontFamily:fonts.display,fontSize:32,lineHeight:39,marginTop:32},intro:{fontFamily:fonts.body,fontSize:14,lineHeight:21,marginTop:8},row:{flexDirection:'row',gap:7,marginTop:16},option:{minHeight:44,borderRadius:22,paddingHorizontal:13,justifyContent:'center'},pref:{minHeight:64,borderBottomWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},devLink:{minHeight:48,justifyContent:'center'}});
