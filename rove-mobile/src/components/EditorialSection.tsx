import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, useRoveTheme } from '../design/theme';
export function EditorialSection({title,children}:{title:string;children:ReactNode}){
  const {colors}=useRoveTheme();return <View style={styles.section}><Text style={[styles.title,{color:colors.text}]}>{title}</Text><View style={[styles.rule,{backgroundColor:colors.border}]}/>{children}</View>;
}
const styles=StyleSheet.create({section:{marginTop:32},title:{fontFamily:fonts.semibold,fontSize:15,lineHeight:21},rule:{height:1,marginTop:12}});
