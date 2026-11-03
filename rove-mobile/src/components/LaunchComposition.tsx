import { Image, StyleSheet, View } from 'react-native';
import { v2Art } from '../assets/v2Art';
import { useRoveTheme } from '../design/theme';

export function LaunchComposition() {
  const { mode, colors } = useRoveTheme();
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <Image source={v2Art.splash[mode]} resizeMode={mode === 'light' ? 'contain' : 'cover'} style={styles.art} accessibilityLabel="Rove illustrated launch artwork" />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, art: { width: '100%', height: '100%' } });
