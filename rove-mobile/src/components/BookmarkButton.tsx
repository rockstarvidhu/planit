import { Pressable, StyleSheet } from 'react-native';
import { HandoffIcon } from './HandoffIcon';
import { useRoveTheme } from '../design/theme';
export function BookmarkButton({saved,onPress,placeName}:{saved:boolean;onPress:()=>void;placeName:string}){
  const {colors}=useRoveTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${saved?'Remove':'Save'} ${placeName}`} accessibilityState={{selected:saved}} onPress={onPress} style={[styles.button,{backgroundColor:colors.surface}]}><HandoffIcon name={saved?'bookmark-filled':'bookmark'} color={colors.text} size={22}/></Pressable>;
}
const styles=StyleSheet.create({button:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'}});
