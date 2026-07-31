# CMAM Tracker — Developer Notes

## Repo Layout

- `cmam-tracker-django/` — Django backend and webapp (Git submodule)
- `cmam_tracker_mobile/` — Expo / React Native mobile app
- Parent repository tracks the Django submodule pointer plus the mobile app.

## Backend (Django)

### Local verification

```bash
cd cmam-tracker-django
python manage.py check
python manage.py makemigrations --check
```

### Deploy to Railway

```bash
cd cmam-tracker-django
railway up
```

### Commit style
- Focus commit messages on the *why*.
- Pushed to `main` on `github.com/ajm1313/cmam-tracker-django`.

## Mobile (Expo / React Native)

### Type check

```bash
cd cmam_tracker_mobile
npx tsc --noEmit
```

### Build a release APK

```bash
cd cmam_tracker_mobile/android
.\gradlew.bat assembleRelease
```

Output: `cmam_tracker_mobile/android/app/build/outputs/apk/release/app-release.apk`

### Install native dependencies

Some installs may need the legacy peer deps flag:

```bash
cd cmam_tracker_mobile
npm install <package> --legacy-peer-deps
npx expo prebuild --no-install
```

## Known Caveats

- `npm run lint` currently fails because `eslint` is not installed in `devDependencies`.
- `npm install` shows a number of audit warnings; review before adding new packages.
- `cmam-tracker-django` is a submodule; remember to commit the parent repo after updating the submodule pointer.
