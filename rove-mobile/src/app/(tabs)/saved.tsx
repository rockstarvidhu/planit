import { StyleSheet, Text, View } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { EmptyState } from '../../components/EmptyState';
import { PlaceCard } from '../../components/PlaceCard';
import { ScreenShell } from '../../components/ScreenShell';
import { demoPlaces } from '../../data/demoPlaces';
import { fonts, useRoveTheme } from '../../design/theme';
import { useDiscovery } from '../../state/DiscoveryContext';
export default function Saved(){const {savedIds}=useDiscovery();const {colors}=useRoveTheme();const places=demoPlaces.filter(place=>savedIds.includes(place.id));return <ScreenShell><Text style={[styles.eyebrow,{color:colors.accent}]}>KEEP CLOSE</Text><Text style={[styles.title,{color:colors.text}]}>Saved</Text><Text style={[styles.intro,{color:colors.muted}]}>Keep a little list of places worth returning to.</Text><Text style={[styles.note,{color:colors.muted}]}>Sample saves stay only until this app session ends.</Text><EditorialSection title="Places">{places.length?<View style={styles.list}>{places.map(place=><PlaceCard key={place.id} place={place}/>)}</View>:<EmptyState title="Nothing saved yet" body="Save a sample place while exploring and it will appear here." exploreAction/>}</EditorialSection><EditorialSection title="Outings"><EmptyState title="No saved outings" body="Saved outings will appear here in a future milestone."/></EditorialSection></ScreenShell>}
const styles=StyleSheet.create({eyebrow:{fontFamily:fonts.semibold,fontSize:11,letterSpacing:1.3},title:{fontFamily:fonts.display,fontSize:32,lineHeight:39,marginTop:32},intro:{fontFamily:fonts.body,fontSize:14,lineHeight:21,marginTop:8},note:{fontFamily:fonts.body,fontSize:12,marginTop:12},list:{gap:16,paddingTop:16}});
