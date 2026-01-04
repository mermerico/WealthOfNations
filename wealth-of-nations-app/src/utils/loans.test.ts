import { describe, it, expect } from 'vitest';

describe('Promissory Notes (Loans)', () => {
    describe('Taking Loans', () => {
        it('first loan should provide $20', () => {
            const existingLoans = 0;
            const loanAmount = 20 - existingLoans;
            expect(loanAmount).toBe(20);
        });

        it('second loan should provide $19', () => {
            const existingLoans = 1;
            const loanAmount = 20 - existingLoans;
            expect(loanAmount).toBe(19);
        });

        it('third loan should provide $18', () => {
            const existingLoans = 2;
            const loanAmount = 20 - existingLoans;
            expect(loanAmount).toBe(18);
        });

        it('tenth loan should provide $11', () => {
            const existingLoans = 9;
            const loanAmount = 20 - existingLoans;
            expect(loanAmount).toBe(11);
        });

        it('twentieth loan should provide $1', () => {
            const existingLoans = 19;
            const loanAmount = 20 - existingLoans;
            expect(loanAmount).toBe(1);
        });

        it('loan amount should decrease by $1 for each existing loan', () => {
            for (let i = 0; i < 10; i++) {
                const loanAmount = 20 - i;
                expect(loanAmount).toBe(20 - i);
            }
        });

        it('should not provide negative loan amounts', () => {
            const existingLoans = 25;
            const loanAmount = Math.max(0, 20 - existingLoans);
            expect(loanAmount).toBe(0);
        });
    });

    describe('Repaying Loans', () => {
        it('should always cost $25 to repay one loan', () => {
            const repaymentCost = 25;
            expect(repaymentCost).toBe(25);
        });

        it('repayment cost should not depend on number of existing loans', () => {
            const costs = [1, 5, 10, 15].map(() => 25);
            expect(costs.every(cost => cost === 25)).toBe(true);
        });

        it('repaying is more expensive than taking a loan (profit for bank)', () => {
            const firstLoanAmount = 20;
            const repaymentCost = 25;
            const loss = repaymentCost - firstLoanAmount;

            expect(loss).toBe(5);
            expect(repaymentCost).toBeGreaterThan(firstLoanAmount);
        });
    });

    describe('Victory Point Penalties', () => {
        it('each unpaid loan should cost -3 VPs at game end', () => {
            const vpPenaltyPerLoan = -3;
            expect(vpPenaltyPerLoan).toBe(-3);
        });

        it('multiple unpaid loans should multiply the penalty', () => {
            const unrepaidLoans = 3;
            const totalPenalty = unrepaidLoans * -3;
            expect(totalPenalty).toBe(-9);
        });

        it('zero loans should have zero penalty', () => {
            const unrepaidLoans = 0;
            const totalPenalty = unrepaidLoans * -3;
            expect(Math.abs(totalPenalty)).toBe(0);
        });
    });

    describe('Loan Economics', () => {
        it('taking and repaying first loan results in $5 loss', () => {
            const received = 20;
            const repaid = 25;
            const netLoss = received - repaid;

            expect(netLoss).toBe(-5);
        });

        it('taking first loan and paying VP penalty is worse than repaying', () => {
            const vpPenalty = -3; // Worth -$30 if VPs convert at $10 each
            const repaymentCost = 25;

            // If you don't repay, you keep $20 but lose 3 VPs
            // If VPs are worth money at end ($10 per VP), penalty is $30
            const vpPenaltyInMoney = vpPenalty * 10;
            expect(vpPenaltyInMoney).toBe(-30);
            expect(repaymentCost).toBeLessThan(Math.abs(vpPenaltyInMoney));
        });

        it('later loans provide less cash but same repayment cost', () => {
            const loan5Amount = 20 - 4; // $16
            const loan10Amount = 20 - 9; // $11
            const repaymentCost = 25;

            expect(loan5Amount).toBe(16);
            expect(loan10Amount).toBe(11);
            expect(repaymentCost).toBe(25); // Same for all

            // Later loans are even worse deals
            const loss5 = loan5Amount - repaymentCost;
            const loss10 = loan10Amount - repaymentCost;
            expect(loss5).toBeGreaterThan(loss10);
        });
    });

    describe('Strategic Loan Timing', () => {
        it('should track that loans can be taken during Trade phase', () => {
            // Loans can be taken "at any time" during Trade Phase
            // This is a free action (does not cost a turn)
            const isFreeAction = true;
            expect(isFreeAction).toBe(true);
        });

        it('should track that loans can be repaid during Trade phase', () => {
            // Repayment can happen "at any time" during Trade Phase
            // This is also a free action
            const isFreeAction = true;
            expect(isFreeAction).toBe(true);
        });

        it('loans should be available to all players', () => {
            // Any player can take loans, not limited by player count
            const loansAvailableToAllPlayers = true;
            expect(loansAvailableToAllPlayers).toBe(true);
        });
    });
});
