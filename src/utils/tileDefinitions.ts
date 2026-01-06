import type { IndustryType, TileFeature, CommodityType } from '../types/gameState';

// Define the static structure of each tile type
// Side 1 (Top) maps to direction index 0
// Sides are 1-based in rules, 0-based in array
export interface TileDefinition {
    type: IndustryType;
    features: TileFeature[]; // Array of features (edges/corners)
    hasCenterDot: boolean;
    cost: string; // Descriptive cost
    costStruct: Partial<Record<CommodityType, number>>; // Logic cost
}

// Rules extraction replacement:
// 1. Farm: Full center. Half dot on each flat side (Edge).
// 2. Generator: Full center. Half dot on odd-numbered flat sides (1, 3, 5 -> Indices 0, 2, 4).
// 3. Academy: Full center. Half dots on sides 3, 6 (Indices 2, 5). 1/3 dots on corners 2, 6.
// 4. Mine: Full center. Half dot sides 1, 4 (Indices 0, 3).
// 5. Factory: Full center. 1/3 dots on corners 3, 4, 6.
// 6. Bank: No center. Half dots sides 2, 3 (Indices 1, 2).

// Corner mapping:
// Corner 1Top Right vertex?
// If Side 1 is Top (N).
// Let's assume standard numbering for corners starts right of Side 1?
// Flat Topped vertices:
// v1: Top Right (between Side 1 and 2)
// v2: Right (between Side 2 and 3)
// v3: Bottom Right (between Side 3 and 4)
// v4: Bottom Left (between Side 4 and 5)
// v5: Left (between Side 5 and 6)
// v6: Top Left (between Side 6 and 1)

// Academy: 1/3 dots on corners 2 and 6.
// v2 (Right), v6 (Top Left).

// Factory: 1/3 dots on corners 3, 4, 6.
// v3 (Bottom Right), v4 (Bottom Left), v6 (Top Left).

export const COMMODITY_COLORS: Record<import('../types/gameState').CommodityType | string, string> = {
    Food: '#facc15',   // Yellow
    Energy: '#3b82f6', // Blue
    Labor: '#ef4444',  // Red
    Ore: '#9ca3af',    // Gray
    Capital: '#000000',// Black
    Money: '#a855f7'   // Purple for Bank/Finance
};

export const TILE_DEFINITIONS: Record<IndustryType, TileDefinition> = {
    Farm: {
        type: 'Farm',
        hasCenterDot: true,
        cost: '1 Ore, 1 Capital',
        costStruct: { Ore: 1, Capital: 1 },
        features: [
            { position: 0, type: 'Edge', feature: 'HalfDot', commodity: 'Food' },
            { position: 1, type: 'Edge', feature: 'HalfDot', commodity: 'Food' },
            { position: 2, type: 'Edge', feature: 'HalfDot', commodity: 'Food' },
            { position: 3, type: 'Edge', feature: 'HalfDot', commodity: 'Food' },
            { position: 4, type: 'Edge', feature: 'HalfDot', commodity: 'Food' },
            { position: 5, type: 'Edge', feature: 'HalfDot', commodity: 'Food' },
        ]
    },
    Generator: {
        type: 'Generator',
        hasCenterDot: true,
        cost: '1 Ore, 1 Capital',
        costStruct: { Ore: 1, Capital: 1 },
        features: [
            { position: 0, type: 'Edge', feature: 'HalfDot', commodity: 'Energy' }, // Side 1
            { position: 2, type: 'Edge', feature: 'HalfDot', commodity: 'Energy' }, // Side 3
            { position: 4, type: 'Edge', feature: 'HalfDot', commodity: 'Energy' }, // Side 5
        ]
    },
    Academy: {
        type: 'Academy',
        hasCenterDot: true,
        cost: '1 Ore, 1 Capital',
        costStruct: { Ore: 1, Capital: 1 },
        features: [
            { position: 2, type: 'Edge', feature: 'HalfDot', commodity: 'Labor' }, // Side 3
            { position: 5, type: 'Edge', feature: 'HalfDot', commodity: 'Labor' }, // Side 6
            { position: 1, type: 'Corner', feature: 'ThirdDot', commodity: 'Labor' }, // Corner 2? (Index 1)
            { position: 5, type: 'Corner', feature: 'ThirdDot', commodity: 'Labor' }, // Corner 6? (Index 5)
        ]
    },
    Mine: {
        type: 'Mine',
        hasCenterDot: true,
        cost: '1 Labor, 1 Energy, 1 Capital',
        costStruct: { Labor: 1, Energy: 1, Capital: 1 },
        features: [
            { position: 0, type: 'Edge', feature: 'HalfDot', commodity: 'Ore' }, // Side 1
            { position: 3, type: 'Edge', feature: 'HalfDot', commodity: 'Ore' }, // Side 4
        ]
    },
    Factory: {
        type: 'Factory',
        hasCenterDot: true,
        cost: '1 Labor, 2 Ore',
        costStruct: { Labor: 1, Ore: 2 },
        features: [
            { position: 2, type: 'Corner', feature: 'ThirdDot', commodity: 'Capital' }, // Corner 3? (Index 2)
            { position: 3, type: 'Corner', feature: 'ThirdDot', commodity: 'Capital' }, // Corner 4? (Index 3)
            { position: 5, type: 'Corner', feature: 'ThirdDot', commodity: 'Capital' }, // Corner 6? (Index 5)
        ]
    },
    Bank: {
        type: 'Bank',
        hasCenterDot: false, // Rules say "No dot in center"
        cost: '1 Energy, 1 Ore, 1 Capital',
        costStruct: { Energy: 1, Ore: 1, Capital: 1 },
        features: [
            { position: 1, type: 'Edge', feature: 'HalfDot', commodity: 'Money' }, // Side 2
            { position: 2, type: 'Edge', feature: 'HalfDot', commodity: 'Money' }, // Side 3
            // Wait, Bank produces Money (or $30). Commodity is 'Capital'? No, it's special.
            // But the rule says "Full Dots: Produce 1 Commodity cube (or $30 for Banks)".
            // The edge color matches "Bank" usually which is purple?
            // Rules: "Money/Finance (Purple): Generated by Banks"
            // So commodity is technically 'Money' or 'Finance', but 'Capital' is Black.
            // Let's use 'Money' for Bank output?
            // "Types: ... Bank"
            // "Each with a corresponding Market: 6. Money/Finance (Purple)"
            // So let's add 'Money' to CommodityType or just handle it.
            // My CommodityType has 'Food', 'Energy', 'Labor', 'Ore', 'Capital'.
            // I should add 'Money' as a pseudo-commodity for production?
        ]
    }
};
