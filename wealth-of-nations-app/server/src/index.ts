import http from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { lobbyManager } from './lobbyManager';
import type {
    ClientMessage,
    LobbyCode,
    LobbyPlayer,
    ServerMessage
} from '../../src/shared/networkTypes';

interface SocketContext {
    socketId: string;
    clientId?: string;
    lobbyCode?: LobbyCode;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

const lobbySockets = new Map<LobbyCode, Set<WebSocket>>();
const clientSockets = new Map<string, WebSocket>();
const socketContexts = new WeakMap<WebSocket, SocketContext>();

function getContext(socket: WebSocket): SocketContext {
    let context = socketContexts.get(socket);
    if (!context) {
        context = { socketId: randomUUID() };
        socketContexts.set(socket, context);
    }
    return context;
}

function parseMessage(data: RawData): ClientMessage | null {
    try {
        const parsed = JSON.parse(data.toString());
        if (parsed && typeof parsed.type === 'string') {
            return parsed as ClientMessage;
        }
    } catch (error) {
        console.error('Failed to parse message', error);
    }
    return null;
}

function send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function sendError(socket: WebSocket, message: string) {
    send(socket, { type: 'error', message });
}

function sendAck(socket: WebSocket, message: string) {
    send(socket, { type: 'ack', message });
}

function sendSession(socket: WebSocket, clientId: string) {
    const lobbyCode = lobbyManager.getLobbyCodeForClient(clientId);
    const lobby = lobbyCode ? lobbyManager.getLobbySnapshot(lobbyCode) : undefined;
    const state = lobbyCode ? lobbyManager.getLobbyState(lobbyCode) ?? undefined : undefined;

    send(socket, {
        type: 'session',
        clientId,
        lobby,
        state
    });
}

function attachSocketToLobby(socket: WebSocket, lobbyCode: LobbyCode) {
    let sockets = lobbySockets.get(lobbyCode);
    if (!sockets) {
        sockets = new Set<WebSocket>();
        lobbySockets.set(lobbyCode, sockets);
    }
    sockets.add(socket);
}

function detachSocketFromLobby(socket: WebSocket, lobbyCode?: LobbyCode) {
    if (!lobbyCode) return;
    const sockets = lobbySockets.get(lobbyCode);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) {
        lobbySockets.delete(lobbyCode);
    }
}

function ensureClientSocket(socket: WebSocket, clientId: string) {
    const existing = clientSockets.get(clientId);
    if (existing && existing !== socket) {
        try {
            existing.close(1000, 'Superseded connection');
        } catch (error) {
            console.warn('Error closing superseded socket', error);
        }
    }
    clientSockets.set(clientId, socket);
}

function lobbyPlayerForClient(snapshotPlayers: LobbyPlayer[], clientId?: string): LobbyPlayer | undefined {
    if (!clientId) return undefined;
    return snapshotPlayers.find(player => player.clientId === clientId);
}

function broadcastLobby(lobbyCode: LobbyCode) {
    if (!lobbyManager.hasLobby(lobbyCode)) return;
    const sockets = lobbySockets.get(lobbyCode);
    if (!sockets || sockets.size === 0) return;

    const snapshot = lobbyManager.getLobbySnapshot(lobbyCode);

    for (const socket of sockets) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        const context = getContext(socket);
        const self = lobbyPlayerForClient(snapshot.players, context.clientId);
        send(socket, { type: 'lobbyUpdate', lobby: snapshot, self });
    }
}

function broadcastState(lobbyCode: LobbyCode) {
    const sockets = lobbySockets.get(lobbyCode);
    if (!sockets || sockets.size === 0) return;
    const state = lobbyManager.getLobbyState(lobbyCode);
    if (!state) return;

    for (const socket of sockets) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        send(socket, { type: 'state', state });
    }
}

