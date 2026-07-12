# CMAM Tracker Mobile - Deployment Guide

This guide covers building and deploying the CMAM Tracker mobile application to Android and iOS app stores.

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Expo account (sign up at https://expo.dev)
- Apple Developer account (for iOS)
- Google Play Developer account (for Android)

## Setup

### 1. Install Dependencies

```bash
cd cmam_tracker_mobile
npm install
```

### 2. Configure EAS Build

If not already configured, initialize EAS:

```bash
eas build:configure
```

This creates `eas.json` with build profiles.

### 3. Update App Configuration

Edit `app.json` to set:
- `expo.name`: Your app name
- `expo.slug`: URL-friendly identifier
- `expo.version`: Current version (e.g., "1.0.0")
- `expo.android.package`: Android package name (e.g., "org.pharn.cmamtracker")
- `expo.ios.bundleIdentifier`: iOS bundle ID (e.g., "org.pharn.cmamtracker")

### 4. Configure API Endpoint

Update `lib/config.ts` to point to your production API:

```typescript
export const API_BASE_URL = 'https://nutri.pharn.org/api/v1';
```

## Building

### Android APK (for testing)

Build an APK for internal testing:

```bash
eas build --platform android --profile preview
```

This creates an APK you can install directly on Android devices.

### Android App Bundle (for Play Store)

Build an AAB for Google Play Store submission:

```bash
eas build --platform android --profile production
```

### iOS Build (for App Store)

Build for iOS App Store:

```bash
eas build --platform ios --profile production
```

**Note**: You need an Apple Developer account and must configure signing credentials.

### Build Both Platforms

```bash
eas build --platform all --profile production
```

## Submission

### Android (Google Play Store)

1. **Build the app**:
   ```bash
   eas build --platform android --profile production
   ```

2. **Submit to Play Store**:
   ```bash
   eas submit --platform android
   ```

3. Follow the prompts to:
   - Select the build to submit
   - Provide Google Play service account key
   - Configure release track (internal, alpha, beta, production)

### iOS (Apple App Store)

1. **Build the app**:
   ```bash
   eas build --platform ios --profile production
   ```

2. **Submit to App Store**:
   ```bash
   eas submit --platform ios
   ```

3. Follow the prompts to:
   - Select the build to submit
   - Provide Apple ID credentials
   - Configure App Store Connect settings

## Over-the-Air (OTA) Updates

EAS Update allows you to push JavaScript/asset updates without rebuilding:

### 1. Configure EAS Update

Already configured in `app.json` under `expo.updates`.

### 2. Publish an Update

```bash
# Publish to production channel
eas update --branch production --message "Bug fixes and improvements"

# Publish to preview channel
eas update --branch preview --message "Testing new features"
```

### 3. Users Receive Updates

Updates are downloaded automatically when users restart the app.

## Environment-Specific Builds

### Development Build

For testing with Expo Go or development client:

```bash
eas build --profile development --platform android
```

### Preview Build

For internal testing (APK/IPA):

```bash
eas build --profile preview --platform android
```

### Production Build

For app store submission:

```bash
eas build --profile production --platform android
```

## Build Profiles (eas.json)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "buildType": "release"
      }
    }
  }
}
```

## Testing Builds

### Android

1. Download the APK from EAS build page
2. Install on device: `adb install app.apk`
3. Or share download link with testers

### iOS

1. Download IPA from EAS build page
2. Install via TestFlight (for App Store builds)
3. Or use ad-hoc distribution for internal testing

## Troubleshooting

### Build Fails

- Check `eas build` logs for errors
- Verify all dependencies are compatible
- Ensure signing credentials are valid

### App Crashes on Launch

- Check native logs: `adb logcat` (Android) or Xcode Console (iOS)
- Verify API endpoint is accessible
- Check for missing permissions in app.json

### OTA Updates Not Working

- Verify `expo.updates.url` in app.json
- Check network connectivity
- Ensure app version supports updates

## Monitoring

### EAS Build Dashboard

Monitor builds at: https://expo.dev/accounts/[your-account]/projects/cmam-tracker-mobile/builds

### Analytics

Consider integrating:
- **Sentry**: Error tracking and crash reporting
- **Firebase Analytics**: User behavior and engagement
- **Mixpanel**: Advanced analytics

## CI/CD Integration

### GitHub Actions Example

```yaml
name: EAS Build
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --non-interactive --no-wait
```

## Security Checklist

- [ ] Remove all console.log statements
- [ ] Disable debug mode in production
- [ ] Use environment variables for sensitive data
- [ ] Enable ProGuard/R8 (Android) for code obfuscation
- [ ] Implement SSL pinning for API requests
- [ ] Add app signing for release builds
- [ ] Enable Google Play App Signing

## App Store Requirements

### Android (Google Play)

- Target API level 33+ (Android 13)
- 64-bit support required
- Privacy policy URL
- App content rating
- Screenshots (phone, tablet, TV if applicable)

### iOS (Apple App Store)

- iOS 13.0+ minimum
- Privacy policy URL
- App Store screenshots (various device sizes)
- App icon (1024x1024)
- App Store description and keywords

## Post-Deployment

1. **Monitor crash reports** via Sentry or Firebase Crashlytics
2. **Track user engagement** with analytics
3. **Collect user feedback** via in-app feedback or reviews
4. **Plan regular updates** for bug fixes and features
5. **Monitor API performance** and error rates

## Support

- Expo Documentation: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- EAS Submit: https://docs.expo.dev/submit/introduction/
- Community Forum: https://forums.expo.dev
