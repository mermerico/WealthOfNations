import { useState, useMemo } from 'react';
import type { CommodityType, GameState } from '../../types/gameState';
import { ResourceIcon } from '../ui/ResourceIcon';
import { MARKET_STEPS } from '../../utils/marketDefinitions';
import './MultiTransactionModal.css';

interface MultiTransactionModalProps {
    action: 'buy' | 'sell';
    initialCommodity: CommodityType;
    gameState: GameState;
    onConfirm: (items: CommodityType[]) => void;
    onCancel: () => void;
}

const COMMODITIES: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

export default function MultiTransactionModal({
    action,
    initialCommodity,
    gameState,
    onConfirm,
    onCancel
}: MultiTransactionModalProps) {
    const [cart, setCart] = useState<CommodityType[]>([initialCommodity]);
    const player = gameState.players[gameState.currentTurnPlayerIndex];

    // Calculate predicted prices and total based on current cart
    const cartDetails = useMemo(() => {
        let currentMarkets = JSON.parse(JSON.stringify(gameState.markets));
        let total = 0;
        const details = cart.map((type) => {
            const stock = currentMarkets[type].stock;
            const steps = MARKET_STEPS[type];

            let price = 0;
            if (action === 'buy') {
                const priceIndex = Math.max(0, stock - 1);
                price = steps[priceIndex].buy;
                currentMarkets[type].stock = Math.max(0, stock - 1);
            } else {
                const maxStock = steps.length;
                const priceIndex = Math.min(stock, maxStock - 1);
                price = steps[priceIndex].sell;
                currentMarkets[type].stock = Math.min(maxStock, stock + 1);
            }

            total += price;
            return { type, price };
        });

        return { details, total };
    }, [cart, gameState.markets, action]);

    const addToCart = (type: CommodityType) => {
        if (cart.length < 3) {
            setCart([...cart, type]);
        }
    };

    const removeFromCart = (index: number) => {
        if (cart.length > 1) {
            const newCart = [...cart];
            newCart.splice(index, 1);
            setCart(newCart);
        }
    };

    const isBuy = action === 'buy';
    const actionColor = isBuy ? '#10b981' : '#f59e0b';
    const canAfford = !isBuy || player.money >= cartDetails.total;
    const hasResources = isBuy || cart.every(type => {
        const countInCart = cart.filter(t => t === type).length;
        return player.resources[type] >= countInCart;
    });

    return (
        <div className="multi-transaction-modal">
            <h2 style={{ borderBottom: `2px solid ${actionColor}` }}>
                {isBuy ? 'Multi-Buy Session' : 'Multi-Sell Session'}
            </h2>

            <div className="cart-container">
                <div className="cart-header">Shopping Cart ({cart.length}/3)</div>
                <div className="cart-items">
                    {cartDetails.details.map((item, idx) => (
                        <div key={idx} className="cart-item">
                            <div className="item-info">
                                <ResourceIcon type={item.type} size={20} />
                                <span>{item.type}</span>
                                <span className="item-price">${item.price}</span>
                            </div>
                            {cart.length > 1 && (
                                <button className="remove-item" onClick={() => removeFromCart(idx)}>×</button>
                            )}
                        </div>
                    ))}
                    {cart.length === 0 && <div className="cart-empty">Cart is empty</div>}
                </div>
                <div className="cart-total">
                    <span>Total {isBuy ? 'Cost' : 'Revenue'}:</span>
                    <span className="total-amount" style={{ color: canAfford && hasResources ? actionColor : '#ef4444' }}>
                        ${cartDetails.total}
                    </span>
                </div>
            </div>

            <div className="add-items-section">
                <div className="section-title">Add {isBuy ? 'to Buy' : 'to Sell'}</div>
                <div className="commodity-buttons">
                    {COMMODITIES.map(type => {
                        // Check if stock 0 for buy or full for sell
                        const stock = gameState.markets[type].stock;
                        const steps = MARKET_STEPS[type];
                        const atLimit = isBuy ? stock === 0 : stock === steps.length;
                        const disabled = cart.length >= 3 || atLimit;

                        // Calculate projected stock in cart for this type
                        const countInCart = cart.filter(t => t === type).length;
                        const projectedStock = isBuy ? stock - countInCart : stock + countInCart;

                        let nextPrice = 0;
                        if (!atLimit) {
                            if (isBuy) {
                                const priceIndex = Math.max(0, projectedStock - 1);
                                nextPrice = steps[priceIndex].buy;
                            } else {
                                const maxStock = steps.length;
                                const priceIndex = Math.min(projectedStock, maxStock - 1);
                                nextPrice = steps[priceIndex].sell;
                            }
                        }

                        return (
                            <button
                                key={type}
                                className="add-button"
                                disabled={disabled}
                                onClick={() => addToCart(type)}
                            >
                                {!atLimit && <span className="next-price">${nextPrice}</span>}
                                <ResourceIcon type={type} size={16} />
                                <span className="add-plus">+</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {(!canAfford || !hasResources) && (
                <div className="transaction-error">
                    {!canAfford ? '⚠️ Insufficient funds for this cart' : '⚠️ Insufficient resources to sell'}
                </div>
            )}

            <div className="transaction-warning">
                ℹ️ This batch will end your turn
            </div>

            <div className="modal-actions">
                <button className="cancel-button" onClick={onCancel}>Cancel</button>
                <button
                    className="confirm-button"
                    disabled={!canAfford || !hasResources}
                    onClick={() => onConfirm(cart)}
                    style={{ backgroundColor: actionColor }}
                >
                    Execute Batch
                </button>
            </div>
        </div>
    );
}
