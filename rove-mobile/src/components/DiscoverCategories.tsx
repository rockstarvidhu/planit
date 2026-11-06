import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { HandoffIcon } from './HandoffIcon';
import type { HandoffIconName } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';

export type DiscoverCategory = 'Nearby' | 'Food' | 'Movies' | 'Outdoors';
const categories: readonly { name: DiscoverCategory; icon: HandoffIconName }[] = [
  { name: 'Nearby', icon: 'map-pin' },
  { name: 'Food', icon: 'utensils' },
  { name: 'Movies', icon: 'movie' },
  { name: 'Outdoors', icon: 'tree' },
];

export function DiscoverCategories({ selected, onSelect }: { selected: DiscoverCategory; onSelect: (category: DiscoverCategory) => void }) {
  const { colors } = useRoveTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
    {categories.map(({ name, icon }) => <Pressable key={name} accessibilityRole="button" accessibilityLabel={`${name} category`}
      accessibilityState={{ selected: selected === name }} onPress={() => onSelect(name)}
      style={[styles.chip, { backgroundColor: selected === name ? colors.accent : colors.background, borderColor: colors.accent }]}>
      <HandoffIcon name={icon} color={selected === name ? colors.buttonText : colors.accent} size={20} />
      <Text style={[styles.label, { color: selected === name ? colors.buttonText : colors.text }]}>{name}</Text>
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -22 },
  row: { paddingHorizontal: 22, gap: 8, alignItems: 'center' },
  chip: { minHeight: 46, borderWidth: 1, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13 },
  label: { fontFamily: fonts.medium, fontSize: 13 },
});
