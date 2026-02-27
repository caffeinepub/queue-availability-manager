# Queue Availability Manager

## Current State

A full-stack app for managing daily queue exclusions for ICs (Individual Contributors). Features include:
- Adding/removing approved exclusions with IC name, manager name (auto-populated from login), start hour, and end hour (7 AM - 7 PM CT, hourly increments)
- Per-hour capacity limits (default 10 per slot), configurable per hour
- Slot availability grid (color-coded: green <70%, yellow 71-99%, red 100%)
- History and reports of past days
- User management: guest/user/admin roles, first-user auto-admin, user approval, deletion
- Config page (admin only) showing user list and hourly limit settings

## Requested Changes (Diff)

### Add
- Nothing new to add

### Modify
- Fix critical bug in `nanosecondsToDateString`: currently returns raw seconds as a string (e.g. "1740614400"), causing `checkAndResetDay()` to trigger a reset and clear `dailyApprovals` on nearly every call (each second), because the comparison always differs. Must be changed to return a proper YYYY-MM-DD calendar date string computed from the Unix epoch using integer arithmetic.

### Remove
- Nothing to remove

## Implementation Plan

1. Fix `nanosecondsToDateString` in `main.mo` to compute a real YYYY-MM-DD date string:
   - Convert nanoseconds to seconds: `totalSeconds = nanoseconds / 1_000_000_000`
   - Convert seconds to days since epoch: `days = totalSeconds / 86400`
   - Walk through years from 1970, subtracting 365 or 366 days per year to find current year
   - Walk through months with correct days-per-month (accounting for leap years) to find month
   - Remaining days + 1 = day of month
   - Return `"YYYY-MM-DD"` with zero-padded month and day
2. All other logic (addApproval, removeApproval, slot usage, history) remains unchanged
