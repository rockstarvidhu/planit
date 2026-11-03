import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DemoCategory } from '../data/demoPlaces';

const STORAGE_KEY = 'rove:first-launch:v1';
export const ONBOARDING_VERSION = 1;
export type BudgetMode = 'total' | 'perPerson';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DurationPreset = '2–3 hours' | '4–6 hours' | 'Full day' | null;
export type SelectedLocation = { kind: 'demo' | 'device'; id: string; label: string };
export type OnboardingStep = 'welcome' | 'location' | 'preferences';

type Persisted = {
  completedVersion: number;
  step: OnboardingStep;
  location: SelectedLocation | null;
  budgetAmount: number;
  budgetMode: BudgetMode;
  people: number;
  themePreference: ThemePreference;
};
const defaults: Persisted = { completedVersion: 0, step: 'welcome', location: null, budgetAmount: 2750, budgetMode: 'total', people: 2, themePreference: 'system' };

export function parseStoredPreferences(raw: string | null): Persisted {
  if (!raw) return defaults;
  try {
    const data = JSON.parse(raw) as Partial<Persisted>;
    const location = data.location;
    return {
      completedVersion: data.completedVersion === ONBOARDING_VERSION ? ONBOARDING_VERSION : 0,
      step: data.step === 'location' || data.step === 'preferences' ? data.step : 'welcome',
      location: location && (location.kind === 'demo' || location.kind === 'device') && typeof location.id === 'string' && typeof location.label === 'string' && location.label.length <= 100 ? location : null,
      budgetAmount: typeof data.budgetAmount === 'number' && Number.isInteger(data.budgetAmount) && data.budgetAmount >= 100 && data.budgetAmount <= 1000000 ? data.budgetAmount : defaults.budgetAmount,
      budgetMode: data.budgetMode === 'perPerson' ? 'perPerson' : 'total',
      people: typeof data.people === 'number' && Number.isInteger(data.people) && data.people >= 1 && data.people <= 20 ? data.people : defaults.people,
      themePreference: data.themePreference === 'light' || data.themePreference === 'dark' ? data.themePreference : 'system',
    };
  } catch { return defaults; }
}

export function totalBudget(amount: number, mode: BudgetMode, people: number) {
  return mode === 'perPerson' ? amount * people : amount;
}

export function parseBudget(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return amount >= 100 && amount <= 1000000 ? amount : null;
}

export const demoAreas: readonly SelectedLocation[] = [
  { kind: 'demo', id: 'bengaluru', label: 'Bengaluru' },
  { kind: 'demo', id: 'mumbai', label: 'Mumbai' },
  { kind: 'demo', id: 'delhi', label: 'Delhi' },
  { kind: 'demo', id: 'chennai', label: 'Chennai' },
  { kind: 'demo', id: 'hyderabad', label: 'Hyderabad' },
  { kind: 'demo', id: 'pune', label: 'Pune' },
];

type DiscoveryState = {
  ready: boolean;
  completed: boolean;
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  completeOnboarding: () => Promise<void>;
  location: SelectedLocation | null;
  setLocation: (location: SelectedLocation | null) => void;
  budgetAmount: number;
  setBudgetAmount: (amount: number) => void;
  budgetMode: BudgetMode;
  setBudgetMode: (mode: BudgetMode) => void;
  people: number;
  setPeople: (count: number) => void;
  duration: DurationPreset;
  setDuration: (duration: DurationPreset) => void;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  query: string;
  setQuery: (query: string) => void;
  category: DemoCategory | null;
  setCategory: (category: DemoCategory | null) => void;
  savedIds: readonly string[];
  toggleSaved: (id: string) => void;
};
const Context = createContext<DiscoveryState | null>(null);

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<Persisted>(defaults);
  const [duration, setDuration] = useState<DurationPreset>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DemoCategory | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  useEffect(() => { let active = true; AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
    if (active) { setPreferences(parseStoredPreferences(raw)); setReady(true); }
  }).catch(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(() => {}); }, [ready, preferences]);
  const update = useCallback((patch: Partial<Persisted>) => setPreferences((current) => ({ ...current, ...patch })), []);
  const completeOnboarding = useCallback(async () => {
    const next = { ...preferences, completedVersion: ONBOARDING_VERSION };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    setPreferences(next);
  }, [preferences]);
  const toggleSaved = useCallback((id: string) => setSavedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]), []);
  const value = useMemo<DiscoveryState>(() => ({
    ready, completed: preferences.completedVersion === ONBOARDING_VERSION, step: preferences.step,
    setStep: (step) => update({ step }), completeOnboarding,
    location: preferences.location, setLocation: (location) => update({ location }),
    budgetAmount: preferences.budgetAmount, setBudgetAmount: (budgetAmount) => update({ budgetAmount }),
    budgetMode: preferences.budgetMode, setBudgetMode: (budgetMode) => update({ budgetMode }),
    people: preferences.people, setPeople: (people) => update({ people }),
    duration, setDuration, themePreference: preferences.themePreference, setThemePreference: (themePreference) => update({ themePreference }),
    query, setQuery, category, setCategory, savedIds, toggleSaved,
  }), [ready, preferences, duration, query, category, savedIds, update, completeOnboarding, toggleSaved]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDiscovery() {
  const state = useContext(Context);
  if (!state) throw new Error('DiscoveryProvider is missing');
  return state;
}
