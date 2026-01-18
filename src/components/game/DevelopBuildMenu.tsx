import React from 'react';
import type { GameState, Player, IndustryType } from '../../types/gameState';
import { TILE_DEFINITIONS } from '../../utils/tileDefinitions';
import { ResourceIcon } from '../ui/ResourceIcon';
import { TileIcon } from '../ui/TileIcon';

interface DevelopBuildMenuProps {
    player: Player;
    gameState: GameState;
    selectedTool: IndustryType | 'Flag' | 'Eraser' | 'Rotate' | 'Move' | 'Automate' | null;
    forceMode: boolean;
    interactionLocked: boolean;
    selfPlayer?: { playerId: string } | null;

    setSelectedTool: (tool: IndustryType | 'Flag' | 'Move' | 'Automate' | null) => void;
    setForceMode: (v: boolean) => void;
    setIsMoving: (v: boolean) => void;
    setMoveSourceId: (v: string | null) => void;
    setMoveHistory: React.Dispatch<React.SetStateAction<Array<{ from: string; to: string; cost: number }>>>;
    setMovesCompleted: React.Dispatch<React.SetStateAction<number>>;
    handleAction: (action: string, payload?: any) => void;
    canAfford: (type: IndustryType, isForce: boolean) => boolean;
}

export const DevelopBuildMenu: React.FC<DevelopBuildMenuProps> = ({
    player,
    gameState,

    forceMode,
    interactionLocked,
    setSelectedTool,
    setForceMode,
    setIsMoving,
    setMoveSourceId,
    setMoveHistory,
    setMovesCompleted,

    handleAction,
    canAfford,
    selfPlayer
}) => {
    const hasOwnTiles = Object.values(gameState.board).some(
        cell => cell.occupant?.type === 'Industry' && cell.occupant.playerId === player.id
    );
    const hasNonAutomatedTiles = Object.values(gameState.board).some(
        cell => cell.occupant?.type === 'Industry' &&
            cell.occupant.playerId === player.id &&
            cell.occupant.tile &&
            !cell.occupant.tile.automated
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {/* Standard Tools */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button
                    onClick={() => {
                        setSelectedTool('Move');
                        setIsMoving(true);
                        setMoveSourceId(null);
                        setMoveHistory([]);
                        setMovesCompleted(0);
                    }}
                    disabled={interactionLocked || !hasOwnTiles || player.resources.Capital < 1}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        borderColor: '#444',
                        background: '#222',
                        color: 'white',
                        opacity: (interactionLocked || !hasOwnTiles || player.resources.Capital < 1) ? 0.4 : 1,
                        cursor: (!interactionLocked && hasOwnTiles && player.resources.Capital >= 1) ? 'pointer' : 'not-allowed',
                        filter: interactionLocked ? 'grayscale(0.8)' : 'none'
                    }}
                >
                    <span style={{ fontWeight: 'bold' }}>Move</span>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#aaa' }}>1</span>
                        <ResourceIcon type="Capital" size={10} />
                    </div>
                    <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>3 moves</div>
                </button>

                <button
                    onClick={() => setSelectedTool('Flag')}
                    disabled={interactionLocked || player.resources.Labor < 1 || player.flags <= 0}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        borderColor: '#444',
                        background: '#222',
                        color: 'white',
                        opacity: (interactionLocked || player.resources.Labor < 1 || player.flags <= 0) ? 0.4 : 1,
                        cursor: (!interactionLocked && player.resources.Labor >= 1 && player.flags > 0) ? 'pointer' : 'not-allowed',
                        filter: interactionLocked ? 'grayscale(0.8)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="24" height="12" viewBox="0 0 24 12">
                            <image
                                href={`/flags/${player.flag || (player.id === 'p1' ? 'anglica.svg' : 'bolshevica.svg')}`}
                                x="0" y="0" width="24" height="12"
                            />
                        </svg>
                        <span style={{ fontWeight: 'bold' }}>Flag</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#aaa' }}>1</span>
                        <ResourceIcon type="Labor" size={10} />
                    </div>
                </button>

                <button
                    onClick={() => setSelectedTool('Automate')}
                    disabled={interactionLocked || player.resources.Energy < 1 || player.resources.Capital < 2 || !hasNonAutomatedTiles}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        borderColor: '#444',
                        background: '#222',
                        color: 'white',
                        opacity: (interactionLocked || player.resources.Energy < 1 || player.resources.Capital < 2 || !hasNonAutomatedTiles) ? 0.4 : 1,
                        cursor: (!interactionLocked && player.resources.Energy >= 1 && player.resources.Capital >= 2 && hasNonAutomatedTiles) ? 'pointer' : 'not-allowed',
                        filter: interactionLocked ? 'grayscale(0.8)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="16" height="16" viewBox="-22 -22 44 44">
                            <path
                                d="M0,-21 L18.18,-10.5 18.18,10.5 0,21 -18.18,10.5 -18.18,-10.5 Z M0,-9 A9,9 0 1,1 -0.001,-9 Z"
                                fill="#999"
                                stroke="white"
                                strokeWidth="1.5"
                                fillRule="evenodd"
                            />
                        </svg>
                        <span style={{ fontWeight: 'bold' }}>Auto</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>1</span>
                            <ResourceIcon type="Energy" size={10} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>2</span>
                            <ResourceIcon type="Capital" size={10} />
                        </div>
                    </div>
                </button>
            </div>

            <div style={{ height: '1px', background: '#333', margin: '5px 0' }} />

            {/* Build List Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ color: '#fff', fontSize: '14px' }}>Build Industry</span>
                <label style={{ fontSize: '12px', color: forceMode ? 'magenta' : '#888', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={forceMode} onChange={(e) => setForceMode(e.target.checked)} />
                    Force (<ResourceIcon type="Capital" size={12} />+1)
                </label>
            </div>

            {/* Build List */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {Object.keys(TILE_DEFINITIONS).map(typeKey => {
                    const type = typeKey as IndustryType;
                    const def = TILE_DEFINITIONS[type];

                    const costComponents = Object.entries(def.costStruct || {}).map(([costType, amount]) => ({ amount, type: costType }));
                    const affordable = canAfford(type, forceMode);

                    return (
                        <button
                            key={type}
                            onClick={() => affordable && setSelectedTool(type)}
                            disabled={interactionLocked || !affordable}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '8px',
                                borderColor: '#444',
                                background: '#222',
                                opacity: (interactionLocked || !affordable) ? 0.4 : 1,
                                cursor: (!interactionLocked && affordable) ? 'pointer' : 'not-allowed',
                                filter: interactionLocked ? 'grayscale(0.8)' : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TileIcon type={type} size={20} />
                                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{type}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                                {costComponents.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                                        <span style={{ fontSize: '10px', color: '#aaa' }}>{c.amount}</span>
                                        <ResourceIcon type={c.type as any} size={10} />
                                    </div>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Pass Button for Develop Phase */}
            <button
                data-testid="develop-pass-button"
                onClick={() => handleAction('pass')}
                disabled={interactionLocked}
                style={{
                    padding: '12px',
                    background: !interactionLocked ? '#059669' : '#333',
                    color: !interactionLocked ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: !interactionLocked ? 'pointer' : 'not-allowed',
                    marginTop: 'auto',
                    opacity: !interactionLocked ? 1 : 0.5
                }}
            >
                ✓ Pass
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}>
                <label style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={player.autoPass || false}
                        onChange={(e) => handleAction('toggleAutoPass', { playerId: player.id, enabled: e.target.checked })}
                        disabled={interactionLocked && player.id !== selfPlayer?.playerId}
                    />
                    Auto-pass rest of phase
                </label>
            </div>
        </div>
    );
};
