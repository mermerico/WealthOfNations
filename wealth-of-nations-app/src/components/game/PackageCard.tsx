import type { Package } from '../../utils/packageDefinitions';
import { COMMODITY_COLORS } from '../../utils/tileDefinitions';
import './PackageCard.css';

interface PackageCardProps {
    package: Package;
    onSelect: () => void;
}

export default function PackageCard({ package: pkg, onSelect }: PackageCardProps) {
    const isIndustry = pkg.type === 'Industry';

    return (
        <div className="package-card" onClick={onSelect}>
            <div className="package-header">
                <span className="package-type-label">{pkg.type}</span>
            </div>

            {isIndustry ? (
                <div className="package-content">
                    <div className="tile-list">
                        {pkg.tiles.map((tile, idx) => (
                            <div key={idx} className="tile-item">{tile}</div>
                        ))}
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

            <button className="select-button">Select Package</button>
        </div>
    );
}
