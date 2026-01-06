# Wealth of Nations

Wealth of Nations is a web adaptation of the tabletop game centered on industrial production and global trade. The client is written with React 19 and TypeScript, while a minimal Node WebSocket relay keeps every connected browser in sync. If the relay cannot be reached, the app transparently falls back to a local, single-browser game state.

## Key Capabilities
- Complete game reducer shared between the browser and the server for deterministic results
- SVG-driven hex map with tool overlays, bloc visualization, and automation support
- WebSocket relay that rebroadcasts the authoritative game state to every participant
- Environment-driven configuration for remote access, custom hosts, and deployment targets

## Repository Layout
```
.
├── public/                 # Static assets (flags, favicon, manifest)
├── resources/              # Game rules and reference materials
├── src/
│   ├── components/         # Board, markets, roster, dashboard, and UI primitives
│   ├── hooks/              # useGameEngine hook with WebSocket + local fallback
│   ├── pages/              # Game entry point and production integration tests
│   ├── shared/             # Reducer wrapper shared by client and server
│   └── utils/              # Core game logic (placement, production, markets, setup)
├── server/                 # Node WebSocket relay powered by tsx
├── package.json            # Client scripts (build, test, lint, dev)
└── server/package.json     # Server scripts (dev, typecheck)
```

## Prerequisites
- Node.js 20.x or newer (Vite 7 and the WebSocket server expect a modern runtime)
- npm 10.x (bundled with recent Node LTS releases)

## Installation
1. Install client dependencies: `npm install`
2. Install server dependencies: `cd server && npm install`
3. Duplicate `.env.local` if you need per-environment overrides

## Recommended Workflow
1. Run automated tests before coding: `npm run test`
2. Verify the TypeScript build: `npm run build`
3. Start the WebSocket relay (default port 4000): `cd server && npm run dev`
4. Launch the client in another terminal when you need interactive testing: `npm run dev`
5. Stop both processes with `Ctrl+C` when finished

## Environment Configuration
- `VITE_GAME_SERVER_URL`: Override the client WebSocket endpoint (defaults to `ws(s)://<current-host>:4000`)
- `VITE_ALLOWED_HOSTS`: Comma-separated list of hostnames Vite should trust when running the dev server remotely
- `PORT`: Optional override for the relay (defaults to 4000). Forward this port for remote players

Store overrides in `.env.local` to keep secrets out of version control.

## Tests and Quality Checks
- `npm run test`: Runs Vitest suites covering placement, production, setup, and integration scenarios
- `npm run lint`: Applies ESLint to the client source tree
- `npm run build`: Type-checks and generates the production bundle
- `cd server && npm run typecheck`: Validates the server TypeScript project

## Production Build
1. Execute `npm run build`
2. Serve the generated `dist/` directory with your preferred static host
3. Run the WebSocket relay (`npm run dev` in `server/`) or bundle it for your infrastructure
4. Ensure clients can reach the relay URL you configured via `VITE_GAME_SERVER_URL`

## Remote Play Notes
- The relay maintains a single shared room; every join event triggers a fresh state sync and player-count broadcast
- Client IDs are session-based, and reconnects clean up stale sockets automatically
- Browsers fall back to local simulation if the relay is unavailable, enabling offline practice
- When exposing the relay outside your network, forward port 4000 and list the public hostname in `VITE_ALLOWED_HOSTS`
- The landing screen lets players create new lobbies, join by code, or rejoin the last lobby code that was stored locally
- Remote turns are enforced on both the server and client; only the active seat can trigger game actions while others see a waiting overlay

## Game Mechanics Snapshot
- Rounds cycle through Trade, Develop, and Produce phases enforced by the reducer in `src/utils/gameReducer.ts`
- Commodity markets respond to supply and demand via data in `src/utils/marketDefinitions.ts`
- Bloc production counts edge and corner dots, plus automation bonuses, within `src/utils/production.ts`
- Setup and placement validation live in `src/utils/setupLogic.ts` and `src/utils/placementLogic.ts`, mirroring the tabletop ruleset

Consult `resources/rules.md` for the full rule reference and `AUTOMATION_FIX.md` for implementation notes.
