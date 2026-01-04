import { useState } from 'react';
import type { GameState, Player, CommodityType, MarketState } from '../types/gameState';
import { generateGrid } from '../utils/hexUtils';
import { gameReducerWithChecks } from '../utils/gameReducer';

const INITIAL_MARKETS: Record<CommodityType, MarketState> = {
    Food: { stock: 4, priceIndex: 4 },
    Energy: { stock: 4, priceIndex: 4 },
    Labor: { stock: 4, priceIndex: 4 },
    Ore: { stock: 4, priceIndex: 4 },
    Capital: { stock: 4, priceIndex: 4 }
};

const INITIAL_PLAYER_1: Player = {
    id: 'p1',
    name: 'Player 1',
    color: '#3b82f6',
    resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
    money: 0,
    loans: 0,
    flags: 18,
    ready: true,
    flag: 'anglica.svg',
    hasPassed: false
};

const INITIAL_PLAYER_2: Player = {
    id: 'p2',
    name: 'Player 2',
    color: '#ef4444',
    resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
    money: 0,
    loans: 0,
    flags: 18,
    ready: true,
    flag: 'bolshevica.svg',
    hasPassed: false
};

const INITIAL_PLAYER_3: Player = {
    id: 'p3',
    name: 'Player 3',
    color: '#10b981',
    resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
    money: 0,
    loans: 0,
    flags: 18,
    ready: true,
    flag: 'bharat.svg',
    hasPassed: false
};

export function useGameEngine() {
    // Randomly select first player
    const randomFirstPlayer = Math.floor(Math.random() * 3);

    const [gameState, setGameState] = useState<GameState>({
        players: [INITIAL_PLAYER_1, INITIAL_PLAYER_2, INITIAL_PLAYER_3],
        board: generateGrid(4),
        markets: INITIAL_MARKETS,
        phase: 'Setup',
        setupPhase: {
            step: 'determineFirstPlayer',
            firstPlayerIndex: randomFirstPlayer,
            draftRound: 0,
            currentDrafterIndex: randomFirstPlayer,
            takenPackageIds: [],
            pendingPlacement: null
        },
        currentTurnPlayerIndex: randomFirstPlayer,
        firstPlayerIndex: randomFirstPlayer,
        round: 1,
        consecutivePasses: 0,
        tilesRemaining: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        },
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: 18,
        initialTiles: {
            Farm: 15,
            Generator: 9,
            Academy: 9,
            Mine: 9,
            Factory: 9,
            Bank: 9
        }
    });

    const handleAction = (action: string, payload?: any) => {
        setGameState(prev => {
            // Delegate everything to gameReducerWithChecks
            const result = gameReducerWithChecks(prev, action, payload);
            return result.success && result.newState ? result.newState : prev;
        });
    };

    return {
        gameState,
        handleAction
    };
}
