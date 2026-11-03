import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryChips } from '../components/CategoryChips';
import { DiscoverySearch } from '../components/DiscoverySearch';
import { EmptyState } from '../components/EmptyState';
import { PlaceCard } from '../components/PlaceCard';
import { ScreenShell } from '../components/ScreenShell';
import { demoPlaces } from '../data/demoPlaces';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';
import { filterPlaces } from '../utils/filterPlaces';
export default function AllPlaces(){
  const {colors}=useRoveTheme();const {query,setQuery,category,setCategory}=useDiscovery();const places=filterPlaces(demoPlaces,query,category);
  return <ScreenShell bottomSafe>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Discover" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)')} style={styles.back}><Text style={{color:colors.accent,fontFamily:fonts.semibold}}>←  Back</Text></Pressable>
    <Text style={[styles.title,{color:colors.text}]}>Places to explore</Text><Text style={[styles.note,{color:colors.muted}]}>Local sample listings only. These are not live nearby recommendations.</Text>
    <View style={styles.search}><DiscoverySearch value={query} onChangeText={setQuery}/></View><View style={styles.chips}><CategoryChips selected={category} onSelect={setCategory}/></View>
    {places.length?<View style={styles.list}>{places.map((place)=><PlaceCard key={place.id} place={place}/>)}</View>:<EmptyState title="No sample places found" body="Try another search or category."/>}
  </ScreenShell>;
}
const styles=StyleSheet.create({back:{minHeight:48,justifyContent:'center'},title:{fontFamily:fonts.display,fontSize:31,marginTop:14},note:{fontFamily:fonts.body,fontSize:12,lineHeight:18,marginTop:7},search:{marginTop:22},chips:{marginTop:14},list:{gap:15,marginTop:20}});
