import { useEffect, useState } from 'react';
import type { LobbySnapshot, LobbyPlayer } from '../shared/networkTypes';

type ConnectionLabel = 'connecting' | 'connected' | 'disconnected';

interface LobbyProps {
    lobby: LobbySnapshot;
    selfPlayer: LobbyPlayer | null;
    connectionState: ConnectionLabel;
    lastError: string | null;
    onLeave: () => void;
    onRename: (name: string) => void;
    onReadyToggle: (ready: boolean) => void;
    onStart: () => void;
}

export function Lobby({
    lobby,
    selfPlayer,
    connectionState,
    lastError,
    onLeave,
    onRename,
    onReadyToggle,
    onStart
}: LobbyProps) {
    const [nameDraft, setNameDraft] = useState(selfPlayer?.name ?? '');
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

    useEffect(() => {
        setNameDraft(selfPlayer?.name ?? '');
    }, [selfPlayer?.name]);

    const readyCount = lobby.players.filter(player => player.ready).length;
    const fullLobby = lobby.players.length === lobby.requiredSeats;
    const everyoneReady = fullLobby && readyCount === lobby.requiredSeats;
    const isHost = selfPlayer?.isHost ?? false;
    const isReady = selfPlayer?.ready ?? false;

    const handleRenameBlur = () => {
        const next = nameDraft.trim();
        if (selfPlayer && next && next !== selfPlayer.name) {
            onRename(next);
        } else {
            setNameDraft(selfPlayer?.name ?? '');
        }
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(lobby.code);
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 1500);
        } catch (error) {
            console.error('Failed to copy lobby code', error);
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 2000);
        }
    };

    return (
        <div className="lobby-container">
            <div className="lobby-header">
                <h1>Lobby</h1>
                <div className="lobby-code">
                    <span>{lobby.code}</span>
                    <button onClick={handleCopyCode}>
                        {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Failed' : 'Copy'}
                    </button>
                </div>
                <span className="lobby-info">
                    {readyCount}/{lobby.requiredSeats} players ready &bull; Connection: {connectionState}
                </span>
            </div>

            <div className="lobby-grid">
                {lobby.players.map(player => {
                    const isSelf = player.clientId === selfPlayer?.clientId;
                    return (
                        <div key={player.clientId} className={`lobby-player${isSelf ? ' self' : ''}`}>
                            <header>
                                <span>{player.isHost ? 'Host' : 'Player'}</span>
                                <span className={`ready-badge ${player.ready ? '' : 'awaiting'}`}>
                                    {player.ready ? 'Ready' : 'Not Ready'}
                                </span>
                            </header>
                            {isSelf ? (
                                <input
                                    value={nameDraft}
                                    onChange={event => setNameDraft(event.target.value)}
                                    onBlur={handleRenameBlur}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') {
                                            event.currentTarget.blur();
                                        }
                                        if (event.key === 'Escape') {
                                            setNameDraft(selfPlayer.name);
                                            event.currentTarget.blur();
                                        }
                                    }}
                                    maxLength={32}
                                    spellCheck={false}
                                />
                            ) : (
                                <strong>{player.name}</strong>
                            )}
                            {!isSelf && (
                                <span>Seat {player.seatIndex + 1}</span>
                            )}
                        </div>
                    );
                })}

                {Array.from({ length: Math.max(0, lobby.requiredSeats - lobby.players.length) }).map((_, index) => (
                    <div key={`empty-${index}`} className="lobby-player">
                        <header>
                            <span>Waiting</span>
                            <span className="ready-badge awaiting">Empty</span>
                        </header>
                        <span>Seat {lobby.players.length + index + 1}</span>
                    </div>
                ))}
            </div>

            <div className="lobby-footer">
                <div className="lobby-actions">
                    <button className="lobby-button" onClick={onLeave}>Leave Lobby</button>
                    <button
                        className="lobby-button"
                        onClick={() => onReadyToggle(!isReady)}
                        disabled={!selfPlayer}
                    >
                        {isReady ? 'Set Not Ready' : 'Ready Up'}
                    </button>
                    <button
                        className="lobby-button primary"
                        onClick={onStart}
                        disabled={!isHost || !everyoneReady}
                    >
                        Start Game
                    </button>
                </div>
                <div className="lobby-info">
                    {fullLobby ? 'All seats filled' : `Waiting for ${lobby.requiredSeats - lobby.players.length} more player(s)`}
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
