import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { demoAreas, useDiscovery } from '../state/DiscoveryContext';
export default function AreaSelection(){
  const {colors}=useRoveTheme();const {location,setLocation}=useDiscovery();const [query,setQuery]=useState('');
  const goBack=()=>router.canGoBack()?router.back():router.replace('/(tabs)');
  const choices=demoAreas.filter(area=>area.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <ScreenShell bottomSafe><Pressable accessibilityRole="button" accessibilityLabel="Back to Discover" onPress={goBack} style={styles.back}><Text style={{color:colors.accent,fontFamily:fonts.semibold}}>←  Back</Text></Pressable><Text style={[styles.title,{color:colors.text}]}>Choose an area</Text><Text style={[styles.body,{color:colors.muted}]}>These are local demo labels, not geocoded results. Sample places stay the same.</Text><TextInput accessibilityLabel="Search demo areas" value={query} onChangeText={setQuery} placeholder="City or area" placeholderTextColor={colors.muted} style={[styles.input,{backgroundColor:colors.surface,color:colors.text,borderColor:colors.border}]}/>{choices.map(area=><Pressable key={area.id} accessibilityRole="button" accessibilityState={{selected:location?.id===area.id}} onPress={()=>{setLocation(area);goBack();}} style={[styles.row,{borderBottomColor:colors.border}]}><Text style={{color:colors.text,fontFamily:fonts.medium}}>{area.label}</Text><Text style={{color:colors.accent,fontFamily:fonts.medium}}>Choose</Text></Pressable>)}<Pressable accessibilityRole="button" onPress={()=>{setLocation(null);goBack();}} style={styles.clear}><Text style={{color:colors.accent,fontFamily:fonts.medium}}>Clear area</Text></Pressable></ScreenShell>;
}
const styles=StyleSheet.create({back:{minHeight:48,justifyContent:'center'},title:{fontFamily:fonts.display,fontSize:31,marginTop:16},body:{fontFamily:fonts.body,fontSize:14,lineHeight:21,marginTop:9},input:{height:50,borderWidth:1,borderRadius:14,paddingHorizontal:15,marginTop:22,fontFamily:fonts.body},row:{minHeight:54,borderBottomWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},clear:{minHeight:48,justifyContent:'center',marginTop:14}});
