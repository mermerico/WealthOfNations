import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, GameSettings } from '../types/gameState';
import { createInitialGameState, applyGameAction } from '../shared/gameEngine';
import type { LobbySnapshot, LobbyPlayer, ClientMessage, ServerMessage } from '../shared/networkTypes';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';
type EngineMode = 'local' | 'remote';

const CLIENT_ID_STORAGE_KEY = 'won-client-id';
const LAST_LOBBY_STORAGE_KEY = 'won-lobby-code';
const LAST_NAME_STORAGE_KEY = 'won-player-name';

function resolveDefaultServerUrl(): string {
    const envUrl = import.meta.env.VITE_GAME_SERVER_URL;
    if (envUrl) {
        return envUrl;
    }

    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
        const { protocol, hostname } = window.location;
        const scheme = protocol === 'https:' ? 'wss' : 'ws';
        return `${scheme}://${hostname}:4000`;
    }

    return 'ws://localhost:4000';
}

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

function createClientId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `client-${crypto.randomUUID()}`;
    }
    return `client-${Math.random().toString(36).slice(2)}`;
}

function getStorageItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setStorageItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Swallow storage errors silently
    }
}

function removeStorageItem(key: string) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Ignore storage errors
    }
}

function getPersistentClientId(): string {
    const stored = getStorageItem(CLIENT_ID_STORAGE_KEY);
    if (stored) {
        return stored;
    }
    const generated = createClientId();
    setStorageItem(CLIENT_ID_STORAGE_KEY, generated);
    return generated;
}

function parseServerMessage(raw: MessageEvent['data']): ServerMessage | null {
    const text = typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && 'toString' in raw
            ? raw.toString()
            : '';

    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.type === 'string') {
            return parsed as ServerMessage;
        }
    } catch (error) {
        console.error('Failed to parse server message', error);
    }
    return null;
}

