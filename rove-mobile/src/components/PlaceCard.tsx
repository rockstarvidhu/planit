import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DemoPlace } from '../data/demoPlaces';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';
import { BookmarkButton } from './BookmarkButton';
export function PlaceCard({place}:{place:DemoPlace}){
  const {colors}=useRoveTheme();const {savedIds,toggleSaved}=useDiscovery();
  return <View style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${place.name} sample place`} onPress={()=>router.push({pathname:'/place/[id]',params:{id:place.id}})}>
      <Image source={place.photo} resizeMode="cover" style={styles.photo} accessibilityLabel={`${place.name} sample photograph`}/>
      <View style={styles.copy}><Text style={[styles.category,{color:colors.accent}]}>{place.category.toUpperCase()}</Text><Text style={[styles.name,{color:colors.text}]} numberOfLines={1}>{place.name}</Text><Text style={[styles.area,{color:colors.muted}]} numberOfLines={1}>{place.area} · {place.city}</Text></View>
    </Pressable>
    <View style={styles.bookmark}><BookmarkButton placeName={place.name} saved={savedIds.includes(place.id)} onPress={()=>toggleSaved(place.id)}/></View>
  </View>;
}
const styles=StyleSheet.create({card:{width:259,borderRadius:19,overflow:'hidden',borderWidth:1},photo:{width:'100%',height:168},copy:{paddingHorizontal:13,paddingTop:10,paddingBottom:15},category:{fontFamily:fonts.semibold,fontSize:10,letterSpacing:0.8},name:{fontFamily:fonts.display,fontSize:20,lineHeight:25,marginTop:3},area:{fontFamily:fonts.body,fontSize:12,marginTop:4},bookmark:{position:'absolute',top:8,right:8}});
