import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { TradeModal, AcceptTradeModal } from './TradeModal';
import { Player } from '../../types/gameState';

describe('TradeModal', () => {
    const mockPlayer: Player = {
        id: 'p1',
        name: 'Player 1',
        color: 'red',
        resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
        money: 100,
        loans: 0,
        flags: 5,
        ready: false
    };

    const mockOtherPlayer: Player = {
        id: 'p2',
        name: 'Player 2',
        color: 'blue',
        resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
        money: 100,
        loans: 0,
        flags: 5,
        ready: false
    };

    const mockThirdPlayer: Player = {
        id: 'p3',
        name: 'Player 3',
        color: 'green',
        resources: { Food: 10, Energy: 10, Labor: 10, Ore: 10, Capital: 10 },
        money: 100,
        loans: 0,
        flags: 5,
        ready: false
    };

    const mockMarkets = {
        Food: { stock: 4, priceIndex: 4 },
        Energy: { stock: 4, priceIndex: 4 },
        Labor: { stock: 4, priceIndex: 4 },
        Ore: { stock: 4, priceIndex: 4 },
        Capital: { stock: 4, priceIndex: 4 }
    };

    const defaultProps = {
        currentPlayer: mockPlayer,
        allPlayers: [mockPlayer, mockOtherPlayer, mockThirdPlayer],
        markets: mockMarkets,
        onPropose: vi.fn(),
        onCancel: vi.fn()
    };

    it('shows warning when no recipient selected', () => {
        render(<TradeModal {...defaultProps} />);

        // Warning should be visible immediately since no player is selected by default
        expect(screen.getByText(/Please select a player to trade with/i)).toBeInTheDocument();

        // Button should be disabled
        const proposeButton = screen.getByRole('button', { name: /Propose Trade/i });
        expect(proposeButton).toBeDisabled();
    });

    it('clears warning when player is selected', () => {
        render(<TradeModal {...defaultProps} />);

        // Warning present initially
        expect(screen.getByText(/Please select a player to trade with/i)).toBeInTheDocument();

        // Select a player
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'p2' } });

        expect(screen.queryByText(/Please select a player to trade with/i)).not.toBeInTheDocument();
    });

    it('calls onPropose when valid trade is proposed', () => {
        render(<TradeModal {...defaultProps} />);

        // Select player
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'p2' } });

        // Add money
        const moneyInput = screen.getAllByRole('spinbutton')[0]; // First one is "You Give" money
        fireEvent.change(moneyInput, { target: { value: '10' } });

        const proposeButton = screen.getByRole('button', { name: /Propose Trade/i });
        fireEvent.click(proposeButton);

        expect(defaultProps.onPropose).toHaveBeenCalled();
    });
    it('resets receiving items when target player changes', async () => {
        render(<TradeModal {...defaultProps} />);

        // Select Player 2
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'p2' } });

        // Add item to receive. We need to find the "You Receive" section's "+" button.
        // Structure is: You Give (1st col), You Receive (2nd col)
        // We can find the "Food" text in the second column.
        // But simpler: just find all "+" buttons.
        // "You Give" has 5 commodities + loan = 6 "+" buttons.
        // "You Receive" has 5 commodities + loan = 6 "+" buttons.
        // Total 12 "+" buttons.
        // Indices 0-5 are Give, 6-11 are Receive.

        const plusButtons = screen.getAllByText('+');
        // Click "+" for Food in "You Receive" (index 6)
        fireEvent.click(plusButtons[6]);

        // Change to Player 3
        fireEvent.change(select, { target: { value: 'p3' } });

        // Verify receiving amount is reset to 0
        // The count is between "-" and "+" buttons.
        // Let's check the text content of the span between buttons.
        // Or checking that we don't see "1" in the receiving section.

        // Let's find the specific "Food" row in receiving section again.
        // We can check if the span next to the clicked button is 0.
        // But we clicked index 6. The span is probably nearby.

        // Easier: check the state update by seeing if the count is displayed as '0'
        // We can just look for '1' and expect it NOT to be there in the receiving section.
        // But "You Give" might have 1 if we added it (we didn't).

        // Let's use `within` to be safe, but let's try a simpler assertion first.
        // The text '1' should appear if we added 1.
        expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
});

describe('AcceptTradeModal', () => {
    const mockProposer: Player = {
        id: 'p1',
        name: 'Player 1',
        color: 'red',
        resources: { Food: 1, Energy: 1, Labor: 1, Ore: 1, Capital: 1 },
        money: 100,
        loans: 0,
        flags: 5,
        ready: false
    };

    const mockReceiver: Player = {
        id: 'p2',
        name: 'Player 2',
        color: 'blue',
        resources: { Food: 1, Energy: 1, Labor: 1, Ore: 1, Capital: 1 },
        money: 100,
        loans: 0,
        flags: 5,
        ready: false
    };

    const mockMarkets = {
        Food: { stock: 4, priceIndex: 4 },
        Energy: { stock: 4, priceIndex: 4 },
        Labor: { stock: 4, priceIndex: 4 },
        Ore: { stock: 4, priceIndex: 4 },
        Capital: { stock: 4, priceIndex: 4 }
    };

    const defaultAcceptProps = {
        proposingPlayer: mockProposer,
        receivingPlayer: mockReceiver,
        giving: { commodities: { Food: 1 }, money: 0, loans: 0 },
        receiving: { commodities: { Ore: 1 }, money: 0, loans: 0 },
        markets: mockMarkets,
        onAccept: vi.fn(),
        onReject: vi.fn(),
        onCounterProposal: vi.fn()
    };

    it('renders trade details correctly', () => {
        render(<AcceptTradeModal {...defaultAcceptProps} />);

        expect(screen.getByText('Player 1')).toBeInTheDocument();
        expect(screen.getByText(/wants to trade with you/i)).toBeInTheDocument();
        expect(screen.getByText('1 Food')).toBeInTheDocument();
        expect(screen.getByText('1 Ore')).toBeInTheDocument();
    });

    it('calls onCounterProposal when Counter button is clicked', () => {
        render(<AcceptTradeModal {...defaultAcceptProps} />);

        const counterButton = screen.getByTestId('counter-trade-button');
        fireEvent.click(counterButton);

        expect(defaultAcceptProps.onCounterProposal).toHaveBeenCalled();
    });
});
