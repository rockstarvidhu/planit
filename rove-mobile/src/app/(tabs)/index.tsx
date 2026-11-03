import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CategoryChips } from '../../components/CategoryChips';
import { DiscoverHeader } from '../../components/DiscoverHeader';
import { DiscoverPlanningCard } from '../../components/DiscoverPlanningCard';
import { DiscoverySearch } from '../../components/DiscoverySearch';
import { EmptyState } from '../../components/EmptyState';
import { PlaceCard } from '../../components/PlaceCard';
import { ScreenShell } from '../../components/ScreenShell';
import { demoPlaces } from '../../data/demoPlaces';
import { fonts, useRoveTheme } from '../../design/theme';
import { useDiscovery } from '../../state/DiscoveryContext';
import { filterPlaces } from '../../utils/filterPlaces';

export default function Discover(){
  const {query,setQuery,category,setCategory,location}=useDiscovery();const {colors}=useRoveTheme();
  const places=filterPlaces(demoPlaces,query,category);
  return <ScreenShell>
    <DiscoverHeader/>
    <View style={styles.search}><DiscoverySearch value={query} onChangeText={setQuery}/></View>
    <View style={styles.planner}><DiscoverPlanningCard/></View>
    <View style={styles.chips}><CategoryChips selected={category} onSelect={setCategory}/></View>
    <View style={styles.sectionHead}><Text style={[styles.sectionTitle,{color:colors.text}]}>{location?.label.toLowerCase().includes('bengaluru')?'Popular near you':'Places to explore'}</Text><Link href="/places" asChild><Pressable accessibilityRole="button" style={styles.seeAll}><Text style={{color:colors.accent,fontFamily:fonts.medium,fontSize:14}}>See all</Text></Pressable></Link></View>
    <View style={styles.captionRow}><Text style={[styles.sampleNotice,{color:colors.muted}]}>SAMPLE PLACES · NOT LIVE RESULTS</Text><Link href="/location" asChild><Pressable accessibilityRole="button" accessibilityLabel="Choose or change area"><Text style={{color:colors.accent,fontFamily:fonts.medium,fontSize:11}}>{location?.label??'Choose area'}</Text></Pressable></Link></View>
    {places.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cards} contentContainerStyle={styles.cardRow}>{places.map((place)=><PlaceCard key={place.id} place={place}/>)}</ScrollView>:<EmptyState title="No sample places found" body="Try another search or category. These examples are not live nearby results."/>}
    {(query||category)&&<Pressable accessibilityRole="button" onPress={()=>{setQuery('');setCategory(null);}} style={styles.reset}><Text style={{color:colors.accent,fontFamily:fonts.semibold,fontSize:13}}>Clear filters</Text></Pressable>}
  </ScreenShell>;
}
const styles=StyleSheet.create({search:{marginTop:22},planner:{marginTop:18},chips:{marginTop:15},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:27},sectionTitle:{fontFamily:fonts.semibold,fontSize:20,lineHeight:26},seeAll:{minHeight:44,justifyContent:'center',paddingLeft:10},captionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:9},sampleNotice:{fontFamily:fonts.body,fontSize:9,letterSpacing:0.4},cards:{marginHorizontal:-22},cardRow:{paddingHorizontal:22,gap:12,paddingBottom:5},reset:{minHeight:44,alignSelf:'flex-start',justifyContent:'center',marginTop:8}});