export function useGameEngine() {
    const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [lastError, setLastError] = useState<string | null>(null);
    const [mode, setMode] = useState<EngineMode>('local');
    const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
    const [selfPlayer, setSelfPlayer] = useState<LobbyPlayer | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [disbandedReason, setDisbandedReason] = useState<string | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const clientIdRef = useRef<string>(getPersistentClientId());
    const lastLobbyCodeRef = useRef<string | null>(getStorageItem(LAST_LOBBY_STORAGE_KEY));
    const lastPlayerNameRef = useRef<string | null>(getStorageItem(LAST_NAME_STORAGE_KEY));

    const sendMessage = useCallback((message: ClientMessage) => {
        const socket = socketRef.current;
        console.log('[sendMessage] Attempting to send', message.type, 'socket:', socket ? `readyState=${socket.readyState}` : 'null');
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.log('[sendMessage] Failed - socket not ready');
            setConnectionState('disconnected');
            setLastError('Not connected to server');
            return false;
        }

        try {
            socket.send(JSON.stringify(message));
            console.log('[sendMessage] Message sent successfully');
            return true;
        } catch (error) {
            console.error('Failed to send message', error);
            setLastError('Failed to send message');
            return false;
        }
    }, []);

    useEffect(() => {
        // Track if effect is still mounted to prevent state updates after cleanup
        let isMounted = true;

        setConnectionState('connecting');
        setLastError(null);

        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
            setConnectionState('disconnected');
            setLastError('WebSocket not supported in this environment');
            return () => { isMounted = false; };
        }

        const socket = new WebSocket(DEFAULT_SERVER_URL);
        socketRef.current = socket;

        console.log('[useGameEngine] Attempting WebSocket connection to', DEFAULT_SERVER_URL);

        socket.onopen = () => {
            if (!isMounted) {
                console.log('[useGameEngine] WebSocket opened but effect unmounted, closing');
                socket.close();
                return;
            }
            console.log('[useGameEngine] WebSocket connected successfully');
            setConnectionState('connected');
            setLastError(null);

            const lobbyCode = lastLobbyCodeRef.current;
            if (lobbyCode) {
                sendMessage({
                    type: 'joinLobby',
                    clientId: clientIdRef.current,
                    code: lobbyCode,
                    name: lastPlayerNameRef.current || ''
                });
            }
        };

        socket.onmessage = event => {
            if (!isMounted) return;

            const message = parseServerMessage(event.data);
            if (!message) {
                setLastError('Failed to process server message');
                return;
            }

            switch (message.type) {
                case 'session': {
                    if (message.clientId && message.clientId !== clientIdRef.current) {
                        clientIdRef.current = message.clientId;
                        setStorageItem(CLIENT_ID_STORAGE_KEY, message.clientId);
                    }

                    if (message.lobby) {
                        setLobby(message.lobby);
                        setMode('remote');
                        lastLobbyCodeRef.current = message.lobby.code;
                        setStorageItem(LAST_LOBBY_STORAGE_KEY, message.lobby.code);
                    } else {
                        setLobby(null);
                        setSelfPlayer(null);
                        lastLobbyCodeRef.current = null;
                        removeStorageItem(LAST_LOBBY_STORAGE_KEY);
                        if (mode === 'remote') {
                            setMode('local');
                        }
                    }

                    if (message.state) {
                        setGameState(message.state);
                        setMode('remote');
                    }

                    break;
                }

                case 'lobbyUpdate': {
                    setLobby(message.lobby);
                    setMode('remote');
                    lastLobbyCodeRef.current = message.lobby.code;
                    setStorageItem(LAST_LOBBY_STORAGE_KEY, message.lobby.code);

                    if (message.self) {
                        setSelfPlayer(message.self);
                        lastPlayerNameRef.current = message.self.name;
                        setStorageItem(LAST_NAME_STORAGE_KEY, message.self.name);
                    } else {
                        setSelfPlayer(null);
                    }
                    break;
                }

                case 'state': {
                    setGameState(message.state);
                    setMode('remote');
                    break;
                }

                case 'error': {
                    setLastError(message.message);
                    break;
                }

                case 'ack': {
                    setLastError(null);
                    break;
                }

                case 'gameSaved': {
                    // Show success message for 3 seconds
                    setSaveSuccess('Game saved successfully!');
                    setTimeout(() => setSaveSuccess(null), 3000);
                    setLastError(null);
                    break;
                }

                case 'lobbyDisbanded': {
                    // Another player left during game - kicked back to landing
                    const disbandedMsg = message as { type: 'lobbyDisbanded'; reason: string };
                    console.log('[useGameEngine] Lobby disbanded:', disbandedMsg.reason);
                    setDisbandedReason(disbandedMsg.reason);
                    setLobby(null);
                    setSelfPlayer(null);
                    setMode('local');
                    setGameState(createInitialGameState());
                    removeStorageItem(LAST_LOBBY_STORAGE_KEY);
                    // Clear the reason after 5 seconds
                    setTimeout(() => setDisbandedReason(null), 5000);
                    break;
                }

                default:
                    break;
            }
        };

        socket.onerror = event => {
            if (!isMounted) return;
            console.error('WebSocket error', event);
            console.log('[useGameEngine] Socket readyState:', socket.readyState);
            setConnectionState('disconnected');
            setLastError('Connection error');
        };

        socket.onclose = () => {
            if (!isMounted) return;
            console.log('[useGameEngine] WebSocket closed');
            setConnectionState('disconnected');
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };

        return () => {
            console.log('[useGameEngine] Cleanup called, closing WebSocket');
            isMounted = false;
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
            // Only close if the socket was opened or is connecting
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
        };
    }, []);

    const handleAction = useCallback((action: string, payload?: unknown) => {
        if (mode === 'remote' && lobby?.phase === 'inGame') {
            const success = sendMessage({
                type: 'gameAction',
                clientId: clientIdRef.current,
                action,
                payload
            });
            if (!success) {
                setLastError('Action failed: disconnected');
            }
            return;
        }

        setGameState(prev => {
            const result = applyGameAction(prev, action, payload);
            if (!result.success || !result.newState) {
                setLastError(result.message ?? 'Action rejected');
                return prev;
            }
            setLastError(null);
            return result.newState;
        });
    }, [lobby, mode, sendMessage]);

    const startLocalGame = useCallback((playerCount: number = 3, playerNames?: string[]) => {
        setMode('local');
        setLobby(null);
        setSelfPlayer(null);
        lastLobbyCodeRef.current = null;
        removeStorageItem(LAST_LOBBY_STORAGE_KEY);
        setGameState(createInitialGameState({ playerCount, playerNames }));
    }, []);

    const startNewGame = useCallback(() => {
        if (mode === 'remote' && lobby) {
            sendMessage({
                type: 'startGame',
                clientId: clientIdRef.current
            });
            return;
        }
        startLocalGame();
    }, [lobby, mode, sendMessage, startLocalGame]);

    const requestRematch = useCallback(() => {
        if (mode === 'remote' && lobby) {
            sendMessage({
                type: 'rematch',
                clientId: clientIdRef.current
            });
            return;
        }
        startLocalGame();
    }, [lobby, mode, sendMessage, startLocalGame]);

    const createLobby = useCallback((name?: string) => {
        const trimmed = (name || lastPlayerNameRef.current || '').trim() || 'Player';

        const success = sendMessage({
            type: 'createLobby',
            clientId: clientIdRef.current,
            name: trimmed
        });

        if (success) {
            lastPlayerNameRef.current = trimmed;
            setStorageItem(LAST_NAME_STORAGE_KEY, trimmed);
            setMode('remote');
        }

        return success;
    }, [sendMessage]);

    const joinLobby = useCallback((code: string, name?: string) => {
        const formattedCode = code.trim().toUpperCase();
        const trimmedName = (name || lastPlayerNameRef.current || '').trim() || 'Player';

        if (!formattedCode) {
            setLastError('Lobby code is required');
            return false;
        }

        const success = sendMessage({
            type: 'joinLobby',
            clientId: clientIdRef.current,
            code: formattedCode,
            name: trimmedName
        });

        if (success) {
            lastPlayerNameRef.current = trimmedName;
            setStorageItem(LAST_NAME_STORAGE_KEY, trimmedName);
            setMode('remote');
        }

        return success;
    }, [sendMessage]);

    const leaveLobby = useCallback(() => {
        if (mode !== 'remote' || !lobby) {
            return true;
        }

        const success = sendMessage({
            type: 'leaveLobby',
            clientId: clientIdRef.current
        });

        if (success) {
            startLocalGame();
        }

        return success;
    }, [lobby, mode, sendMessage, startLocalGame]);

    const renamePlayer = useCallback((name: string) => {
        const trimmed = name.trim();
        if (!trimmed) {
            setLastError('Name cannot be empty');
            return false;
        }

        if (mode === 'remote') {
            const success = sendMessage({
                type: 'renamePlayer',
                clientId: clientIdRef.current,
                name: trimmed
            });

            if (success) {
                lastPlayerNameRef.current = trimmed;
                setStorageItem(LAST_NAME_STORAGE_KEY, trimmed);
            }

            return success;
        }

        setGameState(prev => ({
            ...prev,
            players: prev.players.map((player, index) =>
                index === 0 ? { ...player, name: trimmed } : player
            )
        }));
        return true;
    }, [mode, sendMessage]);

    const setReadyState = useCallback((ready: boolean) => {
        if (mode !== 'remote') {
            return false;
        }

        return sendMessage({
            type: 'setReady',
            clientId: clientIdRef.current,
            ready
        });
    }, [mode, sendMessage]);

    const saveGame = useCallback(() => {
        if (mode !== 'remote' || !lobby || lobby.phase !== 'inGame') {
            setLastError('No active game to save');
            return false;
        }

        return sendMessage({
            type: 'saveGame',
            clientId: clientIdRef.current
        });
    }, [lobby, mode, sendMessage]);

    const claimSeat = useCallback((seatIndex: number) => {
        if (mode !== 'remote' || !lobby || lobby.phase !== 'restoring') {
            setLastError('Not in a restoring lobby');
            return false;
        }

        return sendMessage({
            type: 'claimSeat',
            clientId: clientIdRef.current,
            seatIndex
        });
    }, [lobby, mode, sendMessage]);

    const unclaimSeat = useCallback(() => {
        if (mode !== 'remote' || !lobby || lobby.phase !== 'restoring') {
            setLastError('Not in a restoring lobby');
            return false;
        }

        return sendMessage({
            type: 'unclaimSeat',
            clientId: clientIdRef.current
        });
    }, [lobby, mode, sendMessage]);

    const updateSettings = useCallback((settings: Partial<GameSettings>) => {
        if (mode !== 'remote' || !lobby || lobby.phase !== 'forming') {
            return false;
        }

        return sendMessage({
            type: 'updateSettings',
            clientId: clientIdRef.current,
            settings
        });
    }, [lobby, mode, sendMessage]);

    const playerCount = lobby ? lobby.players.length : gameState.players.length;

    return {
        clientId: clientIdRef.current,
        mode,
        lobby,
        selfPlayer,
        gameState,
        handleAction,
        startNewGame,
        requestRematch,
        startLocalGame,
        createLobby,
        joinLobby,
        leaveLobby,
        renamePlayer,
        setReadyState,
        saveGame,
        claimSeat,
        unclaimSeat,
        updateSettings,
        connectionState,
        lastError,
        saveSuccess,
        disbandedReason,
        playerCount,
        lastUsedName: lastPlayerNameRef.current || '',
        lastLobbyCode: lastLobbyCodeRef.current
    };
}
