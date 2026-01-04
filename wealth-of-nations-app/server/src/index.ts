import http from 'http';
import { AddressInfo } from 'net';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { GameState } from '../../src/types/gameState';
import { createInitialGameState, applyGameAction } from '../../src/shared/gameEngine';

interface GameRoom {
    state: GameState;
    clients: Set<WebSocket>;
    playerIds: Map<WebSocket, string>;
}

interface JoinMessage {
    type: 'join';
    playerId: string;
}

interface ActionMessage {
    type: 'action';
    playerId: string;
    action: string;
    payload?: unknown;
}

interface StartGameMessage {
    type: 'startGame';
    playerId: string;
}

interface PingMessage {
    type: 'ping';
}

type ClientMessage = JoinMessage | ActionMessage | StartGameMessage | PingMessage;

type SocketContext = {
    playerId: string;
} | null;

const room: GameRoom = {
    state: createInitialGameState(),
    clients: new Set(),
    playerIds: new Map()
};

function getUniquePlayerCount(): number {
    return new Set(room.playerIds.values()).size;
}

function broadcastState() {
    const payload = JSON.stringify({
        type: 'state',
        state: room.state
    });

    for (const client of room.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

function broadcastRoomInfo(target?: WebSocket) {
    const payload = JSON.stringify({
        type: 'roomInfo',
        playerCount: getUniquePlayerCount()
    });

    if (target) {
        if (target.readyState === WebSocket.OPEN) {
            target.send(payload);
        }
        return;
    }

    for (const client of room.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

function sendError(socket: WebSocket, message: string) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'error', message }));
    }
}

function sendAck(socket: WebSocket, message: string) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ack', message }));
    }
}

function safeParseMessage(data: RawData): ClientMessage | null {
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

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', socket => {
    let context: SocketContext = null;

    socket.on('message', data => {
        const message = safeParseMessage(data);
        if (!message) {
            sendError(socket, 'Invalid message');
            return;
        }

        switch (message.type) {
            case 'join': {
                const { playerId } = message;
                if (!playerId) {
                    sendError(socket, 'Missing playerId');
                    return;
                }

                room.clients.add(socket);
                room.playerIds.set(socket, playerId);
                // Remove any stale sockets for this playerId
                for (const [client, id] of room.playerIds.entries()) {
                    if (client !== socket && id === playerId) {
                        room.playerIds.delete(client);
                        room.clients.delete(client);
                        try {
                            client.close(1000, 'Superseded connection');
                        } catch (error) {
                            console.warn('Error closing superseded socket', error);
                        }
                    }
                }
                context = { playerId };
                sendAck(socket, 'Joined game room');
                broadcastRoomInfo();
                socket.send(JSON.stringify({ type: 'state', state: room.state }));
                break;
            }

            case 'action': {
                if (!context) {
                    sendError(socket, 'Must join a room before sending actions');
                    return;
                }

                if (message.playerId !== context.playerId) {
                    sendError(socket, 'Player mismatch for this connection');
                    return;
                }

                const result = applyGameAction(room.state, message.action, message.payload);

                if (!result.success || !result.newState) {
                    sendError(socket, result.message || 'Action rejected');
                    return;
                }

                room.state = result.newState;
                broadcastState();
                break;
            }

            case 'startGame': {
                if (!context) {
                    sendError(socket, 'Must join a room before starting a game');
                    return;
                }

                if (message.playerId !== context.playerId) {
                    sendError(socket, 'Player mismatch for this connection');
                    return;
                }

                room.state = createInitialGameState();
                sendAck(socket, 'New game started');
                broadcastState();
                broadcastRoomInfo();
                break;
            }

            case 'ping': {
                sendAck(socket, 'pong');
                break;
            }

            default: {
                sendError(socket, 'Unsupported message type');
            }
        }
    });

    socket.on('close', () => {
        if (!context) {
            return;
        }

        room.clients.delete(socket);
        room.playerIds.delete(socket);
        broadcastRoomInfo();
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
