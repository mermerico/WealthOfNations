import { useEffect, useState } from 'react';
import './index.css';
import './App.css';
import { Sandbox } from './pages/Sandbox';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { LocalSetup } from './pages/LocalSetup';
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
    lastLobbyCode
  } = useGameEngineContext();

  const [localSetupActive, setLocalSetupActive] = useState(false);
  const [localGameActive, setLocalGameActive] = useState(false);

  useEffect(() => {
    if (mode === 'remote') {
      setLocalSetupActive(false);
      setLocalGameActive(false);
    }
  }, [mode, lobby]);

  const handleEnterLocalSetup = () => {
    setLocalSetupActive(true);
  };

  const handleStartLocalGame = (playerCount: number, playerNames: string[]) => {
    startLocalGame(playerCount, playerNames);
    setLocalSetupActive(false);
    setLocalGameActive(true);
  };

  const handleLeaveLobby = () => {
    leaveLobby();
    setLocalGameActive(false);
  };

  const showLobby = mode === 'remote' && lobby && lobby.phase === 'forming';
  const showRemoteGame = mode === 'remote' && lobby && lobby.phase === 'inGame';
  const showLocalGame = mode === 'local' && localGameActive;
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

  if (localSetupActive) {
    return (
      <LocalSetup
        onStart={handleStartLocalGame}
        onBack={() => setLocalSetupActive(false)}
      />
    );
  }

  return (
    <Landing
      onCreateLobby={() => {
        createLobby();
      }}
      onJoinLobby={(code) => {
        joinLobby(code);
      }}
      onStartLocalGame={handleEnterLocalSetup}
      connectionState={connectionState}
      lastError={lastError}
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
