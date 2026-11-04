import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { LaunchComposition } from '../components/LaunchComposition';
import { useDiscovery } from '../state/DiscoveryContext';

export default function Entry() {
  const { completed, step } = useDiscovery();
  const [artReady, setArtReady] = useState(false);
  const markReady = useCallback(() => setArtReady(true), []);
  useEffect(() => {
    if (!artReady) return;
    let active = true;
    let frame = 0;
    frame = requestAnimationFrame(() => {
      SplashScreen.hideAsync().finally(() => {
        if (!active) return;
        frame = requestAnimationFrame(() => {
          if (active) router.replace(completed ? '/(tabs)' : step === 'location' ? '/onboarding/location' : step === 'preferences' ? '/onboarding/preferences' : '/welcome');
        });
      });
    });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [artReady, completed, step]);
  return <LaunchComposition onReady={markReady} />;
}
