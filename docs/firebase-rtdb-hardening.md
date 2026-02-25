# Firebase RTDB hardening plan (minimal UX disruption)

Firebase sent an expiring test-mode warning because the Realtime Database currently allows unrestricted client writes.

## Recommended fix

Use **Firebase Authentication for commissioner actions** and lock down RTDB writes to the commissioner account UID.

This preserves current user experience:
- League members still view data as before (public read stays enabled).
- Commissioner still uses the existing login modal (password prompt), but it now validates against Firebase Auth instead of a hardcoded client password.

## What changed in this repo

1. `src/App.jsx`
   - Replaced hardcoded commissioner password with Firebase Auth sign-in (`signInWithEmailAndPassword`).
   - Added auth session listener (`onAuthStateChanged`) to gate commissioner mode.
   - Added Firebase sign-out when commissioner mode badge is clicked.
   - Added `VITE_COMMISSIONER_EMAIL` and optional `VITE_COMMISSIONER_UID` environment usage.

2. `firebase.database.rules.json`
   - Added production RTDB rules template that keeps reads public and restricts writes to a single commissioner UID.

## Rollout checklist

1. In Firebase Console > Authentication:
   - Enable Email/Password provider.
   - Create commissioner account (email should match `VITE_COMMISSIONER_EMAIL`).
   - Copy the commissioner UID.

2. In app env vars:
   - Set `VITE_COMMISSIONER_EMAIL`.
   - Set `VITE_COMMISSIONER_UID` (recommended).

3. In `firebase.database.rules.json`:
   - Replace `REPLACE_WITH_COMMISSIONER_UID` with the real UID.

4. Deploy rules:
   - `firebase deploy --only database`

## Why this is minimal-disruption

- No new front-end screens required.
- No forced login for regular users.
- Existing commissioner login interaction remains intact while removing insecure hardcoded password logic.

## Deployment failure root cause to check

If the site white-screens after deploy, verify `VITE_FIREBASE_API_KEY` is present in the build environment.
`firebase/auth` validates API key settings more strictly than the previous client-only password gate.
The app now fails closed for commissioner login when API key is missing, but keeps the public site readable.
