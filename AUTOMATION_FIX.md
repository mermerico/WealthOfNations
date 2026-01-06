# Automation Cost Calculation Fix

## Problem

When feeding individual tiles in an automated bloc, the game was incorrectly using Ore instead of Food.

## Root Cause

In `src/utils/production.ts`, the `calculateBlocCosts()` function had a bug:

```typescript
// BEFORE (buggy)
const automated = automatedOverride || bloc.some(c => c.occupant?.tile?.automated);
```

This line would check tile automation properties even when `automatedOverride` was explicitly set to `false`. The `||` operator meant "if override is false, check the tiles anyway."

## Solution

Changed the logic to respect the override parameter:

```typescript
// AFTER (fixed)
const automated = automatedOverride;
```

Now the `automatedOverride` parameter directly controls whether automation costs apply, regardless of individual tile properties.

## Correct Behavior

### Scenario 1: Full Automation
- User checks "Run Automation" checkbox
- All tiles in bloc are automatically fed
- UI calls: `calculateBlocCosts(bloc, true)`
- **Result**: Uses 1 Ore for entire bloc (no Food)

### Scenario 2: Partial Feeding (Automation Checkbox Checked)
- User checks "Run Automation"
- User unchecks some individual tile checkboxes
- Since not all tiles are fed, automation is auto-disabled
- UI calls: `calculateBlocCosts(selectedTiles, false)`
- **Result**: Uses Food (1 per tile), no Ore

### Scenario 3: Manual Feeding (No Automation)
- User doesn't check "Run Automation"
- User manually selects which tiles to feed
- UI calls: `calculateBlocCosts(selectedTiles, false)`
- **Result**: Uses Food (1 per tile), no Ore

## Implementation in UI

The `calculateBlocTotals()` function in `Sandbox.tsx` determines when to apply automation:

```typescript
// Automation only applies if ALL tiles in the bloc are being fed
const isFullyAutomated = config.automated && activeTiles.length === bloc.length;

const costs = calculateBlocCosts(
    activeTiles,
    isFullyAutomated  // Only true when automation checkbox is on AND all tiles are fed
);
```

## Tests

Created `automationCosts.test.ts` with 13 test cases covering:
- Non-automated blocs (use Food)
- Fully automated blocs (use Ore)
- Partially fed automated blocs (use Food)
- Edge cases (Farms, Generators, empty blocs)
- Override parameter behavior

All tests pass ✓

## Current Needs Calculation

Also fixed the "Current Needs" display in Trade phase to account for automated blocs and show Ore requirements when applicable.
