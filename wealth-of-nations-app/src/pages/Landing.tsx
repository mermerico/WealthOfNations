import { useEffect, useState } from 'react';

type ConnectionLabel = 'connecting' | 'connected' | 'disconnected';

interface LandingProps {
    onCreateLobby: (name: string) => void;
    onJoinLobby: (code: string, name: string) => void;
    onStartLocalGame: (playerCount: number) => void;
    connectionState: ConnectionLabel;
    lastError: string | null;
    defaultName: string;
    recentLobbyCode: string | null;
}

export function Landing({
    onCreateLobby,
    onJoinLobby,
    onStartLocalGame,
    connectionState,
    lastError,
    defaultName,
    recentLobbyCode
}: LandingProps) {
    const [name, setName] = useState(defaultName);
    const [code, setCode] = useState('');
    const [localPlayerCount, setLocalPlayerCount] = useState(3);

    useEffect(() => {
        setName(defaultName);
    }, [defaultName]);

    useEffect(() => {
        if (recentLobbyCode && !code) {
            setCode(recentLobbyCode);
        }
    }, [recentLobbyCode, code]);

    const isConnected = connectionState === 'connected';
    const hasRecentLobby = Boolean(recentLobbyCode && recentLobbyCode.length === 5);

    const handleCreate = () => {
        if (!name.trim()) return;
        onCreateLobby(name.trim());
    };

    const handleJoin = () => {
        if (!name.trim() || !code.trim()) return;
        onJoinLobby(code.trim(), name.trim());
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>, kind: 'create' | 'join') => {
        if (event.key === 'Enter') {
            if (kind === 'create') {
                handleCreate();
            } else {
                handleJoin();
            }
        }
    };

    const handleRejoin = () => {
        if (!hasRecentLobby) return;
        if (!name.trim()) return;
        onJoinLobby(recentLobbyCode!, name.trim());
    };

    return (
        <div className="landing-container">
            <div className="landing-card">
                <h1 className="landing-title">Wealth of Nations</h1>
                <p className="landing-subtitle">Choose how you want to play</p>

                <div className="landing-name-section">
                    <label className="landing-label" htmlFor="player-name">Display Name</label>
                    <input
                        id="player-name"
                        className="landing-input"
                        type="text"
                        value={name}
                        placeholder="Player Name"
                        onChange={event => setName(event.target.value)}
                        onKeyDown={event => handleKeyPress(event, 'create')}
                        spellCheck={false}
                    />
                </div>

                <div className="landing-actions">
                    <button
                        className="landing-button primary"
                        onClick={handleCreate}
                        disabled={!isConnected || !name.trim()}
                    >
                        Create Online Game
                    </button>

                    <div className="landing-divider">
                        <span>or</span>
                    </div>

                    <div className="landing-join">
                        <label className="landing-label" htmlFor="lobby-code">Join Code</label>
                        <input
                            id="lobby-code"
                            className="landing-input"
                            type="text"
                            value={code}
                            placeholder="ABCDE"
                            onChange={event => setCode(event.target.value.toUpperCase())}
                            onKeyDown={event => handleKeyPress(event, 'join')}
                            spellCheck={false}
                            maxLength={5}
                        />
                        <button
                            className="landing-button"
                            onClick={handleJoin}
                            disabled={!isConnected || !name.trim() || code.trim().length !== 5}
                        >
                            Join Online Game
                        </button>
                    </div>

                    {hasRecentLobby && (
                        <div className="landing-rejoin">
                            <div className="rejoin-details">
                                <span className="rejoin-label">Recent Lobby</span>
                                <span className="rejoin-code">{recentLobbyCode}</span>
                            </div>
                            <button
                                className="landing-button"
                                onClick={handleRejoin}
                                disabled={!isConnected || !name.trim()}
                            >
                                Rejoin Lobby
                            </button>
                        </div>
                    )}

                    <div className="landing-divider">
                        <span>or</span>
                    </div>

                    <div className="local-game-options">
                        <select
                            className="landing-select"
                            value={localPlayerCount}
                            onChange={e => setLocalPlayerCount(Number(e.target.value))}
                        >
                            <option value={3}>3 Players</option>
                            <option value={4}>4 Players</option>
                            <option value={5}>5 Players</option>
                            <option value={6}>6 Players</option>
                        </select>
                        <button
                            className="landing-button"
                            onClick={() => onStartLocalGame(localPlayerCount)}
                        >
                            Local Hotseat Game
                        </button>
                    </div>
                </div>

                <div className="landing-status">
                    <span className={`status-dot ${connectionState}`}></span>
                    <span className="status-text">{connectionState === 'connected' ? 'Online services available' : connectionState === 'connecting' ? 'Connecting…' : 'Offline'}</span>
                </div>

                {lastError && (
                    <div className="landing-error" role="alert">
                        {lastError}
                    </div>
                )}
            </div>
        </div>
    );
}
