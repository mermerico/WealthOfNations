import React, { useState, useEffect, useRef } from 'react';
import type { LogEntry, Player } from '../../types/gameState';

interface ActionLogProps {
    logs: LogEntry[];
    players: Player[];
}

export const ActionLog: React.FC<ActionLogProps> = ({ logs, players }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (scrollRef.current && !isCollapsed) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight; // Latest logs are at the bottom
        }
    }, [logs, isCollapsed]);

    const getPlayerColor = (playerId?: string) => {
        if (!playerId) return '#aaa';
        return players.find(p => p.id === playerId)?.color || '#aaa';
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div style={{
            position: 'absolute',
            bottom: '10px',
            right: '470px', // Left of MarketBoard (450px + gap)
            width: isCollapsed ? '150px' : '300px',
            height: isCollapsed ? '40px' : '250px',
            background: 'rgba(26, 26, 26, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #444',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 100,
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
        }}>
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                data-testid="action-log-header"
                style={{
                    padding: '8px 12px',
                    background: 'rgba(40, 40, 40, 0.9)',
                    borderBottom: isCollapsed ? 'none' : '1px solid #444',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px' }}>📜</span> Action Log
                </span>
                <button style={{
                    background: 'none',
                    border: 'none',
                    color: '#aaa',
                    cursor: 'pointer',
                    padding: '2px',
                    fontSize: '12px',
                    transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                }}>
                    ▼
                </button>
            </div>

            {/* Log Entries */}
            {!isCollapsed && (
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#444 transparent'
                    }}
                >
                    {logs.length === 0 ? (
                        <div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                            No actions yet
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} style={{
                                fontSize: '11px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderLeft: `3px solid ${getPlayerColor(log.playerId)}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '9px' }}>
                                    <span>{log.type.toUpperCase()}</span>
                                    <span>{formatTime(log.timestamp)}</span>
                                </div>
                                <div style={{ color: log.type === 'phase' ? '#4ade80' : log.type === 'system' ? '#60a5fa' : '#eee', lineHeight: '1.4' }}>
                                    {log.message}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
