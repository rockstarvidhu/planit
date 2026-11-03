import { Redirect } from 'expo-router';
import { LaunchComposition } from '../../components/LaunchComposition';

// Visual QA route for the in-app launch bridge; never shown as a production tab.
export default function LaunchPreview() {
  if (!__DEV__) return <Redirect href="/" />;
  return <LaunchComposition />;
}
