import type { GameState, GameSettings, Player, CommodityType, MarketState } from '../types/gameState';
import { generateGrid } from '../utils/hexUtils';
import { gameReducerWithChecks, type ActionResult } from '../utils/gameReducer';
import { MARKET_STARTING_QUANTITIES } from '../utils/marketPrices';

const DEFAULT_MARKETS: Record<CommodityType, MarketState> = {
    Food: { stock: MARKET_STARTING_QUANTITIES.Food, priceIndex: MARKET_STARTING_QUANTITIES.Food },
    Energy: { stock: MARKET_STARTING_QUANTITIES.Energy, priceIndex: MARKET_STARTING_QUANTITIES.Energy },
    Labor: { stock: MARKET_STARTING_QUANTITIES.Labor, priceIndex: MARKET_STARTING_QUANTITIES.Labor },
    Ore: { stock: MARKET_STARTING_QUANTITIES.Ore, priceIndex: MARKET_STARTING_QUANTITIES.Ore },
    Capital: { stock: MARKET_STARTING_QUANTITIES.Capital, priceIndex: MARKET_STARTING_QUANTITIES.Capital }
};

const PLAYER_TEMPLATES: readonly Player[] = [
    {
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
    },
    {
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
    },
    {
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
    },
    {
        id: 'p4',
        name: 'Player 4',
        color: '#f59e0b',
        resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
        money: 0,
        loans: 0,
        flags: 18,
        ready: true,
        flag: 'arazzaq.svg',
        hasPassed: false
    },
    {
        id: 'p5',
        name: 'Player 5',
        color: '#8b5cf6',
        resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
        money: 0,
        loans: 0,
        flags: 18,
        ready: true,
        flag: 'federal_provinces.svg',
        hasPassed: false
    },
    {
        id: 'p6',
        name: 'Player 6',
        color: '#ec4899',
        resources: { Food: 0, Energy: 0, Labor: 0, Ore: 0, Capital: 0 },
        money: 0,
        loans: 0,
        flags: 18,
        ready: true,
        flag: 'showa.svg',
        hasPassed: false
    }
];

const DEFAULT_TILE_COUNTS = {
    Farm: 15,
    Generator: 9,
    Academy: 9,
    Mine: 9,
    Factory: 9,
    Bank: 9
} as const;

export interface InitialGameStateOptions {
    players?: Player[];
    gridRadius?: number;
    firstPlayerIndex?: number;
    tilesRemaining?: Partial<GameState['tilesRemaining']>;
    randomizeFirstPlayer?: boolean;
    playerCount?: number;
    playerNames?: string[];
    settings?: Partial<GameSettings>;
}

function clonePlayer(player: Player): Player {
    return {
        ...player,
        resources: { ...player.resources }
    };
}

function buildPlayers(customPlayers?: Player[], playerCount?: number, playerNames?: string[]): Player[] {
    if (customPlayers && customPlayers.length > 0) {
        return customPlayers.map(clonePlayer);
    }

    if (playerNames && playerNames.length >= 3) {
        return PLAYER_TEMPLATES.slice(0, playerNames.length).map((template, index) => ({
            ...clonePlayer(template),
            name: playerNames[index]
        }));
    }

    const count = playerCount && playerCount >= 3 ? playerCount : 3;
    return PLAYER_TEMPLATES.slice(0, count).map(clonePlayer);
}

function cloneMarkets(source: Record<CommodityType, MarketState>): Record<CommodityType, MarketState> {
    return {
        Food: { ...source.Food },
        Energy: { ...source.Energy },
        Labor: { ...source.Labor },
        Ore: { ...source.Ore },
        Capital: { ...source.Capital }
    };
}

export function createInitialGameState(options: InitialGameStateOptions = {}): GameState {
    const players = buildPlayers(options.players, options.playerCount, options.playerNames);
    const gridRadius = options.gridRadius ?? 4;
    const baseTilesRemaining = { ...DEFAULT_TILE_COUNTS };
    const tilesRemaining = {
        ...baseTilesRemaining,
        ...options.tilesRemaining
    };

    const firstPlayerIndex = resolveFirstPlayerIndex(players.length, options);

    return {
        players,
        board: generateGrid(gridRadius),
        markets: cloneMarkets(DEFAULT_MARKETS),
        phase: 'Setup',
        setupPhase: {
            step: 'selectPackage',
            firstPlayerIndex,
            draftRound: 0,
            currentDrafterIndex: firstPlayerIndex,
            takenPackageIds: [],
            pendingPlacement: null
        },
        currentTurnPlayerIndex: firstPlayerIndex,
        firstPlayerIndex,
        round: 1,
        consecutivePasses: 0,
        tilesRemaining,
        isLastRound: false,
        gameEnded: false,
        initialFlagsPerPlayer: players[0]?.flags ?? 18,
        initialTiles: { ...tilesRemaining },
        tradeIntents: {},
        settings: {
            promissoryNoteInterestFees: false,
            ...options.settings
        }
    };
}

function resolveFirstPlayerIndex(playerCount: number, options: InitialGameStateOptions): number {
    if (typeof options.firstPlayerIndex === 'number') {
        return options.firstPlayerIndex;
    }

    if (options.randomizeFirstPlayer === false) {
        return 0;
    }

    return Math.floor(Math.random() * playerCount);
}

export function applyGameAction(state: GameState, action: string, payload?: any): ActionResult {
    return gameReducerWithChecks(state, action, payload);
}

export function getDefaultPlayers(): Player[] {
    return PLAYER_TEMPLATES.map(clonePlayer);
}
