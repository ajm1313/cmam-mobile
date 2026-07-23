# CMAM Tracker Mobile

A premium React Native / Expo mobile app for the CMAM (Community-based Management of Severe Acute Malnutrition) Tracker system.

## Framework
- **Expo** ~54 with **Expo Router** (file-based routing)
- **TypeScript**
- **Zustand** for state management
- **Axios** for API requests
- **expo-secure-store** for JWT token storage

## Setup

```bash
npm install
npx expo start
```

## Project Structure
```
app/
  _layout.tsx         Root layout + auth guard
  index.tsx           Splash / redirect
  login.tsx           Login screen
  (tabs)/
    _layout.tsx       Tab bar layout
    dashboard.tsx     Dashboard with stats & quick actions
    cases.tsx         Case management (SAM/MAM)
    inventory.tsx     Inventory stock management
    reports.tsx       Reports (summary, stock, facilities)
    profile.tsx       User profile & sign out
  facility/
    [id].tsx          Facility detail with stock
lib/
  api.ts              Axios instance with JWT interceptor
  config.ts           Environment config & colour tokens
  store.ts            Auth store (Zustand)
  types.ts            TypeScript interfaces
components/
  ErrorBoundary.tsx   React error boundary
  LoadingSkeleton.tsx Animated loading skeleton
  EmptyState.tsx      Empty state placeholder
```

## API
Connects to the CMAM Tracker Django backend at:
- **Production:** `https://nutri.pharn.org/api/v1`
- **Development:** configure `LOCAL_IP` in `lib/config.ts`

## Build
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build APK (Android)
eas build --platform android --profile preview
```
