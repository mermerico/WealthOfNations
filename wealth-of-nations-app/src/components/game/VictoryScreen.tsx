import type { Player, HexCell } from '../../types/gameState';

interface VictoryScreenProps {
    players: Player[];
    board: Record<string, HexCell>;
    onNewGame: () => void;
}

interface PlayerScore {
    player: Player;
    industryPoints: number;
    moneyPoints: number;
    loanPenalty: number;
    totalScore: number;
}

function calculateVictoryPoints(players: Player[], board: Record<string, any>): PlayerScore[] {
    return players.map(player => {
        // Count industry tiles: +4 VPs per tile
        const industryTiles = Object.values(board).filter(
            cell => cell.occupant?.type === 'Industry' && cell.occupant?.playerId === player.id
        ).length;
        const industryPoints = industryTiles * 4;

        // Money: +1 VP per $10
        const moneyPoints = Math.floor(player.money / 10);

        // Loans: -3 VPs per promissory note
        const loanPenalty = player.loans * 3;

        const totalScore = industryPoints + moneyPoints - loanPenalty;

        return {
            player,
            industryPoints,
            moneyPoints,
            loanPenalty,
            totalScore
        };
    });
}

function determineWinner(scores: PlayerScore[]): PlayerScore[] {
    // Sort by total score descending
    const sorted = [...scores].sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        // Tie breaker 1: Most money
        if (b.player.money !== a.player.money) return b.player.money - a.player.money;
        // Tie breaker 2: Most flags on board (18 - flags remaining)
        const aFlagsPlaced = 18 - a.player.flags;
        const bFlagsPlaced = 18 - b.player.flags;
        if (bFlagsPlaced !== aFlagsPlaced) return bFlagsPlaced - aFlagsPlaced;
        // Shared victory
        return 0;
    });

    // Find all players with the highest score (ties)
    const highScore = sorted[0].totalScore;
    return sorted.filter(s => s.totalScore === highScore);
}

export function VictoryScreen({ players, board, onNewGame }: VictoryScreenProps) {
    const scores = calculateVictoryPoints(players, board);
    const winners = determineWinner(scores);
    const isSharedVictory = winners.length > 1;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{
                background: '#1a1a1a',
                border: '3px solid #fbbf24',
                borderRadius: '12px',
                padding: '40px',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
            }}>
                <h1 style={{
                    color: '#fbbf24',
                    textAlign: 'center',
                    marginTop: 0,
                    marginBottom: '30px',
                    fontSize: '2.5rem'
                }}>
                    {isSharedVictory ? '🏆 Shared Victory! 🏆' : `🏆 ${winners[0].player.name} Wins! 🏆`}
                </h1>

                {/* Scores Table */}
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '30px'
                }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #444' }}>
                            <th style={{ color: '#aaa', padding: '12px', textAlign: 'left' }}>Player</th>
                            <th style={{ color: '#aaa', padding: '12px', textAlign: 'center' }}>Industries</th>
                            <th style={{ color: '#aaa', padding: '12px', textAlign: 'center' }}>Money</th>
                            <th style={{ color: '#aaa', padding: '12px', textAlign: 'center' }}>Loans</th>
                            <th style={{ color: '#aaa', padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scores.sort((a, b) => b.totalScore - a.totalScore).map((score, idx) => {
                            const isWinner = winners.some(w => w.player.id === score.player.id);
                            return (
                                <tr key={score.player.id} style={{
                                    background: isWinner ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                                    borderBottom: '1px solid #333'
                                }}>
                                    <td style={{
                                        color: 'white',
                                        padding: '12px',
                                        fontWeight: isWinner ? 'bold' : 'normal'
                                    }}>
                                        {idx === 0 && '👑 '}
                                        {score.player.name}
                                    </td>
                                    <td style={{ color: '#10b981', padding: '12px', textAlign: 'center' }}>
                                        +{score.industryPoints}
                                    </td>
                                    <td style={{ color: '#10b981', padding: '12px', textAlign: 'center' }}>
                                        +{score.moneyPoints}
                                    </td>
                                    <td style={{ color: '#ef4444', padding: '12px', textAlign: 'center' }}>
                                        -{score.loanPenalty}
                                    </td>
                                    <td style={{
                                        color: isWinner ? '#fbbf24' : 'white',
                                        padding: '12px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '1.2rem'
                                    }}>
                                        {score.totalScore}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Score Breakdown */}
                <div style={{
                    background: '#222',
                    padding: '16px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    color: '#aaa',
                    fontSize: '14px'
                }}>
                    <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#10b981' }}>Industries:</strong> +4 VP per tile
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <strong style={{ color: '#10b981' }}>Money:</strong> +1 VP per $10
                    </div>
                    <div>
                        <strong style={{ color: '#ef4444' }}>Promissory Notes:</strong> -3 VP per loan
                    </div>
                </div>

                <button
                    onClick={onNewGame}
                    style={{
                        width: '100%',
                        padding: '16px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    New Game
                </button>
            </div>
        </div>
    );
}
