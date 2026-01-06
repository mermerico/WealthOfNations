import React from 'react';
import type { CommodityType } from '../../types/gameState';
import { COMMODITY_COLORS } from '../../utils/tileDefinitions';

interface ResourceIconProps {
    type: CommodityType | 'Money' | 'Flags';
    size?: number;
    amount?: number; // Optional text overlay or side text? Icon usually just visual.
    style?: React.CSSProperties;
}

export const ResourceIcon: React.FC<ResourceIconProps> = ({ type, size = 16, style }) => {
    // Special handling for Money/Flags colors if not in COMMODITY_COLORS (Flags isn't)
    let color = '#ccc';
    if (type === 'Flags') color = '#442222'; // Dark Red like Flag
    else if (type === 'Money') color = '#a855f7';
    else color = COMMODITY_COLORS[type as CommodityType];

    return (
        <div style={{
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            borderRadius: '3px',
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
            display: 'inline-block',
            border: type === 'Ore' || type === 'Capital' ? '1px solid #666' : 'none',
            ...style
        }} title={type} />
    );
};
