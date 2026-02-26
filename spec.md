# Queue Availability Manager

## Current State
The app has a full authorization system with roles: admin, user, guest. The first admin is seeded via a secret token (`CAFFEINE_ADMIN_TOKEN`), meaning a new user who logs in for the first time has no way to become admin unless they know that token. Users are created as #guest by default when they have no role assigned.

## Requested Changes (Diff)

### Add
- Auto-seed the first logged-in user as admin if no admin has been assigned yet (no token required)

### Modify
- `access-control.mo`: Update `initialize` to auto-assign #admin to the first non-anonymous caller when `adminAssigned` is false, bypassing the token check
- `MixinAuthorization.mo`: Update `_initializeAccessControlWithSecret` to reflect that the first user is always admin (token check only applies after an admin already exists)

### Remove
- The token requirement for first-time admin assignment

## Implementation Plan
1. Modify `access-control.mo` so that when `adminAssigned == false`, the first non-anonymous caller is automatically given #admin role regardless of the token
2. Keep the token path for subsequent admin delegation (or remove it entirely since the Config page handles role changes)

## UX Notes
- The very first person to log in to the app will become admin automatically
- All subsequent users log in as #guest and must be promoted by an admin via the Config page
- No change to the frontend is needed
