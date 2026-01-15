import { useEffect, useState } from 'react';
import './index.css';
import './App.css';
import { Game } from './pages/Game';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { RestoreLobby } from './pages/RestoreLobby';
import { LocalSetup } from './pages/LocalSetup';

import { GameEngineProvider, useGameEngineContext } from './hooks/GameEngineProvider';

import { TradeSandbox } from './pages/TradeSandbox';
import { PlayerAid } from './components/game/PlayerAid';

function AppShell() {
  const {
    clientId,
    mode,
    lobby,
    selfPlayer,
    connectionState,
    lastError,
    disbandedReason,
    startLocalGame,
    startNewGame,
    createLobby,
    joinLobby,
    leaveLobby,
    renamePlayer,
    setReadyState,
    claimSeat,
    unclaimSeat,
    updateSettings,
    lastLobbyCode
  } = useGameEngineContext();

  const [localSetupActive, setLocalSetupActive] = useState(false);
  const [localGameActive, setLocalGameActive] = useState(false);

  // Sandbox Routing
  const [showSandbox, setShowSandbox] = useState(window.location.hash === '#trade-sandbox');
  const [showPlayerAid, setShowPlayerAid] = useState(window.location.hash === '#player-aid');

  useEffect(() => {
    const handleHashChange = () => {
      setShowSandbox(window.location.hash === '#trade-sandbox');
      setShowPlayerAid(window.location.hash === '#player-aid');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  if (showSandbox) {
    return <TradeSandbox />;
  }

  if (showPlayerAid) {
    return <PlayerAid isOpen={true} onClose={() => { }} standalone={true} />;
  }

  const showLobby = mode === 'remote' && lobby && lobby.phase === 'forming';
  const showRestoring = mode === 'remote' && lobby && lobby.phase === 'restoring';
  const showRemoteGame = mode === 'remote' && lobby && lobby.phase === 'inGame';
  const showLocalGame = mode === 'local' && localGameActive;
  const showGame = showRemoteGame || showLocalGame;

  if (showRestoring && lobby) {
    return (
      <RestoreLobby
        lobby={lobby}
        selfPlayer={selfPlayer}
        connectionState={connectionState}
        lastError={lastError}
        clientId={clientId}
        onLeave={handleLeaveLobby}
        onClaimSeat={claimSeat}
        onUnclaimSeat={unclaimSeat}
      />
    );
  }

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
        onUpdateSettings={updateSettings}
      />
    );
  }

  if (showGame) {
    return (
      <Game />
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
      disbandedReason={disbandedReason}
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
