import React, { useState } from 'react';
import type { MarketState, CommodityType } from '../../types/gameState';
import { MARKET_STEPS } from '../../utils/marketDefinitions';
import { COMMODITY_COLORS } from '../../utils/tileDefinitions';
import { calculateCurrentBarterPrice } from '../../utils/marketUtils';

interface MarketBoardProps {
    markets: Record<CommodityType, MarketState>;
    onBuy?: (commodity: CommodityType) => void;
    onSell?: (commodity: CommodityType) => void;
    disabled?: boolean;
}

const ORDER: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

interface MarketTrackProps {
    type: CommodityType;
    market: MarketState;
    onBuy?: () => void;
    onSell?: () => void;
    disabled?: boolean;
}

const MarketTrack: React.FC<MarketTrackProps> = ({ type, market, onBuy, onSell, disabled }) => {
    const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
    const steps = MARKET_STEPS[type];
    const color = COMMODITY_COLORS[type];
    const stock = market.stock;
    const maxStock = steps.length;

    // Current prices - always available at boundaries (buying from/selling to supply)
    // Buy at stock=0 uses same price as stock=1
    const buyPriceIndex = Math.max(0, stock - 1);
    const currentBuyPrice = steps[buyPriceIndex].buy;

    // Sell at stock=maxStock uses same price as stock=maxStock-1
    const sellPriceIndex = Math.min(stock, maxStock - 1);
    const currentSellPrice = steps[sellPriceIndex].sell;

    const textColor = type === 'Ore' || type === 'Capital' ? 'white' : '#111';

    // Barter calculation
    const currentBarterPrice = calculateCurrentBarterPrice(steps, stock);

    const trackIndex = ORDER.indexOf(type);
    const isRightSide = trackIndex >= 3; // Show tooltip on left for last columns

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            minWidth: '60px',
            maxWidth: '80px'
        }}>
            {/* Header */}
            <div style={{
                background: color,
                color: textColor,
                width: '100%',
                textAlign: 'center',
                fontWeight: 'bold',
                padding: '8px 4px',
                borderRadius: '8px 8px 0 0',
                fontSize: '14px',
                boxSizing: 'border-box',
                border: '1px solid transparent', // Match width of bordered elements below
                borderBottom: 'none'
            }}>
                {type}
            </div>

            {/* Price Buttons */}
            <div style={{
                width: '100%',
                background: '#222',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderLeft: '1px solid #333',
                borderRight: '1px solid #333',
                boxSizing: 'border-box'
            }}>
                {/* Sell Button */}
                <button
                    onClick={onSell}
                    disabled={disabled || !currentSellPrice}
                    style={{
                        width: '100%',
                        padding: '6px 4px',
                        background: (disabled || !currentSellPrice) ? '#333' : '#16a34a',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        cursor: (!disabled && currentSellPrice) ? 'pointer' : 'not-allowed',
                        opacity: (!disabled && currentSellPrice) ? 1 : 0.5,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxSizing: 'border-box',
                        filter: disabled ? 'grayscale(0.8)' : 'none'
                    }}
                >
                    <span>Sell</span>
                    <span>${currentSellPrice ?? '—'}</span>
                </button>

                {/* Barter Price */}
                {currentBarterPrice !== null && (
                    <div style={{ fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
                        Barter: ${currentBarterPrice}
                    </div>
                )}

                {/* Buy Button */}
                <button
                    onClick={onBuy}
                    disabled={disabled || !currentBuyPrice}
                    style={{
                        width: '100%',
                        padding: '6px 4px',
                        background: (disabled || !currentBuyPrice) ? '#333' : '#dc2626',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        cursor: (!disabled && currentBuyPrice) ? 'pointer' : 'not-allowed',
                        opacity: (!disabled && currentBuyPrice) ? 1 : 0.5,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxSizing: 'border-box',
                        filter: disabled ? 'grayscale(0.8)' : 'none'
                    }}
                >
                    <span>Buy</span>
                    <span>${currentBuyPrice ?? '—'}</span>
                </button>
            </div>

            {/* Progress Bar Track */}
            <div
                style={{
                    width: '100%',
                    flex: 1,
                    minHeight: '300px',
                    background: '#111',
                    borderLeft: '1px solid #333',
                    borderRight: '1px solid #333',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                }}
                onMouseLeave={() => setHoveredLevel(null)}
            >
                {/* Hover zones for each level */}
                {steps.map((_, visualIndex) => {
                    // Reverse the index so top = high quantity, bottom = low quantity
                    const stockLevel = maxStock - visualIndex;
                    const isFilled = stockLevel <= stock;
                    const step = steps[stockLevel] || steps[maxStock - 1];
                    const prevStep = stockLevel > 0 ? steps[stockLevel - 1] : null;

                    const barterPrice = step.barter;

                    return (
                        <div
                            key={visualIndex}
                            onMouseEnter={() => setHoveredLevel(visualIndex)}
                            style={{
                                flex: 1,
                                position: 'relative',
                                background: hoveredLevel === visualIndex
                                    ? (isFilled ? `${color}40` : 'rgba(255,255,255,0.05)')
                                    : (isFilled && stockLevel === stock
                                        ? (type === 'Capital'
                                            ? 'repeating-linear-gradient(45deg, #111, #111 10px, #444 10px, #444 12px)'
                                            : `${color}`)
                                        : 'transparent'),
                                border: isFilled && stockLevel === stock ? '1px solid #CCC' : undefined,
                                borderBottom: isFilled && stockLevel === stock ? '1px solid #CCC' : (visualIndex < maxStock - 1 ? '1px solid #222' : 'none'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.15s ease',
                                zIndex: hoveredLevel === visualIndex ? 100 : (isFilled && stockLevel === stock ? 5 : 1),
                                boxSizing: 'border-box'
                            }}
                        >
                            {/* Price label on hover */}
                            {hoveredLevel === visualIndex && (
                                <div style={{
                                    position: 'absolute',
                                    [isRightSide ? 'right' : 'left']: '105%',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(0,0,0,0.95)',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    border: '1px solid #444',
                                    boxSizing: 'border-box',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                                }}>
                                    <div style={{ color: '#888', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px', textAlign: 'center' }}>
                                        Qty: {stockLevel}
                                    </div>
                                    <div style={{ color: '#22c55e' }}>Sell: ${step.sell}</div>
                                    {barterPrice !== null && (
                                        <div style={{ color: '#aaa' }}>Barter: ${barterPrice}</div>
                                    )}
                                    {prevStep && (
                                        <div style={{ color: '#ef4444' }}>Buy: ${prevStep.buy}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Fill overlay (for bins below the top one) */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${Math.max(0, ((stock - 1) / maxStock) * 100)}%`,
                    background: type === 'Capital'
                        ? 'repeating-linear-gradient(45deg, #111, #111 10px, #444 10px, #444 12px)'
                        : `linear-gradient(to top, ${color}, ${color}99)`,
                    opacity: 0.6,
                    pointerEvents: 'none',
                    transition: 'height 0.3s ease'
                }} />
            </div>

            {/* Qty 0 hover zone (empty market) */}
            <div
                onMouseEnter={() => setHoveredLevel(-1)}
                onMouseLeave={() => setHoveredLevel(null)}
                style={{
                    width: '100%',
                    padding: '6px',
                    background: hoveredLevel === -1 ? 'rgba(255,255,255,0.05)' : '#1a1a1a',
                    borderLeft: '1px solid #333',
                    borderRight: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    cursor: 'default',
                    transition: 'background 0.15s ease',
                    zIndex: hoveredLevel === -1 ? 100 : 1,
                    boxSizing: 'border-box'
                }}
            >
                <span style={{ fontSize: '10px', color: '#555' }}>∅</span>
                {hoveredLevel === -1 && (
                    <div style={{
                        position: 'absolute',
                        [isRightSide ? 'right' : 'left']: '105%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.95)',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        border: '1px solid #444',
                        boxSizing: 'border-box',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ color: '#888', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px', textAlign: 'center' }}>
                            Qty: 0
                        </div>
                        <div style={{ color: '#22c55e' }}>Sell: ${steps[0].sell}</div>
                        <div style={{ color: '#aaa' }}>Barter: ${calculateCurrentBarterPrice(steps, 0)}</div>
                        <div style={{ color: '#ef4444' }}>Buy: ${steps[0].buy}</div>
                    </div>
                )}
            </div>

            {/* Stock indicator */}
            <div style={{
                width: '100%',
                background: '#222',
                padding: '8px',
                textAlign: 'center',
                borderRadius: '0 0 8px 8px',
                border: '1px solid #333',
                borderTop: 'none',
                fontSize: '12px',
                color: '#888',
                boxSizing: 'border-box'
            }}>
                {stock} / {maxStock}
            </div>
        </div>
    );
};

export const MarketBoard: React.FC<MarketBoardProps> = ({ markets, onBuy, onSell, disabled }) => {
    return (
        <div style={{
            display: 'flex',
            gap: '6px',
            padding: '6px',
            background: '#1a1a1a',
            borderRadius: '8px',
            height: '100%',
            boxSizing: 'border-box'
        }}>
            {ORDER.map(type => (
                <MarketTrack
                    key={type}
                    type={type}
                    market={markets[type]}
                    onBuy={() => onBuy?.(type)}
                    onSell={() => onSell?.(type)}
                    disabled={disabled}
                />
            ))}
        </div>
    );
};
