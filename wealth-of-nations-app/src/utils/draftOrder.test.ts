import { describe, it, expect } from 'vitest';
import { getDraftOrder } from './setupLogic';

describe('Draft Order', () => {
    it('should follow snake draft pattern for 3 players starting with player 0', () => {
        // Round 0 (Round 1 in UI): clockwise from player 0
        const round0 = getDraftOrder(0, 3, 0);
        expect(round0).toEqual([0, 1, 2]);

        // Round 1 (Round 2 in UI): counter-clockwise (reverse) from player 2
        const round1 = getDraftOrder(1, 3, 0);
        expect(round1).toEqual([2, 1, 0]);
    });

    it('should follow snake draft pattern for 3 players starting with player 1', () => {
        // Round 0: clockwise from player 1
        const round0 = getDraftOrder(0, 3, 1);
        expect(round0).toEqual([1, 2, 0]);

        // Round 1: counter-clockwise (reverse)
        const round1 = getDraftOrder(1, 3, 1);
        expect(round1).toEqual([0, 2, 1]);
    });

    it('should follow snake draft pattern for 3 players starting with player 2', () => {
        // Round 0: clockwise from player 2
        const round0 = getDraftOrder(0, 3, 2);
        expect(round0).toEqual([2, 0, 1]);

        // Round 1: counter-clockwise (reverse)
        const round1 = getDraftOrder(1, 3, 2);
        expect(round1).toEqual([1, 0, 2]);
    });

    it('should follow snake draft pattern for 4 players', () => {
        // Round 0: clockwise from player 0
        const round0 = getDraftOrder(0, 4, 0);
        expect(round0).toEqual([0, 1, 2, 3]);

        // Round 1: counter-clockwise
        const round1 = getDraftOrder(1, 4, 0);
        expect(round1).toEqual([3, 2, 1, 0]);

        // Round 2: clockwise again
        const round2 = getDraftOrder(2, 4, 0);
        expect(round2).toEqual([0, 1, 2, 3]);
    });

    it('should follow snake draft pattern for 5 players', () => {
        // Round 0: clockwise
        const round0 = getDraftOrder(0, 5, 0);
        expect(round0).toEqual([0, 1, 2, 3, 4]);

        // Round 1: counter-clockwise
        const round1 = getDraftOrder(1, 5, 0);
        expect(round1).toEqual([4, 3, 2, 1, 0]);
    });
});
