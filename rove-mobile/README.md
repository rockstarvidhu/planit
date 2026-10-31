# Rove mobile foundation

This SDK 58 TypeScript app currently contains only a development health screen.
It does not call itinerary, geocoding, photo, or other paid provider routes.

## Configuration

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL` to the
backend origin. This value is embedded in the mobile bundle and must contain
only a public URL, never Google, Gemini, or other credentials. A production
build requires HTTPS. Local HTTP is accepted only in development.

The existing Express backend's `GET /` route supplies the health response.
For a local Android emulator, use a reachable host address for the backend
instead of assuming that `localhost` inside the emulator means the computer.
For a physical device, use a backend URL reachable from that device.

## Checks

From this directory, run `npm run typecheck`, `npm run lint`, and
`npm run test:api`. `npx expo install --check` and `npx expo-doctor` validate
dependencies and configuration. `npx expo export --platform android` checks
JavaScript bundling; it does not install or launch an Android binary.

The API client types track the current backend in `src/types/api.ts`; the
verified contract addendum is in the repository root `API_CONTRACT.md`.
