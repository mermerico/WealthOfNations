import React from 'react';
import type { Player, HexCell, CommodityType, IndustryType } from '../../types/gameState';
import { ResourceIcon } from '../ui/ResourceIcon';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { coordsToString } from '../../utils/hexUtils';

export interface BlocConfig {
    powered: boolean;
    automated: boolean;
    fedTiles: Set<string>;
}

export interface BlocTotals {
    costs: { Food: number; Energy: number; Labor: number; Ore: number };
    production: { commodity: CommodityType | 'Money'; amount: number } | null;
}

export interface ProductionTotals {
    totalFoodCost: number;
    totalEnergyCost: number;
    totalOreCost: number;
    outputs: Record<string, number>;
}

interface ProduceActionsPanelProps {
    player: Player;
    playerBlocs: Array<{ type: IndustryType; tiles: HexCell[] }>;
    blocConfigs: Map<number, BlocConfig>;
    productionTotals: ProductionTotals;
    hoveredBlocIndex: number | null;
    hoveredTileId: string | null;

    toggleBlocPower: (blocIndex: number, powered: boolean) => void;
    toggleBlocAutomation: (blocIndex: number, automated: boolean) => void;
    toggleTileFed: (blocIndex: number, tileId: string, fed: boolean) => void;
    setHoveredBlocIndex: (v: number | null) => void;
    setHoveredTileId: (v: string | null) => void;
    calculateBlocTotals: (bloc: HexCell[], config: BlocConfig | undefined) => BlocTotals;

    handleRunProduction: () => void;
    showProductionConfirmation: boolean;
    setShowProductionConfirmation: (v: boolean) => void;
}

