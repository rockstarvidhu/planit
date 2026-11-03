import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, useRoveTheme } from '../design/theme';
export function EmptyState({title,body,exploreAction=false}:{title:string;body:string;exploreAction?:boolean}){
  const {colors}=useRoveTheme();return <View style={styles.container}><Text style={[styles.title,{color:colors.text}]}>{title}</Text><Text style={[styles.body,{color:colors.muted}]}>{body}</Text>{exploreAction&&<Link href="/(tabs)" asChild><Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.button,{backgroundColor:colors.accent}])}><Text style={{color:colors.buttonText,fontFamily:fonts.semibold}}>Explore places</Text></Pressable></Link>}</View>;
}
const styles=StyleSheet.create({container:{paddingVertical:24},title:{fontFamily:fonts.display,fontSize:21,lineHeight:27},body:{fontFamily:fonts.body,fontSize:14,lineHeight:21,marginTop:8},button:{alignSelf:'flex-start',justifyContent:'center',alignItems:'center',borderRadius:24,minHeight:48,paddingHorizontal:22,marginTop:24}});
