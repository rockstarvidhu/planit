import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandWordmark } from './BrandWordmark';
import { HandoffIcon } from './HandoffIcon';
import { RoveMascot } from './RoveMascot';
import { fonts, useRoveTheme } from '../design/theme';

function greeting() {
  const hour=new Date().getHours();
  return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
}
export function DiscoverHeader() {
  const { colors,mode }=useRoveTheme();
  return <>
    <View style={styles.topRow}>
      <BrandWordmark width={99} color={mode==='dark'?'#F5F3EB':'#193D2E'} />
      <Link href="/you" asChild><Pressable accessibilityLabel="Open profile" accessibilityRole="button" style={styles.profile}><HandoffIcon name="user" color={colors.text} size={26}/></Pressable></Link>
    </View>
    <View style={styles.hero}>
      <View style={styles.copy}>
        <Text style={[styles.greeting,{color:colors.muted}]}>{greeting()}</Text>
        <Text style={[styles.title,{color:colors.text}]}>Where to today?</Text>
      </View>
      <View style={styles.inwardMascot}><RoveMascot width={91} height={104}/></View>
    </View>
    <Text style={[styles.subtitle,{color:colors.text}]}>Make more of your day, within your budget.</Text>
  </>;
}
const styles=StyleSheet.create({
  topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:5},
  profile:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},
  hero:{flexDirection:'row',alignItems:'center',marginTop:30},copy:{flex:1,paddingRight:2},
  inwardMascot:{transform:[{scaleX:-1}]},
  greeting:{fontFamily:fonts.body,fontSize:16,marginBottom:5},title:{fontFamily:fonts.display,fontSize:31,lineHeight:38,letterSpacing:-0.5},
  subtitle:{fontFamily:fonts.body,fontSize:13,lineHeight:19,marginTop:-3},
});
