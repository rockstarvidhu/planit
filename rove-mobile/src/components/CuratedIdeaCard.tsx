import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { DemoPlace } from '../data/demoPlaces';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';
import { BookmarkButton } from './BookmarkButton';
import { HandoffIcon } from './HandoffIcon';

const copy = {
  Cafe: { category: 'CAFÉ', title: 'Café catch-up', body: 'An easygoing café idea for your day.' },
  Food: { category: 'FOOD', title: 'A food stop', body: 'Make room for a relaxed meal.' },
  Nature: { category: 'OUTDOORS', title: 'Garden stroll', body: 'Slow down with some time outdoors.' },
} as const;

export function CuratedIdeaCard({ place }: { place: DemoPlace }) {
  const { colors } = useRoveTheme();
  const { width } = useWindowDimensions();
  const { people, duration, savedIds, toggleSaved } = useDiscovery();
  const idea = copy[place.category];
  const open = () => router.push({ pathname: '/place/[id]', params: { id: place.id } });
  return <View style={[styles.card, { width: Math.min(350, width - 66), backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${place.name} sample place`} onPress={open} style={styles.photoButton}>
      <Image source={place.photo} resizeMode="cover" style={styles.photo} accessibilityLabel={`${place.name} sample photograph`} />
    </Pressable>
    <View style={styles.copy}>
      <Text style={[styles.category, { backgroundColor: colors.chip, color: colors.accent }]}>{idea.category}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${idea.title} sample idea`} onPress={open}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{idea.title}</Text>
        <Text numberOfLines={2} style={[styles.body, { color: colors.muted }]}>{idea.body}</Text>
      </Pressable>
      <Text numberOfLines={1} style={[styles.source, { color: colors.muted }]}>SAMPLE · {place.name}</Text>
      <View style={styles.meta}>
        <HandoffIcon name="clock" color={colors.accent} size={15} />
        <Text numberOfLines={1} style={[styles.metaText, { color: colors.text }]}>{duration ?? 'Flexible time'}</Text>
        <HandoffIcon name="users" color={colors.accent} size={15} />
        <Text style={[styles.metaText, { color: colors.text }]}>{people} {people === 1 ? 'person' : 'people'}</Text>
      </View>
      <View style={styles.bottom}>
        <Text numberOfLines={1} style={[styles.price, { color: colors.muted }]}>Price unavailable</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${idea.title}`} onPress={open}
          style={[styles.arrow, { backgroundColor: colors.accent }]}>
          <HandoffIcon name="arrow-right" color={colors.buttonText} size={17} />
        </Pressable>
      </View>
    </View>
    <View style={styles.bookmark}><BookmarkButton placeName={place.name} saved={savedIds.includes(place.id)} onPress={() => toggleSaved(place.id)} /></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 188, borderWidth: 1, borderRadius: 20, flexDirection: 'row', overflow: 'hidden' },
  photoButton: { width: '38%', alignSelf: 'stretch' },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  copy: { flex: 1, minWidth: 0, paddingTop: 11, paddingLeft: 12, paddingRight: 9, paddingBottom: 9 },
  category: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontFamily: fonts.semibold, fontSize: 9 },
  title: { fontFamily: fonts.editorialSemibold, fontSize: 16, lineHeight: 20, paddingRight: 24, marginTop: 4 },
  body: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 4 },
  source: { fontFamily: fonts.medium, fontSize: 9, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginTop: 'auto' },
  metaText: { fontFamily: fonts.medium, fontSize: 9, marginRight: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  price: { fontFamily: fonts.body, fontSize: 10, flex: 1 },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bookmark: { position: 'absolute', top: 3, right: 3 },
});
