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
    lastUsedName,
    lastLobbyCode
  } = useGameEngineContext();

  const [localActive, setLocalActive] = useState(false);

  useEffect(() => {
    if (mode === 'remote') {
      setLocalActive(false);
    }
  }, [mode, lobby]);

  const handleStartLocalGame = (playerCount: number) => {
    startLocalGame(playerCount);
    setLocalActive(true);
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
    return (
      <Sandbox />
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
