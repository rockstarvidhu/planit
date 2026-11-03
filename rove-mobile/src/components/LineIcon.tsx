import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Exact path geometry from the corresponding assets/icons/provisional SVGs. */
const paths = {
  home: 'M18 60 64 20 110 60 M30 52 V108 H98 V52 M54 108 V77 H74 V108',
  plans: 'M28 16 H100 V112 H28 Z M43 42 H85 M43 61 H85 M43 80 H72',
  bookmark: 'M31 17 H97 V112 L64 89 31 112 Z',
  user: 'M64 63 A22 22 0 1 1 64 19 A22 22 0 1 1 64 63 M20 111 C20 76 108 76 108 111',
  search: 'M82 55 A28 28 0 1 1 26 55 A28 28 0 1 1 82 55 M78 79 110 111',
  close: 'M26 26 102 102 M102 26 26 102',
  back: 'M108 64 H20 M53 31 20 64 53 97',
  'map-pin': 'M64 114 C52 95 24 66 24 49 A40 40 0 1 1 104 49 C104 66 76 95 64 114 Z M64 61 A12 12 0 1 1 64 37 A12 12 0 1 1 64 61',
} as const;

export function LineIcon({ name, color, size = 24 }: {
  name: keyof typeof paths;
  color: ColorValue;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <Path d={paths[name]} stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
