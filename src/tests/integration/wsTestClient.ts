import WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from '../../shared/networkTypes';

/**
 * A minimal WebSocket client for integration tests.
 * Provides typed send/receive methods and promise-based waiting.
 */
export class WsTestClient {
    private ws: WebSocket | null = null;
    private messageQueue: ServerMessage[] = [];
    private waiters: Array<{
        predicate: (msg: ServerMessage) => boolean;
        resolve: (msg: ServerMessage) => void;
        reject: (err: Error) => void;
        timeoutId: NodeJS.Timeout;
    }> = [];

    public clientId: string;

    constructor(clientId?: string) {
        this.clientId = clientId || `test-client-${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * Connect to the WebSocket server
     */
    async connect(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`ws://localhost:${port}`);

            this.ws.on('open', () => {
                resolve();
            });

            this.ws.on('error', (err) => {
                reject(err);
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString()) as ServerMessage;
                    this.handleMessage(message);
                } catch (e) {
                    console.error('[WsTestClient] Failed to parse message:', e);
                }
            });

            this.ws.on('close', () => {
                this.ws = null;
            });
        });
    }

    private handleMessage(message: ServerMessage): void {
        // Check if any waiter is satisfied
        for (let i = this.waiters.length - 1; i >= 0; i--) {
            const waiter = this.waiters[i];
            if (waiter.predicate(message)) {
                clearTimeout(waiter.timeoutId);
                this.waiters.splice(i, 1);
                waiter.resolve(message);
                return;
            }
        }
        // No waiter matched, queue the message
        this.messageQueue.push(message);
    }

    /**
     * Send a typed client message
     */
    send(message: ClientMessage): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Wait for a message matching a predicate
     */
    waitFor<T extends ServerMessage>(
        predicate: (msg: ServerMessage) => msg is T,
        timeoutMs?: number
    ): Promise<T>;
    waitFor(
        type: ServerMessage['type'],
        timeoutMs?: number
    ): Promise<ServerMessage>;
    waitFor(
        predicateOrType: ((msg: ServerMessage) => boolean) | ServerMessage['type'],
        timeoutMs: number = 5000
    ): Promise<ServerMessage> {
        const predicate = typeof predicateOrType === 'function'
            ? predicateOrType
            : (msg: ServerMessage) => msg.type === predicateOrType;

        // Check queued messages first
        for (let i = 0; i < this.messageQueue.length; i++) {
            if (predicate(this.messageQueue[i])) {
                const msg = this.messageQueue.splice(i, 1)[0];
                return Promise.resolve(msg);
            }
        }

        // Wait for future message
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                const idx = this.waiters.findIndex(w => w.resolve === resolve);
                if (idx >= 0) this.waiters.splice(idx, 1);
                reject(new Error(`Timeout waiting for message`));
            }, timeoutMs);

            this.waiters.push({ predicate, resolve, reject, timeoutId });
        });
    }

    /**
     * Wait for a state message (game state broadcast)
     */
    async waitForState(timeoutMs: number = 5000): Promise<ServerMessage & { type: 'state' }> {
        return this.waitFor('state', timeoutMs) as Promise<ServerMessage & { type: 'state' }>;
    }

    /**
     * Wait for a lobby update message
     */
    async waitForLobbyUpdate(timeoutMs: number = 5000): Promise<ServerMessage & { type: 'lobbyUpdate' }> {
        return this.waitFor('lobbyUpdate', timeoutMs) as Promise<ServerMessage & { type: 'lobbyUpdate' }>;
    }

    /**
     * Wait for session message (sent after createLobby/joinLobby)
     */
    async waitForSession(timeoutMs: number = 5000): Promise<ServerMessage & { type: 'session' }> {
        return this.waitFor('session', timeoutMs) as Promise<ServerMessage & { type: 'session' }>;
    }

    /**
     * Wait for an error message
     */
    async waitForError(timeoutMs: number = 5000): Promise<ServerMessage & { type: 'error' }> {
        return this.waitFor('error', timeoutMs) as Promise<ServerMessage & { type: 'error' }>;
    }

    /**
     * Close the connection
     */
    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        // Clear all waiters
        for (const waiter of this.waiters) {
            clearTimeout(waiter.timeoutId);
            waiter.reject(new Error('Connection closed'));
        }
        this.waiters = [];
        this.messageQueue = [];
    }

    /**
     * Consume all pending messages of a given type (useful for clearing broadcast messages)
     */
    consumeAll(type: ServerMessage['type']): ServerMessage[] {
        const consumed: ServerMessage[] = [];
        this.messageQueue = this.messageQueue.filter(msg => {
            if (msg.type === type) {
                consumed.push(msg);
                return false;
            }
            return true;
        });
        return consumed;
    }

    /**
     * Wait a short time to let broadcasts arrive, then clear lobby updates
     */
    async clearLobbyUpdates(waitMs: number = 100): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, waitMs));
        this.consumeAll('lobbyUpdate');
    }

    /**
     * Wait a short time to let broadcasts arrive, then clear state messages
     */
    async clearStateMessages(waitMs: number = 100): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, waitMs));
        this.consumeAll('state');
    }

    /**
     * Helper to create a lobby and return the lobby code
     */
    async createLobby(name: string = 'TestPlayer'): Promise<string> {
        this.send({
            type: 'createLobby',
            clientId: this.clientId,
            name
        });
        const session = await this.waitForSession();
        if (!session.lobby) {
            throw new Error('No lobby in session response');
        }
        // Also consume the lobbyUpdate that follows
        await this.waitForLobbyUpdate();
        return session.lobby.code;
    }

    /**
     * Helper to join an existing lobby
     */
    async joinLobby(code: string, name: string = 'TestPlayer'): Promise<void> {
        this.send({
            type: 'joinLobby',
            clientId: this.clientId,
            code,
            name
        });
        await this.waitForSession();
        await this.waitForLobbyUpdate();
    }

    /**
     * Helper to set ready status
     */
    async setReady(ready: boolean = true): Promise<void> {
        this.send({
            type: 'setReady',
            clientId: this.clientId,
            ready
        });
        await this.waitForLobbyUpdate();
    }

    /**
     * Helper to start the game (host only)
     */
    async startGame(): Promise<void> {
        this.send({
            type: 'startGame',
            clientId: this.clientId
        });
        await this.waitForLobbyUpdate();
        await this.waitForState();
    }

    /**
     * Helper to send a game action and wait for state update
     */
    async gameAction(action: string, payload?: unknown): Promise<ServerMessage & { type: 'state' }> {
        this.send({
            type: 'gameAction',
            clientId: this.clientId,
            action,
            payload
        });
        return this.waitForState();
    }
}
