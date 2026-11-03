import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, useRoveTheme } from '../design/theme';
import { parseBudget, totalBudget, useDiscovery } from '../state/DiscoveryContext';
import type { DurationPreset } from '../state/DiscoveryContext';

export const formatRupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const durationOptions: Exclude<DurationPreset, null>[] = ['2–3 hours','4–6 hours','Full day'];

export function BudgetEditor({ onDone, onValidityChange, showSaveAction = true, large = false }: { onDone?: () => void; onValidityChange?: (valid: boolean) => void; showSaveAction?: boolean; large?: boolean }) {
  const { colors } = useRoveTheme();
  const { budgetAmount, setBudgetAmount, budgetMode, setBudgetMode, people } = useDiscovery();
  const [draft, setDraft] = useState(budgetAmount.toLocaleString('en-IN'));
  const [message, setMessage] = useState('');
  const amount = parseBudget(draft);
  const save = () => { if (amount === null) { setMessage('Enter a whole amount from ₹100 to ₹10,00,000.'); return; } setBudgetAmount(amount); setMessage(''); onDone?.(); };
  return <View>
    <Text style={[styles.label,{color:colors.text}]}>Your budget</Text>
    <View style={[styles.inputShell, large && styles.largeInputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: large ? 27 : 20 }}>₹</Text>
      <TextInput accessibilityLabel="Budget in Indian rupees" keyboardType="number-pad" value={draft} onChangeText={(text) => { setDraft(text); setMessage(''); const valid=parseBudget(text); onValidityChange?.(valid!==null); if(valid!==null) setBudgetAmount(valid); }} onBlur={() => { if (amount !== null) setDraft(amount.toLocaleString('en-IN')); }} placeholder="2,750" placeholderTextColor={colors.muted}
        style={[styles.input, large && styles.largeInput, { color: colors.text }]} />
    </View>
    <View style={styles.modes}>
      {(['total','perPerson'] as const).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{selected:budgetMode===option}} onPress={() => setBudgetMode(option)} style={[styles.mode,{backgroundColor:budgetMode===option?colors.accent:colors.interactive}]}>
        <Text style={{color:budgetMode===option?colors.buttonText:colors.text,fontFamily:fonts.medium,fontSize:13}}>{option==='total'?'Total budget':'Per person'}</Text>
      </Pressable>)}
    </View>
    <Text style={[styles.hint,{color:colors.muted}]}>{amount===null?'Enter a valid amount to continue.':budgetMode==='perPerson'?`${formatRupees(amount)} × ${people} ${people===1?'person':'people'} = ${formatRupees(totalBudget(amount,budgetMode,people))} total`:`${formatRupees(amount)} total for ${people} ${people===1?'person':'people'}`}</Text>
    {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    {showSaveAction && <Pressable accessibilityRole="button" onPress={save} style={[styles.save,{backgroundColor:colors.accent}]}><Text style={{color:colors.buttonText,fontFamily:fonts.semibold}}>Save budget</Text></Pressable>}
  </View>;
}

export function PeopleStepper() {
  const { people, setPeople } = useDiscovery(); const { colors } = useRoveTheme();
  return <View style={styles.stepper}>
    <Pressable accessibilityRole="button" accessibilityLabel="Decrease people" disabled={people<=1} onPress={() => setPeople(Math.max(1,people-1))} style={[styles.stepButton,{backgroundColor:colors.interactive,opacity:people<=1?0.4:1}]}><Text style={{color:colors.text,fontSize:22}}>−</Text></Pressable>
    <Text accessibilityLabel={`${people} people`} style={{color:colors.text,fontFamily:fonts.semibold,fontSize:16}}>{people} {people===1?'person':'people'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Increase people" disabled={people>=20} onPress={() => setPeople(Math.min(20,people+1))} style={[styles.stepButton,{backgroundColor:colors.interactive,opacity:people>=20?0.4:1}]}><Text style={{color:colors.text,fontSize:22}}>+</Text></Pressable>
  </View>;
}

export function DurationSelector({ value, onSelect }: { value: DurationPreset; onSelect: (value: DurationPreset) => void }) {
  const { colors } = useRoveTheme();
  return <View style={styles.durationRow}>{durationOptions.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{selected:value===option}} onPress={() => onSelect(value===option?null:option)} style={[styles.duration,{backgroundColor:value===option?colors.accent:colors.interactive}]}><Text style={{color:value===option?colors.buttonText:colors.text,fontFamily:fonts.medium,fontSize:12}}>{option}</Text></Pressable>)}</View>;
}
const styles=StyleSheet.create({
  label:{fontFamily:fonts.semibold,fontSize:14,marginBottom:8}, inputShell:{height:52,borderWidth:1,borderRadius:14,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:8},largeInputShell:{height:68},input:{height:'100%',flex:1,fontFamily:fonts.body,fontSize:17},largeInput:{fontFamily:fonts.display,fontSize:29},
  modes:{flexDirection:'row',gap:8,marginTop:14},mode:{minHeight:44,borderRadius:22,paddingHorizontal:13,alignItems:'center',justifyContent:'center'},
  hint:{fontFamily:fonts.body,fontSize:12,lineHeight:18,marginTop:10},error:{fontFamily:fonts.body,color:'#B42E27',marginTop:6,fontSize:12},
  save:{minHeight:48,borderRadius:24,alignItems:'center',justifyContent:'center',marginTop:16},
  stepper:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14},stepButton:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},
  durationRow:{flexDirection:'row',flexWrap:'wrap',gap:7},duration:{minHeight:44,borderRadius:22,paddingHorizontal:12,justifyContent:'center'},
});
