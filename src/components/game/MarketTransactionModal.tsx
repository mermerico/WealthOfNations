import type { CommodityType } from '../../types/gameState';
import { ResourceIcon } from '../ui/ResourceIcon';
import './MarketTransactionModal.css';

interface MarketTransactionModalProps {
    action: 'buy' | 'sell';
    commodity: CommodityType;
    amount: number;
    price: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function MarketTransactionModal({
    action,
    commodity,
    amount,
    price,
    onConfirm,
    onCancel
}: MarketTransactionModalProps) {
    const totalPrice = price * amount;
    const actionText = action === 'buy' ? 'Buy' : 'Sell';
    const priceText = action === 'buy' ? 'Pay' : 'Receive';

    return (
        <div className="market-transaction-modal">
            <h2>Confirm Transaction</h2>

            <div className="transaction-details">
                <div className="transaction-action">
                    <strong>{actionText}</strong>
                </div>

                <div className="transaction-commodity">
                    <ResourceIcon type={commodity} size={24} />
                    <span className="commodity-amount">×{amount}</span>
                </div>

                <div className="transaction-price">
                    <span className="price-label">{priceText}:</span>
                    <span className="price-amount">${totalPrice}</span>
                </div>
            </div>

            <div className="transaction-warning">
                ⚠️ This action will end your turn
            </div>

            <div className="modal-actions">
                <button
                    className="cancel-button"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button
                    className="confirm-button"
                    onClick={onConfirm}
                >
                    Confirm {actionText}
                </button>
            </div>
        </div>
    );
}
