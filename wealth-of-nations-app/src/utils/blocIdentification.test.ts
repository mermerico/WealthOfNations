import { describe, it, expect } from 'vitest';
import { identifyBloc } from './production';
import type { HexCell } from '../types/gameState';

describe('Bloc Identification', () => {
    describe('Single Tile Blocs', () => {
        it('should identify a single tile as a bloc', () => {
            const board: Record<string, HexCell> = {
                '0,1': {
                    q: 0, r: 1,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile1',
                            type: 'Farm',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const startCell = board['0,1'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(1);
            expect(bloc[0].q).toBe(0);
            expect(bloc[0].r).toBe(1);
        });

        it('should not include different industry types in bloc', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile1',
                            type: 'Farm',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '1,1': { // Adjacent
                    q: 1, r: 1,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile2',
                            type: 'Generator', // Different type
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const startCell = board['1,0'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(1);
            expect(bloc[0].occupant?.tile?.type).toBe('Farm');
        });
    });

    describe('Multi-Tile Blocs', () => {
        it('should identify contiguous same-type tiles as one bloc', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile1',
                            type: 'Farm',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '2,0': { // Adjacent
                    q: 2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile2',
                            type: 'Farm',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '3,0': { // Adjacent to tile2
                    q: 3, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile3',
                            type: 'Farm',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const startCell = board['1,0'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(3);
        });

        it('should include tiles in all directions', () => {
            // Create a cluster of same-type tiles
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'center',
                            type: 'Mine',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '2,0': { // East
                    q: 2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'east',
                            type: 'Mine',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '1,1': { // Southeast
                    q: 1, r: 1,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'se',
                            type: 'Mine',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '0,1': { // Southwest
                    q: 0, r: 1,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'sw',
                            type: 'Mine',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const startCell = board['1,0'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(4);
        });
    });

    describe('Owner Separation', () => {
        it('should NOT include tiles from different players', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile1',
                            type: 'Factory',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '2,0': {
                    q: 2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p2',
                        tile: {
                            id: 'tile2',
                            type: 'Factory',
                            ownerId: 'p2', // Different player
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const startCell = board['1,0'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(1);
            expect(bloc[0].occupant?.tile?.ownerId).toBe('p1');
        });

        it('should create separate blocs for same-type tiles with different owners', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'p1tile1',
                            type: 'Academy',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '2,0': {
                    q: 2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'p1tile2',
                            type: 'Academy',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '3,0': {
                    q: 3, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p2',
                        tile: {
                            id: 'p2tile',
                            type: 'Academy',
                            ownerId: 'p2',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const p1Bloc = identifyBloc(board, board['1,0']);
            const p2Bloc = identifyBloc(board, board['3,0']);

            expect(p1Bloc).toHaveLength(2);
            expect(p2Bloc).toHaveLength(1);
        });
    });

    describe('Non-Contiguous Tiles', () => {
        it('should NOT include same-type tiles that are not adjacent', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile1',
                            type: 'Generator',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                },
                '3,0': { // Not adjacent (gap at 2,0)
                    q: 3, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: {
                            id: 'tile2',
                            type: 'Generator',
                            ownerId: 'p1',
                            orientation: 0,
                            active: true,
                            automated: false
                        }
                    }
                }
            };

            const bloc = identifyBloc(board, board['1,0']);

            expect(bloc).toHaveLength(1);
        });

        it('should handle complex separation patterns', () => {
            // Player has Farms at 1,0 and 1,1 (connected)
            // And another Farm at 3,0 (disconnected)
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: { id: 't1', type: 'Farm', ownerId: 'p1', orientation: 0, active: true, automated: false }
                    }
                },
                '1,1': {
                    q: 1, r: 1,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: { id: 't2', type: 'Farm', ownerId: 'p1', orientation: 0, active: true, automated: false }
                    }
                },
                '2,0': {
                    q: 2, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: { id: 't3', type: 'Generator', ownerId: 'p1', orientation: 0, active: true, automated: false } // Different type blocks
                    }
                },
                '3,0': {
                    q: 3, r: 0,
                    occupant: {
                        type: 'Industry',
                        playerId: 'p1',
                        tile: { id: 't4', type: 'Farm', ownerId: 'p1', orientation: 0, active: true, automated: false }
                    }
                }
            };

            const bloc1 = identifyBloc(board, board['1,0']);
            const bloc2 = identifyBloc(board, board['3,0']);

            expect(bloc1).toHaveLength(2); // 1,0 and 1,1
            expect(bloc2).toHaveLength(1); // 3,0 alone
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty cells gracefully', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: null
                }
            };

            const startCell = board['1,0'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(0);
        });

        it('should handle flag-only cells', () => {
            const board: Record<string, HexCell> = {
                '1,0': {
                    q: 1, r: 0,
                    occupant: {
                        type: 'Flag',
                        playerId: 'p1'
                    }
                }
            };

            const startCell = board['1,0'];
            const bloc = identifyBloc(board, startCell);

            expect(bloc).toHaveLength(0);
        });
    });
});
