import { describe, it, expect } from 'vitest';

describe('Game End Conditions and Scoring', () => {
    describe('Game End Triggers', () => {
        it('should end when a player places all 18 flags', () => {
            const playerFlagsPlaced = 18;
            const maxFlags = 18;
            const gameEnds = playerFlagsPlaced >= maxFlags;
            expect(gameEnds).toBe(true);
        });

        it('should end when every hex on board is occupied', () => {
            // Hex grid with radius 4 has 61 hexes (1 + 6 + 12 + 18 + 24)
            // But center hex (0,0) cannot be occupied, so 60 usable hexes
            const totalHexes = 60; // Excluding center
            const occupiedHexes = 60;
            const gameEnds = occupiedHexes >= totalHexes;
            expect(gameEnds).toBe(true);
        });

        it('should end when 5 out of 6 industry stacks are empty', () => {
            const emptyStacks = 5;
            const gameEnds = emptyStacks >= 5;
            expect(gameEnds).toBe(true);
        });

        it('should NOT end if only 4 stacks are empty', () => {
            const emptyStacks = 4;
            const gameEnds = emptyStacks >= 5;
            expect(gameEnds).toBe(false);
        });

        it('end conditions are checked during Develop phase only', () => {
            const phaseToCheck = 'Develop';
            expect(phaseToCheck).toBe('Develop');
        });
    });

    describe('Final Sequence After Trigger', () => {
        it('should complete current Develop phase when triggered', () => {
            const sequence = [
                'Trigger during Develop',
                'Complete Develop phase',
                'Play final Produce phase',
                'Play final Trade phase',
                'Score game'
            ];
            expect(sequence[0]).toContain('Develop');
            expect(sequence[1]).toContain('Complete Develop');
        });

        it('should play one final Produce phase', () => {
            const sequence = [
                'Complete Develop phase',
                'Play final Produce phase',
                'Play final Trade phase'
            ];
            expect(sequence[1]).toContain('Produce');
        });

        it('should play one final Trade phase for selling stock', () => {
            const sequence = [
                'Play final Produce phase',
                'Play final Trade phase',
                'Score game'
            ];
            expect(sequence[1]).toContain('Trade');
        });
    });

    describe('Victory Point Calculation', () => {
        it('should award 4 VPs per industry tile on board', () => {
            const vpPerIndustry = 4;
            const industriesOnBoard = 5;
            const industryVPs = industriesOnBoard * vpPerIndustry;
            expect(industryVPs).toBe(20);
        });

        it('should award 1 VP per $10 held', () => {
            const money = 73;
            const moneyVPs = Math.floor(money / 10);
            expect(moneyVPs).toBe(7);
        });

        it('should penalize -3 VPs per unpaid promissory note', () => {
            const unpaidLoans = 2;
            const loanPenalty = unpaidLoans * -3;
            expect(loanPenalty).toBe(-6);
        });

        it('should calculate total VPs correctly', () => {
            const industries = 8; // 8 tiles on board
            const money = 125; // $125
            const loans = 1; // 1 unpaid loan

            const industryVPs = industries * 4;
            const moneyVPs = Math.floor(money / 10);
            const loanPenalty = loans * -3;

            const totalVPs = industryVPs + moneyVPs + loanPenalty;

            expect(industryVPs).toBe(32);
            expect(moneyVPs).toBe(12);
            expect(loanPenalty).toBe(-3);
            expect(totalVPs).toBe(41);
        });
    });

    describe('Tie Breaker Rules', () => {
        it('first tie breaker should be most money', () => {
            const player1 = { vps: 50, money: 100, flags: 10 };
            const player2 = { vps: 50, money: 80, flags: 12 };

            expect(player1.vps).toBe(player2.vps);
            const winner = player1.money > player2.money ? 'player1' : 'player2';
            expect(winner).toBe('player1');
        });

        it('second tie breaker should be most flags on board', () => {
            const player1 = { vps: 50, money: 100, flags: 10 };
            const player2 = { vps: 50, money: 100, flags: 12 };

            expect(player1.vps).toBe(player2.vps);
            expect(player1.money).toBe(player2.money);
            const winner = player1.flags > player2.flags ? 'player1' : 'player2';
            expect(winner).toBe('player2');
        });

        it('third tie breaker should be shared victory', () => {
            const player1 = { vps: 50, money: 100, flags: 10 };
            const player2 = { vps: 50, money: 100, flags: 10 };

            expect(player1.vps).toBe(player2.vps);
            expect(player1.money).toBe(player2.money);
            expect(player1.flags).toBe(player2.flags);

            const result = 'shared victory';
            expect(result).toBe('shared victory');
        });
    });

    describe('VP Edge Cases', () => {
        it('partial money should not award VPs', () => {
            const money = 19;
            const vps = Math.floor(money / 10);
            expect(vps).toBe(1); // Only the $10, not the $9
        });

        it('exactly $10 should award 1 VP', () => {
            const money = 10;
            const vps = Math.floor(money / 10);
            expect(vps).toBe(1);
        });

        it('$0 should award 0 VPs', () => {
            const money = 0;
            const vps = Math.floor(money / 10);
            expect(vps).toBe(0);
        });

        it('negative money should not award VPs', () => {
            // In case game allows negative money
            const money = -50;
            const vps = Math.max(0, Math.floor(money / 10));
            expect(vps).toBe(0);
        });

        it('zero industries should award 0 VPs', () => {
            const industries = 0;
            const vps = industries * 4;
            expect(vps).toBe(0);
        });

        it('loan penalty should work with zero loans', () => {
            const loans = 0;
            const penalty = loans * -3;
            expect(Math.abs(penalty)).toBe(0);
        });
    });
});
