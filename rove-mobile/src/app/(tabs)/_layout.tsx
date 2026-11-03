import { Tabs } from 'expo-router';
import { View } from 'react-native';
import type { ColorValue } from 'react-native';
import { HandoffIcon } from '../../components/HandoffIcon';
import type { HandoffIconName } from '../../components/HandoffIcon';
import { fonts, useRoveTheme } from '../../design/theme';
function TabIcon({name,color,focused}:{name:HandoffIconName;color:ColorValue;focused:boolean}){
  const {colors}=useRoveTheme();return <View style={{width:30,height:30,borderRadius:15,backgroundColor:focused?colors.accent:'transparent',alignItems:'center',justifyContent:'center'}}><HandoffIcon name={name} color={focused?colors.buttonText:String(color)} size={21}/></View>;
}
export default function TabLayout(){
  const {colors}=useRoveTheme();
  return <Tabs backBehavior="firstRoute" screenOptions={{headerShown:false,tabBarHideOnKeyboard:true,tabBarLabelPosition:'below-icon',tabBarActiveTintColor:colors.accent,tabBarInactiveTintColor:colors.text,tabBarLabelStyle:{fontFamily:fonts.medium,fontSize:11,marginTop:2},tabBarItemStyle:{minHeight:48},tabBarStyle:{backgroundColor:colors.surface,borderTopColor:colors.border,borderTopWidth:1,minHeight:70,paddingTop:5}}}>
    <Tabs.Screen name="index" options={{title:'Discover',tabBarAccessibilityLabel:'Discover tab',tabBarIcon:({color,focused})=><TabIcon name="compass" color={color} focused={focused}/>}}/>
    <Tabs.Screen name="plans" options={{title:'Plans',tabBarAccessibilityLabel:'Plans tab',tabBarIcon:({color,focused})=><TabIcon name="map" color={color} focused={focused}/>}}/>
    <Tabs.Screen name="saved" options={{title:'Saved',tabBarAccessibilityLabel:'Saved tab',tabBarIcon:({color,focused})=><TabIcon name="bookmark" color={color} focused={focused}/>}}/>
    <Tabs.Screen name="you" options={{title:'You',tabBarAccessibilityLabel:'You tab',tabBarIcon:({color,focused})=><TabIcon name="user" color={color} focused={focused}/>}}/>
  </Tabs>;
}