wss.on('connection', socket => {
    const context = getContext(socket);
    console.log(`[${new Date().toISOString()}] Client connected: ${context.socketId}`);

    socket.on('message', data => {
        const message = parseMessage(data);
        if (!message) {
            sendError(socket, 'Invalid message');
            return;
        }
        console.log(`[${new Date().toISOString()}] Received ${message.type} from ${context.socketId}`);

        try {
            switch (message.type) {
                case 'createLobby': {
                    const { clientId, name } = message;
                    if (!clientId) {
                        throw new Error('Missing clientId');
                    }

                    ensureClientSocket(socket, clientId);

                    const previousLobby = context.lobbyCode;
                    if (previousLobby) {
                        detachSocketFromLobby(socket, previousLobby);
                    }

                    const lifecycle = lobbyManager.createLobby(clientId, name || '');
                    context.clientId = clientId;
                    context.lobbyCode = lifecycle.lobby.code;

                    attachSocketToLobby(socket, lifecycle.lobby.code);
                    lobbyManager.markConnection(clientId, true, context.socketId);
                    sendSession(socket, clientId);
                    broadcastLobby(lifecycle.lobby.code);
                    break;
                }

                case 'joinLobby': {
                    const { clientId, code, name } = message;
                    if (!clientId) {
                        throw new Error('Missing clientId');
                    }
                    if (!code) {
                        throw new Error('Missing lobby code');
                    }

                    ensureClientSocket(socket, clientId);

                    const normalizedCode = code.trim().toUpperCase();
                    const currentLobby = context.lobbyCode;
                    if (currentLobby && currentLobby !== normalizedCode) {
                        detachSocketFromLobby(socket, currentLobby);
                    }

                    const lifecycle = lobbyManager.joinLobby(clientId, normalizedCode, name || '');
                    context.clientId = clientId;
                    context.lobbyCode = normalizedCode;

                    attachSocketToLobby(socket, normalizedCode);
                    lobbyManager.markConnection(clientId, true, context.socketId);
                    sendSession(socket, clientId);
                    broadcastLobby(normalizedCode);
                    if (lifecycle.lobby.phase === 'inGame') {
                        broadcastState(normalizedCode);
                    }
                    break;
                }

                case 'leaveLobby': {
                    const { clientId } = message;
                    if (!clientId || context.clientId !== clientId) {
                        throw new Error('Cannot leave without an active session');
                    }
                    const lobbyCode = context.lobbyCode;
                    lobbyManager.leaveLobby(clientId);
                    if (lobbyCode) {
                        detachSocketFromLobby(socket, lobbyCode);
                        broadcastLobby(lobbyCode);
                    }
                    context.lobbyCode = undefined;
                    sendAck(socket, 'Left lobby');
                    break;
                }

                case 'renamePlayer': {
                    const { clientId, name } = message;
                    if (!clientId || context.clientId !== clientId) {
                        throw new Error('Rename denied');
                    }
                    if (!name) {
                        throw new Error('Name cannot be empty');
                    }
                    const lobby = lobbyManager.renamePlayer(clientId, name);
                    broadcastLobby(lobby.code);
                    sendAck(socket, 'Name updated');
                    break;
                }

                case 'setReady': {
                    const { clientId, ready } = message;
                    if (!clientId || context.clientId !== clientId) {
                        throw new Error('Ready toggle denied');
                    }
                    const lobby = lobbyManager.setReady(clientId, ready);
                    broadcastLobby(lobby.code);
                    break;
                }

                case 'startGame': {
                    const { clientId } = message;
                    if (!clientId || context.clientId !== clientId) {
                        throw new Error('Start denied');
                    }
                    const lobbyCode = context.lobbyCode;
                    if (!lobbyCode) {
                        throw new Error('No lobby selected');
                    }
                    lobbyManager.startGame(clientId);
                    broadcastLobby(lobbyCode);
                    broadcastState(lobbyCode);
                    sendAck(socket, 'Game started');
                    break;
                }

                case 'rematch': {
                    const { clientId } = message;
                    if (!clientId || context.clientId !== clientId) {
                        throw new Error('Rematch denied');
                    }
                    const lobby = lobbyManager.rematch(clientId);
                    broadcastLobby(lobby.code);
                    sendAck(socket, 'Rematch ready');
                    break;
                }

                case 'gameAction': {
                    const { clientId, action, payload } = message;
                    if (!clientId || context.clientId !== clientId) {
                        throw new Error('Action denied');
                    }
                    const lobbyCode = context.lobbyCode;
                    if (!lobbyCode) {
                        throw new Error('No lobby selected');
                    }
                    const result = lobbyManager.applyAction(clientId, action, payload);
                    if (!result.success) {
                        sendError(socket, result.message || 'Action rejected');
                        return;
                    }
                    broadcastState(lobbyCode);
                    break;
                }

                case 'ping': {
                    sendAck(socket, 'pong');
                    break;
                }

                default: {
                    throw new Error('Unsupported message type');
                }
            }
        } catch (error) {
            console.error('Failed to process message', error);
            const reason = error instanceof Error ? error.message : 'Unexpected error';
            sendError(socket, reason);
        }
    });

    socket.on('close', () => {
        const { clientId, lobbyCode, socketId } = getContext(socket);
        console.log(`[${new Date().toISOString()}] Client disconnected: ${socketId} (clientId: ${clientId || 'none'})`);
        if (clientId) {
            const tracked = clientSockets.get(clientId);
            if (tracked === socket) {
                clientSockets.delete(clientId);
            }
            lobbyManager.markConnection(clientId, false);
        }
        if (lobbyCode) {
            detachSocketFromLobby(socket, lobbyCode);
            broadcastLobby(lobbyCode);
        }
    });

    socket.on('error', error => {
        console.error('Socket error', error);
    });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    if (!address) {
        console.log(`Server listening on port ${port}`);
        return;
    }
    console.log(`Server listening on ${address.address}:${address.port}`);
});
