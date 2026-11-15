import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { onboardingArt } from '../assets/onboardingArt';
import { palettes } from '../design/theme';

export function LaunchComposition({ onReady }: { onReady?: () => void }) {
  const colors = palettes.light;
  const [loaded, setLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const source = onboardingArt.splash.light;
  const assetWidth = 941;
  const assetHeight = 1672;
  const scale = viewport.width && viewport.height ? Math.min(viewport.width / assetWidth, viewport.height / assetHeight) : 0;
  useEffect(() => { if (loaded && laidOut) onReady?.(); }, [loaded, laidOut, onReady]);
  return <View style={[styles.root, { backgroundColor: colors.background }]} onLayout={(event) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => current.width === width && current.height === height ? current : { width, height });
  }}>
    {!!scale && <Image source={source} resizeMode="contain" fadeDuration={0} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} onLayout={() => setLaidOut(true)}
      style={{ width: assetWidth * scale, height: assetHeight * scale }} accessibilityLabel="Rove illustrated launch artwork" />}
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' } });
