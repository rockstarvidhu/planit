import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { BudgetEditor, DurationSelector, formatRupees, PeopleStepper } from '../components/BudgetControls';
import { ScreenShell } from '../components/ScreenShell';
import { fonts, useRoveTheme } from '../design/theme';
import { totalBudget, useDiscovery } from '../state/DiscoveryContext';
export default function PlanningEntry(){
  const {colors}=useRoveTheme();const {budgetAmount,budgetMode,people,duration,setDuration,location}=useDiscovery();
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Discover" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)')} style={styles.back}><Text style={{color:colors.accent,fontFamily:fonts.semibold}}>←  Back</Text></Pressable>
    <Text style={[styles.eyebrow,{color:colors.accent}]}>PLAN YOUR DAY</Text><Text style={[styles.title,{color:colors.text}]}>Let’s make a day of it.</Text>
    <Text style={[styles.body,{color:colors.muted}]}>These are your starting details. Full itinerary generation arrives in a later milestone.</Text>
    <View style={[styles.section,{backgroundColor:colors.surface,borderColor:colors.border}]}><BudgetEditor/></View>
    <Text style={[styles.label,{color:colors.text}]}>People</Text><PeopleStepper/>
    <Text style={[styles.label,{color:colors.text}]}>Time</Text><DurationSelector value={duration} onSelect={setDuration}/>
    <View style={[styles.summary,{borderColor:colors.border}]}><Text style={{color:colors.text,fontFamily:fonts.semibold}}>Your starting point</Text><Text style={{color:colors.muted,fontFamily:fonts.body,marginTop:8,lineHeight:21}}>{formatRupees(totalBudget(budgetAmount,budgetMode,people))} total · {people} {people===1?'person':'people'} · {duration??'Time not selected'} · {location?.label??'Area not selected'}</Text></View>
    <ActionButton label="Back to Discover" onPress={()=>router.replace('/(tabs)')}/>
  </ScreenShell>;
}
const styles=StyleSheet.create({back:{minHeight:48,justifyContent:'center'},eyebrow:{fontFamily:fonts.semibold,fontSize:11,letterSpacing:1,marginTop:20},title:{fontFamily:fonts.display,fontSize:31,lineHeight:38,marginTop:8},body:{fontFamily:fonts.body,fontSize:14,lineHeight:22,marginTop:9},section:{borderWidth:1,borderRadius:20,padding:17,marginTop:25},label:{fontFamily:fonts.semibold,fontSize:15,marginTop:25,marginBottom:12},summary:{borderWidth:1,borderRadius:16,padding:16,marginVertical:25}});
