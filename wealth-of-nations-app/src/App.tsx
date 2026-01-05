import { useEffect, useState } from 'react';
import './index.css';
import './App.css';
import { Sandbox } from './pages/Sandbox';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { GameEngineProvider, useGameEngineContext } from './hooks/GameEngineProvider';

function AppShell() {
  const {
    mode,
    lobby,
    selfPlayer,
    connectionState,
    lastError,
    startLocalGame,
    startNewGame,
    createLobby,
    joinLobby,
    leaveLobby,
    renamePlayer,
    setReadyState,
    playerCount,
    lastUsedName,
    lastLobbyCode
  } = useGameEngineContext();

  const [localActive, setLocalActive] = useState(false);

  useEffect(() => {
    if (mode === 'remote') {
      setLocalActive(false);
    }
  }, [mode, lobby]);

  const handleStartLocalGame = () => {
    startLocalGame();
    setLocalActive(true);
  };

  const handleExitLocalGame = () => {
    startLocalGame();
    setLocalActive(false);
  };

  const handleLeaveLobby = () => {
    leaveLobby();
    setLocalActive(false);
  };

  const showLobby = mode === 'remote' && lobby && lobby.phase === 'forming';
  const showRemoteGame = mode === 'remote' && lobby && lobby.phase === 'inGame';
  const showLocalGame = mode === 'local' && localActive;
  const showGame = showRemoteGame || showLocalGame;

  if (showLobby && lobby) {
    return (
      <Lobby
        lobby={lobby}
        selfPlayer={selfPlayer}
        connectionState={connectionState}
        lastError={lastError}
        onLeave={handleLeaveLobby}
        onRename={name => {
          renamePlayer(name);
        }}
        onReadyToggle={ready => {
          setReadyState(ready);
        }}
        onStart={startNewGame}
      />
    );
  }

  if (showGame) {
    const lobbyCode = lobby?.code;
    return (
      <div className="game-shell">
        <header className="game-header">
          {showRemoteGame && lobbyCode ? (
            <span>
              <span className="code-pill">{lobbyCode}</span>
              Online Game ({playerCount} players)
            </span>
          ) : (
            <span>Local Hotseat Game</span>
          )}
          <div>
            {showRemoteGame ? (
              <button onClick={handleLeaveLobby}>Leave Game</button>
            ) : (
              <button onClick={handleExitLocalGame}>Return to Menu</button>
            )}
          </div>
        </header>
        <div className="game-container">
          <Sandbox />
        </div>
      </div>
    );
  }

  return (
    <Landing
      onCreateLobby={name => {
        createLobby(name);
      }}
      onJoinLobby={(code, name) => {
        joinLobby(code, name);
      }}
      onStartLocalGame={handleStartLocalGame}
      connectionState={connectionState}
      lastError={lastError}
      defaultName={lastUsedName}
      recentLobbyCode={lastLobbyCode}
    />
  );
}

function App() {
  return (
    <GameEngineProvider>
      <AppShell />
    </GameEngineProvider>
  );
}

export default App;
