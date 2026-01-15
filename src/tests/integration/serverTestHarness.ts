import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';

/**
 * Server test harness for spawning and managing the WebSocket server during tests.
 */
export class ServerTestHarness {
    private serverProcess: ChildProcess | null = null;
    private port: number = 0;

    /**
     * Get a free port for the server
     */
    private async getFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, () => {
                const address = server.address();
                if (address && typeof address !== 'string') {
                    const port = address.port;
                    server.close(() => resolve(port));
                } else {
                    reject(new Error('Could not get port'));
                }
            });
            server.on('error', reject);
        });
    }

    /**
     * Start the server on a random available port
     * Returns the port number
     */
    async start(): Promise<number> {
        if (this.serverProcess) {
            throw new Error('Server already running');
        }

        this.port = await this.getFreePort();

        // Use process.cwd() which should be the project root when running tests
        const projectRoot = process.cwd();
        const serverDir = path.join(projectRoot, 'server');
        const tsxPath = path.join(serverDir, 'node_modules', '.bin', 'tsx');

        return new Promise((resolve, reject) => {
            // Run tsx directly via node_modules instead of npx
            this.serverProcess = spawn(tsxPath, ['src/index.ts'], {
                cwd: serverDir,
                env: {
                    ...process.env,
                    PORT: String(this.port),
                    TEST_MODE: 'true',
                    PATH: process.env.PATH
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Server startup timeout'));
                    this.stop();
                }
            }, 10000);

            this.serverProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log('[Server]', output);
                if (output.includes('Server listening') && !resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    // Give server a moment to be ready for connections
                    setTimeout(() => resolve(this.port), 100);
                }
            });

            this.serverProcess.stderr?.on('data', (data: Buffer) => {
                console.error('[Server Error]', data.toString());
            });

            this.serverProcess.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            this.serverProcess.on('exit', (code) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(new Error(`Server exited with code ${code}`));
                }
                this.serverProcess = null;
            });
        });
    }

    /**
     * Stop the server
     */
    stop(): void {
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
            this.serverProcess = null;
        }
    }

    /**
     * Get the port the server is running on
     */
    getPort(): number {
        return this.port;
    }
}

/**
 * Singleton instance for easy use in tests
 */
let sharedHarness: ServerTestHarness | null = null;

/**
 * Start a shared server for all tests in a file.
 * Call this in beforeAll().
 */
export async function startTestServer(): Promise<number> {
    if (!sharedHarness) {
        sharedHarness = new ServerTestHarness();
    }
    return sharedHarness.start();
}

/**
 * Stop the shared server.
 * Call this in afterAll().
 */
export function stopTestServer(): void {
    if (sharedHarness) {
        sharedHarness.stop();
        sharedHarness = null;
    }
}

/**
 * Get the port of the shared server.
 */
export function getTestServerPort(): number {
    if (!sharedHarness) {
        throw new Error('Test server not started');
    }
    return sharedHarness.getPort();
}
