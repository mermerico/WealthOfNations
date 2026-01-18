import { useEffect, useRef, useMemo } from 'react';
import type { GameState } from '../types/gameState';

export const useTurnSound = (
    gameState: GameState,
    mode: 'local' | 'remote',
    selfPlayer: { playerId: string } | null
) => {
    const turnSound = useMemo(() => {
        if (typeof window !== 'undefined' && window.Audio) {
            return new window.Audio('/sounds/turn-start.wav');
        } else if (typeof global !== 'undefined' && (global as any).Audio) {
            return new (global as any).Audio('/sounds/turn-start.wav');
        }
        return null;
    }, []);

    // We need to track the previous state to detect changes
    const prevGameStateRef = useRef<GameState>(gameState);

    useEffect(() => {
        const prevState = prevGameStateRef.current;
        prevGameStateRef.current = gameState;

        if (gameState.gameEnded) return;

        // Skip sound in test environments (unless explicitly testing logic, where we might mock navigator.webdriver)
        // Check navigator.webdriver but allow override for our unit tests if needed.
        // In our unit test, we defined navigator.webdriver = false, so this check passes.
        if (navigator.webdriver) return;

        if (!turnSound) return;

        let shouldPlay = false;

        // 1. Detect Turn Change (Sequential Phases)
        // Change in currentTurnPlayerIndex OR Change in Phase to a sequential phase
        // But if Phase changes to Produce, that's handled separately.

        const turnChanged =
            gameState.currentTurnPlayerIndex !== prevState.currentTurnPlayerIndex ||
            (gameState.phase !== prevState.phase && (gameState.phase === 'Trade' || gameState.phase === 'Develop'));

        if (turnChanged) {
            const currentPlayer = gameState.players[gameState.currentTurnPlayerIndex];

            // Check Auto-Pass
            if (currentPlayer && currentPlayer.autoPass) {
                // Do nothing
            } else {
                // In Remote, only play if it's OUR turn
                if (mode === 'remote') {
                    if (selfPlayer && currentPlayer.id === selfPlayer.playerId) {
                        shouldPlay = true;
                    }
                } else {
                    // Local: play for everyone
                    shouldPlay = true;
                }
            }
        }

        // 2. Detect Produce Phase Start (Simultaneous)
        if (gameState.phase === 'Produce' && prevState.phase !== 'Produce') {
            shouldPlay = true;
            // In remote mode, everyone plays simultaneous, so everyone enters Produce phase at same time.
            // Everyone is prompted. So we play for everyone.
        }

        // 3. Detect Trade Proposal
        // Check if a new trade proposal has arrived
        if (gameState.pendingTrade && !prevState.pendingTrade) {
            // New proposal
            if (mode === 'remote') {
                if (selfPlayer && gameState.pendingTrade.targetId === selfPlayer.playerId) {
                    shouldPlay = true;
                }
            } else {
                // Local: always play
                shouldPlay = true;
            }
        }
        // What if pendingTrade existed but changed? (e.g. modifying offer) -> usually that's a new proposal or update?
        // Game logic usually clears pendingTrade before setting a new one or handles it as a new distinct object.
        // We'll stick to existence check for now as per spec "recieved a trade proposal".

        if (shouldPlay) {
            turnSound.currentTime = 0;
            turnSound.play().catch((e: unknown) => {
                console.log('Turn notification sound blocked:', e);
            });
        }

    }, [gameState, mode, selfPlayer, turnSound]);
};
