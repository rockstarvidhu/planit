import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { HandoffIcon } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';
export function DiscoverySearch({ value, onChangeText }: { value:string; onChangeText:(text:string)=>void }) {
  const {colors}=useRoveTheme();
  return <View style={[styles.field,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <HandoffIcon name="search" color={colors.text} size={22}/>
    <TextInput accessibilityLabel="Search sample places" autoCorrect={false} onChangeText={onChangeText} onSubmitEditing={Keyboard.dismiss} placeholder="Search places, activities or plans" placeholderTextColor={colors.muted} returnKeyType="search" style={[styles.input,{color:colors.text}]} value={value}/>
    {!!value&&<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>onChangeText('')} style={styles.clear}><HandoffIcon name="close" color={colors.muted} size={17}/></Pressable>}
  </View>;
}
const styles=StyleSheet.create({field:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderRadius:27,height:54,paddingLeft:19,paddingRight:6},input:{flex:1,minWidth:0,height:52,paddingVertical:0,fontFamily:fonts.body,fontSize:13},clear:{width:44,height:44,alignItems:'center',justifyContent:'center'}});
