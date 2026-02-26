# Queue Availability Manager

## Current State
- Dashboard with slot overview grid (color-coded by usage), add/remove IC exclusions, daily cap control
- History/reports page with date filter
- Authorization system (admin/user/guest roles)
- Per-hour slot capacity hardcoded to 10 across all hours
- No admin configuration page
- New users logging in land in "guest" role by default (no auto-deactivation)
- No user management panel for admins

## Requested Changes (Diff)

### Add
- **Config page** (admin-only) accessible via a new nav tab
  - **Per-hour limit configuration**: table/grid listing each hour period (7 AM–8 AM through 6 PM–7 PM) with an editable limit field; defaults to 10; persisted in backend
  - **User management panel** on same config page: shows all users who have ever logged in, with:
    - Name, principal (shortened), role badge
    - New/deactivated users highlighted in orange
    - Ability to set role: admin, user, deactivated
    - New users default to "deactivated" status (no action required on login)
- Backend support for:
  - Per-hour limits stored and retrieved
  - User listing endpoint returning all registered principals with their name + role
  - Deactivated role that blocks access (treated as unauthorized)
  - Auto-register new users as "deactivated" on first profile save

### Modify
- Slot usage cap logic: replace hardcoded `10` with per-hour limit fetched from backend
- Slot grid color thresholds: green <= 70%, yellow 71–99%, red = 100% (of each hour's individual limit)
- Navigation: add "Config" tab visible only to admins
- Remove "Daily Cap" widget from dashboard (no longer needed -- per-hour limits replace it)
- `addApproval` backend: use per-hour limits instead of fixed 10

### Remove
- Global daily cap concept (`setDailyCap`, `getDailyCap`, `getRemainingSlots`) -- replaced by per-hour limits
- Daily cap card from dashboard UI

## Implementation Plan
1. Update Motoko backend:
   - Add `hourlyLimits` map (period index → Nat, default 10)
   - Add `setHourlyLimit(periodIndex: Nat, limit: Nat)` (admin only)
   - Add `getHourlyLimits()` returning array of {periodIndex, limit}
   - Add `deactivated` role or treat it via the existing access control (blocked from #user permission)
   - Add `listAllUsers()` returning array of {principal, profile, role} (admin only)
   - Modify `addApproval` to use per-hour limits from `hourlyLimits`
   - Auto-register new users as `deactivated` when they first call `saveCallerUserProfile`
2. Regenerate frontend bindings (backend.d.ts)
3. Frontend updates:
   - Add `Config` page with hourly limits grid and user management table
   - Update `App.tsx` to add Config nav tab (visible to admins only)
   - Update Dashboard to remove daily cap widget, use per-hour limits for slot grid colors
   - Wire up new queries/mutations for hourly limits and user management

## UX Notes
- New users who log in for the first time are auto-set to "deactivated" (highlighted in orange on config page) until an admin approves them
- Admins see an orange badge or row highlight for deactivated users in the user list
- Config tab only appears in navigation for admin users
- Slot grid colors: green = 0–70% of that slot's limit, yellow = 71–99%, red = 100%
