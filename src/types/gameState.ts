export type CommodityType = 'Food' | 'Energy' | 'Labor' | 'Ore' | 'Capital';
export type ResourceType = CommodityType | 'Money';

export type IndustryType = 'Farm' | 'Generator' | 'Academy' | 'Mine' | 'Factory' | 'Bank';

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: Record<CommodityType, number>;
  money: number;
  loans: number; // Promissory notes
  flags: number;
  ready: boolean;
  flag?: string; // Reference to SVG filename in public/flags/
  hasPassed?: boolean; // True if player has passed this phase
  hasProduced?: boolean; // True if player has run production this round
}

export interface Coordinate {
  q: number;
  r: number;
}

// Representing the visual features of a tile edge/corner
export interface TileFeature {
  position: number; // 0-5 for edges, 0-5 for corners
  type: 'Edge' | 'Corner';
  feature: 'HalfDot' | 'ThirdDot' | 'None';
  commodity?: CommodityType | 'Money'; // If it produces something
}

export interface TradeOffer {
  commodities: Partial<Record<CommodityType, number>>;
  money: number;
  loans: number;
}

export interface PendingTrade {
  proposerId: string;
  targetId: string;
  giving: TradeOffer;
  receiving: TradeOffer;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'action' | 'phase' | 'system';
  playerId?: string;
}

// Stores a player's desired inventory for trade planning
export interface TradeIntent {
  playerId: string;
  desiredInventory: Record<CommodityType, number>;
  ready: boolean;
}

export interface IndustryTile {
  id: string; // Unique instance ID
  type: IndustryType;
  ownerId: string;
  orientation: number; // 0-5 (rotation)
  // Static definition properties would be separate, but for state:
  active: boolean; // Is it fed/powered in production?
  automated?: boolean; // New: Automation Token
}

export interface HexCell {
  q: number;
  r: number;
  occupant: {
    type: 'Industry' | 'Flag';
    playerId: string;
    tile?: IndustryTile; // Only if type is Industry
  } | null;
}

export interface MarketState {
  stock: number;
  // Index in the price array/well
  priceIndex: number;
}

export interface SetupPhaseState {
  step: 'determineFirstPlayer' | 'selectPackage' | 'placeTile' | 'complete';
  firstPlayerIndex: number;
  draftRound: number; // Which round of drafting (0 or 1 for 2 rounds)
  currentDrafterIndex: number; // Index of player currently drafting
  takenPackageIds: string[]; // IDs of packages already selected
  pendingPlacement: {
    packageId: string;
    tilesRemaining: IndustryType[]; // Tiles that still need to be placed
    placementHistory: string[]; // Cell IDs in order of placement (for undo)
  } | null;
}

export interface GameSettings {
  promissoryNoteInterestFees: boolean;
}

export interface GameState {
  players: Player[];
  board: Record<string, HexCell>; // Key: "q,r" -> e.g. "0,0", "-1,1"
  markets: Record<CommodityType, MarketState>;
  phase: 'Setup' | 'Trade' | 'Develop' | 'Produce';
  currentTurnPlayerIndex: number;
  firstPlayerIndex: number; // Index of player who starts each phase
  round: number;
  setupPhase?: SetupPhaseState;
  pendingTrade?: PendingTrade | null;
  consecutivePasses: number; // Track passes in a row during Trade/Develop phases
  tilesRemaining: Record<IndustryType, number>; // Tiles left in supply
  isLastRound: boolean; // True when game end conditions met
  gameEnded: boolean; // True when final Trade phase completed
  // For consistency checks
  initialFlagsPerPlayer: number;
  initialTiles: Record<IndustryType, number>;
  settings: GameSettings;
  tradeIntents?: Record<string, TradeIntent>; // Player ID -> their trade intent for current Trade phase
  logs: LogEntry[];
}

export const INITIAL_RESOURCES: Record<CommodityType, number> = {
  Food: 0,
  Energy: 0,
  Labor: 0,
  Ore: 0,
  Capital: 0
};
