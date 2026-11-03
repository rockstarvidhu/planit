import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HandoffIcon } from './HandoffIcon';
import type { HandoffIconName } from './HandoffIcon';
import { categories } from '../data/demoPlaces';
import type { DemoCategory } from '../data/demoPlaces';
import { fonts, useRoveTheme } from '../design/theme';
const icons:Record<DemoCategory,HandoffIconName>={Cafe:'coffee',Food:'utensils',Nature:'mountain','Date ideas':'calendar-heart'};
export function CategoryChips({selected,onSelect}:{selected:DemoCategory|null;onSelect:(category:DemoCategory|null)=>void}){
  const {colors}=useRoveTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
    {categories.map((category)=><Pressable key={category} accessibilityRole="button" accessibilityLabel={`${category} category`} accessibilityState={{selected:selected===category}} onPress={()=>onSelect(selected===category?null:category)} style={styles.target}>
      <View style={[styles.chip,{backgroundColor:selected===category?colors.accent:colors.chip}]}><HandoffIcon name={icons[category]} color={selected===category?colors.buttonText:colors.accent} size={18}/><Text style={{color:selected===category?colors.buttonText:colors.text,fontFamily:fonts.medium,fontSize:12}}>{category==='Cafe'?'Café':category}</Text></View>
    </Pressable>)}
  </ScrollView>;
}
const styles=StyleSheet.create({scroll:{marginHorizontal:-22},row:{paddingHorizontal:22,gap:6,alignItems:'center'},target:{minHeight:48,justifyContent:'center'},chip:{minHeight:40,borderRadius:22,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:6}});
