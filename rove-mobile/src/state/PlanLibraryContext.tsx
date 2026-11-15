import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { parseSavedPlans, persistSavedPlans, snapshotFixturePlan } from '../services/savedPlans';
import type { SavedPlan } from '../services/savedPlans';
import type { PlanCreateRequest, PlanCreateResponse, PlannedItinerary } from '../types/api';
import { canSaveFixture } from '../services/planPresentation';

export type { SavedPlan } from '../services/savedPlans';

const KEY = 'rove:saved-plans:v1';
type Library = {
  ready: boolean; error: string | null; plans: SavedPlan[];
  save: (name: string, plan: PlannedItinerary, request: PlanCreateRequest, response: PlanCreateResponse, area: string) => Promise<SavedPlan>;
  remove: (id: string) => Promise<void>;
};
const Context = createContext<Library | null>(null);

export function PlanLibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const current = useRef<SavedPlan[]>([]);
  const pending = useRef(false);
  useEffect(() => { let active = true;
    AsyncStorage.getItem(KEY).then(raw => { if (active) {
      const parsed = parseSavedPlans(raw); current.current = parsed; setPlans(parsed); setReady(true);
    } }).catch(() => { if (active) { setError('Saved plans could not be read on this device.'); setReady(true); } });
    return () => { active = false; };
  }, []);
  const write = useCallback(async (next: SavedPlan[]) => {
    if (pending.current || !ready || error) throw new Error('Saved plans are not available right now.');
    pending.current = true;
    try {
      await persistSavedPlans(AsyncStorage, next);
      current.current = next;
      setPlans(next);
    } finally { pending.current = false; }
  }, [ready, error]);
  const save = useCallback(async (name: string, plan: PlannedItinerary, request: PlanCreateRequest,
    response: PlanCreateResponse, area: string) => {
    if (!name.trim() || name.trim().length > 80) throw new Error('Enter a plan name of up to 80 characters.');
    if (!canSaveFixture(response, plan)) {
      throw new Error('Only fictional demo plans can be saved locally until live place data can be refreshed safely.');
    }
    const item: SavedPlan = { id: `rove_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      name: name.trim(), savedAt: new Date().toISOString(), area,
      preferences: { budgetAmount: request.budgetAmount, budgetMode: request.budgetMode,
        people: request.people, availableMinutes: request.availableMinutes,
        categories: [...request.categories], transportMode: request.transportMode, mood: request.mood },
      plan: snapshotFixturePlan(plan), demo: true, provisional: true };
    parseSavedPlans(JSON.stringify([item]));
    await write([item, ...current.current].slice(0, 50));
    return item;
  }, [write]);
  const remove = useCallback(async (id: string) => write(current.current.filter(item => item.id !== id)), [write]);
  return <Context.Provider value={{ ready, error, plans, save, remove }}>{children}</Context.Provider>;
}

export function usePlanLibrary() {
  const value = useContext(Context);
  if (!value) throw new Error('PlanLibraryProvider is missing');
  return value;
}
