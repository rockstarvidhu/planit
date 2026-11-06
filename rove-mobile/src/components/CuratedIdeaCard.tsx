import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { DemoPlace } from '../data/demoPlaces';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';
import { BookmarkButton } from './BookmarkButton';
import { HandoffIcon } from './HandoffIcon';

const copy = {
  Cafe: { title: 'Café catch-up', body: 'An easygoing café idea for your day.' },
  Food: { title: 'A food stop', body: 'Make room for a relaxed meal.' },
  Nature: { title: 'Garden stroll', body: 'Slow down with some time outdoors.' },
} as const;

export function CuratedIdeaCard({ place }: { place: DemoPlace }) {
  const { colors } = useRoveTheme();
  const { width } = useWindowDimensions();
  const { people, duration, savedIds, toggleSaved } = useDiscovery();
  const idea = copy[place.category];
  const open = () => router.push({ pathname: '/place/[id]', params: { id: place.id } });
  return <View style={[styles.card, { width: Math.min(342, width - 66), backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${place.name} sample place`} onPress={open}>
      <Image source={place.photo} resizeMode="cover" style={styles.photo} accessibilityLabel={`${place.name} sample photograph`} />
    </Pressable>
    <View style={styles.copy}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${idea.title} sample idea`} onPress={open}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{idea.title}</Text>
        <Text numberOfLines={2} style={[styles.body, { color: colors.muted }]}>{idea.body}</Text>
      </Pressable>
      <Text numberOfLines={1} style={[styles.source, { color: colors.muted }]}>SAMPLE · {place.name}</Text>
      <View style={styles.meta}>
        <HandoffIcon name="clock" color={colors.accent} size={15} />
        <Text numberOfLines={1} style={[styles.metaText, { color: colors.text }]}>{duration ?? 'Flexible time'}</Text>
      </View>
      <View style={styles.bottom}>
        <Text numberOfLines={1} style={[styles.price, { color: colors.muted }]}>Price unverified · {people} {people === 1 ? 'person' : 'people'}</Text>
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
  card: { minHeight: 174, borderWidth: 1, borderRadius: 20, flexDirection: 'row', overflow: 'hidden' },
  photo: { width: 112, height: 174 },
  copy: { flex: 1, minWidth: 0, paddingTop: 13, paddingLeft: 12, paddingRight: 9, paddingBottom: 9 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, paddingRight: 36 },
  body: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 5 },
  source: { fontFamily: fonts.medium, fontSize: 9, marginTop: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' },
  metaText: { fontFamily: fonts.medium, fontSize: 10, flexShrink: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  price: { fontFamily: fonts.body, fontSize: 9, flex: 1 },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bookmark: { position: 'absolute', top: 3, right: 3 },
});
