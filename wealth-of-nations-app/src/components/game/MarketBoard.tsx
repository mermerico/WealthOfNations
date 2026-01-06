import React from 'react';
import type { MarketState, CommodityType } from '../../types/gameState';
import { MARKET_STEPS } from '../../utils/marketDefinitions';
import { COMMODITY_COLORS } from '../../utils/tileDefinitions';

interface MarketBoardProps {
    markets: Record<CommodityType, MarketState>;
    onBuy?: (commodity: CommodityType) => void;
    onSell?: (commodity: CommodityType) => void;
}

// Order of display as per rules
const ORDER: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

export const MarketBoard: React.FC<MarketBoardProps> = ({ markets, onBuy, onSell }) => {
    return (
        <div style={{
            display: 'flex',
            gap: '10px',
            padding: '10px',
            background: '#222',
            overflowY: 'auto', // Single vertical scrollbar for the entire board
            borderRadius: '8px',
            border: '1px solid #444',
            alignItems: 'flex-start', // Align tracks at the top
            height: '100%',
            boxSizing: 'border-box',
            scrollbarWidth: 'thin'
        }}>
            {ORDER.map(type => {
                const market = markets[type];
                const color = COMMODITY_COLORS[type];
                const stock = market.stock;

                return (
                    <div key={type} style={{
                        flex: 1,
                        minWidth: '60px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        {/* Header */}
                        <div style={{
                            background: color,
                            color: type === 'Ore' || type === 'Capital' ? 'white' : 'black',
                            width: '100%',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            padding: '4px 0',
                            borderRadius: '4px 4px 0 0',
                            flexShrink: 0
                        }}>
                            {type}
                        </div>

                        {/* Market Track */}
                        <div style={{
                            background: '#333',
                            width: '100%',
                            padding: '2px',
                            border: '1px solid #555',
                            boxSizing: 'border-box'
                        }}>
                            {MARKET_STEPS[type].map((step, index) => {
                                // Determine state of this well
                                // Well index 0 is top.
                                // If stock > index, this well has a cube.
                                const hasCube = stock > index;

                                // Interaction States
                                // Can Sell into this well IF it is the first empty one (Index === stock)
                                const canSellHere = index === stock;

                                // Can Buy from this well IF it is the last full one (Index === stock - 1)
                                const canBuyHere = index === stock - 1;

                                return (
                                    <div key={index} style={{
                                        margin: '1px 0',
                                        background: '#1a1a1a',
                                        border: '1px solid #444',
                                        height: '25px', // Reduced height for more visibility
                                        position: 'relative',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        cursor: (canBuyHere || canSellHere) ? 'pointer' : 'default',
                                        opacity: (canBuyHere || canSellHere) ? 1 : 0.6
                                    }}
                                        onClick={() => {
                                            if (canBuyHere) onBuy?.(type);
                                            if (canSellHere) onSell?.(type);
                                        }}
                                    >
                                        {/* Sell Price (Inside) */}
                                        <span style={{
                                            position: 'absolute',
                                            fontSize: '10px',
                                            color: '#aaa',
                                            pointerEvents: 'none'
                                        }}>
                                            {step.sell}
                                        </span>

                                        {/* Cube if present */}
                                        {hasCube && (
                                            <div style={{
                                                width: '14px',
                                                height: '14px',
                                                borderRadius: '2px',
                                                background: color,
                                                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                                                zIndex: 2
                                            }} />
                                        )}

                                        {/* Buy Price (Bottom Right) */}
                                        <span style={{
                                            position: 'absolute',
                                            bottom: '1px',
                                            right: '2px',
                                            fontSize: '8px',
                                            color: '#ef4444'
                                        }}>
                                            -{step.buy}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
