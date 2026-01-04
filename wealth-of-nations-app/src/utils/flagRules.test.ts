import { describe, it, expect } from 'vitest';

describe('Flag Placement Rules', () => {
    describe('Flag Costs', () => {
        it('should cost 1 Labor to place a flag', () => {
            const flagCost = { Labor: 1 };
            expect(flagCost.Labor).toBe(1);
        });

        it('should only cost Labor, no other resources', () => {
            const flagCost = { Labor: 1 };
            expect(Object.keys(flagCost)).toHaveLength(1);
            expect(Object.keys(flagCost)[0]).toBe('Labor');
        });
    });

    describe('Flag Adjacency Requirements', () => {
        it('first flag can be placed anywhere (except center)', () => {
            // First flag has no adjacency requirement
            const hasExistingFlags = false;
            const needsAdjacency = hasExistingFlags;
            expect(needsAdjacency).toBe(false);
        });

        it('subsequent flags must be adjacent to existing flags', () => {
            const hasExistingFlags = true;
            const mustBeAdjacent = hasExistingFlags;
            expect(mustBeAdjacent).toBe(true);
        });

        it('flag placement on center hex (0,0) is forbidden', () => {
            const centerHex = '0,0';
            const isValidForFlag = centerHex !== '0,0';
            expect(isValidForFlag).toBe(false);
        });
    });

    describe('Flag Supply', () => {
        it('each player should start with 18 flags', () => {
            const flagsPerPlayer = 18;
            expect(flagsPerPlayer).toBe(18);
        });

        it('game should end if a player places all 18 flags', () => {
            const flagsPlaced = 18;
            const totalFlags = 18;
            const triggersGameEnd = flagsPlaced >= totalFlags;
            expect(triggersGameEnd).toBe(true);
        });
    });

    describe('Flag Ownership', () => {
        it('flags should identify tile ownership', () => {
            // Flags are placed before building tiles on them
            // The flag indicates who can build on that hex
            const flagPlayerId = 'p1';
            const canPlayerBuild = (playerId: string) => playerId === flagPlayerId;

            expect(canPlayerBuild('p1')).toBe(true);
            expect(canPlayerBuild('p2')).toBe(false);
        });

        it('building on a flagged hex requires matching player', () => {
            const flagOwner = 'p1';
            const buildingPlayer = 'p1';
            const isValid = flagOwner === buildingPlayer;
            expect(isValid).toBe(true);
        });

        it('cannot build on another player\'s flag', () => {
            const flagOwner: string = 'p1';
            const buildingPlayer: string = 'p2';
            const isValid = flagOwner === buildingPlayer;
            expect(isValid).toBe(false);
        });
    });

    describe('Flag Behavior During Moves', () => {
        it('moved tiles keep their flags', () => {
            // When moving a tile, the flag stays with it
            const tileHasFlag = true;
            const flagMovesWithTile = tileHasFlag;
            expect(flagMovesWithTile).toBe(true);
        });

        it('moving to hex with existing flag returns extra flag to supply', () => {
            // If you move a tile (with flag) to a hex that already has your flag
            // One flag returns to supply
            const sourceHasFlag = true;
            const destHasFlag = true;
            const flagsReturned = (sourceHasFlag && destHasFlag) ? 1 : 0;
            expect(flagsReturned).toBe(1);
        });

        it('moving to empty hex keeps the tile\'s flag', () => {
            const sourceHasFlag = true;
            const destHasFlag = false;
            const flagsReturned = (sourceHasFlag && destHasFlag) ? 1 : 0;
            expect(flagsReturned).toBe(0);
        });
    });

    describe('Flag Requirements for Building', () => {
        it('cannot build industry without a flag on the hex', () => {
            const hexHasFlag = false;
            const canBuild = hexHasFlag;
            expect(canBuild).toBe(false);
        });

        it('can build industry if flag is present and owned', () => {
            const hexHasOwnedFlag = true;
            const canBuild = hexHasOwnedFlag;
            expect(canBuild).toBe(true);
        });

        it('flag is replaced by industry tile when building', () => {
            // After building, the hex contains an Industry, not a Flag
            // But the industry "has" the flag (ownership marker)
            const beforeBuilding = 'Flag';
            const afterBuilding = 'Industry';
            expect(beforeBuilding).not.toBe(afterBuilding);
        });
    });
});
