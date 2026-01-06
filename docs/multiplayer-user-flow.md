# Multiplayer Experience User Flow

## Landing Screen
- Present three primary calls to action: Create Online Game, Join Online Game, Local Hotseat Game.
- Include quick access to rules/help and a connection status badge.
- If an online game is in progress for the current browser, automatically rejoin that lobby instead of showing choices.

## Create Online Game
- Collect the player name before lobby creation; no avatar or cosmetic selection needed.
- Generate a unique 5-character lobby code; display it prominently with copy/share controls and an invite link.
- Lobby screen lists joined players, each with an inline name editor and Ready toggle; the creator is simply flagged as the current host.
- Start button activates only when exactly three players are present and all are marked ready; otherwise remain disabled.
- No bot support or additional configuration; lobby layout should stay minimal.
- During play, keep the lobby code visible so reconnecting players can rejoin; no need to handle host promotion or running the game without absent players.

## Join Online Game
- Prompt for player name and lobby code with inline validation and clear error messaging for invalid or expired codes.
- On success, enter the shared lobby view; show the player list with Ready toggles and name editing for every participant, including the host.
- If the game is already underway, immediately load the current game state for the reconnecting player; no dedicated spectator mode.

## Online Game Completion
- Starting a rematch requires the same three players to ready up again; no extra statistics or chat.
- Provide options to Leave Game (return to landing) or Copy Code for inviting new players.

## Local Hotseat Game
- Ask for number of players and their names; clarify that play is restricted to the current device.
- Use the existing local-only flow with no lobby code and block remote joins, showing an "Offline / Local" status badge.
- End-of-game screen offers Quick Restart (reuse names) or Return to Landing.

## Simplifications and Scope Cuts
- Omit chat, bot players, spectator mode, host reassignment, and extended post-game stats to keep the implementation focused.
- Assume any disconnection sends the player back to the landing screen; rejoining the lobby restores their seat without special handling.
- Leverage a lightweight pause/settings menu only if necessary; otherwise rely on browser UI for leaving the game.
