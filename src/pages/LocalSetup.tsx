import { useState } from 'react';
import '../App.css';

interface LocalSetupProps {
    onStart: (playerCount: number, playerNames: string[]) => void;
    onBack: () => void;
}

export function LocalSetup({ onStart, onBack }: LocalSetupProps) {
    const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3']);

    const handleNameChange = (index: number, value: string) => {
        const newNames = [...playerNames];
        newNames[index] = value;
        setPlayerNames(newNames);
    };

    const handleAddPlayer = () => {
        if (playerNames.length < 6) {
            setPlayerNames([...playerNames, `Player ${playerNames.length + 1}`]);
        }
    };

    const handleRemovePlayer = (index: number) => {
        if (playerNames.length > 3) {
            const newNames = playerNames.filter((_, i) => i !== index);
            setPlayerNames(newNames);
        }
    };

    const handleStart = () => {
        onStart(playerNames.length, playerNames);
    };

    return (
        <div className="landing-container">
            <div className="landing-card">
                <h1 className="landing-title">Local Game Setup</h1>

                <div className="local-setup-section">
                    <div className="section-header">
                        <label className="landing-label">Players</label>
                        <button
                            className="count-button add-player"
                            onClick={handleAddPlayer}
                            disabled={playerNames.length >= 6}
                            title="Add Player"
                        >
                            +
                        </button>
                    </div>

                    <div className="player-name-list">
                        {playerNames.map((name, index) => (
                            <div key={index} className="player-name-input-group">
                                <input
                                    className="landing-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => handleNameChange(index, e.target.value)}
                                    placeholder={`Player ${index + 1}`}
                                />
                                <button
                                    className="count-button remove-player"
                                    onClick={() => handleRemovePlayer(index)}
                                    disabled={playerNames.length <= 3}
                                    title="Remove Player"
                                >
                                    −
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="landing-actions">
                    <button className="landing-button primary" onClick={handleStart}>
                        Start Game
                    </button>
                    <button className="landing-button" onClick={onBack}>
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
