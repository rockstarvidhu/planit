import type { DemoCategory } from '../data/demoPlaces';
import type { DurationPreset, SelectedLocation } from '../state/DiscoveryContext';
import type { PlanCreateRequest, PlanningCategory } from '../types/api';

export const moods = ['Chill', 'Explore', 'Date', 'Hangout', 'Creative', 'Solo'] as const;
export type Mood = typeof moods[number];
export const activities = ['Cafés', 'Food', 'Movies', 'Shopping', 'Parks', 'Activities'] as const;
export type Activity = typeof activities[number];
const supported: Partial<Record<Activity, PlanningCategory>> = {
  'Cafés': 'Cafe', Food: 'Food', Parks: 'Outdoors', Shopping: 'Shopping',
};
const backendMoods: Partial<Record<Mood, PlanCreateRequest['mood']>> = {
  Chill: 'Chill', Explore: 'Adventurous', Date: 'Romantic', Hangout: 'Fun',
};
export const moodLimitation = (mood: Mood) => mood === 'Creative'
  ? 'Creative places are not classified by the current planner.'
  : mood === 'Solo' ? 'Solo is not a planner mood yet; set the group to one person below.' : null;
// Movies is accepted by the backend but currently excluded until session times exist.
export const activityLimitation = (activity: Activity) => activity === 'Movies'
  ? 'Movies need session times, which planning does not have yet.'
  : activity === 'Activities' ? 'General activities are not classified by the current planner.' : null;
export function mapActivities(selected: readonly Activity[]): PlanningCategory[] {
  return [...new Set(selected.map(activity => supported[activity]).filter((value): value is PlanningCategory => !!value))].slice(0, 3);
}
export function initialActivities(category: DemoCategory | null): Activity[] {
  return category === 'Cafe' ? ['Cafés'] : category === 'Food' ? ['Food'] :
    category === 'Nature' ? ['Parks'] : category === 'Date ideas' ? ['Cafés', 'Food'] : ['Cafés', 'Food'];
}
const cityCenters: Record<string, { latitude: number; longitude: number }> = {
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  mumbai: { latitude: 19.076, longitude: 72.8777 },
  delhi: { latitude: 28.6139, longitude: 77.209 },
  chennai: { latitude: 13.0827, longitude: 80.2707 },
  hyderabad: { latitude: 17.385, longitude: 78.4867 },
  pune: { latitude: 18.5204, longitude: 73.8567 },
};
export function planningOrigin(location: SelectedLocation | null) {
  if (!location) return null;
  if (location.kind === 'demo') return cityCenters[location.id] ?? null;
  return location.coordinates ?? null;
}
export function durationMinutes(duration: DurationPreset) {
  return duration === '2–3 hours' ? 180 : duration === '4–6 hours' ? 300 : duration === 'Full day' ? 480 : null;
}
export type PlanningInput = {
  location: SelectedLocation | null; budgetAmount: number; budgetMode: 'total' | 'perPerson';
  people: number; duration: DurationPreset; mood: Mood | null; activities: readonly Activity[];
};
export function buildPlanningRequest(input: PlanningInput, now = new Date()): PlanCreateRequest {
  const origin = planningOrigin(input.location);
  const availableMinutes = durationMinutes(input.duration);
  const categories = mapActivities(input.activities);
  if (!origin) throw new Error('Choose an area or refresh your device location.');
  if (availableMinutes === null) throw new Error('Choose how much time you have.');
  if (!Number.isSafeInteger(input.budgetAmount) || input.budgetAmount < 100 || input.budgetAmount > 1000000)
    throw new Error('Enter a valid budget.');
  if (!Number.isSafeInteger(input.people) || input.people < 1 || input.people > 20) throw new Error('Choose your group size.');
  if (input.activities.some(activity => activityLimitation(activity))) throw new Error('Remove unavailable activities before planning.');
  if (input.mood && moodLimitation(input.mood)) throw new Error(moodLimitation(input.mood)!);
  if (!categories.length) throw new Error('Choose at least one available activity.');
  const startAt = new Date(now.getTime() + 120000).toISOString();
  return { origin, startAt, availableMinutes, budgetAmount: input.budgetAmount,
    budgetMode: input.budgetMode, people: input.people, categories, transportMode: 'walk',
    ...(input.mood && backendMoods[input.mood] ? { mood: backendMoods[input.mood] } : {}) };
}
export function newPlanningKey() {
  return `rove_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}
