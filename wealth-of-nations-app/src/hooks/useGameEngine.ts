import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState } from '../types/gameState';
import { createInitialGameState, applyGameAction } from '../shared/gameEngine';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const DEFAULT_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:4000';

function createClientId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `client-${crypto.randomUUID()}`;
    }
    return `client-${Math.random().toString(36).slice(2)}`;
}

export function useGameEngine() {
    const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [lastError, setLastError] = useState<string | null>(null);
    const [playerCount, setPlayerCount] = useState<number>(1);
    const socketRef = useRef<WebSocket | null>(null);
    const playerIdRef = useRef<string>(createClientId());

    useEffect(() => {
        setConnectionState('connecting');
        setLastError(null);

        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
            setConnectionState('disconnected');
            setPlayerCount(1);
            setLastError('WebSocket not supported in this environment');
            return () => undefined;
        }

        const socket = new WebSocket(DEFAULT_SERVER_URL);
        socketRef.current = socket;

        socket.onopen = () => {
            setConnectionState('connected');
            socket.send(JSON.stringify({
                type: 'join',
                playerId: playerIdRef.current
            }));
        };

        socket.onmessage = event => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'state':
                        if (data.state) {
                            setGameState(data.state as GameState);
                            setLastError(null);
                        }
                        break;
                    case 'roomInfo':
                        if (typeof data.playerCount === 'number') {
                            setPlayerCount(Math.max(1, data.playerCount));
                        }
                        break;
                    case 'error':
                        if (typeof data.message === 'string') {
                            setLastError(data.message);
                        }
                        break;
                    case 'ack':
                        setLastError(null);
                        break;
                    default:
                        break;
                }
            } catch (error) {
                console.error('Failed to process server message', error);
                setLastError('Failed to process server message');
            }
        };

        socket.onerror = event => {
            console.error('WebSocket error', event);
            setConnectionState('disconnected');
            setPlayerCount(1);
            setLastError('Connection error');
        };

        socket.onclose = () => {
            setConnectionState('disconnected');
            setPlayerCount(1);
        };

        return () => {
            socketRef.current = null;
            socket.close();
        };
    }, []);

    const handleAction = useCallback((action: string, payload?: any) => {
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'action',
                playerId: playerIdRef.current,
                action,
                payload
            }));
            return;
        }

        setConnectionState('disconnected');
        setPlayerCount(1);
        setGameState(prev => {
            const result = applyGameAction(prev, action, payload);
            if (!result.success || !result.newState) {
                setLastError(result.message ?? 'Action rejected');
                return prev;
            }
            return result.newState;
        });
    }, []);

    const startNewGame = useCallback(() => {
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'startGame',
                playerId: playerIdRef.current
            }));
            return;
        }

        setConnectionState('disconnected');
        setPlayerCount(1);
        setLastError(null);
        setGameState(createInitialGameState());
    }, []);

    return {
        gameState,
        handleAction,
        startNewGame,
        connectionState,
        lastError,
        playerCount
    };
}
