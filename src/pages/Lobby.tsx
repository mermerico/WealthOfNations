import { useEffect, useState } from 'react';
import type { LobbySnapshot, LobbyPlayer } from '../shared/networkTypes';
import type { GameSettings } from '../types/gameState';

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
    onUpdateSettings: (settings: Partial<GameSettings>) => void;
}

export function Lobby({
    lobby,
    selfPlayer,
    connectionState,
    lastError,
    onLeave,
    onRename,
    onReadyToggle,
    onStart,
    onUpdateSettings
}: LobbyProps) {
    const [nameDraft, setNameDraft] = useState(selfPlayer?.name ?? '');
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

    useEffect(() => {
        setNameDraft(selfPlayer?.name ?? '');
    }, [selfPlayer?.name]);

    const readyCount = lobby.players.filter(player => player.ready).length;
    const everyoneReady = lobby.players.every(p => p.ready);
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
                <div className="lobby-info">
                    {readyCount} ready / {lobby.players.length} joined (Min: {lobby.minSeats}, Max: {lobby.maxSeats}) &bull; Connection: {connectionState}
                </div>
            </div>

            <div className="lobby-list">
                {lobby.players.map(player => {
                    const isSelf = player.clientId === selfPlayer?.clientId;
                    return (
                        <div key={player.clientId} className={`lobby-player-row${isSelf ? ' self' : ''}`}>
                            <div className="player-main">
                                <span className="player-seat">#{player.seatIndex + 1}</span>
                                {isSelf ? (
                                    <input
                                        className="lobby-name-input"
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
                                    <span className="player-name">{player.name}</span>
                                )}
                                {player.isHost && <span className="host-badge">HOST</span>}
                            </div>
                            <div className="player-status">
                                <span className={`ready-badge ${player.ready ? 'ready' : 'awaiting'}`}>
                                    {player.ready ? 'Ready' : 'Not Ready'}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {Array.from({ length: Math.max(0, lobby.maxSeats - lobby.players.length) }).map((_, index) => {
                    const seatIndex = lobby.players.length + index;
                    return (
                        <div key={`empty-${index}`} className="lobby-player-row empty">
                            <div className="player-main">
                                <span className="player-seat">#{seatIndex + 1}</span>
                                <span className="player-name">Waiting...</span>
                            </div>
                            <div className="player-status">
                                <span className="ready-badge empty">Empty</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Game Settings - Host Only */}
            {isHost && (
                <div className="lobby-settings">
                    <h3>Game Settings</h3>
                    <label className="lobby-setting-toggle">
                        <input
                            type="checkbox"
                            checked={lobby.settings?.promissoryNoteInterestFees ?? false}
                            onChange={(e) => onUpdateSettings({ promissoryNoteInterestFees: e.target.checked })}
                        />
                        <span>Promissory Note Interest ($1/note at start of each Trade phase)</span>
                    </label>
                </div>
            )}

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
                        disabled={!isHost || readyCount < lobby.minSeats || !everyoneReady}
                    >
                        Start Game ({readyCount}/{lobby.players.length})
                    </button>
                </div>
                <div className="lobby-info">
                    {readyCount < lobby.minSeats
                        ? `Waiting for at least ${lobby.minSeats - readyCount} more player(s) to ready up`
                        : (readyCount < lobby.maxSeats
                            ? `Ready to start! (Room for ${lobby.maxSeats - readyCount} more)`
                            : 'Lobby full, ready to start!')}
                </div>
            </div>

            {
                lastError && (
                    <div className="landing-error" role="alert">
                        {lastError}
                    </div>
                )
            }
        </div >
    );
}
