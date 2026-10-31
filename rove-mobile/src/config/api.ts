export type ApiConfiguration =
  | { state: 'ready'; baseUrl: string }
  | { state: 'missing' | 'invalid'; message: string };

// Expo replaces this static reference in the client bundle. It must never contain a secret.
export function readApiConfiguration(raw = process.env.EXPO_PUBLIC_API_URL): ApiConfiguration {
  if (!raw?.trim()) {
    return { state: 'missing', message: 'Backend URL is not configured.' };
  }

  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username ||
        url.password || url.search || url.hash || url.pathname !== '/') {
      return { state: 'invalid', message: 'Backend URL must be an HTTP(S) origin.' };
    }
    if (url.protocol === 'http:' && !(typeof __DEV__ !== 'undefined' && __DEV__)) {
      return { state: 'invalid', message: 'Backend URL must use HTTPS outside development.' };
    }
    return { state: 'ready', baseUrl: url.origin };
  } catch {
    return { state: 'invalid', message: 'Backend URL must be an HTTP(S) origin.' };
  }
}
