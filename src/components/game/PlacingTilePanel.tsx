import React from 'react';
import type { IndustryType } from '../../types/gameState';

interface PlacingTilePanelProps {
    pendingBuild: { id: string; type: IndustryType; orientation: number };
    onRotate: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export const PlacingTilePanel: React.FC<PlacingTilePanelProps> = ({
    pendingBuild,
    onRotate,
    onConfirm,
    onCancel
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <div style={{ background: '#222', padding: '10px', borderRadius: '4px', border: '2px solid #f59e0b' }}>
                <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                    Placing Tile
                </div>
                <div style={{ color: '#fff', fontSize: '16px', textAlign: 'center', marginBottom: '4px' }}>
                    <strong>{pendingBuild.type}</strong>
                </div>
                <div style={{ color: '#888', fontSize: '11px', textAlign: 'center' }}>
                    Orientation: {pendingBuild.orientation}
                </div>
            </div>

            <button
                onClick={onRotate}
                style={{
                    padding: '10px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}
            >
                ↻ Rotate
            </button>

            <button
                onClick={onConfirm}
                style={{
                    padding: '12px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: 'auto'
                }}
            >
                ✓ Confirm Placement
            </button>

            <button
                onClick={onCancel}
                style={{
                    padding: '10px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}
            >
                ✕ Cancel
            </button>
        </div>
    );
};
