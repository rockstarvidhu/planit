import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { v2Art } from '../assets/v2Art';
import { BudgetEditor, DurationSelector, formatRupees, PeopleStepper } from './BudgetControls';
import { HandoffIcon } from './HandoffIcon';
import type { HandoffIconName } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';

type Editor='budget'|'people'|'duration'|null;
function Hills({dark}:{dark:boolean}){
  return <Svg width={140} height={82} viewBox="0 0 1440 700" style={styles.hills}>
    <Circle cx="1160" cy="215" r="94" fill={dark?'#A2B5A5':'#F6DEB7'}/>
    <Path fill={dark?'#20382B':'#DDE7D2'} d="M0 420Q205 130 415 368Q654 66 854 384Q1130 130 1440 370V700H0Z"/>
    <Path fill={dark?'#345442':'#B0C6AE'} d="M0 500Q240 360 500 520Q770 285 1010 460Q1250 320 1440 465V700H0Z"/>
    <Path fill={dark?'#436B5A':'#789B89'} d="M0 570Q340 450 620 590Q980 405 1440 550V700H0Z"/>
  </Svg>;
}
function Control({icon,label,onPress}:{icon:HandoffIconName;label:string;onPress:()=>void}){
  const {colors,mode}=useRoveTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.control,{backgroundColor:mode==='dark'?colors.interactive:colors.surface}]}><HandoffIcon name={icon} color={colors.text} size={18}/><Text numberOfLines={1} style={{color:colors.text,fontFamily:fonts.medium,fontSize:11}}>{label}</Text></Pressable>;
}
export function DiscoverPlanningCard(){
  const {colors,mode}=useRoveTheme();const {budgetAmount,budgetMode,people,duration,setDuration}=useDiscovery();
  const [editor,setEditor]=useState<Editor>(null);
  const toggle=(next:Editor)=>setEditor(editor===next?null:next);
  return <View style={[styles.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
    <View style={styles.top}>
      <View style={styles.copy}><Text style={[styles.eyebrow,{color:colors.accent}]}>PLAN YOUR DAY</Text><Text style={[styles.headline,{color:colors.cardText}]}>Plan within{ '\n' }your budget.</Text><Text style={[styles.description,{color:colors.cardText}]}>Tell us your budget, time and vibe.{ '\n' }We’ll craft an outing for you.</Text></View>
      <View style={styles.art}><Hills dark={mode==='dark'}/><Image source={v2Art.mapMascot} resizeMode="contain" style={styles.mapMascot} accessibilityLabel="Rove explorer holding a map concept" /></View>
    </View>
    <View style={styles.controls}>
      <Control icon="wallet" label={formatRupees(budgetAmount)} onPress={()=>toggle('budget')}/>
      <Control icon="users" label={`${people} ${people===1?'person':'people'}`} onPress={()=>toggle('people')}/>
      <Control icon="clock" label={duration??'Pick time'} onPress={()=>toggle('duration')}/>
    </View>
    {editor&&<View style={[styles.editor,{borderColor:colors.border}]}>
      <Text style={[styles.editorTitle,{color:colors.text}]}>{editor==='budget'?'Set a budget':editor==='people'?'Who’s coming?':'How long do you have?'}</Text>
      {editor==='budget'&&<BudgetEditor onDone={()=>setEditor(null)}/>}
      {editor==='people'&&<PeopleStepper/>}
      {editor==='duration'&&<DurationSelector value={duration} onSelect={setDuration}/>}
    </View>}
    {budgetMode==='perPerson'&&<Text style={[styles.budgetNote,{color:colors.cardText}]}>{formatRupees(budgetAmount)} per person · {formatRupees(budgetAmount*people)} total</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Plan my day" onPress={()=>router.push('/planning-entry')} style={[styles.cta,{backgroundColor:colors.cardAction}]}><Text style={{color:colors.buttonText,fontFamily:fonts.semibold,fontSize:15}}>Plan my day</Text><HandoffIcon name="arrow-right" color={colors.buttonText} size={20}/></Pressable>
  </View>;
}
const styles=StyleSheet.create({
  card:{borderRadius:24,borderWidth:1,padding:16,overflow:'hidden'},top:{flexDirection:'row',minHeight:153},copy:{flex:1,zIndex:2},eyebrow:{fontFamily:fonts.semibold,fontSize:11,letterSpacing:0.7},
  headline:{fontFamily:fonts.display,fontSize:28,lineHeight:30,marginTop:7},description:{fontFamily:fonts.body,fontSize:12,lineHeight:18,marginTop:10},
  art:{width:99,alignItems:'center',justifyContent:'flex-end',marginRight:-4},hills:{position:'absolute',bottom:2,right:-17},mapMascot:{width:104,height:108},
  controls:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6},control:{flexGrow:1,flexBasis:92,minHeight:40,borderRadius:22,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6},
  editor:{borderTopWidth:1,marginTop:13,paddingTop:13},editorTitle:{fontFamily:fonts.semibold,fontSize:14,marginBottom:12},
  budgetNote:{fontFamily:fonts.body,fontSize:11,marginTop:8},cta:{height:44,borderRadius:23,marginTop:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
