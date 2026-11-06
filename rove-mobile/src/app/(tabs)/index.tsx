import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CuratedIdeaCard } from '../../components/CuratedIdeaCard';
import { DiscoverCategories } from '../../components/DiscoverCategories';
import type { DiscoverCategory } from '../../components/DiscoverCategories';
import { DiscoverHeader } from '../../components/DiscoverHeader';
import { DiscoverPlanningCard } from '../../components/DiscoverPlanningCard';
import { EmptyState } from '../../components/EmptyState';
import { HandoffIcon } from '../../components/HandoffIcon';
import { ScreenShell } from '../../components/ScreenShell';
import { demoPlaces } from '../../data/demoPlaces';
import { fonts, useRoveTheme } from '../../design/theme';
import { useDiscovery } from '../../state/DiscoveryContext';

export default function Discover() {
  const { category, setCategory, location } = useDiscovery();
  const { colors } = useRoveTheme();
  const [selected, setSelected] = useState<DiscoverCategory>(category === 'Food' ? 'Food' : category === 'Nature' ? 'Outdoors' : 'Nearby');
  const select = (next: DiscoverCategory) => {
    setSelected(next);
    setCategory(next === 'Food' ? 'Food' : next === 'Outdoors' ? 'Nature' : null);
  };
  const ideas = selected === 'Movies' ? [] : demoPlaces.filter((place) =>
    selected === 'Nearby' || (selected === 'Food' && place.category === 'Food') || (selected === 'Outdoors' && place.category === 'Nature'));

  return <ScreenShell>
    <DiscoverHeader />
    <View style={styles.planner}><DiscoverPlanningCard /></View>
    <View style={styles.categories}><DiscoverCategories selected={selected} onSelect={select} /></View>
    {selected === 'Nearby' && !location && <View style={[styles.locationPrompt, { borderColor: colors.border }]}>
      <Text style={[styles.locationText, { color: colors.muted }]}>Choose an area for future nearby recommendations. These ideas are local samples.</Text>
      <Link href="/location" asChild><Pressable accessibilityRole="button" accessibilityLabel="Choose an area" style={styles.locationAction}><Text style={[styles.locationLink, { color: colors.accent }]}>Choose area →</Text></Pressable></Link>
    </View>}
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Curated for you</Text>
      <Link href="/places" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="See all sample places" style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: colors.accent }]}>See all</Text>
          <HandoffIcon name="arrow-right" color={colors.accent} size={17} />
        </Pressable>
      </Link>
    </View>
    <Text style={[styles.sampleNotice, { color: colors.muted }]}>SAMPLE IDEAS · NOT LIVE RESULTS · PRICES UNVERIFIED</Text>
    {ideas.length
      ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cards} contentContainerStyle={styles.cardRow}>
          {ideas.map((place) => <CuratedIdeaCard key={place.id} place={place} />)}
        </ScrollView>
      : <EmptyState title="No movie samples yet" body="Movies will appear when a supported source is available. Try another category or view all sample places." />}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  planner: { marginTop: 17 },
  categories: { marginTop: 19 },
  locationPrompt: { borderBottomWidth: 1, paddingVertical: 10 },
  locationText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  locationAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  locationLink: { fontFamily: fonts.semibold, fontSize: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 10 },
  seeAllText: { fontFamily: fonts.medium, fontSize: 14 },
  sampleNotice: { fontFamily: fonts.body, fontSize: 9, letterSpacing: 0.3, marginTop: 1, marginBottom: 10 },
  cards: { marginHorizontal: -22 },
  cardRow: { paddingHorizontal: 22, gap: 11, paddingBottom: 5 },
});
