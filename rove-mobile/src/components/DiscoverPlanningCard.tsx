import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BudgetEditor, DurationSelector, formatRupees, PeopleStepper } from './BudgetControls';
import { HandoffIcon } from './HandoffIcon';
import type { HandoffIconName } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';
import { useDiscovery } from '../state/DiscoveryContext';

type Editor = 'budget' | 'people' | 'duration' | null;
const mascot = require('../../assets/discover/rove_map_holding_mascot.png');
const backdrop = require('../../assets/discover/rove_discover_sage_aqua_splash.png');

function Control({ icon, label, hint, onPress }: { icon: HandoffIconName; label: string; hint: string; onPress: () => void }) {
  const { colors } = useRoveTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}
    style={[styles.control, { backgroundColor: colors.surface }]}>
    <HandoffIcon name={icon} color={colors.text} size={18} />
    <Text numberOfLines={1} style={[styles.controlLabel, { color: colors.text }]}>{label}</Text>
  </Pressable>;
}

export function DiscoverPlanningCard() {
  const { colors } = useRoveTheme();
  const { width } = useWindowDimensions();
  const { budgetAmount, budgetMode, people, duration, setDuration } = useDiscovery();
  const [editor, setEditor] = useState<Editor>(null);
  const artWidth = Math.min(140, Math.max(112, (Math.min(width, 430) - 44) * 0.38));
  const toggle = (next: Editor) => setEditor(editor === next ? null : next);
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.top}>
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>DISCOVER YOUR DAY</Text>
        <Text style={[styles.headline, width < 380 && styles.compactHeadline, { color: colors.cardText }]}>Discover within your budget.</Text>
        <Text style={[styles.description, { color: colors.cardText }]}>Tell us your budget, time and vibe. We’ll figure out your day.</Text>
      </View>
      <View style={[styles.art, { width: artWidth, height: artWidth * 1.28 }]}>
        <Image source={backdrop} resizeMode="contain" style={styles.backdrop} accessibilityIgnoresInvertColors />
        <Image source={mascot} resizeMode="contain" style={styles.mascot} accessibilityLabel="Rove explorer holding a map" accessibilityIgnoresInvertColors />
      </View>
    </View>
    <View style={styles.controls}>
      <Control icon="wallet" label={formatRupees(budgetAmount)} hint={`Edit budget. Currently ${budgetMode === 'perPerson' ? 'per person' : 'total'} budget.`} onPress={() => toggle('budget')} />
      <Control icon="users" label={`${people} ${people === 1 ? 'person' : 'people'}`} hint="Edit group size" onPress={() => toggle('people')} />
      <Control icon="clock" label={duration ?? 'Pick time'} hint="Choose outing duration" onPress={() => toggle('duration')} />
    </View>
    {editor && <View style={[styles.editor, { borderColor: colors.border }]}>
      <Text style={[styles.editorTitle, { color: colors.text }]}>{editor === 'budget' ? 'Set a budget' : editor === 'people' ? 'Who’s coming?' : 'How long do you have?'}</Text>
      {editor === 'budget' && <BudgetEditor onDone={() => setEditor(null)} />}
      {editor === 'people' && <PeopleStepper />}
      {editor === 'duration' && <DurationSelector value={duration} onSelect={(next) => { setDuration(next); setEditor(null); }} />}
    </View>}
    {budgetMode === 'perPerson' && <Text style={[styles.budgetNote, { color: colors.cardText }]}>{formatRupees(budgetAmount)} per person · {formatRupees(budgetAmount * people)} total</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Plan my day" onPress={() => router.push('/planning-entry')}
      style={[styles.cta, { backgroundColor: colors.accent }]}>
      <Text style={[styles.ctaText, { color: colors.buttonText }]}>Plan my day</Text>
      <HandoffIcon name="arrow-right" color={colors.buttonText} size={20} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 25, borderWidth: 1, padding: 16, overflow: 'hidden' },
  top: { flexDirection: 'row', minHeight: 180, alignItems: 'flex-start' },
  copy: { flex: 1, minWidth: 0, paddingRight: 2, zIndex: 1 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5 },
  headline: { fontFamily: fonts.display, fontSize: 27, lineHeight: 30, marginTop: 12 },
  compactHeadline: { fontSize: 25, lineHeight: 28 },
  description: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 10 },
  art: { alignSelf: 'flex-end', marginRight: -12, marginBottom: -5 },
  backdrop: { position: 'absolute', width: '130%', height: '100%', right: -9, bottom: -2 },
  mascot: { position: 'absolute', width: '100%', height: '100%', right: 0, bottom: 0 },
  controls: { flexDirection: 'row', gap: 7, marginTop: 7 },
  control: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  controlLabel: { fontFamily: fonts.medium, fontSize: 11, flexShrink: 1 },
  editor: { borderTopWidth: 1, marginTop: 13, paddingTop: 13 },
  editorTitle: { fontFamily: fonts.semibold, fontSize: 14, marginBottom: 12 },
  budgetNote: { fontFamily: fonts.body, fontSize: 11, marginTop: 8 },
  cta: { minHeight: 49, borderRadius: 26, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 15 },
});
