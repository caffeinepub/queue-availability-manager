# Queue Availability Manager

## Current State

The app uses Internet Identity (II) for authentication. Every user authenticates via the II browser popup and their session is tied to a cryptographic principal. The backend uses the `authorization` Caffeine component (MixinAuthorization / AccessControl) with principals as user keys. The frontend has `useInternetIdentity.ts`, `useActor.ts`, and an `InternetIdentityProvider` wrapping the app in `main.tsx`. The `App.tsx` checks `identity` from `useInternetIdentity` to decide whether to show `LoginPage` or `AppShell`. The `ProfileSetup` modal fires on first login for name entry.

## Requested Changes (Diff)

### Add

- Internal username/password credential store in the backend:
  - `UserCredential` type: `{ username: Text; passwordHash: Text }` (store a hashed password, not plaintext)
  - Backend stores credentials keyed by a generated numeric `userId` (Nat)
  - `register(username, password)` endpoint — creates credential + user profile + assigns guest role (or admin if first user); returns `{ ok: userId }` or `{ err: text }`
  - `login(username, password)` endpoint — validates credential, generates a short-lived session token (random UUID-like text), stores it mapped to userId, returns `{ ok: token }` or `{ err: text }`
  - `logout(token)` endpoint — removes session token
  - `whoami(token)` endpoint — returns the userId and role for a valid token
  - Sessions expire after 24 hours (checked lazily on each call)
  - All existing protected endpoints that currently use `caller` principal now accept a `sessionToken: Text` parameter instead
- `useAuth` hook on the frontend replacing `useInternetIdentity` — stores token in localStorage, exposes `{ login, logout, register, token, userId, isInitializing, isAuthenticated }`
- `useActor` updated: builds actor with anonymous identity but passes sessionToken to each backend call
- `LoginPage` updated: shows username + password form with a toggle to switch to registration
- `ProfileSetup` modal removed — name is now collected at registration time (username IS the display name)

### Modify

- `main.mo` backend: remove `caller`-based auth on all endpoints; replace with session token validation; adapt `addApproval`, `removeApproval`, `saveCallerUserProfile`, `getCallerUserProfile`, `setUserRole`, `deleteUser`, `setDailyCap`, `setHourlyLimit`, `listAllUsers`, `isCallerAdmin` to take `sessionToken` as the first parameter
- `backend.d.ts`: update all method signatures to include `sessionToken: string` parameter; add `register`, `login`, `logout`, `whoami` methods
- `useQueries.ts`: update all mutations/queries to pass `token` from `useAuth` hook
- `App.tsx`: replace `useInternetIdentity` with `useAuth`; remove `ProfileSetup` usage
- `Config.tsx`: remove reference to `identity?.getPrincipal()` for "isSelf" check — use `userId` from `useAuth` instead
- `main.tsx`: remove `InternetIdentityProvider`, use a new `AuthProvider`

### Remove

- `useInternetIdentity.ts` hook (replaced by `useAuth.ts`)
- `InternetIdentityProvider` from `main.tsx`
- `ProfileSetup` component (name collected during registration)
- `saveCallerUserProfile` backend call from frontend (merged into `register`)
- `@dfinity/auth-client` dependency usage (II is no longer used)

## Implementation Plan

1. Rewrite `main.mo` to add credential store, session tokens, `register`/`login`/`logout`/`whoami` endpoints, and convert all existing endpoints to accept a `sessionToken: Text` parameter instead of using `caller` for auth.
2. Run `generate_motoko_code` to produce new backend + updated `backend.d.ts`.
3. Create `src/frontend/src/hooks/useAuth.ts` — context + hook managing token in localStorage, exposing `login`, `logout`, `register`, `token`, `userId`, `isAuthenticated`, `isInitializing`.
4. Update `useActor.ts` to drop II identity, use anonymous actor, and expose token passthrough.
5. Update `useQueries.ts` to add `sessionToken` to every backend call.
6. Update `LoginPage` to show username/password fields with register toggle.
7. Update `App.tsx` to use `useAuth` instead of `useInternetIdentity`, remove `ProfileSetup`.
8. Update `Config.tsx` to use `userId` from `useAuth` for self-check instead of principal.
9. Update `main.tsx` to use `AuthProvider` instead of `InternetIdentityProvider`.
10. Typecheck and lint; fix any errors.