export const ProduceActionsPanel: React.FC<ProduceActionsPanelProps> = ({
    player,
    playerBlocs,
    blocConfigs,
    productionTotals,
    hoveredBlocIndex,
    hoveredTileId,
    toggleBlocPower,
    toggleBlocAutomation,
    toggleTileFed,
    setHoveredBlocIndex,
    setHoveredTileId,
    calculateBlocTotals,
    handleRunProduction,
    showProductionConfirmation,
    setShowProductionConfirmation
}) => {
    const canAffordProduction = player.resources.Food >= productionTotals.totalFoodCost &&
        player.resources.Energy >= productionTotals.totalEnergyCost;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflow: 'auto' }}>
            {/* Net Production at Top */}
            <div data-testid="net-production-summary" style={{ background: '#222', padding: '10px', borderRadius: '4px', borderTop: '2px solid #facc15' }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '13px' }}>Net Production</h4>
                <div style={{ fontSize: '11px' }}>
                    <div style={{ color: '#f87171', marginBottom: '2px' }}>
                        Consuming:
                        {productionTotals.totalFoodCost > 0 && ` ${productionTotals.totalFoodCost} Food`}
                        {productionTotals.totalFoodCost > 0 && productionTotals.totalEnergyCost > 0 && ','}
                        {productionTotals.totalEnergyCost > 0 && ` ${productionTotals.totalEnergyCost} Energy`}
                        {productionTotals.totalOreCost > 0 && `, ${productionTotals.totalOreCost} Ore`}
                        {!productionTotals.totalFoodCost && !productionTotals.totalEnergyCost && !productionTotals.totalOreCost && ' 0'}
                    </div>
                    <div style={{ color: '#4ade80' }}>
                        Producing: {Object.entries(productionTotals.outputs).map(([commodity, amount]) => `${amount} ${commodity}`).join(', ') || '0'}
                    </div>
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ marginRight: '2px' }}>Net Gain:</span>
                        {(() => {
                            const netGains: Record<string, number> = {
                                Food: (productionTotals.outputs['Food'] || 0) - productionTotals.totalFoodCost,
                                Energy: (productionTotals.outputs['Energy'] || 0) - productionTotals.totalEnergyCost,
                                Labor: (productionTotals.outputs['Labor'] || 0),
                                Ore: (productionTotals.outputs['Ore'] || 0) - productionTotals.totalOreCost,
                                Capital: (productionTotals.outputs['Capital'] || 0),
                                Money: (productionTotals.outputs['Money'] || 0)
                            };

                            const hasAnyChange = Object.values(netGains).some(v => v !== 0);
                            if (!hasAnyChange) {
                                return <span style={{ color: '#888' }}>±0</span>;
                            }

                            return Object.entries(netGains).map(([commodity, netAmount]) => {
                                if (netAmount === 0) return null;
                                const sign = netAmount > 0 ? '+' : '';
                                const color = netAmount > 0 ? '#4ade80' : '#f87171';
                                return (
                                    <span key={commodity} style={{ display: 'flex', alignItems: 'center', gap: '2px', color }}>
                                        {sign}{netAmount}
                                        <ResourceIcon type={commodity as CommodityType} size={12} />
                                    </span>
                                );
                            }).filter(Boolean);
                        })()}
                    </div>
                </div>
            </div>

            {/* Blocs List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {playerBlocs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No Industries</div>}
                {playerBlocs.map((bloc, blocIndex) => {
                    const config = blocConfigs.get(blocIndex);
                    const totals = calculateBlocTotals(bloc.tiles, config);
                    const hasAutomation = bloc.tiles.some(t => t.occupant?.tile?.automated);

                    return (
                        <div
                            key={blocIndex}
                            data-testid="bloc-config-item"
                            style={{
                                background: '#333',
                                padding: '8px',
                                borderRadius: '4px',
                                border: hoveredBlocIndex === blocIndex ? '2px solid #facc15' : '2px solid transparent'
                            }}
                            onMouseEnter={() => setHoveredBlocIndex(blocIndex)}
                            onMouseLeave={() => setHoveredBlocIndex(null)}
                        >
                            {/* Bloc Header with Power Checkbox */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={config?.powered || false}
                                        onChange={(e) => toggleBlocPower(blocIndex, e.target.checked)}
                                    />
                                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#ddd' }}>
                                        {bloc.type} Bloc
                                    </span>
                                </label>
                            </div>

                            {/* Automation Checkbox (if applicable) */}
                            {hasAutomation && config?.powered && (
                                <div style={{ marginLeft: '24px', marginBottom: '6px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                                        <input
                                            type="checkbox"
                                            checked={config?.automated || false}
                                            onChange={(e) => toggleBlocAutomation(blocIndex, e.target.checked)}
                                        />
                                        <span style={{ color: '#c084fc' }}>Run Automation</span>
                                    </label>
                                </div>
                            )}

                            {/* Tiles to Feed */}
                            {config?.powered && bloc.type !== 'Farm' && (
                                <div style={{ marginLeft: '24px', marginTop: '6px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Tiles to Feed:</div>
                                    {bloc.tiles.map((tile) => {
                                        const tileId = coordsToString(tile.q, tile.r);
                                        const isFed = config?.fedTiles.has(tileId) || false;

                                        return (
                                            <div
                                                key={tileId}
                                                style={{
                                                    marginLeft: '8px',
                                                    marginBottom: '2px',
                                                    background: hoveredTileId === tileId ? '#444' : 'transparent',
                                                    padding: '2px 4px',
                                                    borderRadius: '2px'
                                                }}
                                                onMouseEnter={() => setHoveredTileId(tileId)}
                                                onMouseLeave={() => setHoveredTileId(null)}
                                            >
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: config?.automated ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: config?.automated ? 0.6 : 1 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isFed}
                                                        disabled={config?.automated}
                                                        onChange={(e) => toggleTileFed(blocIndex, tileId, e.target.checked)}
                                                    />
                                                    <span style={{ color: '#bbb' }}>Tile {bloc.tiles.findIndex(t => coordsToString(t.q, t.r) === tileId) + 1}</span>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Bloc Consumption/Production Summary */}
                            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #444', fontSize: '11px' }}>
                                <div style={{ color: '#aaa' }}>
                                    Consuming: {totals.costs.Food > 0 && `${totals.costs.Food} Food`}
                                    {totals.costs.Food > 0 && totals.costs.Energy > 0 && ', '}
                                    {totals.costs.Energy > 0 && `${totals.costs.Energy} Energy`}
                                    {totals.costs.Ore > 0 && `, ${totals.costs.Ore} Ore`}
                                    {!totals.costs.Food && !totals.costs.Energy && !totals.costs.Ore && '0'}
                                </div>
                                <div style={{ color: '#4ade80' }}>
                                    Producing: {totals.production ? `${totals.production.amount} ${totals.production.commodity}` : '0'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Run Production Button */}
            {player.hasProduced ? (
                <div
                    data-testid="production-confirmed-indicator"
                    style={{
                        padding: '12px',
                        background: '#1c3320',
                        color: '#4ade80',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        borderRadius: '4px',
                        marginTop: 'auto',
                        border: '1px solid #22c55e'
                    }}
                >
                    ✓ Production Confirmed
                </div>
            ) : (
                <button
                    data-testid="run-production-button"
                    onClick={() => setShowProductionConfirmation(true)}
                    disabled={!canAffordProduction}
                    style={{
                        padding: '12px',
                        background: canAffordProduction ? '#1c3320' : '#322',
                        borderColor: canAffordProduction ? '#22c55e' : '#522',
                        color: '#fff',
                        cursor: canAffordProduction ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        marginTop: 'auto'
                    }}
                >
                    Run Production
                </button>
            )}

            {showProductionConfirmation && (
                <ConfirmationModal
                    isOpen={showProductionConfirmation}
                    title="Run Production"
                    message={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>Are you sure you want to run production?</div>
                            <div style={{ background: '#111', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>
                                <div style={{ color: '#f87171', marginBottom: '4px' }}>
                                    <strong>Consuming:</strong>
                                    {productionTotals.totalFoodCost > 0 && ` ${productionTotals.totalFoodCost} Food`}
                                    {productionTotals.totalFoodCost > 0 && productionTotals.totalEnergyCost > 0 && ','}
                                    {productionTotals.totalEnergyCost > 0 && ` ${productionTotals.totalEnergyCost} Energy`}
                                    {productionTotals.totalOreCost > 0 && `, ${productionTotals.totalOreCost} Ore`}
                                    {!productionTotals.totalFoodCost && !productionTotals.totalEnergyCost && !productionTotals.totalOreCost && ' Nothing'}
                                </div>
                                <div style={{ color: '#4ade80' }}>
                                    <strong>Producing:</strong> {Object.entries(productionTotals.outputs).map(([commodity, amount]) => `${amount} ${commodity}`).join(', ') || 'Nothing'}
                                </div>
                            </div>
                        </div>
                    }
                    onConfirm={() => {
                        handleRunProduction();
                        setShowProductionConfirmation(false);
                    }}
                    onCancel={() => setShowProductionConfirmation(false)}
                    confirmText="Confirm"
                    cancelText="Back"
                    data-testid="production-confirmation-modal"
                />
            )}
        </div>
    );
};
