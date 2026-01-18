# Sound Notification Specification

The "Your Turn" sound (`/sounds/turn-start.wav`) serves as an auditory cue to alert the player that their input is required.

## 1. Triggers

The sound should play in the following scenarios when the player is **prompted to take an action**:

### A. Turn Start
When the game state transitions to a specific player's turn in a sequential phase (`Trade` or `Develop`).

- **Local Hotseat Mode**: Plays at the start of *every* player's turn.
- **Remote Multiplayer Mode**: Plays *only* when it becomes the **local player's** turn.
- **Condition**: The player must NOT have `Auto-Pass` enabled. If `Auto-Pass` is active, the turn is skipped automatically, so no user action is required, and thus no sound should play.

### B. Trade Proposal Received
When a player receives a trade proposal from another player.

- **Local Hotseat Mode**: Plays when the trade proposal appears.
- **Remote Multiplayer Mode**: Plays *only* for the **target** of the trade proposal (the player receiving the offer). The proposer should not hear the sound.

### C. Produce Phase Start
The `Produce` phase is simultaneous. All players act at once.

- **Local Hotseat Mode**: Plays once when the phase transitions to `Produce`.
- **Remote Multiplayer Mode**: Plays for **all players** when the phase transitions to `Produce`, as everyone is prompted to configure their production.

## 2. Constraints & Edge Cases

- **Game End**: Sound should not play if the game has ended.
- **Tests**: Sound should be disabled during automated tests (`navigator.webdriver` check) to avoid noise/errors, unless specifically testing audio.
- **Remote "Active Player" Logic**:
    - In `Produce` phase, there is no single `currentTurnPlayerIndex`. Everyone is active.
    - In `Trade` phase, if a trade is pending, the *Target* is effectively the active player.

## 3. Implementation

The sound logic is implemented in `src/hooks/useTurnSound.ts` as a React hook that:

- Accepts `gameState`, `mode` ('local' | 'remote'), and `selfPlayer`
- Tracks previous game state to detect transitions
- Plays sound via HTML5 Audio API when conditions are met

**Detection Logic**:
1. **Turn Changes**: Compares `currentTurnPlayerIndex` and `phase` with previous values
2. **Trade Proposals**: Detects when `pendingTrade` changes from null to non-null
3. **Produce Phase**: Detects phase transition from any phase to `Produce`

**Test Coverage**: `src/hooks/useTurnSound.test.ts` includes 9 comprehensive tests covering:
- Local hotseat: turn changes, produce phase, trade proposals, auto-pass bypass
- Remote multiplayer: self vs other player turns, trade proposal targeting, produce phase
