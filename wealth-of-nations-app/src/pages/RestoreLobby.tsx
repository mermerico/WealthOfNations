import type { LobbySnapshot, LobbyPlayer } from '../shared/networkTypes';

type ConnectionLabel = 'connecting' | 'connected' | 'disconnected';

interface RestoreLobbyProps {
    lobby: LobbySnapshot;
    selfPlayer: LobbyPlayer | null;
    connectionState: ConnectionLabel;
    lastError: string | null;
    clientId: string;
    onLeave: () => void;
    onClaimSeat: (seatIndex: number) => void;
    onUnclaimSeat: () => void;
}

export function RestoreLobby({
    lobby,
    connectionState,
    lastError,
    clientId,
    onLeave,
    onClaimSeat,
    onUnclaimSeat
}: RestoreLobbyProps) {
    const restoringSeats = lobby.restoringSeats || [];
    const mySeat = restoringSeats.find(s => s.claimedByClientId === clientId);
    const allClaimed = restoringSeats.every(s => s.claimedByClientId !== null);
    const claimedCount = restoringSeats.filter(s => s.claimedByClientId !== null).length;

    return (
        <div className="lobby-container">
            <div className="lobby-header">
                <h1>Restore Game</h1>
                <div className="lobby-code">
                    <span>{lobby.code}</span>
                </div>
                <div className="lobby-info">
                    Round {lobby.savedRound} • {lobby.savedPhase} Phase • {claimedCount}/{restoringSeats.length} seats claimed • Connection: {connectionState}
                </div>
            </div>

            <div className="lobby-list">
                <div className="restore-instructions">
                    Select your seat to resume the game. When all seats are claimed, the game will start automatically.
                </div>

                {restoringSeats.map(seat => {
                    const isMine = seat.claimedByClientId === clientId;
                    const isClaimed = seat.claimedByClientId !== null;
                    const claimerPlayer = isClaimed
                        ? lobby.players.find(p => p.clientId === seat.claimedByClientId)
                        : null;

                    return (
                        <div
                            key={seat.seatIndex}
                            className={`lobby-player-row${isMine ? ' self' : ''}${isClaimed && !isMine ? ' claimed' : ''}`}
                        >
                            <div className="player-main">
                                <span className="player-seat">#{seat.seatIndex + 1}</span>
                                <span className="player-name">{seat.savedName}</span>
                                <span className="restore-stats">
                                    (${seat.savedMoney}, {seat.savedIndustryCount} industries)
                                </span>
                            </div>
                            <div className="player-status">
                                {isMine ? (
                                    <button
                                        className="lobby-button small"
                                        onClick={onUnclaimSeat}
                                    >
                                        Unclaim
                                    </button>
                                ) : isClaimed ? (
                                    <span className="ready-badge ready">
                                        Claimed by {claimerPlayer?.name || 'someone'}
                                    </span>
                                ) : (
                                    <button
                                        className="lobby-button small primary"
                                        onClick={() => onClaimSeat(seat.seatIndex)}
                                        disabled={mySeat !== undefined}
                                    >
                                        Claim
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="lobby-footer">
                <div className="lobby-actions">
                    <button className="lobby-button" onClick={onLeave}>Leave</button>
                </div>
                <div className="lobby-info">
                    {allClaimed
                        ? 'All seats claimed! Starting game...'
                        : `Waiting for ${restoringSeats.length - claimedCount} more player(s) to claim seats`
                    }
                </div>
            </div>

            {lastError && (
                <div className="landing-error" role="alert">
                    {lastError}
                </div>
            )}
        </div>
    );
}
