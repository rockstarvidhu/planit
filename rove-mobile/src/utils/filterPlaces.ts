import type { DemoCategory, DemoPlace } from '../data/demoPlaces';

export function filterPlaces(places: readonly DemoPlace[], query: string, category: DemoCategory | null) {
  const needle = query.trim().toLocaleLowerCase();
  return places.filter((place) => {
    if (category && !place.tags.includes(category)) return false;
    if (!needle) return true;
    return [place.name, place.category, place.area, place.city, place.description, ...place.tags]
      .some((value) => value.toLocaleLowerCase().includes(needle));
  });
}
