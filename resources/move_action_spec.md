# Move Industry Action - Detailed Specification

## Core Concepts
The "Move Industry" action allows a player to move up to 3 of their industry tiles during the **Develop Phase**. Each move costs **1 Capital** (base cost). If a move results in mismatched dots (invalid placement), it can be "Forced" for an additional **+1 Capital** (Total 2).
A "Rotate in Place" is considered a move (distance 0).

## UI States & Transitions

The Move action operates in the following states:
1.  **Idle / Tool Selected**: "Move" tool is active.
2.  **Source Selected**: User has clicked a valid industry tile to move.
3.  **Pending Confirmation**: User has selected a destination (or rotated in place) and is previewing the specific orientation before committing.

### 1. Idle State
**Entry**: User clicks "Move" button in Control Panel.
**UI**:
-   **Board**:
    -   Highlight all tiles owned by player (valid sources).
    -   Cursor: Pointer on own tiles.
-   **Panel**:
    -   Title: "Move Operation"
    -   Instruction: "Select tile to move"
    -   Stats: "Moves completed: X/3"
    -   Buttons: "Cancel" (Exits tool), "Undo" (only if history > 0), "Done Moving" (only if history > 0).

### 2. Source Selected State
**Entry**: User clicks a valid owned industry tile.
**UI**:
-   **Board**:
    -   Selected tile has **White Border**.
    -   Valid target cells (Empty or Own Flag) have **Green Highlight**.
    -   Invalid target cells have no highlight.
-   **Panel**:
    -   Instruction: "Select destination"
    -   **"Rotate Selected Tile" Button**: Visible.
    -   **"Cancel" Button**: Visible (Transitions to Idle state).
    -   **"Allow mismatched dots (+1 Capital)" Checkbox**: Visible (controls highlighting logic).

**Actions**:
-   **Click Destination (Different Cell)**:
    -   *Logic*: Check if valid target (Empty/Own Flag).
    -   *Default Orientation*: Same as source tile.
    -   *Initial Validation*: Check valid orientation using `validateTileDots` (smart rotation check).
    -   *Transition*: **Pending Confirmation State** (Target = Clicked Cell).
-   **Click "Rotate Selected Tile"**:
    -   *Logic*: Target = Current Source Cell.
    -   *Smart Rotation*: Check if `(currentOrientation + 1) % 6` is valid.
        -   **If Valid**: New Orientation = `(current + 1) % 6`.
        -   **If Invalid**: New Orientation = `current` (User can force later).
    -   *Transition*: **Pending Confirmation State** (Target = Source Cell).
-   **Click Source Tile Again**:
    -   *Transition*: Return to **Idle State** (Deselect).

### 3. Pending Confirmation State
**Entry**: User clicked a destination OR "Rotate Selected Tile".
**UI**:
-   **Board**:
    -   **Only** the Pending Target Cell is highlighted (Green if valid, Yellow/Red warning if not? Just Green/Selected generally).
    -   **Ghost Tile**: Displayed at Target Cell with current Pending Orientation.
-   **Panel**:
    -   **"Confirm Move" Box**: Replaces standard instructions.
    -   **Warning**: "Partial dots don't match" (Only if specific pending orientation is invalid).
    -   **"Rotate" Button**: Rotates the Ghost Tile `(orientation + 1) % 6`.
    -   **"Force move" Checkbox**:
        -   Checked = Force enabled (+1 Cost).
        -   If not checked and move is invalid, "Confirm" might be disabled or warn? (Spec: User can check it to suppress error/allow invalid).
    -   **"Confirm Move" Button**: Commits the pending state to history.
    -   **"Cancel" Button**: Returns to **Source Selected State** (clears pending target, keeps source selected).

**Actions**:
-   **Click "Confirm Move"**:
    -   *Validation*:
        -   If `isValid` is false AND `Force` is false -> **Error/Block**.
        -   If `Capital` < Cost -> **Error/Block**.
    -   *Move Logic*:
        -   **New Move Entry**:
            -   Add new entry to `moveHistory`.
            -   Increment `movesCompleted`.
            -   Deduct cost logic (standard rule: 1 Capital covers up to 3 moves).
    -   *Transition*: Return to **Idle State** (Source Deselected).
-   **Click "Rotate"**: Updates Pending Orientation (+1). Re-runs validation check for warning.
-   **Click Board Logic**:
    -   Clicking the **Same Target Cell**: Equivalent to "Confirm Move".
    -   Clicking **Different Cell**:
        -   Cancel current pending.
        -   If valid target, start new Pending at that cell.
        -   If invalid, just cancel pending.

## Cost Logic rules
1.  **First Move**: Costs 1 Capital (transport).
2.  **Subsequent Moves**: Cost 0 Capital (chaining moves uses same transport resource concept? Or just game rule?). *Correction*: Standard rule is 1 Capital per move. "Move up to 3 tiles for 1 Capital" or "1 Capital per move"?
    -   *Rule Check*: Usually "Move Action" costs 1 Capital to *activate*. The *distance/steps* might be limited.
    -   *Implementation Check*: Current code seems to charge per step?
    -   *Clarification*: Let's assume **1 Move Action = Up to 3 tiles**.
    -   **Cost**:
        -   Activation: 1 Capital.
        -   Force: +1 Capital per Forced placement.
    -   *Refined Logic*:
        -   Move 1: Cost 1 (Base).
        -   Move 2 & 3: Cost 0 (Base included).
        -   Force: Always +1 per forced tile.

## Testing Plan

### 1. Unit Tests (`src/utils/placementLogic.test.ts`)
-   [ ] `validTileDots`: Verify strict checking of edge/corner matches.
-   [ ] `getValidMoveTargets`: Verify it filters based on valid dots vs empty space.

### 2. Logic Tests (`src/components/game/MoveLogic.test.ts`) - **New**
-   Test Cases:
    -   **No Merge**: Move A->B, then Rotate B. Result: 2 Moves.
    -   **No Merge**: Move A->B, then Move B->C. Result: 2 Moves.
    -   **No Merge**: Rotate A (in place), then Rotate A (in place again). Result: 2 Moves.
    -   **Cost**: 3 Standard Moves = 1 Cap. 1 Forced + 2 Standard = 2 Cap.

### 3. Integration Tests (`e2e/move-action.spec.ts`)
-   **Scenario 1: Simple Move**: Select -> Valid Target -> Confirm. Verify board state.
-   **Scenario 2: Rotate in Place**: Select -> Rotate Button -> Rotate x2 -> Confirm. Verify orientation.
-   **Scenario 3: Move then Rotate (No Merge)**: Move A->B -> Confirm. Select B -> Rotate Button -> Rotate -> Confirm. Verify history length = 2.
-   **Scenario 4: Invalid Rotation Handling**: Rotate Button -> (Check defaults to current if invalid) -> Rotate to Invalid -> Verify Warning "Partial dots don't match" -> Enable Force -> Confirm.
-   **Scenario 5: Cancel**: Select -> Target -> Cancel. Verify state resets.
