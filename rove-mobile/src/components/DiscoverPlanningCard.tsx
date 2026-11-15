import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetEditor, DurationSelector, formatRupees, PeopleStepper } from './BudgetControls';
import { HandoffIcon } from './HandoffIcon';
import type { HandoffIconName } from './HandoffIcon';
import { fonts, useRoveTheme } from '../design/theme';
import { totalBudget, useDiscovery } from '../state/DiscoveryContext';

type Editor = 'budget' | 'people' | 'duration' | null;
const forest = '#244A39';
const ivory = '#F6F3EB';

function Segment({ icon, value, detail, hint, onPress }: {
  icon: HandoffIconName; value: string; detail?: string; hint: string; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${value}${detail ? ` ${detail}` : ''}`}
    accessibilityHint={hint} onPress={onPress} style={styles.segment}>
    <HandoffIcon name={icon} color={ivory} size={21} />
    <View style={styles.segmentCopy}>
      <Text numberOfLines={2} style={styles.segmentValue}>{value}</Text>
      {!!detail && <Text style={styles.segmentDetail}>{detail}</Text>}
    </View>
  </Pressable>;
}

export function DiscoverPlanningCard() {
  const { colors } = useRoveTheme();
  const { budgetAmount, budgetMode, people, duration, setDuration } = useDiscovery();
  const [editor, setEditor] = useState<Editor>(null);
  const total = totalBudget(budgetAmount, budgetMode, people);
  const toggle = (next: Editor) => setEditor(editor === next ? null : next);
  return <View style={styles.panel}>
    <View style={styles.segments}>
      <Segment icon="wallet" value={formatRupees(budgetAmount)} detail={budgetMode === 'perPerson' ? 'per person' : 'total'}
        hint="Edit budget and total or per-person mode" onPress={() => toggle('budget')} />
      <View style={styles.divider} />
      <Segment icon="users" value={`${people} ${people === 1 ? 'person' : 'people'}`} hint="Edit group size" onPress={() => toggle('people')} />
      <View style={styles.divider} />
      <Segment icon="clock" value={duration ?? 'Pick time'} hint="Choose outing duration" onPress={() => toggle('duration')} />
    </View>
    {editor && <View style={[styles.editor, { backgroundColor: colors.surface }]}>
      <Text style={[styles.editorTitle, { color: colors.text }]}>{editor === 'budget' ? 'Set a budget' : editor === 'people' ? 'Who’s coming?' : 'How long do you have?'}</Text>
      {editor === 'budget' && <BudgetEditor onDone={() => setEditor(null)} />}
      {editor === 'people' && <PeopleStepper />}
      {editor === 'duration' && <DurationSelector value={duration} onSelect={(next) => { setDuration(next); setEditor(null); }} />}
    </View>}
    <Text style={styles.summary}>{budgetMode === 'perPerson'
      ? `${formatRupees(budgetAmount)} per person · ${formatRupees(total)} total`
      : `${formatRupees(total)} total · ${formatRupees(Math.round(total / people))} per person`}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Plan my day" onPress={() => router.push('/planning-entry')}
      style={styles.cta}>
      <Text style={styles.ctaText}>Plan my day</Text>
      <HandoffIcon name="arrow-right" color={forest} size={22} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: forest, borderRadius: 22, padding: 10 },
  segments: { minHeight: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.09)', flexDirection: 'row', alignItems: 'center' },
  segment: { flex: 1, minWidth: 0, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 3 },
  segmentCopy: { minWidth: 0, flexShrink: 1 },
  segmentValue: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15, color: ivory },
  segmentDetail: { fontFamily: fonts.body, fontSize: 10, lineHeight: 13, color: ivory },
  divider: { width: 1, height: 27, backgroundColor: 'rgba(246,243,235,0.35)' },
  editor: { borderRadius: 15, padding: 14, marginTop: 12 },
  editorTitle: { fontFamily: fonts.semibold, fontSize: 14, marginBottom: 12 },
  summary: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: ivory, textAlign: 'center', marginTop: 8 },
  cta: { minHeight: 44, borderRadius: 22, backgroundColor: ivory, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 9 },
  ctaText: { fontFamily: fonts.semibold, color: forest, fontSize: 14 },
});
