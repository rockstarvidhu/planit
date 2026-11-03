import { StyleSheet, Text } from 'react-native';
import { EditorialSection } from '../../components/EditorialSection';
import { EmptyState } from '../../components/EmptyState';
import { ScreenShell } from '../../components/ScreenShell';
import { fonts, useRoveTheme } from '../../design/theme';
export default function Plans(){const {colors}=useRoveTheme();return <ScreenShell><Text style={[styles.eyebrow,{color:colors.accent}]}>YOUR DAYS OUT</Text><Text style={[styles.title,{color:colors.text}]}>Plans</Text><Text style={[styles.intro,{color:colors.muted}]}>A place for the days you want to make happen.</Text><EditorialSection title="Coming up"><EmptyState title="No upcoming plans yet" body="When you make a plan, it will appear here." exploreAction/></EditorialSection><EditorialSection title="Past plans"><EmptyState title="Your story starts here" body="Past outings will have their own place."/></EditorialSection></ScreenShell>}
const styles=StyleSheet.create({eyebrow:{fontFamily:fonts.semibold,fontSize:11,letterSpacing:1.3},title:{fontFamily:fonts.display,fontSize:32,lineHeight:39,marginTop:32},intro:{fontFamily:fonts.body,fontSize:14,lineHeight:21,marginTop:8}});
