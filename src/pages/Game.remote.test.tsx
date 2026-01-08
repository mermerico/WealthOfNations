import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameState, Player, CommodityType, IndustryType, MarketState } from '../types/gameState';
import type { LobbyPlayer } from '../shared/networkTypes';
import { Game } from './Game';

const commodityTypes: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];
const industryTypes: IndustryType[] = ['Farm', 'Generator', 'Academy', 'Mine', 'Factory', 'Bank'];

interface EngineContextMock {
    gameState: GameState;
    handleAction: (action: string, payload?: unknown) => void;
    startNewGame: () => void;
    connectionState: 'connecting' | 'connected' | 'disconnected';
    lastError: string | null;
    playerCount: number;
    mode: 'local' | 'remote';
    selfPlayer: LobbyPlayer | null;
    requestRematch: () => void;
}

function createPlayer(overrides: Partial<Player> = {}): Player {
    return {
        id: overrides.id ?? 'p1',
        name: overrides.name ?? 'Alice',
        color: overrides.color ?? '#f87171',
        flag: overrides.flag ?? 'usa.svg',
        resources: overrides.resources ?? {
            Food: 0,
            Energy: 0,
            Labor: 0,
            Ore: 0,
            Capital: 0
        },
        money: overrides.money ?? 0,
        loans: overrides.loans ?? 0,
        flags: overrides.flags ?? 5,
        ready: overrides.ready ?? false,
        hasPassed: overrides.hasPassed,
    } satisfies Player;
}

function createMarkets(): Record<CommodityType, MarketState> {
    return commodityTypes.reduce((acc, commodity) => {
        acc[commodity] = { stock: 4, priceIndex: 4 } satisfies MarketState;
        return acc;
    }, {} as Record<CommodityType, MarketState>);
}

function createTilesRemaining(): Record<IndustryType, number> {
    return industryTypes.reduce((acc, type) => {
        acc[type] = 5;
        return acc;
    }, {} as Record<IndustryType, number>);
}

function createGameState(overrides: Partial<GameState> = {}): GameState {
    const players = overrides.players ?? [
        createPlayer({ id: 'p1', name: 'Alice', color: '#fbbf24' }),
        createPlayer({ id: 'p2', name: 'Bob', color: '#60a5fa' })
    ];
    const board = overrides.board ?? {
        '0,0': { q: 0, r: 0, occupant: null },
        '1,0': { q: 1, r: 0, occupant: null }
    };
    const markets = overrides.markets ?? createMarkets();

    return {
        players,
        board,
        markets,
        phase: overrides.phase ?? 'Trade',
        currentTurnPlayerIndex: overrides.currentTurnPlayerIndex ?? 0,
        firstPlayerIndex: overrides.firstPlayerIndex ?? 0,
        round: overrides.round ?? 1,
        setupPhase: overrides.setupPhase,
        consecutivePasses: overrides.consecutivePasses ?? 0,
        tilesRemaining: overrides.tilesRemaining ?? createTilesRemaining(),
        isLastRound: overrides.isLastRound ?? false,
        gameEnded: overrides.gameEnded ?? false,
        initialFlagsPerPlayer: overrides.initialFlagsPerPlayer ?? 5,
        initialTiles: overrides.initialTiles ?? createTilesRemaining(),
        settings: overrides.settings ?? { promissoryNoteInterestFees: false }
    } satisfies GameState;
}

let contextValue: EngineContextMock;

vi.mock('../hooks/GameEngineProvider', () => ({
    useGameEngineContext: () => contextValue
}));

describe('Game remote gating', () => {
    beforeEach(() => {
        contextValue = {
            gameState: createGameState(),
            handleAction: vi.fn(),
            startNewGame: vi.fn(),
            connectionState: 'connected',
            lastError: null,
            playerCount: 2,
            mode: 'remote',
            selfPlayer: {
                clientId: 'client-2',
                playerId: 'p2',
                seatIndex: 1,
                name: 'Bob',
                ready: true,
                isHost: false,
                connected: true
            },
            requestRematch: vi.fn()
        } satisfies EngineContextMock;
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows waiting message in action panel for non-active remote clients', async () => {
        render(<Game />);

        // Message should be visible in the action panel
        const waitingHeading = screen.getByText(/Waiting for Alice/i);
        const waitingBody = screen.getByText(/only the current player can act/i);
        expect(waitingHeading).to.exist;
        expect(waitingBody).to.exist;

        // Pass button should still be visible (not covered by overlay)
        screen.getByRole('button', { name: /pass/i });
    });

    it('hides overlay and allows actions when the client owns the turn', async () => {
        contextValue.gameState = createGameState({ currentTurnPlayerIndex: 1 });
        contextValue.selfPlayer = { ...contextValue.selfPlayer!, playerId: 'p2', seatIndex: 1 };

        render(<Game />);

        expect(screen.queryByText(/Waiting for/i)).to.be.null;

        const passButton = screen.getByRole('button', { name: /pass/i });
        expect(passButton).to.exist;

        const user = userEvent.setup();
        await user.click(passButton);
        expect(contextValue.handleAction).toHaveBeenCalledWith('pass', undefined);
    });
});
