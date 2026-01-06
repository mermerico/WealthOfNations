import React from 'react';
import type { Player, CommodityType } from '../../types/gameState';
import { COMMODITY_COLORS } from '../../utils/tileDefinitions';

interface PlayerDashboardProps {
    player: Player;
}

const ORDER: CommodityType[] = ['Food', 'Energy', 'Labor', 'Ore', 'Capital'];

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ player }) => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            padding: '10px 20px',
            background: '#222',
            borderTop: '1px solid #444',
            color: 'white',
            justifyContent: 'space-between'
        }}>
            {/* Resources Section */}
            <div style={{ display: 'flex', gap: '15px' }}>
                {ORDER.map(type => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{
                            width: '15px',
                            height: '15px',
                            background: COMMODITY_COLORS[type],
                            borderRadius: '3px',
                            border: type === 'Capital' ? '1px solid #555' : 'none'
                        }} />
                        <span style={{ fontWeight: 'bold' }}>{player.resources[type]}</span>
                    </div>
                ))}
            </div>

            {/* Separator */}
            <div style={{ width: '1px', height: '20px', background: '#555' }} />

            {/* Finance Section */}
            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                    <span>Money:</span>
                    <span style={{ fontWeight: 'bold' }}>${player.money}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444' }}>
                    <span>Loans:</span>
                    <span style={{ fontWeight: 'bold' }}>{player.loans}</span>
                </div>
            </div>

            {/* Separator */}
            <div style={{ width: '1px', height: '20px', background: '#555' }} />

            {/* Assets Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#facc15' }}>
                <span>Flags:</span>
                <span style={{ fontWeight: 'bold' }}>{player.flags}</span>
            </div>
        </div>
    );
};
