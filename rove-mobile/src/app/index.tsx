import { router } from 'expo-router';
import { useEffect } from 'react';
import { LaunchComposition } from '../components/LaunchComposition';
import { useDiscovery } from '../state/DiscoveryContext';

export default function Entry() {
  const { completed, step } = useDiscovery();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      router.replace(completed ? '/(tabs)' : step === 'location' ? '/onboarding/location' : step === 'preferences' ? '/onboarding/preferences' : '/welcome');
    });
    return () => cancelAnimationFrame(frame);
  }, [completed, step]);
  return <LaunchComposition />;
}
