import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Geometry copied from design-handoff/.../icons/provisional (24×24 candidates). */
export type HandoffIconName = 'compass'|'map'|'bookmark'|'bookmark-filled'|'user'|'wallet'|'users'|'clock'|'coffee'|'utensils'|'mountain'|'calendar-heart'|'arrow-right'|'search'|'close'|'map-pin'|'movie'|'tree';
export function HandoffIcon({ name, color, size = 22 }: { name: HandoffIconName; color: string; size?: number }) {
  const shared = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...shared}>
    {name==='compass'&&<><Circle cx="12" cy="12" r="9"/><Path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1z"/></>}
    {name==='map'&&<Path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15M15 6v15"/>}
    {name==='bookmark'&&<Path d="M5 3h14v18l-7-5-7 5z"/>}
    {name==='bookmark-filled'&&<Path fill={color} stroke="none" d="M5 3h14v18l-7-5-7 5z"/>}
    {name==='user'&&<><Circle cx="12" cy="8" r="4"/><Path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>}
    {name==='wallet'&&<><Rect x="3" y="6" width="18" height="15" rx="3"/><Path d="M3 9V6a3 3 0 0 1 3-3h12M16 12h5v5h-5a2.5 2.5 0 0 1 0-5z"/></>}
    {name==='users'&&<><Circle cx="9" cy="8" r="3"/><Path d="M2 20v-2a7 7 0 0 1 14 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v1"/></>}
    {name==='clock'&&<><Circle cx="12" cy="12" r="9"/><Path d="M12 7v5l4 2"/></>}
    {name==='coffee'&&<Path d="M4 8h13v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 9h2a3 3 0 0 1 0 6h-2M3 21h16"/>}
    {name==='utensils'&&<Path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 21V3c-3 3-3 8 0 11h3"/>}
    {name==='mountain'&&<Path d="m2 20 7-12 4 6 3-4 6 10zM8 20l5-9"/>}
    {name==='calendar-heart'&&<><Rect x="3" y="5" width="18" height="16" rx="2"/><Path d="M7 3v4M17 3v4M3 10h18M12 18s-3-1.5-3-3a2 2 0 0 1 3-1 2 2 0 0 1 3 1c0 1.5-3 3-3 3z"/></>}
    {name==='arrow-right'&&<Path d="M4 12h16m-6-6 6 6-6 6"/>}
    {name==='search'&&<><Circle cx="10.5" cy="10.5" r="6.5"/><Path d="m16 16 5 5"/></>}
    {name==='close'&&<Path d="M5 5l14 14M19 5 5 19"/>}
    {name==='map-pin'&&<><Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><Circle cx="12" cy="10" r="2.5"/></>}
    {name==='movie'&&<><Rect x="3" y="7" width="18" height="14" rx="2"/><Path d="M3 11h18M5 7l3-4h4l-3 4M13 7l3-4h4l-3 4"/></>}
    {name==='tree'&&<Path d="m12 2 7 9h-4l5 7H4l5-7H5zM12 18v4"/>}
  </Svg>;
}
