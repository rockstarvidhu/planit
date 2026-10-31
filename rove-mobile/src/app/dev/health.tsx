import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HealthScreen } from '../../components/HealthScreen';
import { tokens } from '../../design/tokens';

export default function DevelopmentHealth() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.ivory }} edges={['bottom']}>
      <HealthScreen />
    </SafeAreaView>
  );
}
