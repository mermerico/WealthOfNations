import { useEffect, useState } from 'react';

type ConnectionLabel = 'connecting' | 'connected' | 'disconnected';

interface LandingProps {
    onCreateLobby: () => void;
    onJoinLobby: (code: string) => void;
    onStartLocalGame: () => void;
    connectionState: ConnectionLabel;
    lastError: string | null;
    recentLobbyCode: string | null;
}

export function Landing({
    onCreateLobby,
    onJoinLobby,
    onStartLocalGame,
    connectionState,
    lastError,
    recentLobbyCode
}: LandingProps) {
    const [code, setCode] = useState('');

    useEffect(() => {
        if (recentLobbyCode && !code) {
            setCode(recentLobbyCode);
        }
    }, [recentLobbyCode, code]);

    const isConnected = connectionState === 'connected';
    const hasRecentLobby = Boolean(recentLobbyCode && recentLobbyCode.length === 5);

    const handleCreate = () => {
        onCreateLobby();
    };

    const handleJoin = () => {
        if (!code.trim()) return;
        onJoinLobby(code.trim());
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
        onJoinLobby(recentLobbyCode!);
    };

    return (
        <div className="landing-container">
            <div className="landing-card">
                <h1 className="landing-title">Wealth of Nations</h1>
                <p className="landing-subtitle">Choose how you want to play</p>

                <div className="landing-actions">
                    <button
                        className="landing-button primary"
                        onClick={handleCreate}
                        disabled={!isConnected}
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
                            disabled={!isConnected || code.trim().length !== 5}
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
                                disabled={!isConnected}
                            >
                                Rejoin Lobby
                            </button>
                        </div>
                    )}

                    <div className="landing-divider">
                        <span>or</span>
                    </div>

                    <div className="local-game-options">
                        <button
                            className="landing-button"
                            onClick={onStartLocalGame}
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
