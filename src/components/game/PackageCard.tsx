import type { Package } from '../../utils/packageDefinitions';
import { COMMODITY_COLORS } from '../../utils/tileDefinitions';
import { Hex } from './Hex';
import type { HexCell, IndustryTile } from '../../types/gameState';
import './PackageCard.css';

interface PackageCardProps {
    package: Package;
    onSelect: () => void;
    disabled?: boolean;
}

export default function PackageCard({ package: pkg, onSelect, disabled = false }: PackageCardProps) {
    const isIndustry = pkg.type === 'Industry';

    return (
        <div
            className={`package-card${disabled ? ' disabled' : ''}`}
            onClick={() => {
                if (disabled) return;
                onSelect();
            }}
            role="button"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={event => {
                if (disabled) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
        >
            <div className="package-header">
                <span className="package-type-label">{pkg.type}</span>
            </div>

            {isIndustry ? (
                <div className="package-content">
                    <div className="tile-list">
                        {pkg.tiles.map((tileType, idx) => {
                            // Create a temporary mock cell/tile for display
                            const mockTile: IndustryTile = {
                                id: `preview-${pkg.id}-${idx}`,
                                type: tileType,
                                ownerId: 'p1', // Dummy ID (color logic handled by theme or not important here) or maybe 'preview'
                                orientation: 0,
                                active: true,
                            };

                            const mockCell: HexCell = {
                                q: 0,
                                r: 0,
                                occupant: {
                                    type: 'Industry',
                                    playerId: 'p1',
                                    tile: mockTile
                                }
                            };

                            return (
                                <div key={idx} className="tile-item-hex">
                                    <svg width="60" height="60" viewBox="-55 -48 110 96">
                                        <Hex
                                            cell={mockCell}
                                            hideFlag={true}
                                            renderBorder={false} // Just the hex
                                        />
                                    </svg>
                                    <div className="tile-label">{tileType}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="package-content">
                    <div className="commodity-list">
                        {Object.entries(pkg.commodities).map(([commodity, count]) => (
                            <div key={commodity} className="commodity-item">
                                <div
                                    className="commodity-dot"
                                    style={{ backgroundColor: COMMODITY_COLORS[commodity as keyof typeof COMMODITY_COLORS] }}
                                />
                                <span className="commodity-name">{commodity}</span>
                                <span className="commodity-count">×{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {pkg.money > 0 && (
                <div className="package-money">
                    💰 ${pkg.money}
                </div>
            )}

            <button className="select-button" disabled={disabled}>
                Select Package
            </button>
        </div>
    );
}
