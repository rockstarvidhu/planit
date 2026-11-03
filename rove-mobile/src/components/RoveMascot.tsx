import { Image } from 'react-native';
const original = require('../../assets/mascot/explorer-walking-original.png');
export function RoveMascot({ width, height }: { width: number; height: number }) {
  return <Image source={original} style={{ width, height }} resizeMode="contain" accessibilityLabel="Rove explorer mascot" />;
}
