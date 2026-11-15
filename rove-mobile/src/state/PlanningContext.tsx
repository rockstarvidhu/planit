import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { ApiClientError, createApiClient } from '../services/api';
import { newPlanningKey } from '../services/planningFlow';
import type { PlanCreateRequest, PlanCreateResponse } from '../types/api';

type Failure = { kind: string; message: string; retryAfterSeconds?: number };
type PlanningState = { phase: 'idle' | 'loading' | 'done' | 'error'; response: PlanCreateResponse | null; failure: Failure | null; request: PlanCreateRequest | null };
type Operation = { body: PlanCreateRequest; key: string; controller: AbortController | null; running: boolean; sequence: number };
type PlanningStore = PlanningState & {
  begin: (request: PlanCreateRequest) => boolean;
  retry: () => boolean;
  cancel: () => void;
  cancelPending: () => void;
  replaceResult: (request: PlanCreateRequest, response: PlanCreateResponse) => void;
};
const Context = createContext<PlanningStore | null>(null);
const idle: PlanningState = { phase: 'idle', response: null, failure: null, request: null };

function safeFailure(error: unknown): Failure {
  if (!(error instanceof ApiClientError)) return { kind: 'unexpected', message: 'Planning could not be completed. Please try again.' };
  if (error.status === 409) return { kind: 'already_attempted', message: 'This attempt was already received. Start a new search to try again.' };
  if (error.kind === 'configuration') return { kind: error.kind, message: 'The app needs a backend address. Check EXPO_PUBLIC_API_URL.' };
  if (error.kind === 'network') return { kind: error.kind, message: 'Cannot reach Rove right now. Check your connection and backend address.' };
  if (error.kind === 'timeout') return { kind: error.kind, message: 'Planning took too long. You can check this attempt or start a new search.' };
  if (error.kind === 'rate_limited') return { kind: error.kind, message: 'Too many plans were requested. Please wait before trying again.', retryAfterSeconds: error.retryAfterSeconds };
  return { kind: error.kind, message: error.message };
}

export function PlanningProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const [state, setState] = useState<PlanningState>(idle);
  const operation = useRef<Operation | null>(null);
  const run = useCallback((op: Operation) => {
    if (op.running) return false;
    const controller = new AbortController();
    op.controller = controller;
    op.running = true;
    const sequence = ++op.sequence;
    setState({ phase: 'loading', response: null, failure: null, request: op.body });
    try {
      createApiClient().createPlan(op.body, op.key, controller.signal).then(response => {
        if (operation.current === op && op.sequence === sequence) {
          op.running = false;
          setState({ phase: 'done', response, failure: null, request: op.body });
        }
      }).catch(error => {
        if (operation.current === op && op.sequence === sequence && !controller.signal.aborted) {
          op.running = false;
          setState({ phase: 'error', response: null, failure: safeFailure(error), request: op.body });
        }
      });
    } catch (error) {
      op.running = false;
      setState({ phase: 'error', response: null, failure: safeFailure(error), request: op.body });
    }
    return true;
  }, []);
  const begin = useCallback((request: PlanCreateRequest) => {
    if (operation.current?.running) return false;
    operation.current?.controller?.abort();
    const op: Operation = { body: request, key: newPlanningKey(), controller: null, running: false, sequence: 0 };
    operation.current = op;
    return run(op);
  }, [run]);
  const retry = useCallback(() => {
    const op = operation.current;
    return op && !op.running ? run(op) : false;
  }, [run]);
  const cancel = useCallback(() => {
    const op = operation.current;
    if (op?.running) { op.sequence++; op.controller?.abort(); op.running = false; }
    operation.current = null;
    setState(idle);
  }, []);
  const cancelPending = useCallback(() => { if (operation.current?.running) cancel(); }, [cancel]);
  const replaceResult = useCallback((request: PlanCreateRequest, response: PlanCreateResponse) => {
    operation.current?.controller?.abort();
    operation.current = null;
    setState({ phase: 'done', request, response, failure: null });
  }, []);
  useEffect(() => {
    if (previousPath.current === '/planning' && pathname !== '/planning') cancelPending();
    previousPath.current = pathname;
  }, [pathname, cancelPending]);
  return <Context.Provider value={{ ...state, begin, retry, cancel, cancelPending, replaceResult }}>{children}</Context.Provider>;
}

export function usePlanning() {
  const state = useContext(Context);
  if (!state) throw new Error('PlanningProvider is missing');
  return state;
}
