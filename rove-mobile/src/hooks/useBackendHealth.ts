import { useCallback, useEffect, useRef, useState } from 'react';
import { readApiConfiguration } from '../config/api.ts';
import { ApiClientError, createApiClient } from '../services/api.ts';

export type HealthState =
  | { status: 'idle' | 'loading' | 'success' }
  | { status: 'failure'; message: string };

export function useBackendHealth() {
  const configuration = readApiConfiguration();
  const [state, setState] = useState<HealthState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const check = useCallback(async () => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setState({ status: 'loading' });
    try {
      const client = createApiClient();
      await client.checkHealth(nextController.signal);
      if (!nextController.signal.aborted) setState({ status: 'success' });
    } catch (error) {
      if (nextController.signal.aborted) return;
      setState({ status: 'failure', message: error instanceof ApiClientError
        ? error.message : 'The health check failed.' });
    } finally {
      if (controller.current === nextController) controller.current = null;
    }
  }, []);

  return { configuration, state, check };
}
